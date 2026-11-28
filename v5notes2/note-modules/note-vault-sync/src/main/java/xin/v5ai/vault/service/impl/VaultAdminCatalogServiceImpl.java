package xin.v5ai.vault.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.catalog.VaultCatalogValidator;
import xin.v5ai.vault.catalog.VaultCatalogZipParser;
import xin.v5ai.vault.domain.VaultCatalogItem;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogDetailVo;
import xin.v5ai.vault.domain.vo.admin.VaultAdminCatalogItemVo;
import xin.v5ai.vault.domain.vo.admin.VaultCatalogZipPreviewVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultCatalogItemMapper;
import xin.v5ai.vault.service.IVaultAdminCatalogService;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 管理端 Vault 扩展与主题目录维护服务实现（P3）。
 */
@Service
public class VaultAdminCatalogServiceImpl implements IVaultAdminCatalogService {

    public static final String STATUS_DRAFT = "0";
    public static final String STATUS_PUBLISHED = "1";
    public static final String STATUS_UNPUBLISHED = "2";

    private final VaultCatalogItemMapper itemMapper;
    private final JsonMapper jsonMapper;

    public VaultAdminCatalogServiceImpl(VaultCatalogItemMapper itemMapper) {
        this.itemMapper = itemMapper;
        this.jsonMapper = JsonMapper.builder().build();
    }

    @Autowired
    public VaultAdminCatalogServiceImpl(VaultCatalogItemMapper itemMapper,
                                        ObjectProvider<JsonMapper> jsonMapperProvider) {
        this.itemMapper = itemMapper;
        JsonMapper provided = jsonMapperProvider == null ? null : jsonMapperProvider.getIfAvailable();
        this.jsonMapper = provided != null ? provided : JsonMapper.builder().build();
    }

    @Override
    public PageResult<VaultAdminCatalogItemVo> list(String kind, String status, String keyword, PageQuery pageQuery) {
        LambdaQueryWrapper<VaultCatalogItem> lqw = new LambdaQueryWrapper<>();
        if (StringUtils.isNotBlank(kind)) {
            lqw.eq(VaultCatalogItem::getKind, kind.trim().toLowerCase(Locale.ROOT));
        }
        if (StringUtils.isNotBlank(status)) {
            lqw.eq(VaultCatalogItem::getStatus, status.trim());
        }
        if (StringUtils.isNotBlank(keyword)) {
            String kw = keyword.trim();
            lqw.and(w -> w.like(VaultCatalogItem::getId, kw)
                .or().like(VaultCatalogItem::getName, kw)
                .or().like(VaultCatalogItem::getAuthor, kw));
        }
        lqw.orderByAsc(VaultCatalogItem::getSortOrder)
            .orderByDesc(VaultCatalogItem::getUpdateTime)
            .orderByAsc(VaultCatalogItem::getId);

        Page<VaultCatalogItem> page = itemMapper.selectPage(pageQuery.build(), lqw);
        List<VaultAdminCatalogItemVo> rows = new ArrayList<>(page.getRecords().size());
        for (VaultCatalogItem item : page.getRecords()) {
            rows.add(toItemVo(item));
        }
        return PageResult.build(rows, page.getTotal());
    }

    @Override
    public VaultAdminCatalogDetailVo detail(String id) {
        VaultCatalogItem item = requireItem(id);
        return toDetailVo(item, List.of());
    }

    @Override
    public VaultCatalogZipPreviewVo parseZip(InputStream input) {
        return VaultCatalogZipParser.parse(input, jsonMapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultAdminCatalogDetailVo create(VaultCatalogSaveBo bo) {
        VaultCatalogValidator.ValidatedPackage validated = VaultCatalogValidator.validate(bo);
        if (itemMapper.selectById(validated.id()) != null) {
            throw new VaultBusinessException(HttpStatus.CONFLICT, VaultErrorCodes.CONFLICT_PATH_EXISTS,
                "扩展 ID 已存在: " + validated.id());
        }
        Map<String, String> syncedFiles = syncManifestJson(validated);
        Date now = new Date();
        VaultCatalogItem entity = new VaultCatalogItem();
        entity.setId(validated.id());
        applyValidatedFields(entity, validated, syncedFiles, bo.getSortOrder());
        entity.setStatus(STATUS_DRAFT);
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        itemMapper.insert(entity);
        return toDetailVo(entity, validated.warnings());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public VaultAdminCatalogDetailVo update(String id, VaultCatalogSaveBo bo) {
        VaultCatalogItem existing = requireItem(id);
        bo.setId(existing.getId());
        VaultCatalogValidator.ValidatedPackage validated = VaultCatalogValidator.validate(bo);
        Map<String, String> syncedFiles = syncManifestJson(validated);
        applyValidatedFields(existing, validated, syncedFiles, bo.getSortOrder());
        existing.setUpdateTime(new Date());
        itemMapper.updateById(existing);
        return toDetailVo(existing, validated.warnings());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(String id, String status) {
        VaultCatalogItem existing = requireItem(id);
        String nextStatus = status == null ? "" : status.trim();
        if (!STATUS_PUBLISHED.equals(nextStatus) && !STATUS_UNPUBLISHED.equals(nextStatus)) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID,
                "状态仅支持 1(上架) 或 2(下架)");
        }
        if (STATUS_PUBLISHED.equals(nextStatus)) {
            // Re-run security gate before publishing so legacy/draft rows can never bypass rules.
            VaultCatalogSaveBo check = new VaultCatalogSaveBo();
            check.setId(existing.getId());
            check.setName(existing.getName());
            check.setKind(existing.getKind());
            check.setVersion(existing.getVersion());
            check.setMinAppVersion(existing.getMinAppVersion());
            check.setDescription(existing.getDescription());
            check.setAuthor(existing.getAuthor());
            check.setAuthorUrl(existing.getAuthorUrl());
            check.setPermissions(readList(existing.getPermissionsJson()));
            check.setNetworkAllowlist(readList(existing.getAllowlistJson()));
            check.setTags(readList(existing.getTagsJson()));
            check.setFiles(readFiles(existing.getFilesJson()));
            VaultCatalogValidator.validate(check);
        }
        existing.setStatus(nextStatus);
        existing.setUpdateTime(new Date());
        itemMapper.updateById(existing);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String id) {
        VaultCatalogItem existing = requireItem(id);
        if (STATUS_PUBLISHED.equals(existing.getStatus())) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID,
                "已上架扩展不能直接删除，请先下架");
        }
        itemMapper.deleteById(existing.getId());
    }

