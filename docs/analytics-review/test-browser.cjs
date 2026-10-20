// Requires Playwright, Edge and METRIKA_SDK_PATH: an unmodified download of
// https://mc.yandex.ru/metrika/tag.js. All SDK telemetry is intercepted locally.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=process.cwd(),out=__dirname,sdk=fs.readFileSync(process.env.METRIKA_SDK_PATH);
const key='kravets_analytics_consent_v2',version='2026-10-20',ttl=180*86400000,id=113697096;
const types={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon'};
function fileFor(raw){let f=path.resolve(root,'.'+decodeURIComponent(raw));if(f!==root&&!f.startsWith(root+path.sep))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');return f;}
const server=http.createServer((req,res)=>{try{const f=fileFor(new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',types[path.extname(f)]||'text/html; charset=utf-8');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
 let checks=0;const results=[];
 const check=(v,m)=>{assert.ok(v,m);checks++;};
 const wait=async fn=>{const end=Date.now()+8000;while(!fn()){if(Date.now()>end)throw Error('SDK view timeout');await new Promise(r=>setTimeout(r,25));}};
 const make=async(width,mode='fresh')=>{
  const ctx=await browser.newContext({viewport:{width,height:width<700?844:1000},locale:'ru-RU',permissions:['clipboard-read','clipboard-write']});
  const s={tags:0,calls:[],requests:[],views:[],errors:[]};
  await ctx.exposeBinding('recordYm',(_source,args)=>s.calls.push(args));
  await ctx.addInitScript(({key,version,ttl,mode,base})=>{
   if(window.top!==window||location.origin!==base)return;
   let fn;Object.defineProperty(window,'ym',{configurable:true,get(){return fn;},set(v){fn=typeof v==='function'?new Proxy(v,{apply(target,self,args){window.recordYm(args);return Reflect.apply(target,self,args);}}):v;}});
   if(mode==='blocked'){Storage.prototype.getItem=Storage.prototype.setItem=Storage.prototype.removeItem=()=>{throw new DOMException('blocked','SecurityError');};}
   else if(!sessionStorage.getItem('__analytics_fixture')){
    sessionStorage.setItem('__analytics_fixture','1');
    if(mode==='legacy')localStorage.setItem('kravets_analytics_consent_v1','analytics');
    if(['granted','expired','near-expiry','tampered'].includes(mode)){
     const now=Date.now(),savedAt=mode==='expired'?now-ttl-1000:mode==='near-expiry'?now-ttl+3000:now;
     localStorage.setItem(key,JSON.stringify({choice:'analytics',version:mode==='tampered'?'old-policy':version,savedAt,expiresAt:savedAt+ttl}));
    }
   }
  },{key,version,ttl,mode,base});
  await ctx.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.origin===base)return r.continue();
   // The 404 template deliberately uses production-absolute assets; serve the same local bytes.
   if(u.href.startsWith('https://alexandrrbitr-ctrl.github.io/alexander-kravets-site/')){
    const f=fileFor(u.pathname.replace('/alexander-kravets-site',''));return r.fulfill({status:200,contentType:types[path.extname(f)]||'text/html',body:fs.readFileSync(f)});
   }
   if(u.href==='https://mc.yandex.ru/metrika/tag.js'){s.tags++;return r.fulfill({status:200,contentType:'application/javascript',body:sdk});}
   const entry={url:u.href,body:r.request().postData()};s.requests.push(entry);
   if(u.pathname===`/watch/${id}`&&u.searchParams.get('page-url')?.startsWith(base+'/')&&/(?:^|:)pv:1(?:$|:)/.test(u.searchParams.get('browser-info')||''))s.views.push(entry);
   return r.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  ctx.on('page',p=>p.on('pageerror',e=>{s.errors.push(e.stack||e.message);console.error('BROWSER EXCEPTION',e.stack||e.message);}));
  return {ctx,s,p:await ctx.newPage()};
 };
 const inits=s=>s.calls.filter(x=>x[1]==='init').length;
 const choice=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const settings=async p=>{await p.locator('.cookie-settings').first().click();await p.locator('.cookie-consent').waitFor({state:'visible'});};
 try{
 for(const width of [360,390,1440]){
  const {ctx,s,p}=await make(width);
  await p.goto(base+'/',{waitUntil:'networkidle'});
  check(await p.locator('.cookie-consent').isVisible(),'first visit choice');
  check(await p.locator('.cookie-consent').getAttribute('role')!=='dialog','non-modal notice');
  check(await p.evaluate(()=>document.activeElement===document.body),'no initial focus theft');
  await p.mouse.wheel(0,400);await p.waitForTimeout(150);
  check(s.tags===0&&s.requests.length===0,'silence/scroll not consent');
  await p.goto(base+'/tools/',{waitUntil:'networkidle'});await p.goto(base+'/tools/sales-economics/',{waitUntil:'networkidle'});
  check(s.tags===0,'unconsented navigation untracked');
  check(await p.locator('#break-even-deals').innerText()==='16'&&await p.locator('#break-even-leads').innerText()==='126','calculator threshold');
  check((await p.locator('#metric-profit').innerText()).replace(/\D/g,'')==='220400','calculator default');
  const set=async(k,v)=>{const e=p.locator(`[data-field="${k}"]`);await e.fill(String(v));await e.dispatchEvent('change');};
  await set('leads',125);check((await p.locator('#metric-profit').innerText()).replace(/[^\d-]/g,'')==='-1000','125 leads');
  await set('leads',126);check((await p.locator('#metric-profit').innerText()).replace(/[^\d-]/g,'')==='1952','126 leads');
  await p.locator('[data-consent="necessary"]').click();const denied=await choice(p);
  check(denied.choice==='necessary'&&denied.expiresAt-denied.savedAt===ttl,'180-day refusal');
  await p.reload({waitUntil:'networkidle'});check(!await p.locator('.cookie-consent').isVisible()&&s.tags===0,'refused revisit');
  await p.locator('.fr-contact-toggle').click();await p.keyboard.press('Escape');check(s.calls.length===0,'contact works without tracking');
  await settings(p);check(await p.locator('[data-consent="necessary"]').evaluate(e=>document.activeElement===e),'settings focus');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,`consent-${width}.png`)});
  const a=await p.locator('.cookie-consent').boundingBox(),b=await p.locator('.fr-contact-toggle').boundingBox();
  check(a.height<150,'compact notice');check(!b||b.y+b.height<=a.y||b.x>=a.x+a.width,'no widget/notice overlap');
  await p.locator('[data-consent="analytics"]').click();await wait(()=>s.views.length===1);
  check(s.tags===1&&inits(s)===1,'one SDK/init/real automatic watch');
  const opts=s.calls.find(x=>x[1]==='init')[2];
  check(opts.defer===false&&opts.webvisor===false&&opts.clickmap===false&&opts.trackLinks===false&&opts.disableYtm===true,'minimized options');
  check((await choice(p)).choice==='analytics','explicit grant');
  await settings(p);await p.locator('[data-consent="analytics"]').click();await p.waitForTimeout(150);
  check(s.views.length===1&&inits(s)===1,'repeated grant no duplicate');
  await set('averageCheck',987654321);await p.waitForTimeout(150);check(!JSON.stringify(s.requests).includes('987654321'),'no financial input in telemetry');
  await p.locator('#reset').click();await p.locator('#copy').click();await p.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('скопирован'));check((await p.locator('#form-status').innerText()).includes('скопирован'),'copy');
  await p.locator('.fr-contact-toggle').click();check(await p.locator('#contact-chooser').evaluate(e=>e.open),'contact chooser');await p.keyboard.press('Escape');
  check(s.calls.some(x=>x[0]===id&&x[1]==='reachGoal'&&x[2]==='contact_chooser_open'),'correct contact goal');
  await p.goto(base+'/services/',{waitUntil:'networkidle'});await wait(()=>s.views.length===2);check(!await p.locator('.cookie-consent').isVisible(),'automatic next page');
  await p.reload({waitUntil:'networkidle'});await wait(()=>s.views.length===3);check(s.tags===3&&inits(s)===3,'one view per document');
  const other=await ctx.newPage();await other.goto(base+'/',{waitUntil:'networkidle'});await wait(()=>s.views.length===4);await settings(other);
  await Promise.all([other.waitForEvent('domcontentloaded'),other.locator('[data-consent="necessary"]').click()]);await other.waitForLoadState('networkidle');await p.waitForTimeout(100);
  check(await p.evaluate(()=>!window.__kravetsYmLoaded),'cross-tab withdrawal');check(s.calls.filter(x=>x[1]==='destruct').length>=2,'both counters stopped');
  const tags=s.tags,goals=s.calls.filter(x=>x[1]==='reachGoal').length;
  await p.locator('.fr-contact-toggle').click();await p.keyboard.press('Escape');check(s.calls.filter(x=>x[1]==='reachGoal').length===goals,'no goals after refusal');
  await p.goto(base+'/tools/sales-economics/',{waitUntil:'networkidle'});check(s.tags===tags&&s.views.length===4,'no refused navigation views');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow');check(s.errors.length===0,JSON.stringify(s.errors));
  results.push({width,scenario:'first/allow/refuse/revisit/navigation/calculator',views:s.views.length,inits:inits(s),errors:s.errors});await ctx.close();console.log('PASS scenarios',width);
 }
 for(const mode of ['legacy','expired','tampered','blocked','near-expiry']){
  const {ctx,s,p}=await make(390,mode);await p.goto(base+'/',{waitUntil:'networkidle'});
  if(mode==='near-expiry'){
   await wait(()=>s.views.length===1);await p.waitForTimeout(3200);check(await p.locator('.cookie-consent').isVisible()&&await p.evaluate(()=>!window.__kravetsYmLoaded),'expiry stops SDK');
  }else{
   check(s.tags===0&&await p.locator('.cookie-consent').isVisible(),mode+' not consent');
   if(mode==='blocked'){
    await p.locator('[data-consent="analytics"]').click();await wait(()=>s.views.length===1);await settings(p);await p.locator('[data-consent="necessary"]').click();
    check(await p.evaluate(()=>!window.__kravetsYmLoaded),'in-memory refusal');await p.reload({waitUntil:'networkidle'});check(s.tags===1,'no grant inferred after blocked-storage reload');
   }
  }
  check(s.errors.length===0,'no errors '+mode);results.push({scenario:mode,views:s.views.length,errors:s.errors});await ctx.close();
 }
 const all=await make(1440,'granted');
 const files=cp.execFileSync('git',['ls-files','--','*.html'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>fs.readFileSync(f,'utf8').includes('site.js'));
 let expected=0;
 for(const f of files){
  const route=f==='index.html'?'/':f.endsWith('/index.html')?'/'+f.slice(0,-10):'/'+f;
  await all.p.goto(base+route,{waitUntil:'networkidle'});expected++;await wait(()=>all.s.views.length===expected);
  check(await all.p.evaluate(()=>window.KRAVETS_ANALYTICS.yandexMetricaId)==='113697096','config '+f);
  check(await all.p.locator('script[src*="metrika/tag.js"]').count()===1,'one tag '+f);
 }
 check(files.length===58,'all public UI pages');check(inits(all.s)===58&&all.s.views.length===58,'one real SDK watch per document');check(all.s.errors.length===0,'all-pages JS exceptions');
 results.push({scenario:'all-public-UI-pages',pages:files.length,views:all.s.views.length,inits:inits(all.s),errors:all.s.errors});await all.ctx.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,browser:browser.version(),counter:id,realSdk:true,telemetry:'intercepted locally, not delivered to Yandex',results},null,2)+'\n');console.log('PASS total',checks);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
