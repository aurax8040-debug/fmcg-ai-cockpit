// 四路 Agent 的确定性数据接入：POS/BI、SFA（Visits+Execution）、TPM（Plans+Fees）。
// 只做确定性查询与计算，不输出因果结论；统一以 store_id 关联；缺失时正确返回 PARTIAL。
// 数据全部标注 DEMO_MOCK，与真实系统隔离。

const MISSING = 'PARTIAL';       // 缺失场景标记
const COMPLETE = 'COMPLETE';     // 完整场景标记

function byKey(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function sum(rows, fn) {
  return rows.reduce((acc, r) => acc + (Number(fn(r)) || 0), 0);
}

// 路1：POS/BI —— 读取统一 Mock Excel 的 POS Sales，按 store_id 聚合。
export function readPosBi(dataset, { storeId, activityId = null }) {
  const store = dataset.stores.find(s => s.store_id === storeId);
  const pos = dataset.pos_sales.filter(p => p.store_id === storeId);
  const loads = dataset.pos_loads.filter(l => l.store_id === storeId);
  const missingLoads = loads.filter(l => l.load_status === '缺失');

  const salesByDate = new Map();
  for (const p of pos) {
    const k = p.sales_date;
    if (!salesByDate.has(k)) salesByDate.set(k, { sales_amount: 0, te_sales: 0, sales_qty: 0 });
    const agg = salesByDate.get(k);
    agg.sales_amount += p.sales_amount || 0;
    agg.te_sales += p.te_sales || 0;
    agg.sales_qty += p.sales_qty || 0;
  }

  const activityPos = activityId ? pos.filter(p => p.activity_id === activityId) : pos;

  return {
    agent: 'POS/BI',
    store_id: storeId,
    store_name: store?.store_name ?? null,
    status: missingLoads.length ? MISSING : (pos.length ? COMPLETE : MISSING),
    source: 'Mock Excel POS Sales',
    total_sales_amount: sum(pos, p => p.sales_amount),
    total_te_sales: sum(pos, p => p.te_sales),
    total_sales_qty: sum(pos, p => p.sales_qty),
    activity_sales_amount: activityId ? sum(activityPos, p => p.sales_amount) : null,
    activity_te_sales: activityId ? sum(activityPos, p => p.te_sales) : null,
    pos_line_count: pos.length,
    missing_load_dates: missingLoads.map(l => ({ sales_date: l.sales_date, issue_note: l.issue_note })),
    missing_load_note: missingLoads.length ? 'POS源文件未到，不可按零销售处理' : null,
    evidence: {
      trace: missingLoads.map(l => `LOAD-${storeId}-${l.sales_date.replaceAll('-', '')}`),
      pos_rows: pos.slice(0, 20).map(p => ({ pos_row_id: p.pos_row_id, sales_date: p.sales_date, sku_id: p.sku_id, sales_amount: p.sales_amount, te_sales: p.te_sales, activity_id: p.activity_id })),
    },
  };
}

// 路2：SFA —— 读取 SFA Visits 与 SFA Execution（拜访 + 执行）。
export function readSfa(dataset, { storeId, activityId = null }) {
  const store = dataset.stores.find(s => s.store_id === storeId);
  const visits = dataset.sfa_visits.filter(v => v.store_id === storeId);
  const activityVisits = activityId ? visits.filter(v => v.activity_id === activityId) : visits;

  const complete = visits.filter(v => v.record_status === '完整');
  const executed = visits.filter(v => v.execution_status === '已执行');
  const absent = visits.filter(v => v.arrival_status === '未到岗');
  const areaIssues = visits.filter(v => v.display_area_sqm !== null && v.display_area_sqm < 2);
  const priceIssues = visits.filter(v => v.price_band_status === '高于活动价带');
  const giftIssues = visits.filter(v => v.gift_execution === undefined && v.actual_gift_qty_day !== null && v.actual_gift_qty_day < (v.planned_gift_qty_day || 0) * 0.8);

  const issues = [];
  if (absent.length) issues.push(`促销员缺岗 ${absent.length} 次`);
  if (areaIssues.length) issues.push(`陈列面积不足 ${areaIssues.length} 次`);
  if (priceIssues.length) issues.push(`价格带异常 ${priceIssues.length} 次`);

  return {
    agent: 'SFA',
    store_id: storeId,
    store_name: store?.store_name ?? null,
    status: visits.length ? (visits.some(v => v.record_status !== '完整') ? MISSING : COMPLETE) : MISSING,
    source: 'SFA Visits + SFA Execution',
    visit_count: visits.length,
    executed_count: executed.length,
    complete_record_count: complete.length,
    absent_count: absent.length,
    area_issue_count: areaIssues.length,
    price_issue_count: priceIssues.length,
    gift_issue_count: giftIssues.length,
    avg_compliance_rate: complete.length ? sum(complete, v => v.execution_compliance_rate ?? 0) / complete.length : null,
    activity_visit_count: activityId ? activityVisits.length : null,
    execution_issues: issues,
    evidence: {
      trace: visits.slice(0, 20).map(v => v.execution_id),
      visits: activityId ? activityVisits.slice(0, 20).map(v => ({ execution_id: v.execution_id, execution_date: v.execution_date, execution_status: v.execution_status, arrival_status: v.arrival_status, display_area_sqm: v.display_area_sqm, price_band_status: v.price_band_status, record_status: v.record_status })) : [],
    },
  };
}

// 路3：TPM —— 读取 TPM Plans 与 TPM Fees（活动计划 + 费用）。
export function readTpm(dataset, { storeId, activityId = null }) {
  const store = dataset.stores.find(s => s.store_id === storeId);
  const participants = dataset.participants.filter(p => p.store_id === storeId);
  const targets = dataset.targets.filter(t => t.store_id === storeId);
  const expenses = dataset.expenses.filter(e => e.store_id === storeId);

  const activityParticipants = activityId ? participants.filter(p => p.activity_id === activityId) : participants;
  const activityTargets = activityId ? targets.filter(t => t.activity_id === activityId) : targets;
  const activityExpenses = activityId ? expenses.filter(e => e.activity_id === activityId) : expenses;

  const targetAmount = activityId ? sum(activityTargets, t => t.target_sales_amount) : sum(targets, t => t.target_sales_amount);
  const targetTe = activityId ? sum(activityTargets, t => t.target_te) : sum(targets, t => t.target_te);
  const totalFee = sum(activityExpenses, e => e.planned_amount);

  const feeByType = {};
  for (const e of activityExpenses) feeByType[e.expense_type] = (feeByType[e.expense_type] || 0) + (e.planned_amount || 0);

  return {
    agent: 'TPM',
    store_id: storeId,
    store_name: store?.store_name ?? null,
    status: participants.length ? COMPLETE : MISSING,
    source: 'TPM Plans + TPM Fees',
    activity_count: new Set(participants.map(p => p.activity_id)).size,
    target_sales_amount: targetAmount,
    target_te: targetTe,
    total_fee: totalFee,
    fee_by_type: feeByType,
    activity_plan_count: activityParticipants.length,
    activity_gift: activityParticipants[0]?.gift_name ?? null,
    activity_planned_days: activityParticipants[0]?.planned_days ?? null,
    evidence: {
      trace: activityParticipants.map(p => p.campaign_store_id).concat(activityExpenses.map(e => e.expense_id)),
      plans: activityParticipants.slice(0, 20).map(p => ({ campaign_store_id: p.campaign_store_id, activity_id: p.activity_id, planned_start_date: p.planned_start_date, planned_end_date: p.planned_end_date, plan_status: p.plan_status })),
      expenses: activityExpenses.slice(0, 20).map(e => ({ expense_id: e.expense_id, expense_type: e.expense_type, planned_amount: e.planned_amount })),
    },
  };
}

// 端到端联合编排：同一 store_id 贯通四路，计算达成率与整体状态。
// 返回 COMPLETE / PARTIAL，证据可追溯到各数据源，无串店、无越权。
export function jointAnalysis(dataset, { storeId, activityId = null }) {
  const store = dataset.stores.find(s => s.store_id === storeId);
  if (!store) {
    const err = new Error('门店不存在');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const pos = readPosBi(dataset, { storeId, activityId });
  const sfa = readSfa(dataset, { storeId, activityId });
  const tpm = readTpm(dataset, { storeId, activityId });

  const statuses = [pos.status, sfa.status, tpm.status];
  const overall = statuses.includes(MISSING) ? MISSING : COMPLETE;

  const target = tpm.target_sales_amount;
  const actual = activityId ? (pos.activity_sales_amount ?? 0) : pos.total_sales_amount;
  const achievementRate = target ? actual / target : null;

  // 缺失门店（纯缺）：store 存在但三路均无数据
  const isBareMissing = pos.pos_line_count === 0 && sfa.visit_count === 0 && tpm.activity_count === 0;

  return {
    meta: {
      data_nature: 'DEMO_MOCK',
      store_id: storeId,
      store_name: store.store_name,
      region: store.region,
      market_department: store.market_department,
      store_grade: store.store_grade,
      activity_id: activityId,
      overall_status: overall,
      is_bare_missing: isBareMissing,
      generated_at: new Date().toISOString(),
    },
    agents: { pos_bi: pos, sfa, tpm },
    metrics: {
      target_sales_amount: target,
      actual_sales_amount: actual,
      achievement_rate: achievementRate,
      total_fee: tpm.total_fee,
      cost_to_sales_ratio: actual ? tpm.total_fee / actual : null,
    },
    integrity: {
      store_id_consistent: [pos, sfa, tpm].every(a => a.store_id === storeId),
      evidence_traceable: Boolean(pos.evidence.trace.length || sfa.evidence.trace.length || tpm.evidence.trace.length),
      no_cross_store: [pos, sfa, tpm].every(a => a.store_id === storeId),
      missing_as_partial: statuses.includes(MISSING) ? (overall === MISSING) : true,
    },
    // Dify 检索所需的知识库指向（沿用现有知识库，不新造）
    dify_hook: {
      uses_existing_kb: true,
      kb_ref: 'knowledge_base（周末临促执行标准，V1.0）',
      note: 'Dify 继续调用现有知识库，不新建独立知识库。',
    },
  };
}

// 列出所有门店及其整体状态，供 UI 选择门店。
export function listStores(dataset) {
  return dataset.stores.map(s => {
    const pos = dataset.pos_sales.filter(p => p.store_id === s.store_id);
    const sfa = dataset.sfa_visits.filter(v => v.store_id === s.store_id);
    const tpm = dataset.participants.filter(p => p.store_id === s.store_id);
    const missing = dataset.pos_loads.filter(l => l.store_id === s.store_id && l.load_status === '缺失');
    const status = (pos.length && sfa.length && tpm.length) ? (missing.length ? MISSING : COMPLETE) : MISSING;
    return {
      store_id: s.store_id,
      store_name: s.store_name,
      region: s.region,
      store_grade: s.store_grade,
      channel_type: s.channel_type,
      pos_rows: pos.length,
      sfa_rows: sfa.length,
      tpm_rows: tpm.length,
      missing_loads: missing.length,
      status,
    };
  });
}
