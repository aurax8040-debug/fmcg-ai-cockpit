import test from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './helpers.mjs';
import { resolveMonthlyStorePos } from '../server/store-pos-query.mjs';

const selected = { selected_store: { store_id: 'STORE-HD', store_name: '上海市·浦东新区·大润发·沪东店', cycle_id: 'PROMO-WK14' } };

test('monthly POS tool resolves explicit and selected store questions', () => {
  const explicit = resolveMonthlyStorePos(dataset, '上海大润发沪东店上月POS是多少？', selected, '2026-10-19');
  assert.equal(explicit.tool_result.sales, 126000);
  assert.equal(explicit.tool_result.change_pct, -8);
  assert.equal(explicit.answer_source, 'deterministic_pos_tool');
  const pronoun = resolveMonthlyStorePos(dataset, '这家店上月销售额是多少？', selected, '2026-10-19');
  assert.equal(pronoun.tool_result.store_id, 'STORE-HD');
});

test('monthly POS tool refuses to invent absent months and ignores unrelated questions', () => {
  const missing = resolveMonthlyStorePos(dataset, '沪东店2026年7月POS是多少？', selected, '2026-10-19');
  assert.equal(missing.tool_result.status, 'unavailable');
  assert.match(missing.analysis.management_summary.conclusion, /不能生成或推算/);
  assert.equal(resolveMonthlyStorePos(dataset, '为什么陈列不达标？', selected, '2026-10-19'), null);
});
