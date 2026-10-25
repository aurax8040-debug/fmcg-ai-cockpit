import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.EVAL_BASE_URL || 'http://127.0.0.1:8787';
const fixture = JSON.parse(await readFile(new URL('../demo-data/ai-evaluation-cases.json', import.meta.url), 'utf8'));
const output = resolve(process.argv[2] || `output/ai-evaluation-${Date.now()}.json`);
const context = {
  scope: { range: '近30天（当前财务KPI仍为财年累计）', region: '全部战区', ka: '全部KA' },
  metrics: { sales: 4659000, profit: 691900, margin_rate: 14.9, volume: 49636, active_stores: 889, total_stores: 987 },
  customers: [{ name: '匿名客户A', sales: 9500, profit: -2900, margin_rate: -30.5 }],
  sources: [{ name: 'NKA商超.xlsx', truth_label: '真实聚合样例' }],
  gaps: ['无门店库存数据', '时间控件未重算财务KPI']
};
const results = [];
for (const item of fixture.cases) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/dashboard/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: item.question, record_type: 'frozen_evaluation', scope_fingerprint: `eval-${item.id}`, context }) });
    const payload = await response.json();
    const text = JSON.stringify(payload.run?.analysis || payload.run?.error || payload.error || {});
    results.push({ ...item, status: payload.chat_status, duration_ms: Date.now() - started, must_include_pass: item.must_include.every(word => text.includes(word)), must_not_claim_pass: item.must_not_claim.every(word => !text.includes(word)), run_id: payload.run?.id || null });
  } catch (error) {
    results.push({ ...item, status: 'runner_failed', duration_ms: Date.now() - started, error: error.message });
  }
}
await writeFile(output, `${JSON.stringify({ fixture_version: fixture.version, label: fixture.label, generated_at: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');
console.log(output);
