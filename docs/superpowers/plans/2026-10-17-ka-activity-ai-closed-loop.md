# KA Activity AI Closed Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one interview-ready KA activity demo that moves from governed data evidence through Dify analysis, human-approved execution, evidence write-back, and AI-assisted business review.

**Architecture:** Keep the existing vanilla HTML/CSS/JS dashboard and add focused activity modules rather than rewriting the app. A dependency-light Node 22 Mock BI service owns anonymous activity data, deterministic metrics, task/evidence state, and the server-side Dify key; the dedicated Dify Workflow reads bounded evidence JSON and returns cited structured analysis.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, ECharts, Node.js 22 built-in `http` and `node:test`, JSON state, Docker Compose, Dify 1.17.1 Workflow, existing DeepSeek provider.

**Spec:** `/Users/liuxiaohua/WorkBuddy/2026-10-12-11-47-53/fmcg-ai-analytics/docs/superpowers/specs/2026-10-17-ka-activity-ai-closed-loop-design.md`

## Global Constraints

- Modify only `/Users/liuxiaohua/WorkBuddy/2026-10-12-11-47-53/fmcg-ai-analytics`; the verified preview is `http://127.0.0.1:58044/preview/p1/index.html`.
- Preserve existing NKA Excel sales and gross-profit calculations and label them `真实样例`.
- Use fictional `KA-A` activity, store, person, cost, POS, and execution records; label them `匿名模拟`.
- Label model output `AI 推断`; do not claim inventory visibility, causal lift, production integration, or automatic approval.
- Keep existing customer, detail, summary, category, budget, POS, SFA, and negative-margin functions accessible under secondary navigation.
- Compute numeric metrics and completeness in Node code; Dify summarizes and proposes checks but never calculates source-of-truth figures.
- Do not put Dify keys in browser code, project fixtures, logs, Git, or cross-project memory.
- Dify analysis must cite `trace_ids`; missing or unknown citations invalidate the AI result.
- POS coverage below 80% blocks operating hypotheses; 80%–95% permits only qualified hypotheses; 95% or above permits normal analysis.
- Missing simulated cost blocks activity margin/contribution only; missing execution evidence blocks execution-quality conclusions only.
- No new runtime package dependency is allowed unless a later failing test proves the built-in Node APIs insufficient.

## Review Focus

- Malformed activity/store/date identifiers must return a structured 400 response and never reach Dify — pinned in Task 2 API tests.
- Boundary POS coverage values `79.9`, `80`, `94.9`, and `95` must map to the specified blocking modes — pinned in Task 1 metric tests.
- Evidence write-back must increment `data_version`, survive restart, and be visible to a subsequent analysis — pinned in Task 3 state tests.
- Dify timeout, malformed JSON, or unknown `trace_ids` must show a transparent failure while deterministic evidence stays available — pinned in Task 4 gateway tests.
- The old analysis pages, keyboard navigation, and a 390px viewport must remain usable after the new main flow is added — pinned in Tasks 7 and 9.

---

### Task 1: Anonymous Fixture and Deterministic Metrics

**Files:**
- Create: `demo-data/ka-a-activity.json`
- Create: `server/domain.mjs`
- Create: `server/metrics.mjs`
- Test: `tests/metrics.test.mjs`

**Interfaces:**
- Consumes: no prior task.
- Produces: `loadFixture(raw) -> DemoDataset`, `summarizeActivity(dataset, activityId) -> ActivityEvidence`, and `evaluateCompleteness(evidence) -> AnalysisGate`.

- [ ] **Step 1: Write failing tests for fixture integrity and the exact completeness boundaries**

