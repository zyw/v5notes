# ========================
# 全局配置
# ========================

# 启用调试模式，输出更详细的日志信息
debug = false

# 启用跟踪模式，输出极其详细的日志（非常冗长，可能影响性能）
trace = false

# BuildKit 守护进程状态数据的存储根目录
root = "/var/lib/buildkit"

# 允许不安全的权利（entitlements），默认禁用
# 启用这些会降低安全性，允许构建过程执行高风险操作
# network.host: 允许构建容器使用主机网络模式
# security.insecure: 允许构建过程绕过某些安全限制
# device: 允许访问设备
insecure-entitlements = []

# ========================
# 日志配置
# ========================

[log]
  # 日志输出格式: "text" (人类可读) 或 "json" (机器可读)
  format = "text"

# ========================
# DNS 配置
# ========================

[dns]
  # DNS 域名服务器列表
  nameservers = ["8.8.8.8", "8.8.4.4"]

  # DNS 解析选项
  options = ["edns0"]

  # 域名搜索后缀列表
  searchDomains = []

# ========================
# gRPC 配置
# ========================

[grpc]
  # gRPC API 监听地址列表
  address = ["unix:///run/buildkit/buildkitd.sock", "tcp://0.0.0.0:1234"]

  # 调试分析地址，用于附加 Go 分析器和调试器
  debugAddress = "0.0.0.0:6060"

  # 运行 gRPC 服务器的用户ID
  uid = 0

  # 运行 gRPC 服务器的组ID
  gid = 0

  # TLS/SSL 加密配置
  [grpc.tls]
    # 服务器证书文件路径
    cert = ""

    # 服务器私钥文件路径
    key = ""

    # CA 证书文件路径，用于验证客户端证书
    ca = ""

# ========================
# OpenTelemetry 配置
# ========================

[otel]
  # OTEL 收集器用于接收跟踪数据的 Unix 域套接字路径
  socketPath = "/run/buildkit/otel-grpc.sock"

# ========================
# CDI 配置
# ========================

[cdi]
  # 禁用容器设备接口 (CDI) 支持
  disabled = false

  # CDI 规范文件扫描目录列表
  specDirs = ["/etc/cdi", "/var/run/cdi"]

# ========================
# 构建历史记录配置
# ========================

[history]
  # 历史记录条目的最大保留时间（秒）
  maxAge = 172800 # 48小时

  # 历史记录中保留的最大条目数量
  maxEntries = 50

# ========================
# OCI Worker 配置
# ========================

[worker.oci]
  # 启用 OCI worker
  enabled = true

  # 手动配置支持的平台（如未设置则自动检测）
  platforms = ["linux/amd64", "linux/arm64"]

  # 存储驱动（快照器）："auto", "overlayfs" 或 "native"
  snapshotter = "auto"

  # 是否在无根（rootless）模式下运行
  rootless = false

  # 是否在主 PID 命名空间中运行子进程
  noProcessSandbox = false

  # 启用/禁用垃圾回收
  gc = true

  # 保证保留的最小磁盘空间（绝对值、百分比或带单位的值）
  reservedSpace = "512MB"

  # 可使用的最大磁盘空间
  maxUsedSpace = "10GB"

  # 垃圾回收器尝试保留的目标空闲磁盘空间量
  minFreeSpace = "1GB"

  # 替代的 OCI worker 二进制文件名称（如 "crun"）
  binary = ""

  # 应用于构建容器的 AppArmor 配置文件名称
  apparmor-profile = ""

  # 可同时运行的并行构建步骤的最大数量
  max-parallelism = 4

  # 可重用 CNI 网络命名空间池的大小
  cniPoolSize = 16

  # 应用于构建容器的标签
  [worker.oci.labels]
    "com.example.worker" = "oci"

  # 垃圾回收策略 - 策略1
  [[worker.oci.gcpolicy]]
    reservedSpace = "256MB"
    maxUsedSpace = "2GB"
    minFreeSpace = "500MB"
    keepDuration = "24h"
    filters = ["type==source.local", "type==exec.cachemount", "type==source.git.checkout"]

  # 垃圾回收策略 - 策略2（应用于所有未匹配其他策略的缓存记录）
  [[worker.oci.gcpolicy]]
    all = true
    reservedSpace = "1GB"

# ========================
# Containerd Worker 配置
# ========================

[worker.containerd]
  # containerd 守护进程的套接字地址
  address = "/run/containerd/containerd.sock"

  # 启用 containerd worker
  enabled = false

  # 手动配置支持的平台
  platforms = ["linux/amd64", "linux/arm64"]

  # 在 containerd 中使用的命名空间
  namespace = "buildkit"

  # 启用/禁用垃圾回收
  gc = true

  # 保证保留的最小磁盘空间
  reservedSpace = "30%"

  # 可使用的最大磁盘空间
  maxUsedSpace = "60%"

  # 垃圾回收器尝试保留的目标空闲磁盘空间量
  minFreeSpace = "20GB"

  # 可同时运行的并行构建步骤的最大数量
  max-parallelism = 4

  # 可重用 CNI 网络命名空间池的大小
  cniPoolSize = 16

  # 所有容器的父 cgroup
  defaultCgroupParent = "buildkit"

  # 应用于构建容器的标签
  [worker.containerd.labels]
    "com.example.worker" = "containerd"

  # containerd 运行时配置
  [worker.containerd.runtime]
    name = "io.containerd.runc.v2"
    path = ""
    options = { BinaryName = "runc" }

  # 垃圾回收策略 - 策略1
  [[worker.containerd.gcpolicy]]
    reservedSpace = "512MB"
    keepDuration = 172800
    filters = ["type==source.local", "type==exec.cachemount", "type==source.git.checkout"]

  # 垃圾回收策略 - 策略2（应用于所有未匹配其他策略的缓存记录）
  [[worker.containerd.gcpolicy]]
    all = true
    reservedSpace = "1024MB"

# ========================
# 镜像仓库配置
# ========================

# Docker Hub 配置
[registry."docker.io"]
  # 镜像站地址列表
  mirrors = ["mirror.example.com:5000"]

  # 是否使用 HTTP 连接到镜像站
  http = false

  # 是否跳过 TLS 证书验证
  insecure = false

  # CA 证书文件路径列表
  ca = ["/etc/buildkit/certs/docker.io-ca.crt"]

  # 客户端 TLS 身份验证密钥对
  [[registry."docker.io".keypair]]
    key = "/etc/buildkit/certs/docker.io-key.pem"
    cert = "/etc/buildkit/certs/docker.io-cert.pem"

# 私有仓库配置
[registry."registry.example.com:5000"]
  http = true
  insecure = true

# ========================
# 前端配置
# ========================

# Dockerfile 前端配置
[frontend."dockerfile.v0"]
  enabled = true

# Gateway 前端配置
[frontend."gateway.v0"]
  enabled = true

  # 允许作为网关源的仓库列表（空列表表示允许所有）
  allowedRepositories = []

# ========================
# 系统配置
# ========================

[system]
  # 扫描被模拟平台变更的时间间隔
  platformsCacheMaxAge = "1h"