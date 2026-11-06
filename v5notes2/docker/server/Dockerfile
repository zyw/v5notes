# v5notes2 后端镜像（需先在宿主执行 mvn package 生成 note-admin/target/v5notes2.jar）
FROM eclipse-temurin:21-jre
WORKDIR /app
ENV TZ=Asia/Shanghai
COPY note-admin/target/v5notes2.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
