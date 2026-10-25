import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStateStore } from '../server/state-store.mjs';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

function analysisFrom(inputs) {
  const evidence = JSON.parse(inputs.evidence_json);
  const citation = evidence.trace_ids[0];
  return {
    facts: [{ text: '活动期销售高于活动前，但仅为变化观察', citations: [citation] }],
    data_gaps: [{ text: '缺少库存与有效对照证据', citations: [citation] }],
    hypotheses: [{ text: '执行差异可能影响门店表现，待验证', citations: [citation] }],
    recommended_checks: [{ text: '优先补齐缺失门店执行证据', citations: [citation] }],
    boundaries: ['无库存数据不判断缺货', '无有效对照不声称因果增量'],
    management_summary: { title: '先补证再决策', conclusion: '保持当前资源不自动调整，由人工核查。' },
    citations: [citation]
  };
}

test('activity loop keeps evidence, AI citations, tasks, and versions consistent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-e2e-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => 'E2E00001' });
  const difyClient = { configured: true, run: async inputs => analysisFrom(inputs) };
  await withServer(createApp({ dataset, stateStore: store, difyClient }), async base => {
    const health = await jsonRequest(`${base}/api/health`);
    assert.deepEqual(health.body, { status: 'ok', data_version: 1, dify_configured: true });

    const first = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/reanalyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '研判活动', role: '经营管理者' }) });
    assert.equal(first.body.ai_status, 'success');
    assert.equal(first.body.analysis_record.data_version, 1);
    assert.ok(first.body.evidence.trace_ids.includes(first.body.analysis.citations[0]));

    const persisted = await jsonRequest(`${base}/api/analyses?activity_id=ACT-KA-A-001`);
    assert.equal(persisted.body.analyses.length, 1);
    assert.equal(persisted.body.analyses[0].analysis.management_summary.title, '先补证再决策');

    const task = await jsonRequest(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity_id: 'ACT-KA-A-001', title: '补齐执行证据', owner_role: '战区销售', due_date: '2026-10-24' }) });
    assert.equal(task.body.task.status, '草稿');

    const evidence = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/evidence`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ store_id: 'STORE-A10', type: '战区巡店核查', note: '匿名模拟：执行证据已补充' }) });
    assert.equal(evidence.body.data_version, 2);

    const second = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/reanalyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '基于新版本复盘', role: '经营管理者' }) });
    assert.equal(second.body.evidence.data_version, 2);
    assert.equal(second.body.analysis_record.data_version, 2);
    assert.equal(second.body.evidence.completeness.execution_coverage, 83.3);
    assert.ok(second.body.evidence.trace_ids.includes(second.body.analysis.citations[0]));
    assert.equal(second.body.evidence.metrics.contribution_observation, second.body.evidence.metrics.activity_margin - second.body.evidence.metrics.activity_expense);
  });
});

test('all original analysis pages remain in the single work', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['page-dash', 'page-why', 'page-store', 'page-ka', 'page-bi-detail', 'page-bi-month', 'page-bi-customer', 'page-bi-region', 'page-bi-cate', 'page-budget', 'page-pos', 'page-ai', 'page-brief']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
});
