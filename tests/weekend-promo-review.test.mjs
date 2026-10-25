import test from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './helpers.mjs';
import { summarizeWeekendPromo } from '../server/weekend-promo-review.mjs';

test('BI summary calculates the whole weekly promo result before AI analysis', () => {
  const review = summarizeWeekendPromo(dataset, { tasks: [] }, 'PROMO-WK14');
  assert.equal(review.cycle.id, 'PROMO-WK14');
  assert.equal(review.cycle.pos_latency, 'T+1');
  assert.equal(review.rule.daily_target_yuan, 5000);
  assert.equal(review.rule.demo_only, true);
  assert.equal(review.summary.planned_store_count, 8);
  assert.equal(review.summary.actual_store_count, 8);
  assert.equal(review.summary.target_total, 80000);
  assert.equal(review.summary.pos_total > 0, true);
  assert.equal(review.summary.evaluated_store_count, 8);
  assert.equal(review.summary.achieved_store_count, 7);
  assert.equal(review.summary.store_achievement_rate, 87.5);
  assert.equal(review.summary.problem_store_count >= 1, true);
  assert.equal(review.summary.ai_candidate_count, review.summary.problem_store_count);
});

test('problem store is compared with anonymous achieved peers and current-week SFA', () => {
  const review = summarizeWeekendPromo(dataset, { tasks: [] }, 'PROMO-WK14');
  const store = review.stores.find(row => row.store_id === 'STORE-HD');
  assert.equal(store.store_name, '上海市·浦东新区·大润发·沪东店');
  assert.equal(store.current_pos, 7200);
  assert.equal(store.previous_pos, 8500);
  assert.equal(store.target, 10000);
  assert.equal(store.achievement_rate, 72);
  assert.equal(store.issue_status, '未达标');
  assert.equal(store.ai_eligible, true);
  assert.equal(store.sfa.display_area_sqm, 2);
  assert.equal(store.sfa.display_position, '果蔬区普通货架');
  assert.equal(store.sfa.distributed_skus, 4);
  assert.equal(store.benchmark.scope, '同KA·同等级·同临促天数');
  assert.equal(store.benchmark.sample_size >= 5, true);
  assert.equal(store.benchmark.peer_store_names, undefined);
  assert.equal(store.gaps.some(row => row.key === 'display_area_sqm'), true);
  assert.equal(JSON.stringify(store).includes('ERP'), false);
  assert.equal(JSON.stringify(store).includes('库存'), false);
});

test('missing POS is not converted to zero or treated as a normal miss', () => {
  const copy = structuredClone(dataset);
  copy.weekend_promo_results = copy.weekend_promo_results.filter(row => row.store_id !== 'STORE-HD');
  const review = summarizeWeekendPromo(copy, { tasks: [] }, 'PROMO-WK14');
  const store = review.stores.find(row => row.store_id === 'STORE-HD');
  assert.equal(store.current_pos, null);
  assert.equal(store.achievement_rate, null);
  assert.equal(store.issue_status, '数据不完整');
  assert.equal(store.ai_eligible, false);
});

test('peer details remain anonymous while aggregate benchmark is available', () => {
  const review = summarizeWeekendPromo(dataset, { tasks: [] }, 'PROMO-WK14');
  const serialized = JSON.stringify(review);
  assert.equal(serialized.includes('peer_store_names'), false);
  assert.equal(review.authorization.detail_scope, '当前用户授权门店');
  assert.equal(review.authorization.peer_scope, '权限外门店仅匿名聚合');
});
