---
feature: intimacy-scoring
status: delivered
updated: 2026-10-02
branch: feature/intimacy-scoring
commits: 493abb7e..2bfe43b8
---

# 好友亲密度评分模型重设计

## Report

### 五维物理量重设计：绝对口径无上限（第二轮，续 `feature/intimacy-choquet`）

**What was built** — 用户实测报告三现象：规律性全员 1000、各维挤在 900 附近、
很少碰面的排很高。真实库分析（`VRCX.sqlite3`，40 好友）确认根因：真共位量级
p90 ≈ 1.1h（旧接触面锚 500h 下全员 <170 分垫底）、关系龄全 ≤2 周（旧
`coverage/0.3` 在 age≤1 周时 coverage≡1 必然顶格）、recency/trend/activity 是
自带满分的有界量表（0.1h 的人四个非接触维可拿 ~3300/4000 分）。

重设计为**统一物理量管线**：每维取无界物理量 → `log1p` → 除参考值 →
百分制 P90 封顶 0–100 / 绝对锚点**不封顶**（1000 = 标准线而非上限）：

| 维度 | 物理量 | 绝对锚点 |
|---|---|---|
| contact | 累计共处小时（×δ×深度结构） | 1h |
| regularity | **累计活跃周数**（替代覆盖率，无界） | 26 周 |
| recency | **近 90 天共处小时**（新增 `time90d`）× 双指数新近调制 | 1h |
| trend | (近30+0.5h)/(前30+0.5h) 比值（替代 tanh 有界映射） | 1（持平） |
| activity | (对方发起+1)/(我方发起+1)（替代有界占比） | 1（平衡） |

结构封杀低频虚高：低频者 contact/recency → 0、regularity ≈ 210，λ>0 木桶
效应下 trend/activity（权重合计 30%）补不上去——真实库验算末五分位全落
32–39 名（旧模型挤进前半），规律性 ≥990 从 40/40 → 0/40，各维分布拉开
（contact 2.8–1487、recency 2–1647、trend 1003–2740、activity 585–2807）。
深度结构项、freshness、Choquet/λ、排除与持久化机制保持不变；数据层仅新增
`time90d` 滚动窗。

**Verification** — 定向 `npx vitest run` 两文件 44/44 PASS（recency/trend/
activity/regularity 测试组按新语义重写：超窗归零、比值方向、绝对口径
1000 中性、活跃周独立于 firstSeen）。oxlint + eslint 改动文件 0 问题。
真实库 Python 复算脚本确认三现象修复（见上）。

**Follow-up：非好友过滤 + 全名单基底** — 真实库核对发现 40 个共位条目中
30 个不在 `_friend_log_current` 名单（路人/测试账号/已解好友的 feed 历史，
名单本身与 `mutual_graph_friends` 一致可信）。第一步：聚合循环按名单过滤
（`friendNumbers.has(userId)`）。用户随后反馈列表仅剩 10 人——名单内 50 个
真好友因无真共位数据而隐形。第二步：改为**名单为基底**——`roster` 查询带
`display_name`，聚合后为未出现的名单好友补全零指标行（totalTime=0、
firstSeen=null），榜单覆盖全部当前好友、无数据者排榜尾；mock 三列
`[user_id, display_name, friend_number]`，新增零行用例（46/46 PASS）。

### λ-Choquet 五维重写（分支 `feature/intimacy-choquet`）

**What was built** — 评分模型从「四维加权平均」重写为「五维 λ-Choquet」：

