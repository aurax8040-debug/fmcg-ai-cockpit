import { ActivityApi } from './activity-api.mjs?v=20261017f';
import { canClaimCausalLift, initialActivityState, reduceActivityState } from './activity-state.mjs';

const api = new ActivityApi();
let state = { ...initialActivityState };
let activityId = 'ACT-KA-A-001';

const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const money = value => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 元` : '不可计算';
const pct = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
const $id = id => document.getElementById(id);

function dispatch(event) {
  state = reduceActivityState(state, event);
  renderAll();
}

function stageBar(active) {
  const stages = [
    ['data-foundation', '1', '数据底座', '统一口径与完整度'],
    ['activity-analysis', '2', 'AI研判', '事实、缺口与假设'],
    ['execution', '3', '业务执行', '人工确认与补证'],
    ['review', '4', 'AI经营分析', '变化观察与复盘']
  ];
  return `<div class="activity-stagebar activity-primary-flow">${stages.map(([page, num, title, sub]) => `<button class="activity-stage ${active === page ? 'active' : ''}" data-go-page="${page}"><span class="num">${num}</span><span><b>${title}</b><small>${sub}</small></span></button>`).join('')}</div>`;
}

function gateTag(evidence) {
  const mode = evidence?.gate?.mode;
  if (mode === 'blocked') return '<span class="gate-tag danger">数据不足 · 阻断研判</span>';
  if (mode === 'qualified') return '<span class="gate-tag warn">有限研判 · 结论待验证</span>';
  return '<span class="gate-tag">数据门槛通过</span>';
}

function truthTags(includeAi = false) {
  return `<div class="activity-tags"><span class="truth-tag real">真实样例 · NKA聚合</span><span class="truth-tag">匿名模拟 · 活动/POS/执行</span>${includeAi ? '<span class="truth-tag ai">AI 推断 · 待验证</span>' : ''}</div>`;
}

function unavailableHtml() {
  return `<div class="activity-error"><b>本地Mock BI服务暂不可用</b><div>${safe(state.error?.message || '请启动服务后重试')}</div><div class="activity-actions"><button class="activity-btn" data-action="retry">重新连接</button></div></div>`;
}

function renderDashboardFocus() {
  const dash = $id('page-dash');
  if (!dash) return;
  dash.querySelector('#activityFocus')?.remove();
  const panel = document.createElement('div');
  panel.id = 'activityFocus';
  panel.className = 'activity-panel activity-focus';
  if (state.status !== 'ready' || !state.evidence) {
    panel.innerHTML = `<h3>KA活动经营闭环 <span class="truth-tag">匿名模拟</span></h3>${state.status === 'unavailable' ? unavailableHtml() : '<div class="activity-loading">正在连接Mock BI数据底座…</div>'}`;
  } else {
    const e = state.evidence;
    panel.innerHTML = `<div class="activity-grid"><div><h3>当前重点活动 · ${safe(e.activity.name)}</h3>${truthTags()}<div class="activity-muted">${safe(e.activity.start_date)}—${safe(e.activity.end_date)} · ${e.activity.planned_stores}家计划门店 · 数据版本 v${e.data_version}</div></div><div><div class="activity-muted">POS覆盖</div><div class="activity-value">${pct(e.completeness.pos_store_coverage)}</div></div><div><div class="activity-muted">执行证据覆盖</div><div class="activity-value">${pct(e.completeness.execution_coverage)}</div></div><div><div class="activity-muted">费用覆盖观察</div><div class="activity-value">${money(e.metrics.contribution_observation)}</div><div class="activity-muted">非完整ROI · 匿名模拟</div></div></div><div class="activity-actions">${gateTag(e)}<button class="activity-btn" data-go-page="activity-analysis">进入AI研判</button><button class="activity-btn secondary" data-go-page="data-foundation">查看数据底座</button></div>`;
  }
  dash.prepend(panel);
}

function renderDataFoundation() {
  const root = $id('activityDataFoundation');
  if (!root) return;
  if (state.status === 'unavailable') return void (root.innerHTML = stageBar('data-foundation') + unavailableHtml());
  if (state.status !== 'ready') return void (root.innerHTML = stageBar('data-foundation') + '<div class="activity-loading">正在读取数据底座…</div>');
  const e = state.evidence;
  const sources = state.sources?.sources || [];
  root.innerHTML = `${stageBar('data-foundation')}<div class="activity-panel"><h2>数据底座</h2><div class="activity-muted">复用佳农BI/数仓的落地思路：真实接口尚未接入，本Demo由受控Mock API返回相同结构。</div>${truthTags()}</div><div class="activity-grid">${sources.map(source => `<div class="activity-panel"><h3>${safe(source.name)}</h3><div class="activity-tags"><span class="truth-tag ${source.truth_label === '真实样例' ? 'real' : ''}">${safe(source.truth_label)}</span><span class="gate-tag ${source.status === 'partial' ? 'warn' : ''}">${safe(source.status)}</span></div><div class="activity-kv"><span>粒度</span><strong>${safe(source.grain)}</strong></div><div class="activity-kv"><span>更新时间</span><strong>${safe(source.updated_at)}</strong></div></div>`).join('')}</div><div class="activity-grid two"><div class="activity-panel"><h3>活动数据完整度</h3><div class="activity-kv"><span>POS门店覆盖</span><strong>${pct(e.completeness.pos_store_coverage)}</strong></div><div class="activity-kv"><span>执行证据覆盖</span><strong>${pct(e.completeness.execution_coverage)}</strong></div><div class="activity-kv"><span>匿名成本</span><strong>${e.completeness.cost_available ? '可用' : '缺失'}</strong></div><div class="activity-kv"><span>数据版本</span><strong>v${e.data_version}</strong></div>${gateTag(e)}</div><div class="activity-panel"><h3>统一关联键</h3><div class="activity-muted">KA-A → ACT-KA-A-001 → 门店 → 日期 → SKU</div><div class="activity-list"><div class="activity-row"><b>禁止推断</b><div>没有门店库存数据；无销量只能生成核查任务，不能判断缺货。</div></div><div class="activity-row"><b>计算边界</b><div>销售、成本、费用、覆盖率由代码计算；AI不重算经营数字。</div></div></div></div></div>`;
}

function analysisSections(analysis) {
  if (!analysis) return '';
  const renderItems = (title, rows, hypothesis = false) => `<div class="activity-panel"><h3>${title}</h3><div class="activity-list">${rows.length ? rows.map(row => { const text = typeof row === 'string' ? row : row.text || row.action || JSON.stringify(row); const citations = typeof row === 'object' && row.citations ? row.citations : []; return `<div class="activity-row"><b>${hypothesis ? '待验证 · ' : ''}${safe(text)}</b>${citations.length ? `<div class="activity-trace">证据：${citations.map(safe).join('、')}</div>` : ''}</div>`; }).join('') : '<div class="activity-muted">无</div>'}</div></div>`;
  const checks = (analysis.recommended_checks || []).slice(0, 3);
  return `<div class="activity-panel activity-summary"><h3>管理摘要 <span class="truth-tag ai">AI 推断</span></h3><div class="activity-row"><b>${safe(analysis.management_summary?.title || '')}</b><div>${safe(analysis.management_summary?.conclusion || '')}</div></div><div class="activity-list"><b>优先动作</b>${checks.map((row, index) => `<div class="activity-row"><span class="gate-tag ${index === 0 ? 'warn' : ''}">${index === 0 ? 'P0' : 'P1'}</span> ${safe(row.text || row.action || row)}</div>`).join('')}</div><div class="activity-muted"><b>判断边界：</b>${(analysis.boundaries || []).map(safe).join('；')}</div></div><details class="activity-details"><summary>展开查看事实、缺口、假设与全部证据</summary><div class="activity-grid two">${renderItems('已知事实', analysis.facts || [])}${renderItems('数据缺口', analysis.data_gaps || [])}${renderItems('原因假设', analysis.hypotheses || [], true)}${renderItems('全部建议核查', analysis.recommended_checks || [])}</div><div class="activity-trace">本次引用：${(analysis.citations || []).map(safe).join('、')}</div></details>`;
}

function agentPanel() {
  const run = state.agentRuns.at(-1);
  const trace = run?.trace || [];
  return `<div class="activity-panel agent-panel"><h3>深度核查Agent <span class="truth-tag ai">受控工具路由</span></h3><div class="activity-muted">根据具体问题选择只读工具，再由Dify总结；不是完全自主Agent，所有任务仍需人工确认。</div><div class="activity-form"><label>核查问题<input id="agentQuestion" value="${safe(run?.question || '为什么A10门店活动期销售下降？')}" placeholder="输入具体门店或活动问题"></label><div class="activity-actions"><button class="activity-btn secondary" data-agent-question="为什么A10门店活动期销售下降？">A10销售下降</button><button class="activity-btn secondary" data-agent-question="这场活动是否值得继续投入？">是否继续投入</button><button class="activity-btn secondary" data-agent-question="哪些门店需要优先补证？">优先补证门店</button><button class="activity-btn" data-action="run-agent" ${state.agentStatus === 'running' ? 'disabled' : ''}>${state.agentStatus === 'running' ? 'Agent核查中…' : '启动深度核查Agent'}</button></div></div>${run ? `<div class="activity-trace">运行 ${safe(run.id)} · 数据v${run.data_version} · ${safe(new Date(run.created_at).toLocaleString('zh-CN'))}</div><div class="agent-trace">${trace.map(row => `<div class="activity-row"><span class="gate-tag">步骤${row.step}</span> <b>${safe(row.label)}</b><div class="activity-muted">只读调用成功</div></div>`).join('')}${(run.plan?.unavailable || []).map(row => `<div class="activity-error"><b>停止推断：</b>${safe(row.reason)}</div>`).join('')}</div>${run.status === 'success' ? analysisSections(run.analysis) : `<div class="activity-error">Agent运行失败：${safe(run.error?.message || '未知错误')}</div>`}` : '<div class="activity-muted">尚无Agent运行记录。</div>'}</div>`;
}

function renderAnalysis() {
  const root = $id('activityAnalysis');
  if (!root) return;
  if (state.status === 'unavailable') return void (root.innerHTML = stageBar('activity-analysis') + unavailableHtml());
  if (!state.evidence) return void (root.innerHTML = stageBar('activity-analysis') + '<div class="activity-loading">正在读取活动证据…</div>');
  const e = state.evidence;
  const latestRecord = [...state.analyses].reverse().find(row => row.status === 'success');
  const failure = state.aiStatus === 'failed' ? `<div class="activity-error"><b>Dify研判未完成</b><div>${safe(state.error?.message || '模型或流程暂不可用')}</div><div>确定性经营数据仍然保留，未用固定文案冒充AI结果。</div></div>` : '';
  root.innerHTML = `${stageBar('activity-analysis')}<div class="activity-panel"><h2>AI研判 · ${safe(e.activity.name)}</h2>${truthTags(true)}<div class="activity-muted">真实调用：Dify Workflow #1 + DeepSeek V4.1 Flash；只读取当前活动的受控证据JSON。${gateTag(e)}</div>${latestRecord ? `<div class="activity-trace">最新研判 ${safe(latestRecord.id)} · 数据v${latestRecord.data_version} · ${safe(new Date(latestRecord.created_at).toLocaleString('zh-CN'))}</div>` : ''}<div class="activity-actions"><button class="activity-btn" data-action="analyze" ${!e.gate.allow_ai || state.aiStatus === 'running' ? 'disabled' : ''}>${state.aiStatus === 'running' ? 'AI研判中…' : state.analysis ? '基于当前数据重新研判' : '运行Dify研判'}</button><button class="activity-btn secondary" data-go-page="execution">进入人工执行</button></div></div>${failure}${state.aiStatus === 'blocked' ? '<div class="activity-error"><b>规则阻断：</b>POS覆盖低于80%，本次不调用模型，只生成补数任务。</div>' : ''}${analysisSections(state.analysis)}<div class="activity-grid two"><div class="activity-panel"><h3>确定性指标</h3><div class="activity-kv"><span>活动前销售</span><strong>${money(e.metrics.periods.before.sales)}</strong></div><div class="activity-kv"><span>活动期销售</span><strong>${money(e.metrics.periods.during.sales)}</strong></div><div class="activity-kv"><span>活动后销售</span><strong>${money(e.metrics.periods.after.sales)}</strong></div><div class="activity-kv"><span>营销费用</span><strong>${money(e.metrics.activity_expense)}</strong></div></div><div class="activity-panel"><h3>当前缺口</h3><div class="activity-list">${e.data_gaps.map(gap => `<div class="activity-row">${safe(gap)}</div>`).join('') || '<div class="activity-muted">未发现阻断性缺口</div>'}</div><div class="activity-trace">数据版本 v${e.data_version} · ${e.trace_ids.length}条可引用证据</div></div></div>`;
  root.querySelector('.activity-grid.two:last-child')?.insertAdjacentHTML('beforebegin', agentPanel());
}

