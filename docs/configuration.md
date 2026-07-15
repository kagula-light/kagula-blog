# 配置

配置使用运行时环境变量，并通过类型化模块在启动时校验。Secret 不进入数据库 SiteSetting，也不提交到 Git。

## 应用

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `NODE_ENV` | 运行模式 | 否 |
| `APP_URL` | 站点公开基础地址 | 否 |
| `APP_TIMEZONE` | 业务时区，生产为 `Asia/Shanghai` | 否 |
| `LOG_LEVEL` | 结构化日志级别 | 否 |
| `APP_RELEASE` | Git 提交 SHA 或发布标识 | 否 |
| `MASCOT_ENABLED` | 是否向公开站点提供看板娘入口 | 否 |
| `MASCOT_MODEL_PATH` | 相对 `R2_PUBLIC_BASE_URL` 的模型清单路径 | 否 |
| `MASCOT_POSTER_PATH` | 同源静态回退图路径，默认 `/brand/kagura-avatar.webp` | 否 |

域名不在 V1 编码阶段固定。部署时设置 `APP_URL`，之后再配置 DNS 和 HTTPS。

`MASCOT_ENABLED` 只接受 `true` 或 `false`，默认 `false`。模型路径只能是 `R2_PUBLIC_BASE_URL` 下的安全相对路径，拒绝协议、绝对路径、反斜杠和路径穿越；海报必须是以 `/` 开头的同源路径。`MASCOT_ENABLED=false` 时不渲染入口；启用但没有模型路径时只显示静态回退，模型加载失败时也回到海报且不自动重试。

## 数据库与 Redis

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 | 是 |
| `DATABASE_POOL_MAX` | 最大连接数 | 否 |
| `REDIS_URL` | Redis 连接串 | 是 |
| `CACHE_PREFIX` | 环境隔离前缀 | 否 |

生产博客使用自己的 PostgreSQL 和 Redis，不复用现有应用实例。

## 认证

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `SESSION_SECRET` | 会话 Token 派生密钥 | 是 |
| `SESSION_COOKIE_NAME` | Cookie 名称 | 否 |
| `SESSION_TTL_HOURS` | 会话有效时间 | 否 |
| `TURNSTILE_SITE_KEY` | 浏览器 Turnstile Key | 否 |
| `TURNSTILE_SECRET_KEY` | 服务端验证 Key | 是 |

`SESSION_SECRET` 使用高熵随机值，不与数据库或部署密钥复用。

本地、CI 和 Playwright 使用 Cloudflare 官方 Turnstile 测试键；生产通过受限环境文件和 GitHub Environment 注入真实键。`TURNSTILE_SECRET_KEY` 不得进入客户端 bundle、日志或数据库。域名确定后在 Cloudflare 控制台只允许正式博客主机。

管理员 bootstrap 是一次性 Worker CLI，不把引导密码加入长期 Worker runtime schema。执行时临时注入：

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 首个管理员用户名；规范化后 3–32 位 | 否 |
| `ADMIN_DISPLAY_NAME` | 管理员展示名，1–80 位 | 否 |
| `ADMIN_PASSWORD` | 管理员密码，12–256 位 | 是 |

命令还需要 `DATABASE_URL`。生产执行必须使用不回显且不写入 shell 历史的环境注入方式；日志只记录动作、用户 ID 和发布标识。

## Cloudflare R2

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `R2_ENDPOINT` | S3 兼容端点 | 否 |
| `R2_REGION` | 通常为 `auto` | 否 |
| `R2_ACCESS_KEY_ID` | 资源桶访问 ID | 是 |
| `R2_SECRET_ACCESS_KEY` | 资源桶 Secret | 是 |
| `R2_BUCKET` | 公开资源桶名称 | 否 |
| `R2_PUBLIC_BASE_URL` | 公开资源域名 | 否 |
| `R2_FORCE_PATH_STYLE` | S3 兼容服务是否使用路径风格；Cloudflare R2 为 `false`，本地 MinIO 为 `true` | 否 |
| `MEDIA_MAX_BYTES` | 单张图片最大字节数 | 否 |
| `MEDIA_MAX_DIMENSION` | 图片最大宽或高 | 否 |

备份使用独立凭据：

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `BACKUP_R2_ACCESS_KEY_ID` | 备份写入 ID | 是 |
| `BACKUP_R2_SECRET_ACCESS_KEY` | 备份写入 Secret | 是 |
| `BACKUP_R2_BUCKET` | 备份桶 | 否 |
| `BACKUP_ENCRYPTION_KEY` | 备份加密密钥 | 是 |

Web 运行凭据不应具有读取数据库备份的权限。

## Worker 与热点

| 变量 | 作用 | 敏感 |
| --- | --- | --- |
| `HOTSPOT_COLLECTION_ENABLED` | 是否运行热点采集；生产默认 `true`，其他环境默认 `false` | 否 |
| `WORKER_HEALTH_PORT` | Worker 健康 HTTP 端口，当前本地默认 `3001` | 否 |
| `MIGRATIONS_DIR` | Worker 迁移命令读取的迁移目录 | 否 |

当前采集周期固定为 30 分钟，响应上限固定为 2 MiB；每个来源的启用状态、请求主机和超时存入 PostgreSQL。每日归档固定在北京时间 `00:05` 检查上一自然日，启动时也会补跑；归档不需要额外环境变量。CI 与容器冒烟环境显式设置 `HOTSPOT_COLLECTION_ENABLED=false`，不得访问第三方来源。

## GitHub Actions

当前阶段 1 CI 只使用测试专用的本地 PostgreSQL/Redis 连接信息，不配置生产 Secret。以下生产 Secret 延后到阶段 6：

生产 Environment Secret 计划包含：

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `GHCR_PULL_TOKEN`，仅在服务器不能使用标准 GHCR 登录方式时配置

应用运行 Secret 保存在服务器受限环境文件中，不通过 Docker 镜像构建参数写入镜像。

## 生产 Compose 环境文件

服务器 `/opt/kagura-blog/.env` 至少包含：

- `WEB_IMAGE` 与 `WORKER_IMAGE`，通常为 `ghcr.io/kagula-light/kagura-blog-web:sha-<sha>` 和 `ghcr.io/kagula-light/kagura-blog-worker:sha-<sha>`。
- `WEB_BIND`，无域名预览可临时使用 `0.0.0.0:3080`；正式环境应由宝塔 Nginx 代理到本机端口。
- `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`。
- Web、Worker、认证、Turnstile、R2、看板娘和热点变量。

无域名 HTTP 预览时，`APP_URL` 可临时设为 loopback 地址以通过生产安全校验；正式上线必须改为 HTTPS 域名，并重新验证登录、注册、媒体上传和 SEO 输出。

## 校验规则

- 缺少必需变量时服务直接启动失败。
- 生产模式禁止 HTTP `APP_URL`，本地地址除外。
- 生产模式禁止使用示例 Secret。
- R2 公开桶与备份桶不得相同凭据全权限复用。
- Worker 启用来源时必须存在相应必要配置。
- 日志只输出变量名称和校验错误，不输出变量值。
