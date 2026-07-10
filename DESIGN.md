<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->
---
name: 神乐的无月之境
description: 神乐静无月的无月星空技术与随笔空间
---

# Design System: 神乐的无月之境

## Overview

**Creative North Star: "无月星图书库"**

设计像深夜独自进入一座悬浮于无月星空中的私人书库：银发守望者、漂浮书页和短暂亮起的代码符文先建立世界，随后主动退到内容之后。它不是通用二次元模板，也不是套上角色图片的技术门户。

公开首页允许一次编排完整的欢迎场景，文章与搜索页面则收紧节奏，让排版、层级和阅读状态成为主角。管理后台使用同一品牌标识，但切换为 product register：更紧凑、更直接，不继承公开站点的沉浸式表演。

本系统明确拒绝营销式 SaaS 首页、同尺寸卡片堆砌、默认玻璃拟态和无意义的滚动淡入。看板娘与动效必须帮助建立陪伴感或解释状态，不能成为覆盖内容的悬浮广告。

**Key Characteristics:**

- 首屏沉浸，正文克制。
- 原创角色与内容语气一致。
- Full palette，每个色彩角色具有明确职责。
- 欢迎动效经过编排，内容动效只响应状态。
- 桌面有空间层次，移动端优先阅读净空。

## Colors

颜色策略为 Full palette：纯中性黑承载空间，绿色符文光作为主品牌锚点，蓝紫星光与有限的品红魔法作为不同职责的辅助角色。精确 OKLCH 值在实现阶段通过对比度验证后固化。

### Primary

- **符文苔光**（绿色锚点，[to be resolved during implementation]）：用于主操作、当前导航、看板娘可交互提示和少量符文状态。主色保持在 Impeccable seed 150° 附近，不铺满正文表面。

### Secondary

- **无月星紫**（蓝紫色，[to be resolved during implementation]）：用于欢迎场景星光、目录当前章节和品牌插画中的冷光。

### Tertiary

- **静月品红**（品红色，[to be resolved during implementation]）：用于少量情感反馈、收藏状态和角色魔法细节，不承担所有主操作。

### Neutral

- **绝对夜幕**（纯中性近黑，[to be resolved during implementation]）：页面背景，不加入蓝紫色偏色。
- **深空表面**（中性深灰，[to be resolved during implementation]）：文章、导航和后台表面。
- **月白正文**（近白，[to be resolved during implementation]）：主要文字，正文对比度至少 7:1。
- **远星灰**（中性灰，[to be resolved during implementation]）：次要信息，对背景对比度至少 4.5:1。

**The Three Lights Rule.** 绿色负责行动，蓝紫负责空间，品红负责情感；禁止将三者混成渐变或互相替代。

**The Neutral Night Rule.** 页面背景保持纯中性黑。神秘感由角色、光效和排版产生，不通过紫黑渐变制造。

## Typography

**Display Direction:** 有授权的中文衬线标题 + 系统衬线回退<br>
**Body Direction:** 人文无衬线正文 + 中文系统字体回退<br>
**Label/Mono Direction:** 清晰等宽字体，仅用于代码、时间、ID 和技术元数据

**Character:** 标题像精装幻想小说的章节扉页，但不使用常见“优雅衬线”训练数据默认字体；正文像长期维护的技术手册，清晰、耐读、没有角色扮演式装饰。

### Hierarchy

- **Display**（中等字重，最大不超过 6rem，紧凑但字距不小于 -0.04em）：只用于欢迎场景站点名。
- **Headline**（中高字重，平衡换行）：文章标题和主要页面标题。
- **Title**（中高字重）：卡片标题、后台面板和对话框标题。
- **Body**（常规字重，宽松行高）：文章正文限制在 65–75ch。
- **Label**（中等字重，正常或轻微字距）：分类、日期、状态和控件标签，不全大写。

**The One Threshold Rule.** 欢迎场景与正文之间只有一次明显的字号阈值；进入内容后不再使用英雄级字号。

**The Mono Earns Its Place Rule.** 等宽字体只用于真实技术信息，禁止把整站做成“开发者终端”造型。

## Elevation

系统使用分层中性色表面建立深度，默认无大面积阴影。导航浮层、目录抽屉、模态框和看板娘对话气泡可以使用短而清晰的结构阴影；普通文章和后台容器依靠色差与间距分层。

欢迎场景可以使用局部辉光、遮罩和景深，但这些效果不进入正文容器。

**The Flat-By-Default Rule.** 静态表面保持平坦。阴影只表达真实覆盖关系或交互状态。

**The No Ghost Card Rule.** 禁止在同一元素上同时使用 1px 装饰边框和宽度超过 8px 的柔软阴影。

## Do's and Don'ts

### Do:

- **Do** 让欢迎场景成为唯一完整编排的首屏，并在同一会话只播放一次。
- **Do** 在内容默认可见的前提下添加动画，动画失败时正文仍然存在。
- **Do** 为每个动画提供 `prefers-reduced-motion` 方案。
- **Do** 将正文行长限制在 65–75ch，并验证桌面、平板和手机。
- **Do** 使用原创或授权清晰的角色、Live2D 模型、背景和字体。
- **Do** 让看板娘可以关闭、休眠和记住用户选择。
- **Do** 在移动端降低粒子和看板娘资源，并确保正文拥有完整可点击区域。
- **Do** 让后台保持紧凑、直接和任务导向。

### Don't:

- **Don't** 做“可替换 Logo 后适用于任何博客的通用二次元模板”。
- **Don't** 复制 Esunmo、Butterfly 或其他站点的代码、品牌、文案和角色素材。
- **Don't** 直接使用动漫截图、游戏角色或授权不清的 Live2D 模型。
- **Don't** 使用营销式 SaaS 首页、大型价值主张和功能推销文案。
- **Don't** 使用同尺寸卡片网格填满页面，也不要嵌套卡片。
- **Don't** 使用玻璃拟态作为默认容器语言。
- **Don't** 让粒子、视差、看板娘或页面转场遮挡正文和交互。
- **Don't** 使用渐变文字、装饰性网格背景、夸张圆角和宽软阴影。
- **Don't** 使用大于 1px 的彩色侧边条作为卡片强调。
- **Don't** 将管理后台做成二次元展示页。
- **Don't** 在移动端保留覆盖正文的固定工具栏或看板娘热区。
