(function(root){
function totals(rows){const valid=rows.filter(x=>Number.isFinite(x.current_pos)),pos=valid.reduce((a,x)=>a+x.current_pos,0),target=rows.reduce((a,x)=>a+x.target,0),achieved=valid.filter(x=>x.achievement_rate>=100).length;return{pos,target,rate:target?pos/target*100:null,achieved,count:rows.length,complete:valid.length,personDays:rows.reduce((a,x)=>a+(x.promoter_count||0)*(x.promo_days||0),0),cost:rows.reduce((a,x)=>a+(x.promo_cost||0),0)};}
function priorities(rows){return rows.filter(x=>x.ai_eligible).sort((a,b)=>(b.target-b.current_pos)-(a.target-a.current_pos)||a.store_id.localeCompare(b.store_id)).slice(0,3);}
function scoped(rows,region){return rows.filter(x=>region==='all'||x.region===region);}
function change(current,previous){return Number.isFinite(current)&&Number.isFinite(previous)&&previous>0?(current-previous)/previous*100:null;}
function analysisAccess({run,selected,decision,amendment='',busy=false}){const hasResult=Boolean(run?.analysis&&run?.context?.selected_store?.store_id===selected);return{hasResult,canFollowup:hasResult&&!busy,canDraft:hasResult&&!busy&&(decision==='adopted'||decision==='modified'&&Boolean(String(amendment||'').trim()))};}
const api={totals,priorities,scoped,change,analysisAccess};if(typeof module!=='undefined')module.exports=api;else root.NkaPromoModel=api;
})(typeof window==='undefined'?globalThis:window);
