// 构建 Marketing Intelligence Platform 四 Agent 联合分析的 Mock 数据集。
// 数据源：Codex 2026-11-01 产出的 V2 csv_full（虚构模拟数据）。
// 输出：demo-data/marketing-intelligence/mi-dataset.json，带 DEMO_MOCK 标注。
// 只读源 CSV，不修改原始 POS/SFA/TPM 文件与正式 Excel/SQLite。
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = '/Users/liuxiaohua/Documents/Codex/2026-11-01/referenced-chatgpt-conversation-this-is-an-2/outputs/bi_ai_weekend_promo_mock_v2/csv_full';
const OUT_DIR = new URL('../demo-data/marketing-intelligence/', import.meta.url).pathname;

const DEMO_MOCK = 'DEMO_MOCK';

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

async function load(name) {
  return parseCsv(await fs.readFile(path.join(SRC, `${name}.csv`), 'utf8'));
}

const n = v => (v === '' || v === null || v === undefined) ? null : Number(v);
const ymd = s => String(s).slice(0, 10);

const [storesRaw, skusRaw, activitiesRaw, participantsRaw, targetsRaw, expensesRaw, sfaRaw, posRaw, loadsRaw] = await Promise.all([
  load('门店维度'), load('SKU维度'), load('TPM_活动方案'), load('TPM_参与门店'),
  load('TPM_目标'), load('TPM_费用'), load('SFA_每日执行'), load('POS_T+1销售'), load('POS_加载状态')
]);

// 追加 V3 新增的 4 家“普通样例店”（在 V2 csv 之外，由 V3 构建脚本追加）
const extraStores = [
  { store_id: 'S025', city: '北京', region: '华北战区', market_department: '北京市场部', store_grade: 'A', KA_customer: '盒马' },
  { store_id: 'S026', city: '成都', region: '西部战区', market_department: '成都市场部', store_grade: 'B', KA_customer: '永辉' },
  { store_id: 'S027', city: '杭州', region: '华东战区', market_department: '杭州市场部', store_grade: 'B', KA_customer: '大润发' },
  { store_id: 'S028', city: '深圳', region: '华南战区', market_department: '深圳市场部', store_grade: 'A', KA_customer: '沃尔玛' },
];

const stores = storesRaw.map(s => ({
  store_id: s.store_id,
  store_name: s.store_name,
  city: s.market_area ? `${s.marketing_dept}` : s.marketing_dept,
  region: s.warzone,
  market_department: s.marketing_dept,
  channel_type: 'KA商超',
  store_grade: s.store_grade,
  store_format: s.store_format,
  active_flag: true,
  data_nature: DEMO_MOCK,
})).concat(extraStores.map(s => ({
  store_id: s.store_id,
  store_name: `${s.city}${s.store_grade}级普通样例店`,
  city: s.city,
  region: s.region,
  market_department: s.market_department,
  channel_type: '普通零售',
  store_grade: s.store_grade,
  store_format: '大卖场',
  active_flag: true,
  data_nature: DEMO_MOCK,
})));

const skus = skusRaw.map(s => ({
  sku_id: s.sku_id,
  sku_name: s.sku_display_name,
  category: s.category,
  pack_count: n(s.pack_count),
  spec: n(s.spec),
  pack_mode: s.pack_mode,
  te_factor: n(s.te_factor),
  list_price: n(s.list_price),
  data_nature: DEMO_MOCK,
}));

const activities = activitiesRaw.map(c => ({
  activity_id: c.campaign_id,
  activity_name: c.campaign_name,
  activity_type: c.campaign_type,
  start_date: c.start_date,
  end_date: c.end_date,
  review_date: c.review_date,
  approval_status: c.approval_status,
  data_nature: DEMO_MOCK,
}));

const participants = participantsRaw.map(p => ({
  campaign_store_id: p.campaign_store_id,
  activity_id: p.campaign_id,
  store_id: p.store_id,
  planned_start_date: p.planned_start_date,
  planned_end_date: p.planned_end_date,
  planned_days: n(p.planned_days),
  planned_promoter_id: p.planned_promoter_id,
  gift_name: p.gift_name,
  planned_gift_qty: n(p.planned_gift_qty),
  plan_status: p.plan_status,
  data_nature: DEMO_MOCK,
}));

