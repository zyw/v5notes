package xin.v5ai.basics.file.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xin.v5ai.common.mybatis.core.domain.BaseEntity;

import java.io.Serial;

/**
 * 文件内容对象 infra_file_content
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("basics_file_content")
public class FileContent extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 编号
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 配置编号
     */
    private Long configId;

    /**
     * 文件路径
     */
    private String path;

    /**
     * 文件内容
     */
    private byte[] content;

    /**
     * 删除标志（0代表存在 2代表删除）
     */
    @TableLogic
    private String delFlag;


}
