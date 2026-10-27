// Local regression/visual checks. Existing Playwright and Edge required.
// METRIKA_SDK_PATH points to the unmodified Yandex SDK; telemetry never leaves this test server.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=process.cwd(),out=__dirname,sdk=fs.readFileSync(process.env.METRIKA_SDK_PATH),id=113697096;
const types={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};
function fileFor(raw){let f=path.resolve(root,'.'+decodeURIComponent(raw));if(f!==root&&!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');return f;}
const server=http.createServer((req,res)=>{try{const f=fileFor(new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',types[path.extname(f)]||'text/html; charset=utf-8');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
 let checks=0;const results=[],check=(v,m)=>{assert.ok(v,m);checks++;};
 const make=async(width,mode='fresh')=>{
  const ctx=await browser.newContext({viewport:{width,height:width<700?844:900},locale:'ru-RU',reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),s={errors:[],failed:[],sdk:0,requests:[],calls:[],views:[]};
  await ctx.exposeBinding('recordYm',(_source,args)=>s.calls.push(args));
  await ctx.addInitScript(({base,mode})=>{if(window.top!==window||location.origin!==base)return;let fn;Object.defineProperty(window,'ym',{configurable:true,get(){return fn;},set(v){fn=typeof v==='function'?new Proxy(v,{apply(target,self,args){window.recordYm(args);return Reflect.apply(target,self,args);}}):v;}});if(mode==='necessary'){let now=Date.now();localStorage.setItem('kravets_analytics_consent_v2',JSON.stringify({choice:'necessary',version:'2026-10-20',savedAt:now,expiresAt:now+180*86400000}));}}, {base,mode});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.href.startsWith('https://alexandrrbitr-ctrl.github.io/alexander-kravets-site/')){const f=fileFor(u.pathname.replace('/alexander-kravets-site',''));return r.fulfill({status:200,contentType:types[path.extname(f)]||'text/html',body:fs.readFileSync(f)});}if(u.href==='https://mc.yandex.ru/metrika/tag.js'){s.sdk++;return r.fulfill({status:200,contentType:'application/javascript',body:sdk});}const entry={url:u.href,body:r.request().postData()};s.requests.push(entry);if(u.pathname===`/watch/${id}`&&u.searchParams.get('page-url')?.startsWith(base+'/')&&/(?:^|:)pv:1(?:$|:)/.test(u.searchParams.get('browser-info')||''))s.views.push(entry);return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  const p=await ctx.newPage();p.on('pageerror',e=>s.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)s.failed.push({url:r.url(),status:r.status()});});return{ctx,p,s};
 };
 const noOverflow=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 const shot=async(p,name,fullPage=false)=>{await p.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.documentElement.scrollHeight;y+=600){scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,10));}scrollTo({top:0,behavior:'instant'});});await p.screenshot({path:path.join(out,name+'.png'),fullPage});};
 const wait=async fn=>{const end=Date.now()+10000;while(!fn()){if(Date.now()>end)throw Error('SDK timeout');await new Promise(r=>setTimeout(r,25));}};
 try{
 for(const width of [360,390,768,1024,1440]){
  const{ctx,p,s}=await make(width);check((await p.goto(base+'/',{waitUntil:'networkidle'})).status()===200,'home HTTP200');
  check((await p.locator('h1').innerText()).replace(/\s+/g,' ')==='Находим, где бизнес теряет продажи. Выстраиваем систему, которая помогает зарабатывать больше.','exact H1');
  check(await p.locator('h1').count()===1,'one H1');check(await p.locator('main>section').count()===8,'eight sections');check(await p.locator('.fc-problem-grid article').count()===6,'six problems');check(await p.locator('.fc-service-list>article').count()===6,'six services');check(await p.locator('.fc-case').count()===3,'three supported case previews');check(await p.locator('.fc-workflow>li').count()===4,'four steps');check(await p.locator('.fr-faq details').count()===7,'seven FAQs');
  check(s.sdk===0&&s.requests.length===0,'no analytics before choice');
  const primary=p.locator('.fc-hero [data-contact-chooser]'),b=await primary.boundingBox(),c=await p.locator('.cookie-consent').boundingBox();
  const primaryInitiallyVisible=b.y+b.height<=c.y;console.log('CTA',width,primaryInitiallyVisible,b.y+b.height,c.y);
  check(primaryInitiallyVisible,'hero primary CTA visible above cookie '+width);
  check((await p.locator('.cookie-consent').innerText()).includes('Подробнее'),'original cookie copy/link');
  check((await p.locator('.cookie-consent [data-consent="analytics"]').innerText())==='ОК','original OK action');
  await primary.click();check(await p.locator('#contact-chooser').evaluate(e=>e.open),'hero chooser opens');
  check(await p.locator('#contact-chooser a[href="https://t.me/Alekdvv"]').count()===1&&await p.locator('#contact-chooser a[href="https://wa.me/79112815471"]').count()===1,'actual messenger links preserved');
  check((await p.locator('#contact-chooser [data-max-channel]').innerText()).includes('Канал'),'MAX correctly channel');
  const a=await p.locator('#contact-chooser').boundingBox();check(a.y+a.height<=c.y,'chooser above cookies');await p.keyboard.press('Escape');check(!await p.locator('#contact-chooser').evaluate(e=>e.open),'Escape closes chooser');check(await primary.evaluate(e=>e===document.activeElement),'focus restored');
  const menu=p.locator('.menu-toggle');if(await menu.isVisible()){
   await menu.click();check(await menu.getAttribute('aria-expanded')==='true','menu expanded');check(await p.locator('.mobile-nav').isVisible(),'menu visible');check(await p.locator('.mobile-nav').evaluate(e=>e.parentElement===document.body),'menu outside header');
   const links=p.locator('.mobile-nav a');await links.last().focus();await p.keyboard.press('Tab');check(await menu.evaluate(e=>e===document.activeElement),'menu traps focus at toggle');await p.keyboard.press('Shift+Tab');check(await links.last().evaluate(e=>e===document.activeElement),'reverse menu focus trap');
   await p.keyboard.press('Escape');check(await menu.getAttribute('aria-expanded')==='false','Escape closes menu');await menu.click();await p.locator('.mobile-nav a[href="services/"]').click();await p.waitForURL(base+'/services/');check(!await p.locator('.mobile-nav').isVisible(),'menu closes after route');check(await p.locator('.nav a[data-nav="services"]').getAttribute('aria-current')==='page','service active nav');await p.goto(base+'/',{waitUntil:'networkidle'});
  }
  await p.locator('[data-consent="necessary"]').click();check(s.sdk===0&&!await p.locator('.cookie-consent').isVisible(),'refusal without SDK');
  await p.reload({waitUntil:'networkidle'});check(!await p.locator('.cookie-consent').isVisible()&&s.sdk===0,'refusal persists');
  for(let i=0;i<7;i++){const summary=p.locator('.fr-faq summary').nth(i);await summary.focus();await p.keyboard.press('Enter');check(await summary.evaluate(e=>e.parentElement.open),'FAQ opens via keyboard');check(await noOverflow(p),'FAQ does not overflow');await p.keyboard.press('Enter');}
  const triggers=p.locator('main [data-contact-chooser]');for(let i=0;i<await triggers.count();i++){await triggers.nth(i).click();check(await p.locator('#contact-chooser').evaluate(e=>e.open),'enquiry opens chooser '+i);await p.keyboard.press('Escape');}
  const destinations=['sales-audit/','sales-department-from-scratch/','commercial-management/','crm-bitrix24/','commercial-analytics/','customer-base-reactivation/'];
  for(const dest of destinations){await p.locator('.fc-service-list a[href="'+dest+'"]').click();await p.waitForURL(base+'/'+dest);check(p.url()===base+'/'+dest,'service detail '+dest);await p.goBack({waitUntil:'networkidle'});}
  for(const dest of ['case-pharma.html','case-contact-center.html','case-remote-sales.html']){await p.locator('.fc-case a[href="'+dest+'"]').click();await p.waitForURL(base+'/'+dest);check(p.url()===base+'/'+dest,'case link '+dest);await p.goBack({waitUntil:'networkidle'});}
  await p.locator('.fc-secondary').click();check(new URL(p.url()).hash==='#cases','cases anchor');
  const measured=await p.evaluate(()=>{let q=s=>getComputedStyle(document.querySelector(s));return{height:document.documentElement.scrollHeight,h1:q('h1').fontSize,h2:q('h2').fontSize,h3:q('h3').fontSize,lead:q('.fc-lead').fontSize,sectionPadding:q('.fc-section').paddingTop,heroPadding:q('.fc-hero').paddingTop};});
  await shot(p,'after-'+width);if([390,1440].includes(width))await shot(p,'after-full-'+width,true);
  await p.locator('.cookie-settings').click();await p.locator('[data-consent="analytics"]').click();await wait(()=>s.views.length===1);check(s.sdk===1&&s.calls.filter(x=>x[1]==='init').length===1,'one real SDK init and watch');
  check(s.calls.find(x=>x[1]==='init')[0]===id,'counter unchanged');
  await p.locator('.fc-hero [data-contact-chooser]').click();await p.keyboard.press('Escape');check(s.calls.some(x=>x[1]==='reachGoal'&&x[2]==='contact_chooser_open'),'CTA tracked after consent');
  // Exercise messenger event without navigating away or contacting its owner.
  await p.locator('.fr-contact-toggle').click();await p.evaluate(()=>document.querySelector('#contact-chooser a[data-goal="telegram_contact"]').addEventListener('click',e=>e.preventDefault(),{once:true}));await p.locator('#contact-chooser a[data-goal="telegram_contact"]').click();await p.keyboard.press('Escape');
  check(s.calls.some(x=>x[1]==='reachGoal'&&x[2]==='telegram_contact'),'messenger goal');
  await p.locator('.fc-secondary').click();check(s.calls.some(x=>x[1]==='reachGoal'&&x[2]==='cases_open'),'cases goal');
  await p.goto(base+'/services/',{waitUntil:'networkidle'});await wait(()=>s.views.length===2);check(!await p.locator('.cookie-consent').isVisible(),'consented next visit automatic');
  await p.locator('.cookie-settings').click();await Promise.all([p.waitForEvent('domcontentloaded'),p.locator('[data-consent="necessary"]').click()]);await p.waitForLoadState('networkidle');check(await p.evaluate(()=>!window.__kravetsYmLoaded),'withdrawal stops analytics');
  check(s.errors.length===0,JSON.stringify(s.errors));check(s.failed.length===0,JSON.stringify(s.failed));check(await noOverflow(p),'no horizontal scroll');
  results.push({scenario:'home/links/FAQ/menu/consent/goals',width,primaryInitiallyVisible,...measured,errors:s.errors,failed:s.failed,watchRequests:s.views.length});await ctx.close();console.log('PASS home',width);
 }
 const files=cp.execFileSync('git',['ls-files','--','*.html'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>fs.readFileSync(f,'utf8').includes('site.js'));
 for(const width of [360,390,768,1024,1440]){
  const{ctx,p,s}=await make(width,'necessary');const pages=[];
  for(const f of files){const route='/'+(f.endsWith('index.html')?f.slice(0,-10):f);check((await p.goto(base+route,{waitUntil:'load'})).status()===200,'page loads '+f);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(35);
   const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,missingNames:[...document.querySelectorAll('a,button,summary')].filter(e=>!e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.querySelector('img[alt]')).length,heroCardsFit:[...document.querySelectorAll('.fr-hero .fr-metrics>div')].every(e=>e.getBoundingClientRect().bottom<=e.closest('.fr-hero').getBoundingClientRect().bottom+1)}));
   check(!m.overflow,'no overflow '+width+' '+f);check(m.h1===1,'one H1 '+f);check(m.heroCardsFit,'case metrics contained '+width+' '+f);
   check(await p.locator('.fr-contact-toggle').count()===1,'one contact widget '+f);
   // Every public UI template uses the same working chooser and footer settings.
   await p.locator('.fr-contact-toggle').click();check(await p.locator('#contact-chooser').evaluate(e=>e.open),'chooser '+f);await p.keyboard.press('Escape');
   pages.push({file:f,...m});
   if([390,1440].includes(width)&&['services/index.html','case-pharma.html','case-contact-center.html','about/index.html','privacy.html'].includes(f))await shot(p,f.replace(/\/index.html$|\.html$/g,'').replaceAll('/','-')+'-'+width,true);
  }
  check(s.errors.length===0,JSON.stringify(s.errors));check(s.failed.length===0,JSON.stringify(s.failed));check(s.sdk===0&&s.requests.length===0,'refused all-page audit sends no analytics');results.push({scenario:'all public UI pages',width,pages,errors:s.errors,failed:s.failed});await ctx.close();console.log('PASS all pages',width,files.length);
 }
 const{ctx,p,s}=await make(390,'necessary');await p.goto(base+'/tools/sales-economics/',{waitUntil:'networkidle'});const num=async sel=>Number((await p.locator(sel).innerText()).replace(/[^\d-]/g,''));check(await num('#metric-profit')===220400,'calculator standard profit');check(await num('#break-even-deals')===16&&await num('#break-even-leads')===126,'calculator thresholds');await p.locator('[data-field="leads"]').fill('125');await p.locator('[data-field="leads"]').dispatchEvent('change');check(await num('#metric-profit')===-1000,'125 leads');await p.locator('[data-field="leads"]').fill('126');await p.locator('[data-field="leads"]').dispatchEvent('change');check(await num('#metric-profit')===1952,'126 leads');check(s.errors.length===0,'calculator no errors');results.push({scenario:'calculator unchanged',profit:220400,breakEvenDeals:16,breakEvenLeads:126});await ctx.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,browser:browser.version(),htmlPages:61,uiPages:files.length,results,telemetry:'Real SDK served locally; all external telemetry intercepted. No test visits sent to Yandex.'},null,2)+'\n');console.log('PASS total',checks);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
