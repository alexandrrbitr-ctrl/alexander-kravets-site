#!/usr/bin/env node
/** Opt-in live smoke test AFTER deployment. Does not publish anything. */
const address = process.argv[2];
if(!address){
 console.error('Usage: node scripts/check-live.mjs https://host/path/');
 process.exit(2);
}
let base;
try {base=new URL(address);if(!/^https:$/.test(base.protocol)||!base.pathname.endsWith('/'))throw Error();}
catch {console.error('Expect an HTTPS URL ending with /');process.exit(2);}
const paths=['','sitemap.xml','tools/','tools/sales-economics/','case-pharma.html','privacy.html'];
let failures=0;
for(const p of paths){
 const u=new URL(p,base);
 try {
  const response=await fetch(u,{headers:{'User-Agent':'FormulaRostaReleaseCheck/1.0'}});
  const body=await response.text();
  const text=p.endsWith('.xml')?'<urlset':'<html';
  const ok=response.ok&&body.toLowerCase().includes(text);
  const markers={
   '':['Формула','footer__ip'],
   'tools/':['Калькулятор','footer__ip'],
   'tools/sales-economics/':['calculator-form','footer__ip'],
   'case-pharma.html':['case-viz','footer__ip'],
   'privacy.html':['Сведения об исполнителе','footer__ip'],
  };
  const missing=(markers[p]||[]).filter(m=>!body.includes(m));
  if(!ok||missing.length)failures++;
  console.log(`${ok&&!missing.length?'PASS':'FAIL'} ${response.status} ${u} ${missing.length?' missing:'+missing.join(','):''}`);
 }catch(e){failures++;console.log(`FAIL ${u} ${String(e.message||e)}`)}
}
if(base.pathname!=='/')console.log('NOTE: robots.txt for project-subpath is not the host-root robots.txt; submit sitemap explicitly in Search Console.');
process.exitCode=failures?1:0;
