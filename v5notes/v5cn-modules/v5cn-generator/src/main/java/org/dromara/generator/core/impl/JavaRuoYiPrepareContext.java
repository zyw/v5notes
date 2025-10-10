package org.dromara.generator.core.impl;

import lombok.extern.slf4j.Slf4j;
import org.apache.velocity.VelocityContext;
import org.dromara.generator.constant.GenConstants;
import org.dromara.generator.core.PrepareContext;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTableColumn;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;

@Slf4j
@Component("javaRuoYiPrepareContext")
public class JavaRuoYiPrepareContext implements PrepareContext {
    @Override
    public void addContextItems(VelocityContext velocityContext, GenTable table) {
        velocityContext.put("importList", getImportList(table));
    }

    /**
     * 根据列类型获取导入包
     *
     * @param genTable 业务表对象
     * @return 返回需要导入的包列表
     */
    private HashSet<String> getImportList(GenTable genTable) {
        List<GenTableColumn> columns = genTable.getColumns();
        HashSet<String> importList = new HashSet<>();
        for (GenTableColumn column : columns) {
            if (!column.isSuperColumn() && GenConstants.JAVA_TYPE.DATE.equals(column.getFieldType())) {
                importList.add("java.util.Date");
                importList.add("com.fasterxml.jackson.annotation.JsonFormat");
            } else if (!column.isSuperColumn() && GenConstants.JAVA_TYPE.BIG_DECIMAL.equals(column.getFieldType())) {
                importList.add("java.math.BigDecimal");
            } else if (!column.isSuperColumn() && "imageUpload".equals(column.getHtmlType())) {
                importList.add("org.dromara.common.translation.annotation.Translation");
                importList.add("org.dromara.common.translation.constant.TransConstant");
            }
        }
        return importList;
    }
}
