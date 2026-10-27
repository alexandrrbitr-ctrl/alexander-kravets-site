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
  const{ctx,p,s}=await make(width);await p.goto(base+'/',{waitUntil:'networkidle'});
  await shot(p,'first-visit-'+width);await p.locator('.fr-contact-toggle').click();await p.screenshot({path:path.join(out,'contacts-'+width+'.png')});
  await p.locator('.fr-contact-dialog__close').click();check(!await p.locator('#contact-chooser').evaluate(e=>e.open),'close button');
  await p.locator('.fr-contact-toggle').click();await p.locator('h1').click();check(!await p.locator('#contact-chooser').evaluate(e=>e.open),'outside click');
  await p.locator('.fc-hero [data-contact-chooser]').focus();await p.keyboard.press('Space');check(await p.locator('#contact-chooser').evaluate(e=>e.open),'Space opens button-role anchor');
  await p.locator('.fr-contact-toggle').focus();await p.keyboard.press('Tab');check(!await p.locator('#contact-chooser').evaluate(e=>e.open),'non-modal window permits Tab out');
  const contrasts=await p.evaluate(()=>{
   const rgb=s=>s.match(/[\d.]+/g).map(Number);
   const luminance=a=>a.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
   const background=e=>{const a=[];for(let n=e;n;n=n.parentElement)a.unshift(rgb(getComputedStyle(n).backgroundColor));let c=[255,255,255];for(const r of a){let alpha=r[3]??1;c=c.map((v,i)=>v*(1-alpha)+r[i]*alpha);}return c;};
   return ['h1','h1 span','.fc-kicker','.fc-lead','.fc-difference','.fc-primary','.fc-secondary','.fc-problem-grid p','.fc-service-copy p','.fc-discuss','.fc-case-results dt','.fc-case-results dd','.fc-case-results>p','.fc-case-story p','.fc-cases .fc-section-heading>p:not(.fc-kicker)','.fc-role-note','.fc-final p:not(.fc-kicker)','.footer__ip','.cookie-consent p','.cookie-consent [data-consent="analytics"]'].map(sel=>{const e=document.querySelector(sel),c=getComputedStyle(e),a=luminance(rgb(c.color)),b=luminance(background(e));const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(c.fontSize),large=size>=24||(size>=18.66&&Number(c.fontWeight)>=700);return{selector:sel,foreground:c.color,background:background(e),ratio:+ratio.toFixed(2),fontSize:c.fontSize,required:large?3:4.5};});
  });
  check(contrasts.every(e=>e.ratio>=e.required),JSON.stringify(contrasts.filter(e=>e.ratio<e.required)));
  await p.locator('.fc-hero [data-contact-chooser]').focus();
  check(await p.locator('.fc-hero [data-contact-chooser]').evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle!=='none'),'visible keyboard focus');
  check(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),'reduced motion');check(s.sdk===0&&s.requests.length===0,'no unconsented telemetry');
  await p.locator('[data-consent="analytics"]').click();await wait(()=>s.views.length===1);
  for(const goal of ['case_pharma_open','case_contact_center_open','case_remote_sales_open']){const link=p.locator('[data-goal="'+goal+'"]');await link.evaluate(e=>e.addEventListener('click',v=>v.preventDefault(),{once:true}));await link.click();check(s.calls.some(x=>x[1]==='reachGoal'&&x[2]===goal),'case goal '+goal);}
  await p.locator('.fr-contact-toggle').click();for(const goal of ['whatsapp_contact','max_channel_open']){const link=goal==='whatsapp_contact'?p.locator('#contact-chooser [data-goal="whatsapp_contact"]'):p.locator('#contact-chooser [data-max-channel]');await link.evaluate(e=>e.addEventListener('click',v=>v.preventDefault(),{once:true}));await link.click();await p.waitForFunction(()=>!document.querySelector('#contact-chooser').open);check(s.calls.some(x=>x[1]==='reachGoal'&&x[2]===goal),'messenger goal '+goal);await p.locator('.fr-contact-toggle').click();}await p.keyboard.press('Escape');
  check(s.errors.length===0,'no JS error');results.push({width,scenario:'cookie/contact screenshots, keyboard, sampled contrast and goals',contrasts});await ctx.close();console.log('PASS supplemental',width);
 }
 const{ctx,p,s}=await make(390,'necessary');const files=cp.execFileSync('git',['ls-files','--','*.html'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>fs.readFileSync(f,'utf8').includes('site.js'));
 for(const f of files){await p.goto(base+'/'+(f.endsWith('index.html')?f.slice(0,-10):f),{waitUntil:'load'});const text=await p.locator('body').innerText();check(!/@Alekdvv|(?:\+?7|8)[\s()-]*911[\s()-]*281[\s()-]*54[\s()-]*71/i.test(text),'no visible personal identifiers '+f);}
 check(s.errors.length===0,'all-page privacy scan without exceptions');await ctx.close();results.push({scenario:'visible phone/nickname scan',pages:files.length,issues:0});
 fs.writeFileSync(path.join(out,'supplemental-results.json'),JSON.stringify({checks,browser:browser.version(),results,telemetry:'All external SDK requests intercepted locally.'},null,2)+'\n');console.log('PASS supplemental total',checks);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
