# 发布镜像到 OneDev

`https://onedev.v5ai.xin/docker-imgs/~packages` 是项目的包管理页面。按 OneDev 的内置 Registry 命名规则，从该地址推导出的 Registry 主机是 `onedev.v5ai.xin`，项目路径是 `docker-imgs`，镜像引用格式是 `onedev.v5ai.xin/docker-imgs/<镜像名>:<版本>`。首次推送会创建对应的镜像仓库。[OneDev 容器镜像文档](https://docs.onedev.io/tutorials/package/working-with-container-image)

你给的 `docker-imgs` 包页面已经列出容器镜像，因此该项目的 **Package Management** 已启用。发布用的账号或 Access Token 需要该项目的包写权限（例如 **Package Writer**），拉取需要包读权限（例如 **Package Reader**）。可在 OneDev 个人菜单的 **Access Tokens** 中创建仅授权此项目的令牌。[包权限](https://docs.onedev.io/tutorials/package/working-with-packages#permission-to-access-and-publish-packages) · [令牌管理](https://docs.onedev.io/tutorials/security/manage-access-tokens)

## 推送已有的本地镜像

用 OneDev 登录名登录，在密码提示处粘贴上面的 Access Token。示例以本地已有的 `v5notes2-api:2.0.0` 为源。按实际镜像名和版本调整 `docker tag` 和 `docker push` 命令。[OneDev Registry 认证说明](https://code.onedev.io/onedev/server/~issues/2575) · [Docker 登录文档](https://docs.docker.com/reference/cli/docker/login/)

```bash
docker login onedev.v5ai.xin -u YOUR_ONEDEV_LOGIN
docker tag v5notes2-api:2.0.0 onedev.v5ai.xin/docker-imgs/v5notes2-api:2.0.0
docker push onedev.v5ai.xin/docker-imgs/v5notes2-api:2.0.0
```

推送后，在 **Packages** 页面打开对应版本，可以查看镜像摘要、平台和拉取命令。[OneDev 拉取说明](https://docs.onedev.io/tutorials/package/working-with-container-image#consume-published-image)

## 用 OneDev 构建并推送

开发机可以不装 Docker。让存放源码的 OneDev 项目执行 `.onedev-buildspec.yml` 中的任务。OneDev 服务器上的 **Server Docker Executor** 或远端 Agent 上的 **Remote Docker Executor** 执行构建，执行机需安装 Docker 和 Buildx。在 **Administration → Job Executors** 显式配置执行器，并在 **Security Settings** 启用 **Enable Buildx Image Build**。[执行器设置](https://docs.onedev.io/tutorials/cicd/build-docker-image#enable-image-build-in-the-executor) · [远端 Agent](https://docs.onedev.io/tutorials/cicd/agent-farm)

1. 在源码项目的 **Settings → Build → Job Secrets** 保存 `package-token`，值是对 `docker-imgs` 有包写权限的 Access Token。[Job Secrets](https://docs.onedev.io/tutorials/cicd/job-secrets)
2. 先运行 **Checkout Code**，再生成 Dockerfile 要复制的产物。以当前单体仓库布局为例，在 `v5notes2/` 中执行 `mvn -DskipTests package`，生成 `note-admin/target/v5notes2.jar`。将 **Build Path** 设为 `v5notes2`，将 **Dockerfile** 设为 `v5notes2/docker/server/Dockerfile`。路径相对任务工作目录；如果 OneDev 源码仓库本身就是 `v5notes2/` 子目录，则分别填 `.` 和 `docker/server/Dockerfile`。[API Dockerfile](../v5notes2/docker/server/Dockerfile) · [OneDev 构建步骤源码](https://github.com/theonedev/onedev/blob/main/server-core/src/main/java/io/onedev/server/buildspec/step/BuildImageStep.java#L47-L63)
3. 添加 **Build Image (Buildx)** 步骤，选择 **Push to container registry**，标签设为 `@server@/docker-imgs/v5notes2-api:@build_number@`。在 **More Settings → Registry Logins** 中将 Registry URL 设为 `@server_url@`、用户名设为 `@job_token@`、密码密钥选 `package-token`。这些配置会把镜像和发布它的构建关联起来。[OneDev CI 发布示例](https://docs.onedev.io/tutorials/package/working-with-container-image#publish-container-image)

这一步发布的是 API。当前 Compose 还会单独构建管理前端：先在 `v5notes-admin2/` 执行 `pnpm install && pnpm build`，再用 **Build Path** `v5notes-admin2` 和 **Dockerfile** `v5notes-admin2/Dockerfile` 发布为 `@server@/docker-imgs/v5notes2-admin:@build_number@`。若要部署时直接拉取镜像，还需把 Compose 中两个服务的 `build` 改成对应 `image`；MySQL 和 Redis 仍使用上游镜像。[部署 Compose](../v5notes2/docker/docker-compose.yml) · [前端 Dockerfile](../v5notes-admin2/Dockerfile)

## 用 GitHub Actions 构建并推送 API

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 下，把 OneDev 登录名存为变量 `ONEDEV_USERNAME`，把 Access Token 存为密钥 `ONEDEV_TOKEN`。创建令牌时关闭 **Has Owner Permissions**，仅对 `docker-imgs` 授予 **Package Writer**。工作流以该令牌登录 OneDev，GitHub 自带的 `GITHUB_TOKEN` 仅需 `contents: read`，用于检出源码。[GitHub Actions 密钥](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) · [OneDev 令牌管理](https://docs.onedev.io/tutorials/security/manage-access-tokens) · [Docker 登录 Action](https://github.com/docker/login-action#inputs)

将下面的示例保存为 `.github/workflows/publish-api-image.yml`。为已合并的提交推送普通 Git tag `api-v5notes2-2.0.0`，会发布镜像标签 `2.0.0` 和 `sha-<完整提交 SHA>`。这个前缀不匹配现有桌面更新工作流的 `v*` 标签规则。桌面工作流还会响应任何 GitHub Release 的 `published` 事件，因此发布 API 镜像时只推送 Git tag，不要为它创建 GitHub Release；若以后需要 Release 事件，再单独给桌面工作流加过滤。也可以从默认分支手动运行，生成提交标签用于验证。发布任务限定在 `zyw/v5notes` 仓库。PR 构建可以独立使用 `pull_request` 事件，在不注入发布密钥的任务中编译或测试。[GitHub 触发条件](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore) · [GitHub PR 安全指引](https://docs.github.com/en/actions/reference/security/secure-use) · [现有桌面工作流](../.github/workflows/publish-update-feed.yml)

```yaml
name: Publish v5notes2 API image

on:
  push:
    tags: ['api-v5notes2-*']
  workflow_dispatch:

permissions:
  contents: read

jobs:
  publish:
    if: >-
      github.repository == 'zyw/v5notes' &&
      (github.event_name == 'push' || github.ref == 'refs/heads/main')
    runs-on: ubuntu-latest
    env:
      IMAGE: onedev.v5ai.xin/docker-imgs/v5notes2-api
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: '21'
      - name: Package API
        working-directory: v5notes2
        run: |
          sh ./mvnw --batch-mode -DskipTests package
          test -s note-admin/target/v5notes2.jar
      - name: Set image tags
        id: image
        run: |
          tags="$IMAGE:sha-$GITHUB_SHA"
          if [[ "$GITHUB_REF_TYPE" == tag ]]; then
            version="${GITHUB_REF_NAME#api-v5notes2-}"
            if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
              echo 'Expected a tag such as api-v5notes2-2.0.0' >&2
              exit 1
            fi
            tags="$tags,$IMAGE:$version"
          fi
          printf 'tags=%s\n' "$tags" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: onedev.v5ai.xin
          username: ${{ vars.ONEDEV_USERNAME }}
          password: ${{ secrets.ONEDEV_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v7
        with:
          context: ./v5notes2
          file: v5notes2/docker/server/Dockerfile
          push: true
          tags: ${{ steps.image.outputs.tags }}
```

`context: ./v5notes2` 将 runner 上的目录作为构建上下文，包含刚生成的 JAR。默认 Git context 从 Git ref 读取内容，看不到同一任务中生成的 JAR。`file` 会作为 `docker buildx build --file` 的参数传入，以上写法从 checkout 的工作目录定位 Dockerfile，`COPY note-admin/target/v5notes2.jar` 则从 `./v5notes2` 定位源文件。[Docker Action 的 Path context](https://github.com/docker/build-push-action#path-context) · [Action 源码](https://github.com/docker/build-push-action/blob/master/src/context.ts) · [Buildx `--file`](https://docs.docker.com/reference/cli/docker/buildx/build/#file) · [API Dockerfile](../v5notes2/docker/server/Dockerfile)

首次可从默认分支手动运行，在 OneDev **Packages** 核对 `sha-…` 标签和摘要。如果 Registry 仅内网可达，把 `runs-on` 改为匹配专用 Linux self-hosted runner 的标签，确保 runner 和 BuildKit 能解析域名、访问 `/v2/` 并信任 HTTPS 证书。把发布 runner 留给可信的工作流。[GitHub 自托管 runner](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners) · [OneDev Registry 连通性](https://docs.onedev.io/tutorials/package/working-with-container-image#consume-published-image)

## 核对实例

还要确认实际构建执行器能访问 Registry。可以从执行器运行 `curl -sS -D - -o /dev/null https://onedev.v5ai.xin/v2/`；Registry V2 可返回 `200` 或带 `WWW-Authenticate` 的 `401`。如果返回网页或重定向到网页登录，检查反向代理是否将 `/v2/` 转发给 OneDev，以及 **Administration → System Settings** 中的 **Server URL** 是否匹配对外访问地址。[Registry V2 检查](https://distribution.github.io/distribution/spec/api/#api-version-check) · [OneDev Server URL](https://docs.onedev.io/tutorials/package/working-with-container-image#consume-published-image)
