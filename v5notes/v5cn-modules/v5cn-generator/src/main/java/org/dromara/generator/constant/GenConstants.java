package org.dromara.generator.constant;

/**
 * 代码生成通用常量
 *
 * @author ruoyi
 */
public interface GenConstants {
    /**
     * 树编码字段
     */
    String TREE_CODE = "treeCode";

    /**
     * 树父编码字段
     */
    String TREE_PARENT_CODE = "treeParentCode";

    /**
     * 树名称字段
     */
    String TREE_NAME = "treeName";

    /**
     * 上级菜单ID字段
     */
    String PARENT_MENU_ID = "parentMenuId";

    /**
     * 上级菜单名称字段
     */
    String PARENT_MENU_NAME = "parentMenuName";

    /**
     * 是否必填
     */
    String REQUIRE = "1";

    /**
     * 模版类别
     */
    interface TPL_CATEGORY {
        /**
         * 单表（增删改查）
         */
        String TPL_CRUD = "crud";

        /**
         * 树表（增删改查）
         */
        String TPL_TREE = "tree";
    }

    /**
     * 查询表达式
     */
    interface SELECT_EXP {
        /**
         * 模糊查询
         */
        String QUERY_LIKE = "LIKE";

        /**
         * 相等查询
         */
        String QUERY_EQ = "EQ";
    }

    /**
     * 操作对象
     */
    interface OPERATE_BO {
        /**
         * BO对象 不需要添加字段
         */
        String[] COLUMNNAME_NOT_ADD = {"create_dept", "create_by", "create_time", "del_flag", "update_by",
            "update_time", "version", "tenant_id","updated_at","created_at","deleted_at"};

        /**
         * BO对象 不需要编辑字段
         */
        String[] COLUMNNAME_NOT_EDIT = {"create_dept", "create_by", "create_time", "del_flag", "update_by",
            "update_time", "version", "tenant_id","updated_at","created_at","deleted_at"};

        /**
         * VO对象 不需要返回字段
         */
        String[] COLUMNNAME_NOT_LIST = {"create_dept", "create_by", "create_time", "del_flag", "update_by",
            "update_time", "version", "tenant_id","deleted_at"};

        /**
         * BO对象 不需要查询字段
         */
        String[] COLUMNNAME_NOT_QUERY = {"id", "create_dept", "create_by", "create_time", "del_flag", "update_by",
            "update_time", "remark", "version", "tenant_id","deleted_at"};

        /**
         * Entity基类字段
         */
        String[] BASE_ENTITY = {"createDept", "createBy", "createTime", "updateBy", "updateTime", "tenantId",
            "updatedAt","createdAt","deletedAt"};
    }


    /**
     * 数据库基础类型
     */
    interface DATA_BAST_TYPE {
        /**
         * 数据库字符串类型
         */
        String[] COLUMNTYPE_STR = {"char", "varchar", "enum", "set", "nchar", "nvarchar", "varchar2", "nvarchar2"};

        /**
         * 数据库文本类型
         */
        String[] COLUMNTYPE_TEXT = {"tinytext", "text", "mediumtext", "longtext", "binary", "varbinary", "blob",
            "ntext", "image", "bytea"};

        /**
         * 数据库数字类型
         */
        String[] COLUMNTYPE_NUMBER = {"tinyint", "smallint", "mediumint", "int", "int2", "int4", "int8", "number", "integer",
            "bit", "bigint", "float", "float4", "float8", "double", "decimal", "numeric", "real", "double precision",
            "smallserial", "serial", "bigserial", "money", "smallmoney"};

        /**
         * 数据库时间类型
         */
        String[] COLUMNTYPE_TIME = {"datetime", "time", "date", "timestamp", "year", "interval",
            "smalldatetime", "datetime2", "datetimeoffset", "timestamptz"};

        /**
         * 数据库JSON 类型
         */
        String[] COLUMNTYPE_JSON = {"json", "jsonb"};
    }

    /**
     * HTML控件类型
     */
    interface HTML_TYPE {
        /**
         * 文本框
         */
        String HTML_INPUT = "input";

        /**
         * 文本域
         */
        String HTML_TEXTAREA = "textarea";

        /**
         * 下拉框
         */
        String HTML_SELECT = "select";

        /**
         * 单选框
         */
        String HTML_RADIO = "radio";

        /**
         * 复选框
         */
        String HTML_CHECKBOX = "checkbox";

        /**
         * 日期控件
         */
        String HTML_DATETIME = "datetime";

        /**
         * 图片上传控件
         */
        String HTML_IMAGE_UPLOAD = "imageUpload";

        /**
         * 文件上传控件
         */
        String HTML_FILE_UPLOAD = "fileUpload";

        /**
         * 富文本控件
         */
        String HTML_EDITOR = "editor";
    }

    interface JAVA_TYPE {
        /**
         * 字符串类型
         */
        String STRING = "String";
        /**
         * 整型
         */
        String INTEGER = "Integer";
        /**
         * 长整型
         */
        String LONG = "Long";
        /**
         * 浮点型
         */
        String DOUBLE = "Double";
        /**
         * 高精度计算类型
         */
        String BIG_DECIMAL = "BigDecimal";
        /**
         * 时间类型
         */
        String DATE = "Date";
    }

    interface GO_TYPE {
        /**
         * 字符串类型
         */
        String STRING = "string";
        /**
         * 整型
         */
        String INTEGER = "int";
        /**
         * 长整型
         */
        String LONG = "int64";
        /**
         * 浮点型
         */
        String DOUBLE = "float64";
        /**
         * 高精度计算类型
         */
        String BIG_DECIMAL = "decimal";
        /**
         * 时间类型
         */
        String DATE = "time.Time";
        /**
         * JSONMap 自定义类型，代表 map[string]interface{}
         * Value 实现 driver.Valuer 接口，用于将数据写入数据库时如何操作
         * Scan 实现 sql.Scanner 接口，用于从数据库读取数据时如何操作
         */
        String JSON = "JSONMap";
    }
}
