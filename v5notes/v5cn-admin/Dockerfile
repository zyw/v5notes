# 贝尔实验室 Spring 官方推荐镜像 JDK下载地址 https://bell-sw.com/pages/downloads/
FROM bellsoft/liberica-openjdk-debian:17.0.11-cds
#FROM bellsoft/liberica-openjdk-debian:21.0.3-cds
#FROM findepi/graalvm:java17-native

LABEL maintainer="Lion Li"

RUN mkdir -p /v5notes/server/logs \
    /v5notes/server/temp \
    /v5notes/skywalking/agent

WORKDIR /v5notes/server

ENV SERVER_PORT=8080 LANG=C.UTF-8 LC_ALL=C.UTF-8 JAVA_OPTS=""

## 应用参数 https://github.com/polovyivan/docker-pass-configs-to-container
ENV ARGS=""

EXPOSE ${SERVER_PORT}

ADD ./target/v5cn-admin.jar ./app.jar

# 应用配置说明：
# - 如果想区分集群节点监控，把服务名改成不同的名称即可
# - 取消下面两行的注释来启用 SkyWalking
#   -Dskywalking.agent.service_name=ruoyi-server
#   -javaagent:/ruoyi/skywalking/agent/skywalking-agent.jar
ENTRYPOINT ["java", \
           "-Djava.security.egd=file:/dev/./urandom", \
           "-Dserver.port=${SERVER_PORT}", \
           "-XX:+HeapDumpOnOutOfMemoryError", \
           "-XX:+UseZGC", \
           "${JAVA_OPTS}", \
           "-jar", "app.jar", "${ARGS}"]
