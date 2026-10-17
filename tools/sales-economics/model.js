// Local, dependency-free model adapted from the supplied V28 calculator.
export const DEMO = Object.freeze({leads:1000,conversion:4,ticket:50000,margin:35,marketing:250000,payroll:300000,other:100000});
export const LIMITS = Object.freeze({leads:100000000,conversion:100,ticket:1000000000,margin:100,marketing:1000000000,payroll:1000000000,other:1000000000});
export function validate(raw) {
  const values={},errors={};
  for (const [id,max] of Object.entries(LIMITS)) {
    const item=raw[id];
    const n=item===null||item===undefined||String(item).trim()===""?NaN:Number(item);
    values[id]=n;
    if (!Number.isFinite(n)) errors[id]="Введите число.";
    else if (n<0) errors[id]="Значение не может быть отрицательным.";
    else if (n>max) errors[id]=id==="conversion"||id==="margin"?"Допустимо от 0 до 100%.":"Значение выше диапазона модели.";
    else if (id==="leads"&&!Number.isInteger(n)) errors[id]="Укажите целое число обращений.";
  }
  return {valid:Object.keys(errors).length===0,values,errors};
}
function ceilLeads(expenses,perLead) {
  if (expenses===0) return 0;
  if (perLead===0) return null;
  const ratio=expenses/perLead;
  if (!Number.isFinite(ratio)) return Infinity;
  // Avoid an extra lead caused solely by binary rounding, e.g. (0.1 + 0.2) / 0.1.
  const nearest=Math.round(ratio);
  const tolerance=8*Number.EPSILON*Math.max(1,Math.abs(ratio));
  return Math.max(1,Math.abs(ratio-nearest)<=tolerance?nearest:Math.ceil(ratio));
}
export function calculate(raw,conversion=Number(raw.conversion)) {
  const parsed=validate(raw);
  if (!parsed.valid||!Number.isFinite(conversion)||conversion<0||conversion>100) throw new RangeError("Invalid calculator inputs");
  const d=parsed.values,deals=d.leads*conversion/100,revenue=deals*d.ticket,gross=revenue*d.margin/100;
  const expenses=d.marketing+d.payroll+d.other,profit=gross-expenses,perLead=(conversion/100)*d.ticket*(d.margin/100);
  return {deals,revenue,gross,expenses,profit,cac:deals>0?d.marketing/deals:null,breakeven:ceilLeads(expenses,perLead)};
}
export function simulate(raw,uplift) {
  if (!Number.isFinite(uplift)||uplift<0||uplift>10) throw new RangeError("Invalid conversion uplift");
  const base=calculate(raw),targetConversion=Math.min(100,Number(raw.conversion)+uplift),target=calculate(raw,targetConversion);
  return {base,target,targetConversion,actualUplift:targetConversion-Number(raw.conversion),difference:target.profit-base.profit};
}
