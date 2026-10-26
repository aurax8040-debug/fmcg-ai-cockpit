const LABELS = {
  pos_result: '查询本周门店POS',
  promo_resource: '查询本周临促投入',
  sfa_visit: '查询本周SFA巡店',
  sfa_quality: '查询本周商品反馈',
  sfa_promoter_issue: '查询本周临促问题',
  peer_benchmark: '查询匿名达标门店基准'
};

export function assertPromoQuestion(question) {
 const q=String(question||'').trim();
 if(!q||q.length>1000||/预算|全渠道|客户经营|普通客户|毛利|ERP|上月|上季度|年度|写代码|编程|天气|股票|密码|忽略.*规则/.test(q)||! /临促|本周|这家店|该店|门店|SFA|巡店|缺.*证据|陈列|分销|商品|拜访|对标|执行|原因|下周|建议|跟进|差距|POS/i.test(q)) {const error=new Error('仅支持本周临促复盘，不回答预算、普通客户经营或其他泛经营问题');error.code='INVALID_INPUT';throw error;}
 return q;
}
export function planWeekendPromoReview(question, store) {
  if (!String(question || '').trim()) { const error = new Error('请输入研判问题'); error.code = 'INVALID_INPUT'; throw error; }
  if (!store?.ai_eligible) { const error = new Error('Agent只分析BI规则识别的未达标门店'); error.code = 'INVALID_INPUT'; throw error; }
  return {
    question: assertPromoQuestion(question),
    store_id: store.store_id,
    tools: ['pos_result', 'promo_resource', 'sfa_visit', 'sfa_quality', 'sfa_promoter_issue', 'peer_benchmark'],
    boundary: ['经营指标由BI计算，Agent不重算', '对标结果为相关性线索，不认定因果', 'AI不自动下发任务或调整临促资源']
  };
}

export function executeWeekendPromoTools(plan, store) {
  const outputs = {
    pos_result: () => ({ current_pos: store.current_pos, previous_pos: store.previous_pos, target: store.target, achievement_rate: store.achievement_rate, same_ka_rate: store.same_ka_rate, overall_rate: store.overall_rate, saturday_pos: store.saturday_pos, sunday_pos: store.sunday_pos }),
    promo_resource: () => ({ promoter_count: store.promoter_count, promo_days: store.promo_days, promo_cost: store.promo_cost, investment_observation: store.investment_observation, boundary: 'POS/临促费用仅为投入产出观察，不是完整ROI' }),
    sfa_visit: () => store.sfa ? ({ visited_at: store.sfa.visited_at, visitor_role: store.sfa.visitor_role, visit_status: store.sfa.visit_status, display_position: store.sfa.display_position, display_area_sqm: store.sfa.display_area_sqm, distributed_skus: store.sfa.distributed_skus, trace_id: store.sfa.trace_id }) : ({ status: '本周无有效记录' }),
    sfa_quality: () => ({ quality_feedback: store.sfa?.quality_feedback || null, boundary: '主观反馈不等于客观质量检测' }),
    sfa_promoter_issue: () => ({ promoter_present: store.sfa?.promoter_present ?? null, promoter_issue: store.sfa?.promoter_issue || null, action_note: store.sfa?.action_note || null }),
    peer_benchmark: () => ({ ...store.benchmark, gaps: store.gaps })
  };
  return plan.tools.map((tool, index) => ({ step: index + 1, tool, label: LABELS[tool], status: 'success', output: outputs[tool]() }));
}
