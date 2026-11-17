function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratio(count, total) {
  return total ? round(count / total * 100) : null;
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function benchmarkFrom(rows, scope, degraded = false) {
  const sfaRows = rows.map(row => row.sfa).filter(Boolean);
  const commonPosition = mostCommon(sfaRows.map(row => row.display_position));
  return {
    scope,
    degraded,
    sample_size: rows.length,
    achievement_rate_median: round(median(rows.map(row => row.achievement_rate))),
    display_area_sqm_median: round(median(sfaRows.map(row => row.display_area_sqm))),
    distributed_skus_median: round(median(sfaRows.map(row => row.distributed_skus))),
    common_display_position: commonPosition,
    common_position_share: ratio(sfaRows.filter(row => row.display_position === commonPosition).length, sfaRows.length),
    price_compliance_rate: ratio(sfaRows.filter(row => row.price_compliant).length, sfaRows.length),
    promoter_presence_rate: ratio(sfaRows.filter(row => row.promoter_present).length, sfaRows.length),
    note: degraded ? '完全同类样本不足5家，已按固定规则放宽；仅作为参考。' : '同KA、同等级、同临促天数的达标门店匿名聚合。'
  };
}

function selectPeers(store, rows) {
  const achieved = rows.filter(row => row.store_id !== store.store_id && row.issue_status === '达标' && row.sfa);
  const levels = [
    ['同KA·同等级·同临促天数', row => row.ka_id === store.ka_id && row.grade === store.grade && row.promo_days === store.promo_days],
    ['同KA全部临促门店', row => row.ka_id === store.ka_id],
    ['同战区·同等级临促门店', row => row.region === store.region && row.grade === store.grade],
    ['临促大盘', () => true]
  ];
  for (let index = 0; index < levels.length; index += 1) {
    const [scope, matches] = levels[index];
    const selected = achieved.filter(matches);
    if (selected.length >= 5 || index === levels.length - 1) return benchmarkFrom(selected, scope, index > 0);
  }
  return benchmarkFrom([], '无有效对标样本', true);
}

function buildGaps(store, benchmark) {
  if (!store.sfa || !benchmark.sample_size) return [];
  const rows = [];
  if (Number.isFinite(benchmark.display_area_sqm_median)) rows.push({ key: 'display_area_sqm', label: '陈列面积', store_value: store.sfa.display_area_sqm, benchmark_value: benchmark.display_area_sqm_median, unit: '㎡', status: store.sfa.display_area_sqm < benchmark.display_area_sqm_median ? '存在差距' : '无明显差距' });
  if (Number.isFinite(benchmark.distributed_skus_median)) rows.push({ key: 'distributed_skus', label: '分销SKU', store_value: store.sfa.distributed_skus, benchmark_value: benchmark.distributed_skus_median, unit: '个', status: store.sfa.distributed_skus < benchmark.distributed_skus_median ? '存在差距' : '无明显差距' });
  rows.push({ key: 'display_position', label: '陈列位置', store_value: store.sfa.display_position, benchmark_value: `${benchmark.common_display_position}（${benchmark.common_position_share}%）`, unit: '', status: store.sfa.display_position === benchmark.common_display_position ? '一致' : '存在差异' });
  rows.push({ key: 'price_compliant', label: '价格执行', store_value: store.sfa.price_compliant ? '正常' : '待核查', benchmark_value: `${benchmark.price_compliance_rate}%正常`, unit: '', status: store.sfa.price_compliant ? '无明显差距' : '存在差距' });
  rows.push({ key: 'promoter_present', label: '巡店时临促在岗', store_value: store.sfa.promoter_present ? '在岗' : '不在岗', benchmark_value: `${benchmark.promoter_presence_rate}%在岗`, unit: '', status: store.sfa.promoter_present ? '无明显差距' : '存在差距' });
  return rows;
}

export function summarizeWeekendPromo(dataset, snapshot = { tasks: [] }, cycleId = 'PROMO-WK14') {
  const cycle = dataset.weekend_promo_cycles?.find(row => row.id === cycleId);
  if (!cycle) { const error = new Error('周末临促周期不存在'); error.code = 'NOT_FOUND'; throw error; }
  const storeMap = new Map(dataset.stores.map(row => [row.id, row]));
  const resultMap = new Map((dataset.weekend_promo_results || []).filter(row => row.cycle_id === cycleId).map(row => [row.store_id, row]));
  const resourceMap = new Map((dataset.weekend_promo_resources || []).filter(row => row.cycle_id === cycleId).map(row => [row.store_id, row]));
  const sfaMap = new Map((dataset.weekend_promo_sfa || []).filter(row => row.cycle_id === cycleId).map(row => [row.store_id, row]));

  const baseRows = cycle.store_ids.map(storeId => {
    const store = storeMap.get(storeId);
    const result = resultMap.get(storeId) || null;
    const resource = resourceMap.get(storeId) || null;
    const sfa = sfaMap.get(storeId) || null;
    const promoDays = resource?.planned_days ?? cycle.planned_days;
    const target = cycle.daily_target_yuan * promoDays;
    const currentPos = Number.isFinite(result?.current_pos) ? result.current_pos : null;
    const achievementRate = currentPos === null ? null : round(currentPos / target * 100);
    const issueStatus = currentPos === null || !resource ? '数据不完整' : achievementRate >= 100 ? '达标' : '未达标';
    return {
      store_id: storeId,
      store_name: store?.name || storeId,
      account_manager: store?.account_manager || null,
      ka_id: store?.ka_system || store?.ka_id || null,
      ka_name: store?.ka_system || store?.name?.split('·')[2] || null,
      grade: store?.grade || null,
      region: store?.region || null,
      promo_days: promoDays,
      promoter_count: resource?.promoter_count ?? null,
      promo_cost: resource?.cost ?? null,
      target,
      current_pos: currentPos,
      previous_pos: Number.isFinite(result?.previous_pos) ? result.previous_pos : null,
      saturday_pos: Number.isFinite(result?.saturday_pos) ? result.saturday_pos : null,
      sunday_pos: Number.isFinite(result?.sunday_pos) ? result.sunday_pos : null,
      achievement_rate: achievementRate,
      investment_observation: currentPos !== null && resource?.cost ? round(currentPos / resource.cost, 2) : null,
      issue_status: issueStatus,
      ai_eligible: issueStatus === '未达标',
      sfa_status: sfa ? `已获取 · ${sfa.visited_at.slice(5, 16).replace('T', ' ')}` : '本周无有效记录',
      sfa,
      review_case: sfa?.review_case || null,
      trace_ids: [result?.trace_id, resource?.trace_id, sfa?.trace_id, sfa?.review_case?.trace_id].filter(Boolean),
      previous_task: (snapshot.tasks || []).find(task => task.store_id === storeId && task.task_type === 'next_week_store_visit') || null
    };
  });

  const rates = baseRows.filter(row => Number.isFinite(row.achievement_rate));
  const stores = baseRows.map(store => {
    const sameKa = rates.filter(row => row.store_id !== store.store_id && row.ka_id === store.ka_id);
    const overall = rates.filter(row => row.store_id !== store.store_id);
    const benchmark = selectPeers(store, baseRows);
    return {
      ...store,
      same_ka_rate: round(median(sameKa.map(row => row.achievement_rate))),
      overall_rate: round(median(overall.map(row => row.achievement_rate))),
      benchmark,
      gaps: buildGaps(store, benchmark)
    };
  });
  const complete = stores.filter(row => Number.isFinite(row.current_pos));
  const achievedStoreCount = complete.filter(row => row.issue_status === '达标').length;
  const totalTarget = stores.reduce((sum, row) => sum + row.target, 0);
  const totalPos = complete.reduce((sum, row) => sum + row.current_pos, 0);
  return {
    cycle: { id: cycle.id, label: cycle.label, start_date: cycle.start_date, end_date: cycle.end_date, pos_as_of: cycle.pos_as_of, pos_latency: cycle.pos_latency },
    rule: { daily_target_yuan: cycle.daily_target_yuan, demo_only: true, description: cycle.target_rule },
    authorization: { entry: '企业BI统一登录', detail_scope: '当前用户授权门店', peer_scope: '权限外门店仅匿名聚合', enforcement: '服务端行级权限校验（MVP为匿名模拟）' },
    summary: {
      planned_store_count: cycle.store_ids.length,
      actual_store_count: stores.filter(row => row.promo_days > 0).length,
      promoter_count: stores.reduce((sum, row) => sum + (row.promoter_count || 0), 0),
      promoter_person_days: stores.reduce((sum, row) => sum + (row.promoter_count || 0) * (row.promo_days || 0), 0),
      promo_cost: stores.reduce((sum, row) => sum + (row.promo_cost || 0), 0),
      pos_total: totalPos,
      target_total: totalTarget,
      weighted_achievement_rate: round(totalPos / totalTarget * 100),
      store_achievement_median: round(median(complete.map(row => row.achievement_rate))),
      evaluated_store_count: complete.length,
      achieved_store_count: achievedStoreCount,
      store_achievement_rate: complete.length ? round(achievedStoreCount / complete.length * 100) : null,
      problem_store_count: stores.filter(row => row.issue_status === '未达标').length,
      incomplete_store_count: stores.filter(row => row.issue_status === '数据不完整').length,
      ai_candidate_count: stores.filter(row => row.ai_eligible).length
    },
    stores
  };
}
