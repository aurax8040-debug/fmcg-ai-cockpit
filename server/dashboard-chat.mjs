const TRACE_IDS = Object.freeze(['TR-DASH-SCOPE', 'TR-DASH-METRICS', 'TR-DASH-CUSTOMERS', 'TR-DASH-SOURCES', 'TR-DASH-GAPS']);

function inputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_INPUT';
  return error;
}

function cleanText(value, name, max = 120) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw inputError(`${name}格式无效`);
  return text;
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw inputError(`${name}格式无效`);
  return value;
}

export function normalizeDashboardContext(value, scopeFingerprint) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw inputError('经营上下文格式无效');
  const fingerprint = cleanText(scopeFingerprint, 'scope_fingerprint', 100);
  if (!value.scope || typeof value.scope !== 'object') throw inputError('筛选范围格式无效');
  if (!value.metrics || typeof value.metrics !== 'object') throw inputError('指标格式无效');
  const customers = Array.isArray(value.customers) ? value.customers : [];
  const sources = Array.isArray(value.sources) ? value.sources : [];
  const gaps = Array.isArray(value.gaps) ? value.gaps : [];
  if (customers.length > 20) throw inputError('客户范围过大');
  if (sources.length > 10 || gaps.length > 20) throw inputError('上下文范围过大');

  const scope = {
    range: cleanText(value.scope.range, '日期范围'),
    region: cleanText(value.scope.region, '战区范围'),
    ka: cleanText(value.scope.ka, 'KA范围')
  };
  const metrics = {};
  for (const key of ['sales', 'profit', 'margin_rate', 'volume', 'active_stores', 'total_stores']) metrics[key] = finiteNumber(value.metrics[key], '指标');

  const selectedStore = value.selected_store && typeof value.selected_store === 'object' ? {
    store_id: cleanText(value.selected_store.store_id, '门店ID'),
    store_name: cleanText(value.selected_store.store_name, '门店名称'),
    cycle_id: value.selected_store.cycle_id ? cleanText(value.selected_store.cycle_id, '活动周期') : null
  } : null;
  return {
    context_type: 'dashboard_current_scope',
    data_version: fingerprint,
    scope_fingerprint: fingerprint,
    scope,
    metrics,
    customers: customers.map(row => ({
      name: cleanText(row.name, '客户名称'),
      sales: finiteNumber(row.sales, '客户指标'),
      profit: finiteNumber(row.profit, '客户指标'),
      margin_rate: finiteNumber(row.margin_rate, '客户指标')
    })),
    sources: sources.map(row => ({ name: cleanText(row.name, '数据源'), truth_label: cleanText(row.truth_label, '数据标签') })),
    gaps: gaps.map(row => cleanText(row, '数据缺口', 300)),
    selected_store: selectedStore,
    boundaries: ['经营数字由驾驶舱确定性计算，AI不得重算', '无门店库存数据，不得判断缺货', '无有效对照，不得声称因果增量', '任务必须人工确认后保存'],
    trace_ids: [...TRACE_IDS, ...(selectedStore ? ['TR-DASH-SELECTED-STORE'] : [])]
  };
}

export function dashboardTraceIds() {
  return [...TRACE_IDS];
}
