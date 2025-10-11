# 贝尔实验室 Spring 官方推荐镜像 JDK下载地址 https://bell-sw.com/pages/downloads/
FROM bellsoft/liberica-openjdk-debian:17.0.11-cds

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
    groupadd -r appuser --gid 1001 && useradd -r -g appuser --uid 1001 appuser; \
    # 设置目录权限 \
    chown -R appuser:appuser /v5notes; \
    # 清理缓存 \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /v5notes/server

# 复制JAR文件并设置权限
COPY --chown=appuser:appuser ./target/v5cn-admin.jar ./app.jar

# 创建日志目录并确保权限（重要修复）
RUN mkdir -p /v5notes/server/logs && \
    chown -R appuser:appuser /v5notes/server/logs && \
    chmod 755 /v5notes/server/logs

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE ${SERVER_PORT}

# 健康检查（增加更长的启动等待时间）
#HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
#    CMD curl -f http://localhost:${SERVER_PORT}/actuator/health || exit 1

# 使用exec形式启动，确保信号正确传递
ENTRYPOINT ["sh", "-c", "java -Djava.security.egd=$JAVA_SECURITY_EGD \
    -Dserver.port=$SERVER_PORT \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:+UseZGC \
    -XX:HeapDumpPath=/v5notes/server/logs \
    -Djava.awt.headless=true \
    -Dfile.encoding=UTF-8 \
    -Dlogging.file.path=/v5notes/server/logs \
    ${JAVA_OPTS} \
    -jar app.jar $ARGS"]
