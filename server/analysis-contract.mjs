function contractError(message) {
  const error = new Error(message);
  error.code = 'INVALID_AI_OUTPUT';
  return error;
}

export function validateAnalysis(value, allowedTraceIds) {
  let result = value;
  if (typeof result === 'string') {
    const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { result = JSON.parse(cleaned); } catch { throw contractError('Dify返回的分析不是有效JSON'); }
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw contractError('Dify分析结构无效');
  for (const key of ['facts', 'data_gaps', 'hypotheses', 'recommended_checks', 'boundaries', 'citations']) {
    if (!Array.isArray(result[key])) throw contractError(`Dify分析缺少数组字段: ${key}`);
  }
  for (const key of ['facts', 'data_gaps', 'hypotheses', 'recommended_checks']) {
    for (const item of result[key]) {
      if (!item || typeof item !== 'object' || typeof item.text !== 'string' || !Array.isArray(item.citations)) {
        throw contractError(`Dify分析字段结构无效: ${key}`);
      }
    }
  }
  result.boundaries = result.boundaries.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item.text === 'string') return item.text;
    throw contractError('Dify分析字段结构无效: boundaries');
  });
  if (!result.management_summary || typeof result.management_summary !== 'object' || Array.isArray(result.management_summary)) throw contractError('Dify分析缺少management_summary对象');
  const allowed = new Set(allowedTraceIds);
  for (const citation of result.citations) if (!allowed.has(citation)) throw contractError(`Dify引用未知证据: ${citation}`);
  return result;
}
