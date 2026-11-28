package xin.v5ai.vault.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.catalog.CatalogProtocol;
import xin.v5ai.vault.catalog.VaultCatalogValidator;
import xin.v5ai.vault.domain.VaultCatalogItem;
import xin.v5ai.vault.domain.vo.VaultCatalogItemVo;
import xin.v5ai.vault.domain.vo.VaultCatalogListVo;
import xin.v5ai.vault.domain.vo.VaultCatalogPackageVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.mapper.VaultCatalogItemMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Official plugin/theme catalog exposed to Vault Client ({@code /vault/v1/catalog/*}).
 *
 * <p>Reads published ({@code status = '1'}) entries from {@code vault_catalog_item}; falls back to
 * in-memory seeds when constructed without a mapper (unit tests). Rejects publishing tags and
 * forbidden permissions defensively.</p>
 */
@Service
public class VaultCatalogService {

    public static final String STATUS_PUBLISHED = "1";

    private final VaultCatalogItemMapper itemMapper;
    private final JsonMapper jsonMapper;
    private final List<SeedEntry> seeds = List.of(seedPlugin(), seedTheme());

    public VaultCatalogService() {
        this.itemMapper = null;
        this.jsonMapper = JsonMapper.builder().build();
    }

    @Autowired
    public VaultCatalogService(VaultCatalogItemMapper itemMapper, ObjectProvider<JsonMapper> jsonMapperProvider) {
        this.itemMapper = itemMapper;
        JsonMapper provided = jsonMapperProvider == null ? null : jsonMapperProvider.getIfAvailable();
        this.jsonMapper = provided != null ? provided : JsonMapper.builder().build();
    }

    public VaultCatalogListVo list(String kind) {
        VaultCatalogListVo vo = new VaultCatalogListVo();
        vo.setCatalogProtocolVersion(CatalogProtocol.PROTOCOL_VERSION);
        vo.setFileSyncResource(false);
        List<VaultCatalogItemVo> items = new ArrayList<>();

        if (itemMapper != null) {
            LambdaQueryWrapper<VaultCatalogItem> lqw = new LambdaQueryWrapper<VaultCatalogItem>()
                .eq(VaultCatalogItem::getStatus, STATUS_PUBLISHED);
            if (kind != null && !kind.isBlank()) {
                lqw.eq(VaultCatalogItem::getKind, kind.trim().toLowerCase(Locale.ROOT));
            }
            lqw.orderByAsc(VaultCatalogItem::getSortOrder).orderByAsc(VaultCatalogItem::getId);
            List<VaultCatalogItem> rows = itemMapper.selectList(lqw);
            if (rows != null) {
                for (VaultCatalogItem row : rows) {
                    VaultCatalogItemVo item = toItemVo(row);
                    if (hasForbiddenTag(item.getTags()) || hasForbiddenPermission(item.getPermissions())) {
                        continue;
                    }
                    items.add(item);
                }
            }
            vo.setItems(items);
            return vo;
        }

        for (SeedEntry seed : seeds) {
            if (hasForbiddenTag(seed.item.getTags())) {
                continue;
            }
            if (kind != null && !kind.isBlank() && !kind.equalsIgnoreCase(seed.item.getKind())) {
                continue;
            }
            items.add(copyItem(seed.item));
        }
        vo.setItems(items);
        return vo;
    }

    public VaultCatalogItemVo get(String id) {
        if (itemMapper != null) {
            VaultCatalogItem row = requirePublished(id);
            VaultCatalogItemVo item = toItemVo(row);
            assertSafe(item.getTags(), item.getPermissions());
            return item;
        }
        SeedEntry seed = findSeed(id);
        if (hasForbiddenTag(seed.item.getTags())) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝 publishing 类目录条目");
        }
        return copyItem(seed.item);
    }

    public VaultCatalogPackageVo packageOf(String id) {
        if (itemMapper != null) {
            VaultCatalogItem row = requirePublished(id);
            VaultCatalogItemVo item = toItemVo(row);
            assertSafe(item.getTags(), item.getPermissions());
            VaultCatalogPackageVo vo = new VaultCatalogPackageVo();
            vo.setCatalogProtocolVersion(CatalogProtocol.PROTOCOL_VERSION);
            vo.setFileSyncResource(false);
            vo.setId(row.getId());
            vo.setKind(row.getKind());
            vo.setVersion(row.getVersion());
            vo.setFiles(readFilesMap(row.getFilesJson()));
            return vo;
        }
        SeedEntry seed = findSeed(id);
        if (hasForbiddenTag(seed.item.getTags())) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝 publishing 类目录包");
        }
        VaultCatalogPackageVo vo = new VaultCatalogPackageVo();
        vo.setCatalogProtocolVersion(CatalogProtocol.PROTOCOL_VERSION);
        vo.setFileSyncResource(false);
        vo.setId(seed.item.getId());
        vo.setKind(seed.item.getKind());
        vo.setVersion(seed.item.getVersion());
        vo.setFiles(new LinkedHashMap<>(seed.files));
        return vo;
    }

    private VaultCatalogItem requirePublished(String id) {
        VaultCatalogItem row = id == null ? null : itemMapper.selectById(id.trim());
        if (row == null || !STATUS_PUBLISHED.equals(row.getStatus())) {
            throw new VaultBusinessException(404, VaultErrorCodes.NOT_FOUND, "catalog 条目不存在: " + id);
        }
        return row;
    }

    private static void assertSafe(List<String> tags, List<String> permissions) {
        if (hasForbiddenTag(tags)) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝 publishing 类目录条目");
        }
        if (hasForbiddenPermission(permissions)) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝包含禁用权限的目录条目");
        }
    }

    private VaultCatalogItemVo toItemVo(VaultCatalogItem row) {
        VaultCatalogItemVo vo = new VaultCatalogItemVo();
        vo.setId(row.getId());
        vo.setName(row.getName());
        vo.setKind(row.getKind());
        vo.setVersion(row.getVersion());
        vo.setDescription(row.getDescription());
        vo.setAuthor(row.getAuthor());
        vo.setMinAppVersion(row.getMinAppVersion());
        vo.setPermissions(readStringList(row.getPermissionsJson()));
        vo.setTags(readStringList(row.getTagsJson()));
        vo.setNetworkAllowlist(readStringList(row.getAllowlistJson()));
        vo.setPackagePath("/vault/v1/catalog/plugins/" + row.getId() + "/package");
        return vo;
    }

    private List<String> readStringList(String json) {
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

    private Map<String, String> readFilesMap(String json) {
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

    private SeedEntry findSeed(String id) {
        for (SeedEntry seed : seeds) {
            if (seed.item.getId().equals(id)) {
                return seed;
            }
        }
        throw new VaultBusinessException(404, VaultErrorCodes.NOT_FOUND, "catalog 条目不存在: " + id);
    }

    public static boolean hasForbiddenTag(List<String> tags) {
        if (tags == null) {
            return false;
        }
        for (String tag : tags) {
            if (tag != null && VaultCatalogValidator.FORBIDDEN_TAGS.contains(tag.trim().toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    public static boolean hasForbiddenPermission(List<String> permissions) {
        if (permissions == null) {
            return false;
        }
        for (String perm : permissions) {
            if (perm == null) {
                continue;
            }
            String p = perm.trim();
            if (VaultCatalogValidator.FORBIDDEN_PERMISSIONS.contains(p) || p.startsWith("publish:")) {
                return true;
            }
        }
        return false;
    }

    private static VaultCatalogItemVo copyItem(VaultCatalogItemVo src) {
        VaultCatalogItemVo vo = new VaultCatalogItemVo();
        vo.setId(src.getId());
        vo.setName(src.getName());
        vo.setKind(src.getKind());
        vo.setVersion(src.getVersion());
        vo.setDescription(src.getDescription());
        vo.setAuthor(src.getAuthor());
        vo.setMinAppVersion(src.getMinAppVersion());
        vo.setPermissions(new ArrayList<>(src.getPermissions()));
        vo.setTags(new ArrayList<>(src.getTags()));
        vo.setNetworkAllowlist(new ArrayList<>(src.getNetworkAllowlist()));
        vo.setPackagePath(src.getPackagePath());
        return vo;
    }

    private static SeedEntry seedPlugin() {
        VaultCatalogItemVo item = new VaultCatalogItemVo();
        item.setId("safe-fetch-demo");
        item.setName("Safe Fetch Demo");
        item.setKind("plugin");
        item.setVersion("1.0.0");
        item.setDescription("官方示例：network:safe 白名单 GET + Ribbon/SettingTab");
        item.setAuthor("v5notes");
        item.setMinAppVersion("0.1.0");
        item.setPermissions(List.of("ui:commands", "ui:ribbon", "ui:settings", "network:safe"));
        item.setTags(List.of("demo", "network", "official"));
        item.setNetworkAllowlist(List.of("httpbin.org"));
        item.setPackagePath("/vault/v1/catalog/plugins/safe-fetch-demo/package");

        Map<String, String> files = new LinkedHashMap<>();
        files.put("manifest.json", """
            {
              "id": "safe-fetch-demo",
              "name": "Safe Fetch Demo",
              "kind": "plugin",
              "version": "1.0.0",
              "minAppVersion": "0.1.0",
              "description": "官方示例：network:safe 白名单 GET + Ribbon/SettingTab",
              "author": "v5notes",
              "permissions": ["ui:commands", "ui:ribbon", "ui:settings", "network:safe"],
              "networkAllowlist": ["httpbin.org"],
              "tags": ["demo", "network", "official"],
              "main": "main.js"
            }
            """);
        files.put("main.js", """
            module.exports = class SafeFetchDemoPlugin extends Plugin {
              async onload() {
                this.addCommand({
                  id: 'ping-httpbin',
                  name: 'Ping httpbin (network:safe)',
                  callback: async () => {
                    try {
                      const res = await this.app.network.request('https://httpbin.org/get?from=v5notes-vault')
                      this.app.workspace.openNotice('httpbin OK · status ' + res.status)
                    } catch (e) {
                      this.app.workspace.openNotice('network:safe 失败: ' + (e && e.message ? e.message : String(e)))
                    }
                  },
                })
                this.addRibbonIcon({
                  id: 'safe-fetch-ribbon',
                  title: 'Safe Fetch',
                  icon: 'SF',
                  callback: async () => {
                    this.app.workspace.openNotice('Ribbon → 使用命令「Ping httpbin」')
                  },
                })
                this.addSettingTab({
                  id: 'safe-fetch-settings',
                  name: 'Safe Fetch',
                  display: (el) => {
                    el.innerHTML = ''
                    const p = document.createElement('p')
                    p.textContent = '仅允许访问 httpbin.org。无第三方发布。'
                    el.appendChild(p)
                  },
                })
              }
            }
            """);
        return new SeedEntry(item, files);
    }

    private static SeedEntry seedTheme() {
        VaultCatalogItemVo item = new VaultCatalogItemVo();
        item.setId("catalog-moss");
        item.setName("Catalog Moss");
        item.setKind("theme");
        item.setVersion("1.0.0");
        item.setDescription("官方 catalog 示例主题（柔和苔绿）");
        item.setAuthor("v5notes");
        item.setMinAppVersion("0.1.0");
        item.setPermissions(List.of("ui:theme"));
        item.setTags(List.of("demo", "theme", "official"));
        item.setPackagePath("/vault/v1/catalog/plugins/catalog-moss/package");

        Map<String, String> files = new LinkedHashMap<>();
        files.put("manifest.json", """
            {
              "id": "catalog-moss",
              "name": "Catalog Moss",
              "kind": "theme",
              "version": "1.0.0",
              "minAppVersion": "0.1.0",
              "description": "官方 catalog 示例主题（柔和苔绿）",
              "author": "v5notes",
              "permissions": ["ui:theme"],
              "tags": ["demo", "theme", "official"],
              "theme": "theme.css"
            }
            """);
        files.put("theme.css", """
            :root[data-community-theme='catalog-moss'] {
              --bg: #f3f6f1;
              --panel: #fbfdfa;
              --ink: #1e2a22;
              --muted: #5c6b60;
              --line: #d5e0d6;
              --accent: #3d6b4f;
              --accent-hover: #31573f;
              --surface: #e9efe9;
              --danger: #8a3b2e;
              --danger-bg: #f3e4e0;
            }
            """);
        return new SeedEntry(item, files);
    }

    private record SeedEntry(VaultCatalogItemVo item, Map<String, String> files) {
    }
}