Create tests named `fixture_has_no_real_customer_identity`, `summary_reconciles_sales_cost_and_activity_expense`, `coverage_boundaries_match_spec`, `missing_cost_blocks_only_profit`, and `missing_execution_blocks_only_execution_judgment`. Assert that all activity entities use `KA-A`; sales equal the sum of store-day rows; margin equals sales minus simulated cost; contribution equals margin minus attributable activity expense; and the four coverage values map to `blocked`, `qualified`, `qualified`, and `normal`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/metrics.test.mjs`

Expected: FAIL because `server/domain.mjs` and `server/metrics.mjs` do not exist.

- [ ] **Step 3: Add one coherent fictional activity fixture**

Include one activity plan, at least 10 stores, daily POS rows for before/during/after windows, two SKUs with simulated unit costs, long/temporary promoter resources, one roadshow expense, partial execution evidence, and stable `trace_id` values. Keep all dates and observation windows explicit.

- [ ] **Step 4: Implement the domain loader and metric functions**

Use these return fields exactly: `source_type`, `as_of`, `data_version`, `completeness`, `gate`, `facts`, `data_gaps`, `metrics`, `stores`, and `trace_ids`. Reject duplicate IDs and references to unknown activities, stores, or SKUs.

- [ ] **Step 5: Run the test and verify pass**

Run: `node --test tests/metrics.test.mjs`

Expected: PASS with five passing subtests.

- [ ] **Step 6: Commit the fixture and metric slice**

```bash
git add demo-data/ka-a-activity.json server/domain.mjs server/metrics.mjs tests/metrics.test.mjs
git commit -m "feat: add anonymous KA activity metrics"
```

### Task 2: Read-Only Mock BI API

**Files:**
- Create: `server/http-utils.mjs`
- Create: `server/app.mjs`
- Create: `server/start.mjs`
- Test: `tests/read-api.test.mjs`

**Interfaces:**
- Consumes: `loadFixture`, `summarizeActivity`, and `evaluateCompleteness` from Task 1.
- Produces: `createApp({ dataset, stateStore, difyClient }) -> http.RequestListener` and endpoints `GET /api/health`, `/api/data-sources`, `/api/activities`, `/api/activities/:id/evidence`, and `/api/activities/:id/stores`.

- [ ] **Step 1: Write failing API contract tests**

Start the listener on an ephemeral port. Assert JSON content types, `source_type/as_of/data_version/completeness/trace_ids`, 404 for an unknown activity, and structured 400 responses for malformed activity, store, or date identifiers. Assert malformed requests do not call the injected `difyClient` spy.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/read-api.test.mjs`

Expected: FAIL because `createApp` is undefined.

- [ ] **Step 3: Implement strict routing and JSON responses**

Keep route parsing explicit; expose `GET, POST, PATCH, OPTIONS`; return `{ error: { code, message } }` on failures. Permit CORS only for loopback preview origins and do not include secrets in any response.

- [ ] **Step 4: Implement `server/start.mjs`**

Read `PORT` with default `8787`, load the fixture once, inject state and Dify clients, listen on `0.0.0.0` inside the container, and handle `SIGTERM` cleanly.

- [ ] **Step 5: Run the test and a local health smoke check**

Run: `node --test tests/read-api.test.mjs`

Expected: PASS.

Run: `PORT=8787 node server/start.mjs` in a temporary terminal, then `curl -fsS http://127.0.0.1:8787/api/health`.

Expected: HTTP 200 JSON with `status: "ok"` and no secret fields.

- [ ] **Step 6: Commit the read API slice**

```bash
git add server/http-utils.mjs server/app.mjs server/start.mjs tests/read-api.test.mjs
git commit -m "feat: expose governed mock BI reads"
```

### Task 3: Task, Evidence, and Versioned State Write-Back

**Files:**
- Create: `server/state-store.mjs`
- Modify: `server/app.mjs`
- Create: `demo-data/runtime-state.example.json`
- Create: `.gitignore`
- Test: `tests/state-api.test.mjs`

