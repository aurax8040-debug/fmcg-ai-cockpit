import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const transitions = new Map([
  ['草稿', new Set(['已确认', '已驳回'])],
  ['已确认', new Set(['执行中'])],
  ['执行中', new Set(['待补证'])],
  ['待补证', new Set(['已完成'])],
  ['已完成', new Set()],
  ['已驳回', new Set()]
]);

function clone(value) {
  return structuredClone(value);
}

function inputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_INPUT';
  return error;
}

export async function createStateStore({ filePath, seed = { data_version: 1, tasks: [], evidence: [], analyses: [], agent_runs: [], dashboard_chats: [] }, idFactory = randomUUID }) {
  let state;
  try {
    state = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = clone(seed);
  }
  state.data_version ||= 1;
  state.tasks ||= [];
  state.evidence ||= [];
  state.analyses ||= [];
  state.agent_runs ||= [];
  state.dashboard_chats ||= [];
  let queue = Promise.resolve();

  async function persist(next) {
    await mkdir(dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(temp, filePath);
    state = next;
  }

  function mutate(operation) {
    const run = queue.then(async () => {
      const next = clone(state);
      const result = operation(next);
      await persist(next);
      return clone(result);
    });
    queue = run.catch(() => {});
    return run;
  }

  return {
    snapshot() { return clone(state); },
    async createTask(payload) {
      return mutate(next => {
        if (!payload || !payload.activity_id || !payload.title || !payload.owner_role || !payload.due_date) throw inputError('任务缺少必填字段');
        const task = {
          id: `TASK-${idFactory().slice(0, 8).toUpperCase()}`,
          activity_id: payload.activity_id,
          title: String(payload.title).trim(),
          owner_role: String(payload.owner_role).trim(),
          due_date: payload.due_date,
          required_evidence: Array.isArray(payload.required_evidence) ? payload.required_evidence.map(String) : [],
          source_analysis_id: payload.source_analysis_id || null,
          source_agent_run_id: payload.source_agent_run_id || null,
          cycle_id: payload.cycle_id || null,
          store_id: payload.store_id || null,
          task_type: payload.task_type || null,
          priority: payload.priority || 'P0',
          confirmer_role: payload.confirmer_role || 'NKA客户经理',
          executor_role: payload.executor_role || payload.owner_role,
          reviewer_role: payload.reviewer_role || '营销负责人',
          human_decision: payload.human_decision || '人工已确认创建草稿',
          status: '草稿',
          created_at: new Date().toISOString()
        };
        next.tasks.push(task);
        return { task, data_version: next.data_version };
      });
    },
    async updateTask(id, patch) {
      return mutate(next => {
        const task = next.tasks.find(row => row.id === id);
        if (!task) {
          const error = new Error('任务不存在');
          error.code = 'NOT_FOUND';
          throw error;
        }
        if (patch.status && patch.status !== task.status) {
          if (!transitions.get(task.status)?.has(patch.status)) {
            const error = new Error(`不允许从${task.status}变更为${patch.status}`);
            error.code = 'INVALID_TRANSITION';
            throw error;
          }
          if (patch.status === '待补证' && !String(patch.proof || '').trim()) throw inputError('提交执行反馈前必须填写证据');
          if (patch.status === '已完成' && !String(patch.review || '').trim()) throw inputError('完成任务前必须填写复盘结论');
          task.status = patch.status;
        }
        for (const key of ['proof', 'review', 'human_decision']) if (patch[key] !== undefined) task[key] = String(patch[key]).trim();
        task.updated_at = new Date().toISOString();
        return { task, data_version: next.data_version };
      });
    },
    async addEvidence(activityId, payload) {
      return mutate(next => {
        if (!payload || !payload.store_id || !String(payload.type || '').trim() || !String(payload.note || '').trim()) throw inputError('执行证据缺少门店、类型或说明');
        const suffix = idFactory().slice(0, 8).toUpperCase();
        const evidence = {
          id: `EV-RUN-${suffix}`,
          activity_id: activityId,
          store_id: payload.store_id,
          type: String(payload.type).trim(),
          status: payload.status || '待核验',
          note: String(payload.note).trim(),
          submitted_at: new Date().toISOString(),
          trace_id: `TR-RUN-${suffix}`
        };
        next.evidence.push(evidence);
        next.data_version += 1;
        return { evidence, data_version: next.data_version };
      });
    },
    async recordAnalysis(payload) {
      return mutate(next => {
        if (!payload?.activity_id || !payload?.status || !Number.isInteger(payload.data_version)) throw inputError('研判记录缺少活动、状态或数据版本');
        const record = {
          id: `AN-${idFactory().slice(0, 8).toUpperCase()}`,
          activity_id: payload.activity_id,
          status: payload.status,
          data_version: payload.data_version,
          role: payload.role || '经营管理者',
          question: payload.question || '请分析当前活动',
          workflow: payload.workflow || 'Dify · 快消智析·KA活动研判 #1',
          analysis: payload.analysis || null,
          error: payload.error || null,
          created_at: new Date().toISOString()
        };
        next.analyses.push(record);
        return { record, data_version: next.data_version };
      });
    },
    async recordAgentRun(payload) {
      return mutate(next => {
        if (!payload?.activity_id || !payload?.question || !payload?.status) throw inputError('Agent运行记录缺少必填字段');
        const run = {
          id: `AGENT-${idFactory().slice(0, 8).toUpperCase()}`,
          activity_id: payload.activity_id,
          question: payload.question,
          status: payload.status,
          data_version: payload.data_version,
          plan: payload.plan || null,
          trace: payload.trace || [],
          analysis: payload.analysis || null,
          error: payload.error || null,
          created_at: new Date().toISOString()
        };
        next.agent_runs.push(run);
        return { run, data_version: next.data_version };
      });
    },
    async recordDashboardChat(payload) {
      return mutate(next => {
        if (!payload?.question || !payload?.status || !payload?.scope_fingerprint || !payload?.scope) throw inputError('驾驶舱对话记录缺少必填字段');
        const run = {
          id: `CHAT-${idFactory().slice(0, 8).toUpperCase()}`,
          question: String(payload.question).trim(),
          status: payload.status,
          record_type: payload.record_type === 'frozen_evaluation' ? 'frozen_evaluation' : 'usage',
          scope_fingerprint: payload.scope_fingerprint,
          scope: clone(payload.scope),
          context: payload.context ? clone(payload.context) : null,
          answer_source: payload.answer_source || 'dify',
          trace: payload.trace ? clone(payload.trace) : [],
          analysis: payload.analysis || null,
          error: payload.error || null,
          duration_ms: Number.isFinite(payload.duration_ms) ? Math.max(0, Math.round(payload.duration_ms)) : null,
          feedback: null,
          task: null,
          created_at: new Date().toISOString()
        };
        next.dashboard_chats.push(run);
        return { run, data_version: next.data_version };
      });
    },
    async recordChatFeedback(id, payload) {
      return mutate(next => {
        const run = next.dashboard_chats.find(row => row.id === id);
        if (!run) { const error = new Error('AI记录不存在'); error.code = 'NOT_FOUND'; throw error; }
        if (run.status !== 'success') throw inputError('仅成功回答可以进行人工评价');
        const decision = String(payload?.decision || '').trim();
        if (!['adopted', 'modified', 'rejected'].includes(decision)) throw inputError('评价决策无效');
        const reasonCode = String(payload?.reason_code || '').trim();
        const note = String(payload?.note || '').trim();
        if (['modified', 'rejected'].includes(decision) && (!reasonCode || !note)) throw inputError('修改后采纳或否决必须填写原因');
        run.feedback = { decision, reason_code: reasonCode || null, note: note || null, updated_at: new Date().toISOString() };
        return { run, data_version: next.data_version };
      });
    },
    async recordChatTaskEvent(id, payload) {
      return mutate(next => {
        const run = next.dashboard_chats.find(row => row.id === id);
        if (!run) { const error = new Error('AI记录不存在'); error.code = 'NOT_FOUND'; throw error; }
        const event = String(payload?.event || '').trim();
        const taskId = String(payload?.task_id || '').trim();
        if (!taskId || !['created', 'completed'].includes(event)) throw inputError('任务事件无效');
        run.task ||= { task_id: taskId, created_at: null, completed_at: null };
        if (run.task.task_id !== taskId) throw inputError('AI记录已关联其他任务');
        if (event === 'created') run.task.created_at ||= new Date().toISOString();
        if (event === 'completed') {
          if (!run.task.created_at) { const error = new Error('任务尚未创建，不能完成'); error.code = 'INVALID_TRANSITION'; throw error; }
          run.task.completed_at ||= new Date().toISOString();
        }
        return { run, data_version: next.data_version };
      });
    }
  };
}
