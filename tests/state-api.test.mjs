import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStateStore } from '../server/state-store.mjs';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

test('state transitions persist and invalid transitions do not mutate state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-state-'));
  const filePath = join(dir, 'state.json');
  let seq = 0;
  const store = await createStateStore({ filePath, idFactory: () => `0000000${++seq}` });
  const created = await store.createTask({ activity_id: 'ACT-KA-A-001', title: '核查A10门店', owner_role: '战区销售', due_date: '2026-10-23' });
  assert.equal(created.task.status, '草稿');
  await assert.rejects(() => store.updateTask(created.task.id, { status: '执行中' }), error => error.code === 'INVALID_TRANSITION');
  await store.updateTask(created.task.id, { status: '已确认' });
  await store.updateTask(created.task.id, { status: '执行中' });
  await assert.rejects(() => store.updateTask(created.task.id, { status: '待补证', proof: '' }), error => error.code === 'INVALID_INPUT');
  await store.updateTask(created.task.id, { status: '待补证', proof: '匿名模拟证据：已核查陈列' });
  await store.updateTask(created.task.id, { status: '已完成', review: '已补证，等待经营复盘' });
  const reloaded = await createStateStore({ filePath });
  assert.equal(reloaded.snapshot().tasks[0].status, '已完成');
  assert.doesNotReject(() => readFile(filePath, 'utf8'));
});

test('evidence writes serialize, increment versions, and appear in later evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-state-'));
  let seq = 0;
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => `ABCDEF0${++seq}` });
  const writes = await Promise.all([
    store.addEvidence('ACT-KA-A-001', { store_id: 'STORE-A10', type: '战区核查', note: '匿名模拟证据一' }),
    store.addEvidence('ACT-KA-A-001', { store_id: 'STORE-A11', type: '第三方补证', note: '匿名模拟证据二' })
  ]);
  assert.deepEqual(writes.map(row => row.data_version), [2, 3]);
  await withServer(createApp({ dataset, stateStore: store }), async base => {
    const evidence = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/evidence`);
    assert.equal(evidence.body.data_version, 3);
    assert.ok(evidence.body.trace_ids.some(id => id.startsWith('TR-RUN-')));
    assert.equal(evidence.body.completeness.execution_coverage, 91.7);
  });
});

test('analysis records persist with data versions and reload safely', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-analysis-'));
  const filePath = join(dir, 'state.json');
  const store = await createStateStore({ filePath, idFactory: () => 'ANALYSIS1' });
  const saved = await store.recordAnalysis({ activity_id: 'ACT-KA-A-001', status: 'success', data_version: 1, role: '经营管理者', question: '分析活动', analysis: { management_summary: { title: '先补证' } } });
  assert.equal(saved.record.id, 'AN-ANALYSIS');
  assert.equal(saved.record.data_version, 1);
  const reloaded = await createStateStore({ filePath });
  assert.equal(reloaded.snapshot().analyses[0].analysis.management_summary.title, '先补证');
});

test('task and evidence mutation endpoints validate inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-state-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => '12345678' });
  await withServer(createApp({ dataset, stateStore: store }), async base => {
    const missing = await jsonRequest(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity_id: 'ACT-KA-A-001' }) });
    assert.equal(missing.response.status, 400);
    const created = await jsonRequest(`${base}/api/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity_id: 'ACT-KA-A-001', title: '活动执行核查', owner_role: '战区销售', due_date: '2026-10-23' }) });
    assert.equal(created.response.status, 201);
    const bad = await jsonRequest(`${base}/api/tasks/${created.body.task.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: '已完成' }) });
    assert.equal(bad.response.status, 409);
  });
});