const targets = targetsRaw.map(t => ({
  target_id: t.target_id,
  activity_id: t.campaign_id,
  store_id: t.store_id,
  target_te: n(t.target_te),
  target_sales_amount: n(t.target_sales_amount),
  target_period: t.target_period,
  target_status: t.target_status,
  data_nature: DEMO_MOCK,
}));

const expenses = expensesRaw.map(e => ({
  expense_id: e.expense_id,
  activity_id: e.campaign_id,
  store_id: e.store_id,
  expense_type: e.expense_type,
  planned_amount: n(e.planned_amount),
  currency: e.currency,
  expense_status: e.expense_status,
  data_nature: DEMO_MOCK,
}));

const sfaVisits = sfaRaw.map(x => ({
  execution_id: x.execution_id,
  activity_id: x.campaign_id,
  store_id: x.store_id,
  execution_date: x.execution_date,
  promoter_id: x.promoter_id,
  record_status: x.record_status,
  execution_status: x.execution_status,
  arrival_status: x.arrival_status,
  checkin_time: x.checkin_time,
  checkout_time: x.checkout_time,
  display_position: x.display_position,
  display_area_sqm: x.display_area_sqm === '' ? null : n(x.display_area_sqm),
  price_band_status: x.price_band_status,
  required_price_band: x.required_price_band,
  gift_name: x.gift_name,
  planned_gift_qty_day: n(x.planned_gift_qty_day),
  actual_gift_qty_day: x.actual_gift_qty_day === '' ? null : n(x.actual_gift_qty_day),
  execution_compliance_rate: x.execution_compliance_rate === '' ? null : n(x.execution_compliance_rate),
  exception_reason: x.exception_reason,
  data_nature: DEMO_MOCK,
}));

const posSales = posRaw.map(p => ({
  pos_row_id: p.pos_row_id,
  sales_date: p.sales_date,
  month: p.month,
  store_id: p.store_id,
  sku_id: p.sku_id,
  sku_name: p.sku_display_name,
  category: p.category,
  pack_count: n(p.pack_count),
  spec: n(p.spec),
  te_factor: n(p.te_factor),
  sales_qty: n(p.sales_qty),
  unit_price: n(p.unit_price),
  sales_amount: n(p.sales_amount),
  te_sales: n(p.te_sales),
  activity_id: p.campaign_id || null,
  data_latency: p.data_latency,
  data_nature: DEMO_MOCK,
}));

const posLoads = loadsRaw.map(l => ({
  load_id: l.load_id,
  store_id: l.store_id,
  sales_date: l.sales_date,
  expected_sku_rows: n(l.expected_sku_rows),
  actual_sku_rows: n(l.actual_sku_rows),
  load_status: l.load_status,
  issue_note: l.issue_note,
  data_nature: DEMO_MOCK,
}));

const dataset = {
  meta: {
    name: 'Marketing Intelligence Platform 四 Agent 联合分析 Mock 数据集',
    data_nature: DEMO_MOCK,
    disclaimer: '全部数据均为虚构模拟数据，不代表任何真实企业、客户、门店、人员或经营结果。未连接真实 TPM/SFA/POS/Dify 知识库之外的任何企业系统。',
    source: 'Codex 2026-11-01 V2 csv_full（BI_AI_Weekend_Promo_Mock_Data_V3_Compatible.xlsx 同源）',
    generated_at: '2026-11-03',
    counts: {
      stores: stores.length,
      skus: skus.length,
      activities: activities.length,
      participants: participants.length,
      targets: targets.length,
      expenses: expenses.length,
      sfa_visits: sfaVisits.length,
      pos_sales: posSales.length,
      pos_loads: posLoads.length,
    },
  },
  stores,
  skus,
  activities,
  participants,
  targets,
  expenses,
  sfa_visits: sfaVisits,
  pos_sales: posSales,
  pos_loads: posLoads,
};

await fs.mkdir(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'mi-dataset.json');
await fs.writeFile(outPath, JSON.stringify(dataset, null, 2), 'utf8');

console.log(JSON.stringify({ out: outPath, counts: dataset.meta.counts, bytes: (await fs.stat(outPath)).size }, null, 2));