function nextTaskAction(task) {
  if (task.status === '草稿') return `<button class="activity-btn" data-task-id="${safe(task.id)}" data-task-status="已确认">人工确认</button>`;
  if (task.status === '已确认') return `<button class="activity-btn" data-task-id="${safe(task.id)}" data-task-status="执行中">模拟执行人接收</button>`;
  if (task.status === '执行中') return `<textarea id="proof-${safe(task.id)}" placeholder="填写匿名模拟执行证据，不填写个人信息"></textarea><button class="activity-btn" data-task-id="${safe(task.id)}" data-task-status="待补证">提交执行反馈</button>`;
  if (task.status === '待补证') return `<textarea id="review-${safe(task.id)}" placeholder="填写复盘结论或证据不足说明"></textarea><button class="activity-btn" data-task-id="${safe(task.id)}" data-task-status="已完成">完成任务</button>`;
  return '';
}

function renderExecution() {
  const root = $id('activityExecution');
  if (!root) return;
  if (state.status === 'unavailable') return void (root.innerHTML = stageBar('execution') + unavailableHtml());
  if (!state.evidence) return void (root.innerHTML = stageBar('execution') + '<div class="activity-loading">正在读取任务状态…</div>');
  const e = state.evidence;
  const missingStores = e.stores.filter(row => row.evidence_status === '缺少证据');
  const latestRecord = [...state.analyses].reverse().find(row => row.status === 'success');
  root.innerHTML = `${stageBar('execution')}<div class="activity-grid two"><div class="activity-panel"><h2>业务执行</h2><div class="activity-muted">AI只生成建议；NKA客户经理确认、战区销售执行、营销负责人验收。任务写入本地Mock服务，不代表已下发勤策365。</div><div class="activity-kv"><span>建议来源</span><strong>${latestRecord ? `${safe(latestRecord.id)} · 数据v${latestRecord.data_version}` : '尚无AI研判'}</strong></div><div class="activity-kv"><span>责任链</span><strong>NKA确认 → 战区执行 → 营销验收</strong></div><div class="activity-actions"><button class="activity-btn" data-action="create-task" ${latestRecord ? '' : 'disabled'}>人工确认并创建P0核查任务</button></div></div><div class="activity-panel"><h3>补充匿名模拟证据</h3><div class="activity-form"><label>门店<select id="evidenceStore">${missingStores.length ? missingStores.map(row => `<option value="${safe(row.store_id)}">${safe(row.store_id)}</option>`).join('') : '<option value="STORE-A10">STORE-A10</option>'}</select></label><label>证据类型<select id="evidenceType"><option>战区巡店核查</option><option>第三方执行补证</option></select></label><label>证据说明<textarea id="evidenceNote" placeholder="例如：匿名模拟证据，促销员已到岗，陈列待调整"></textarea></label><button class="activity-btn" data-action="submit-evidence">写回证据并更新版本</button></div></div></div><div class="activity-panel"><h3>任务队列</h3><div class="activity-list">${state.tasks.length ? state.tasks.map(task => `<div class="activity-row"><b><span class="gate-tag warn">${safe(task.priority || 'P0')}</span> ${safe(task.title)}</b> <span class="gate-tag">${safe(task.status)}</span><div class="activity-kv"><span>来源</span><strong>${safe(task.source_analysis_id || '历史人工任务')}</strong></div><div class="activity-kv"><span>责任链</span><strong>${safe(task.confirmer_role || 'NKA客户经理')}确认 → ${safe(task.executor_role || task.owner_role)}执行 → ${safe(task.reviewer_role || '营销负责人')}验收</strong></div><div class="activity-muted">截止 ${safe(task.due_date)} · ${safe(task.id)} · 证据要求：${(task.required_evidence || []).map(safe).join('、') || '待定义'}</div><div class="activity-form">${nextTaskAction(task)}</div></div>`).join('') : '<div class="activity-muted">暂无活动任务。先运行AI研判，再由人工确认创建任务。</div>'}</div></div>`;
}

