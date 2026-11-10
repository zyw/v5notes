package xin.v5ai.common.sms;

import cn.hutool.extra.spring.SpringUtil;
import cn.hutool.http.HttpStatus;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.sms.handler.SmsExceptionHandler;
import org.dromara.sms4j.comm.exception.SmsBlendException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

@DisplayName("common-sms 功能单元测试")
class SmsExceptionHandlerTest {

    @BeforeAll
    static void initializeMessages() {
        StaticApplicationContext context = new StaticApplicationContext();
        LocaleContextHolder.setLocale(Locale.getDefault());
        context.getStaticMessageSource().addMessage("sms.send.failed", Locale.getDefault(), "短信发送失败，请稍后再试...");
        context.refresh();
        new SpringUtil().setApplicationContext(context);
    }

    /**
     * 验证短信服务异常会被转换为稳定的 HTTP 500 业务响应，避免向调用方泄露供应商细节。
     */
    @Test
    @DisplayName("转换短信服务异常")
    void shouldConvertSmsExceptionToFailureResponse() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/sms/send");

        R<Void> response = new SmsExceptionHandler().handleSmsBlendException(mock(SmsBlendException.class), request);

        assertEquals(HttpStatus.HTTP_INTERNAL_ERROR, response.getCode());
        assertEquals("短信发送失败，请稍后再试...", response.getMsg());
    }
}
