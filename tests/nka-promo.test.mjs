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
 const t=model.totals(report.stores);assert.equal(t.pos,80200);assert.equal(t.target,80000);assert.equal(t.rate,100.25);assert.equal(t.personDays,16);assert.equal(t.cost,6400);assert.equal(t.achieved,5);assert.equal(t.count,8);
 assert.deepEqual(model.priorities(report.stores).map(x=>x.store_id),['HEMA-DEMO-01','HEMA-DEMO-03','HEMA-DEMO-02']);
 assert.equal(model.change(7200,8500).toFixed(1),'-15.3');assert.equal(model.totals([]).rate,null);
 assert.equal(dataset.stores.some(x=>x.id==='HEMA-DEMO-01'),false);
});
test('region-scoped totals and priorities never include another region',()=>{
 const regions=['east','north','central','southwest','northwest'];let sum=0;
 for(const region of regions){const rows=model.scoped(report.stores,region);assert(rows.every(x=>x.region===region));sum+=model.totals(rows).pos;assert(model.priorities(rows).every(x=>x.region===region));}assert.equal(sum,80200);
 const s=report.stores[0];assert.equal(s.benchmark.sample_size,5);assert.equal(s.benchmark.display_area_sqm_median,3.2);assert.equal(s.benchmark.distributed_skus_median,6);assert(!JSON.stringify(s.benchmark).includes('store_name'));
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

test('opening and switching NKA stores never restores saved AI or calls the model',async()=>{
 const vm=await import('node:vm');let calls=[];
 const source=(await readFile(new URL('../nka-promo.js',import.meta.url),'utf8')).split('const nkaBaseRender=')[0];
 const cached={context:{selected_store:{store_id:'HEMA-DEMO-01'}},analysis:{management_summary:{conclusion:'历史AI不应自动出现'}}};
 const context=vm.createContext({localStorage:{getItem:()=>null},NkaPromoModel:model,esc:String,render:()=>{},fetch:async url=>{calls.push(url);return{ok:true,json:async()=>({...report,saved_reviews:{'HEMA-DEMO-01':cached}})};}});
 vm.runInContext(source,context);vm.runInContext('nkaRender=()=>{};',context);
 await vm.runInContext('nkaLoad()',context);
 assert.equal(vm.runInContext('NKA.run',context),null);assert.equal(calls.length,1);assert(calls[0].includes('/current?'));
 vm.runInContext("nkaSelect('HEMA-DEMO-02');nkaSelect('HEMA-DEMO-01');nkaRegion('east');",context);
 assert.equal(vm.runInContext('NKA.run',context),null);assert.equal(calls.length,1);
 const html=vm.runInContext('nkaAnalysisPanel({ai_eligible:true})',context);
 assert(html.includes('开始AI复盘分析'));assert(!html.includes('历史AI不应自动出现'));assert(!html.includes('<h4>AI复盘结论</h4>'));assert(html.includes('不会自动调用模型'));
 const launcher=await readFile(new URL('../双击打开AI经营驾驶舱.command',import.meta.url),'utf8');assert(!launcher.includes('prepare-nka-reviews'));
});

test('two review cases carry traceable mock evidence without changing promo totals',()=>{
 const display=report.stores.find(x=>x.store_id==='HEMA-DEMO-01');
 const sku=report.stores.find(x=>x.store_id==='HEMA-DEMO-02');
 const c=display.review_case;assert.equal(c.demo_only,true);assert.equal(c.sample_size,5);
 const sorted=[...c.peer_areas_sqm].sort((a,b)=>a-b);assert.equal(sorted[2],c.median_area_sqm);
 assert.equal(Number(((c.store_area_sqm/c.median_area_sqm-1)*100).toFixed(1)),c.gap_percent);
 assert(display.trace_ids.includes(c.trace_id));assert(c.note.includes('不代表'));
 const r=sku.review_case;assert.equal(r.active_skus.length,sku.sfa.distributed_skus);
 assert(!r.active_skus.includes(r.candidate.name));assert.equal(r.candidate.listed_at_store,false);
 assert.equal(r.candidate.peer_sales_yuan/r.candidate.peer_total_pos_yuan*100,r.candidate.peer_sales_share_percent);
 assert(sku.trace_ids.includes(r.trace_id));assert.equal(r.missing_evidence.length,4);
 assert.equal(sku.sfa.display_area_sqm,sku.benchmark.display_area_sqm_median);
 assert.equal(model.totals(report.stores).pos,80200);
});

test('office A store misses original target but matches its historical weekend baseline',()=>{
 const s=report.stores.find(x=>x.store_id==='HEMA-DEMO-03'),c=s.review_case;
 assert.equal(s.grade,'A');assert.equal(s.issue_status,'未达标');assert.equal(s.achievement_rate,80);
 assert.equal(s.current_pos,8000);assert.equal(s.target,10000);assert.equal(s.previous_pos,7800);
 assert.equal(c.history.reduce((a,x)=>a+x.weekend_pos_yuan,0)/c.history.length,c.historical_weekend_avg_yuan);
 assert.equal(c.history.reduce((a,x)=>a+x.weekday_daily_avg_yuan,0)/c.history.length,c.weekday_daily_avg_yuan);
 assert.equal(c.historical_weekend_avg_yuan/2,c.weekend_daily_avg_yuan);
 assert.equal(s.current_pos,c.historical_weekend_avg_yuan);assert.equal(c.current_vs_historical_percent,0);
 assert.equal(Number(((s.current_pos/s.previous_pos-1)*100).toFixed(1)),c.current_vs_previous_percent);
 assert(s.trace_ids.includes(c.trace_id));assert(s.gaps.every(g=>g.status!=='存在差距'&&g.status!=='存在差异'));
 assert(c.note.includes('不改写原目标'));assert.equal(model.totals(report.stores).achieved,5);
});

test('draft defaults to each store account manager and missing mapping never invents one',async()=>{
 const vm=await import('node:vm'),els={};const get=id=>els[id]??={value:'',textContent:'',hidden:true};
 const source=(await readFile(new URL('../nka-promo.js',import.meta.url),'utf8')).split('const nkaBaseRender=')[0];
 const ctx=vm.createContext({localStorage:{getItem:()=>null},NkaPromoModel:model,esc:String,$:get,doAction:()=>{},nkaRegions:{}});
 vm.runInContext(source,ctx);ctx.rows=structuredClone(report.stores);
 vm.runInContext('NKA.report={stores:rows};nkaRender=()=>{};',ctx);
 for(const id of ['HEMA-DEMO-01','HEMA-DEMO-02','HEMA-DEMO-03']){
  ctx.id=id;vm.runInContext("NKA.selected=id;NKA.run={analysis:{recommended_checks:[{text:'核查执行'}]},context:{selected_store:{store_id:id}}};NKA.decision='adopted';nkaDraft();",ctx);
  const store=report.stores.find(x=>x.store_id===id);assert.equal(get('nkaOwner').value,store.account_manager.name);assert(get('nkaOwnerHint').textContent.includes(store.store_name));
 }
 vm.runInContext("NKA.selected='HEMA-DEMO-03';NKA.report.stores.find(x=>x.store_id===NKA.selected).account_manager=null;nkaDraft();",ctx);
 assert.equal(get('nkaOwner').value,'');assert(get('nkaOwnerHint').textContent.includes('未配置'));
});
