import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeDashboardContext } from '../server/dashboard-chat.mjs';
import { createStateStore } from '../server/state-store.mjs';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

const context = {
  scope: { range: '本月', region: '华东战区', ka: '盒马' },
  metrics: { sales: 4520900, profit: 685700, margin_rate: 15.2, volume: 49636, active_stores: 889, total_stores: 987 },
  customers: [{ name: '盒马', sales: 4520900, profit: 685700, margin_rate: 15.2 }],
  sources: [{ name: 'NKA商超.xlsx', truth_label: '真实聚合样例' }],
  gaps: ['无门店库存数据', '无逐单成本凭证']
};

function analysis(citation) {
  return {
    facts: [{ text: '当前筛选范围销售额为452.09万元', citations: [citation] }],
    data_gaps: [{ text: '没有门店库存数据', citations: ['TR-DASH-GAPS'] }],
    hypotheses: [{ text: '待验证：毛利差异可能来自客户结构', citations: ['TR-DASH-CUSTOMERS'] }],
    recommended_checks: [{ text: '先核对客户毛利口径', citations: ['TR-DASH-CUSTOMERS'] }],
    management_summary: { title: '当前范围经营核查', conclusion: '先核对口径，再决定动作' },
    boundaries: ['无库存证据不判断缺货'],
    citations: [citation, 'TR-DASH-GAPS', 'TR-DASH-CUSTOMERS']
  };
}

test('dashboard context is bounded and receives stable trace ids', () => {
  const normalized = normalizeDashboardContext(context, 'scope-001');
  assert.equal(normalized.scope.ka, '盒马');
  assert.equal(normalized.scope_fingerprint, 'scope-001');
  assert.deepEqual(normalized.trace_ids, ['TR-DASH-SCOPE', 'TR-DASH-METRICS', 'TR-DASH-CUSTOMERS', 'TR-DASH-SOURCES', 'TR-DASH-GAPS']);
  assert.throws(() => normalizeDashboardContext({ ...context, customers: Array(21).fill(context.customers[0]) }, 'scope-001'), /客户范围过大/);
  assert.throws(() => normalizeDashboardContext({ ...context, metrics: { sales: 'not-number' } }, 'scope-001'), /指标格式无效/);
});

test('dashboard chat calls Dify with current context and persists successful run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-dashboard-chat-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => 'DASH0001' });
  let captured;
  const difyClient = { configured: true, run: async inputs => { captured = inputs; return analysis('TR-DASH-METRICS'); } };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/dashboard/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '盒马当前经营表现如何？', scope_fingerprint: 'scope-001', context }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.chat_status, 'success');
    assert.equal(result.body.run.scope.ka, '盒马');
    assert.equal(captured.activity_id, 'DASHBOARD-CURRENT');
    assert.equal(JSON.parse(captured.evidence_json).metrics.sales, 4520900);
    const saved = await jsonRequest(`${base}/api/dashboard/chat-runs?scope_fingerprint=scope-001`);
    assert.equal(saved.body.runs.length, 1);
    assert.equal(saved.body.runs[0].analysis.management_summary.title, '当前范围经营核查');
  });
});

test('dashboard chat answers selected-store monthly POS through the deterministic data tool', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-dashboard-pos-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => 'DASHPOS1' });
  let difyCalled = false;
  const difyClient = { configured: true, run: async () => { difyCalled = true; return analysis('TR-DASH-METRICS'); } };
  const selectedContext = {
    ...context,
    selected_store: { store_id: 'STORE-HD', store_name: '上海市·浦东新区·大润发·沪东店', cycle_id: 'PROMO-WK14' }
  };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/dashboard/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '这家店上月POS是多少？', scope_fingerprint: 'scope-pos-001', context: selectedContext })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.chat_status, 'success');
    assert.equal(result.body.run.answer_source, 'deterministic_pos_tool');
    assert.match(result.body.run.analysis.management_summary.conclusion, /126,000元/);
    assert.equal(result.body.run.context.store_pos_query.sales, 126000);
    assert.equal(difyCalled, false);
  });
});

test('dashboard chat rejects malformed context and unknown Dify citations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-dashboard-invalid-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => 'DASH0002' });
  const difyClient = { configured: true, run: async () => analysis('TR-UNKNOWN') };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const malformed = await jsonRequest(`${base}/api/dashboard/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '分析', scope_fingerprint: 'scope-001', context: { metrics: {} } }) });
    assert.equal(malformed.response.status, 400);
    const invalidCitation = await jsonRequest(`${base}/api/dashboard/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '分析', scope_fingerprint: 'scope-001', context }) });
    assert.equal(invalidCitation.body.chat_status, 'failed');
    assert.match(invalidCitation.body.run.error.message, /未知证据/);
  });
});
