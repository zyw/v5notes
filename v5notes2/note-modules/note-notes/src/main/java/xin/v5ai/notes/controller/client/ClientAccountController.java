package xin.v5ai.notes.controller.client;

import cn.dev33.satoken.annotation.SaCheckLogin;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.notes.domain.vo.ClientQuotaVo;
import xin.v5ai.notes.service.IClientTrialService;

/**
 * 当前客户端用户的试用额度。
 */
@RequiredArgsConstructor
@RestController
@RequestMapping("/client/account")
public class ClientAccountController {

    private final IClientTrialService trialService;

    /**
     * 试用是否已经结束，以及当前占用。
     *
     * @return 额度
     */
    @SaCheckLogin
    @GetMapping("/quota")
    public R<ClientQuotaVo> quota() {
        return R.ok(trialService.quota(LoginHelper.getUserId()));
    }
}
