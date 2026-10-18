/** Pure commercial model. No data storage or external requests. */
export const defaults = Object.freeze({
  leads: 200,
  conversion: 12,
  averageCheck: 60000,
  grossMargin: 45,
  managerCount: 3,
  managerFullCost: 70000,
  commission: 4,
  marketing: 100000,
  otherFixed: 60000
});
export const constraints = Object.freeze({
  leads: [0,10000000],conversion: [0,100],averageCheck: [0,1000000000],
  grossMargin: [0,100],managerCount: [0,10000],managerFullCost: [0,1000000000],
  commission: [0,100],marketing: [0,100000000000],otherFixed: [0,100000000000]
});
function finiteValue(field, val) {
  const n = Number(val);
  const [min,max]=constraints[field];
  if(val === '' || val === null || val === undefined || !Number.isFinite(n)||n<min||n>max)
    throw new RangeError(`Некорректное значение: ${field}`);
  if(field === 'leads' || field === 'managerCount') {
    if(!Number.isInteger(n))throw new RangeError(`Требуется целое число: ${field}`);
  }
  return n;
}
export function calculate(raw) {
  const v = {};
  for(const key of Object.keys(defaults))v[key]=finiteValue(key,raw[key]);
  const deals = v.leads*v.conversion/100; // expected value, not guaranteed signed contracts
  const revenue=deals*v.averageCheck;
  const productCost=revenue*(100-v.grossMargin)/100;
  const grossProfit=revenue-productCost;
  const commissions=revenue*v.commission/100;
  const payroll=v.managerCount*v.managerFullCost;
  const fixedCost=payroll+v.marketing+v.otherFixed;
  const profit=grossProfit-commissions-fixedCost;
  const contributionPerDeal=v.averageCheck*(v.grossMargin-v.commission)/100;
  // Avoid an extra deal caused only by binary floating-point at an exact threshold.
  const ceilPositive = value => Math.max(1, Math.ceil(value - Number.EPSILON * Math.abs(value) * 4));
  const breakEvenDeals = fixedCost===0?0:contributionPerDeal>0?ceilPositive(fixedCost/contributionPerDeal):null;
  // Leads are evaluated through the continuous expected-conversion model.
  // Rounding whole signed deals first would inflate the minimum lead count.
  const breakEvenLeads = fixedCost===0?0:contributionPerDeal<=0||v.conversion===0?null:ceilPositive(fixedCost*100/(contributionPerDeal*v.conversion));
  const result = {inputs:v,deals,revenue,productCost,grossProfit,commissions,payroll,fixedCost,profit,
    contributionPerDeal,breakEvenDeals,breakEvenLeads};
  if(!Object.values(result).filter(x=>typeof x==='number').every(Number.isFinite))
    throw new RangeError('Расчёт выходит за допустимые границы');
  return result;
}
export function scenarios(v){
  return [-2,0,2].map(delta=>{
    const conversion = Math.max(0,Math.min(100,v.conversion+delta));
    const model=calculate({...v,conversion});
    return {delta,appliedDelta:conversion-v.conversion,conversion,deals:model.deals,revenue:model.revenue,profit:model.profit};
  });
}
export function rub(value){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(value)}
export function number(value,digits=0){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(value)}
export function percent(value){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(value)+'%'}
