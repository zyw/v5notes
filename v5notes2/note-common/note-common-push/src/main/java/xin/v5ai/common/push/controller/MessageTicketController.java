package xin.v5ai.common.push.controller;

import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.push.helper.MessageTicketHelper;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 签发消息长连接一次性票据。
 */
@RestController
public class MessageTicketController {

    /**
     * 为 WebSocket 等无法自定义 Header 的连接签发短时 ticket。
     *
     * @return ticket
     */
    @PostMapping("${message.path:/resource/message}/ticket")
    public R<Map<String, String>> createTicket() {
        return R.ok(Map.of("ticket", MessageTicketHelper.issue()));
    }
}
