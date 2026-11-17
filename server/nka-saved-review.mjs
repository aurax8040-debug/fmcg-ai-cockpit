// Reuse only validated standard reviews for exactly the same business evidence.
export function savedPromoReviews(review, chats = []) {
  const reviews = {};
  for (const store of review.stores.filter(row => row.ai_eligible)) {
    const matches = chats.filter(run => run.status === 'success' && run.analysis && run.answer_source === 'dify_weekend_agent' &&
      (run.context?.review_kind === 'standard' || /^(请分析本门店本次周末临促|分析本次临促执行差距并生成下周验证计划)/.test(run.question || '')) &&
      run.context?.selected_store?.cycle_id === review.cycle.id && run.context?.selected_store?.store_id === store.store_id &&
      JSON.stringify(run.context.store) === JSON.stringify(store) && JSON.stringify(run.context.cycle) === JSON.stringify(review.cycle));
    const latest = matches.sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (latest) reviews[store.store_id] = latest;
  }
  return reviews;
}
