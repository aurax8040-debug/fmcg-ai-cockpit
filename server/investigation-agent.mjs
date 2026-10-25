const TOOL_LABELS = {
  activity_plan: '查询活动计划',
  store_pos: '查询门店POS',
  execution_evidence: '查询执行证据',
  activity_expense: '查询活动费用',
  promoter_attendance: '查询促销员到岗与离岗',
  sfa_display: '查询SFA巡店与陈列',
  product_quality: '查询果品质量与顾客反馈',
  store_history: '查询门店历史活动',
  competitor_event: '查询受控商圈事件'
};

export function planInvestigation(question) {
  const text = String(question || '').trim();
  if (!text) {
    const error = new Error('请输入具体核查问题');
    error.code = 'INVALID_INPUT';
    throw error;
  }
  const tools = ['activity_plan'];
  if (/门店|STORE|A\d+|销售|POS/i.test(text)) tools.push('store_pos');
  if (/执行|证据|到岗|陈列|促销|门店/i.test(text)) tools.push('execution_evidence');
  if (/费用|投入|毛利|贡献|继续|资源|活动/i.test(text)) tools.push('activity_expense');
  if (/门店|POS|销售|到岗|离岗|促销员|执行/i.test(text)) tools.push('promoter_attendance');
  if (/门店|POS|销售|巡店|SFA|陈列|位置|面积/i.test(text)) tools.push('sfa_display');
  if (/门店|POS|销售|果|硬度|酸度|质量|顾客/i.test(text)) tools.push('product_quality');
  if (/门店|POS|销售|历史|过往|基线/i.test(text)) tools.push('store_history');
  if (/门店|POS|销售|竞品|周边|商圈|开业/i.test(text)) tools.push('competitor_event');
  if (tools.length === 1) tools.push('store_pos', 'execution_evidence', 'activity_expense');
  return {
    question: text,
    tools: [...new Set(tools)],
    unavailable: /库存|缺货|断货/i.test(text) ? [{ tool: 'inventory', reason: '当前没有门店库存工具，停止缺货/断货推断' }] : []
  };
}

export function executeInvestigationTools(plan, evidence) {
  const alerts = evidence.store_execution?.alerts || [];
  const select = field => alerts.filter(row => row[field]).map(row => ({ store_id: row.store_id, [field]: row[field] }));
  const results = {
    activity_plan: () => ({ activity: evidence.activity, gate: evidence.gate, data_gaps: evidence.data_gaps }),
    store_pos: () => ({ periods: evidence.metrics.periods, stores: evidence.stores.map(row => ({ store_id: row.store_id, before: row.before, during: row.during, after: row.after, pos_available: row.pos_available })) }),
    execution_evidence: () => ({ execution_coverage: evidence.completeness.execution_coverage, stores: evidence.stores.map(row => ({ store_id: row.store_id, evidence_status: row.evidence_status })) }),
    activity_expense: () => ({ activity_expense: evidence.metrics.activity_expense, activity_margin: evidence.metrics.activity_margin, contribution_observation: evidence.metrics.contribution_observation, boundary: '费用覆盖观察不等于完整ROI' }),
    promoter_attendance: () => ({ stores: select('promoter'), boundary: '到岗相关性不等于销量因果' }),
    sfa_display: () => ({ stores: alerts.filter(row => row.sfa_visit || row.display).map(row => ({ store_id: row.store_id, sfa_visit: row.sfa_visit, display: row.display })) }),
    product_quality: () => ({ stores: select('quality') }),
    store_history: () => ({ stores: select('history'), boundary: '历史表现仅用于比较基线' }),
    competitor_event: () => ({ stores: select('competitor'), boundary: '仅使用受控商圈事件台账，仍需人工核实' })
  };
  return plan.tools.map((tool, index) => ({ step: index + 1, tool, label: TOOL_LABELS[tool], status: 'success', output: results[tool]() }));
}