function renderReview() {
  const root = $id('activityReview');
  if (!root) return;
  if (state.status === 'unavailable') return void (root.innerHTML = stageBar('review') + unavailableHtml());
  if (!state.evidence) return void (root.innerHTML = stageBar('review') + '<div class="activity-loading">正在准备经营复盘…</div>');
  const e = state.evidence;
  const before = e.metrics.periods.before.sales;
  const during = e.metrics.periods.during.sales;
  const change = before ? (during - before) / before * 100 : null;
  const completeTasks = state.tasks.filter(task => task.status === '已完成').length;
  const successes = state.analyses.filter(row => row.status === 'success');
  const firstRun = successes[0];
  const latestRun = successes.at(-1);
  root.innerHTML = `${stageBar('review')}<div class="activity-panel"><h2>AI经营分析 · 补证前后复盘</h2>${truthTags(true)}<div class="activity-muted">以下仅为匿名变化观察，不等于因果增量。${canClaimCausalLift(e) ? '已具备有效对照。' : '当前没有有效对照组，暂不能形成ROI结论。'}</div></div><div class="activity-grid"><div class="activity-panel"><div class="activity-muted">销售变化观察</div><div class="activity-value">${change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}</div><div class="activity-muted">活动期相对活动前 · 非因果</div></div><div class="activity-panel"><div class="activity-muted">活动期模拟毛利</div><div class="activity-value">${money(e.metrics.activity_margin)}</div><div class="activity-muted">未混入真实NKA毛利</div></div><div class="activity-panel"><div class="activity-muted">费用覆盖观察</div><div class="activity-value">${money(e.metrics.contribution_observation)}</div><div class="activity-muted">模拟毛利－可归属费用 · 非完整ROI</div></div></div><div class="activity-grid two"><div class="activity-panel"><h3>补证前后版本</h3><div class="activity-kv"><span>首次研判</span><strong>${firstRun ? `${safe(firstRun.id)} · v${firstRun.data_version}` : '尚无记录'}</strong></div><div class="activity-kv"><span>当前研判</span><strong>${latestRun ? `${safe(latestRun.id)} · v${latestRun.data_version}` : '尚无记录'}</strong></div><div class="activity-kv"><span>执行证据覆盖</span><strong>${pct(e.completeness.execution_coverage)}</strong></div><div class="activity-kv"><span>已完成任务</span><strong>${completeTasks}/${state.tasks.length}</strong></div><div class="activity-muted">补证后需重新运行研判；旧版本不会被新证据覆盖。</div></div><div class="activity-panel"><h3>当前管理建议</h3>${latestRun?.analysis ? `<div class="activity-row"><b>${safe(latestRun.analysis.management_summary?.title || '')}</b><div>${safe(latestRun.analysis.management_summary?.conclusion || '')}</div></div>` : '<div class="activity-muted">尚无持久化AI研判记录。</div>'}<div class="activity-row"><b>边界</b><div>无库存数据不判断缺货；无有效对照不声称因果增量；费用调整必须人工审批。</div></div></div></div><div class="activity-panel"><h3>AI质量评测 · 冻结样本计划</h3><div class="activity-grid"><div><b>事实引用正确率</b><div class="activity-muted">待用10—20个匿名案例人工标注</div></div><div><b>建议可执行率</b><div class="activity-muted">待NKA/战区销售评审</div></div><div><b>采纳率与修正率</b><div class="activity-muted">试点后采集，不虚报结果</div></div></div></div>`;
}

