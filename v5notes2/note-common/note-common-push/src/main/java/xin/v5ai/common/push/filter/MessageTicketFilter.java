package xin.v5ai.common.push.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.push.helper.MessageTicketHelper;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

/**
 * 将一次性 ticket 转换为 Authorization Header，供无法自定义 Header 的 WebSocket 握手使用。
 */
public class MessageTicketFilter extends OncePerRequestFilter {

    private static final String TICKET_PARAM = "ticket";
    private static final String AUTHORIZATION = "Authorization";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String authorization = request.getHeader(AUTHORIZATION);
        String ticket = request.getParameter(TICKET_PARAM);
        if (StringUtils.isBlank(authorization) && StringUtils.isNotBlank(ticket)) {
            String token = MessageTicketHelper.consume(ticket);
            if (StringUtils.isNotBlank(token)) {
                String bearer = token.startsWith("Bearer ") ? token : "Bearer " + token;
                filterChain.doFilter(new TicketAuthorizedRequest(request, bearer), response);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static final class TicketAuthorizedRequest extends HttpServletRequestWrapper {

        private final String authorization;

        private TicketAuthorizedRequest(HttpServletRequest request, String authorization) {
            super(request);
            this.authorization = authorization;
        }

        @Override
        public String getHeader(String name) {
            if (AUTHORIZATION.equalsIgnoreCase(name)) {
                return authorization;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (AUTHORIZATION.equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of(authorization));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = Collections.list(super.getHeaderNames());
            boolean hasAuth = names.stream().anyMatch(AUTHORIZATION::equalsIgnoreCase);
            if (!hasAuth) {
                names.add(AUTHORIZATION);
            }
            return Collections.enumeration(names);
        }
    }
}
