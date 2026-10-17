import {defaults,constraints,calculate,scenarios,rub,number,percent} from './engine.mjs';
const form=document.querySelector('#calculator-form');
const status=document.querySelector('#form-status');
const run=document.querySelector('#results');
const fields=[...form.querySelectorAll('[data-field]')];
const els=Object.fromEntries(fields.map(x=>[x.dataset.field,x]));
const out=(id,content)=>document.querySelector('#'+id).textContent=content;
const items={};
let last=null;
for(const key of Object.keys(defaults))els[key].value=defaults[key];
function formValues(){return Object.fromEntries(fields.map(el=>[el.dataset.field,el.value]));}
function render(){
  try{
    const invalid=fields.filter(el=>{
      const value=el.valueAsNumber,[min,max]=constraints[el.dataset.field];
      const bad=el.value===''||!Number.isFinite(value)||value<min||value>max||(['leads','managerCount'].includes(el.dataset.field)&&!Number.isInteger(value));
      el.toggleAttribute('aria-invalid',bad);
      if(bad){el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','form-status');}
      else{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}
      return bad;
    });
    if(invalid.length)throw new RangeError(invalid.map(el=>el.closest('label').querySelector('span').textContent).join(', '));
    const model=calculate(formValues());
    last=model;
    status.textContent='';
    fields.forEach(x=>{x.removeAttribute('aria-invalid');x.setCustomValidity('')});
    out('metric-revenue',rub(model.revenue));
    out('metric-gross',rub(model.grossProfit));
    out('metric-profit',rub(model.profit));
    out('metric-profit-caption',model.profit>=0?'Положительный результат до налогов':'Отрицательный результат до налогов');
    document.querySelector('#metric-profit').dataset.state=model.profit>=0?'positive':'negative';
    out('metric-deals',number(model.deals,1));
    out('metric-leads',number(model.inputs.leads));
    out('metric-conversion',percent(model.inputs.conversion));
    out('cost-products',rub(model.productCost));
    out('cost-commissions',rub(model.commissions));
    out('cost-payroll',rub(model.payroll));
    out('cost-marketing',rub(model.inputs.marketing));
    out('cost-other',rub(model.inputs.otherFixed));
    out('cost-total',rub(model.productCost+model.commissions+model.fixedCost));
    out('break-even-deals',model.breakEvenDeals===null?'Недостижима':number(model.breakEvenDeals));
    out('break-even-leads',model.breakEvenLeads===null?'Не рассчитывается':number(model.breakEvenLeads));
    out('break-even-help',model.fixedCost===0&&model.contributionPerDeal<=0?'Без постоянных расходов результат при отсутствии сделок равен нулю. При таком соотношении маржи и бонусов рост продаж не улучшает результат.':model.contributionPerDeal<=0?'Переменные затраты на сделку не ниже валовой прибыли: при этих постоянных расходах масштабирование не приведёт к безубыточности.':model.inputs.conversion===0&&model.breakEvenDeals>0?'При нулевой конверсии число лидов для безубыточности определить нельзя.':'При неизменных конверсии, чеке, расходах и структуре продаж.');
    const cards = scenarios(model.inputs);
    document.querySelector('#scenario-list').replaceChildren(...cards.map(s=>{
      const article=document.createElement('article');
      article.className='calc-scenario'+(s.delta===0?' calc-scenario--base':'');
      const sign=s.appliedDelta>0?'+':'';
      const name=s.delta===0?'Текущий сценарий':s.appliedDelta===0?(s.delta<0?'Минимальная конверсия':'Максимальная конверсия'):`${sign}${Number(s.appliedDelta.toFixed(2))} п.п. конверсии`;
      const title=document.createElement('h3');title.textContent=name;
      const rate=document.createElement('p');rate.className='calc-scenario__rate';rate.textContent=`Конверсия ${percent(s.conversion)}`;
      const val=document.createElement('strong');val.className='calc-scenario__value';val.textContent=rub(s.profit);
      if(s.profit<0)val.classList.add('calc-is-negative');
      const meta=document.createElement('p');meta.className='calc-scenario__meta';meta.textContent=`${number(s.deals,1)} ожидаемых сделок · ${rub(s.revenue)} выручки`;
      article.append(title,rate,val,meta);return article;
    }));
    run.removeAttribute('aria-busy');
  }catch(err){
    last=null;
    for(const id of ['metric-revenue','metric-gross','metric-profit','metric-deals','cost-products','cost-commissions','cost-payroll','cost-marketing','cost-other','cost-total','break-even-deals','break-even-leads'])out(id,'—');
    document.querySelector('#scenario-list').replaceChildren();
    run.removeAttribute('aria-busy');
    out('metric-leads','—');out('metric-conversion','—');out('metric-profit-caption','Введите корректные данные');out('break-even-help','Расчёт появится после исправления значений.');
    document.querySelector('#metric-profit').removeAttribute('data-state');
    status.textContent='Проверьте введённые значения: '+err.message+'. Лиды и менеджеры — целые неотрицательные числа; проценты — от 0 до 100; суммы — в пределах, указанных в полях.';
  }
}
form.addEventListener('submit',event=>{event.preventDefault();render()});
let timer;
form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,45)});
form.addEventListener('change',render);
document.querySelector('#reset').addEventListener('click',()=>{
 for(const [key,val] of Object.entries(defaults))els[key].value=val;
 render(); els.leads.focus();status.textContent='Примерные значения восстановлены.';
});
document.querySelector('#copy').addEventListener('click',async()=>{
 if(!last){status.textContent='Сначала исправьте значения.';return;}
 const d=last;
 const summary=`Экономика отдела продаж — расчёт (оценка до налогов)\nЛиды: ${number(d.inputs.leads)}; конверсия: ${percent(d.inputs.conversion)}; средний чек: ${rub(d.inputs.averageCheck)}\nОжидаемые сделки: ${number(d.deals,1)}; выручка: ${rub(d.revenue)}\nВаловая прибыль: ${rub(d.grossProfit)}; переменные бонусы: ${rub(d.commissions)}; полная стоимость команды: ${rub(d.payroll)}\nМаркетинг: ${rub(d.inputs.marketing)}; прочие постоянные расходы: ${rub(d.inputs.otherFixed)}\nРезультат до налогов: ${rub(d.profit)}\nБезубыточность: ${d.breakEvenDeals===null?'не достигается':number(d.breakEvenDeals)+' сделок'}, ${d.breakEvenLeads===null?'лиды не рассчитываются':number(d.breakEvenLeads)+' лидов'}\nМодель оценочная: не учтены налоги и неуказанные расходы.\nhttps://alexandrrbitr-ctrl.github.io/alexander-kravets-site/tools/sales-economics/`;
 try{await navigator.clipboard.writeText(summary);status.textContent='Расчёт скопирован.'}
 catch{ const helper=document.createElement('textarea');helper.value=summary;helper.style.position='fixed';helper.style.opacity='0';document.body.appendChild(helper);helper.select(); const ok=document.execCommand('copy');helper.remove();status.textContent=ok?'Расчёт скопирован.':'Не удалось скопировать автоматически.' }
 document.querySelector('#copy').focus();
});
render();
