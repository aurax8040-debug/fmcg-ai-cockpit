import { assertPromoDemoQuestion } from './nka-promo-demo.mjs';
import { assertSafeId } from './domain.mjs';
import { summarizeActivity } from './metrics.mjs';
import { errorStatus, isLoopbackOrigin, readJson, sendJson } from './http-utils.mjs';
import { validateAnalysis } from './analysis-contract.mjs';
import { executeInvestigationTools, planInvestigation } from './investigation-agent.mjs';
import { normalizeDashboardContext } from './dashboard-chat.mjs';
import { summarizeEvaluation } from './evaluation-metrics.mjs';
import { summarizeStoreExecution } from './store-execution.mjs';
import { summarizeWeekendPromo } from './weekend-promo-review.mjs';
import { executeWeekendPromoTools, planWeekendPromoReview } from './weekend-promo-agent.mjs';
import { resolveMonthlyStorePos } from './store-pos-query.mjs';

function notFound(message = '接口不存在') {
  const error = new Error(message);
  error.code = 'NOT_FOUND';
  return error;
}

function splitPath(pathname) {
  return pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

export function createApp({ dataset, stateStore, difyClient = { configured: false, run: async () => { throw new Error('Dify尚未配置'); } } }) {
  return async function app(req, res) {
    const origin = req.headers.origin || '';
    try {
      if (req.method === 'OPTIONS') {
        if (!isLoopbackOrigin(origin)) return sendJson(res, 403, { error: { code: 'ORIGIN_FORBIDDEN', message: '仅允许本机预览调用' } });
        return sendJson(res, 204, {}, origin);
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      const parts = splitPath(url.pathname);
      if (parts[0] !== 'api') throw notFound();
      const snapshot = stateStore?.snapshot?.() || { data_version: dataset.dataset_version, tasks: [], evidence: [], analyses: [], agent_runs: [], dashboard_chats: [] };

      if (req.method === 'GET' && parts[1] === 'health' && parts.length === 2) {
        return sendJson(res, 200, { status: 'ok', data_version: snapshot.data_version, dify_configured: Boolean(difyClient.configured) }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'data-sources' && parts.length === 2) {
        return sendJson(res, 200, { source_type: dataset.source_type, as_of: dataset.as_of, data_version: snapshot.data_version, sources: dataset.data_sources }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'activities' && parts.length === 2) {
        const activities = dataset.activities.map(row => {
          const evidence = summarizeActivity(dataset, row.id, snapshot);
          return { ...evidence.activity, source_type: evidence.source_type, completeness: evidence.completeness, gate: evidence.gate, data_version: evidence.data_version };
        });
        return sendJson(res, 200, { source_type: dataset.source_type, as_of: dataset.as_of, data_version: snapshot.data_version, activities }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'tasks' && parts.length === 2) {
        return sendJson(res, 200, { data_version: snapshot.data_version, tasks: snapshot.tasks }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'analyses' && parts.length === 2) {
        const activityId = url.searchParams.get('activity_id');
        const analyses = activityId ? snapshot.analyses.filter(row => row.activity_id === activityId) : snapshot.analyses;
        return sendJson(res, 200, { data_version: snapshot.data_version, analyses }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'agent-runs' && parts.length === 2) {
        const activityId = url.searchParams.get('activity_id');
        const runs = activityId ? snapshot.agent_runs.filter(row => row.activity_id === activityId) : snapshot.agent_runs;
        return sendJson(res, 200, { data_version: snapshot.data_version, runs }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'agents' && parts[2] === 'store-watchlist' && parts.length === 3) {
        const activityId = assertSafeId(url.searchParams.get('activity_id') || 'ACT-KA-A-001', 'activity_id');
        return sendJson(res, 200, summarizeStoreExecution(dataset, activityId), origin);
      }
      if (req.method === 'GET' && parts[1] === 'weekend-promos' && parts[2] === 'current' && parts.length === 3) {
        const cycleId = assertSafeId(url.searchParams.get('cycle_id') || 'PROMO-WK14', 'cycle_id');
        return sendJson(res, 200, summarizeWeekendPromo(dataset, snapshot, cycleId), origin);
      }
      if (req.method === 'POST' && parts[1] === 'weekend-promos' && parts[2] === 'investigate' && parts.length === 3) {
        const payload = await readJson(req);
        const cycleId = assertSafeId(payload.cycle_id || 'PROMO-WK14', 'cycle_id');
        const storeId = assertSafeId(payload.store_id, 'store_id');
        const review = summarizeWeekendPromo(dataset, snapshot, cycleId);
        const store = review.stores.find(row => row.store_id === storeId);
        if (!store) throw notFound('门店不存在');
        const promoQuestion=payload.question || '分析本次临促执行差距并生成下周验证计划';
        if(cycleId==='PROMO-HEMA-WK42')assertPromoDemoQuestion(promoQuestion);
        const plan = planWeekendPromoReview(promoQuestion, store);
        const trace = executeWeekendPromoTools(plan, store).map(row => ({
          ...row,
          trace_id: `TR-${cycleId}-${storeId}-${row.tool}`
        }));
        const evidenceTraceIds = [...new Set([...store.trace_ids, ...trace.map(row => row.trace_id)])];
        try {
          const raw = await difyClient.run({
            activity_id: cycleId,
            question: `本次临促复盘，仅回答所选门店的活动表现、SFA证据与下周验证建议；拒绝预算及普通客户经营问题。周末临促受控Agent：${plan.question}\n只能根据BI确定性指标、当前门店SFA证据和匿名对标聚合回答；不得重算指标、暴露对标门店明细或声称因果。`,
            role: 'NKA客户经理',
            evidence_json: JSON.stringify({ data_version: snapshot.data_version, trace_ids: evidenceTraceIds, cycle: review.cycle, rule: review.rule, authorization: review.authorization, store, agent_context: { plan, trace } }),
            data_version: String(snapshot.data_version)
          });
          const analysis = validateAnalysis(raw, evidenceTraceIds);
          const saved = await stateStore.recordAgentRun({ activity_id: cycleId, question: plan.question, status: 'success', data_version: snapshot.data_version, plan, trace, analysis });
          const scopeFingerprint = String(payload.scope_fingerprint || `weekend|${cycleId}|${storeId}`).slice(0, 100);
          const chat = await stateStore.recordDashboardChat({
            question: plan.question, status: 'success', scope_fingerprint: scopeFingerprint,
            scope: { range: review.cycle.label, region: store.region || '华东战区', ka: store.ka_system || '当前KA' },
            context: { context_type: 'weekend_promo', selected_store: { store_id: store.store_id, store_name: store.store_name, cycle_id: cycleId }, store, cycle: review.cycle },
            answer_source: 'dify_weekend_agent', trace, analysis
          });
          return sendJson(res, 200, { agent_status: 'success', run: saved.run, chat_run: chat.run, store }, origin);
        } catch (error) {
          const agentError = { code: error.code || 'AGENT_ERROR', message: error.message };
          const saved = await stateStore.recordAgentRun({ activity_id: cycleId, question: plan.question, status: 'failed', data_version: snapshot.data_version, plan, trace, error: agentError });
          return sendJson(res, 200, { agent_status: 'failed', run: saved.run, store }, origin);
        }
      }
      if (req.method === 'GET' && parts[1] === 'dashboard' && parts[2] === 'chat-runs' && parts.length === 3) {
        const fingerprint = url.searchParams.get('scope_fingerprint');
        const runs = fingerprint ? snapshot.dashboard_chats.filter(row => row.scope_fingerprint === fingerprint) : snapshot.dashboard_chats;
        return sendJson(res, 200, { data_version: snapshot.data_version, runs }, origin);
      }
      if (req.method === 'GET' && parts[1] === 'dashboard' && parts[2] === 'evaluation-metrics' && parts.length === 3) {
        return sendJson(res, 200, { metrics: summarizeEvaluation(snapshot.dashboard_chats) }, origin);
      }
      if (req.method === 'PATCH' && parts[1] === 'dashboard' && parts[2] === 'chat-runs' && parts[3] && parts[4] === 'feedback' && parts.length === 5) {
        return sendJson(res, 200, await stateStore.recordChatFeedback(parts[3], await readJson(req)), origin);
      }
      if (req.method === 'POST' && parts[1] === 'dashboard' && parts[2] === 'chat-runs' && parts[3] && parts[4] === 'task-events' && parts.length === 5) {
        return sendJson(res, 200, await stateStore.recordChatTaskEvent(parts[3], await readJson(req)), origin);
      }
      if (req.method === 'POST' && parts[1] === 'dashboard' && parts[2] === 'chat' && parts.length === 3) {
        const payload = await readJson(req);
        const question = String(payload.question || '').trim();
        const recordType = payload.record_type === 'frozen_evaluation' ? 'frozen_evaluation' : 'usage';
        if (!question || question.length > 1000) {
          const error = new Error('问题不能为空且不能超过1000字');
          error.code = 'INVALID_INPUT';
          throw error;
        }
        const context = normalizeDashboardContext(payload.context, payload.scope_fingerprint);
        const startedAt = Date.now();
        const posTool = resolveMonthlyStorePos(dataset, question, context, '2026-10-19');
        if (posTool) {
          const toolContext = { ...context, store_pos_query: posTool.tool_result };
          const saved = await stateStore.recordDashboardChat({ question, status: 'success', record_type: recordType, scope_fingerprint: context.scope_fingerprint, scope: context.scope, context: toolContext, answer_source: posTool.answer_source, trace: posTool.trace_id ? [{ tool: 'store_monthly_pos', label: '查询门店月度POS', trace_id: posTool.trace_id }] : [], analysis: posTool.analysis, duration_ms: Date.now() - startedAt });
          return sendJson(res, 200, { chat_status: 'success', run: saved.run }, origin);
        }
        try {
          const raw = await difyClient.run({
            activity_id: 'DASHBOARD-CURRENT',
            question: `驾驶舱当前筛选问题：${question}\n请严格基于当前scope、metrics、customers、sources和gaps回答。`,
            role: '经营管理者',
            evidence_json: JSON.stringify(context),
            data_version: context.data_version
          });
          const analysis = validateAnalysis(raw, context.trace_ids);
          const saved = await stateStore.recordDashboardChat({ question, status: 'success', record_type: recordType, scope_fingerprint: context.scope_fingerprint, scope: context.scope, context, analysis, duration_ms: Date.now() - startedAt });
          return sendJson(res, 200, { chat_status: 'success', run: saved.run }, origin);
        } catch (error) {
          const chatError = { code: error.code || 'DASHBOARD_CHAT_ERROR', message: error.message };
          const saved = await stateStore.recordDashboardChat({ question, status: 'failed', record_type: recordType, scope_fingerprint: context.scope_fingerprint, scope: context.scope, context, error: chatError, duration_ms: Date.now() - startedAt });
          return sendJson(res, 200, { chat_status: 'failed', run: saved.run }, origin);
        }
      }
      if (req.method === 'POST' && parts[1] === 'agents' && parts[2] === 'investigate' && parts.length === 3) {
        const payload = await readJson(req);
        const activityId = assertSafeId(payload.activity_id, 'activity_id');
        if (!dataset.activities.some(row => row.id === activityId)) throw notFound('活动不存在');
        const evidence = summarizeActivity(dataset, activityId, stateStore.snapshot());
        const plan = planInvestigation(payload.question);
        const trace = executeInvestigationTools(plan, evidence);
        try {
          const raw = await difyClient.run({ activity_id: activityId, question: `受控核查Agent问题：${plan.question}\n已调用工具：${trace.map(row => row.label).join('、')}\n不可用工具：${plan.unavailable.map(row => row.reason).join('、') || '无'}`, role: '经营管理者', evidence_json: JSON.stringify({ ...evidence, agent_context: { plan, trace } }), data_version: String(evidence.data_version) });
          const analysis = validateAnalysis(raw, evidence.trace_ids);
          const saved = await stateStore.recordAgentRun({ activity_id: activityId, question: plan.question, status: 'success', data_version: evidence.data_version, plan, trace, analysis });
          return sendJson(res, 200, { agent_status: 'success', run: saved.run }, origin);
        } catch (error) {
          const agentError = { code: error.code || 'AGENT_ERROR', message: error.message };
          const saved = await stateStore.recordAgentRun({ activity_id: activityId, question: plan.question, status: 'failed', data_version: evidence.data_version, plan, trace, error: agentError });
          return sendJson(res, 200, { agent_status: 'failed', run: saved.run }, origin);
        }
      }
      if (parts[1] === 'activities' && parts[2]) {
        const activityId = assertSafeId(parts[2], 'activity_id');
        if (!dataset.activities.some(row => row.id === activityId)) throw notFound('活动不存在');
        if (req.method === 'GET' && parts[3] === 'evidence' && parts.length === 4) {
          return sendJson(res, 200, summarizeActivity(dataset, activityId, snapshot), origin);
        }
        if (req.method === 'GET' && parts[3] === 'stores' && parts.length === 4) {
          const evidence = summarizeActivity(dataset, activityId, snapshot);
          return sendJson(res, 200, { source_type: evidence.source_type, as_of: evidence.as_of, data_version: evidence.data_version, completeness: evidence.completeness, trace_ids: evidence.trace_ids, stores: evidence.stores }, origin);
        }
        if (req.method === 'POST' && parts[3] === 'evidence' && parts.length === 4) {
          const payload = await readJson(req);
          assertSafeId(payload.store_id, 'store_id');
          if (!dataset.stores.some(row => row.id === payload.store_id)) throw notFound('门店不存在');
          const result = await stateStore.addEvidence(activityId, payload);
          return sendJson(res, 201, result, origin);
        }
        if (req.method === 'POST' && parts[3] === 'reanalyze' && parts.length === 4) {
          const payload = await readJson(req);
          const latest = stateStore?.snapshot?.() || snapshot;
          const evidence = summarizeActivity(dataset, activityId, latest);
          const question = String(payload.question || '请分析当前活动');
          const role = String(payload.role || '经营管理者');
          if (!evidence.gate.allow_ai) {
            const saved = await stateStore.recordAnalysis({ activity_id: activityId, status: 'blocked', data_version: evidence.data_version, question, role });
            return sendJson(res, 200, { ai_status: 'blocked', analysis: null, evidence, analysis_record: saved.record }, origin);
          }
          try {
            const raw = await difyClient.run({
              activity_id: activityId,
              question,
              role,
              evidence_json: JSON.stringify(evidence),
              data_version: String(evidence.data_version)
            });
            const analysis = validateAnalysis(raw, evidence.trace_ids);
            const saved = await stateStore.recordAnalysis({ activity_id: activityId, status: 'success', data_version: evidence.data_version, question, role, analysis });
            return sendJson(res, 200, { ai_status: 'success', analysis, evidence, analysis_record: saved.record }, origin);
          } catch (error) {
            const aiError = { code: error.code || 'DIFY_ERROR', message: error.message };
            const saved = await stateStore.recordAnalysis({ activity_id: activityId, status: 'failed', data_version: evidence.data_version, question, role, error: aiError });
            return sendJson(res, 200, { ai_status: 'failed', analysis: null, ai_error: aiError, evidence, analysis_record: saved.record }, origin);
          }
        }
      }
      if (req.method === 'POST' && parts[1] === 'tasks' && parts.length === 2) {
        const payload = await readJson(req);
        assertSafeId(payload.activity_id, 'activity_id');
        if (!dataset.activities.some(row => row.id === payload.activity_id)) throw notFound('活动不存在');
        return sendJson(res, 201, await stateStore.createTask(payload), origin);
      }
      if (req.method === 'PATCH' && parts[1] === 'tasks' && parts[2] && parts.length === 3) {
        const taskId = assertSafeId(parts[2], 'task_id');
        return sendJson(res, 200, await stateStore.updateTask(taskId, await readJson(req)), origin);
      }
      throw notFound();
    } catch (error) {
      return sendJson(res, errorStatus(error), { error: { code: error.code || 'INTERNAL_ERROR', message: error.message } }, origin);
    }
  };
}
