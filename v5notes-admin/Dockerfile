# 设置 nginx 作为静态资源服务器
# 指定基础镜像nginx:alpine
FROM nginx:alpine

# 将我们自定义的网站静态文件复制到容器中
COPY dist/ /mnt/ruoyi-web/
# 将我们自定义的nginx配置文件复制到容器中/etc/nginx/nginx.conf
COPY nginx.template /etc/nginx/

# 3. 切换工作目录
WORKDIR /etc/nginx

# 4. 添加环境变量的写入
ENTRYPOINT envsubst '$V5NOTES_SERVER_HOST $V5NOTES_SERVER_PORT'  < nginx.template > nginx.conf && nginx -g 'daemon off;'

# 暴露8988端口
EXPOSE 8988

# 启动 nginx 服务器
# CMD ["nginx", "-g", "daemon off;"]
