// Local browser regression checks. Requires Playwright and Microsoft Edge.
// Run from the repository root; NODE_PATH may point to an existing Playwright installation.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=process.cwd(), output=__dirname;
const prefix='/alexander-kravets-site/';
const server=http.createServer((req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith(prefix))throw new Error('outside project');
    let file=path.resolve(root,pathname.slice(prefix.length));
    if(file!==root&&!file.startsWith(root+path.sep))throw new Error('outside root');
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    const types={'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
    res.setHeader('Content-Type',types[path.extname(file)]||'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  }catch{res.statusCode=404;res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const url=origin+prefix+'tools/sales-economics/';
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const results=[],externalRequests=[],screenshots=[];
  let checks=0;
  const check=(value,label)=>{assert.ok(value,label);checks++;};
  try{
    for(const width of [360,390,1440]){
      const context=await browser.newContext({viewport:{width,height:width<700?844:1000},locale:'ru-RU',permissions:['clipboard-read','clipboard-write']});
      const page=await context.newPage(),errors=[],httpErrors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
      await context.route('**/*',async route=>{
        if(new URL(route.request().url()).origin!==origin){externalRequests.push(route.request().url());return route.abort();}
        return route.continue();
      });
      const response=await page.goto(url,{waitUntil:'networkidle'});
      check(response.status()===200,'calculator loads');
      await page.waitForFunction(()=>document.querySelector('#metric-profit').textContent!=='—');
      await page.evaluate(()=>document.fonts.ready);
      const text=id=>page.locator('#'+id).innerText();
      const num=async id=>Number((await text(id)).replace(/[^0-9.\-]/g,''));
      const set=async(key,value)=>{
        const field=page.locator(`[data-field="${key}"]`);
        await field.fill(String(value));await field.dispatchEvent('change');
      };
      const reset=async()=>{
        await page.locator('#reset').click();
        check(await num('metric-profit')===220400,'reset profit');
        check(await num('break-even-leads')===126,'reset lead threshold');
      };
      const overflow=async label=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);
      const shot=async(name,locator)=>{
        const filename=`${width}-${name}.png`;
        await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
        const clip=locator?await locator.boundingBox():undefined;
        await page.screenshot({path:path.join(output,filename),fullPage:true,clip});
        screenshots.push(filename);
      };
      check(await num('metric-revenue')===1440000,'default revenue');
      check(await num('metric-gross')===648000,'default gross profit');
      check(await num('metric-profit')===220400,'default profit');
      check(await num('metric-deals')===24,'expected deals');
      check(await num('cost-total')===1219600,'total costs');
      check(await num('break-even-deals')===16,'whole-deal threshold');
      check(await num('break-even-leads')===126,'expected-conversion lead threshold');
      check((await page.locator('.calc-break-even').innerText()).includes('целых сделок'),'whole-deal explanation');
      check((await page.locator('.calc-break-even').innerText()).includes('ожидаемой конверсии'),'expected-conversion explanation');
      await overflow('default no horizontal overflow');
      if(width!==360){await shot('default-full');await shot('default-results',page.locator('#results'));}
      const thresholds=[];
      for(const [leads,profit] of [[125,-1000],[126,1952]]){
        await set('leads',leads);
        check(await num('metric-profit')===profit,`${leads} leads profit`);
        check(await num('break-even-leads')===126,'threshold independent of current leads');
        check(await page.locator('#metric-profit').getAttribute('data-state')===(profit<0?'negative':'positive'),'profit sign styling');
        await overflow(`${leads} leads no overflow`);
        thresholds.push({leads,profit:await num('metric-profit')});
        if(width!==360)await shot(`${leads}-leads-results`,page.locator('#results'));
      }
      await reset();
      await set('conversion',14);
      check(await num('metric-profit')===318800,'14 percent conversion profit');
      check(await num('break-even-leads')===108,'14 percent threshold');
      check((await page.locator('#scenario-list').innerText()).includes('16%'),'sensitivity scenarios update');
      await set('conversion',0);
      check(await num('metric-profit')===-370000,'zero conversion loss');
      check(await text('break-even-leads')==='Не рассчитывается','zero conversion threshold');
      await set('conversion',100);
      check(await num('metric-profit')===4550000,'full conversion profit');
      check(await num('break-even-leads')===16,'full conversion threshold');
      await reset();await set('grossMargin',4);
      check(await text('break-even-deals')==='Недостижима','no contribution threshold');
      check(await text('break-even-leads')==='Не рассчитывается','no contribution lead threshold');
      await reset();
      for(const key of ['managerCount','marketing','otherFixed'])await set(key,0);
      check(await num('break-even-leads')===0&&await num('break-even-deals')===0,'no fixed costs');
      await reset();
      await page.locator('#copy').click();
      await page.waitForFunction(()=>document.querySelector('#form-status').textContent==='Расчёт скопирован.');
      const copied=await page.evaluate(()=>navigator.clipboard.readText());
      check(copied.includes('16 целых сделок')&&copied.includes('126 лидов по ожидаемой конверсии'),'real clipboard threshold text');
      check(copied.includes('фактические договоры не гарантированы'),'clipboard estimate explanation');
      check(await page.locator('#copy').evaluate(e=>document.activeElement===e),'copy focus');
      await set('leads','');
      check(await text('metric-profit')==='—','invalid data clears result');
      check(await page.locator('[data-field="leads"]').getAttribute('aria-invalid')==='true','accessible input error');
      await page.locator('#copy').click();
      check(await text('form-status')==='Сначала исправьте значения.','invalid copy blocked');
      check(await page.evaluate(()=>navigator.clipboard.readText())===copied,'clipboard preserved after invalid input');
      await reset();
      const previousUrl=page.url();
      await page.locator('[data-field="leads"]').press('Enter');
      check(page.url()===previousUrl&&await num('metric-profit')===220400,'Enter keeps calculation on page');
      const discuss=page.locator('.calc-next-step [data-contact-chooser]');
      await discuss.focus();await page.keyboard.press('Space');
      check(await page.locator('#contact-chooser').evaluate(e=>e.open),'keyboard opens messenger chooser');
      const links=await page.locator('#contact-chooser a').evaluateAll(es=>es.map(e=>({href:e.href,text:e.textContent})));
      check(links.some(x=>x.href==='https://t.me/Alekdvv')&&links.some(x=>x.href==='https://wa.me/79112815471')&&links.some(x=>x.href.startsWith('https://max.ru/join/')),'messenger destinations');
      await page.keyboard.press('Escape');
      check(!await page.locator('#contact-chooser').evaluate(e=>e.open),'Escape closes chooser');
      if(width<700){
        await page.evaluate(()=>scrollTo(0,0));
        await page.locator('.menu-toggle').click();
        check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='true','mobile menu opens');
        await page.keyboard.press('Escape');
        check(await page.locator('.menu-toggle').getAttribute('aria-expanded')==='false','mobile menu Escape');
      }
      check(!/79112815471|\+7\s*\(?911|@Alekdvv/.test(await page.locator('body').innerText()),'no visible personal identifiers');
      check(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0&&document.cookie===''),'no financial data persistence');
      for(const [key,value] of Object.entries({leads:10000000,conversion:100,averageCheck:1000000000,managerCount:10000,managerFullCost:1000000000,marketing:100000000000,otherFixed:100000000000}))await set(key,value);
      await overflow('maximum inputs no horizontal overflow');
      await reset();
      if(width===390){
        await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));
        await page.locator('#copy').click();
        await page.waitForFunction(()=>document.querySelector('#form-status').textContent==='Расчёт скопирован.');
        check(await page.locator('textarea').count()===0,'fallback copy helper removed');
        check(await page.locator('#copy').evaluate(e=>document.activeElement===e),'fallback copy focus');
      }
      check(errors.length===0,'no JavaScript/console errors');
      check(httpErrors.length===0,'no HTTP errors');
      results.push({width,height:width<700?844:1000,thresholds,defaultProfit:220400,breakEvenDeals:16,breakEvenLeads:126,errors,httpErrors,copy:true,reset:true,conversion:true,noOverflow:true});
      await context.close();console.log(`PASS ${width}px, cumulative assertions: ${checks}`);
    }
    check(externalRequests.length===0,'no requests to third parties');
    const report={testedAt:new Date().toISOString(),browser:browser.version(),checks,results,externalRequests,screenshots};
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
