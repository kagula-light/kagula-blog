# 本地开发

当前仓库已创建应用脚手架，实际命令以根目录 `package.json` 为准。

## 前置条件

- Git。
- Node.js `22.23.1`。
- pnpm `11.11.0`。
- Docker Desktop 或兼容 Docker Engine。
- 可运行 Chromium 的 Playwright 环境。

## 环境真值

用户已明确要求运行状态以目标服务器为准。本机不得启动 PostgreSQL、Redis、Web、Worker 或 Docker 服务替代服务器验证；本机只执行代码编辑、格式、Lint、类型检查等不依赖运行服务的检查。

服务器验证必须使用独立的 `kagura-blog-*` Compose 项目、网络、容器和卷，不得复用或修改现有 `sub2api`、PostgreSQL、Redis、宝塔或全局 Nginx。源码构建仍在 CI 完成，目标服务器只拉取和运行构建产物。

Node 和 pnpm 版本在脚手架提交中固定，不依赖开发者机器的隐式版本。

## 当前启动流程

~~~bash
corepack enable
pnpm install
pnpm infra:up
pnpm --filter @kagura/database db:migrate
pnpm dev
~~~

`infra/docker/compose.dev.yml` 使用固定项目名 `kagura-blog-dev`，服务端口仅绑定回环地址：PostgreSQL `55432`、Redis `56379`、MinIO API `59000`、MinIO Console `59001`。不要连接或复用机器上其他项目的 PostgreSQL/Redis。

`pnpm infra:up` 和 `pnpm infra:down` 只管理该独立项目。开发卷 `kagura-blog-dev-postgres`、`kagura-blog-dev-redis`、`kagura-blog-dev-minio` 是可丢弃的本地/验证数据，不得在生产环境复用。

本地开发使用：

- PostgreSQL 容器。
- Redis 容器。
- S3 兼容的本地对象存储替身，或显式配置的开发 R2 桶。
- Web 与 Worker 本地进程。

开发环境不得连接生产数据库、生产 Redis 或生产 R2 桶。

## 当前命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 并行启动 Web 与 Worker 开发进程 |
| `pnpm lint` | Lint 全工作区 |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:integration` | 容器化集成测试 |
| `pnpm test:e2e` | Playwright 核心流程 |
| `pnpm build` | 生产构建 |
| `pnpm --filter @kagura/database db:generate` | 生成迁移草案 |
| `pnpm --filter @kagura/database db:migrate` | 应用迁移 |
| `pnpm --filter @kagura/worker migrate` | 运行 Worker 迁移入口 |
| `pnpm --filter @kagura/worker seed:admin` | 在源码环境执行一次性管理员 bootstrap |
| `pnpm --filter @kagura/worker seed:admin:runtime` | 在 Worker 构建产物中执行管理员 bootstrap |
| `pnpm containers:smoke` | 构建并验证隔离生产形态容器 |

Playwright 使用 Web standalone 产物，运行 `pnpm test:e2e` 前先运行 `pnpm build`。

## 环境变量

1. 从仓库提供的示例环境文件创建本地环境。
2. 使用配置模块统一解析和校验。
3. Web 与 Worker 只读取自己声明的变量。
4. 测试使用独立数据库和桶前缀。

完整变量见 `configuration.md`。

## 数据库工作流

- schema 只在 `packages/database` 修改。
- 每次 schema 变化生成版本化迁移。
- 迁移提交必须包含向前应用测试。
- 破坏性变化使用 expand/contract：先增加兼容结构，再迁移数据，最后删除旧结构。
- 不手工修改已经在共享环境执行过的迁移。
- 种子数据只创建开发所需的最小样本。

## 初始管理员

生产管理员通过一次性 CLI 创建：

- 只临时读取 `DATABASE_URL`、`ADMIN_USERNAME`、`ADMIN_DISPLAY_NAME` 和 `ADMIN_PASSWORD`。
- 密码必须通过不回显、不写入 Shell 历史的环境注入提供。
- 无管理员时创建首个 ACTIVE ADMIN；同一规范化用户名的唯一 ADMIN 再次执行会轮换凭据并恢复 ACTIVE 状态。
- 已存在另一管理员、用户名属于 USER 或数据库存在多个 ADMIN 时拒绝执行。
- 命令使用 PostgreSQL advisory transaction lock，创建/轮换均写审计日志，日志不输出用户名、密码、哈希或数据库 URL。

## React 工作流

- 默认从 Server Component 开始。
- 只有浏览器交互边界使用 `use client`。
- 组件 Props 使用只读接口。
- 共享业务逻辑放在功能模块，不放入展示组件。
- 服务端状态不使用客户端 `useEffect` 拉取。
- 多个 TSX 文件完成后执行 React 最佳实践检查。

## 热点适配器开发

- 每个来源实现统一接口。
- 将真实响应清理后保存为版本化测试样本。
- 测试不得实时调用第三方站点。
- 解析失败必须返回来源级错误，不抛出包含完整响应正文的日志。
- 新来源需要更新 `hotspots.md`。

## 分支与提交

- 功能在短生命周期分支完成。
- Pull Request 必须通过 CI。
- 迁移、契约和调用方尽量在同一变更中提交。
- 提交前更新受影响文档。
- 不提交构建产物、浏览器缓存、数据库卷或密钥。
