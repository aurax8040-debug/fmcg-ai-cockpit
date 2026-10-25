# AI Feedback Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add traceable human feedback, task outcome metrics, response latency, and a 30-case frozen evaluation set.

**Architecture:** Extend the existing JSON state store and loopback API; keep task UI local but write lifecycle events back to the related dashboard chat run. Compute metrics server-side and render a compact dashboard card. Keep evaluation fixtures separate from usage telemetry.

**Tech Stack:** Node.js ESM, native HTTP server, browser JavaScript, JSON persistence, node:test.

**Spec:** `docs/superpowers/specs/2026-10-18-ai-feedback-evaluation-design.md`

## Global Constraints

- Do not claim frozen evaluation records as production usage.
- Do not expose secrets or send feedback without an explicit human action.
- Keep the existing local-only origin restriction and AI task human-confirmation boundary.

## Review Focus

- Invalid decisions and missing rejection reasons return 400.
- Repeated feedback updates one record rather than inflating the sample count.
- Task completion cannot be counted before task creation.
- Failed calls are excluded from adoption denominator but included in review samples.
- Metrics with fewer than 20 evaluated answers remain labelled as accumulating samples.

### Task 1: Feedback persistence and metrics API

**Files:** `server/state-store.mjs`, `server/app.mjs`, `server/evaluation-metrics.mjs`, `tests/feedback-metrics.test.mjs`

- [ ] Write failing tests for feedback validation, lifecycle events and metric denominators.
- [ ] Add state-store methods and API routes.
- [ ] Run focused tests, then the full suite.

### Task 2: Dashboard interaction and metric card

**Files:** `cockpit.js`, `cockpit.css`, `tests/ui-contract.test.mjs`

- [ ] Add decision controls and reason capture.
- [ ] Write task-created/task-completed events from the existing human workflow.
- [ ] Add the AI effect card with sample-state labels.
- [ ] Run UI contract tests and browser verification.

### Task 3: Frozen evaluation set

**Files:** `demo-data/ai-evaluation-cases.json`, `scripts/run-ai-evaluation.mjs`, `tests/evaluation-fixture.test.mjs`, `docs/KA活动AI闭环-演示说明.md`

- [ ] Add 30 uniquely identified cases across six categories.
- [ ] Add fixture validation and an optional live runner that writes a separate result file.
- [ ] Document that only actual run output may be quoted as evaluation evidence.
- [ ] Run fixture and full regression tests.
