import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStateStore } from '../server/state-store.mjs';
import { summarizeEvaluation } from '../server/evaluation-metrics.mjs';

test('feedback is validated, updated in place, and task lifecycle is ordered', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fmcg-feedback-'));
  const store = await createStateStore({ filePath: join(dir, 'state.json'), idFactory: () => '12345678' });
  const { run } = await store.recordDashboardChat({ question: '当前风险？', status: 'success', scope_fingerprint: 's1', scope: { ka: '全部' }, duration_ms: 1200, analysis: {} });
  await assert.rejects(() => store.recordChatFeedback(run.id, { decision: 'rejected' }), error => error.code === 'INVALID_INPUT');
  await store.recordChatFeedback(run.id, { decision: 'modified', reason_code: 'ACTION_NOT_EXECUTABLE', note: '负责人需要调整' });
  await store.recordChatFeedback(run.id, { decision: 'adopted', note: '复核后直接采纳' });
  assert.equal(store.snapshot().dashboard_chats[0].feedback.decision, 'adopted');
  await assert.rejects(() => store.recordChatTaskEvent(run.id, { event: 'completed', task_id: 'TASK-1' }), error => error.code === 'INVALID_TRANSITION');
  await store.recordChatTaskEvent(run.id, { event: 'created', task_id: 'TASK-1' });
  await store.recordChatTaskEvent(run.id, { event: 'completed', task_id: 'TASK-1' });
  assert.ok(store.snapshot().dashboard_chats[0].task.completed_at);
});

test('evaluation metrics keep failures outside the adoption denominator', () => {
  const metrics = summarizeEvaluation([
    { status: 'success', duration_ms: 1000, feedback: { decision: 'adopted' }, task: { created_at: 'x', completed_at: 'y' } },
    { status: 'success', duration_ms: 2000, feedback: { decision: 'modified' }, task: { created_at: 'x' } },
    { status: 'success', duration_ms: 3000, feedback: { decision: 'rejected' } },
    { status: 'failed', duration_ms: 4000, error: { code: 'DIFY_ERROR' } },
    { status: 'success', record_type: 'frozen_evaluation', scope_fingerprint: 'eval-EVAL-001', duration_ms: 9999, feedback: { decision: 'adopted' } },
    { status: 'failed', scope_fingerprint: 'eval-EVAL-LEGACY', duration_ms: 1 }
  ]);
  assert.equal(metrics.evaluated_success_count, 3);
  assert.equal(metrics.adoption_rate, 66.7);
  assert.equal(metrics.task_completion_rate, 50);
  assert.equal(metrics.bad_case_count, 3);
  assert.equal(metrics.average_response_ms, 2500);
  assert.equal(metrics.total_runs, 4);
  assert.equal(metrics.frozen_evaluation_runs, 1);
  assert.equal(metrics.sample_status, '样本积累中');
});