**Interfaces:**
- Consumes: Task 2 `createApp` and Task 1 activity evidence.
- Produces: `createStateStore({ filePath, seed })`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/activities/:id/evidence`, and a monotonically increasing evidence `data_version`.

- [ ] **Step 1: Write failing state transition and persistence tests**

Test valid transitions `草稿 → 已确认 → 执行中 → 待补证 → 已完成` and `草稿 → 已驳回`; reject every other transition. Verify blank proof is rejected, evidence adds a trace ID, concurrent writes are serialized, `data_version` increments exactly once per accepted evidence write, and reloading the store from a temporary file preserves state.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/state-api.test.mjs`

Expected: FAIL because `createStateStore` is undefined.

- [ ] **Step 3: Implement atomic JSON state persistence**

Write to a sibling temporary file and rename it over the state file. Store only fictional IDs, role labels, status, timestamps, evidence text, trace IDs, and human decisions. Ignore `demo-data/runtime-state.json` in Git; keep only the example seed.

- [ ] **Step 4: Add mutation routes and validation**

Use exact status names from the spec. Every successful mutation returns the updated entity plus `data_version`; every rejected mutation returns 409 without changing disk state.

- [ ] **Step 5: Run state and read regression tests**

Run: `node --test tests/state-api.test.mjs tests/read-api.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the closed-loop state slice**

```bash
git add .gitignore demo-data/runtime-state.example.json server/state-store.mjs server/app.mjs tests/state-api.test.mjs
git commit -m "feat: persist activity tasks and evidence"
```

### Task 4: Dify Gateway and Output Guardrails

**Files:**
- Create: `server/dify-client.mjs`
- Create: `server/analysis-contract.mjs`
- Modify: `server/app.mjs`
- Test: `tests/dify-gateway.test.mjs`

**Interfaces:**
- Consumes: latest Task 3 evidence and state version.
- Produces: `createDifyClient({ baseUrl, apiKey, fetchImpl, timeoutMs })`, `validateAnalysis(result, allowedTraceIds)`, and `POST /api/activities/:id/reanalyze`.

- [ ] **Step 1: Write failing gateway tests**

Cover a successful Dify Workflow response, a timeout, non-2xx response, malformed JSON, missing sections, and an unknown citation. Assert failures return `ai_status: "failed"`, never invent fallback prose, and still include the deterministic `evidence` object.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/dify-gateway.test.mjs`

Expected: FAIL because the client and validator do not exist.

- [ ] **Step 3: Implement the Dify Workflow client**

POST to `${baseUrl}/workflows/run` with `response_mode: "blocking"`, `user: "fmcg-demo"`, and inputs `activity_id`, `question`, `role`, `evidence_json`, and `data_version`. Default timeout is 45 seconds. Read `DIFY_API_KEY` and `DIFY_BASE_URL` only on the server.

- [ ] **Step 4: Implement strict result validation**

Require arrays `facts`, `data_gaps`, `hypotheses`, `recommended_checks`, `boundaries`, an object `management_summary`, and `citations`. Reject any citation not present in the current evidence `trace_ids`.

- [ ] **Step 5: Implement `/reanalyze` with the current state snapshot**

Block Dify entirely when the Task 1 gate is `blocked`; otherwise call it with the latest evidence version and return `{ ai_status, analysis, evidence }`.

- [ ] **Step 6: Run all server tests**

Run: `node --test tests/metrics.test.mjs tests/read-api.test.mjs tests/state-api.test.mjs tests/dify-gateway.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the Dify gateway slice**

```bash
git add server/dify-client.mjs server/analysis-contract.mjs server/app.mjs tests/dify-gateway.test.mjs
git commit -m "feat: add cited Dify analysis gateway"
```

### Task 5: Docker-Networked Local Demo Service

**Files:**
- Create: `server/Dockerfile`
- Create: `compose.mock-bi.yaml`
- Create: `.env.demo.example`
- Create: `scripts/demo-stack.sh`
- Test: `tests/compose-contract.test.mjs`

**Interfaces:**
- Consumes: Task 2–4 Node service.
- Produces: Docker service name `mock-bi`, host URL `http://127.0.0.1:8787`, and internal Dify URL `http://mock-bi:8787`.

