package org.dromara.generator.core;

import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTableColumn;

/**
 * 处理表和表列的的接口
 *
 * @author zyw
 */
public interface TableColumnHandle {
    /**
     * 处理表
     *
     * @param table 表
     */
    void handleTable(GenTable table);

    /**
     * 处理列
     *
     * @param column 列
     */
    void handleColumn(GenTableColumn column,GenTable table);
}
