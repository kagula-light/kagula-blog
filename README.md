# 神乐的无月之境

“神乐的无月之境”是神乐静无月的个人博客项目。内容以编程、AI 和开发经验为主，也承载个人随笔与每日热点。

项目采用 Next.js 模块化单体架构，公开博客、用户中心、管理后台和 API 位于同一个 Web 应用中；热点采集使用同仓库的独立 Worker。生产环境通过 GitHub Actions、GHCR、Docker Compose 和宝塔 Nginx 部署。

## 当前状态

当前仓库处于“设计已确认、实施尚未开始”的阶段。

- 产品范围、视觉方向、架构、安全边界和部署方式已经确认。
- 本仓库目前只包含设计与交付文档，不包含可运行应用。
- 下一步是在用户审核设计规格后生成原子化实施计划，再开始脚手架和功能开发。
- 不要将文档中描述的能力当作已经实现的代码。

## V1 范围

- 二次元个人博客首页与文章阅读页。
- Markdown 内容管理、图片上传、草稿、定时发布和归档。
- 用户名密码注册登录，`ADMIN` 与 `USER` 两种角色。
- 登录用户点赞、收藏和评论；评论全部先审后发。
- 用户、评论、文章、媒体、热点和站点配置后台。
- GitHub Trending、Hacker News、Bilibili、微博热搜和百度热搜采集。
- 热点候选审核、当前热榜和北京时间每日归档。
- 原创神乐静无月 Live2D 看板娘，提供静态海报回退和用户关闭选项。
- Cloudflare R2 图片存储与数据库备份。
- GitHub Actions 自动测试、构建、部署、健康检查和失败回滚。

V1 不包含邮箱验证、找回密码、社交登录、签到、积分、等级、关注和排行榜。

## 技术方向

| 领域 | 选择 |
| --- | --- |
| Web | Next.js App Router、React、TypeScript |
| UI | Tailwind CSS、Radix/shadcn 风格的可访问交互原语 |
| 数据 | PostgreSQL、Drizzle ORM |
| 缓存与限流 | Redis |
| 文件 | Cloudflare R2 |
| 看板娘 | `l2d-widget` 客户端按需加载、原创 Live2D 模型 |
| 任务 | 独立 Worker、可重试幂等任务 |
| 测试 | 单元测试、集成测试、Playwright |
| 交付 | GitHub Actions、GHCR、Docker Compose |
| 代理 | 现有宝塔 Nginx |

具体依赖版本在脚手架阶段选择当时的稳定版本，并由锁文件固定。看板娘选型与授权边界见 [Live2D 看板娘](docs/live2d-mascot.md)。

## 视觉方向

首页和文章布局参考 [esunmo.com](https://esunmo.com/)，但不复制其代码、品牌或图片。

- 每个浏览会话首次进入时展示全屏欢迎场景。
- 品牌名为“神乐的无月之境”，作者名为“神乐静无月”。
- 原创虚拟形象为银白长发、蓝紫眼睛、深色斗篷的女性角色。
- 场景使用无月星空、漂浮书页、微弱星光和代码符文。
- 欢迎场景结束后，桌面端可按需加载不遮挡正文的 Live2D 看板娘；移动端默认不自动加载。
- 文章页使用桌面双列、移动单列、吸附目录和完整文章元信息。
- 用户减少动画时，所有非必要动画自动停用。

完整规范见 [UI 设计](docs/ui-design.md)。

## 计划目录

~~~text
apps/
  web/        Next.js 公开站点、用户中心、后台和 API
  worker/     热点采集、定时发布和每日归档
packages/
  database/   数据模型、迁移和种子
  contracts/  Web 与 Worker 共享契约
  config/     TypeScript、Lint 和环境配置
infra/
  docker/     生产 Compose
  nginx/      宝塔 Nginx 参考配置
  scripts/    部署、回滚、备份和恢复
docs/         设计、开发、部署和运维文档
~~~

目录设计细节见 [系统架构](docs/architecture.md)。

## 如何接手

人类开发者和 AI 都应先按以下顺序阅读：

1. [AGENTS.md](AGENTS.md)
2. [文档索引](docs/README.md)
3. [完整设计规格](docs/superpowers/specs/2026-07-10-kagura-blog-design.md)
4. [项目路线图](docs/roadmap.md)
5. [AI 上手指南](docs/ai-onboarding.md)

如果仓库仍然没有 `package.json`，说明实施尚未开始，不要假设任何开发命令可用。

脚手架完成后，统一命令预计为：

~~~bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
~~~

实际命令以根目录 `package.json` 和 CI 工作流为准。

## 部署约束

- 目标服务器为 Ubuntu 24.04、2 核 CPU、约 2 GB 内存。
- 服务器已有其他 Docker 服务，必须与博客共存。
- CI 在 GitHub Actions 构建镜像，服务器不得现场构建源码。
- CI 从工程初始化阶段开始；生产 CD 只在迁移、健康检查、备份和回滚链路通过后启用。
- 博客使用独立 Compose 项目、网络、卷、数据库和 Redis。
- 宝塔 Nginx 继续占用 80/443，博客应用只监听内部端口。
- 未经明确授权，不得停止、删除或修改现有非博客服务。

## 安全

不要将密码、SSH 私钥、数据库连接串、R2 密钥、GitHub Token 或生产环境文件提交到仓库。

用户曾在规划阶段共享过服务器 root 密码。该凭据不出现在任何仓库文件中，正式部署前必须轮换，并切换为专用部署用户和 SSH Key。

## 文档

所有项目文档从 [docs/README.md](docs/README.md) 进入。架构或行为变化必须同步更新相应文档和决策记录。
