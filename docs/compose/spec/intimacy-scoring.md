---
feature: intimacy-scoring
status: delivered
updated: 2026-10-02
branch: feature/intimacy-scoring
commits: 493abb7e..2bfe43b8
---

# 好友亲密度评分模型重设计

## Report

**What was built** — 好友亲密度评分（`useRelationshipScoring`）的三个共位维度
（`onlineOverlap` / `coWorldFrequency` / `consistency`）从「除以全体最大值」的线性
归一化改为稳健归一化：先做 `ln(1+v)` 对数压缩，再除以全体好友对数值的最近秩 90
分位参考值（`index = ceil(0.9*N)-1`），封顶 1；参考值 ≤0 时全员得 0，单好友时
得满分。`recency` 的 90 天指数衰减、四维权重 40/30/20/10、composable 导出与
条目形状、消费组件 `RelationshipIntimacy.vue` 均保持不变。效果是离群高时长好友
不再把其余好友的分数压扁到接近 0，排行与维度条恢复区分度。时间线对比不在本
次范围内，未改动。

交付后同一功能面追加了多轮后续需求（均已完成并合并进 master）：
1. **权重可调节**（`e181dca0`）：四维权重改为 0–100 可调，按权重和归一化合成，
   存 `configRepository`（键 `intimacyWeights`）；全零权重时得 0。
2. **好友排除**（`e181dca0`）：两种语义可切换——完全排除（移出归一化计算集）/
   仅隐藏显示（仍参与计算，仅从排行与分布隐藏）；名单与模式持久化
   （`intimacyExcludedFriends` / `intimacyExcludeMode`），行内排除按钮 +
   名单管理可恢复。
3. **侧边抽屉入口**（`1570defb`）：权重与排除 UI 移入右侧 Sheet 抽屉（仿
   `MutualFriends` 设置抽屉），页头新增滑杆图标入口；i18n 三语补齐
   （`settings.title` 等）。配套测试扩至 11 个用例（权重重算、双排除语义、
   分布隐藏、跨实例持久化），全部通过。
4. **评分口径切换**（`7c817910`、`8b6e6fe5`）：新增百分制/绝对评分两种口径，
   键 `intimacyScoreMode`。百分制维持 P90 归一化 0–100；绝对评分按固定锚点
   （`ABSOLUTE_ANCHORS`，锚点值 = 1000 分基准）取 `log1p` 比值 ×1000，不封顶、
   分值不随其他好友增减而变化；新增导出 `scoreMax`，进度条以榜内最高值为满格。
5. **排行移除 20 人上限**（`0929181a`）：`topFriends` 改为展示全部参与评分的
   好友，S2 所述「前 20 排序」契约随之作废。
6. **排除名单一键恢复**（`654d63b2`）：新增 `includeAllFriends()`，抽屉内
   一键恢复全部已排除好友。
7. **配套修复**：评分设置抽屉内容溢出无法滚动（`c71ced98`）、评分权重提示
   补齐缺失译文并收窄布局避免顶出窗口（`d97e5164`）、权重标题旁新增提示
   解释各维度含义（`8379bcc9`）。

**Verification** — `npx vitest run src/views/Charts/composables/__tests__/` → PASS
（48 tests / 5 files，含新增 5 个用例：空数据、单好友=100、全零=0、离群不压扁
（实现前按预期失败）、90 天衰减）。改动文件 `npx eslint` / `npx oxlint` → 0 问题。
全量 `npm test` → 38 files / 155 tests FAIL，与主仓无改动基线完全一致 →
PRE-EXISTING。全量 `npm run lint` → 71 warnings / 38 errors，主仓一致 →
PRE-EXISTING。`npm run typecheck:js` 无法运行（typescript 未安装、不在
package.json 依赖中）→ PRE-EXISTING 环境缺口。独立审查子代理结论 PASS，无
critical。

**Journey log** —
1. 仓库 `npm ci` 因 lockfile 与 package.json 本就不同步而失败；worktree 未装
   依赖，靠 Node 向上解析主仓 `node_modules` 跑通 vitest。
2. 测试文件位于 `__tests__` 多一层，`vi.mock` 路径须为 `../../../../stores` 等
   四级而非 composable 内的三级。
3. `npm run lint` 的 oxlint 非零退出会短路 eslint（`&&`），需单独跑
   `npx eslint` 验证改动文件。
