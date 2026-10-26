// Prepare missing standard reviews before demonstration; never fabricate a result.
const base = 'http://127.0.0.1:8787', cycle = 'PROMO-HEMA-WK42';
try {
 const response = await fetch(`${base}/api/weekend-promos/current?cycle_id=${cycle}`);
 if(!response.ok) throw Error('复盘数据读取失败');
 const report = await response.json();
 for(const store of report.stores.filter(x => x.ai_eligible && !report.saved_reviews?.[x.store_id])) {
  const result = await fetch(`${base}/api/weekend-promos/investigate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cycle_id:cycle,store_id:store.store_id,review_kind:'standard',question:'请分析本门店本次周末临促表现。综合POS、临促投入、SFA和匿名对标，给出一句不超过60字的核心判断，最多两个待验证原因，每项不超过65字，以及一项不超过70字的下周SFA核查动作。详细证据放facts，缺证放data_gaps，不重复数据、不认定缺货或因果。'})});
  const body = await result.json();
  if(body.agent_status !== 'success') throw Error(`${store.store_id}复盘准备失败，保留BI事实`);
  console.log(`${store.store_id}复盘已保存`);
 }
 console.log('临促复盘准备完成');
} catch(error) {console.error(error.message);process.exitCode=1;}
