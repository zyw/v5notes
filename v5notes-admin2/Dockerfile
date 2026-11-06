FROM nginx:alpine
COPY dist/ /mnt/ruoyi-web/
COPY nginx.template /etc/nginx/
WORKDIR /etc/nginx
ENTRYPOINT envsubst '$V5NOTES_SERVER_HOST $V5NOTES_SERVER_PORT' < nginx.template > nginx.conf && nginx -g 'daemon off;'
EXPOSE 8988
