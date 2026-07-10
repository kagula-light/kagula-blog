# 部署

## 目标环境

- Ubuntu 24.04 LTS。
- 2 核 CPU、约 2 GB 内存和有限 Swap。
- Docker 与 Docker Compose 已安装。
- 宝塔 Nginx 已占用 80/443。
- 服务器已有必须保留的 `sub2api`、PostgreSQL 和 Redis 容器。

博客必须完全隔离，不复用现有容器、卷或网络。

## 部署拓扑

~~~text
Internet
  -> 宝塔 Nginx :80/:443
     -> blog-web 内部端口

blog Compose project
  blog-web
  blog-worker
  blog-postgres
  blog-redis
  migrate 一次性任务
~~~

数据库和 Redis 不映射公网端口。

## GitHub 流程

阶段 1 建立 CI、迁移验证和镜像构建冒烟测试，不注入任何生产部署凭据。以下“合并 main”生产步骤只在阶段 6 的 Compose、备份、迁移、健康检查、回滚和受限部署用户全部验证后启用。

### Pull Request

1. 安装锁定依赖。
2. Lint。
3. TypeScript 检查。
4. 单元测试。
5. 启动临时 PostgreSQL 和 Redis，执行迁移与集成测试。
6. 构建 Web 和 Worker。
7. 构建容器镜像并运行健康冒烟检查。
8. 必要时运行核心 Playwright 流程。

### 合并 main，阶段 6 启用

1. 重复必需质量门禁。
2. 构建多阶段 Web 与 Worker 镜像。
3. 使用提交 SHA 标记镜像。
4. 推送 GHCR。
5. 通过 GitHub Production Environment 连接部署用户。
6. 上传或写入只含版本标识的部署清单。
7. 拉取新镜像。
8. 运行一次性迁移。
9. 启动新版本。
10. 轮询就绪检查。
11. 成功后记录当前 SHA；失败则恢复前一 SHA。

## 部署用户

- 不使用 root。
- 只允许 SSH Key。
- 只拥有博客部署目录和所需 Docker 操作权限。
- GitHub Actions 不保存 root 密码。
- 部署 Key 可轮换，不与个人 SSH Key 共用。

## 生产目录

计划使用独立目录，例如：

~~~text
/opt/kagura-blog/
  compose.yml
  .env
  releases/
  state/
  backups/
~~~

环境文件权限仅允许部署用户和必要系统账户读取。

## 数据库迁移

- 迁移在启动新应用前运行。
- 迁移失败立即停止部署。
- 破坏性迁移使用跨版本兼容策略。
- 应用回滚时，数据库必须仍兼容前一版本。
- 无法兼容的迁移需要独立维护窗口，不走普通自动发布。

## 宝塔 Nginx

域名确定后：

- 创建站点与 HTTPS 证书。
- 将应用流量代理到本机仅监听地址。
- 转发真实协议、主机和客户端 IP。
- 配置 WebSocket 仅在应用实际需要时启用。
- 上传大小与应用限制保持一致。
- 静态资源优先从 R2 自定义域名获取。

后台使用同域 `/admin`，不创建独立后台子域名。

## 资源限制

- Web、Worker、PostgreSQL 和 Redis 设置容器内存上限。
- Worker 并发受限，避免热点采集挤压 Web。
- PostgreSQL 连接数按实际容器内存配置。
- Redis 配置最大内存和淘汰策略。
- 构建永远不在服务器执行。

具体限制在上线前依据 `docker stats` 和压测结果写入 Compose。

## 回滚

- 每次部署保留当前 SHA 和前一成功 SHA。
- 应用或健康检查失败时重新指向前一镜像。
- 回滚不使用 `latest` 猜测版本。
- 回滚结果写入部署日志。
- 数据问题需要按 `operations.md` 的恢复流程处理，不以镜像回滚代替数据库恢复。

## 首次上线顺序

1. 轮换已暴露的 root 密码。
2. 创建部署用户和 SSH Key。
3. 备份当前服务器配置和现有 Compose 状态。
4. 部署博客内部服务，不接公网。
5. 执行迁移和种子管理员创建。
6. 验证健康检查与核心流程。
7. 配置宝塔 Nginx 和 HTTPS。
8. 配置域名与 R2 资源域名。
9. 验证自动部署和回滚。
10. 在用户授权下逐步完成 SSH、防火墙和 Fail2ban 加固。
