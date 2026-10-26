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
  const request=question=>jsonRequest(base+'/api/weekend-promos/investigate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cycle_id:cycle,store_id:'HEMA-DEMO-01',question,review_kind:'standard'})});
  assert.equal((await request('临促预算多少')).response.status,400);assert.equal(calls,0);
  const ok=await request('核查这家店的本次临促差距');assert.equal(ok.body.agent_status,'success');assert.equal(calls,1);assert.equal(ok.body.chat_run.context.selected_store.store_id,'HEMA-DEMO-01');
  const cached=await jsonRequest(base+'/api/weekend-promos/current?cycle_id='+cycle);assert.equal(cached.body.saved_reviews['HEMA-DEMO-01'].id,ok.body.chat_run.id);assert.equal(calls,1);
 });
});

test('AI workflow gates followups and drafts on actual result, selected store and human decision',()=>{
 const run={id:'real-run',analysis:{facts:[]},context:{selected_store:{store_id:'HEMA-DEMO-01'}}};
 const base={run,selected:'HEMA-DEMO-01'};
 assert.deepEqual(model.analysisAccess({run:null,selected:base.selected,decision:'adopted'}),{hasResult:false,canFollowup:false,canDraft:false});
 assert.deepEqual(model.analysisAccess(base),{hasResult:true,canFollowup:true,canDraft:false});
 assert.equal(model.analysisAccess({...base,decision:'adopted'}).canDraft,true);
 assert.equal(model.analysisAccess({...base,decision:'rejected'}).canDraft,false);
 assert.equal(model.analysisAccess({...base,decision:'modified',amendment:' '}).canDraft,false);
 assert.equal(model.analysisAccess({...base,decision:'modified',amendment:'先复核照片和时间'}).canDraft,true);
 assert.equal(model.analysisAccess({...base,decision:'adopted',busy:true}).canDraft,false);
 assert.equal(model.analysisAccess({...base,decision:'adopted',selected:'HEMA-DEMO-02'}).canDraft,false);
});

test('saved standard reviews require matching cycle, store, evidence and success; followups never replace them',async()=>{
 const {savedPromoReviews}=await import('../server/nka-saved-review.mjs');
 const store=report.stores[0];
 const run={id:'saved',status:'success',created_at:'2026-10-26T01:00:00Z',answer_source:'dify_weekend_agent',question:'标准复盘',analysis:{facts:[]},context:{review_kind:'standard',selected_store:{store_id:store.store_id,cycle_id:cycle},store:structuredClone(store),cycle:structuredClone(report.cycle)}};
 assert.equal(savedPromoReviews(report,[run])[store.store_id].id,'saved');
 for(const mutate of [r=>r.status='failed',r=>r.context.selected_store.cycle_id='OTHER',r=>r.context.selected_store.store_id='OTHER',r=>r.context.store.current_pos++,r=>r.context.cycle.pos_as_of='new',r=>r.context.review_kind='followup',r=>r.analysis=null]) {
  const changed=structuredClone(run);mutate(changed);assert.deepEqual(savedPromoReviews(report,[changed]),{});
 }
 const newer=structuredClone(run);newer.id='newer';newer.created_at='2026-10-26T02:00:00Z';
 assert.equal(savedPromoReviews(report,[newer,run])[store.store_id].id,'newer');
 const followup=structuredClone(newer);followup.context.review_kind='followup';followup.id='followup';
 assert.equal(savedPromoReviews(report,[run,followup])[store.store_id].id,'saved');
});

test('review directions merge merchandising signals without forcing a second direction',()=>{
 const groups=model.reviewDirections([{text:'核对陈列面积2㎡与参考3.2㎡的差距'},{text:'核对分销SKU4个与参考6个的差距'}]);
 assert.equal(groups.length,1);assert.equal(groups[0].label,'商品与陈列执行');assert.equal(groups[0].items.length,2);
 assert.equal(model.reviewDirections([]).length,0);
 assert.equal(model.reviewDirections([{text:'陈列不足'},{text:'临促在岗待复核'}]).length,2);
});

test('failed update shows friendly notice and keeps technical error in collapsed details',async()=>{
 const vm=await import('node:vm');
 const source=(await readFile(new URL('../nka-promo.js',import.meta.url),'utf8')).split('const nkaBaseRender=')[0];
 const context=vm.createContext({localStorage:{getItem:()=>null},NkaPromoModel:model,esc:value=>String(value).replaceAll('<','&lt;')});vm.runInContext(source,context);
 vm.runInContext("NKA.run={analysis:{}};NKA.error='RemoteDisconnected <unsafe>';NKA.failedRequest={q:'核查临促',initial:true};",context);
 const html=vm.runInContext('nkaErrorPanel()',context);
 assert(html.includes('本次更新未完成，正在展示上次复盘。'));assert(html.includes('重试'));assert(!html.split('<details>')[0].includes('RemoteDisconnected'));assert(html.includes('<details><summary>错误详情</summary>'));assert(html.includes('&lt;unsafe>'));assert(!html.includes('<details open'));
 vm.runInContext('NKA.run=null',context);assert(vm.runInContext('nkaErrorPanel()',context).includes('仍可查看BI事实'));
});