- [ ] **Step 1: Write a failing compose contract test**

Assert the compose file uses top-level project name `docker`, service name `mock-bi`, publishes `127.0.0.1:8787:8787`, mounts a named runtime-state volume, passes `DIFY_BASE_URL=http://api:5001/v1`, and contains no literal API key.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/compose-contract.test.mjs`

Expected: FAIL because compose files do not exist.

- [ ] **Step 3: Add the dependency-light Node image and Compose service**

Use `node:22-alpine`, copy only `server/` and `demo-data/`, run as a non-root user, expose 8787, and add a healthcheck for `/api/health`.

- [ ] **Step 4: Add the demo stack helper**

Implement `scripts/demo-stack.sh up|down|status|logs`. `up` must require `DIFY_API_KEY` from an untracked `.env.demo`, build `mock-bi`, and use `docker compose -f compose.mock-bi.yaml`; `down` removes only `mock-bi`, never the Dify database or volumes.

- [ ] **Step 5: Validate configuration and runtime connectivity**

Run: `node --test tests/compose-contract.test.mjs`

Expected: PASS.

Run: `docker compose -f compose.mock-bi.yaml config --quiet`

Expected: exit 0.

Run: `./scripts/demo-stack.sh up` and then `curl -fsS http://127.0.0.1:8787/api/health`.

Expected: healthy JSON; `docker compose -f compose.mock-bi.yaml exec mock-bi` can resolve `api` on the shared `docker_default` network.

- [ ] **Step 6: Commit container integration**

```bash
git add server/Dockerfile compose.mock-bi.yaml .env.demo.example scripts/demo-stack.sh tests/compose-contract.test.mjs
git commit -m "chore: containerize the mock BI gateway"
```

### Task 6: Dedicated Dify Workflow and Reproducible Export

**Files:**
- Create: `dify/README.md`
- Create after export: `dify/ka-activity-analysis.yml`
- Create: `dify/analysis-output-schema.json`
- Test: `tests/dify-artifact.test.mjs`

**Interfaces:**
- Consumes: Task 2 evidence endpoint through `http://mock-bi:8787` and the output schema from Task 4.
- Produces: published Dify Workflow `快消智析·KA活动研判` and a project-contained DSL export.

- [ ] **Step 1: Add the failing artifact test and output JSON Schema**

The test must require the exported DSL to name the dedicated app, contain input variables `activity_id`, `question`, `role`, `evidence_json`, and `data_version`, include an HTTP/Code/LLM/Answer path, and contain no key-like literal.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/dify-artifact.test.mjs`

Expected: FAIL because the workflow export does not exist.

- [ ] **Step 3: Create the dedicated Workflow in local Dify**

Do not edit the earlier generic chat assistant. Configure: Start inputs → Code gate/normalization → optional activity-standard knowledge retrieval → DeepSeek LLM → Code JSON validation → End outputs. The LLM prompt must accept only `evidence_json`, cite only supplied `trace_ids`, mark hypotheses as pending verification, and repeat the stock/causality/approval boundaries.

- [ ] **Step 4: Publish and export the Workflow**

Save the exported DSL as `dify/ka-activity-analysis.yml`. Record import, publish, API-key creation, and rotation steps in `dify/README.md`; never paste the key into the file.

- [ ] **Step 5: Run artifact and live workflow checks**

Run: `node --test tests/dify-artifact.test.mjs`

Expected: PASS.

Run one normal case and one `<80%` blocked case through the service endpoint. Expected: the normal case returns all required sections and valid citations; the blocked case does not call the model and returns only data gaps and补数动作.

- [ ] **Step 6: Commit the reproducible Dify artifact**

```bash
git add dify/README.md dify/ka-activity-analysis.yml dify/analysis-output-schema.json tests/dify-artifact.test.mjs
git commit -m "feat: add dedicated KA activity Dify workflow"
```

### Task 7: Main Navigation, Data Foundation, and Activity Evidence UI

**Files:**
- Modify: `index.html:150-197`
- Modify: `index.html:197-254`
- Modify: `index.html:441-460`
- Modify: `index.html:672-674`
- Create: `activity-api.mjs`
- Create: `activity-ui.mjs`
- Create: `activity.css`
- Test: `tests/ui-contract.test.mjs`

**Interfaces:**
- Consumes: Task 2 read endpoints through `ActivityApi` methods `getDataSources()`, `listActivities()`, `getEvidence(id)`, and `getStores(id)`.
- Produces: four-stage main navigation, `page-data-foundation`, `page-activity-analysis`, `page-execution`, `page-review`, and an anonymous activity summary on `page-dash`.

- [ ] **Step 1: Write failing static UI contract tests**

Assert the four main-stage labels exist, every old `data-page` remains present once, all new sections have unique IDs, `activity-ui.mjs` loads as `type="module"` after existing business scripts, and labels `真实样例`, `匿名模拟`, and `AI 推断` are present.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/ui-contract.test.mjs`

