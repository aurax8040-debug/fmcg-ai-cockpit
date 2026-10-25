import { summarizeStoreExecution } from './store-execution.mjs';

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function periodFor(date, activity) {
  if (date >= activity.before_start && date <= activity.before_end) return 'before';
  if (date >= activity.start_date && date <= activity.end_date) return 'during';
  if (date >= activity.after_start && date <= activity.after_end) return 'after';
  return null;
}

export function evaluateCompleteness(input) {
  const posCoverage = Number(input.pos_store_coverage ?? input.completeness?.pos_store_coverage ?? 0);
  const costAvailable = input.cost_available ?? input.completeness?.cost_available ?? false;
  const executionCoverage = Number(input.execution_coverage ?? input.completeness?.execution_coverage ?? 0);
  const mode = posCoverage < 80 ? 'blocked' : posCoverage < 95 ? 'qualified' : 'normal';
  return {
    mode,
    allow_ai: mode !== 'blocked',
    allow_profit: Boolean(costAvailable),
    allow_execution_judgment: executionCoverage >= 95,
    reasons: [
      ...(mode === 'blocked' ? ['POS门店覆盖低于80%，仅允许补数任务'] : []),
      ...(mode === 'qualified' ? ['POS门店覆盖在80%—95%之间，只允许待验证假设'] : []),
      ...(!costAvailable ? ['缺少模拟成本，阻断活动毛利与贡献观察'] : []),
      ...(executionCoverage < 95 ? ['执行证据覆盖不足，不判断执行好坏'] : [])
    ]
  };
}

export function summarizeActivity(dataset, activityId, runtime = {}) {
  const activity = dataset.activities.find(row => row.id === activityId);
  if (!activity) {
    const error = new Error('活动不存在');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const skuMap = new Map(dataset.skus.map(row => [row.id, row]));
  const planned = new Set(activity.planned_store_ids);
  const rows = dataset.pos_daily.filter(row => planned.has(row.store_id)).map(row => ({ ...row, period: periodFor(row.date, activity) })).filter(row => row.period);
  const periodMetrics = Object.fromEntries(['before', 'during', 'after'].map(period => {
    const scoped = rows.filter(row => row.period === period);
    const sales = scoped.reduce((sum, row) => sum + row.sales, 0);
    const qty = scoped.reduce((sum, row) => sum + row.qty, 0);
    const costAvailable = scoped.every(row => Number.isFinite(skuMap.get(row.sku_id)?.unit_cost));
    const cost = costAvailable ? scoped.reduce((sum, row) => sum + row.qty * skuMap.get(row.sku_id).unit_cost, 0) : null;
    return [period, { sales: round(sales), qty, cost: cost === null ? null : round(cost), margin: cost === null ? null : round(sales - cost) }];
  }));
  const duringStores = new Set(rows.filter(row => row.period === 'during').map(row => row.store_id));
  const evidenceRows = [...dataset.execution_evidence, ...(runtime.evidence || [])].filter(row => row.activity_id === activityId);
  const evidencedStores = new Set(evidenceRows.map(row => row.store_id));
  const posCoverage = round(duringStores.size / planned.size * 100, 1);
  const executionCoverage = round(evidencedStores.size / planned.size * 100, 1);
  const costAvailable = periodMetrics.during.cost !== null;
  const expense = round(dataset.marketing_resources.filter(row => row.activity_id === activityId).reduce((sum, row) => sum + row.expense, 0));
  const duringMargin = periodMetrics.during.margin;
  const contribution = duringMargin === null ? null : round(duringMargin - expense);
  const completeness = { pos_store_coverage: posCoverage, execution_coverage: executionCoverage, cost_available: costAvailable };
  const gate = evaluateCompleteness(completeness);
  const storeRows = activity.planned_store_ids.map(storeId => {
    const scoped = rows.filter(row => row.store_id === storeId);
    const sums = Object.fromEntries(['before', 'during', 'after'].map(period => [period, round(scoped.filter(row => row.period === period).reduce((sum, row) => sum + row.sales, 0))]));
    return { store_id: storeId, ...sums, pos_available: duringStores.has(storeId), evidence_status: evidenceRows.find(row => row.store_id === storeId)?.status || '缺少证据' };
  });
  const storeExecution = summarizeStoreExecution(dataset, activityId);
  const traceIds = [...new Set([
    activity.trace_id,
    ...rows.map(row => row.trace_id),
    ...dataset.marketing_resources.filter(row => row.activity_id === activityId).map(row => row.trace_id),
    ...evidenceRows.map(row => row.trace_id),
    ...storeExecution.alerts.flatMap(row => row.trace_ids)
  ].filter(Boolean))];
  const dataGaps = [];
  if (posCoverage < 100) dataGaps.push(`${planned.size - duringStores.size}家计划门店缺少活动期POS数据`);
  if (executionCoverage < 100) dataGaps.push(`${planned.size - evidencedStores.size}家计划门店缺少执行证据`);
  if (!costAvailable) dataGaps.push('缺少模拟成本，无法计算活动毛利与贡献观察');
  return {
    activity: { id: activity.id, ka_id: activity.ka_id, name: activity.name, type: activity.type, start_date: activity.start_date, end_date: activity.end_date, planned_stores: planned.size, status: activity.status },
    source_type: dataset.source_type,
    as_of: dataset.as_of,
    data_version: runtime.data_version || dataset.dataset_version,
    completeness,
    gate,
    facts: [
      `活动覆盖${planned.size}家匿名门店`,
      `活动期POS覆盖${posCoverage}%`,
      `执行证据覆盖${executionCoverage}%`
    ],
    data_gaps: dataGaps,
    metrics: { periods: periodMetrics, activity_expense: expense, activity_margin: duringMargin, contribution_observation: contribution },
    stores: storeRows,
    store_execution: storeExecution,
    trace_ids: traceIds
  };
}
