package xin.v5ai.basics.file.service.impl;

import xin.v5ai.common.core.utils.MessageUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.FileClientConfig;
import xin.v5ai.basics.file.core.client.FileClientFactory;
import xin.v5ai.basics.file.core.enums.FileConfigPurpose;
import xin.v5ai.basics.file.core.enums.FileStorageEnum;
import xin.v5ai.basics.file.domain.FileConfig;
import xin.v5ai.basics.file.domain.bo.FileConfigBo;
import xin.v5ai.basics.file.domain.bo.FileConfigSearchBo;
import xin.v5ai.basics.file.domain.vo.FileConfigVo;
import xin.v5ai.basics.file.service.IFileConfigService;
import cn.hutool.core.bean.BeanUtil;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.ValidatorUtils;
import xin.v5ai.common.json.utils.JsonUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.basics.file.mapper.FileConfigMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 文件配置Service业务层处理
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class FileConfigServiceImpl implements IFileConfigService {

    private final FileConfigMapper baseMapper;

    private final FileClientFactory clientFactory;

    /**
     * {@link FileClient} 缓存。6.1.0 的 common-core 不再提供 buildAsyncReloadingCache，
     * 这里使用简单的内存 Map 缓存，变更配置时主动失效。
     */
    private final Map<Long, FileClient> clientCache = new ConcurrentHashMap<>();

    /**
     * 查询文件配置
     */
    @Override
    public FileConfigVo queryById(Long id){
        return baseMapper.selectVoById(id);
    }

    /**
     * 查询文件配置列表
     */
    @Override
    public PageResult<FileConfigVo> queryPageList(FileConfigSearchBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<FileConfig> lqw = buildQueryWrapper(bo);
        Page<FileConfigVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    /**
     * 查询文件配置列表
     */
    @Override
    public List<FileConfigVo> queryList(FileConfigSearchBo bo) {
        LambdaQueryWrapper<FileConfig> lqw = buildQueryWrapper(bo);
        return baseMapper.selectVoList(lqw);
    }

    private LambdaQueryWrapper<FileConfig> buildQueryWrapper(FileConfigSearchBo bo) {
        LambdaQueryWrapper<FileConfig> lqw = Wrappers.lambdaQuery();
        lqw.like(StringUtils.isNotBlank(bo.getName()), FileConfig::getName, bo.getName());
        lqw.eq(bo.getPurpose() != null, FileConfig::getPurpose, bo.getPurpose());
        lqw.eq(bo.getStorage() != null, FileConfig::getStorage, bo.getStorage());
        if(bo.getCreateTime() != null && bo.getCreateTime().length == 2) {
            lqw.between(FileConfig::getCreateTime, bo.getCreateTime()[0], bo.getCreateTime()[1]);
        }
        // 排序
        lqw.orderByDesc(FileConfig::getMaster,FileConfig::getCreateTime);
        return lqw;
    }

    /**
     * 新增文件配置
     */
    @Override
    public Boolean insertByBo(FileConfigBo bo) {
        // config 字段类型与 Bo 不同（Map vs FileClientConfig），单独解析后设置
        FileConfig config = BeanUtil.copyProperties(bo, FileConfig.class, "config");
        config.setMaster(false); // 默认不是主配置
        config.setPurpose(resolvePurpose(bo.getPurpose()));
        config.setConfig(parseClientConfig(bo.getStorage(),bo.getConfig()));
        validEntityBeforeSave(config);
        boolean flag = baseMapper.insert(config) > 0;
        if (flag) {
            bo.setId(config.getId());
        }
        return flag;
    }

    /**
     * 修改文件配置
     */
    @Override
    public Boolean updateByBo(FileConfigBo bo) {
        // 校验存在
        FileConfig config = validateFileConfigExists(bo.getId());
        // 更新
        FileConfig update = BeanUtil.copyProperties(bo, FileConfig.class, "config");
        // 不传用途时沿用原值，避免编辑时被静默改回 GENERIC
        update.setPurpose(resolvePurpose(bo.getPurpose() != null ? bo.getPurpose() : parsePurpose(config.getPurpose())));
        // 必须用 bo.storage，否则改存储器类型后仍按旧类型解析，会出现 SFTP+21 端口等错配
        Integer storage = bo.getStorage() != null ? bo.getStorage() : config.getStorage();
        update.setConfig(parseClientConfig(storage, bo.getConfig()));
        validEntityBeforeSave(update);
        boolean result = baseMapper.updateById(update) > 0;
        log.info("update file config, id:{}, config:{}, id2:{}", bo.getId(), update, config.getId());
        // 清空缓存
        clearCache(config.getId());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateFileConfigMaster(Long id) {
        // 校验存在
        FileConfig target = validateFileConfigExists(id);
        if (FileConfigPurpose.VAULT_ASSET.name().equals(resolvePurpose(parsePurpose(target.getPurpose())))) {
            throw new ServiceException("同步附件专用配置不能设为主配置");
        }
        // 获取主配置
        FileConfig config = getMasterConfig();
        int flag = 1;
        if (config != null) {
            // 更新其它为非 master
            flag = baseMapper.update(Wrappers.<FileConfig>lambdaUpdate().set(FileConfig::getMaster, false).eq(FileConfig::getId, config.getId()));
            // 清空缓存
            clearCache(config.getId());
        }

        // 更新当前为 master
        int flag2 = baseMapper.update(Wrappers.<FileConfig>lambdaUpdate().set(FileConfig::getMaster, true).eq(FileConfig::getId, id));

        // 返回结果
        return flag > 0 && flag2 > 0;
    }

    /**
     * 切换用途指针（设计 §7.5 阶段 1 的「切换用途指针」）。
     *
     * <p>替换而不是转交：目标接管用途后，原持有者退回 {@code GENERIC}，同用途恒为一条，
     * 后台也就不会出现两条同用途配置而让附件链路报错。旧配置行不删除 ——
     * 历史附件仍按各自 {@code basics_file.config_id} 在原后端读取（设计 §7.4）。</p>
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateFileConfigPurpose(Long id, FileConfigPurpose purpose) {
        if (purpose == null || purpose == FileConfigPurpose.GENERIC) {
            throw new ServiceException("只能切换到 GENERIC 以外的用途");
        }
        FileConfig target = validateFileConfigExists(id);
        String current = resolvePurpose(parsePurpose(target.getPurpose()));
        if (purpose.name().equals(current)) {
            throw new ServiceException(MessageUtils.message("file.config.purpose.already", purpose.name(), target.getName()));
        }

        if (Boolean.TRUE.equals(target.getMaster())) {
            throw new ServiceException(
                MessageUtils.message("file.config.purpose.held.by.master", purpose.name(), target.getName()));
        }

        FileConfig holder = findUniqueByPurpose(purpose.name());
        if (holder != null && holder.getId().equals(id)) {
            return true;
        }
        // 主配置同时兼任某用途的数据行时，改它的用途等于让图片库失去主配置；
        // 主配置统一走卡片上的「设为主配置」，这里直接拒绝而不是替用户做取舍。
        if (holder != null && Boolean.TRUE.equals(holder.getMaster())) {
            throw new ServiceException(
                MessageUtils.message("file.config.purpose.held.by.master", purpose.name(), holder.getName()));
        }

        if (holder != null) {
            baseMapper.update(null, Wrappers.<FileConfig>lambdaUpdate()
                .set(FileConfig::getPurpose, FileConfigPurpose.GENERIC.name())
                .eq(FileConfig::getId, holder.getId()));
            clearCache(holder.getId());
        }
        baseMapper.update(null, Wrappers.<FileConfig>lambdaUpdate()
            .set(FileConfig::getPurpose, purpose.name())
            .eq(FileConfig::getId, id));
        clearCache(id);

        log.info("switch file config purpose, purpose:{}, from:{} -> to:{}", purpose, holder == null ? null : holder.getId(), id);
        return true;
    }

    /**
     * 批量删除文件配置
     */
    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (isValid && ids != null && !ids.isEmpty()) {
            List<FileConfig> targets = baseMapper.selectByIds(ids);
            for (FileConfig cfg : targets) {
                if (Boolean.TRUE.equals(cfg.getMaster())) {
                    throw new ServiceException("不能删除主配置，请先切换主配置后再删除");
                }
                if (FileConfigPurpose.VAULT_ASSET.name().equals(cfg.getPurpose())) {
                    throw new ServiceException("不能删除当前同步附件配置，请先切换同步附件用途后再删除");
                }
            }
        }
        boolean flag = baseMapper.deleteByIds(ids) > 0;

        if (flag) {
            // 清空缓存
            ids.forEach(this::clearCache);
        }

        return flag;
    }

    @Override
    public FileClient getMasterFileClient() {
        FileConfig config = getMasterConfig();
        log.info("getMasterFileClient, config:{}", config);
        return getFileClient(config.getId());
    }

    /**
     * 按用途取客户端（设计 D2）。与 {@link #getMasterFileClient()} 完全独立：
     * 图片库/头像的选路不因附件用途的存在而改变。
     *
     * <p>没有该用途的配置时依次回退：先取 {@code GENERIC} 配置，再取主配置。
     * 这样尚未在后台建 VAULT_ASSET 配置的部署仍能同步附件，而不是整条链路报 503。</p>
     */
    @Override
    public FileClient getByPurpose(FileConfigPurpose purpose) {
        if (purpose == null) {
            throw new ServiceException("文件配置用途不能为空");
        }
        FileConfig config = findUniqueByPurpose(purpose.name());
        if (config == null && purpose != FileConfigPurpose.GENERIC) {
            config = findGenericFallback();
        }
        if (config == null && purpose != FileConfigPurpose.GENERIC) {
            config = getMasterConfig();
        }
        if (config == null) {
            throw new ServiceException("未配置文件用途：" + purpose.name());
        }
        return getFileClient(config.getId());
    }

    /**
     * 回退到 GENERIC 时允许存在多条历史配置：优先选主配置，否则仅在唯一一条时选用。
     */
    private FileConfig findGenericFallback() {
        List<FileConfig> matched = baseMapper.selectList(new LambdaQueryWrapper<FileConfig>()
            .eq(FileConfig::getPurpose, FileConfigPurpose.GENERIC.name()));
        if (matched.isEmpty()) {
            return null;
        }
        if (matched.size() == 1) {
            return matched.get(0);
        }
        return matched.stream()
            .filter(c -> Boolean.TRUE.equals(c.getMaster()))
            .findFirst()
            .orElse(null);
    }

    /**
     * 按用途取唯一配置；同用途存在多条说明后台配置有误，直接报错而不是随便挑一条。
     */
    private FileConfig findUniqueByPurpose(String purpose) {
        List<FileConfig> matched = baseMapper.selectList(new LambdaQueryWrapper<FileConfig>()
            .eq(FileConfig::getPurpose, purpose));
        if (matched.size() > 1) {
            throw new ServiceException("文件用途 " + purpose + " 存在多条配置，请只保留一条");
        }
        return matched.isEmpty() ? null : matched.get(0);
    }

    @Override
    public FileClient getFileClient(Long id) {
        return clientCache.computeIfAbsent(id, key -> {
            FileConfig config = baseMapper.selectById(key);
            if (config != null) {
                clientFactory.createOrUpdateFileClient(config.getId(), config.getStorage(), config.getConfig());
            }
            log.info("load file client, id:{}, config:{}", key, config);
            return clientFactory.getFileClient(key);
        });
    }

    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(FileConfig entity){
        // 非 GENERIC 用途（如 VAULT_ASSET）全表仅允许一条；GENERIC 允许保留多条
        // （用于新增备选配置执行用途切换，以及保留历史附件读取配置，设计 §7.4 / §7.5）。
        if (FileConfigPurpose.GENERIC.name().equals(entity.getPurpose())) {
            return;
        }
        Long duplicated = baseMapper.selectCount(Wrappers.<FileConfig>lambdaQuery()
            .eq(FileConfig::getPurpose, entity.getPurpose())
            .ne(entity.getId() != null, FileConfig::getId, entity.getId()));
        if (duplicated != null && duplicated > 0) {
            throw new ServiceException(MessageUtils.message("file.config.purpose.duplicated", entity.getPurpose()));
        }
    }

    private static String resolvePurpose(FileConfigPurpose purpose) {
        return (purpose == null ? FileConfigPurpose.GENERIC : purpose).name();
    }

    private static FileConfigPurpose parsePurpose(String purpose) {
        return StringUtils.isBlank(purpose) ? FileConfigPurpose.GENERIC : FileConfigPurpose.valueOf(purpose);
    }

    /**
     * 清空指定文件配置
     *
     * @param id 配置编号
     */
    private void clearCache(Long id) {
        clientCache.remove(id);
        clientFactory.removeFileClient(id);
    }

    private FileConfig validateFileConfigExists(Long id) {
        FileConfig config = baseMapper.selectById(id);
        if (config == null) {
            throw new ServiceException(MessageUtils.message("file.config.missing"));
        }
        return config;
    }

    private FileClientConfig parseClientConfig(Integer storage, Map<String, Object> config) {
        // 获得配置类
        Class<? extends FileClientConfig> configClass = FileStorageEnum.getByStorage(storage).getConfigClass();
        // FileClientConfig 使用 @JsonTypeInfo(Id.CLASS)，反序列化需要 @class；前端不会传该字段，这里按 storage 补上
        Map<String, Object> configMap = new HashMap<>(config);
        configMap.put("@class", configClass.getName());
        FileClientConfig clientConfig = JsonUtils.parseObject(JsonUtils.toJsonString(configMap), configClass);
        // 校验配置
        ValidatorUtils.validate(clientConfig);
        // 返回配置
        return clientConfig;
    }

    private FileConfig getMasterConfig() {
        FileConfig config = baseMapper.selectOne(Wrappers.<FileConfig>lambdaQuery().eq(FileConfig::getMaster, true));
        if (config == null) {
            log.warn("主配置不存在");
        }
        return config;
    }
}