Expected: FAIL because the new sections and scripts do not exist.

- [ ] **Step 3: Add the four-stage navigation without deleting old pages**

Make the main group contain 数据底座、AI研判、业务执行、AI经营分析. Move existing customer/detail/summary/category/budget/POS/SFA/negative-margin links into a secondary `经营数据 / 更多分析` group.

- [ ] **Step 4: Implement `ActivityApi` with explicit UI states**

Every method returns parsed JSON or throws an error with `status/code/message`. Use a default base URL `http://127.0.0.1:8787/api`; provide loading, unavailable, empty, and retry states.

- [ ] **Step 5: Render the data foundation and activity evidence pages**

Show source type, update time, grain, completeness, current version, trace IDs, metrics, store exceptions, and the stock/causality boundaries. Render API values with text nodes or the existing `esc()` helper; never inject unescaped evidence.

- [ ] **Step 6: Add responsive and keyboard behavior**

At 390px, stack stage cards and evidence sections without horizontal overflow. Ensure secondary navigation, activity selection, retry, and stage transitions are reachable by keyboard with visible focus.

- [ ] **Step 7: Run UI contract and existing server tests**

Run: `node --test tests/*.test.mjs`

Expected: PASS; no duplicate test execution failures.

- [ ] **Step 8: Commit the information architecture slice**

```bash
git add index.html activity-api.mjs activity-ui.mjs activity.css tests/ui-contract.test.mjs
git commit -m "feat: surface the KA activity data foundation"
```

### Task 8: AI Analysis, Human Tasks, Evidence Write-Back, and Review UI

**Files:**
- Modify: `activity-api.mjs`
- Create: `activity-state.mjs`
- Modify: `activity-ui.mjs`
- Modify: `activity.css`
- Modify: `app.js:87-120`
- Modify: `cockpit.js:9-23`
- Test: `tests/activity-ui-state.test.mjs`

**Interfaces:**
- Consumes: Task 3 mutation endpoints and Task 4 `/reanalyze` response.
- Produces: `runActivityAnalysis(id, question, role)`, `createActivityTask(payload)`, `updateActivityTask(id, patch)`, `submitActivityEvidence(id, payload)`, pure `reduceActivityState(state, event)`, and renderers for analysis, execution, and review states.

- [ ] **Step 1: Write failing UI state tests using injected API fakes**

