package xin.v5ai.notes.domain.vo;

import lombok.Data;

/**
 * 客户端用户占用空间。笔记按当前正文的字节数计算，文件按上传大小计算。
 */
@Data
public class ClientStorageRankVo {

    private Long userId;

    private String userName;

    private String nickName;

    private String userSource;

    private Long noteBytes;

    private Long fileBytes;

    private Long usedBytes;
}
