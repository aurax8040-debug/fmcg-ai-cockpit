# 周末临促复盘与下周行动助手 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 BI 经营看板内完成“本周临促总结—AI下周建议—人工采纳—勤策待办—完成回传—下周再复盘”的单场景闭环。

**Architecture:** 商朝云 POS、临促计划/费用与勤策 SFA 匿名样例进入统一分析数据层，由 BI 模块计算总体、门店指标及匿名可比门店基准；受控 Agent 只检索被规则标记的问题门店、本周 SFA 证据和对标聚合结果并调用 Dify 归纳。用户反馈和模拟勤策待办复用现有持久状态层，前端在经营总览中呈现总体看板、异常列表、单店对标、AI建议和状态闭环。

**Tech Stack:** Node.js ESM、原生 HTTP API、原生 HTML/CSS/JavaScript、ECharts、Dify Workflow、Node test runner

**Spec:** `docs/superpowers/specs/2026-10-18-weekend-promoter-review-mvp-design.md`

## Global Constraints

- 只使用商朝云 POS、临促计划/费用与勤策 SFA；ERP 不参与单店判断。
- POS 明确标注 T+1，SFA 只使用本周附近最新记录。
- 图表和经营指标由确定性代码计算；模型不得重算。
- 无拜访记录只有在存在计划拜访时才可判定为执行缺口。
- AI 不自动认定根因、不自动停止临促资源、不自动下发任务。
- MVP 只生成“下周重点门店拜访待办”，正式勤策接口用模拟适配器表示。
- 所有客户、门店、人员和经营数字继续使用匿名模拟数据。
- 演示阈值为 A 类临促门店单日 POS 销售额 5000 元，页面和接口均标记为可配置演示规则。
- 可比门店由规则按同 KA、同等级、同周、同临促天数选择；不足 5 家时逐级放宽并显示样本量。
- 复用 BI 身份范围；权限外门店仅作为匿名聚合样本，不向 AI 或前端暴露明细。

## Review Focus

- POS 某天缺失时必须阻断该门店资源调整建议，不得把缺失当作 0。
- 门店没有计划拜访时，缺少 SFA 拜访记录只能显示证据缺口，不能计为执行失败。
- 同 KA 样本不足 5 家时必须按固定顺序降级并标记范围；大盘整体异常时连续未达标不得升级为单店暂停建议。
- 上周任务未完成或回传证据不完整时，下周复盘必须显示该状态而不能视为已闭环。
- Dify 调用失败时仍展示确定性图表和证据，且不能伪造 AI 建议。

---

### Task 1: 建立周末临促匿名数据与确定性复盘模型

**Files:**
- Modify: `demo-data/ka-a-activity.json`
- Modify: `server/domain.mjs`
- Create: `server/weekend-promo-review.mjs`
- Create: `tests/weekend-promo-review.test.mjs`

**Interfaces:**
- Consumes: 现有 dataset、活动/门店 ID、POS 日明细和 SFA 记录模式。
- Produces: `summarizeWeekendPromo(dataset, snapshot, cycleId)`，返回 `summary`、`stores`、`benchmarks`、`trace_ids` 和 `data_gaps`。

- [ ] **Step 1: 写失败测试，固定本周门店指标与比较口径**

覆盖“上海市·浦东新区·大润发·沪东店”的本次 POS、上次 POS、演示目标、实际达成率、同 KA 中位数、大盘中位数、临促费用、最新 SFA 状态和达标门店对标差距；断言结果中不存在 ERP、库存或外部竞品字段。

- [ ] **Step 2: 运行测试并确认因接口尚不存在而失败**

Run: `node --test tests/weekend-promo-review.test.mjs`

- [ ] **Step 3: 增加最小匿名样例与 `summarizeWeekendPromo(dataset, snapshot, cycleId)`**

数据增加 `promo_cycles`、`promo_targets`、`promo_resources` 和仅本周使用的 SFA 记录；计算代码区分缺失与 0，并生成总体汇总、同 KA/大盘基准、可比达标门店聚合和样本降级说明。

- [ ] **Step 4: 补齐 Review Focus 边界测试**

测试 POS 缺失、无计划拜访、同 KA 样本不足、大盘异常和连续 3 次有效未达标规则。

- [ ] **Step 5: 运行模型测试并确认通过**

Run: `node --test tests/weekend-promo-review.test.mjs`

### Task 2: 增加本周证据检索与受控 Agent 研判

**Files:**
- Create: `server/weekend-promo-agent.mjs`
- Modify: `server/analysis-contract.mjs`
- Modify: `server/app.mjs`
- Create: `tests/weekend-promo-agent.test.mjs`

**Interfaces:**
- Consumes: `summarizeWeekendPromo(...)` 的单店确定性上下文。
- Produces: `planWeekendPromoReview(question, storeContext)`、`executeWeekendPromoTools(plan, storeContext)`；API `GET /api/weekend-promos/current` 和 `POST /api/weekend-promos/investigate`。

- [ ] **Step 1: 写失败测试，固定只读工具和本周范围**

