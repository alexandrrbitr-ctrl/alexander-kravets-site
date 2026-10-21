#!/usr/bin/env node
/**
 * Static commercial-site preflight. Zero npm dependencies and zero external requests.
 * Run from repository root: node scripts/check-site.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkSite(rootDir, opts = {}) {
  const root = path.resolve(rootDir);
  const errors = [];
  const warnings = [];
  const isFile = p => fs.existsSync(path.join(root, p)) && fs.statSync(path.join(root, p)).isFile();
  const addError = (p, message) => errors.push(`${p}: ${message}`);
  const read = p => fs.readFileSync(path.join(root, p), 'utf8');
  const files = [];
  const skipDirs = new Set(['.git', 'node_modules', 'docs', '.venv', 'dist', 'build', 'coverage']);
  function walk(dir = '') {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes:true})) {
      const p = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(p); }
      else if(entry.isFile() && p.endsWith('.html')) files.push(p);
    }
  }
  walk();
  files.sort();
  if (!isFile('sitemap.xml')) { addError('sitemap.xml', 'Файл отсутствует'); return {errors, warnings, pages: files.length}; }
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1].toLowerCase(),m[3]]));
  const tags = (html, tagName) => [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map(m=>m[0]);
  const getAttrTag = (html, tagName, field, val) => tags(html, tagName).find(t=>String(attrs(t)[field]||'').toLowerCase()===val.toLowerCase());

  const xml = read('sitemap.xml');
  const listed = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
  if (listed.length===0) addError('sitemap.xml', 'Нет URL в sitemap');
  // The homepage canonical defines the project root; sitemap order must not change it.
  const homeCanonical = isFile('index.html') ? tags(read('index.html'),'link').find(t=>String(attrs(t).rel||'').toLowerCase().split(/\s+/).includes('canonical')) : null;
  const base = opts.base || (homeCanonical && attrs(homeCanonical).href) || listed.filter(u=>u.endsWith('/')).sort((a,b)=>a.length-b.length)[0];
  try {
    const u = new URL(base);
    if(u.protocol!=='https:' || !u.pathname.endsWith('/') || u.search || u.hash || u.username || u.password) throw Error();
  } catch {
    addError('sitemap.xml', 'Невозможно определить корректную HTTPS-базу сайта с завершающим /');
    return {root,base,pages:files.length,sitemapUrls:listed.length,errors,warnings};
  }
  if (new Set(listed).size !== listed.length) addError('sitemap.xml', 'Есть повторяющиеся URL');
  const indexable = new Map();
  const ignored = new Set(['404.html','cookies.html']);
  const redirects = [];

  function expectedUrl(p) { return base + (p==='index.html'?'':p.endsWith('/index.html')?p.slice(0,-10):p); }
  function internalAsset(raw, from) {
    if (!raw || !base || /^(?:data:|mailto:|tel:|javascript:|blob:|sms:)/i.test(raw)) return null;
    let u;
    try {u = new URL(raw, new URL(from==='index.html' ? '.' : from, base));} catch {return null;}
    const origin = new URL(base).origin;
    if(u.origin!==origin) return null;
    const prefix = new URL(base).pathname;
    if(!u.pathname.startsWith(prefix)) return null;
    let p;
    try {p=decodeURIComponent(u.pathname.slice(prefix.length))} catch{return null;}
    if(!p || p.endsWith('/'))p+='index.html';
    p=path.posix.normalize(p);
    if(p.startsWith('../') || path.isAbsolute(p))return {invalid:true,p};
    let fragment='';
    try { fragment=decodeURIComponent(u.hash.slice(1)); } catch { return {invalid:true,p}; }
    return {p,fragment};
  }
  const ids = new Map(files.map(p=>[p,[...read(p).matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(m=>m[2])]));
  let resourceRefs = 0;
  let ldBlocks = 0;
  let ipFooterPages = 0;
  for (const p of files) {
    const html = read(p);
    // Only exact, root-level Search Console verification files are exempt from page SEO.
    if (/^google[0-9a-fA-F]+\.html$/.test(p) && html === `google-site-verification: ${p}`) continue;
    if(new Set(ids.get(p)).size!==ids.get(p).length)addError(p,'Повторяющиеся id');
    if(tags(html,'title').length>1)addError(p,'Несколько title');
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    if(!title) addError(p,'Отсутствует title');
    const h1 = [...html.matchAll(/<h1\b/gi)].length;
    if(h1!==1) addError(p, `Заголовков H1: ${h1} вместо 1`);
    if(tags(html,'meta').filter(t=>String(attrs(t).name||'').toLowerCase()==='robots').length>1)addError(p,'Несколько meta robots');
    const robotTag=getAttrTag(html,'meta','name','robots');
    const robots=attrs(robotTag||'').content||'';
    const noindex=/\bnoindex\b/i.test(robots);
    if(ignored.has(p) && !noindex) addError(p,'Техническая страница должна иметь noindex');
    if(!ignored.has(p) && p!=='privacy.html' && noindex) addError(p,'Коммерческая страница неожиданно имеет noindex');
    if(p==='privacy.html' && !noindex)warnings.push('privacy.html: проверьте намерение индексировать юридическую страницу');
    const canonicalTags=tags(html,'link').filter(t=>String(attrs(t).rel||'').toLowerCase().split(/\s+/).includes('canonical'));
    const can=canonicalTags[0]?attrs(canonicalTags[0]).href:null;
    if(p!=='404.html' && canonicalTags.length!==1)addError(p,`Canonical: ${canonicalTags.length} вместо 1`);
    else if(canonicalTags.length>1)addError(p,'Несколько canonical');
    // cookies.html is an intentional legacy redirect, not a self-canonical page.
    if(p==='cookies.html') {
      const refresh=getAttrTag(html,'meta','http-equiv','refresh');
      const refreshUrl=(attrs(refresh||'').content||'').match(/^\s*0\s*;\s*url\s*=\s*["']?(.+?)["']?\s*$/i)?.[1];
      const jsUrl=html.match(/(?:window\.)?location\.replace\(\s*(["'])(.*?)\1\s*\)/)?.[2];
      const expected=base+'privacy.html#cookies';
      const targetMatches=raw=>{try{return new URL(raw,expectedUrl(p)).href===expected}catch{return false}};
      if(!refreshUrl||!jsUrl||!targetMatches(refreshUrl)||!targetMatches(jsUrl)||!isFile('privacy.html')||!ids.get('privacy.html')?.includes('cookies'))addError(p,'Некорректный переход cookies: ожидаются meta refresh и location.replace на privacy.html#cookies');
      else redirects.push(p);
    }
    const expectedCanonical=p==='cookies.html'?base+'privacy.html':expectedUrl(p);
    if(can && can!==expectedCanonical)addError(p,`Некорректный canonical: ${can}`);
    if(!ignored.has(p)&&!noindex) {
      indexable.set(p,expectedUrl(p));
      const descriptions=tags(html,'meta').filter(t=>String(attrs(t).name||'').toLowerCase()==='description');
      if(descriptions.length!==1)addError(p,`Meta description: ${descriptions.length} вместо 1`);
      if(!attrs(descriptions[0]||'').content?.trim())addError(p,'Нет meta description');
    }
    const ipCount = (html.match(/class="shell footer__ip"/g)||[]).length;
    if(ipCount !== 1)addError(p, `Блок реквизитов ИП встречается ${ipCount} раз`);
    else ipFooterPages++;
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      ldBlocks++;
      try { JSON.parse(match[1]); } catch(e) {addError(p, `Некорректный JSON-LD: ${e.message}`);}
    }
    for(const m of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gis)) {
      const raw=m[2];
      const loc=internalAsset(raw,p);
      if(!loc)continue;
      resourceRefs++;
      if(loc.invalid) addError(p, `Ссылка выходит за пределы проекта: ${raw}`);
      else if(!isFile(loc.p)) addError(p, `Не найден файл для ссылки ${raw} → ${loc.p}`);
      else if(loc.fragment && loc.p.endsWith('.html') && !ids.get(loc.p)?.includes(loc.fragment))addError(p,`Не найден якорь #${loc.fragment} в ${loc.p}`);
    }
  }
  if(base){
    const canonicalSet=new Set(indexable.values());
    const listedSet=new Set(listed);
    for(const [p,u] of indexable)if(!listedSet.has(u))addError('sitemap.xml',`Нет indexable страницы: ${p} (${u})`);
    for(const u of listed)if(!canonicalSet.has(u))addError('sitemap.xml',`Лишний или некорректный URL: ${u}`);
    const folder = new URL(base).pathname;
    if(folder!=='/') warnings.push('robots.txt внутри каталога GitHub Pages не является robots.txt корня хоста; sitemap следует отправить через Search Console (после запуска и подтверждения права).');
  }
  if(isFile('index.html')&&!read('index.html').includes('href="tools/sales-economics/"'))addError('index.html','Нет заметной ссылки на калькулятор');
  if(isFile('services/index.html')&&!read('services/index.html').includes('href="../tools/sales-economics/"'))addError('services/index.html','Нет ссылки на калькулятор');
  if(isFile('tools/sales-economics/index.html') && !isFile('tools/sales-economics/engine.mjs'))addError('tools/sales-economics/','Не найден расчётный модуль');
  return {root,base,pages:files.length,indexablePages:indexable.size,sitemapUrls:listed.length,jsonLdBlocks:ldBlocks,ipFooterPages,localReferencesChecked:resourceRefs,cookieRedirectPresent:redirects.length===1,errors,warnings};
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  const report=checkSite(process.argv[2]||'.');
  const printable={...report,root:undefined};
  process.stdout.write(JSON.stringify(printable,null,2)+'\n');
  process.exitCode=report.errors.length?1:0;
}