    private VaultCatalogItem requireItem(String id) {
        if (StringUtils.isBlank(id)) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "扩展 ID 不能为空");
        }
        VaultCatalogItem item = itemMapper.selectById(id.trim());
        if (item == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.NOT_FOUND, "扩展条目不存在: " + id);
        }
        return item;
    }

    private void applyValidatedFields(VaultCatalogItem entity,
                                      VaultCatalogValidator.ValidatedPackage v,
                                      Map<String, String> files,
                                      Integer sortOrder) {
        entity.setName(v.name());
        entity.setKind(v.kind());
        entity.setVersion(v.version());
        entity.setMinAppVersion(v.minAppVersion());
        entity.setDescription(v.description());
        entity.setAuthor(v.author());
        entity.setAuthorUrl(v.authorUrl());
        entity.setPermissionsJson(writeJson(v.permissions()));
        entity.setAllowlistJson(writeJson(v.networkAllowlist()));
        entity.setTagsJson(writeJson(v.tags()));
        entity.setFilesJson(writeJson(files));
        entity.setSortOrder(sortOrder == null ? 0 : sortOrder);
    }

    /**
     * 保持包内 manifest.json 与持久化元数据同步。
     */
    private Map<String, String> syncManifestJson(VaultCatalogValidator.ValidatedPackage v) {
        Map<String, String> files = new LinkedHashMap<>(v.files());
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("id", v.id());
        manifest.put("name", v.name());
        manifest.put("kind", v.kind());
        manifest.put("version", v.version());
        if (v.minAppVersion() != null) {
            manifest.put("minAppVersion", v.minAppVersion());
        }
        if (v.description() != null) {
            manifest.put("description", v.description());
        }
        if (v.author() != null) {
            manifest.put("author", v.author());
        }
        if (v.authorUrl() != null) {
            manifest.put("authorUrl", v.authorUrl());
        }
        manifest.put("permissions", v.permissions());
        if (!v.networkAllowlist().isEmpty()) {
            manifest.put("networkAllowlist", v.networkAllowlist());
        }
        if (!v.tags().isEmpty()) {
            manifest.put("tags", v.tags());
        }
        if ("plugin".equals(v.kind())) {
            manifest.put("main", "main.js");
        } else {
            manifest.put("theme", "theme.css");
            if (files.containsKey("theme.json")) {
                manifest.put("themeMeta", "theme.json");
            }
            if (files.containsKey("main.js")) {
                manifest.put("main", "main.js");
            }
        }
        files.put("manifest.json", jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest));
        return files;
    }

    private VaultAdminCatalogItemVo toItemVo(VaultCatalogItem item) {
        VaultAdminCatalogItemVo vo = new VaultAdminCatalogItemVo();
        populateItemVo(vo, item);
        return vo;
    }

    private VaultAdminCatalogDetailVo toDetailVo(VaultCatalogItem item, List<String> warnings) {
        VaultAdminCatalogDetailVo vo = new VaultAdminCatalogDetailVo();
        populateItemVo(vo, item);
        vo.setFiles(readFiles(item.getFilesJson()));
        vo.setWarnings(warnings == null ? List.of() : new ArrayList<>(warnings));
        return vo;
    }

    private void populateItemVo(VaultAdminCatalogItemVo vo, VaultCatalogItem item) {
        vo.setId(item.getId());
        vo.setName(item.getName());
        vo.setKind(item.getKind());
        vo.setVersion(item.getVersion());
        vo.setMinAppVersion(item.getMinAppVersion());
        vo.setDescription(item.getDescription());
        vo.setAuthor(item.getAuthor());
        vo.setAuthorUrl(item.getAuthorUrl());
        vo.setPermissions(readList(item.getPermissionsJson()));
        vo.setNetworkAllowlist(readList(item.getAllowlistJson()));
        vo.setTags(readList(item.getTagsJson()));
        vo.setStatus(item.getStatus());
        vo.setSortOrder(item.getSortOrder() == null ? 0 : item.getSortOrder());
        vo.setFileCount(readFiles(item.getFilesJson()).size());
        vo.setPackagePath("/vault/v1/catalog/plugins/" + item.getId() + "/package");
        vo.setCreateTime(item.getCreateTime());
        vo.setUpdateTime(item.getUpdateTime());
    }

    private String writeJson(Object value) {
        return jsonMapper.writeValueAsString(value);
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> list = jsonMapper.readValue(json, new TypeReference<>() {
            });
            return list == null ? List.of() : list;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Map<String, String> readFiles(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, String> map = jsonMapper.readValue(json, new TypeReference<>() {
            });
            return map == null ? new LinkedHashMap<>() : new LinkedHashMap<>(map);
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }
}
