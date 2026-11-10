package xin.v5ai.common.core.utils;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;

/**
 * 获取i18n资源文件
 *
 * @author Lion Li
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class MessageUtils {

    /**
     * 根据消息键和参数获取当前语言的文案。
     * 每次读取容器里的 MessageSource，避免类加载时容器尚未就绪。
     *
     * @param code 消息键
     * @param args 参数
     * @return 国际化文案；找不到时返回消息键
     */
    public static String message(String code, Object... args) {
        try {
            MessageSource messageSource = SpringUtils.getBean(MessageSource.class);
            return messageSource.getMessage(code, args, LocaleContextHolder.getLocale());
        } catch (NoSuchMessageException e) {
            return code;
        }
    }
}
