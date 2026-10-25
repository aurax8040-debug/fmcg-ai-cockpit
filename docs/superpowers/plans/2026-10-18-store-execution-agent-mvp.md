# 活动门店智能巡检 Agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有驾驶舱落地活动门店智能巡检、受控工具研判和人工整改闭环。

**Architecture:** 扩展匿名活动数据与确定性规则汇总；复用现有受控 Agent 和 Dify 分析契约；前端只增加右侧巡检卡及任务入口。

**Tech Stack:** 原生 JavaScript、Node.js ESM、Dify Workflow、Node test。

**Spec:** `docs/superpowers/specs/2026-10-18-store-execution-agent-mvp-design.md`

## Global Constraints

- 不新增依赖、一级页面或未经授权的写工具。
- 所有新增经营数据标记匿名模拟。
- 不推断库存或因果；任务必须人工确认。

## Review Focus

- 缺少某类执行数据时应显示缺口，不产生虚构结论。
- 相同门店多条记录必须按活动和门店正确聚合。
- 受控商圈事件必须显示来源和时间。
- Agent 不得选择不存在的库存工具。
- 页面筛选变化不得把匿名活动指标冒充当前财务筛选实绩。

### Task 1: 多源匿名样例与巡检规则

**Files:**
- Modify: `demo-data/ka-a-activity.json`
- Create: `server/store-execution.mjs`
- Modify: `server/domain.mjs`
- Test: `tests/store-execution.test.mjs`

- [ ] 写 A10 排名、证据构成和缺口边界测试并确认失败。
- [ ] 增加 ERP、促销员、SFA、陈列、质量、历史、商圈数据与确定性聚合。
- [ ] 运行测试确认通过。

### Task 2: 扩展受控 Agent 工具

**Files:**
- Modify: `server/metrics.mjs`
- Modify: `server/investigation-agent.mjs`
- Modify: `tests/investigation-agent.test.mjs`

- [ ] 写动态选择 POS、人员、陈列、质量、历史、商圈工具测试并确认失败。
- [ ] 将巡检证据加入活动证据包并扩展只读工具。
- [ ] 运行测试确认通过。

### Task 3: 驾驶舱巡检卡与人工任务

**Files:**
- Modify: `cockpit.js`
- Modify: `cockpit.css`
- Modify: `tests/ui-contract.test.mjs`

- [ ] 写页面文案、Agent接口和人工任务边界契约测试并确认失败。
- [ ] 渲染最高优先门店、证据维度、Agent研判结果和整改任务入口。
- [ ] 运行前端契约与完整回归测试。
- [ ] 浏览器验证桌面布局、Agent调用和任务草稿。
