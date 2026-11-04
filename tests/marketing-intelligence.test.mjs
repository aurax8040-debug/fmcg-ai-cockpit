// 四 Agent 联合分析端到端验收测试。
// 覆盖：完整门店 S001、部分缺失门店 S019、纯缺失门店 S025；
// store_id 一致、证据可追溯、缺失正确 PARTIAL、无串店越权。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMiDataset } from '../server/marketing-intelligence/dataset.mjs';
import { jointAnalysis, listStores } from '../server/marketing-intelligence/agents.mjs';

let ds;
test.before(async () => { ds = await loadMiDataset(); });

test('数据集完整且标注 DEMO_MOCK', () => {
  assert.equal(ds.meta.data_nature, 'DEMO_MOCK');
  assert.equal(ds.stores.length, 28);
  assert.equal(ds.skus.length, 24);
  assert.equal(ds.activities.length, 9);
  assert.equal(ds.pos_sales.length, 49488);
  assert.equal(ds.sfa_visits.length, 324);
});

test('完整门店 S001：四路 COMPLETE，store_id 一致，达成率可算', () => {
  const r = jointAnalysis(ds, { storeId: 'S001', activityId: 'WP202601' });
  assert.equal(r.meta.overall_status, 'COMPLETE');
  assert.equal(r.agents.pos_bi.status, 'COMPLETE');
  assert.equal(r.agents.sfa.status, 'COMPLETE');
  assert.equal(r.agents.tpm.status, 'COMPLETE');
  assert.equal(r.integrity.store_id_consistent, true);
  assert.equal(r.integrity.no_cross_store, true);
  assert.equal(r.agents.pos_bi.store_id, 'S001');
  assert.equal(r.agents.sfa.store_id, 'S001');
  assert.equal(r.agents.tpm.store_id, 'S001');
  assert.ok(r.metrics.target_sales_amount > 0);
  assert.ok(r.metrics.achievement_rate > 0);
});

test('部分缺失门店 S019：POS 缺失标 PARTIAL，缺失日可追溯', () => {
  const r = jointAnalysis(ds, { storeId: 'S019', activityId: 'WP202603' });
  assert.equal(r.meta.overall_status, 'PARTIAL');
  assert.equal(r.agents.pos_bi.status, 'PARTIAL');
  assert.equal(r.agents.pos_bi.missing_load_dates.length, 1);
  assert.equal(r.agents.pos_bi.missing_load_dates[0].sales_date, '2026-09-13');
  assert.equal(r.integrity.missing_as_partial, true);
  // POS 缺失不按零销售：仍有大量 POS 明细
  assert.ok(r.agents.pos_bi.pos_line_count > 0);
});

test('纯缺失门店 S025：三路全 PARTIAL，is_bare_missing', () => {
  const r = jointAnalysis(ds, { storeId: 'S025' });
  assert.equal(r.meta.overall_status, 'PARTIAL');
  assert.equal(r.meta.is_bare_missing, true);
  assert.equal(r.agents.pos_bi.status, 'PARTIAL');
  assert.equal(r.agents.sfa.status, 'PARTIAL');
  assert.equal(r.agents.tpm.status, 'PARTIAL');
  assert.equal(r.agents.pos_bi.pos_line_count, 0);
  assert.equal(r.agents.sfa.visit_count, 0);
});

test('越权/串店防护：不存在的门店抛 NOT_FOUND', () => {
  assert.throws(() => jointAnalysis(ds, { storeId: 'S999' }), /门店不存在/);
});

test('证据可追溯：S001 至少有一路 trace', () => {
  const r = jointAnalysis(ds, { storeId: 'S001', activityId: 'WP202601' });
  assert.equal(r.integrity.evidence_traceable, true);
  assert.ok(r.agents.sfa.evidence.trace.length > 0 || r.agents.tpm.evidence.trace.length > 0);
});

test('门店列表：28 家，S001 COMPLETE，S019/S025 PARTIAL', () => {
  const stores = listStores(ds);
  assert.equal(stores.length, 28);
  assert.equal(stores.find(s => s.store_id === 'S001').status, 'COMPLETE');
  assert.equal(stores.find(s => s.store_id === 'S019').status, 'PARTIAL');
  assert.equal(stores.find(s => s.store_id === 'S025').status, 'PARTIAL');
});

test('Dify 沿用现有知识库（不新建）', () => {
  const r = jointAnalysis(ds, { storeId: 'S001', activityId: 'WP202601' });
  assert.equal(r.dify_hook.uses_existing_kb, true);
  assert.match(r.dify_hook.kb_ref, /知识库|knowledge/i);
});
