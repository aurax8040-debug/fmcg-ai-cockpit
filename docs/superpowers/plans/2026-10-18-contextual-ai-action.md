# Contextual AI to Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the right-side Dify assistant use the current dashboard scope and turn a verified answer into a human-confirmed task draft.

**Architecture:** The browser builds a bounded dashboard snapshot from the already computed `view` and current filters. A new server endpoint validates that snapshot, assigns trace IDs, calls the existing Dify workflow, validates citations, and persists chat runs; the existing browser task flow receives a generated draft only after user confirmation.

**Tech Stack:** Browser JavaScript, Node.js 22 ESM HTTP server, existing Dify workflow, JSON file state, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-18-contextual-ai-action-design.md`

## Global Constraints

- Keep the current dashboard as the only primary page; do not restore the four-stage shell.
- Never send secrets to the browser or store them in snapshots.
- Never claim inventory, causality, or complete ROI without evidence.
- AI output cannot write business state directly; task creation requires human confirmation.

## Review Focus

- Malformed or oversized browser context must return a structured validation error.
- Changing any filter must create a different scope fingerprint and visible scope label.
- Dify citations outside the current snapshot must be rejected.
- A failed Dify call must not overwrite the latest successful chat result.
- Repeated clicks must not create duplicate task drafts.

---

### Task 1: Preserve the accepted version

**Files:**
- Create: `/Users/liuxiaohua/Documents/Codex/2026-10-16/wo-x/snapshots/fmcg-ai-analytics-2026-10-18-original-dashboard-chat/`
- Create: snapshot `快照说明.md`

- [ ] Copy the current source excluding `.env.demo`, `.git`, and `node_modules`.
- [ ] Record file count, restore instructions, and SHA-256 hashes for core UI files.
- [ ] Verify the snapshot contains `index.html`, `cockpit.js`, `cockpit.css`, and tests but no `.env.demo`.

### Task 2: Validate and persist dashboard chat runs

**Files:**
- Create: `server/dashboard-chat.mjs`
- Modify: `server/app.mjs`
- Modify: `server/state-store.mjs`
- Test: `tests/dashboard-chat.test.mjs`

**Interfaces:**
- Consumes: `{ question, context }` where context contains filter labels, metrics, customers, sources, gaps, and trace IDs.
- Produces: `POST /api/dashboard/chat` and `GET /api/dashboard/chat-runs`, returning a validated structured Dify analysis and persisted run.

- [ ] Write failing tests for valid context, malformed context, unknown citations, and persistence.
- [ ] Implement bounded context validation and trace construction.
- [ ] Add API routes and state-store methods without changing existing agent endpoints.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Send the current dashboard scope

**Files:**
- Modify: `cockpit.js`
- Modify: `cockpit.css`
- Test: `tests/ui-contract.test.mjs`

**Interfaces:**
- Consumes: current `view`, `fRange`, `fRegion`, and `fKa`.
- Produces: `dashboardAiContext()` and a scope fingerprint sent to `/api/dashboard/chat`.

- [ ] Write failing UI contract tests for current filters, visible scope label, fixed response sections, and Dify endpoint.
- [ ] Implement context construction from current computed data without exposing raw source rows.
- [ ] Render source/range labels and concise conclusion/evidence/next-step/boundary sections.
- [ ] Persist and restore successful chat history locally; failure must not replace it.
- [ ] Run UI and syntax tests.

### Task 4: Convert a response into a human-confirmed task

**Files:**
- Modify: `cockpit.js`
- Modify: `app.js`
- Test: `tests/ui-contract.test.mjs`

**Interfaces:**
- Consumes: latest successful dashboard chat result and its scope snapshot.
- Produces: one editable task draft carrying AI run ID, scope, suggested checks, owner, and due date.

- [ ] Write a failing test for a visible “生成核查任务” action and duplicate prevention.
- [ ] Prefill the existing task modal without submitting it.
- [ ] Save only after the existing human submit action and keep the AI run ID in task notes.
- [ ] Run focused UI tests.

### Task 5: End-to-end verification

**Files:**
- Modify: `docs/KA活动AI闭环-演示说明.md`

- [ ] Run all Node tests and syntax checks.
- [ ] Verify the snapshot is unchanged and secret-free.
- [ ] Start the preview and gateway, change filters, and make one real Dify call.
- [ ] Confirm the returned scope matches the selected filters and a task opens as an editable draft rather than auto-submitting.
- [ ] Record verified behavior and remaining demo boundaries in the project memory.
