package org.dromara.basics.file.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.AbstractJsonTypeHandler;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.basics.file.core.client.FileClientConfig;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.common.tenant.core.TenantEntity;

import java.io.Serial;

/**
 * 文件配置对象 infra_file_config
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "basics_file_config", autoResultMap = true)
public class FileConfig extends TenantEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 配置名
     */
    private String name;

    /**
     * 存储器
     */
    private Integer storage;

    /**
     * 备注
     */
    private String remark;

    /**
     * 是否为主配置
     */
    private Boolean master;

    /**
     * 删除标志（0代表存在 2代表删除）
     */
    @TableLogic
    private String delFlag;

    /**
     * 存储配置, 采用json格式存储,使用TypeHandler进行序列化
     */
    @TableField(typeHandler = FileClientConfigTypeHandler.class)
    private FileClientConfig config;

    public static class FileClientConfigTypeHandler extends AbstractJsonTypeHandler<Object> {

        public FileClientConfigTypeHandler(Class<?> type) {
            super(type);
        }

        @Override
        public Object parse(String json) {
            FileClientConfig config = JsonUtils.parseObjectQuietly(json, new TypeReference<>() {});
            if (config != null) {
                return config;
            }

            throw new IllegalArgumentException("未知的 FileClientConfig 类型：" + json);
        }

        @Override
        public String toJson(Object obj) {
            return JsonUtils.toJsonString(obj);
        }
    }

}
