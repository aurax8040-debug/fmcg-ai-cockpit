# Interview Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛KA活动AI闭环并修复面试评审发现的全部可信度与状态问题。

**Architecture:** 扩展现有Node状态仓库存储研判记录，API在加载时返回最新记录；原生前端以版本化研判、责任链任务和补证前后对比重组页面。旧报表不删除，只默认折叠。

**Tech Stack:** 原生HTML/CSS/JavaScript、Node.js、Dify Workflow、JSON文件状态仓库

**Spec:** `docs/superpowers/specs/2026-10-17-interview-hardening-design.md`

## Global Constraints
- 不新增外部依赖，不泄露密钥，不把匿名模拟写成真实经营结果。
- 无库存不判断缺货；无有效对照不声称因果增量；费用与资源由人审批。

## Review Focus
- 刷新后最新研判必须恢复。
- 旧状态文件没有analyses字段时必须兼容。
- 补证后旧研判保留但标记旧数据版本。
- Dify失败或门禁阻断不得覆盖最后一次成功记录。
- 任务必须显示来源与人工责任链。

### Task 1: 版本化研判状态
**Files:** `server/state-store.mjs`, `server/app.mjs`, `activity-api.mjs`, `activity-state.mjs`, `tests/*.test.mjs`
- [ ] 写失败测试：研判可保存、重载、按活动查询并保留版本。
- [ ] 实现状态仓库与API。
- [ ] 运行相关测试。

### Task 2: 主流程页面收敛
**Files:** `activity-ui.mjs`, `activity.css`, `index.html`, `app.js`, `tests/ui-contract.test.mjs`
- [ ] 写失败契约测试：正确能力口径、折叠菜单、责任链、版本对比、评测和阻断文案。
- [ ] 重组研判、任务、复盘与为什么是AI页面。
- [ ] 修正日期和旧文案。
- [ ] 运行UI契约与语法检查。

### Task 3: 端到端与浏览器验收
**Files:** `tests/e2e-contract.test.mjs`, `docs/KA活动AI闭环-演示说明.md`
- [ ] 验证研判→刷新恢复→建单→补证→再研判→版本对比。
- [ ] 运行全套测试与Compose检查。
- [ ] 浏览器检查五阶段主线、折叠菜单、失败边界与窄屏。
