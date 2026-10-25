function rate(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(1)) : null;
}

export function summarizeEvaluation(runs = []) {
  const isFrozenEvaluation = row => row.record_type === 'frozen_evaluation' || String(row.scope_fingerprint || '').startsWith('eval-');
  const frozenEvaluationRuns = runs.filter(row => isFrozenEvaluation(row) && row.status === 'success' && row.scope_fingerprint !== 'eval-smoke');
  const usageRuns = runs.filter(row => !isFrozenEvaluation(row));
  const successful = usageRuns.filter(row => row.status === 'success');
  const evaluated = successful.filter(row => row.feedback?.decision);
  const adopted = evaluated.filter(row => ['adopted', 'modified'].includes(row.feedback.decision));
  const direct = evaluated.filter(row => row.feedback.decision === 'adopted').length;
  const modified = evaluated.filter(row => row.feedback.decision === 'modified').length;
  const rejected = evaluated.filter(row => row.feedback.decision === 'rejected').length;
  const taskCreated = adopted.filter(row => row.task?.created_at).length;
  const taskCompleted = adopted.filter(row => row.task?.completed_at).length;
  const durations = usageRuns.map(row => row.duration_ms).filter(value => Number.isFinite(value) && value >= 0);
  const failed = usageRuns.filter(row => row.status === 'failed').length;
  return {
    total_runs: usageRuns.length,
    frozen_evaluation_runs: frozenEvaluationRuns.length,
    successful_runs: successful.length,
    failed_runs: failed,
    evaluated_success_count: evaluated.length,
    direct_adopted_count: direct,
    modified_adopted_count: modified,
    rejected_count: rejected,
    adoption_rate: rate(direct + modified, evaluated.length),
    task_created_count: taskCreated,
    task_completed_count: taskCompleted,
    task_creation_rate: rate(taskCreated, adopted.length),
    task_completion_rate: rate(taskCompleted, taskCreated),
    bad_case_count: modified + rejected + failed,
    average_response_ms: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    sample_status: evaluated.length >= 20 ? '可形成首版指标' : '样本积累中',
    minimum_evaluated_samples: 20
  };
}
