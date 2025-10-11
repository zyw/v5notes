package org.dromara.generator.core.impl;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.config.GenConfig;
import org.dromara.generator.constant.GenConstants;
import org.dromara.generator.core.TableColumnHandle;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTableColumn;
import org.dromara.generator.util.GenUtils;
import org.springframework.stereotype.Component;

@Slf4j
@Component("goPermAuthTableColumnHandle")
public class GoPermAuthTableColumnHandle implements TableColumnHandle {
    @Override
    public void handleTable(GenTable genTable) {
        genTable.setClassName(GenUtils.convertClassName(genTable.getTableName()));
        // 页面出入，入门为空就使用配置文件配置
//        genTable.setPackageName(GenConfig.getPackageName());
        if(StringUtils.isBlank(genTable.getModuleName())) {
            genTable.setModuleName(GenUtils.getModuleName(GenConfig.getPackageName()));
        }
        genTable.setBusinessName(GenUtils.getBusinessName(genTable.getTableName()));
        genTable.setFunctionName(GenUtils.replaceText(genTable.getTableComment()));
        genTable.setFunctionAuthor(GenConfig.getAuthor());
        genTable.setCreateTime(null);
        genTable.setUpdateTime(null);
    }

    @Override
    public void handleColumn(GenTableColumn column, GenTable table) {
        String dataType = GenUtils.getDbType(column.getColumnType());
        // 统一转小写 避免有些数据库默认大写问题 如果需要特别书写方式 请在实体类增加注解标注别名
        String columnName = column.getColumnName().toLowerCase();
        column.setTableId(table.getTableId());
        column.setCreateTime(null);
        column.setUpdateTime(null);
        // 设置golang字段名, 例如：user_name->UserName
        column.setFieldName(StringUtils.convertToCamelCase(columnName));
        // 设置默认类型
        column.setFieldType(GenConstants.GO_TYPE.STRING);
        column.setQueryType(GenConstants.SELECT_EXP.QUERY_EQ);
        //处理默认值
        column.setDefaultVal(GenUtils.getDefaultValue(column.getDefaultVal()));

        if (GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_STR, dataType)
            || GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_TEXT, dataType)) {
            // 字符串长度超过500设置为文本域
            Integer columnLength = GenUtils.getColumnLength(column.getColumnType());
            String htmlType = columnLength >= 500
                || GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_TEXT, dataType)
                ? GenConstants.HTML_TYPE.HTML_TEXTAREA : GenConstants.HTML_TYPE.HTML_INPUT;
            column.setHtmlType(htmlType);
        } else if (GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_TIME, dataType)) {
            column.setFieldType(GenConstants.GO_TYPE.DATE);
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_DATETIME);
        } else if (GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_NUMBER, dataType)) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_INPUT);
            // 数据库的数字字段与java不匹配 且很多数据库的数字字段很模糊 例如oracle只有number没有细分
            // 所以默认数字类型全为Long可在界面上自行编辑想要的类型 有什么特殊需求也可以在这里特殊处理
            column.setFieldType(GenConstants.GO_TYPE.LONG);
        } else if (GenUtils.arraysContains(GenConstants.DATA_BAST_TYPE.COLUMNTYPE_JSON, dataType)) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_TEXTAREA);
            column.setFieldType(GenConstants.GO_TYPE.JSON);
        }

        // BO对象 默认插入勾选
        if (!GenUtils.arraysContains(GenConstants.OPERATE_BO.COLUMNNAME_NOT_ADD, columnName) && !column.isPk()) {
            column.setIsInsert(GenConstants.REQUIRE);
        }
        // BO对象 默认编辑勾选
        if (!GenUtils.arraysContains(GenConstants.OPERATE_BO.COLUMNNAME_NOT_EDIT, columnName)) {
            column.setIsEdit(GenConstants.REQUIRE);
        }
        // VO对象 默认返回勾选
        if (!GenUtils.arraysContains(GenConstants.OPERATE_BO.COLUMNNAME_NOT_LIST, columnName)) {
            column.setIsList(GenConstants.REQUIRE);
        }
        // BO对象 默认查询勾选, 生成request实体时需要
        if (!GenUtils.arraysContains(GenConstants.OPERATE_BO.COLUMNNAME_NOT_QUERY, columnName) && !column.isPk()) {
            column.setIsQuery(GenConstants.REQUIRE);
        }

        // 查询字段类型
        if (StringUtils.endsWithIgnoreCase(columnName, "name")) {
            column.setQueryType(GenConstants.SELECT_EXP.QUERY_LIKE);
        }
        // 状态字段设置单选框
        if (StringUtils.endsWithIgnoreCase(columnName, "status")) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_RADIO);
        }
        // 类型&性别字段设置下拉框
        else if (StringUtils.endsWithIgnoreCase(columnName, "type")
            || StringUtils.endsWithIgnoreCase(columnName, "sex")) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_SELECT);
        }
        // 图片字段设置图片上传控件
        else if (StringUtils.endsWithIgnoreCase(columnName, "image")) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_IMAGE_UPLOAD);
        }
        // 文件字段设置文件上传控件
        else if (StringUtils.endsWithIgnoreCase(columnName, "file")) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_FILE_UPLOAD);
        }
        // 内容字段设置富文本控件
        else if (StringUtils.endsWithIgnoreCase(columnName, "content")) {
            column.setHtmlType(GenConstants.HTML_TYPE.HTML_EDITOR);
        }
    }
}