断言 Agent 只能调用 `pos_result`、`promo_resource`、`sfa_visit`、`sfa_quality`、`sfa_promoter_issue`、`peer_benchmark`，不得出现 ERP、库存和外部竞品工具；`peer_benchmark` 只返回匿名聚合结果。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/weekend-promo-agent.test.mjs`

- [ ] **Step 3: 实现计划器、工具执行器和两个 API**

`investigate` 输入 `cycle_id`、`store_id`、`question`，先返回确定性上下文，再调用 Dify；模型失败时保存失败记录并保留确定性证据。

- [ ] **Step 4: 扩展分析校验**

要求输出区分 `facts`、`resolved_issues`、`open_issues`、`evidence_gaps`、`next_week_recommendation`，所有引用必须来自该门店 trace ID。

- [ ] **Step 5: 运行 Agent 与 API 测试并确认通过**

Run: `node --test tests/weekend-promo-agent.test.mjs tests/read-api.test.mjs`

### Task 3: 增加人工决策和模拟勤策重点拜访待办

**Files:**
- Modify: `server/state-store.mjs`
- Modify: `server/app.mjs`
- Create: `tests/weekend-promo-task.test.mjs`

**Interfaces:**
- Consumes: 成功的门店 Agent 研判记录。
- Produces: `recordPromoDecision(runId, payload)`、`createPromoVisitTask(payload)`、`updatePromoVisitTask(id, patch)`；对应 feedback、task 和 completion API。

- [ ] **Step 1: 写失败测试，固定人工反馈门禁**

断言直接采纳、修改后采纳、否决三种决策；修改和否决必须填写原因；未经采纳不得生成待办。

- [ ] **Step 2: 写失败测试，固定唯一任务类型与状态流**

任务类型固定为 `next_week_store_visit`，状态为“待接收→已接收→执行中→已完成”；完成必须包含 SFA 回传摘要和证据 trace ID。

- [ ] **Step 3: 运行测试并确认失败**

Run: `node --test tests/weekend-promo-task.test.mjs`

- [ ] **Step 4: 扩展状态存储和 API**

保留负责人、截止时间、核查项、AI原建议、人工修改、模拟勤策任务号、SFA回传和完成时间；并发写入沿用现有串行持久化队列。

- [ ] **Step 5: 测试跨周关联**

下一周期 `summarizeWeekendPromo(...)` 应将上周待办状态和 SFA 回传挂到同一门店，不将未完成任务标记为闭环。

- [ ] **Step 6: 运行任务测试并确认通过**

Run: `node --test tests/weekend-promo-task.test.mjs tests/state-api.test.mjs`

### Task 4: 在现有 BI 经营看板实现列表、图表和闭环交互

**Files:**
- Modify: `cockpit.js`
- Modify: `cockpit.css`
- Modify: `index.html`（仅在需要新增稳定挂载点时）
- Modify: `tests/ui-contract.test.mjs`

**Interfaces:**
- Consumes: Task 2/3 API。
- Produces: 本周临促列表、单店详情抽屉、两组核心图表、SFA证据区、AI建议和下周待办状态区。

- [ ] **Step 1: 更新 UI 合同测试并确认失败**

固定“本周临促分析、总体达成、未达标门店、本次POS、上次POS、临促投入、演示目标、实际达成、同系统达成率、大盘达成率、对标样本、最新SFA、AI建议、生成勤策待办”等文案和 API 调用。

- [ ] **Step 2: 将原“活动门店智能巡检”替换为“周末临促复盘”入口**

保留原经营总览布局，不新增一级系统；旧通用巡检卡不再作为首页主场景。

- [ ] **Step 3: 实现门店列表与确定性图表**

先呈现全部门店总体 KPI 和规则标记结果，再展示多门店列表；点击后使用 ECharts 展示本次/上次/目标、门店/同KA/大盘达成率及问题门店与可比达标门店的执行差距。所有图表读取 API 数字，不由模型生成数值。

- [ ] **Step 4: 实现最新 SFA 与 AI 研判区域**

展示本周最新拜访、果品质量和临促问题，随后展示事实、已处理、未闭环、缺口和下周建议；Dify 失败时显示明确失败提示。

- [ ] **Step 5: 实现采纳、修改、否决和勤策待办交互**

只有采纳或修改后采纳可创建重点拜访待办；负责人默认所属战区销售、由 NKA 客户经理确认；任务状态及 SFA 回传在同页可见。

- [ ] **Step 6: 运行 UI 合同和语法检查**

Run: `node --check cockpit.js && node --test tests/ui-contract.test.mjs`

### Task 5: 端到端验收与文档更新

**Files:**
- Modify: `tests/e2e-contract.test.mjs`
- Modify: `docs/ai-evaluation-baseline-2026-10-18.md`
- Modify: `docs/superpowers/specs/2026-10-18-weekend-promoter-review-mvp-design.md`（仅记录经实现验证的偏差）

**Interfaces:**
- Consumes: Tasks 1-4 完整链路。
- Produces: 可重复的跨周闭环验收和清晰的演示边界。

- [ ] **Step 1: 写端到端失败测试**

验证“读取本周门店→Agent研判→修改后采纳→生成模拟勤策待办→完成并回传SFA证据→下一周复盘显示上周完成结果”。

- [ ] **Step 2: 运行端到端测试并修复真实失败**

Run: `node --test tests/e2e-contract.test.mjs`

- [ ] **Step 3: 运行完整自动化测试**

Run: `node --check cockpit.js && node --test tests/*.test.mjs`

- [ ] **Step 4: 浏览器验收桌面和窄屏**

验证列表可读、图表口径和数据时间可见、详情切换、AI失败兜底、三种人工决策、任务状态流及下一周回看；检查控制台无错误。

- [ ] **Step 5: 更新评测说明**

记录该单场景的人机责任、可用指标、模拟勤策边界和未接真实商朝云/勤策接口，不把匿名样例指标包装成业务效果。
