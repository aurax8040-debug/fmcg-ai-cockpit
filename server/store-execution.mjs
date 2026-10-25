function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function one(rows, activityId, storeId) {
  return rows.find(row => (!row.activity_id || row.activity_id === activityId) && row.store_id === storeId) || null;
}

export function summarizeStoreExecution(dataset, activityId) {
  const activity = dataset.activities.find(row => row.id === activityId);
  if (!activity) { const error = new Error('活动不存在'); error.code = 'NOT_FOUND'; throw error; }
  const storeMap = new Map(dataset.stores.map(row => [row.id, row]));
  const alerts = activity.planned_store_ids.map(storeId => {
    const pos = dataset.pos_daily.filter(row => row.store_id === storeId);
    const before = pos.filter(row => row.date >= activity.before_start && row.date <= activity.before_end).reduce((sum, row) => sum + row.sales, 0);
    const during = pos.filter(row => row.date >= activity.start_date && row.date <= activity.end_date).reduce((sum, row) => sum + row.sales, 0);
    const promoter = one(dataset.promoter_shifts, activityId, storeId);
    const visit = one(dataset.sfa_visits, activityId, storeId);
    const display = one(dataset.display_checks, activityId, storeId);
    const quality = one(dataset.quality_checks, activityId, storeId);
    const shipment = one(dataset.erp_shipments, activityId, storeId);
    const history = one(dataset.store_activity_history, activityId, storeId);
    const competitor = one(dataset.competitor_events, activityId, storeId);
    const posChangePct = before ? round((during - before) / before * 100) : null;
    const attendanceRate = promoter ? round(promoter.present_minutes / promoter.planned_minutes * 100) : null;
    const displayAreaRate = display ? round(display.actual_area_sqm / display.planned_area_sqm * 100) : null;
    const reasons = [];
    let priorityScore = 0;
    if (posChangePct !== null && posChangePct < 0) { priorityScore += Math.min(35, Math.abs(posChangePct)); reasons.push('POS低于历史基线'); }
    if (attendanceRate !== null && attendanceRate < 85) { priorityScore += 25; reasons.push('有效在岗不足'); }
    if (promoter?.long_absence_minutes >= 60) { priorityScore += 15; reasons.push('存在长期离岗'); }
    if (display && display.actual_location !== display.planned_location) { priorityScore += 15; reasons.push('陈列位置降级'); }
    if (displayAreaRate !== null && displayAreaRate < 80) { priorityScore += 10; reasons.push('陈列面积不足'); }
    if (display && display.active_skus < display.planned_skus) { priorityScore += 10; reasons.push('活动SKU缺失'); }
    if (display && !display.price_compliant) { priorityScore += 10; reasons.push('活动价格未执行'); }
    if (quality && (quality.damage_rate > 5 || quality.hardness !== '合格')) { priorityScore += 10; reasons.push('果品质量异常'); }
    if (competitor) { priorityScore += 5; reasons.push('周边同期竞品活动'); }
    const traces = [shipment, promoter, visit, display, quality, history, competitor].map(row => row?.trace_id).filter(Boolean);
    return { activity_id: activityId, store_id: storeId, store_name: storeMap.get(storeId)?.name || storeId, priority_score: round(priorityScore), pos: { before, during, change_pct: posChangePct }, promoter: promoter ? { attendance_rate: attendanceRate, long_absence_minutes: promoter.long_absence_minutes, knowledge_score: promoter.knowledge_score, customer_service_score: promoter.customer_service_score } : null, sfa_visit: visit, display: display ? { ...display, area_rate: displayAreaRate } : null, quality, shipment, history, competitor, reasons, trace_ids: traces, gaps: [!promoter && '缺少促销员班次', !visit && '缺少SFA巡店', !display && '缺少陈列核验', !quality && '缺少果品质量填报', !shipment && '缺少ERP供货记录'].filter(Boolean) };
  }).sort((a, b) => b.priority_score - a.priority_score);
  return { activity: { id: activity.id, name: activity.name }, source_type: dataset.source_type, as_of: dataset.as_of, alerts };
}
