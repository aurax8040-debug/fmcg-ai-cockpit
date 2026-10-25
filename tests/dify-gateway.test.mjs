import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDifyClient } from '../server/dify-client.mjs';
import { validateAnalysis } from '../server/analysis-contract.mjs';
import { createStateStore } from '../server/state-store.mjs';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

function validAnalysis(citation) {
  return {
    facts: [{ text: '活动期POS已覆盖全部计划门店', citations: [citation] }],
    data_gaps: [{ text: '3家门店仍缺执行证据', citations: [citation] }],
    hypotheses: [{ text: 'A10门店活动期销量下降，原因待核查', citations: [citation] }],
    recommended_checks: [{ text: '核查A10门店执行', citations: [citation], role: '战区销售' }],
    management_summary: { title: '活动执行仍需补证', conclusion: '先核查再调整资源' },
    boundaries: ['无库存数据，不判断缺货', '前后变化不代表因果增量'],
    citations: [citation]
  };
}

test('analysis contract accepts known citations and rejects unknown ones', () => {
  assert.equal(validateAnalysis(validAnalysis('TR-ACT-001'), ['TR-ACT-001']).citations[0], 'TR-ACT-001');
  assert.throws(() => validateAnalysis(validAnalysis('TR-UNKNOWN'), ['TR-ACT-001']), /未知证据/);
  assert.throws(() => validateAnalysis('not-json', ['TR-ACT-001']), /有效JSON/);
});

test('analysis contract normalizes cited boundary objects to display-safe strings', () => {
  const analysis = validAnalysis('TR-POS-STORE-A01-2026-10-01-SKU-GOLD');
  analysis.boundaries = [{ text: '无有效对照不声称因果增量', citations: analysis.citations }];
  assert.deepEqual(validateAnalysis(analysis, analysis.citations).boundaries, ['无有效对照不声称因果增量']);
});

test('Dify client sends blocking workflow inputs and handles timeout', async () => {
  let body;
  const client = createDifyClient({ baseUrl: 'http://dify/v1', apiKey: 'test-key', fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ data: { outputs: { analysis: validAnalysis('TR-ACT-001') } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const output = await client.run({ activity_id: 'ACT-KA-A-001' });
  assert.equal(body.response_mode, 'blocking');
  assert.equal(body.user, 'fmcg-demo');
  assert.equal(output.citations[0], 'TR-ACT-001');

  const timed = createDifyClient({ baseUrl: 'http://dify/v1', apiKey: 'test-key', timeoutMs: 5, fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
  await assert.rejects(() => timed.run({}), error => error.code === 'DIFY_TIMEOUT');
});

test('Dify client surfaces failed workflow status instead of returning empty outputs', async () => {
  const client = createDifyClient({ baseUrl: 'http://dify/v1', apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({
    data: { status: 'failed', outputs: {}, error: 'evidence data_version mismatch' }
  }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(() => client.run({}), error => error.code === 'DIFY_WORKFLOW_FAILED' && /data_version mismatch/.test(error.message));
});

test('reanalyze preserves deterministic evidence on AI failures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-dify-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json') });
  const difyClient = { configured: true, async run() { return validAnalysis('TR-UNKNOWN'); } };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/reanalyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '活动效果如何', role: 'NKA客户经理' }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ai_status, 'failed');
    assert.equal(result.body.analysis, null);
    assert.equal(result.body.evidence.activity.id, 'ACT-KA-A-001');
    assert.equal(result.body.ai_error.code, 'INVALID_AI_OUTPUT');
  });
});

test('blocked evidence does not call Dify', async () => {
  const sparse = structuredClone(dataset);
  sparse.pos_daily = sparse.pos_daily.filter(row => !['STORE-A10', 'STORE-A11', 'STORE-A12'].includes(row.store_id) || row.date < '2026-10-01');
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-dify-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json') });
  let calls = 0;
  const difyClient = { configured: true, async run() { calls += 1; return validAnalysis('TR-ACT-001'); } };
  await withServer(createApp({ dataset: sparse, stateStore: store, difyClient }), async base => {
    const result = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/reanalyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(result.body.ai_status, 'blocked');
    assert.equal(calls, 0);
  });
});
