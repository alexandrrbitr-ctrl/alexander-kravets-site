import test from "node:test";
import assert from "node:assert/strict";
import {DEMO,validate,calculate,simulate} from "../tools/sales-economics/model.js";
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test("archive example: monthly economics and 929-lead break-even",()=>{
  assert.deepEqual(calculate(DEMO),{deals:40,revenue:2000000,gross:700000,expenses:650000,profit:50000,cac:6250,breakeven:929});
});
test("archive scenario: 4% to 5%, same costs, +175000 rubles",()=>{
  const s=simulate(DEMO,1);assert.equal(s.targetConversion,5);assert.equal(s.target.profit,225000);assert.equal(s.difference,175000);assert.equal(s.target.expenses,650000);
});
test("loss at 1% conversion",()=>{assert.equal(calculate({...DEMO,conversion:1}).profit,-475000)});
test("all-zero reset and no division by zero",()=>{
  const d=Object.fromEntries(Object.keys(DEMO).map(k=>[k,0]));assert.deepEqual(calculate(d),{deals:0,revenue:0,gross:0,expenses:0,profit:0,cac:null,breakeven:0});
});
for(const field of ["conversion","ticket","margin"]){test(`zero ${field}: break-even unreachable with positive expenses`,()=>{const r=calculate({...DEMO,[field]:0});assert.equal(r.breakeven,null);assert.equal(r.profit,-650000)})}
test("zero expenses need zero leads",()=>assert.equal(calculate({...DEMO,marketing:0,payroll:0,other:0}).breakeven,0));
test("fractional expected deals are not rounded before money calculations",()=>{
  assert.deepEqual(calculate({leads:125,conversion:2.5,ticket:800,margin:40,marketing:500,payroll:200,other:100}),{deals:3.125,revenue:2500,gross:1000,expenses:800,profit:200,cac:160,breakeven:100});
});
test("100% ceiling is applied to the actual scenario",()=>{
  const s=simulate({...DEMO,conversion:99.5},10);assert.equal(s.targetConversion,100);assert.equal(s.actualUplift,0.5);
  assert.equal(simulate({...DEMO,conversion:100},10).difference,0);
});
test("decimal cost sum must not add a spurious break-even lead",()=>{
  assert.equal(calculate({leads:3,conversion:100,ticket:0.1,margin:100,marketing:0.1,payroll:0.2,other:0}).breakeven,3);
});
test("any positive cost needs at least one lead",()=>{
  assert.equal(calculate({...DEMO,conversion:100,ticket:1000000000,margin:100,marketing:0.0000001,payroll:0,other:0}).breakeven,1);
});
test("maximum supported inputs remain finite",()=>{
  const r=calculate({leads:100000000,conversion:100,ticket:1000000000,margin:100,marketing:1000000000,payroll:1000000000,other:1000000000});assert.equal(r.revenue,100000000000000000);assert.equal(r.breakeven,3);assert.ok(Number.isFinite(r.profit));
});
test("empty, negative, nonfinite, out-of-range and fractional leads are rejected",()=>{
  for(const bad of ["",null,undefined,-1,NaN,Infinity,100000001,1.5])assert.equal(validate({...DEMO,leads:bad}).valid,false);
  for(const field of ["conversion","margin"])assert.equal(validate({...DEMO,[field]:100.1}).valid,false);
  assert.equal(validate({...DEMO,ticket:1000000001}).valid,false);
  assert.throws(()=>calculate({...DEMO,margin:-1}),RangeError);assert.throws(()=>simulate(DEMO,-1),RangeError);assert.throws(()=>simulate(DEMO,11),RangeError);
});
test("break-even is the smallest whole-lead count that covers costs",()=>{
  for(let i=1;i<=80;i++){
    const d={leads:i*17,conversion:0.5+i/2,ticket:123+i*19,margin:10+i/2,marketing:100+i*11,payroll:200+i*7,other:i*3};
    const n=calculate(d).breakeven,costs=d.marketing+d.payroll+d.other,unit=d.conversion/100*d.ticket*d.margin/100;
    assert.ok(n*unit>=costs-1e-7);assert.ok((n-1)*unit<costs);near(simulate(d,0).difference,0);
  }
});
