package org.dromara.basics.file.core.client;

import cn.hutool.core.util.StrUtil;
import lombok.extern.slf4j.Slf4j;

/**
 * 文件客户端的抽象类，提供模板方法，减少子类的冗余代码
 *
 * @author 芋道源码
 */
@Slf4j
public abstract class AbstractFileClient<C extends FileClientConfig> implements FileClient {

    /**
     * 配置ID
     */
    private final Long id;

    /**
     * 配置信息
     */
    protected C config;

    /**
     * 构造方法
     *
     * @param id    配置ID
     * @param config 配置信息
     */
    public AbstractFileClient(Long id, C config) {
        this.id = id;
        this.config = config;
    }

    public final void init() {
        doInit();
        log.debug("[init][配置：({}) 初始化成功]",  config);
    }

    /**
     * 自定义初始化
     */
    protected abstract void doInit();

    public final void refresh(C config) {
        // 判断是否刷新
        if (this.config.equals(config)) {
            return;
        }
        log.info("[refresh][配置({})发生变化，重新初始化]", config);
        this.config = config;

        // 重新初始化
        this.init();
    }

    @Override
    public Long getId() {
        return id;
    }

    /**
     * 格式化文件的 URL 访问地址
     * 使用场景：local、ftp、db，通过 FileController 的 getFile 来获取文件内容
     *
     * @param domain 自定义域名
     * @param path 文件路径
     * @return URL 访问地址
     */
    protected String formatFileUrl(String domain, String path) {
        return StrUtil.format("{}/basics/base/file/{}/get/{}",domain,getId(),path);
    }
}
