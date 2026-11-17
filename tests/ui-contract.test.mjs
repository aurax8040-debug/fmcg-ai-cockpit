import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../cockpit.css', import.meta.url), 'utf8');
const cockpit = await readFile(new URL('../cockpit.js', import.meta.url), 'utf8');
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
  assert.equal((html.match(/data-page="sales-summary"/g)||[]).length,1);
  for(const id of ['bi-month','bi-customer','bi-region']) {
    assert.equal((html.match(new RegExp(`id="page-${id}"`,'g'))||[]).length,1);
    assert.equal((html.match(new RegExp(`data-page="${id}"`,'g'))||[]).length,0);
  }
  assert.match(html,/src="sales-summary.js/);
  for (const page of ['store', 'ka', 'bi-detail', 'bi-cate', 'budget', 'pos']) {
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

test('inline AI chat calls Dify-backed gateway and shows concise verified output', () => {
  for (const text of ['AI 经营助手', '/api/dashboard/chat', '统一分析与追问入口', '建议下一步', '边界：', 'dashboardAiContext', 'scope_fingerprint', '当前AI读取范围', '生成拜访待办']) assert.match(cockpit, new RegExp(text));
  assert.match(cockpit, /AI暂时不可用/);
  assert.match(css, /\.chat-toggle,\.chat-panel\{display:none!important\}/);
  assert.match(app, /aiRunId:curTask\.aiRunId\|\|null/);
  assert.match(cockpit, /dashboardAiContext/);
});

test('AI feedback and measurable outcome loop are visible', () => {
  for (const text of ['采纳', '修改后采纳', '否决', 'AI效果验证', '建议采纳率', '任务闭环率', '需复盘样本', '/api/dashboard/evaluation-metrics', '/feedback', '/task-events']) assert.match(cockpit, new RegExp(text));
  assert.match(cockpit, /真实使用与冻结评测分开统计/);
  assert.match(app, /recordAiTaskEvent\(t\.aiRunId,'completed'/);
});

test('weekend promo dashboard separates BI screening from controlled agent analysis', () => {
  for (const text of ['周末临促分析', '本周临促大盘', '异常门店', '本周POS', '门店达标', '达标率', 'AI按权限调用POS与SFA', '/api/weekend-promos/current', '/api/weekend-promos/investigate', '让AI分析', 'AI调用的对标结果', 'AI负责选择比较维度', '统一分析与追问入口', '这家店上月POS', '采纳', '修改后采纳', '不采纳', '生成拜访待办']) assert.match(cockpit, new RegExp(text));
  assert.match(cockpit, /weekendPromoSelected=null/);
  assert.match(cockpit, /if\(!weekendPromoSelected\)return null/);
  assert.match(cockpit, /weekendPromoConversationStart=dashboardChatHistory\.length/);
  assert.match(cockpit, /dashboardChatHistory\.slice\(weekendPromoConversationStart\)/);
  assert.match(cockpit, /analyzeWeekendPromoStore\(id\)/);
  for (const text of ['AI已调用', '门店POS', 'SFA巡店', '匿名达标门店基准', '本周POS / 目标', '周六 / 周日', '较上次临促']) assert.match(cockpit, new RegExp(text));
  assert.match(cockpit, /context\.selected_store\?\.store_id\|\|'ALL'/);
  assert.match(cockpit, /不得暴露对标门店明细或声称因果/);
  assert.doesNotMatch(cockpit, /BI证据·同类达标门店对标/);
  assert.doesNotMatch(cockpit, /总体达成/);
  assert.doesNotMatch(cockpit, /BI读取 · 本周最新SFA原始记录/);
  assert.doesNotMatch(cockpit, /SFA \$\{esc\(x\.sfa_status\)\}/);
  assert.doesNotMatch(cockpit, /BI数据明细 · 异常门店/);
  assert.doesNotMatch(cockpit, /佳农ERP＋客户POS|受控商圈台账/);
  assert.doesNotMatch(cockpit, /class="agent-result/);
  for (const text of ['promo-summary', 'promo-store-row', 'promo-store-action', 'promo-gap-table', 'promo-stage-label', 'unified-ai-window', 'ai-promo-result', 'ai-comparison']) assert.match(css, new RegExp(text));
});

test('business navigation places core work first and removes presentation-only entries',()=>{
 const entries=[...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(entries.slice(0,4),['dash','budget','nka-promo','store']);
 for(const id of ['why','ai','brief','mi-joint'])assert(!entries.includes(id));
 assert.doesNotMatch(html,/<script[^>]+src="mi-joint.js/);
 for(const id of ['why','ai','brief'])assert.match(html,new RegExp(`id="page-${id}"`));
});
