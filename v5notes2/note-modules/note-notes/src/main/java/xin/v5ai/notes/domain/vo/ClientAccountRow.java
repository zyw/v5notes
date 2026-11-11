package xin.v5ai.notes.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 试用判断需要的账号字段。
 */
@Data
public class ClientAccountRow {

    private String userSource;

    private LocalDateTime createTime;
}
