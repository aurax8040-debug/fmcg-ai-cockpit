function previousMonth(value) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function requestedMonth(question, asOf) {
  if (/上个?月/.test(question)) return previousMonth(asOf);
  const match = question.match(/(?:(20\d{2})年)?(1[0-2]|[1-9])月/);
  if (!match) return null;
  const currentYear = Number(asOf.slice(0, 4));
  const currentMonth = Number(asOf.slice(5, 7));
  const month = Number(match[2]);
  const year = match[1] ? Number(match[1]) : month > currentMonth ? currentYear - 1 : currentYear;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function resolveStore(dataset, question, context) {
  const selected = context?.selected_store;
  if (/这家店|该店|当前门店/.test(question) && selected?.store_id) {
    return dataset.stores.find(row => row.id === selected.store_id) || null;
  }
  return dataset.stores.find(row => {
    const shortName = String(row.name || '').split('·').at(-1);
    return row.name && (question.includes(row.name) || (shortName && question.includes(shortName)));
  }) || null;
}

export function resolveMonthlyStorePos(dataset, question, context, asOf = '2026-10-19') {
  const text = String(question || '').trim();
  if (!/(?:POS|销售额|销量)/i.test(text)) return null;
  const month = requestedMonth(text, asOf);
  if (!month) return null;
  const store = resolveStore(dataset, text, context);
  if (!store) return null;
  const row = (dataset.store_pos_monthly || []).find(item => item.store_id === store.id && item.month === month);
  const availableRows = (dataset.store_pos_monthly || []).filter(item => item.store_id === store.id).sort((a, b) => a.month.localeCompare(b.month));
  if (!row) {
    return {
      answer_source: 'deterministic_pos_tool',
      tool_result: { store_id: store.id, store_name: store.name, month, status: 'unavailable', available_months: availableRows.map(item => item.month) },
      analysis: {
        facts: [], data_gaps: [{ text: `${store.name}${month}月度POS数据未接入`, citations: [] }], hypotheses: [], recommended_checks: [],
        management_summary: { title: '该月份POS数据暂不可用', conclusion: `当前数据源没有${store.name}${month}的月度POS记录，不能生成或推算销售额。` },
        boundaries: ['未接入的数据不补零、不估算'], citations: []
      }
    };
  }
  const traceId = row.trace_id;
  const previous = availableRows.find(item => item.month === previousMonth(`${month}-01`));
  const change = previous?.sales ? Number(((row.sales - previous.sales) / previous.sales * 100).toFixed(1)) : null;
  return {
    answer_source: 'deterministic_pos_tool',
    trace_id: traceId,
    tool_result: { store_id: store.id, store_name: store.name, month, sales: row.sales, previous_sales: previous?.sales ?? null, change_pct: change, data_as_of: row.data_as_of, latency: row.latency, series: availableRows },
    analysis: {
      facts: [{ text: `${store.name}${month}POS销售额为${row.sales.toLocaleString('zh-CN')}元${change === null ? '' : `，较上月${change >= 0 ? '增长' : '下降'}${Math.abs(change)}%`}`, citations: [traceId] }],
      data_gaps: [], hypotheses: [], recommended_checks: [],
      management_summary: { title: `${store.name.split('·').at(-1)}月度POS查询`, conclusion: `${month} POS销售额为${row.sales.toLocaleString('zh-CN')}元${change === null ? '' : `，环比${change >= 0 ? '+' : ''}${change}%`}。` },
      boundaries: [`数据来自商超云POS匿名模拟接口，${row.latency}口径，截至${row.data_as_of}`], citations: [traceId]
    }
  };
}
