# AGENTS.md

本文件是本仓库内所有 AI 和自动化开发者的第一入口。它描述项目当前状态、不可破坏的约束、必读文档和验收规则。

## 当前状态

截至 2026-07-10：

- 设计规格已由用户逐段确认。
- 仓库当前只有文档，应用脚手架尚未创建。
- 详细实施计划需要在用户审核书面规格后生成。
- 在 `package.json`、锁文件和工作流出现前，不要声称项目可以构建或运行。

## React 强制要求

任何涉及 React/Next.js 的规划、脚手架、实现、重构、评审、调试或 UI 工作都必须：

- 使用并遵循 `react:components` 技能。
- 使用并遵循 `react-best-practices` 技能。

这两项是仓库级强制要求。

## 必读顺序

开始任务前，根据范围读取：

1. `README.md`
2. `docs/README.md`
3. `docs/superpowers/specs/2026-07-10-kagura-blog-design.md`
4. `docs/architecture.md`
5. `docs/domain-model.md`
6. 与任务直接相关的专题文档

首次接手建议额外阅读 `docs/ai-onboarding.md` 和 `docs/roadmap.md`。

## 核心事实

- 品牌：神乐的无月之境。
- 作者与虚拟形象：神乐静无月。
- 内容：技术/AI 为主，个人随笔为辅。
- 视觉：参考 `esunmo.com` 的结构和动效，使用原创角色与素材。
- 架构：Next.js 模块化单体 + 独立 Worker。
- 数据：PostgreSQL、Redis、Cloudflare R2。
- 权限：V1 只有 `ADMIN` 和 `USER`。
- 评论：全部先审后发。
- 热点：自动采集候选，管理员审核后公开。
- 看板娘：原创 Live2D 模型，使用 `l2d-widget` 客户端按需加载并保留静态回退。
- 部署：GitHub Actions 构建镜像，服务器拉取并运行。

## 模块边界

- `apps/web` 负责页面、API、权限入口和后台。
- `apps/worker` 负责热点采集、定时发布和归档任务。
- `packages/database` 是数据结构和迁移的唯一来源。
- `packages/contracts` 只放跨应用共享的稳定契约。
- React 页面和组件不得直接拼接 SQL。
- 热点来源差异只能存在于适配器内部。
- R2 SDK 调用只能存在于存储模块内部。
- Live2D 初始化只能存在于聚焦的 Client Component/适配器中，不得进入 Server Components 或阻塞首屏。
- 权限判断必须通过服务端权限策略，不得散落在页面组件中。

## React 规则

- 默认使用 Server Components。
- 只有需要浏览器状态或交互的组件才标记为 Client Component。
- 一个公开组件一个文件，优先命名导出。
- Props 使用就地定义的只读 TypeScript 接口。
- 事件处理和浏览器业务逻辑放入聚焦的自定义 Hook。
- 服务端数据通过 Server Components、Server Actions 或查询模块获取。
- 不在 `useEffect` 中手工同步可推导状态。
- 不默认使用 `useMemo`、`useCallback` 或 `React.memo`。
- 使用语义 HTML、键盘可达控件和明确的焦点状态。
- Next.js 图片使用 `next/image`；装饰图片使用空 alt。
- 避免大范围 barrel exports。

## UI 规则

- 公开站点可使用二次元视觉与动效；后台保持紧凑、安静、工作导向。
- 欢迎场景每个会话只出现一次，并提供跳过。
- 看板娘必须可关闭、记住偏好、失败时显示静态海报；移动端和减少动画模式默认不自动加载。
- 必须支持 `prefers-reduced-motion`。
- 移动端正文不得横向溢出；目录改为抽屉或浮层。
- 不照搬参考站的品牌、代码、动漫角色或受保护素材。
- 原创资产必须记录生成来源、许可证或授权信息。
- Live2D 模型、纹理、动作和表情必须逐项记录权利来源；依赖许可证不等于模型授权。

## 数据与安全规则

- 密码仅使用 Argon2id 哈希。
- 会话 Cookie 必须为 HttpOnly、Secure 和 SameSite。
- 用户状态和会话失效必须在服务端校验。
- Markdown 输出必须清理危险 HTML。
- 上传必须验证文件头、大小、MIME 和调用者权限。
- 外部采集仅允许访问配置白名单中的来源域名。
- 管理员重要操作必须写入审计日志。
- 迁移必须可重复执行，并在应用切换前完成。
- 测试和日志不得输出密钥或完整认证 Cookie。

## 服务器规则

- 目标服务器资源有限，构建必须在 CI 完成。
- 博客必须使用独立 Compose 项目名、网络、卷和容器名。
- 不得复用现有业务的 PostgreSQL 或 Redis。
- 未经用户明确授权，不得修改或停止现有 `sub2api` 及其依赖。
- 未经用户明确授权，不得修改宝塔面板、全局 Nginx、防火墙或 SSH 策略。
- 生产变更前必须有备份、健康检查和回滚路径。

## 命令发现

不要从本文档盲目复制命令。先读取：

- 根目录 `package.json`
- `pnpm-workspace.yaml`
- `.github/workflows`
- `infra/scripts`

如果这些文件尚不存在，说明对应阶段未实施。

## 测试要求

- 领域规则使用单元测试。
- PostgreSQL、Redis 和迁移使用集成测试。
- 热点适配器使用版本化响应样本。
- 核心用户流程使用 Playwright。
- UI 工作需验证桌面、移动端和减少动画模式。
- 权限功能必须测试未登录、普通用户、管理员和封禁用户。
- 完成多个 TSX 文件后执行 React 最佳实践检查。

## 文档同步

下列变化必须更新文档：

- 架构或依赖方向：`docs/architecture.md` 和决策记录。
- 实体或状态：`docs/domain-model.md`。
- 用户可见行为：`docs/features.md`。
- 视觉或交互：`docs/ui-design.md`。
- 环境变量：`docs/configuration.md`。
- 部署或回滚：`docs/deployment.md` 与 `docs/operations.md`。
- 威胁模型或权限：`docs/security.md`。
- 热点来源或解析逻辑：`docs/hotspots.md`。
- 看板娘运行时、模型、交互或授权：`docs/live2d-mascot.md`。
- 测试命令或覆盖范围：`docs/testing.md`。

## 完成定义

任务只有同时满足以下条件才算完成：

- 行为符合已确认设计。
- 类型检查、相关测试和构建通过。
- 权限、安全和失败路径已验证。
- 用户可见界面完成桌面与移动端检查。
- 相关文档同步更新。
- 没有提交密钥、临时文件或生成垃圾。
- 最终说明区分静态验证、自动化测试和真实运行验证。
