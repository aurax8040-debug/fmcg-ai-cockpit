import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../cockpit.css', import.meta.url), 'utf8');
const cockpit = await readFile(new URL('../cockpit.js', import.meta.url), 'utf8');
const promo = await readFile(new URL('../promo-page.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('dashboard is the single primary entry without the four-stage shell', () => {
  assert.match(html, /data-page="dash"/);
  for (const page of ['data-foundation', 'activity-analysis', 'execution', 'review']) {
    assert.equal((html.match(new RegExp(`data-page="${page}"`, 'g')) || []).length, 0);
    assert.equal((html.match(new RegExp(`id="page-${page}"`, 'g')) || []).length, 0);
  }
  assert.doesNotMatch(html, /activity-ui\.mjs|activity\.css/);
});

test('legacy pages remain accessible exactly once', () => {
  for (const page of ['why', 'store', 'ka', 'bi-detail', 'bi-month', 'bi-customer', 'bi-region', 'bi-cate', 'budget', 'pos', 'ai', 'brief']) {
    assert.equal((html.match(new RegExp(`data-page="${page}"`, 'g')) || []).length, 1, page);
    assert.equal((html.match(new RegExp(`id="page-${page}"`, 'g')) || []).length, 1, page);
  }
});

test('dashboard and inline AI chat remain responsive', () => {
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /chat-inline-body/);
  assert.match(css, /cockpit-columns/);
});

test('original dashboard keeps its reports and human task boundary', () => {
  for (const text of ['周末临促分析', 'BI确定性计算', '人工确认', '不自动调整临促资源']) assert.match(cockpit, new RegExp(text));
  assert.doesNotMatch(app, /LLM\/RAG与真实业务接口待接入|当前只验证浏览器演示流程；未连接真实模型/);
  assert.match(html, /nav-secondary/);
});

test('only promo page renders store-level AI while dashboard contains a summary entry',()=>{
 assert.match(html,/data-page="promo"/);assert.match(html,/id="page-promo"/);
 assert.match(promo,/if\(page!=='promo'\)return/);assert.match(promo,/本周临促摘要/);assert.match(promo,/进入临促复盘/);
 assert.match(cockpit,/innerHTML=promoHomeSummary\(\)/);
 assert.doesNotMatch(cockpit,/function screenshotPriorityCard/);
 assert.match(promo,/临促复盘助手/);assert.match(cockpit,/api\/weekend-promos\/investigate/);
 assert.doesNotMatch(cockpit,/api\/dashboard\/chat'/);
 assert.match(css,/page:not\(#page-promo\) \.chat-inline/);assert.match(css,/page:not\(#page-promo\) \.ai-card/);
 assert.match(cockpit,/仅支持临促复盘生成SFA草稿/);
});

test('AI feedback and measurable outcome loop are visible', () => {
  for (const text of ['采纳', '修改后采纳', '否决', 'AI效果验证', '建议采纳率', '任务闭环率', '需复盘样本', '/api/dashboard/evaluation-metrics', '/feedback', '/task-events']) assert.match(cockpit, new RegExp(text));
  assert.match(cockpit, /真实使用与冻结评测分开统计/);
  assert.match(app, /recordAiTaskEvent\(t\.aiRunId,'completed'/);
});

test('promo page retains BI screening, anonymous comparisons and human task boundary',()=>{
 for(const text of ['本周临促大盘','异常门店','AI已调用','门店POS','SFA巡店','匿名达标门店基准','生成拜访待办','不自动调整临促资源'])assert.ok((cockpit+promo).includes(text),text);
 assert.match(cockpit,/weekendPromoSelected=null/);assert.match(cockpit,/if\(!weekendPromoSelected\)return null/);
 assert.match(cockpit,/context_type==='weekend_promo'/);
 assert.match(cockpit,/if\(weekendPromoSelected!==store.store_id\)return/);
});
