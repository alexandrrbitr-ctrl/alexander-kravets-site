import {DEMO,LIMITS,validate,simulate} from "./model.js";

const root=document.querySelector("[data-sales-calculator]");
const $=id=>root.querySelector(`#${id}`);
const ids=Object.keys(LIMITS);
const integer=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0});
const decimal=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2});
const rub=n=>integer.format(Math.round(n))+" ₽";
let announceTimer;
function announce(text) {
  clearTimeout(announceTimer);
  announceTimer=setTimeout(()=>{$("calc-status").textContent=text;},300);
}
function put(id,value) { $(id).textContent=value; }
function show() {
  const parsed=validate(Object.fromEntries(ids.map(id=>[id,$(id).value])));
  for (const id of ids) {
    const error=parsed.errors[id];
    $(id).setAttribute("aria-invalid",String(!!error));
    $(`${id}-error`).hidden=!error;
    $(`${id}-error`).textContent=error||"";
  }
  $("input-error").hidden=parsed.valid;
  const uplift=Number($("uplift").value);
  put("uplift-label",`+${decimal.format(uplift)} п. п.`);
  $("uplift").setAttribute("aria-valuetext",`Прирост на ${decimal.format(uplift)} п. п.`);
  if (!parsed.valid) {
    for (const id of ["profit","deals","revenue","gross","expenses","cac","breakeven","base-profit","target-profit","base-conversion","target-conversion","impact"]) put(id,"—");
    $("profit").className="";
    put("analysis","Исправьте отмеченные поля, чтобы получить расчёт.");
    put("scenario-limit","");
    announce("Расчёт приостановлен. Исправьте отмеченные поля.");
    return;
  }
  const d=parsed.values,s=simulate(d,uplift),base=s.base;
  put("profit",rub(base.profit));
  $("profit").className=base.profit<0?"se-negative":"se-positive";
  put("deals",decimal.format(base.deals));put("revenue",rub(base.revenue));put("gross",rub(base.gross));put("expenses",rub(base.expenses));
  put("cac",base.cac===null?"Нет сделок":rub(base.cac));
  put("breakeven",base.breakeven===null?"Недостижимо":!Number.isFinite(base.breakeven)||base.breakeven>Number.MAX_SAFE_INTEGER?"Вне диапазона точности":integer.format(base.breakeven));
  put("analysis",base.profit<0?"В этой модели расходы выше валовой прибыли. Проверьте конверсию, маржу и состав затрат.":base.profit===0?"Модель находится на границе безубыточности: валовая прибыль равна учтённым расходам.":"Валовая прибыль покрывает указанные расходы. Проверьте, насколько результат устойчив к изменению конверсии.");
  put("base-profit",rub(base.profit));put("target-profit",rub(s.target.profit));
  put("base-conversion",`Конверсия ${decimal.format(d.conversion)}%`);put("target-conversion",`Конверсия ${decimal.format(s.targetConversion)}%`);
  put("scenario-limit",s.actualUplift+0.00000001<uplift?`Конверсия ограничена 100%. Фактический прирост — ${decimal.format(s.actualUplift)} п. п.`:"");
  put("impact",s.difference>0?`Изменение результата: +${rub(s.difference)} в месяц при прежних лидах, чеке, марже и расходах.`:"Результат не изменился при выбранных условиях.");
  announce(`Результат за месяц: ${rub(base.profit)}. При конверсии ${decimal.format(s.targetConversion)}%: ${rub(s.target.profit)}.`);
}
ids.forEach(id=>$(id).addEventListener("input",show));
$("uplift").addEventListener("input",show);
$("reset-example").addEventListener("click",()=>{for (const id of ids) $(id).value=DEMO[id];$("uplift").value="1";show();});
$("clear-all").addEventListener("click",()=>{for (const id of ids) $(id).value="0";$("uplift").value="0";show();});
// Inputs remain in memory only: no fetch, analytics, storage, URL or messenger payload.
show();