1. **数据层**（`gameLog.getFriendshipMetrics`）：`totalTime` 改为分块求和（Σ exit−enter，重进房间不重复计）；`joinCount` 改为 4 分钟链结后的会话数（网络闪断不虚增次数、不压平深度）；新增 `activeWeeks`（周覆盖）、`time30d` / `timePrev30d`（趋势双窗）、`friendNumber`（join `friend_log_current`）、`friendInitiated` / `selfInitiated`（到达方向：谁后到谁发起，60s 内视为同时不计）。
2. **五维**：`contact` 接触面 = 新鲜感折价 δ × 总时长 × 深度微调；`regularity` = 活跃周数 ÷ 关系周数（30% 满分）；`recency` 回归纯双指数衰减（密度折价移出）；`trend` = tanh(近30/前30 对数比)，最近度 <0.1 时强制中性防双罚；`activity` = 对方发起占比。
3. **接触面**：会话深度走 James-Stein 收缩（碎片数据向队列均值收拢）——次数与深度共线（N=T/D），深度独立承担结构信号，单次深聊优于碎片串门但闪断不冤枉。`friend_number` S 型折价 δ∈[0.6,1]（加得越早越接近 1，编号缺失不罚）实现「加得早+玩得多 → 高；加得晚+玩得多 → 分少加；加得晚+玩得少 → 分也少」。
4. **λ-Choquet 合成**：κ=6 logistic 隶属（绝对口径透传）→ 权重归一化密度 → Sugeno λ-测度（归一到 g(X)=1）→ Choquet 积分。λ>0 相互制约、λ<0 互相替代、λ=0 退化加权平均；范围 [-0.9,2]，默认 0.5。
5. **配置**：`intimacyWeights` 键形状改为五维（旧四键回落默认 35/15/20/12/18）；新增 `intimacyLambda`；`resetWeights` 连 λ 一并重置。UI 维度条改五条、设置抽屉加 λ 滑杆；i18n 三语同步。

**Verification** — `npx vitest run src/views/Charts/composables/__tests__/useRelationshipScoring.test.js src/services/database/__tests__/gameLog.test.js` → 44/44 PASS（评分 33 + gameLog 11，覆盖闪断链结、深度收缩、趋势防双罚、主动性方向、新鲜感折价、λ 制约/替代、双口径、排除与持久化）。全量 `npm test` → 37 files / 153 failed，stash 基线完全一致 → PRE-EXISTING。改动文件 eslint：gameLog.js 3 个 `no-redeclare` 与基线同源（未触碰区域）→ PRE-EXISTING；oxlint 0 问题。`npm run typecheck:js` 环境缺口（tsc 未安装）→ PRE-EXISTING。

**Known semantics** — 关系时间线 `getRelationshipTimelineData()` 仍走未求交的 `buildPresenceSessionsQuery`，口径未同步。百分制下接触面仍受队列 P90 影响；绝对口径锚点为共处 500h / 深度 2h。

### 原四维稳健归一化（已由上文取代，历史保留）

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
8. **最近度算法重做**（分支 `optimize/intimacy-recency`）：`recency` 由单一
   90 天指数衰减改为「双指数衰减 × 接触密度折价」——
   `0.6·e^(-d/14) + 0.4·e^(-d/120)`，前两周快速拉开区分度（7 天 ≈74、
   30 天 ≈38、90 天 ≈19，旧曲线为 92 / 72 / 37），后段保留长尾不再趋零；
   再乘接触密度折价 `0.5 + 0.5·min(1, (distinctDays ÷ 关系年龄天数) ÷ 0.1)`，
   使同一时刻的一次偶遇明显低于规律联系者（7 天前偶遇 ≈43 vs 规律 ≈74）。
   健壮性一并修复：非法 `lastSeen` 记 0（不再产生 NaN）、未来时间戳钳为 0 天
   （不再 >100）、`firstSeen` 缺失或非法不打折。仅动 composable，数据层与
   条目形状不变；测试 18→25，三语 `weights.explain.recency` 文案同步。
9. **数据层改真共存**（分支 `fix/intimacy-co-presence-metrics`）：四维原始指标
   此前来自 `buildPresenceSessionsQuery`（仅 `_feed_gps` + `_feed_online_offline`），
   记录的是**好友自己**的停留时长与换世界次数，与「是否和我在一起」无关——
   实测某好友被算作 28.2h / 212 次共存，实际从未共存；`joinCount=212` 在绝对
   口径下得 862 分，而常玩的好友 31 次只得 558 分（分数与是否一起玩无关）。
   `getFriendshipMetrics` 改为真共存：游戏日志中出现的好友会话直接计入，feed
   会话与我的游戏日志会话在同 `location` 上求交后计入，再按好友合并重叠区间
   得到 `totalTime` / `joinCount` / `distinctDays` / `firstSeen` / `lastSeen`。
   真实库复算：总重叠 211.3h → 19.2h，前 15 名中 10 位从未共存者归零并移出
   列表（44 → 40 位）。仅改该方法，`getRelationshipTimelineData` 的旧口径
   未动；新增 6 个数据层用例。

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
  与排除机制、`recency` 衰减模型重做，以 Report 的交付后清单为准。）
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
