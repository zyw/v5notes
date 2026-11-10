package xin.v5ai.system.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import xin.v5ai.common.core.xss.Xss;
import xin.v5ai.system.domain.SysNotice;

import java.io.Serial;
import java.io.Serializable;

/**
 * 通知公告业务对象 sys_notice
 *
 * @author Michelle.Chung
 */

@Data
@AutoMapper(target = SysNotice.class, reverseConvertGenerate = false)
public class SysNoticeBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 公告ID
     */
    private Long noticeId;

    /**
     * 公告标题
     */
    @Xss(message = "{notice.title.script}")
    @NotBlank(message = "{notice.title.not.blank}")
    @Size(min = 0, max = 50, message = "{notice.title.length}")
    private String noticeTitle;

    /**
     * 公告类型（1通知 2公告）
     */
    private String noticeType;

    /**
     * 公告内容
     */
    private String noticeContent;

    /**
     * 公告状态（0正常 1关闭）
     */
    private String status;

    /**
     * 备注
     */
    private String remark;

    /**
     * 创建人名称
     */
    private String createByName;

}
