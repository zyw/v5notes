package org.dromara.generator.core;

import org.dromara.generator.domain.GenTable;

/**
 * 生成zip包中的文件路径
 *
 * @author wind
 */
public interface GenFilePath {
    /**
     * 根据模板文件生成文件路径
     *
     * @param template 模板
     * @param genTable 业务表
     * @return 路径
     */
    String filePath(String template, GenTable genTable);
}