function renderAll() {
  renderDashboardFocus();
  renderDataFoundation();
  renderAnalysis();
  renderExecution();
  renderReview();
}

async function loadAll() {
  state = { ...initialActivityState, status: 'loading' };
  renderAll();
  try {
    const [sources, activityList, tasks] = await Promise.all([api.getDataSources(), api.listActivities(), api.getTasks()]);
    activityId = activityList.activities[0]?.id || activityId;
    const [evidence, analysisList, agentList] = await Promise.all([api.getEvidence(activityId), api.getAnalyses(activityId), api.getAgentRuns(activityId)]);
    const analyses = analysisList.analyses || [];
    const latest = [...analyses].reverse().find(row => row.status === 'success');
    dispatch({ type: 'LOAD_SUCCESS', sources, activities: activityList.activities, evidence, tasks: tasks.tasks || [], analyses, agentRuns: agentList.runs || [], analysis: latest?.analysis || null });
  } catch (error) {
    dispatch({ type: 'LOAD_FAILURE', error: { code: error.code, message: error.message } });
  }
}

async function refreshEvidence() {
  const evidence = await api.getEvidence(activityId);
  dispatch({ type: 'EVIDENCE_UPDATED', evidence });
}

document.addEventListener('click', async event => {
  const questionButton = event.target.closest('[data-agent-question]');
  if (questionButton) {
    const input = $id('agentQuestion');
    if (input) input.value = questionButton.dataset.agentQuestion;
    return;
  }
  const go = event.target.closest('[data-go-page]');
  if (go) {
    window.navigate?.(go.dataset.goPage);
    setTimeout(renderAll, 0);
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  event.preventDefault();
  try {
    if (action === 'retry') return void loadAll();
    if (action === 'analyze') {
      dispatch({ type: 'ANALYSIS_START' });
      const payload = await api.runAnalysis(activityId, { question: '请分析本次KA活动的经营表现、数据缺口和优先核查动作', role: '经营管理者' });
      return void dispatch({ type: 'ANALYSIS_RESULT', payload });
    }
    if (action === 'run-agent') {
      const question = $id('agentQuestion')?.value.trim();
      if (!question) throw new Error('请输入具体核查问题');
      dispatch({ type: 'AGENT_START' });
      const payload = await api.runAgent({ activity_id: activityId, question });
      return void dispatch({ type: 'AGENT_RESULT', payload });
    }
    if (action === 'create-task') {
      const latest = [...state.analyses].reverse().find(row => row.status === 'success');
      await api.createTask({ activity_id: activityId, title: 'KA-A活动执行与低效门店核查', owner_role: '战区销售', executor_role: '战区销售', confirmer_role: 'NKA客户经理', reviewer_role: '营销负责人', priority: 'P0', source_analysis_id: latest?.id, due_date: '2026-10-24', required_evidence: ['促销员到岗', '活动陈列', '门店售价'], human_decision: '人工确认：先核查执行证据，不直接追加营销投入' });
      const tasks = await api.getTasks();
      return void dispatch({ type: 'TASKS_UPDATED', tasks: tasks.tasks || [] });
    }
    if (action === 'submit-evidence') {
      const note = $id('evidenceNote')?.value.trim();
      if (!note) throw new Error('请填写匿名模拟证据说明');
      await api.submitEvidence(activityId, { store_id: $id('evidenceStore').value, type: $id('evidenceType').value, note, status: '待核验' });
      return void await refreshEvidence();
    }
  } catch (error) {
    state = { ...state, error: { code: error.code, message: error.message }, aiStatus: action === 'analyze' ? 'failed' : state.aiStatus };
    renderAll();
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-task-id][data-task-status]');
  if (!button) return;
  const id = button.dataset.taskId;
  const status = button.dataset.taskStatus;
  const patch = { status, human_decision: `人工操作：${status}` };
  if (status === '待补证') patch.proof = $id(`proof-${id}`)?.value.trim();
  if (status === '已完成') patch.review = $id(`review-${id}`)?.value.trim();
  try {
    await api.updateTask(id, patch);
    const tasks = await api.getTasks();
    dispatch({ type: 'TASKS_UPDATED', tasks: tasks.tasks || [] });
  } catch (error) {
    state = { ...state, error: { code: error.code, message: error.message } };
    renderAll();
  }
});

if (typeof window.render === 'function') {
  const legacyRender = window.render;
  window.render = function activityAwareRender(...args) {
    const result = legacyRender.apply(this, args);
    queueMicrotask(renderAll);
    return result;
  };
}
document.addEventListener('change', () => setTimeout(renderAll, 0));

renderAll();
loadAll();
