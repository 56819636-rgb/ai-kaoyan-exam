# AI考研轻量答题网站 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付一个可离线、可导入试卷、可恢复进度并自动评分的手机优先 MBA 答题网站。

**Architecture:** React 单页应用以 HashRouter 管理页面；领域逻辑与 UI 分离，所有本地数据通过带版本号的 storage 模块读写。内置 JSON 试卷由静态索引加载，历史结果保存试卷快照。

**Tech Stack:** React 19、TypeScript、Vite、React Router、Vitest、vite-plugin-pwa、普通 CSS。

---

### Task 1: 初始化与领域模型
- 创建 Vite/TypeScript/PWA 配置、试卷与作答类型。
- 测试：TypeScript 能解析全部配置。

### Task 2: 数据校验、评分与持久化
- 创建 JSON 校验器、统一 localStorage 仓库、评分和统计函数。
- 测试：先编写评分及恢复测试，再实现到全部通过。

### Task 3: 核心考试流程
- 创建首页、导入、说明、答题、答题卡、交卷确认页面。
- 测试：刷新恢复答案与计时；同一 section 的 passage 始终可见。

### Task 4: 结果与复盘
- 创建成绩、筛选复盘、错因、错题重测、历史删除和三格式导出。
- 测试：各维度统计正确，导出包含答案、用时、知识点和错因。

### Task 5: 示例、文档与发布
- 添加三套 5 题原创示例卷、PWA 图标、README 和部署说明。
- 测试：测试套件和 `npm run build` 通过，manifest/service worker 生成。
