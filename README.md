# AI考研 · 轻量答题

面向 MBA 管理类联考和英语二日常测试的轻量答题网站。项目以手机浏览器为主，不需要账号、数据库或任何 AI API；默认数据保存在当前浏览器，也可在 Vercel 部署后用一组简单数字在手机和电脑之间同步。

## 已实现功能

- 首页试卷列表、科目/题量/满分/建议用时和作答状态
- 从 `public/exams` 自动加载内置试卷，以及从页面导入本地 JSON
- 运行时 JSON 校验和明确的中文错误提示
- 考试说明、逐题作答、自动保存、倒计时、已用时间、逐题用时
- 刷新或关闭页面后恢复答案、题号、标记和计时
- 英语阅读一篇文章对应多题，原文可固定显示、展开或收起
- 答题卡区分已答、未答、标记和当前题，可点击跳转
- 交卷前显示未答题和标记题数量
- 单项选择题自动评分，并按模块、知识点、难度统计
- 成绩详情、全部/错题/标记筛选、错题重测、整卷重做
- 错题原因记录、历史成绩详情与删除
- JSON、TXT、CSV 三种结果导出
- 学习日报支持按当前填写或全部记录导出 TXT、CSV、JSON，方便 ChatGPT 总结、Excel 统计和完整备份
- PWA 安装与离线预缓存
- 可选的手机与电脑同步：使用 4 至 6 位数字同步码，不需要注册账号
- `multiple_choice`、`fill_blank`、`translation`、`essay` 数据与作答入口预留（暂不自动评分）

## 项目目录

```text
AI-KAOYAN-EXAM/
├── public/
│   ├── exams/                 # 内置试卷与索引
│   ├── exam.schema.json       # JSON Schema
│   └── pwa-*.png              # PWA 图标
├── src/
│   ├── lib/                   # 校验、存储、评分、导出、格式化
│   ├── types/                 # TypeScript 数据类型
│   ├── App.tsx                # 页面与完整考试流程
│   ├── main.tsx
│   └── styles.css             # 手机优先样式
├── docs/plans/                # 架构设计与实施计划
├── vite.config.ts             # Vite 与 PWA 配置
└── package.json
```

## 本地运行

建议使用 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

浏览器访问终端显示的地址，通常为 `http://localhost:5173`。

生产构建和本地预览：

```bash
npm run build
npm run preview
```

运行测试：

```bash
npm test
```

也可以使用 pnpm：`pnpm install && pnpm dev`。

## 添加新试卷

### 方法一：随项目发布

1. 复制一份示例 JSON，例如 `public/exams/logic-sample-001.json`。
2. 修改 `examId`，确保它与其他试卷不重复。
3. 将文件保存到 `public/exams/`。
4. 把文件名加入 `public/exams/index.json` 数组。
5. 重新运行或构建项目。

### 方法二：浏览器本地导入

打开网站的“导入”页，选择 `.json` 文件。校验通过后，试卷会保存在当前浏览器中；删除本地导入卷不会删除已有历史成绩。

## JSON 字段说明

完整机器可读定义见 [`public/exam.schema.json`](public/exam.schema.json)，TypeScript 定义见 [`src/types/exam.ts`](src/types/exam.ts)。

### 试卷字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `examId` | string | 试卷唯一 ID，发布后不建议修改 |
| `title` | string | 试卷名称 |
| `subject` | string | 如管综数学、逻辑推理、英语二、综合模拟 |
| `description` | string | 首页与说明页简介 |
| `durationMinutes` | number | 建议考试分钟数，也是倒计时上限 |
| `totalScore` | number | 标称总分 |
| `version` | string | 试卷数据版本 |
| `sections` | array | 模块数组 |

### 模块字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sectionId` | string | 模块唯一 ID |
| `title` | string | 模块名称 |
| `passage` | string | 可选；英语阅读原文，同一模块下题目共享 |
| `questions` | array | 题目数组 |

### 题目字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全卷唯一题目 ID |
| `type` | string | `single_choice` 等题型 |
| `category` | string | 统计模块，例如形式逻辑、阅读理解 |
| `knowledgePoint` | string | 知识点 |
| `difficulty` | string | 建议使用基础、中等、困难 |
| `score` | number | 本题分值 |
| `question` | string | 题干 |
| `options` | array | 选择题选项，key 支持 A 至 E |
| `correctAnswer` | string/array | 单选为字母，多选预留为字母数组 |
| `explanation` | string | 交卷后的解析 |

