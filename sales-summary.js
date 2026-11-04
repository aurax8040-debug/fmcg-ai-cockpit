/* One report entry; original tables and their source notes remain intact. */
(function () {
  const views = [['bi-month', '按月汇总'], ['bi-customer', '按客户汇总'], ['bi-region', '按战区汇总']];
  let selected = 'bi-month';
  const root = document.createElement('section');
  root.id = 'page-sales-summary';
  root.className = 'page';
  root.innerHTML = `<div class="card summary-toolbar"><h3>销售汇总 <span class="tag">多维度查看</span></h3><p class="hint">在同一页面切换月份、客户与战区，查看各维度销售表现。</p><div class="summary-tabs" role="tablist" aria-label="销售汇总维度">${views.map(([id, label]) => `<button type="button" role="tab" id="summary-tab-${id}" aria-controls="page-${id}" data-summary="${id}">${label}</button>`).join('')}</div><p class="hint">本页为原报表冻结数据，各表口径以表内说明为准；顶部经营筛选暂不作用于这些汇总表。</p></div>`;
  const first = document.getElementById('page-bi-month');
  first.before(root);
  views.forEach(([id]) => {
    const panel = document.getElementById('page-' + id);
    panel.classList.remove('page', 'active');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'summary-tab-' + id);
    root.append(panel);
  });
  const style = document.createElement('style');
  style.textContent = `.summary-toolbar{margin-bottom:16px}.summary-tabs{display:flex;gap:6px;flex-wrap:wrap;background:#f1f4ff;padding:5px;border-radius:12px;width:fit-content;margin:14px 0}.summary-tabs button{border:0;background:transparent;color:#667491;border-radius:9px;padding:10px 22px;font:inherit;cursor:pointer}.summary-tabs button[aria-selected="true"]{background:#fff;color:#4a55ed;box-shadow:0 2px 8px #29388c14;font-weight:600}.summary-tabs button:focus-visible{outline:2px solid #6267ff;outline-offset:2px}#page-sales-summary [hidden]{display:none!important}@media(max-width:600px){.summary-tabs{width:100%}.summary-tabs button{flex:1;padding:10px 8px}}`;
  document.head.append(style);
  function update() {
    views.forEach(([id]) => {
      document.getElementById('page-' + id).hidden = id !== selected;
      const button = root.querySelector('[data-summary="' + id + '"]');
      button.setAttribute('aria-selected', String(id === selected));
      button.tabIndex = id === selected ? 0 : -1;
    });
    if (page === 'sales-summary') {
      document.getElementById('pageTitle').textContent = '销售汇总';
      document.getElementById('pageSub').textContent = '月份 / 客户 / 战区 · 原报表冻结快照 · 口径见各表说明';
    }
  }
  root.querySelectorAll('[data-summary]').forEach((button, index) => {
    button.addEventListener('click', () => { selected = button.dataset.summary; update(); });
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % views.length;
      if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = views.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      const target = root.querySelector('[data-summary="' + views[next][0] + '"]');
      target.click(); target.focus();
    });
  });
  const baseNavigate = navigate;
  navigate = function (target) {
    if (views.some(([id]) => id === target)) { selected = target; target = 'sales-summary'; }
    baseNavigate(target); update();
  };
  const baseRender = render;
  render = function () { baseRender(); update(); };
  update();
})();
