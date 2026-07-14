# 系统架构

本文同时描述已实现基础和 V1 目标架构。当前已有 Web、Worker、共享包、阶段 2A 身份/权限和阶段 2B 内容核心；互动、热点和 Live2D 目录仍是后续实施目标。

## 架构目标

- 用一个主要代码库交付公开博客、用户中心、后台和热点采集。
- 保持模块边界，使未来拆分 Worker 或 API 时不需要重写业务规则。
- 在 2 核、约 2 GB 内存的服务器上与现有 Docker 服务共存。
- 将构建压力放到 GitHub Actions，服务器只运行镜像。
- 所有外部依赖通过可替换接口接入。

## 系统上下文

~~~mermaid
flowchart LR
    Visitor["访客或登录用户"] --> Nginx["宝塔 Nginx"]
    Admin["管理员"] --> Nginx
    Nginx --> Web["Next.js Web"]
    Web --> DB["PostgreSQL"]
    Web --> Redis["Redis"]
    Web --> R2["Cloudflare R2"]
    Worker["热点与定时任务 Worker"] --> DB
    Worker --> Redis
    Worker --> Sources["热点来源"]
    Actions["GitHub Actions"] --> GHCR["GHCR"]
    GHCR --> Compose["生产 Docker Compose"]
    Compose --> Web
    Compose --> Worker
~~~

## 运行单元

### Web

一个 Next.js App Router 应用，包含：

- 公开博客和 SEO 页面。
- 登录、注册和用户中心。
- 管理后台。
- 面向浏览器的 API 与 Server Actions。
- 权限入口、数据查询和文件上传协调。

Web 默认使用 Server Components。欢迎场景、Live2D 看板娘、轮播、Markdown 编辑器、目录抽屉和互动按钮等需要浏览器状态的部分使用 Client Components。

当前认证路径由 Server Actions 调用登录用例，Drizzle repository 持久化摘要会话，Redis 只记录失败预算。文章和媒体管理由服务端权限策略、事务 repository 和 Server Actions 组成；`/admin` 布局在服务端解析 Cookie 并重新读取用户状态，只有登录表单、文章编辑器和媒体上传表单是 Client Components。

Live2D 运行时位于独立客户端边界内。服务端先输出静态海报和稳定占位，浏览器在首屏完成后动态导入 `l2d-widget`。模型、纹理、动作和表情从自有 R2 资源域加载；加载失败时保留静态海报，不影响其他页面能力。

### Worker

Worker 使用与 Web 相同的领域契约，但不依赖 React：

- 采集五个热点来源。
- 规范化、去重和保存候选。
- 执行定时发布。
- 创建北京时间每日归档。
- 清理过期会话、失败任务和临时上传。

任务必须幂等。重复执行不得产生重复公开热点或重复发布。

当前 Worker 每 60 秒锁定并发布到期文章；状态条件、版本递增、修订和审计写入同一 PostgreSQL 事务，重复执行不会再次发布。

### PostgreSQL

PostgreSQL 是业务事实的唯一持久化来源：

- 用户、凭据、会话和状态。
- 文章、修订、分类、标签和互动。
- 热点候选、审核和归档。
- 站点设置与审计日志。

### Redis

Redis 只保存可丢失或可重建的数据：

- 限流计数。
- 短期缓存。
- 任务锁和去重窗口。
- 可重试任务队列状态。

任何核心业务事实都不得只存在 Redis。

### Cloudflare R2

- 公开图片和头像使用资源桶。
- 数据库备份使用独立备份桶与独立凭据。
- 数据库只保存对象键、元数据、所有者和状态。
- 浏览器不持有具有删除任意对象能力的长期密钥。

## 目录

~~~text
apps/
  web/
    public/
    src/
      app/
        (public)/
        (auth)/
        account/
        admin/
        api/
      components/
        auth/
        site/
        article/
        hotspot/
        admin/
        ui/
      features/
        auth/
        posts/
        comments/
        users/
        reactions/
        hotspots/
        media/
        mascot/
      server/
        auth/
        permissions/
        storage/
        cache/
        observability/
      data/
      styles/
  worker/
    src/
      adapters/
      jobs/
      scheduler/
