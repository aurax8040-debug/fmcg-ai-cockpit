# Unified AI Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge weekend-promotion analysis and free-form business questions into one AI conversation while adding a governed single-store monthly POS query.

**Architecture:** The BI card remains deterministic and only supplies evidence plus an “AI分析该门店” action. That action writes its result into the existing dashboard conversation; later questions reuse the selected-store context. Numeric monthly POS questions are answered by a deterministic server tool, while Dify remains responsible for interpretation and recommendations.

**Tech Stack:** Browser JavaScript/CSS, Node.js HTTP service, JSON fixtures, Node test runner.

**Spec:** User-approved chat description in the 2026-10-19 conversation: one BI dashboard plus one unified AI window.

## Global Constraints

- Keep BI calculations outside the model.
- Do not expose named peer stores; peer evidence remains anonymous aggregate.
- Do not invent historical POS when the requested month is absent.
- Keep preview/fallback content explicitly labelled as non-model output.
- Keep human adoption before task generation.

## Review Focus

- “这家店” must resolve only when a store is selected.
- Monthly POS must return unavailable when the fixture has no matching month.
- Weekend analysis must appear in the same conversation, not inside the BI card.
- Preview feedback must not be posted as a real model run.
- Task creation must retain the selected store and weekend cycle.

---

### Task 1: Governed monthly POS query

**Files:**
- Create: `server/store-pos-query.mjs`
- Modify: `demo-data/ka-a-activity.json`
- Modify: `server/dashboard-chat.mjs`
- Modify: `server/app.mjs`
- Test: `tests/store-pos-query.test.mjs`

**Interfaces:**
- Produces: `resolveMonthlyStorePos(dataset, question, context, asOf)` returning either `null` or deterministic `analysis`, `tool_result`, and `trace_id`.

- [ ] Add anonymous monthly POS records for the Hudong store.
- [ ] Test explicit store-name and selected-store pronoun queries.
- [ ] Test unavailable month and non-POS questions.
- [ ] Route matching dashboard questions through the deterministic tool and persist the result.

### Task 2: One AI conversation for both entry modes

**Files:**
- Modify: `server/app.mjs`
- Modify: `cockpit.js`
- Modify: `cockpit.css`
- Test: `tests/weekend-promo-agent.test.mjs`
- Test: `tests/ui-contract.test.mjs`

**Interfaces:**
- Consumes: existing weekend-promotion agent result and dashboard-chat persistence.
- Produces: a dashboard chat run with `context.context_type = "weekend_promo"`.

- [ ] Persist successful weekend analysis as a dashboard chat run.
- [ ] Remove the AI result, decision buttons, and task button from the BI evidence card.
- [ ] Send the weekend analysis or explicitly-labelled preview into the single AI conversation and focus that window.
- [ ] Keep adoption/modify/reject and task creation inside the conversation response.

### Task 3: Verification

**Files:**
- Modify: `tests/ui-contract.test.mjs`

- [ ] Run syntax checks and all Node tests.
- [ ] Browser-check initial BI, selected-store evidence, unified AI response, monthly POS question, feedback, and task modal.
