import test from 'node:test';
import assert from 'node:assert/strict';
import { canClaimCausalLift, initialActivityState, reduceActivityState } from '../activity-state.mjs';

const evidence = gate => ({ data_version: 1, gate, metrics: {} });

test('blocked evidence prevents model run while qualified evidence can run with warning state', () => {
  const blocked = reduceActivityState({ ...initialActivityState, evidence: evidence({ mode: 'blocked', allow_ai: false }) }, { type: 'ANALYSIS_START' });
  assert.equal(blocked.aiStatus, 'blocked');
  const qualified = reduceActivityState({ ...initialActivityState, evidence: evidence({ mode: 'qualified', allow_ai: true }) }, { type: 'ANALYSIS_START' });
  assert.equal(qualified.aiStatus, 'running');
});

test('successful and failed AI results preserve deterministic evidence', () => {
  const base = { ...initialActivityState, evidence: evidence({ mode: 'normal', allow_ai: true }) };
  const analysis = { facts: [], data_gaps: [], hypotheses: [], recommended_checks: [], boundaries: [], citations: [], management_summary: {} };
  const success = reduceActivityState(base, { type: 'ANALYSIS_RESULT', payload: { ai_status: 'success', analysis, evidence: base.evidence } });
  assert.equal(success.analysis, analysis);
  const failed = reduceActivityState(base, { type: 'ANALYSIS_RESULT', payload: { ai_status: 'failed', analysis: null, ai_error: { message: 'timeout' }, evidence: base.evidence } });
  assert.equal(failed.evidence, base.evidence);
  assert.equal(failed.error.message, 'timeout');
});

test('evidence updates require a newer version and causal claims require a valid control', () => {
  const base = { ...initialActivityState, evidence: { data_version: 2, metrics: {} } };
  const stale = reduceActivityState(base, { type: 'EVIDENCE_UPDATED', evidence: { data_version: 2, metrics: {} } });
  assert.equal(stale.error.message, '证据版本未更新');
  const newer = reduceActivityState(base, { type: 'EVIDENCE_UPDATED', evidence: { data_version: 3, metrics: {} } });
  assert.equal(newer.evidence.data_version, 3);
  assert.equal(canClaimCausalLift(newer.evidence), false);
  assert.equal(canClaimCausalLift({ metrics: { control_comparison: { valid: true } } }), true);
});
