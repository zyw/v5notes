package xin.v5ai.web.domain.bo;

import lombok.Data;

/** 刷新令牌请求体。 */
@Data
public class RefreshTokenBody {
    private String refreshToken;
}
