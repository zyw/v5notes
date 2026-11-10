# v5notes2 API 镜像。构建上下文是 note-admin 目录。
# 先执行：mvn -DskipTests package
# 产物：target/v5notes2.jar
FROM eclipse-temurin:21-jre
WORKDIR /app
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    JAVA_OPTS=""
RUN mkdir -p /root/v5notes/upload
COPY target/v5notes2.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
