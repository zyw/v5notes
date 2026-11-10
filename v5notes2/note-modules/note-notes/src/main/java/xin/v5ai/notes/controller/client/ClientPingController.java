package xin.v5ai.notes.controller.client;

import cn.dev33.satoken.annotation.SaIgnore;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.web.core.BaseController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/client/ping")
public class ClientPingController extends BaseController {
    /**
     * 测试服务器是否连接通
     */
    @SaIgnore
    @GetMapping()
    public R<Void> ping() {
        return R.ok();
    }
}