Test the pure `activity-state.mjs` reducer: blocked evidence hides the model action; qualified evidence shows a warning; normal evidence exposes facts/gaps/hypotheses/checks/boundaries/citations; Dify failure preserves deterministic evidence; task transitions require human confirmation; completed evidence requires a newer `data_version`; review refuses a causal-success label when no control evidence exists.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/activity-ui-state.test.mjs`

Expected: FAIL because the state controller functions do not exist.

- [ ] **Step 3: Implement the analysis interaction**

Use the dedicated `/reanalyze` endpoint. Display running, success, blocked, and failed states. Each rendered AI item must show its citations; mark hypotheses `待验证` and keep deterministic metrics visible on failure.

- [ ] **Step 4: Replace activity-task local-only behavior with Mock API calls**

Keep legacy tasks working for old pages, but activity tasks use server IDs and exact transitions from Task 3. Require an explicit human confirmation action before creating or confirming a task.

- [ ] **Step 5: Implement evidence submission and second analysis**

Submit only fictional proof text/type/store ID, refresh evidence, display the incremented version, then let the user invoke reanalysis against that version. Reject personal information in UI copy; do not upload real photos.

- [ ] **Step 6: Implement the review page**

Show before/during/after sales, simulated margin, attributable expense, contribution observation, POS coverage, evidence coverage, resolved exceptions, Dify summary, and limitations. Use `变化观察` rather than `活动增量` unless the fixture includes a valid control comparison.

- [ ] **Step 7: Remove or rewrite conflicting fixed claims in the primary flow**

The existing phrases `连续3周`, `ERP明细3笔`, `22#促销档期订单`, fixed `3.05万`, and other unsupported primary claims must not appear in the new main flow. Old pages may retain only claims backed by their displayed source or be marked `历史演示内容`.

- [ ] **Step 8: Run UI and server tests**

Run: `node --test tests/*.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit the closed-loop UI slice**

```bash
git add activity-api.mjs activity-state.mjs activity-ui.mjs activity.css app.js cockpit.js tests/activity-ui-state.test.mjs
git commit -m "feat: complete activity analysis and review loop"
```

### Task 9: End-to-End Verification and Interview Handoff

**Files:**
- Create: `docs/KA活动AI闭环-演示说明.md`
- Create: `tests/e2e-contract.test.mjs`
- Modify: `产品说明.html`
- Modify: `答辩速查卡.html`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: one repeatable 3–5 minute demo path and verified implementation evidence.

- [ ] **Step 1: Write the end-to-end contract test**

Assert the fixture version, API health, normal analysis shape, task creation, evidence write-back, incremented version, second analysis citations, and review metrics all agree. Add a regression assertion that every original page ID from the pre-change snapshot still exists.

- [ ] **Step 2: Run the complete automated suite**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS with zero skipped tests.

- [ ] **Step 3: Perform desktop browser verification**

At 1280px, execute: 经营总览 → 数据底座 → AI研判 → 人工确认任务 → 提交模拟证据 → 二次研判 → AI经营分析. Verify no console errors, every AI citation opens or identifies a visible evidence row, and a Dify failure is transparent.

- [ ] **Step 4: Perform mobile and legacy regression verification**

At 390px, verify no horizontal overflow and keyboard focus is visible. Open every secondary legacy page, switch the existing time/region/KA filters, and verify the current NKA totals remain unchanged.

- [ ] **Step 5: Verify truth labels and secret hygiene**

Run: `rg -n "DIFY_API_KEY|Bearer [A-Za-z0-9_-]{20,}|连续3周|ERP明细3笔|22#促销档期订单" . --glob '!docs/superpowers/**' --glob '!tests/**'`

Expected: no secret match; unsupported fixed claims absent from the primary flow. Manually confirm every activity panel shows `匿名模拟` and every model result shows `AI 推断`.

- [ ] **Step 6: Update the product and interview documentation**

Document the real business flow, system boundary, Mock-to-real replacement path, Dify role, three truth labels, demo start/stop steps, and exact 3–5 minute narration. Do not report unmeasured savings, accuracy, or business uplift.

- [ ] **Step 7: Commit the verified handoff**

```bash
git add docs/KA活动AI闭环-演示说明.md tests/e2e-contract.test.mjs 产品说明.html 答辩速查卡.html
git commit -m "docs: finalize the KA activity AI demo"
```

- [ ] **Step 8: Record final verification evidence**

Save test output, the verified preview URL, Dify workflow version, data version, desktop/mobile screenshots, and remaining production gaps in the project card. Do not mark real BI integration or business impact complete.
