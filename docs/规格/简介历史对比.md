---
feature: bio-diff-history
status: delivered
updated: 2026-09-30
branch: feat/bio-diff-history
commits: 493abb7e..f8126cce
---

# Bio Diff History（简介历史多版本行级对比）

## Report

**What was built** — 简介区新增「简介历史」对话框（`BioHistoryDialog.vue`）：History 按钮打开后从 `feed_bio` 记录重建时间升序的简介版本链（去重、追加实时简介为"当前"版本），任选两个版本以 git 风格三列（旧行号 | 新行号 | +/-）渲染行级 diff，红绿行底色与应用现有 diff 配色一致。纯函数 `src/shared/utils/bioDiff.js`（`buildBioVersions` + `computeLineDiff`，LCS 行级算法，无新依赖）配 14 项单测。原内联词级 diff 的开关迁移到新增的独立 Diff 图标按钮，`loadBioDiff`/`formatDifference`/Feed 视图均未改动；i18n 三语言（en/zh-CN/zh-TW）各新增 8 个 key。

**Verification** — `npx vitest run src/shared/utils/__tests__/bioDiff.test.js src/views/Feed/__tests__/columns.test.js` → 16/16 PASS。`npm test` 全量 → 155 failed/136 errors，与基线 493abb7e 主检出完全一致（PRE-EXISTING），新增 14 测试全过、零回归。`npm run lint` → 38 errors 全部位于未改动文件（PRE-EXISTING），改动文件零报错。`npm run typecheck:js` 脚本在基线即不可用（`tsc` 未安装于依赖，PRE-EXISTING），改用 `npx typescript@5.9.3 tsc -p tsconfig.checkjs.json` → 207 errors 全部 pre-existing，改动文件 0 错误。三份 locale JSON key 集合核对：8 个新 key 齐全。独立评审子代理结论 APPROVE（4 MINOR，其中 2 个已修复并复验）。未做真机 UI 走查（需运行中的 Tauri 应用与登录态数据）。

**Journey log** —
1. `npm ci` 因 lockfile/package.json 不同步失败（pre-existing）→ 改用 junction 共享主检出 node_modules，避免改 lockfile。
2. 仓库未安装 `typescript` 依赖，`typecheck:js` 基线即失败 → 用 `npx -p typescript` 临时运行，不污染依赖。
3. 全量 `npm test`/`lint` 基线即红 → 一律与主检出 493abb7e 的计数对比判定回归，不看绝对值。
4. 评审 4 MINOR 中：loadVersions 缺 try/catch 与空状态渲染空 Select 已修复；硬编码色值与 `x-text-added/removed` 现有风格一致，按本地惯例保留。

## [S1] Problem

当前简介 diff 只有单次词级对比：`UserDialogInfoTabJirai.vue` 的 `loadBioDiff()` 取最近的 bio 变更记录算一个基线，与当前简介做词级高亮。用户无法浏览多次历史变更、任选两个版本比对，也看不到 git 风格的整行 `+`/`-` 增删。数据库 `feed_bio` 表已经在每次检测到变更时保存 `(bio, previous_bio, created_at)`，多版本数据已存在但未被利用。

## [S2] Design

Grill 已确定的产品决策：

1. 新增「简介历史」对话框，由简介区现有 History 按钮打开，按时间列出已记录版本，任选两个版本对比。
2. 版本数据从 `<prefix>_feed_bio` 重建（复用 `database.getRecentBioChangesForUser(userId, 50)`），**不做 schema 变更**。
3. 行级 `+`/`-` diff 只用于新对话框；简介区内联词级高亮 diff（`formatDifference`）保持现状，Feed 视图不受影响。
4. History 按钮改为打开对话框；内联 diff 的开/关挪到简介区新增的独立 ghost 按钮（原 `toggleBioDiff` 行为与 `bio_diff_enabled` 状态语义不变）。

### 版本链重建（`buildBioVersions`）

- 输入：`getRecentBioChangesForUser` 返回的记录（按 id 降序），以及可选的当前实时简介。
- 转为升序后：第一条记录的 `previous_bio` 作为最早版本 V0；随后每条记录的 `bio` 若与上一版本文本不同（`null` 视为 `''`，精确字符串比较）则追加为新版本；连续相同文本去重。
- 时间戳：V0 取第一条记录的 `createdAt`（其被替换的时间，语义为"最迟在该时刻已存在"）；其余取对应记录的 `createdAt`。
- 当前实时简介若非空且与最后版本不同，追加为标记为"当前"的版本。
- 输出：`{ bio, createdAt, isCurrent }[]`，按时间升序。记录为空且无当前简介时返回空数组。

