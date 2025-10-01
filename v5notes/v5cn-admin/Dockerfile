# 贝尔实验室 Spring 官方推荐镜像 JDK下载地址 https://bell-sw.com/pages/downloads/
FROM bellsoft/liberica-openjdk-debian:17.0.11-cds
#FROM bellsoft/liberica-openjdk-debian:21.0.3-cds
#FROM findepi/graalvm:java17-native

LABEL maintainer="ZYW" \
      version="1.0.0" \
      description="V5Notes Admin Application"

# 设置环境变量
ENV SERVER_PORT=8080 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    JAVA_OPTS="" \
    ARGS="" \
    TZ=Asia/Shanghai \
    JAVA_SECURITY_EGD=file:/dev/./urandom

# 设置时区并创建目录
RUN set -eux; \
    # 设置时区 \
    ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime && echo ${TZ} > /etc/timezone; \
    # 创建必要的目录 \
    mkdir -p /v5notes/server/logs \
             /v5notes/server/temp \
             /v5notes/skywalking/agent; \
    # 创建非root用户运行应用(安全最佳实践) \
    groupadd -r appuser && useradd -r -g appuser appuser; \
    # 清理缓存 \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /v5notes/server

# 复制JAR文件并设置权限
COPY --chown=appuser:appuser ./target/v5cn-admin.jar ./app.jar

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE ${SERVER_PORT}

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${SERVER_PORT}/actuator/health || exit 1

# 使用exec形式启动，确保信号正确传递
ENTRYPOINT ["sh", "-c", "java -Djava.security.egd=$JAVA_SECURITY_EGD \
    -Dserver.port=$SERVER_PORT \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:+UseZGC \
    -XX:HeapDumpPath=/v5notes/server/logs \
    -Djava.awt.headless=true \
    -Dfile.encoding=UTF-8 \
    ${JAVA_OPTS} \
    -jar app.jar $ARGS"]
