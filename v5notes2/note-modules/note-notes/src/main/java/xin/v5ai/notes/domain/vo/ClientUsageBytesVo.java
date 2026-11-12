package xin.v5ai.notes.domain.vo;

import lombok.Data;

/**
 * 单个用户当前占用的笔记字节和文件字节。
 */
@Data
public class ClientUsageBytesVo {

    private Long noteBytes;

    private Long fileBytes;
}