### 行级 diff（`computeLineDiff`）

- 纯函数，放在 `src/shared/utils/bioDiff.js`，不引入新依赖（仓库无 `diff`/`jsdiff` 依赖）。
- 规范化换行（`\r\n`/`\r` → `\n`）后按行拆分；先裁掉公共前缀/后缀行，再对中间段做 LCS DP（简介行数很小，O(n·m) 可接受）。
- 返回操作数组：`{ type: 'equal' | 'del' | 'add', text, oldLine, newLine }`（不存在的一侧为 `null`，行号从 1 开始）。
- 不返回 HTML：由 Vue 模板以文本插值渲染，天然转义。

### 对话框 UI（`BioHistoryDialog.vue`）

- 位置：`src/components/dialogs/UserDialog/BioHistoryDialog.vue`，沿用同目录 `EditNoteAndMemoDialog.vue` 的模式：`visible` prop + `update:visible` emit，`@/components/ui/dialog` 组件，`x-dialog` 样式类。
- 入参：`visible`、`userId`、`currentBio`。打开时加载版本列表。
- 版本选择：两个下拉（旧版本 / 新版本），选项为版本时间标签（"当前"标记实时简介）。默认：新版本 = 最后一个版本，旧版本 = 其前一个（仅一个版本时二者相同）。
- diff 渲染：git 风格三列 —— 旧行号 | 新行号 | 内容，行首标记 `-`/`+`；删除行红底、新增行绿底、相同行普通；等宽字体，完整显示（简介短，不做 hunk 截断），容器限高可滚动。
- 空状态：无记录时显示空提示文案。

### 简介区接线（`UserDialogInfoTabJirai.vue`）

- History 按钮：`aria-label` 用新 i18n key，点击打开 `BioHistoryDialog`（本地 `visible` ref）。
- 新增 ghost 按钮：承载原 `toggleBioDiff` 逻辑，启用时 `variant="secondary"`，`aria-label` 沿用 `dialog.user.info.bio_diff_toggle`。图标选用 lucide 现有的 diff 类图标（实现时从 `lucide-vue-next` 确认可用图标，如 `Diff` / `FileDiff`）。
- `loadBioDiff()`、`formatDifference` 调用、watch 逻辑均不改。

### i18n

`en` / `zh-CN` / `zh-TW` 三份同步新增：对话框标题、两个选择器标签、"当前"版本标签、空状态文案、History 按钮 aria-label；沿用现有 `bio_diff_toggle`。

### 测试边界

- `buildBioVersions` 与 `computeLineDiff` 为纯函数，用 Vitest 单测覆盖（空输入、单记录、链式去重、当前简介追加、CRLF、纯增/纯删/混合、行号正确性）。
- 对话框与接线属 UI，靠 lint + typecheck + 现有组件测试兜底；不 mock 数据库做组件级测试。

## [S3] Out of Scope

- 不改数据库 schema、不加迁移、不建新表。
- 不改 Feed 视图展开行的词级 diff、不改 `formatDifference` 本身。
- 不做手动"创建快照"、不做 diff 导出/复制、不加 MCP 暴露。
- 不在内联简介区引入行级渲染。

## Tasks

- [x] T1: 实现 `src/shared/utils/bioDiff.js`（`buildBioVersions` + `computeLineDiff`）及单测 — acceptance: `npx vitest run src/shared/utils/__tests__/bioDiff.test.js` 全绿，覆盖 [S2] 列出的边界（covers: S2 版本链与行级 diff）
- [x] T2: 新建 `BioHistoryDialog.vue` + 三语言 i18n key — acceptance: 打开后列出版本、任选两版本得到带行号的 git 风格 +/- 行渲染；三份 locale key 集合一致；`npm run lint`、`npm run typecheck:js` 通过（covers: S2 对话框与 i18n; depends: T1）
- [x] T3: `UserDialogInfoTabJirai.vue` 接线：History 按钮开对话框、新增独立 toggle 按钮 — acceptance: History 打开对话框；toggle 按钮切换内联词级 diff 且 secondary 态正确；`npx vitest run` 受影响测试 + lint + typecheck 通过（covers: S2 按钮拆分; depends: T2）