packages/
  auth/
  database/
  contracts/
  config/
infra/
  docker/
  nginx/
  scripts/
~~~

## 依赖方向

- `app` 可以组合 `components` 和 `features`。
- `components` 可以使用稳定 UI 原语和显式传入的数据，不直接访问数据库。
- `features` 包含用例、校验、查询和业务规则。
- `features/mascot` 封装看板娘加载、偏好和运行时生命周期；其他组件不得直接调用第三方全局 API。
- `server` 提供认证、权限、存储、缓存和日志基础设施。
- `worker` 依赖共享契约和数据库包，不依赖 Web 页面或 React 组件。
- `packages/contracts` 不依赖任何应用。
- `packages/database` 不导入 React 或路由代码。
- `packages/auth` 只提供密码、用户名和会话 Token 原语，不读取 Next.js Cookie 或数据库。

禁止循环依赖。跨功能协作通过显式用例或共享领域标识完成，不通过组件互相调用内部模块。

## 主要数据流

### 发布文章

1. 管理员提交 Markdown、元数据和媒体引用。
2. 服务端校验权限、slug、分类和媒体所有权。
3. 事务中保存文章和修订记录。
4. 立即发布或由 Worker 在计划时间执行。
5. 发布后触发相关缓存失效、RSS 和站点地图更新。
6. 操作写入审计日志。

### 提交评论

1. 登录用户提交评论。
2. 服务端检查会话、用户状态、限流和内容规则。
3. 评论以 `PENDING` 保存。
4. 管理员审核为 `APPROVED` 或 `REJECTED`。
5. 只有 `APPROVED` 评论进入公开查询。

### 采集热点

1. 调度器为每个启用来源创建独立任务。
2. 适配器在超时和响应大小限制内获取来源。
3. 规范化层生成统一候选记录。
4. 数据库按来源标识、链接和标题指纹去重。
5. 管理员审核候选。
6. 批准项进入当前热榜，并在北京时间日界线归档。

### 生产自动部署

阶段 1 只运行 CI、镜像构建和健康冒烟检查。以下生产链路在阶段 6 验证迁移、备份、健康检查、回滚和受限部署用户后启用：

1. Pull Request 运行静态检查、测试和构建。
2. 合并 `main` 后构建 Web 与 Worker 镜像。
3. 镜像以提交 SHA 标记并推送 GHCR。
4. 部署用户拉取镜像并运行一次性数据库迁移。
5. Compose 启动新版本。
6. 就绪检查通过后切换完成；失败则恢复上一个 SHA。

## 资源约束

- 不在生产服务器执行 `next build`。
- Web、Worker、PostgreSQL 和 Redis设置明确内存限制。
- PostgreSQL 连接池按单实例和低并发配置。
- Worker 限制并发，每个来源最多一个活动采集任务。
- 大图在上传后生成响应式尺寸和现代格式。
- Canvas 粒子在移动端降级，在减少动画模式下停用。
- Live2D 不进入首屏关键资源；移动端和减少动画模式默认不自动下载模型。

## 可观测性

- 所有服务输出结构化日志，包含请求或任务关联 ID。
- 健康检查分为存活与就绪。
- Worker 记录来源最后成功时间、耗时和失败原因。
- 部署日志记录镜像 SHA、迁移版本和回滚结果。
- 日志不得包含密码、Token、完整 Cookie 或 R2 Secret。

## 未来拆分条件

只有出现以下信号才考虑拆分独立 API 或更多服务：

- Worker 资源长期影响 Web 延迟。
- 多个客户端需要稳定公共 API。
- 团队边界要求独立发布。
- 单体部署频率成为明确瓶颈。

V1 不为假设性规模提前引入微服务。
