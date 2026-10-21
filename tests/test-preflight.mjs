import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkSite} from '../scripts/check-site.mjs';
const prefix='https://alexandrrbitr-ctrl.github.io/alexander-kravets-site/';
const sitemap=paths=>'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>`<url><loc>${prefix}${p}</loc></url>`).join('')+'</urlset>';
const html=(route,body='',noindex=false)=>`<!doctype html><html lang="ru"><head><title>Пример ${route}</title><meta name="description" content="Проверка"><meta name="robots" content="${noindex?'noindex,follow':'index,follow'}"><link rel="canonical" href="${prefix}${route}"><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><h1>Заголовок</h1>${body}<footer><div class="shell footer__ip">ИП Кравец А. С.</div></footer></body></html>`;
function fixture(t){
 const tmp=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(tmp,'fr-site-qa-'));
 const write=(f,data)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),data)};
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 t.after(()=>{const actual=fs.realpathSync(root);assert.equal(path.dirname(actual),tmp);assert.ok(path.basename(actual).startsWith('fr-site-qa-'));fs.rmSync(actual,{recursive:true,force:true})});
 write('index.html',html('','<a href="tools/sales-economics/">Калькулятор</a>'));
 write('services/index.html',html('services/','<a href="../tools/sales-economics/">Калькулятор</a>'));
 write('tools/sales-economics/index.html',html('tools/sales-economics/'));
 write('tools/sales-economics/engine.mjs','export const value=1');
 write('sitemap.xml',sitemap(['','services/','tools/sales-economics/']));
 return{root,write,read,run:opts=>checkSite(root,opts)};
}
test('valid metadata, routes and sitemap',t=>{const f=fixture(t),r=f.run();assert.deepEqual(r.errors,[]);assert.equal(r.indexablePages,3)});
test('missing asset and calculator discovery link',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('href="tools/sales-economics/"','href="missing/"'));const r=f.run();assert.ok(r.errors.some(x=>x.includes('Не найден файл')));assert.ok(r.errors.some(x=>x.includes('Нет заметной ссылки')))});
test('missing H1',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('<h1>','<h2>'));assert.ok(f.run().errors.some(x=>x.includes('H1')))});
test('missing indexable page in sitemap',t=>{const f=fixture(t);f.write('sitemap.xml',sitemap(['','services/']));assert.ok(f.run().errors.some(x=>x.includes('Нет indexable страницы')))});
test('invalid JSON-LD',t=>{const f=fixture(t);f.write('services/index.html',f.read('services/index.html').replace('"@type":"WebPage"','INVALID'));assert.ok(f.run().errors.some(x=>x.includes('Некорректный JSON-LD')))});
function cookies(f,target='privacy.html#cookies'){
 f.write('privacy.html',html('privacy.html','<section id="cookies">Cookies</section>',true));
 f.write('cookies.html',html('privacy.html','',true).replace('</head>',`<meta http-equiv="refresh" content="0;url=${target}"><script>window.location.replace("${target}");</script></head>`));
}
test('intentional cookies redirect canonical points to privacy',t=>{const f=fixture(t);cookies(f);const r=f.run();assert.deepEqual(r.errors,[]);assert.equal(r.cookieRedirectPresent,true);assert.equal(r.indexablePages,3)});
test('broken legacy cookies redirect is not accepted',t=>{const f=fixture(t);cookies(f,'missing.html#cookies');const r=f.run();assert.equal(r.cookieRedirectPresent,false);assert.ok(r.errors.some(x=>x.includes('Некорректный переход cookies')))});
test('cookies canonical must point to privacy without fragment',t=>{const f=fixture(t);cookies(f);f.write('cookies.html',f.read('cookies.html').replace('rel="canonical" href="'+prefix+'privacy.html"','rel="canonical" href="'+prefix+'cookies.html"'));assert.ok(f.run().errors.some(x=>x.includes('Некорректный canonical')))});
test('duplicate canonical',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</head>',`<link rel="canonical" href="${prefix}"></head>`));assert.ok(f.run().errors.some(x=>x.includes('Canonical: 2')))});
test('duplicate meta description',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</head>','<meta name="description" content="Вторая"></head>'));assert.ok(f.run().errors.some(x=>x.includes('Meta description: 2')))});
test('duplicate title and robots',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</head>','<title>Второй</title><meta name="robots" content="noindex"></head>'));const e=f.run().errors;assert.ok(e.some(x=>x.includes('Несколько title')));assert.ok(e.some(x=>x.includes('Несколько meta robots')))});
test('commercial noindex is detected with uppercase meta name',t=>{const f=fixture(t);f.write('services/index.html',f.read('services/index.html').replace('name="robots" content="index,follow"','name="ROBOTS" content="NOINDEX,FOLLOW"'));assert.ok(f.run().errors.some(x=>x.includes('неожиданно имеет noindex')))});
test('valid local and cross-page anchors',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</body>','<a href="#own">Own</a><div id="own"></div><a href="services/#target">Service</a></body>'));f.write('services/index.html',f.read('services/index.html').replace('</body>','<div id="target"></div></body>'));assert.deepEqual(f.run().errors,[])});
test('missing local fragment',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</body>','<a href="#missing">Broken</a></body>'));assert.ok(f.run().errors.some(x=>x.includes('Не найден якорь #missing')))});
test('duplicate IDs',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</body>','<div id="same"></div><div id="same"></div></body>'));assert.ok(f.run().errors.some(x=>x.includes('Повторяющиеся id')))});
test('sitemap order does not redefine the project base',t=>{const f=fixture(t);f.write('sitemap.xml',sitemap(['services/','tools/sales-economics/','']));const r=f.run();assert.equal(r.base,prefix);assert.deepEqual(r.errors,[])});
test('invalid base returns diagnostics instead of throwing',t=>{const f=fixture(t);for(const base of ['invalid','http://example.com/','https://example.com/?key=x','https://example.com/no-slash']){const r=f.run({base});assert.ok(r.errors.some(x=>x.includes('HTTPS-базу')))}});
test('duplicate and unexpected sitemap URLs',t=>{const f=fixture(t);f.write('sitemap.xml',sitemap(['','services/','tools/sales-economics/','services/','missing/']));const e=f.run().errors;assert.ok(e.some(x=>x.includes('повторяющиеся URL')));assert.ok(e.some(x=>x.includes('Лишний или некорректный URL')))});
test('duplicate sole proprietor footer',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace('</footer>','<div class="shell footer__ip">Duplicate</div></footer>'));assert.ok(f.run().errors.some(x=>x.includes('Блок реквизитов ИП встречается 2')))});
test('missing calculation engine',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.root,'tools/sales-economics/engine.mjs'));assert.ok(f.run().errors.some(x=>x.includes('расчётный модуль')))});

test('cookies redirect target section must exist',t=>{const f=fixture(t);cookies(f);f.write('privacy.html',f.read('privacy.html').replace('id="cookies"','id="other"'));assert.ok(f.run().errors.some(x=>x.includes('Некорректный переход cookies')))});
test('missing canonical reports an error without a crash',t=>{const f=fixture(t);f.write('index.html',f.read('index.html').replace(/<link rel="canonical"[^>]*>/,''));assert.ok(f.run().errors.some(x=>x.includes('Canonical: 0')))});

for (const name of ['google702c29dfb69c29e5.html','google0aAF19.html']) {
 test(`exact root Google verification is exempt: ${name}`,t=>{
  const f=fixture(t),content=`google-site-verification: ${name}`;
  f.write(name,content);
  // Ordinary page links to the verification file must still resolve.
  f.write('index.html',f.read('index.html').replace('</body>',`<a href="${name}">Verification</a></body>`));
  const r=f.run();
  assert.deepEqual(r.errors,[]);
  assert.equal(r.pages,4);
  assert.equal(r.indexablePages,3);
  assert.equal(r.ipFooterPages,3);
  assert.equal(r.jsonLdBlocks,3);
  assert.equal(f.read(name),content);
 });
}

const verification='googleabc123.html';
for (const [name,content,label] of [
 ['nested/'+verification,`google-site-verification: ${verification}`,'nested file'],
 [verification,'google-site-verification: googleabc124.html','mismatched filename'],
 [verification,`google-site-verification: ${verification}\n`,'trailing newline'],
 [verification,`google-site-verification: ${verification}\r\n`,'trailing CRLF'],
 [verification,`google-site-verification: ${verification} `,'trailing space'],
 [verification,` google-site-verification: ${verification}`,'leading space'],
 [verification,`\uFEFFgoogle-site-verification: ${verification}`,'UTF-8 BOM'],
 [verification,`google-site-verification: ${verification}<p>extra</p>`,'extra markup'],
 [verification,'','empty content'],
 ['googleg123.html','google-site-verification: googleg123.html','non-hex name'],
 ['google.html','google-site-verification: google.html','empty token'],
 ['Googleabc.html','google-site-verification: Googleabc.html','wrong prefix case'],
 ['ordinary.html','google-site-verification: ordinary.html','ordinary filename']
]) {
 test(`not exempt from SEO: ${label}`,t=>{
  const f=fixture(t);f.write(name,content);const r=f.run();
  assert.ok(r.errors.includes(`${name}: Отсутствует title`));
  assert.ok(r.errors.includes(`${name}: Заголовков H1: 0 вместо 1`));
  assert.ok(r.errors.includes(`${name}: Canonical: 0 вместо 1`));
  assert.ok(r.errors.includes(`${name}: Нет meta description`));
  assert.ok(r.errors.some(e=>e.startsWith('sitemap.xml: Нет indexable страницы: '+name+' ')));
 });
}

test('HTML page with Google-shaped name retains all page checks',t=>{
 const f=fixture(t),name='googleabc.html';
 f.write(name,html(name,'<a href="missing.html">Broken</a>')
  .replace(/<title>.*?<\/title>/,'').replace('<h1>Заголовок</h1>','')
  .replace(/<link rel="canonical"[^>]*>/,'').replace(/<meta name="description"[^>]*>/,'')
  .replace('"@type":"WebPage"','INVALID').replace('class="shell footer__ip"','class="other"'));
 const e=f.run().errors.filter(e=>e.startsWith(name+':'));
 for(const expected of ['Отсутствует title','Заголовков H1: 0','Canonical: 0','Нет meta description','Некорректный JSON-LD','Блок реквизитов ИП встречается 0','Не найден файл']) {
  assert.ok(e.some(message=>message.includes(expected)),expected);
 }
});

test('valid Google verification does not suppress errors on ordinary pages',t=>{
 const f=fixture(t);f.write(verification,`google-site-verification: ${verification}`);
 f.write('services/index.html',f.read('services/index.html').replace('<h1>Заголовок</h1>',''));
 const r=f.run();
 assert.ok(r.errors.includes('services/index.html: Заголовков H1: 0 вместо 1'));
 assert.ok(!r.errors.some(e=>e.startsWith(verification+':')));
});

test('verification file is still rejected as an indexable sitemap URL',t=>{
 const f=fixture(t);f.write(verification,`google-site-verification: ${verification}`);
 f.write('sitemap.xml',sitemap(['','services/','tools/sales-economics/',verification]));
 assert.ok(f.run().errors.includes('sitemap.xml: Лишний или некорректный URL: '+prefix+verification));
});

test('homepage has exactly one og:url with the current GitHub Pages address',()=>{
 const home=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const metas=[...home.matchAll(/<meta\b[^>]*>/gi)].map(m=>
  Object.fromEntries([...m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(a=>[a[1].toLowerCase(),a[3]]))
 );
 const urls=metas.filter(a=>a.property?.toLowerCase()==='og:url');
 assert.equal(urls.length,1);
 assert.equal(urls[0].content,prefix);
});
