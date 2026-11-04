/* 四 Agent 联合分析 · 最小 UI 接线（独立于既有驾驶舱，保持原视觉）。 */
(function () {
  const API = 'http://127.0.0.1:8787/api/mi';
  const MOCK_TAG = '<span class="src ai" style="margin-left:6px">DEMO_MOCK</span>';

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function statusBadge(status) {
    const map = {
      COMPLETE: { text: '完整', bg: '#e6f7ef', color: '#2ba471' },
      PARTIAL: { text: '缺失·PARTIAL', bg: '#fff3e0', color: '#b36b00' },
    };
    const s = map[status] || { text: status, bg: '#f0f2f5', color: '#7a8699' };
    return `<span style="font-size:11px;padding:2px 9px;border-radius:10px;background:${s.bg};color:${s.color};font-weight:600">${s.text}</span>`;
  }

  function money(v) { return v === null || v === undefined ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
  function pct(v) { return v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%'; }

  function agentCard(agent) {
    const issues = agent.execution_issues && agent.execution_issues.length
      ? `<div class="body" style="margin-top:6px;color:#b36b00">⚠ ${agent.execution_issues.map(esc).join('；')}</div>` : '';
    return `<div class="card" style="flex:1;min-width:220px">
      <h3>${esc(agent.agent)} ${statusBadge(agent.status)}</h3>
      <div class="hint">来源：${esc(agent.source)}</div>
      <div class="body">${agentDetail(agent)}</div>${issues}
    </div>`;
  }

  function agentDetail(a) {
    if (a.agent === 'POS/BI') {
      const miss = a.missing_load_dates && a.missing_load_dates.length
        ? `<br><span class="risk">POS 缺失：${a.missing_load_dates.map(m => m.sales_date).join('、')}（源文件未到，不计零销售）</span>` : '';
      return `销售金额 ¥${money(a.total_sales_amount)} · TE ${money(a.total_te_sales)}<br>活动销售 ¥${money(a.activity_sales_amount ?? a.total_sales_amount)} · 明细 ${a.pos_line_count} 行${miss}`;
    }
    if (a.agent === 'SFA') {
      return `拜访 ${a.visit_count} 次 · 已执行 ${a.executed_count} 次<br>完整记录 ${a.complete_record_count} · 缺岗 ${a.absent_count} · 陈列不足 ${a.area_issue_count} · 价格异常 ${a.price_issue_count}`;
    }
    if (a.agent === 'TPM') {
      const fees = Object.entries(a.fee_by_type || {}).map(([k, v]) => `${esc(k)} ¥${money(v)}`).join(' · ');
      return `活动 ${a.activity_count} 场 · 目标 ¥${money(a.target_sales_amount)}<br>费用合计 ¥${money(a.total_fee)}${fees ? '<br>' + fees : ''}`;
    }
    return '';
  }

  function renderStores(stores) {
    const opts = stores.map(s => {
      const mark = s.status === 'PARTIAL' ? ' · 缺失' : '';
      return `<option value="${esc(s.store_id)}">${esc(s.store_id)} · ${esc(s.store_name)} · ${esc(s.region)} · ${esc(s.status)}${mark}</option>`;
    }).join('');
    return `<select id="miStoreSel" style="padding:9px 12px;border:1px solid #dbe3f0;border-radius:8px;font-size:13px;min-width:280px;background:#fff">${opts}</select>
    <select id="miActSel" style="padding:9px 12px;border:1px solid #dbe3f0;border-radius:8px;font-size:13px;background:#fff"><option value="">全部活动</option></select>
    <button class="btn-ai" id="miRun" style="margin-left:4px">✦ 运行联合分析</button>`;
  }

  function renderResult(data) {
    const m = data.meta, ag = data.agents, met = data.metrics, it = data.integrity;
    const bareNote = m.is_bare_missing ? '<div class="risk" style="margin-bottom:10px">该门店在 store 维度存在，但 POS/SFA/TPM 三路均无数据（纯缺失门店）。</div>' : '';
    const integrityChecks = [
      ['store_id 四路一致', it.store_id_consistent],
      ['证据可追溯', it.evidence_traceable],
      ['无串店', it.no_cross_store],
      ['缺失正确标 PARTIAL', it.missing_as_partial],
    ].map(([label, ok]) => `<span style="display:inline-block;margin:3px 8px 3px 0;font-size:12px;padding:3px 9px;border-radius:8px;background:${ok ? '#e6f7ef' : '#fdecea'};color:${ok ? '#2ba471' : '#e34d4d'}">${ok ? '✓' : '✗'} ${label}</span>`).join('');

    return `<div class="card" style="margin-bottom:14px">
      <h3>${esc(m.store_name)} <span style="font-weight:400;color:#7a8699;font-size:12px">${esc(m.store_id)} · ${esc(m.region)} · ${esc(m.market_department)} · ${esc(m.store_grade)}级</span> ${statusBadge(m.overall_status)}</h3>
      <div class="hint">${esc(m.activity_id || '全部活动')} · 数据性质 DEMO_MOCK（虚构模拟，未连接真实系统）</div>
      ${bareNote}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:10px">
        <div class="kpi"><div><div class="label">目标销售额</div><div class="val" style="font-size:18px">¥${money(met.target_sales_amount)}</div></div></div>
        <div class="kpi"><div><div class="label">实际销售额</div><div class="val" style="font-size:18px">¥${money(met.actual_sales_amount)}</div></div></div>
        <div class="kpi"><div><div class="label">达成率</div><div class="val" style="font-size:18px">${pct(met.achievement_rate)}</div></div></div>
        <div class="kpi"><div><div class="label">费用销售比</div><div class="val" style="font-size:18px">${met.cost_to_sales_ratio === null ? '—' : (met.cost_to_sales_ratio * 100).toFixed(2) + '%'}</div></div></div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${agentCard(ag.pos_bi)}${agentCard(ag.sfa)}${agentCard(ag.tpm)}</div>
      <div style="margin-top:10px;padding:10px 12px;background:#f7f9fd;border:1px solid #e4eaf5;border-radius:9px">
        <b style="font-size:12px">完整性校验：</b>${integrityChecks}
        <div style="font-size:11px;color:#7a8699;margin-top:6px">Dify 检索继续使用现有知识库（周末临促执行标准 V1.0），不新建独立知识库。</div>
      </div>
    </div>`;
  }

  async function init() {
    // 注入导航项
    const nav = document.querySelector('.nav-group');
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.page = 'mi-joint';
    item.innerHTML = '<span class="icon">◈</span>四 Agent 联合分析';
    nav.appendChild(item);

    // 注入页面 section
    const section = document.createElement('section');
    section.id = 'page-mi-joint';
    section.className = 'page';
    section.innerHTML = `<div class="notice" style="background:#f7f9fd;border:1px solid #e4eaf5;border-radius:9px;padding:9px 13px;margin-bottom:14px"><b>四 Agent 联合分析（DEMO_MOCK）：</b>POS/BI、SFA、TPM 三路确定性数据 + Dify 知识库检索，基于统一 <b>store_id</b> 端到端贯通。数据为虚构模拟，未连接真实 TPM/SFA/POS 系统。选择门店后运行联合分析。</div><div id="miControls" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px"></div><div id="miResult"></div>`;
    document.querySelector('.main').appendChild(section);

    // 导航点击处理
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === 'mi-joint'));
      document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === 'page-mi-joint'));
      const title = document.getElementById('pageTitle');
      if (title) title.textContent = '四 Agent 联合分析';
      const sub = document.getElementById('pageSub');
      if (sub) sub.textContent = '数据范围：28 家门店 · 24 SKU · 9 场周末临促 · DEMO_MOCK 虚构数据';
      loadStores();
    });

    async function loadStores() {
      const ctrl = document.getElementById('miControls');
      ctrl.innerHTML = '<div class="empty">加载门店列表…</div>';
      try {
        const res = await fetch(API + '/stores');
        const data = await res.json();
        ctrl.innerHTML = renderStores(data.stores);
        await loadActivities();
        document.getElementById('miRun').addEventListener('click', runAnalysis);
      } catch (e) {
        ctrl.innerHTML = `<div class="risk">门店列表加载失败：${esc(e.message)}（请确认已启动本机服务）</div>`;
      }
    }

    async function loadActivities() {
      try {
        const res = await fetch(API + '/activities');
        const data = await res.json();
        const sel = document.getElementById('miActSel');
        sel.innerHTML = '<option value="">全部活动</option>' + data.activities.map(a => `<option value="${esc(a.activity_id)}">${esc(a.activity_id)} · ${esc(a.activity_name)} · ${esc(a.start_date)}~${esc(a.end_date)}</option>`).join('');
      } catch (e) { /* 活动列表可选 */ }
    }

    async function runAnalysis() {
      const storeId = document.getElementById('miStoreSel').value;
      const actId = document.getElementById('miActSel').value;
      const result = document.getElementById('miResult');
      result.innerHTML = '<div class="empty">联合分析中…</div>';
      try {
        const q = actId ? `?activity_id=${encodeURIComponent(actId)}` : '';
        const res = await fetch(`${API}/stores/${encodeURIComponent(storeId)}${q}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        result.innerHTML = renderResult(data);
      } catch (e) {
        result.innerHTML = `<div class="risk">分析失败：${esc(e.message)}</div>`;
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
