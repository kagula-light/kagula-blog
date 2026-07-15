# 领域模型

## 领域词汇

| 术语 | 定义 |
| --- | --- |
| 文章 | 管理员创建并发布的 Markdown 内容 |
| 修订 | 一次可追溯的文章内容快照 |
| 热点候选 | 自动采集或手动录入、尚未公开的热点 |
| 当前热榜 | 已审核且当前有效的公开热点集合 |
| 每日归档 | 按北京时间冻结的某日热点快照 |
| 评论审核 | 管理员决定评论是否公开的流程 |
| 禁言 | 用户仍可登录和阅读，但不能提交评论 |
| 封禁 | 用户不能建立新会话，现有会话失效 |

## 用户与身份

实现状态：`User`、`Credential`、`Session` 与 `AuditLog` 已由迁移 `0001_identity_core.sql` 建表；本节中头像媒体、全部会话管理 UI 等未落字段或用例仍属于后续阶段。

### User

关键字段：

- ID。
- 唯一用户名和展示名称。
- 可空邮箱及验证时间，为未来能力预留。
- 角色：`ADMIN` 或 `USER`。
- 状态：`ACTIVE`、`MUTED` 或 `BANNED`。
- 头像媒体 ID、个人简介。
- 创建、更新和最后登录时间。

约束：

- 用户名按规范化形式唯一。
- V1 角色不是可由普通用户修改的资料字段。
- `BANNED` 用户的所有活动会话立即失效。
- `MUTED` 用户可阅读、点赞和收藏，但不能创建评论。

### Credential

- 与用户一对一。
- 只保存 Argon2id 密码哈希和密码更新时间。
- 不保存原密码、可逆密文或密码提示。

### Session

- 保存不可逆 Token 摘要、用户、过期时间和最后活动时间。
- 支持单会话退出、全部退出和管理员强制失效。
- 封禁检查不能只依赖会话创建时的状态。
- 当前数据库保存 64 位 HMAC-SHA256 Token 摘要；原始 Token 仅进入 HttpOnly Cookie。

## 内容

实现状态：迁移 `0002_content_core.sql`、文章服务、管理动作和 Worker 定时发布已实现；公开文章查询、搜索、互动和最终阅读页仍属于后续阶段。

### Post

关键字段：

- 标题、唯一 slug、Markdown 正文和渲染摘要。
- 手动 AI 摘要字段及摘要来源状态。
- 封面媒体、分类和标签。
- 状态、计划发布时间、实际发布时间和归档时间。
- 阅读时长、SEO 标题、描述和社交分享图。
- 创建者和最后编辑者。

状态：

~~~mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SCHEDULED
    DRAFT --> PUBLISHED
    SCHEDULED --> DRAFT
    SCHEDULED --> PUBLISHED
    PUBLISHED --> ARCHIVED
    ARCHIVED --> PUBLISHED
~~~

规则：

- `SCHEDULED` 必须具有未来发布时间。
- 只有 `PUBLISHED` 进入公开查询、RSS 和站点地图。
- 归档不删除内容，但默认不出现在最新文章流。
- slug 变更需要保留重定向记录，避免旧链接失效。

### PostRevision

- 保存文章正文、标题和关键元数据快照。
- 每次显式保存或发布产生修订。
- 修订不可原地修改。
- 恢复旧修订会创建新修订，不覆盖历史。

### Category 与 Tag

- 一篇文章属于一个主分类。
- 一篇文章可以具有多个标签。
- 分类 slug 和标签 slug 分别唯一。
- 删除被使用的分类或标签前必须重新分配或解除关联。

### MediaAsset

- 保存 R2 对象键、类型、尺寸、哈希、所有者和状态。
- 状态包括 `PENDING`、`READY` 和 `DELETED`。
- 正文引用与封面引用都必须指向 `READY` 资源。
- 删除先软删除数据库记录，再由清理任务延迟删除对象。

## 互动

### Comment

状态：

~~~mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> APPROVED
    PENDING --> REJECTED
    APPROVED --> DELETED
    REJECTED --> DELETED
~~~

规则：

- 只有登录且未禁言、未封禁的用户可以提交。
- V1 所有新评论均为 `PENDING`。
- 只有 `APPROVED` 评论对公众可见。
- 删除为软删除，保留审核与审计信息。
- 评论内容保存纯文本或受限 Markdown，不允许任意 HTML。

### PostLike

- 用户与文章的唯一组合。
- 重复点赞请求保持幂等。
- 取消点赞删除或失活关联。

### Favorite

- 用户与文章的唯一组合。
- 收藏不改变文章公开状态。
- 文章归档后仍可在用户收藏中显示状态。

## 热点

### HotspotSource

- 来源代码、名称、类型和启用状态。
- 抓取间隔、超时和允许域名。
- 最后成功时间、最后失败时间和错误摘要。
- 来源可单独暂停和重试。

### HotspotCandidate

关键字段：

- 来源、外部标识、标题、原始链接和规范化链接。
- 来源排名、采集时间和标题指纹。
- 审核状态：`PENDING`、`APPROVED`、`REJECTED` 或 `EXPIRED`。
- 管理员备注、审核者和审核时间。

规则：

- 同一来源外部标识唯一。
- 无可靠外部标识时，使用规范化链接与标题指纹辅助去重。
- 不存储第三方全文。
- 被拒绝项保留记录，避免短期内重复进入候选池。

### DailyHotspotArchive

- 归档日期按 `Asia/Shanghai` 计算。
- 每个日期只有一个已发布归档。
- 归档项保存当日展示标题、来源、链接和排名快照。
- 后续来源标题变化不修改历史归档。

## 站点与审计

### SiteSetting

- 保存站点名、作者名、介绍、导航、默认媒体和功能开关。
- 设置有明确 schema，不允许任意键值直接控制危险行为。
- 敏感密钥不进入 SiteSetting。

### AuditLog

记录：

- 操作者、动作、资源类型和资源 ID。
- 时间、请求关联 ID 和有限的变化摘要。
- 发布、审核、角色、用户状态和站点设置变更。

当前已写入的动作包括 `ADMIN_BOOTSTRAPPED`、`ADMIN_CREDENTIAL_ROTATED`、文章与媒体生命周期动作、用户与评论治理动作，以及 `HOTSPOT_APPROVED`、`HOTSPOT_REJECTED`、`HOTSPOT_EXPIRED` 和 `HOTSPOT_REORDERED`。

审计日志不可通过普通后台编辑或删除。

## 时间与删除策略

- 数据库存储 UTC 时间。
- 用户界面和热点日界线使用 `Asia/Shanghai`。
- 用户、文章、评论和媒体优先软删除。
- 会话和临时任务按过期时间物理清理。
- 备份保留策略见 `operations.md`。
