import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dataset } from './helpers.mjs';
import { summarizeWeekendPromo } from '../server/weekend-promo-review.mjs';
import { planWeekendPromoReview, executeWeekendPromoTools } from '../server/weekend-promo-agent.mjs';
import { createApp } from '../server/app.mjs';
import { createStateStore } from '../server/state-store.mjs';
import { withServer, jsonRequest } from './helpers.mjs';

test('controlled agent uses only current-week POS SFA resource and anonymous peer tools', () => {
  const review = summarizeWeekendPromo(dataset, { tasks: [] }, 'PROMO-WK14');
  const store = review.stores.find(row => row.store_id === 'STORE-HD');
  const plan = planWeekendPromoReview('分析本周未达标原因并生成下周计划', store);
  for (const tool of ['pos_result', 'promo_resource', 'sfa_visit', 'sfa_quality', 'sfa_promoter_issue', 'peer_benchmark']) assert.ok(plan.tools.includes(tool));
  for (const forbidden of ['erp', 'inventory', 'competitor_event']) assert.equal(plan.tools.includes(forbidden), false);
  const trace = executeWeekendPromoTools(plan, store);
  const peer = trace.find(row => row.tool === 'peer_benchmark').output;
  assert.equal(peer.sample_size >= 5, true);
  assert.equal(JSON.stringify(peer).includes('store_name'), false);
});

test('agent refuses normal stores because BI only sends problem stores for analysis', () => {
  const review = summarizeWeekendPromo(dataset, { tasks: [] }, 'PROMO-WK14');
  const normal = review.stores.find(row => row.issue_status === '达标');
  assert.throws(() => planWeekendPromoReview('分析门店', normal), /只分析BI规则识别的未达标门店/);
});

test('weekend promo API exposes BI summary without requiring an AI call', async () => {
  const stateStore = { snapshot: () => ({ data_version: 1, tasks: [], analyses: [], agent_runs: [], dashboard_chats: [] }) };
  await withServer(createApp({ dataset, stateStore }), async base => {
    const result = await jsonRequest(`${base}/api/weekend-promos/current?cycle_id=PROMO-WK14`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.summary.planned_store_count, 8);
    assert.equal(result.body.stores.find(row => row.store_id === 'STORE-HD').ai_eligible, true);
  });
});

test('weekend promo API sends Dify a versioned evidence package with allowed trace ids', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-weekend-dify-'));
  const stateStore = await createStateStore({ filePath: join(dir, 'state.json') });
  let received;
  const difyClient = { configured: true, async run(inputs) {
    received = inputs;
    const evidence = JSON.parse(inputs.evidence_json);
    const citation = evidence.trace_ids[0];
    return {
      facts: [{ text: '本周POS未达标', citations: [citation] }],
      data_gaps: [], hypotheses: [],
      recommended_checks: [{ text: '下周复核陈列执行', citations: [citation] }],
      boundaries: ['对标差异不等于因果'],
      management_summary: { title: '优先核查执行差距', conclusion: '销售确认后生成拜访待办' },
      citations: [citation]
    };
  } };
  await withServer(createApp({ dataset, stateStore, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/weekend-promos/investigate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cycle_id: 'PROMO-WK14', store_id: 'STORE-HD', question: '分析差距' })
    });
    assert.equal(result.body.agent_status, 'success');
  });
  const evidence = JSON.parse(received.evidence_json);
  assert.equal(String(evidence.data_version), received.data_version);
  assert.ok(evidence.trace_ids.includes('POS-PROMO-WK14-STORE-HD'));
  assert.ok(evidence.trace_ids.includes('TR-PROMO-WK14-STORE-HD-peer_benchmark'));
});
