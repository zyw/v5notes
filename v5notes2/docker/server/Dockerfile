# v5notes2 API 镜像。
# 先在 v5notes2 目录执行：mvn -DskipTests package
# 产物：note-admin/target/v5notes2.jar
FROM eclipse-temurin:21-jre
WORKDIR /app
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    JAVA_OPTS=""
RUN mkdir -p /root/v5notes/upload
COPY note-admin/target/v5notes2.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
