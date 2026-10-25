export const initialActivityState = Object.freeze({
  status: 'loading',
  sources: null,
  activities: [],
  evidence: null,
  tasks: [],
  analyses: [],
  agentRuns: [],
  agentStatus: 'idle',
  analysis: null,
  aiStatus: 'idle',
  error: null
});

export function reduceActivityState(state, event) {
  switch (event.type) {
    case 'LOAD_SUCCESS':
      return { ...state, status: 'ready', sources: event.sources, activities: event.activities, evidence: event.evidence, tasks: event.tasks, analyses: event.analyses || [], agentRuns: event.agentRuns || [], analysis: event.analysis || null, aiStatus: event.analysis ? 'success' : 'idle', error: null };
    case 'LOAD_FAILURE':
      return { ...state, status: 'unavailable', error: event.error, aiStatus: 'idle' };
    case 'ANALYSIS_START':
      return state.evidence?.gate?.allow_ai ? { ...state, aiStatus: 'running', error: null } : { ...state, aiStatus: 'blocked', analysis: null };
    case 'ANALYSIS_RESULT':
      return { ...state, aiStatus: event.payload.ai_status, analysis: event.payload.analysis || state.analysis, analyses: event.payload.analysis_record ? [...state.analyses, event.payload.analysis_record] : state.analyses, evidence: event.payload.evidence || state.evidence, error: event.payload.ai_error || null };
    case 'TASKS_UPDATED':
      return { ...state, tasks: event.tasks };
    case 'AGENT_START':
      return { ...state, agentStatus: 'running', error: null };
    case 'AGENT_RESULT':
      return { ...state, agentStatus: event.payload.agent_status, agentRuns: event.payload.run ? [...state.agentRuns, event.payload.run] : state.agentRuns, error: event.payload.run?.error || null };
    case 'EVIDENCE_UPDATED':
      if (state.evidence && event.evidence.data_version <= state.evidence.data_version) return { ...state, error: { message: '证据版本未更新' } };
      return { ...state, evidence: event.evidence, analysis: null, aiStatus: 'idle', error: null };
    default:
      return state;
  }
}

export function canClaimCausalLift(evidence) {
  return Boolean(evidence?.metrics?.control_comparison?.valid);
}
