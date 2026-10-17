import assert from 'node:assert/strict';
import {defaults,calculate,scenarios} from '../../tools/sales-economics/engine.mjs';
const r=calculate(defaults);
assert.equal(r.deals,24);
assert.equal(r.revenue,1440000);
assert.equal(r.grossProfit,648000);
assert.equal(r.commissions,57600);
assert.equal(r.fixedCost,370000);
assert.equal(r.profit,220400);
assert.equal(r.breakEvenDeals,16);
assert.equal(r.breakEvenLeads,134);
const v=scenarios(defaults);
assert.equal(v[0].conversion,10);assert.equal(v[1].conversion,12);assert.equal(v[2].conversion,14);
assert.equal(v[0].profit,122000);assert.equal(v[1].profit,220400);assert.equal(v[2].profit,318800);
let zero=calculate({...defaults,conversion:0});assert.equal(zero.deals,0);assert.equal(zero.breakEvenLeads,null);assert.equal(zero.profit,-370000);
let noMargin=calculate({...defaults,grossMargin:5,commission:10});assert.equal(noMargin.breakEvenDeals,null);assert.equal(noMargin.breakEvenLeads,null);
let noFixed=calculate({...defaults,managerCount:0,marketing:0,otherFixed:0,managerFullCost:0});assert.equal(noFixed.breakEvenDeals,0);
let maxRate=scenarios({...defaults,conversion:99});assert.equal(maxRate[2].conversion,100);
for(const key of ['leads','conversion','averageCheck','grossMargin','managerCount','managerFullCost','commission','marketing','otherFixed']){
 assert.throws(()=>calculate({...defaults,[key]:-1}),RangeError);
 assert.throws(()=>calculate({...defaults,[key]:Infinity}),RangeError);
 assert.throws(()=>calculate({...defaults,[key]:''}),RangeError);
}
assert.throws(()=>calculate({...defaults,conversion:101}),RangeError);
assert.throws(()=>calculate({...defaults,managerCount:2.5}),RangeError);
console.log('OK 37+ проверок формул, валидации и пограничных сценариев');

// Exact boundaries and arithmetic identities, independently checked from the UI.
const zeroCosts={...defaults,managerCount:0,managerFullCost:0,marketing:0,otherFixed:0};
assert.equal(calculate({...zeroCosts,grossMargin:0,commission:0,conversion:0}).breakEvenDeals,0);
assert.equal(calculate({...zeroCosts,grossMargin:0,commission:0,conversion:0}).breakEvenLeads,0);
assert.equal(calculate({...zeroCosts,averageCheck:0}).breakEvenDeals,0);
assert.equal(calculate({...zeroCosts,averageCheck:.1,grossMargin:10,commission:0,otherFixed:.07}).breakEvenDeals,7);
assert.equal(calculate({...defaults,conversion:100}).deals,200);
assert.equal(calculate({...defaults,conversion:100}).profit,4550000);
assert.equal(calculate({...defaults,grossMargin:0}).profit,-427600);
assert.equal(calculate({...defaults,averageCheck:0}).profit,-370000);
assert.equal(calculate({...defaults,marketing:2000000}).profit,-1679600);
assert.equal(calculate({...defaults,conversion:.01}).deals,.02);
assert.equal(scenarios({...defaults,conversion:0})[0].conversion,0);
assert.equal(scenarios({...defaults,conversion:100})[2].conversion,100);
for(let i=1;i<=150;i++){
 const inputs={...defaults,leads:50+i,conversion:(i%100)+.25,averageCheck:500+i*130,grossMargin:35,commission:3,managerCount:i%5,marketing:1000+i,otherFixed:700};
 const m=calculate(inputs);
 assert.ok(Math.abs(m.profit-(inputs.leads*inputs.conversion/100*inputs.averageCheck*(inputs.grossMargin-inputs.commission)/100-m.fixedCost))<1e-6);
 const q=m.breakEvenDeals;
 assert.ok(q*m.contributionPerDeal-m.fixedCost>=-1e-6);
 if(q>0)assert.ok((q-1)*m.contributionPerDeal-m.fixedCost<0);
}
console.log('Additional boundaries and 150 independent break-even/profit checks: OK');
