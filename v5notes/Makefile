# 定义变量
PROJECT_NAME 			?= v5notes
# make buildx-admin VERSION=输入版本号
VERSION					?= latest
ENV_DOCKER 				?= docker
# 镜像仓库
ENV_DOCKER_REGISTRY 	?= onedev.v5ai.xin/$(PROJECT_NAME)/
# 镜像版本
ENV_DOCKER_IMAGE_TAG 	?= $(VERSION)

# builder名称
BUILDER=$(PROJECT_NAME)-builder

# 后台管理模块
ENV_ADMIN_NAME 			?= v5notes-admin
ENV_V5CN_NAME 			?= v5cn-admin
ENV_ADMIN_CTX 			?= ./$(ENV_V5CN_NAME)/
ENV_ADMIN_FULL_NAME 	?= $(ENV_DOCKER_REGISTRY)$(ENV_ADMIN_NAME):$(ENV_DOCKER_IMAGE_TAG)

# 构建镜像平台架构
# PLATFORM 				?= linux/amd64,linux/arm64
PLATFORM 				?= linux/amd64


# Makefile basic extension function
_color_red    =\E[1;31m
_color_green  =\E[1;32m
_color_yellow =\E[1;33m
_color_blue   =\E[1;34m
_color_wipe   =\E[0m


define func_echo_status
	printf "[%b info %b] %s\n" "$(_color_blue)" "$(_color_wipe)" $(1)
endef


define func_echo_warn_status
	printf "[%b info %b] %s\n" "$(_color_yellow)" "$(_color_wipe)" $(1)
endef


define func_echo_success_status
	printf "[%b info %b] %s\n" "$(_color_green)" "$(_color_wipe)" $(1)
endef

define docker_buildx
    $(call func_echo_status, "start build --> $(1)")
    $(ENV_DOCKER) buildx build $(1) -t $(2) --platform $(PLATFORM) --push
    $(call func_echo_success_status, "build success --> $(1)")
endef


### help : Show Makefile rules
### 	If there're awk failures, please make sure
### 	you are using awk or gawk
.PHONY: help
help:
	@$(call func_echo_success_status, "Makefile rules:")
	@awk 'BEGIN {FS = "### *"} \
    		match($$0, /^[ \t]*###[ \t]*([^:]+):[ \t]*(.*)$$/) { \
    			printf("    make %-15s : %s\n", substr($$0, RSTART, RLENGTH), substr($$0, RSTART+RLENGTH)) \
    		}' Makefile

# >/dev/null 2>&1 表示将标准输出和标准错误输出都重定向到 /dev/null，
# 这样就不会在终端上显示任何输出。
# 2>&1 表示将标准错误输出重定向到标准输出，
# 所以 $? 表示上一个执行的命令的退出状态码。
# $? 在 Shell 中是一个特殊变量，表示上一个执行的命令的退出状态码。
# 在 Makefile 的 $(shell ...) 函数里，$ 需要转义，所以写成 $$?
.PHONY: create-builder
create-builder:
	$(eval ENV_BUILDER_EXIST := $(shell $(ENV_DOCKER) buildx inspect '$(BUILDER)' >/dev/null 2>&1;echo $$?))
	@$(call func_echo_status, "check builder exist $(ENV_BUILDER_EXIST)")
	@if [ '$(ENV_BUILDER_EXIST)' = '0' ]; then \
    	@$(call func_echo_warn_status, "${BUILDER} exist skip create"); \
    	$(ENV_DOCKER) buildx rm $(BUILDER) --force; \
    fi
	$(ENV_DOCKER) buildx create --name $(BUILDER) --use --buildkitd-config ./script/docker/buildkitd.toml
	@$(call func_echo_success_status, "create ${BUILDER} success")

#=====================================================
# buildx 构建镜像
#=====================================================

### buildx-mgr: BuildKit构建后台管理模块Docker镜像
.PHONY: buildx-admin
buildx-admin: create-builder
	@$(call docker_buildx, $(ENV_ADMIN_CTX), $(ENV_ADMIN_FULL_NAME))


#=====================================================
# build 构建镜像
#=====================================================

### build-admin: 构建后台管理模块Docker镜像
.PHONY: build-admin
build-mgr:
	@$(call func_echo_status, "build mgr")
	@$(ENV_DOCKER) build -t $(ENV_MGR_FULL_NAME) $(ENV_MGR_CTX)
	@$(call func_echo_success_status, "build mgr success")

### push-admin: 推送后台管理模块Docker镜像
.PHONY: push-admin
push-admin:
	@$(call func_echo_status, "push admin")
	@$(ENV_DOCKER) push $(ENV_ADMIN_FULL_NAME)
	@$(call func_echo_success_status, "push admin success")
