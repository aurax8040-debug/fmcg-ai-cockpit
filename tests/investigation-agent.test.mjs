import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planInvestigation, executeInvestigationTools } from '../server/investigation-agent.mjs';
import { summarizeActivity } from '../server/metrics.mjs';
import { createStateStore } from '../server/state-store.mjs';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

function analysis(citation) {
  return { facts: [{ text: 'A10活动期销售低于前后期', citations: [citation] }], data_gaps: [{ text: '无库存证据', citations: [citation] }], hypotheses: [{ text: '执行差异待核查', citations: [citation] }], recommended_checks: [{ text: '核查A10执行证据', citations: [citation] }], management_summary: { title: '先核查再决策', conclusion: '不判断缺货' }, boundaries: ['无库存不判断缺货'], citations: [citation] };
}

test('controlled agent selects tools by question and stops inventory inference', () => {
  const plan = planInvestigation('为什么A10门店活动期销售下降，是否缺货？');
  for (const tool of ['activity_plan', 'store_pos', 'execution_evidence', 'activity_expense', 'promoter_attendance', 'sfa_display', 'product_quality', 'store_history', 'competitor_event']) assert.ok(plan.tools.includes(tool));
  assert.match(plan.unavailable[0].reason, /没有门店库存工具/);
  const evidence = summarizeActivity(dataset, 'ACT-KA-A-001', { data_version: 1, tasks: [], evidence: [] });
  const trace = executeInvestigationTools(plan, evidence);
  assert.equal(trace.length, 9);
  assert.equal(trace.every(row => row.status === 'success'), true);
});

test('agent API persists tool trace and structured Dify result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-agent-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => 'AGENT001' });
  const difyClient = { configured: true, run: async inputs => analysis(JSON.parse(inputs.evidence_json).trace_ids[0]) };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/agents/investigate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity_id: 'ACT-KA-A-001', question: '为什么A10门店活动期销售下降？' }) });
    assert.equal(result.body.agent_status, 'success');
    assert.ok(result.body.run.trace.some(row => row.tool === 'store_pos'));
    assert.ok(result.body.run.trace.some(row => row.tool === 'promoter_attendance'));
    assert.ok(result.body.run.trace.some(row => row.tool === 'competitor_event'));
    const saved = await jsonRequest(`${base}/api/agent-runs?activity_id=ACT-KA-A-001`);
    assert.equal(saved.body.runs.length, 1);
    assert.equal(saved.body.runs[0].analysis.management_summary.title, '先核查再决策');
  });
});
