# Controlled Investigation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有KA活动闭环中增加可追溯、只读、人工确认的深度核查Agent。

**Architecture:** Node网关提供受控问题路由和四个只读领域工具，汇总工具结果后复用现有Dify Workflow生成结构化研判；状态仓库存储Agent运行轨迹。前端在AI研判页展示问题、步骤、工具结果摘要和边界。

**Tech Stack:** 原生JavaScript、Node.js、Dify Workflow、JSON状态仓库

**Spec:** `docs/superpowers/specs/2026-10-17-controlled-investigation-agent-design.md`

## Global Constraints
- 只读工具；任务只能生成草稿并等待人工确认。
- 无库存工具不判断缺货；无对照不声称因果；不自动审批费用与资源。

## Review Focus
- 问题为空、未知门店、库存问题、Dify失败、刷新恢复。

### Task 1: Agent路由与运行记录
- [ ] 为工具选择和轨迹持久化写失败测试。
- [ ] 实现`POST /api/agents/investigate`与`GET /api/agent-runs`。
- [ ] 验证问题驱动工具选择、边界和失败记录。

### Task 2: Agent页面
- [ ] 增加问题输入、示例问题、启动按钮、轨迹和人工确认入口。
- [ ] 明确“受控工具路由＋Dify总结”，不冒充完全自主Agent。
- [ ] 增加UI契约测试。

### Task 3: 端到端验收
- [ ] 运行全套测试、语法与Compose检查。
- [ ] 浏览器运行A10核查并刷新验证轨迹恢复。
