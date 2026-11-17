// 加载 Marketing Intelligence 四 Agent Mock 数据集，并做基础完整性校验。
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultPath = join(dirname(dirname(here)), 'demo-data', 'marketing-intelligence', 'mi-dataset.json');

export async function loadMiDataset(filePath = process.env.MI_DATASET || defaultPath) {
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  const required = ['stores', 'skus', 'activities', 'participants', 'targets', 'expenses', 'sfa_visits', 'pos_sales', 'pos_loads'];
  for (const key of required) {
    if (!Array.isArray(raw[key])) throw new Error(`MI数据集缺少数组字段: ${key}`);
  }
  if (raw.meta?.data_nature !== 'DEMO_MOCK') throw new Error('MI数据集未标注 DEMO_MOCK');

  // 主键唯一性快速校验
  const storeIds = new Set(raw.stores.map(s => s.store_id));
  const skuIds = new Set(raw.skus.map(s => s.sku_id));
  const actIds = new Set(raw.activities.map(a => a.activity_id));
  if (storeIds.size !== raw.stores.length) throw new Error('store_id 主键不唯一');
  if (skuIds.size !== raw.skus.length) throw new Error('sku_id 主键不唯一');
  if (actIds.size !== raw.activities.length) throw new Error('activity_id 主键不唯一');

  // 外键完整性：POS/SFA/TPM 的 store_id 必须存在于 stores
  for (const row of raw.pos_sales) if (!storeIds.has(row.store_id)) throw new Error(`POS孤儿门店: ${row.pos_row_id}`);
  for (const row of raw.sfa_visits) if (!storeIds.has(row.store_id)) throw new Error(`SFA孤儿门店: ${row.execution_id}`);
  for (const row of raw.participants) if (!storeIds.has(row.store_id)) throw new Error(`TPM孤儿门店: ${row.campaign_store_id}`);

  return { ...raw, storeIds, skuIds, actIds };
}