第一版正式自动评分仅支持 `single_choice`。其他题型会保存答案，并在结果中显示为“不评分”。

## 本地保存与设备同步

当前统一存储版本为 `1`，各类数据使用独立 key：

```text
ai-kaoyan:storage-version
ai-kaoyan:v1:imported-exams
ai-kaoyan:v1:exam-progress
ai-kaoyan:v1:exam-history
ai-kaoyan:v1:error-reasons
ai-kaoyan:v1:settings
```

历史结果中保存了试卷快照，因此删除本地导入的试卷后仍可查看旧成绩。升级数据结构时应提高 `STORAGE_VERSION` 并增加迁移逻辑。

默认情况下所有数据只保存在当前浏览器。若已按下文配置 Vercel Blob，可在“设置”页输入一组 4 至 6 位数字同步码：第一台设备会创建云端副本，另一台设备输入相同数字后会下载该副本；之后导入试卷、答题进度、成绩和错题原因会自动上传。同步码非常简单，只适合不敏感的练习数据；请勿使用生日、手机号后几位等容易猜到的数字。首次在另一台设备连接时，云端数据会覆盖那台设备原有的本地练习数据。

## 部署到 Vercel

1. 将项目推送到 GitHub。
2. 在 Vercel 新建项目并选择仓库。
3. Framework Preset 选择 Vite。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。
6. 点击 Deploy。

应用使用 Hash 路由，不需要额外 rewrite 配置。

### 启用手机与电脑同步（可选）

同步功能仅在 Vercel 可用，GitHub Pages 仍可正常离线答题，但不提供跨设备同步。

1. 打开 Vercel 项目的 **Storage**，选择创建 **Blob** 存储。
2. 保持该 Blob 存储为私有并连接到本项目。Vercel 会自动添加 `BLOB_READ_WRITE_TOKEN` 环境变量。
3. 重新部署一次项目。
4. 在电脑的“设置”页输入一组 4 至 6 位数字；手机打开同一网址后输入相同数字即可下载数据。

Blob 存储可能随使用量产生费用，请在 Vercel 控制台留意用量。同步服务不建立用户账户，也不用于保存敏感资料。

## 部署到 GitHub Pages

在仓库 Settings → Pages 中选择 GitHub Actions，然后添加 `.github/workflows/deploy.yml`：

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build -- --base=/${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

如果仓库没有提交 `package-lock.json`，将 `npm ci` 改为 `npm install`。

## PWA 与离线使用

生产构建会生成 `manifest.webmanifest`、`registerSW.js` 和 `sw.js`。使用 HTTPS 部署后，用手机浏览器打开一次，再从浏览器菜单选择“添加到主屏幕”。首次访问后，应用外壳、示例试卷和静态资源会被预缓存；本地导入试卷本身保存在 localStorage。

开发模式不会完整模拟 service worker，请用 `npm run build && npm run preview` 检查 PWA。

## 常见问题

**导入时提示格式错误**  
优先查看提示中的字段路径，再对照 Schema 或示例。常见原因是漏写 `score`、单选题没有 `correctAnswer`、题目 ID 重复或 JSON 末尾多了逗号。

**换手机后成绩不见了**  
未开启同步时，数据只在原浏览器。若已经部署并配置 Vercel Blob，请在两台设备的“设置”中输入相同同步码；重要结果仍建议定期导出 JSON 备份。

**清除浏览器数据后能恢复吗**  
不能。无服务器方案下，清除当前站点的 localStorage 会删除导入卷、进度和成绩。

**为什么开发环境没有“安装到桌面”提示**  
PWA 安装通常需要 HTTPS 或 localhost，并以生产构建运行。请用 preview 或部署后的地址测试。

**GitHub Pages 打开后资源 404**  
确认构建命令传入了仓库子路径：`--base=/仓库名/`，并重新部署。

## 后续扩展建议

按维护成本从低到高建议：

1. 增加“全部数据备份/恢复”文件，方便换设备。
2. 为多选题实现部分或全对评分规则。
3. 增加每日正确率与用时趋势图。
4. 增加限时模块练习和随机错题组卷。
5. 增加同步冲突提示，适合两台设备同时作答的场景。

## 当前限制

- 只有单项选择题自动评分。
- 跨设备同步需要 Vercel Blob；同步码并非密码，不适合敏感数据。
- 不包含在线 AI 调用；导出结果后可手动交给 ChatGPT 分析。
- 浏览器隐私模式或系统清理可能删除本地数据。
