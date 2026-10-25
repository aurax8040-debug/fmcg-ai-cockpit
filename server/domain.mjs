import { readFile } from 'node:fs/promises';

const idPattern = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

export function assertSafeId(value, label = 'id') {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    const error = new Error(`${label}格式无效`);
    error.code = 'INVALID_ID';
    throw error;
  }
  return value;
}

function unique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = row[key];
    if (seen.has(value)) throw new Error(`${label}存在重复${key}: ${value}`);
    seen.add(value);
  }
  return seen;
}

export function loadFixture(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  const required = ['ka_customers', 'skus', 'stores', 'activities', 'pos_daily', 'marketing_resources', 'execution_evidence', 'erp_shipments', 'promoter_shifts', 'sfa_visits', 'display_checks', 'quality_checks', 'store_activity_history', 'competitor_events', 'data_sources'];
  for (const key of required) if (!Array.isArray(data[key])) throw new Error(`缺少数组字段: ${key}`);
  const kaIds = unique(data.ka_customers, 'id', '客户');
  const skuIds = unique(data.skus, 'id', 'SKU');
  const storeIds = unique(data.stores, 'id', '门店');
  const activityIds = unique(data.activities, 'id', '活动');
  unique(data.pos_daily, 'trace_id', 'POS记录');
  unique(data.execution_evidence, 'id', '执行证据');
  for (const activity of data.activities) {
    assertSafeId(activity.id, 'activity_id');
    if (!kaIds.has(activity.ka_id)) throw new Error(`活动引用未知客户: ${activity.ka_id}`);
    for (const storeId of activity.planned_store_ids) if (!storeIds.has(storeId)) throw new Error(`活动引用未知门店: ${storeId}`);
  }
  for (const store of data.stores) if (!kaIds.has(store.ka_id)) throw new Error(`门店引用未知客户: ${store.ka_id}`);
  for (const row of data.pos_daily) {
    if (!storeIds.has(row.store_id) || !skuIds.has(row.sku_id)) throw new Error(`POS引用未知门店或SKU: ${row.trace_id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`POS日期无效: ${row.trace_id}`);
  }
  for (const row of [...data.marketing_resources, ...data.execution_evidence]) {
    if (!activityIds.has(row.activity_id)) throw new Error(`记录引用未知活动: ${row.id}`);
  }
  return data;
}

export async function loadFixtureFile(filePath) {
  return loadFixture(await readFile(filePath, 'utf8'));
}
