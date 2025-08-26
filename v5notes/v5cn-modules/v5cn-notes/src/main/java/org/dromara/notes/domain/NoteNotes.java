package org.dromara.notes.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.tenant.core.TenantEntity;

import java.io.Serial;
import java.util.Date;

/**
 * 笔记对象 note_notes
 *
 * @author Lion Li
 * @date 2024-10-25
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("note_notes")
public class NoteNotes extends TenantEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 笔记ID编号
     */
    @TableId(value = "id")
    private Long id;

    /**
     * 笔记所属用户
     */
    private Long userId;

    /**
     * 部门id
     */
    private Long deptId;

    /**
     * 笔记名
     */
    private String name;

    /**
     * 所属目录ID
     */
    private Long dirId;

    /**
     * 笔记内容
     */
    private String content;

    /**
     * 删除标志（0代表存在 2代表删除）
     */
    @TableLogic
    private String delFlag;
}
