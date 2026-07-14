# 文档索引

本目录是“神乐的无月之境”的长期知识库。`README.md` 负责项目入口，本文件负责把读者路由到具体主题。

## 先读

1. [完整设计规格](superpowers/specs/2026-07-10-kagura-blog-design.md)
2. [路线图](roadmap.md)
3. [AI 上手指南](ai-onboarding.md)
4. [系统架构](architecture.md)
5. [领域模型](domain-model.md)

## 产品与设计

- [功能范围](features.md)：公开博客、互动、后台和热点流程。
- [UI 设计](ui-design.md)：品牌、参考映射、响应式和动效规则。
- [Live2D 看板娘](live2d-mascot.md)：运行时选型、加载策略、授权、安全和验收。
- [领域模型](domain-model.md)：术语、实体、状态机和业务约束。
- [路线图](roadmap.md)：实施顺序、依赖和阶段退出条件。

## 工程

- [系统架构](architecture.md)：模块、依赖方向、数据流和目录结构。
- [本地开发](development.md)：环境、命令、迁移和工作方式。
- [配置](configuration.md)：环境变量、密钥和外部服务。
- [测试](testing.md)：测试矩阵、命令和验收标准。

## 生产

- [部署](deployment.md)：GitHub Actions、GHCR、Docker Compose 和宝塔 Nginx。
- [运维](operations.md)：监控、备份、恢复、回滚和巡检。
- [安全](security.md)：认证、授权、上传、采集和服务器加固。
- [每日热点](hotspots.md)：来源、规范化、审核、归档和故障隔离。

## 决策记录

- [ADR-0001：模块化单体](decisions/0001-modular-monolith.md)
- [ADR-0002：自托管账号与权限](decisions/0002-auth-and-permissions.md)
- [ADR-0003：热点候选审核流水线](decisions/0003-hotspot-review-pipeline.md)
- [ADR-0004：Live2D 看板娘运行时](decisions/0004-live2d-widget.md)

## 设计与实施

- `docs/superpowers/specs` 保存已确认设计。
- [阶段 1 工程基础实施计划](superpowers/plans/2026-07-10-phase-1-engineering-foundation.md) 保存脚手架、健康检查、容器和 CI 的原子任务。
- [阶段 2A 身份与权限实施计划](superpowers/plans/2026-07-13-phase-2a-identity-permissions-admin-bootstrap.md) 保存身份 schema、会话、权限、管理员 bootstrap 和受保护后台入口的文件级任务。
- [阶段 2B 内容核心实施计划](superpowers/plans/2026-07-14-phase-2b-content-core.md) 保存文章、修订、媒体、后台发布闭环和定时发布的文件级任务。
- 后续阶段在前置契约稳定后各自生成独立计划，不把整个 V1 塞进一份不可维护的总计划。

实施计划必须引用真实文件、实际命令和可验证的完成标准。在脚手架建立前，不得编造不存在的命令或文件。

阶段 1 已完成：提交 `4939d95` 的 GitHub Actions `quality` 与 `container-smoke` 已通过。阶段 2A 已完成代码实现、本地非服务检查和 PR #1 CI，仍等待目标服务器隔离环境验收；阶段 2B 文章与媒体计划已创建，代码尚未实施。

## 文档状态规则

- 文档描述“当前行为”时必须与代码一致。
- 尚未实施的内容必须明确标注为规划，不得写成已完成。
- 关键决策变更通过新 ADR 记录，不覆盖历史动机。
- 文档不得包含生产密钥、服务器密码或可复用会话信息。
