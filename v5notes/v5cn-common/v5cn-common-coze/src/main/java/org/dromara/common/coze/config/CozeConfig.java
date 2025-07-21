package org.dromara.common.coze.config;

import cn.hutool.core.io.resource.ResourceUtil;
import cn.hutool.core.util.StrUtil;
import com.coze.openapi.service.auth.JWTOAuthClient;
import com.coze.openapi.service.config.Consts;
import org.dromara.common.coze.config.properties.CozeProperties;
import org.dromara.common.coze.exception.CozeClientException;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;

@AutoConfiguration
@ConditionalOnProperty(value = "coze.enabled", havingValue = "true")
@EnableConfigurationProperties(CozeProperties.class)
public class CozeConfig {

    @Bean
    public JWTOAuthClient jwtOAuthClient(CozeProperties cozeProperties) {
        String privateKey = cozeProperties.getPrivateKey();
        if (StrUtil.isEmpty(privateKey)) {
            if (StrUtil.isEmpty(cozeProperties.getPrivateKeyFilePath())) {
                throw new CozeClientException("coze.privateKey和coze.privateKeyFilePath不能同时为空");
            }
            privateKey = ResourceUtil.readStr(cozeProperties.getPrivateKeyFilePath(), StandardCharsets.UTF_8);
        }
        JWTOAuthClient client = null;
        try {
            client = new JWTOAuthClient.JWTOAuthBuilder()
                .clientID(cozeProperties.getClientId())
                .privateKey(privateKey)
                .publicKey(cozeProperties.getPublicKey())
                .baseURL(Consts.COZE_CN_BASE_URL)
                .build();
        } catch (Exception e) {
            throw new CozeClientException("构建扣子JWTOAuthClient异常", e);
        }
        return client;
    }

}
