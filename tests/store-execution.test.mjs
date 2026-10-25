import test from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './helpers.mjs';
import { summarizeStoreExecution } from '../server/store-execution.mjs';

test('store execution watchlist ranks A10 using cross-module evidence without claiming causality', () => {
  const result = summarizeStoreExecution(dataset, 'ACT-KA-A-001');
  const alert = result.alerts[0];
  assert.equal(alert.store_id, 'STORE-A10');
  assert.equal(alert.pos.change_pct, -14.6);
  assert.equal(alert.promoter.attendance_rate, 67.9);
  assert.equal(alert.display.actual_location, '果蔬区普通货架');
  assert.equal(alert.quality.hardness, '合格');
  assert.equal(alert.competitor.radius_km, 2);
  assert.ok(alert.reasons.includes('有效在岗不足'));
  assert.ok(alert.reasons.includes('陈列位置降级'));
});