4. 审查 minor 发现：5 个测试中仅离群用例能区分新旧算法；其余 4 个为行为契约
   回归保护，spec 覆盖要求本就要求全部存在。
5. spec 验收边界含 p90 落在全零区时正数好友也得 0——字面 spec 合规，属已知
   设计取舍（多数好友无数据时不做正向区分）。

## [S1] Problem

亲密度评分（`src/views/Charts/composables/useRelationshipScoring.js`）当前对
`onlineOverlap`、`coWorldFrequency`、`consistency` 三个维度使用「除以全体最大值」
的线性归一化。只要有一个离群好友（如累计共存时长极高），其余所有好友的对应维度
分数会被压扁到接近 0，排行与维度条失去区分度。用户选择「重新设计评分模型」，
方向为「稳健归一化改良」：保留四维度与 40/30/20/10 权重，仅替换归一化方式。

## [S2] Design

**保持不变的契约**（唯一消费方为 `src/views/Charts/components/RelationshipIntimacy.vue`）：

- composable 导出：`friendScores`、`isLoading`、`loadScores`、`getScoreForFriend`、
  `topFriends`、`scoreDistribution`。
- 条目形状：`{ score: 0–100 整数, dimensions: { onlineOverlap, coWorldFrequency,
  recency, consistency }（各 0–100 整数）, raw: { totalTime, joinCount, firstSeen,
  lastSeen, distinctDays }, displayName }`。
- 权重 `0.4 / 0.3 / 0.2 / 0.1`、`recency` 的 90 天指数衰减、`topFriends` 前 20 排序、
  `scoreDistribution` 十桶直方图、`loadScores` 的 `ensureUserContext` 流程均不变。
  （后续变更：权重改为 0–100 可调、`topFriends` 移除前 20 上限、新增评分口径
  与排除机制，以 Report 的交付后清单为准。）
- 无新增 UI、无新增 i18n 文案。

**新归一化算法**（仅替换三个共位维度的 `normalizeValue`，`recency` 不走归一化）：

对每个维度，设全体好友的原始指标值为 `v_i`：

1. 对数压缩：`x_i = ln(1 + v_i)`（`v_i ≥ 0`）。
2. 参考值 `ref`：将 `x_i` 升序排序，取最近秩 90 分位（`index = ceil(0.9 * N) - 1`，
   0-based）。若 `ref ≤ 0`（例如全体为 0）则该维度全员得 0。
3. 归一化：`norm_i = min(1, x_i / ref)`。
4. 单好友（`N = 1`）时 `ref = x_1`，维度得 1（100），与旧行为（自己即最大值）一致。

效果：离群好友经对数压缩后对 `ref` 的抬升有限，其余好友在对数刻度上仍保持区分；
分数仍是 0–100 的加权和，量纲与语义（相对全体好友的水平）与旧模型一致。

**错误行为**：`getFriendshipMetrics()` 抛错时仍置空 `rawMetrics` 并 console.error，
不变。

**测试边界**：针对 composable 公开行为（mock `database.getFriendshipMetrics`）：
空数据、单好友、全零指标、含离群好友时其余好友分数不被压扁（对比旧 max 归一化
的预期）、权重合成的确定性用例。

## [S3] Out of Scope

- 时间线对比（`useTimelineComparison.js` / `TimelineComparison.vue`）任何改动。
- 时间窗重构、SQL/数据层改动。（权重可配置原列此处，已作为后续需求交付，
  见 Report；`RelationshipIntimacy.vue` 模板与 i18n 同理，随抽屉改造扩展。）
- `feed.js` 中无关的 `topFriends`（访问次数排行）。

## Tasks
- [x] T1: 为归一化新行为补充失败测试 — acceptance: `npx vitest run
      src/views/Charts/composables/__tests__/useRelationshipScoring.test.js`
      在实现前按预期失败（覆盖：空数据、单好友=100、全零=0、离群好友不压扁其余分数）
      (covers: S2)
- [x] T2: 在 `useRelationshipScoring.js` 实现 log1p + 最近秩 P90 稳健归一化 —
      acceptance: T1 测试全部通过；公开导出与条目形状不变；
      `npx vitest run src/views/Charts/composables/__tests__/` 全绿 (covers: S2; depends: T1)
