package xin.v5ai.common.social;

import xin.v5ai.common.social.utils.GiteeEmailSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@DisplayName("Gitee 邮箱列表解析")
class GiteeEmailSupportTest {

    @Test
    @DisplayName("优先 confirmed + primary")
    void prefersConfirmedPrimary() {
        String body = """
            [
              {"email":"other@example.com","state":"confirmed","scope":["public"]},
              {"email":"main@example.com","state":"confirmed","scope":["primary","public"]},
              {"email":"old@example.com","state":"unconfirmed","scope":["primary"]}
            ]
            """;
        assertEquals("main@example.com", GiteeEmailSupport.pickPrimaryEmail(body));
    }

    @Test
    @DisplayName("无 primary 时取首个 confirmed")
    void fallsBackToFirstConfirmed() {
        String body = """
            [
              {"email":"a@example.com","state":"unconfirmed","scope":["primary"]},
              {"email":"b@example.com","state":"confirmed","scope":["public"]}
            ]
            """;
        assertEquals("b@example.com", GiteeEmailSupport.pickPrimaryEmail(body));
    }

    @Test
    @DisplayName("非法响应返回 null")
    void rejectsNonArray() {
        assertNull(GiteeEmailSupport.pickPrimaryEmail("{\"email\":\"x@y.z\"}"));
        assertNull(GiteeEmailSupport.pickPrimaryEmail(""));
        assertNull(GiteeEmailSupport.pickPrimaryEmail(null));
    }
}
