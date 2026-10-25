import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadFixture } from '../server/domain.mjs';
import { evaluateCompleteness, summarizeActivity } from '../server/metrics.mjs';

const fixturePath = new URL('../demo-data/ka-a-activity.json', import.meta.url);
const dataset = loadFixture(await readFile(fixturePath, 'utf8'));

test('fixture_has_no_real_customer_identity', () => {
  assert.deepEqual(dataset.ka_customers.map(row => row.id), ['KA-A']);
  assert.ok(dataset.stores.length >= 10);
  assert.ok(dataset.activities.every(row => row.ka_id === 'KA-A'));
  assert.ok(dataset.stores.every(row => row.ka_id === 'KA-A'));
});

test('summary_reconciles_sales_cost_and_activity_expense', () => {
  const summary = summarizeActivity(dataset, 'ACT-KA-A-001');
  const during = dataset.pos_daily.filter(row => row.date >= '2026-10-01' && row.date <= '2026-10-14');
  const expectedSales = during.reduce((sum, row) => sum + row.sales, 0);
  const costMap = new Map(dataset.skus.map(row => [row.id, row.unit_cost]));
  const expectedCost = during.reduce((sum, row) => sum + row.qty * costMap.get(row.sku_id), 0);
  const expectedExpense = dataset.marketing_resources.reduce((sum, row) => sum + row.expense, 0);
  assert.equal(summary.metrics.periods.during.sales, expectedSales);
  assert.equal(summary.metrics.periods.during.cost, expectedCost);
  assert.equal(summary.metrics.activity_margin, expectedSales - expectedCost);
  assert.equal(summary.metrics.activity_expense, expectedExpense);
  assert.equal(summary.metrics.contribution_observation, expectedSales - expectedCost - expectedExpense);
});

test('coverage_boundaries_match_spec', () => {
  assert.equal(evaluateCompleteness({ pos_store_coverage: 79.9, cost_available: true, execution_coverage: 100 }).mode, 'blocked');
  assert.equal(evaluateCompleteness({ pos_store_coverage: 80, cost_available: true, execution_coverage: 100 }).mode, 'qualified');
  assert.equal(evaluateCompleteness({ pos_store_coverage: 94.9, cost_available: true, execution_coverage: 100 }).mode, 'qualified');
  assert.equal(evaluateCompleteness({ pos_store_coverage: 95, cost_available: true, execution_coverage: 100 }).mode, 'normal');
});

test('missing_cost_blocks_only_profit', () => {
  const gate = evaluateCompleteness({ pos_store_coverage: 100, cost_available: false, execution_coverage: 100 });
  assert.equal(gate.allow_ai, true);
  assert.equal(gate.allow_profit, false);
  assert.equal(gate.allow_execution_judgment, true);
});

test('missing_execution_blocks_only_execution_judgment', () => {
  const gate = evaluateCompleteness({ pos_store_coverage: 100, cost_available: true, execution_coverage: 75 });
  assert.equal(gate.allow_ai, true);
  assert.equal(gate.allow_profit, true);
  assert.equal(gate.allow_execution_judgment, false);
});
