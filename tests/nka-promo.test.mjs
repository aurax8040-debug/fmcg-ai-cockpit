import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createRequire} from 'node:module';
import {attachNkaPromoDemo,assertPromoDemoQuestion} from '../server/nka-promo-demo.mjs';
import {summarizeWeekendPromo} from '../server/weekend-promo-review.mjs';
import {createApp} from '../server/app.mjs';import {createStateStore} from '../server/state-store.mjs';
import {dataset,withServer,jsonRequest} from './helpers.mjs';
const model=createRequire(import.meta.url)('../nka-promo-model.js');
const extra=JSON.parse(await readFile(new URL('../demo-data/nka-promo-demo.json',import.meta.url),'utf8'));
const merged=attachNkaPromoDemo(dataset,extra),cycle='PROMO-HEMA-WK42';
const report=summarizeWeekendPromo(merged,{tasks:[]},cycle);
test('NKA demo totals reconcile exactly with the approved mockup',()=>{
 const t=model.totals(report.stores);assert.equal(t.pos,83200);assert.equal(t.target,80000);assert.equal(t.rate,104);assert.equal(t.personDays,16);assert.equal(t.cost,6400);assert.equal(t.achieved,6);assert.equal(t.count,8);
 assert.deepEqual(model.priorities(report.stores).map(x=>x.store_id),['HEMA-DEMO-01','HEMA-DEMO-02']);
 assert.equal(model.change(7200,8500).toFixed(1),'-15.3');assert.equal(model.totals([]).rate,null);
 assert.equal(dataset.stores.some(x=>x.id==='HEMA-DEMO-01'),false);
});
test('region-scoped totals and priorities never include another region',()=>{
 const regions=['east','north','central','southwest','northwest'];let sum=0;
 for(const region of regions){const rows=model.scoped(report.stores,region);assert(rows.every(x=>x.region===region));sum+=model.totals(rows).pos;assert(model.priorities(rows).every(x=>x.region===region));}assert.equal(sum,83200);
 const s=report.stores[0];assert.equal(s.benchmark.sample_size,6);assert.equal(s.benchmark.display_area_sqm_median,3.2);assert.equal(s.benchmark.distributed_skus_median,6);assert(!JSON.stringify(s.benchmark).includes('store_name'));
});
test('NKA question guard refuses general business and accepts scoped review',()=>{
 for(const q of ['临促预算多少','分析全渠道','普通客户经营','上月POS是多少','写代码'])assert.throws(()=>assertPromoDemoQuestion(q));
 assert.equal(assertPromoDemoQuestion('下周SFA应该验证什么'),'下周SFA应该验证什么');
});
test('NKA endpoint rejects out-of-scope questions without calling Dify; valid answers cite actual records',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nka-demo-'));const stateStore=await createStateStore({filePath:join(dir,'state.json')});let calls=0;
 const difyClient={configured:true,run:async input=>{calls++;const evidence=JSON.parse(input.evidence_json);const id=evidence.store.trace_ids[0];return {facts:[{text:'POS未达标',citations:[id]}],data_gaps:[],hypotheses:[],recommended_checks:[{text:'复核SFA照片',citations:[id]}],boundaries:['不认定因果'],management_summary:{title:'执行核查',conclusion:'先核对证据'},citations:[id]};}};
 await withServer(createApp({dataset:merged,stateStore,difyClient}),async base=>{
  const request=question=>jsonRequest(base+'/api/weekend-promos/investigate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cycle_id:cycle,store_id:'HEMA-DEMO-01',question})});
  assert.equal((await request('临促预算多少')).response.status,400);assert.equal(calls,0);
  const ok=await request('核查这家店的本次临促差距');assert.equal(ok.body.agent_status,'success');assert.equal(calls,1);assert.equal(ok.body.chat_run.context.selected_store.store_id,'HEMA-DEMO-01');
 });
});
