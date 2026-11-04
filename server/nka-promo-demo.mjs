import {readFile} from 'node:fs/promises';
import {loadFixture} from './domain.mjs';
export function attachNkaPromoDemo(dataset,extra){
 const merged=structuredClone(dataset);
 for(const key of ['ka_customers','stores','weekend_promo_cycles','weekend_promo_results','weekend_promo_resources','weekend_promo_sfa'])merged[key]=[...(merged[key]||[]),...(extra[key]||[])];
 return loadFixture(merged);
}
export async function loadNkaPromoDemo(dataset){return attachNkaPromoDemo(dataset,JSON.parse(await readFile(new URL('../demo-data/nka-promo-demo.json',import.meta.url),'utf8')));}
export function assertPromoDemoQuestion(question){
 const q=String(question||'').trim();
 if(!q||q.length>1000||/预算|全渠道|普通客户|客户经营|毛利|ERP|上月|上季度|全年|写代码|天气|股票|忽略.*规则/.test(q)||!/临促|本周|门店|这家店|SFA|巡店|陈列|SKU|商品|对标|达标|差距|原因|证据|下周|建议|跟进|验证|POS/i.test(q)){const e=new Error('仅支持选中门店的本次临促复盘和下周SFA验证建议，不回答预算或泛经营问题');e.code='INVALID_INPUT';throw e;}
 return q;
}
