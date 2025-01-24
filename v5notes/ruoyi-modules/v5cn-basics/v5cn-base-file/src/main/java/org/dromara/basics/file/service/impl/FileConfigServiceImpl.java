package org.dromara.basics.file.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import jakarta.annotation.Resource;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.basics.file.core.client.FileClient;
import org.dromara.basics.file.core.client.FileClientConfig;
import org.dromara.basics.file.core.client.FileClientFactory;
import org.dromara.basics.file.core.enums.FileStorageEnum;
import org.dromara.basics.file.domain.FileConfig;
import org.dromara.basics.file.domain.bo.FileConfigBo;
import org.dromara.basics.file.domain.bo.FileConfigSearchBo;
import org.dromara.basics.file.domain.vo.FileConfigVo;
import org.dromara.basics.file.service.IFileConfigService;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.core.utils.ValidatorUtils;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.page.TableDataInfo;
import org.dromara.basics.file.mapper.FileConfigMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.dromara.common.core.utils.cache.CacheUtils.buildAsyncReloadingCache;

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

    @Resource
    private FileClientFactory clientFactory;

//    private static final Long CACHE_MASTER_ID = 0L;

    /**
     * {@link FileClient} 缓存，通过它异步刷新 fileClientFactory
     */
    @Getter
    private final LoadingCache<Long, FileClient> clientCache = buildAsyncReloadingCache(Duration.ofSeconds(10L),
        new CacheLoader<>() {
            @Override
            public FileClient load(Long id) {
//                FileConfig config = Objects.equals(CACHE_MASTER_ID, id) ?
//                    baseMapper.selectOne(Wrappers.<FileConfig>lambdaQuery().eq(FileConfig::getMaster, true)) : baseMapper.selectById(id);
                FileConfig config = baseMapper.selectById(id);
                if (config != null) {
                    clientFactory.createOrUpdateFileClient(config.getId(), config.getStorage(), config.getConfig());
                }
//                return clientFactory.getFileClient(null == config ? id : config.getId());
                log.info("CacheLoader.load() file client, id:{}, config:{}", id, config);
                return clientFactory.getFileClient(id);
            }

        });

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
    public TableDataInfo<FileConfigVo> queryPageList(FileConfigSearchBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<FileConfig> lqw = buildQueryWrapper(bo);
        Page<FileConfigVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
        return TableDataInfo.build(result);
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
        lqw.eq(bo.getStorage() != null, FileConfig::getStorage, bo.getStorage());
        if(bo.getCreateTime() != null && bo.getCreateTime().length == 2) {
            lqw.between(FileConfig::getCreateTime, bo.getCreateTime()[0], bo.getCreateTime()[1]);
        }
        // 排序
        lqw.orderByDesc(FileConfig::getMaster,FileConfig::getCreateTime);
        //lqw.eq(bo.getMaster() != null, FileConfig::getMaster, bo.getMaster());
        //lqw.eq(StringUtils.isNotBlank(bo.getConfig()), FileConfig::getConfig, bo.getConfig());
        return lqw;
    }

    /**
     * 新增文件配置
     */
    @Override
    public Boolean insertByBo(FileConfigBo bo) {
        FileConfig config = MapstructUtils.convert(bo, FileConfig.class);
        config.setMaster(false); // 默认不是主配置
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
        FileConfig update = MapstructUtils.convert(bo, FileConfig.class);
        update.setConfig(parseClientConfig(config.getStorage(),bo.getConfig()));
        validEntityBeforeSave(update);
        boolean result = baseMapper.updateById(update) > 0;
//        if (config.getMaster()) {
//            // 清空缓存
//            clearCache(null, true);
//
//            return result;
//        }
        log.info("update file config, id:{}, config:{}, id2:{}", bo.getId(), update, config.getId());
        // 清空缓存
        clearCache(config.getId());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateFileConfigMaster(Long id) {
        // 校验存在
        validateFileConfigExists(id);
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
     * 批量删除文件配置
     */
    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if(isValid){
            //TODO 做一些业务上的校验,判断是否需要校验
        }
        boolean flag = baseMapper.deleteBatchIds(ids) > 0;

        if (flag) {
            // 清空缓存
            ids.forEach(id -> clearCache(id));
        }

        return flag;
    }
    @Override
    public FileClient getMasterFileClient() {
        FileConfig config = getMasterConfig();
        log.info("getMasterFileClient, config:{}", config);
        return clientCache.getUnchecked(config.getId());
    }

    @Override
    public FileClient getFileClient(Long id) {
        return clientCache.getUnchecked(id);
    }
    /**
     * 保存前的数据校验
     */
    private void validEntityBeforeSave(FileConfig entity){
        //TODO 做一些数据校验,如唯一约束
    }


    /**
     * 清空指定文件配置
     *
     * @param id 配置编号
     */
    private void clearCache(Long id) {
        clientCache.invalidate(id);
    }

    private FileConfig validateFileConfigExists(Long id) {
        FileConfig config = baseMapper.selectById(id);
        if (config == null) {
            throw new ServiceException("文件配置不存在");
        }
        return config;
    }

    private FileClientConfig parseClientConfig(Integer storage, Map<String, Object> config) {
        // 获得配置类
        Class<? extends FileClientConfig> configClass = FileStorageEnum.getByStorage(storage).getConfigClass();
        FileClientConfig clientConfig = JsonUtils.parseObject2(JsonUtils.toJsonString(config), configClass);
        // 校验配置
        ValidatorUtils.validate(clientConfig);

        // 返回配置
        return clientConfig;
    }

    private FileConfig getMasterConfig() {
        FileConfig config = baseMapper.selectOne(Wrappers.<FileConfig>lambdaQuery().eq(FileConfig::getMaster, true));
        if (config == null) {
//            throw new ServiceException("主配置不存在");
            log.warn("主配置不存在");
        }
        return config;
    }
}
