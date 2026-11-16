#!/usr/bin/env node
// docs/wechat/build.mjs — 品牌定制驱动（复用 wechat-mp skill 的模板与视觉组件）
// 在 skill 基础上：注入 V5Notes 墨绿主题令牌；支持 hero.type='image' 使用真实产品截图；
// 文章 HTML 采用品牌墨绿配色。
// 用法： node docs/wechat/build.mjs --spec docs/wechat/v1-dark.spec.json --out docs/wechat/v1-dark
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKILL = '/Users/jingyuan-mb01/.agents/skills/wechat-mp';
const ROOT = SKILL;
const CHROME = await import(pathToFileURL(join(SKILL,'scripts/chrome.mjs')).href);
const { injectAssets, chromePath } = CHROME;
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync as _wf } from 'node:fs';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
function renderHtml(html, outPath, width, height, extraCss){
  const bin = chromePath();
  const outAbs = resolve(outPath);
  mkdirSync(dirname(outAbs), { recursive: true });
  const prof = mkdtempSync(join(tmpdir(), 'v5shot-'));
  const tmp = join(dirname(outAbs), '.render-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.html');
  _wf(tmp, injectAssets(html, extraCss || ''), 'utf8');
  try {
    execFileSync(bin, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars','--no-first-run','--disable-extensions','--user-data-dir=' + prof,'--force-device-scale-factor=1','--window-size=' + width + ',' + height,'--screenshot=' + outAbs,'--virtual-time-budget=2000','file://' + tmp], { stdio: 'ignore' });
  } finally {
    try { rmSync(tmp, { force: true }); } catch(e){}
    try { rmSync(prof, { recursive: true, force: true }); } catch(e){}
  }
  if(!existsSync(outAbs)) throw new Error('渲染失败: ' + outAbs);
  return outAbs;
}
const V = await import(pathToFileURL(join(SKILL,'scripts/visuals.mjs')).href);
const { esc, hl, chip, chips, ic, browserFrame, codeWindow, flow, stack, tiles, ring, mockDashboard, mockList, mockBoard, hero } = V;

const { values } = parseArgs({ options: { spec: { type: 'string' }, out: { type: 'string' } } });
if (!values.spec || !values.out) { console.error('用法: node build.mjs --spec <spec.json> --out <dir>'); process.exit(1); }

const spec = JSON.parse(readFileSync(values.spec, 'utf8'));
const outDir = resolve(values.out);
const assetsBase = resolve(outDir, '..', 'assets', 'img');
const theme = spec.theme || 'dark';
const brand = spec.brand || {};
const cards = spec.cards || [];
const article = spec.article || {};

// ---------- brand theme CSS ----------
const DARK_CSS = [
  '.t-dark{',
  ' --bg1:#0b241d; --bg2:#123328; --bg3:#081a15;',
  ' --surface:rgba(255,255,255,.045); --surface-2:rgba(255,255,255,.075);',
  ' --border:rgba(178,214,196,.12); --border-strong:rgba(178,214,196,.22);',
  ' --text:#f3f0e7; --text-2:#aebfb2; --text-3:#7c9488;',
  ' --accent:#5fd3a6; --accent-2:#2fa9a4;',
  ' --accent-soft:rgba(95,211,166,.15); --accent-line:rgba(95,211,166,.45);',
  ' --badge:#c08744; --ok:#35c88f; --no:#7c9488;',
  ' --shadow:0 30px 80px rgba(0,0,0,.55);',
  '}',
  '.t-dark .bg,.t-dark .card .bg{background:radial-gradient(900px 620px at 88% -12%,rgba(95,211,166,.16),transparent 60%),radial-gradient(720px 520px at -12% 112%,rgba(47,169,164,.10),transparent 60%)}'
].join('\n');
const LIGHT_CSS = [
  '.t-light{',
  ' --bg1:#fffefa; --bg2:#f4f2ec; --bg3:#faf8f1;',
  ' --surface:#ffffff; --surface-2:#f5f6f1;',
  ' --border:#e4e6df; --border-strong:#d6ddd3;',
  ' --text:#27342d; --text-2:#5b6b60; --text-3:#8a958c;',
  ' --accent:#315b4a; --accent-2:#2fa9a4;',
  ' --accent-soft:rgba(49,91,74,.08); --accent-line:rgba(49,91,74,.32);',
  ' --badge:#ad7640; --ok:#2f8f63; --no:#98a2b3;',
  ' --shadow:0 24px 60px rgba(39,52,45,.12);',
  '}',
  '.t-light .bg,.t-light .card .bg{background-image:radial-gradient(rgba(39,52,45,.045) 1px,transparent 1px);background-size:28px 28px}'
].join('\n');
const SHOT_CSS = [
  '.shot{width:100%;border-radius:18px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow);background:var(--surface)}',
  '.shot img{width:100%;display:block}',
  '.shot.bare{border:none;box-shadow:none;background:transparent}'
].join('\n');
const POINT_CSS = [
  '.main .tile{padding:30px 16px;gap:14px;border-radius:20px}',
  '.main .tile .ic{width:46px;height:46px}',
  '.main .tile .tl{font-size:23px}',
  '.dgm .cap{display:none}',
  '.qrbox{width:170px;height:170px;flex:0 0 auto;border-radius:18px;overflow:hidden;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)}',
  '.qrbox img{width:100%;height:100%;display:block;object-fit:contain}'
].join('\n');
const extraCss = (theme === 'light' ? LIGHT_CSS : DARK_CSS) + '\n' + SHOT_CSS + '\n' + POINT_CSS;

function fileURL(name){ return pathToFileURL(join(assetsBase, name)).href; }
function shot(h){
  const url = fileURL(h.img);
  const cls = h.bare ? 'shot bare' : 'shot';
  return '<div class="' + cls + '"><img src="' + url + '" alt=""></div>';
}
function hero2(h){
  if(!h) return '';
  if(h.type === 'image') return shot(h);
  return hero(h);
}

// ---------- card builders ----------
function buildCover(c){
  var title = (c.title||[]).map(function(l){ return hl(l, c.accent); }).join('<br>');
  var out = '<div class="col" style="gap:0">';
  if(c.kicker){ out += '<div class="kicker">' + esc(c.kicker) + '</div>'; }
  out += '<h1 class="headline mt-m">' + title + '</h1>';
  if(c.sub){ out += '<div class="sub mt-m">' + esc(c.sub) + '</div>'; }
  if(c.hero){ out += '<div class="mt-l" style="flex:1;display:flex;align-items:flex-end">' + hero2(c.hero) + '</div>'; }
  if(c.tags){ out += '<div class="tags mt-m">' + c.tags.map(chip).join('') + '</div>'; }
  return out + '</div>';
}
function buildPoint(c){
  var out = '';
  if(c.num){ out += '<div class="ghost">' + esc(c.num) + '</div>'; }
  if(c.label){ out += '<div class="chip accent" style="align-self:flex-start">' + (c.labelIcon ? ic(c.labelIcon) : '') + esc(c.label) + '</div>'; }
  if(c.title){ out += '<h2 class="headline sm ' + (c.label ? 'mt-m' : '') + '">' + hl(c.title, c.accent) + '</h2>'; }
  if(c.body){ out += '<p class="body mt-m" style="max-width:900px">' + esc(c.body) + '</p>'; }
  if(c.hero){ out += '<div class="mt-l">' + hero2(c.hero) + '</div>'; }
  return out;
}
function buildDiagram(c){
  var out = '';
  if(c.kicker){ out += '<div class="kicker">' + esc(c.kicker) + '</div>'; }
  if(c.title){ out += '<h2 class="headline sm ' + (c.kicker ? 'mt-m' : '') + '">' + hl(c.title, c.accent) + '</h2>'; }
  if(c.hero){ out += '<div class="fill">' + hero2(c.hero) + '</div>'; }
  if(c.caption){ out += '<div class="caption mt-m">' + esc(c.caption) + '</div>'; }
  return out;
}
function buildCompare(c){
  var col = function(side, cls){
    var li = (side.items||[]).map(function(x){
      return '<li class="' + (cls === 'new' ? 'yes' : 'non') + '">' + ic(cls === 'new' ? 'check' : 'x') + esc(x) + '</li>';
    }).join('');
    return '<div class="col ' + cls + '"><div class="chead">' + esc(side.title||'') + '</div><ul>' + li + '</ul></div>';
  };
  var out = '';
  if(c.title){ out += '<h2 class="headline sm">' + hl(c.title, c.accent) + '</h2>'; }
  out += '<div class="cmp ' + (c.title ? 'mt-l' : '') + '">' + col(c.left,'old') + col(c.right,'new') + '</div>';
  if(c.caption){ out += '<div class="caption mt-m">' + esc(c.caption) + '</div>'; }
  return out;
}
function buildEnding(c){
  var out = '';
  if(c.title){ out += '<h2 class="headline sm">' + hl(c.title, c.accent) + '</h2>'; }
  if(c.points && c.points.length){
    var li = c.points.map(function(p){ return '<div class="ri"><span class="ck">' + ic('check') + '</span>' + esc(p) + '</div>'; }).join('');
    out += '<div class="recap mt-l">' + li + '</div>';
  }
  var rowStyle = 'display:flex;align-items:center;justify-content:space-between;gap:32px;margin-top:56px;padding-top:32px;border-top:1px solid var(--border)';
  out += '<div style="' + rowStyle + '"><div><div class="kicker">' + esc(c.ctaKicker||'GET STARTED') + '</div>' +
    '<div class="headline xs mt-s" style="font-size:40px">' + esc(c.cta||'') + '</div>' +
    (c.cta2 ? '<div class="body" style="margin-top:14px;font-size:26px;color:var(--text-2)">' + esc(c.cta2) + '</div>' : '') +
    '</div>' +
    (c.qr ? '<div class="qrbox"><img src="' + fileURL('qr.png') + '" alt="官网二维码"></div>' : '') + '</div>';
  return out;
}
function buildCard(c){
  if(c.variant === 'cover') return buildCover(c);
  if(c.variant === 'point') return buildPoint(c);
  if(c.variant === 'diagram') return buildDiagram(c);
  if(c.variant === 'compare') return buildCompare(c);
  if(c.variant === 'ending') return buildEnding(c);
  return '<h2 class="headline sm">' + hl(c.title||'', c.accent) + '</h2>';
}

// ---------- article builders (brand green) ----------
const A = {
  wrap:'max-width:680px;margin:0 auto;padding:8px 0;font-size:16px;line-height:1.78;color:#3a463e;letter-spacing:.5px;font-family:-apple-system,"PingFang SC",sans-serif',
  topbar:'margin:0 0 20px;padding:10px 14px;background:#f1f3ee;border-radius:8px;font-size:13px;color:#5b6b60;letter-spacing:.5px',
  h1:'margin:0 0 12px;font-size:24px;line-height:1.4;font-weight:800;color:#1f2c25',
  meta:'margin:0 0 22px;font-size:13px;color:#8a958c',
  lead:'margin:0 0 20px;font-size:16px;line-height:1.78;color:#5b6b60',
  p:'margin:0 0 19px;font-size:16px;line-height:1.78;color:#3a463e;letter-spacing:.5px',
  h2:'margin:34px 0 14px;font-size:19px;font-weight:800;color:#2f5d49;line-height:1.4',
  quote:'margin:0 0 22px;padding:14px 16px;background:#f4f5f1;border-left:4px solid #315b4a;border-radius:0 8px 8px 0;font-size:15px;line-height:1.72;color:#4b5a50',
  fig:'margin:0 0 24px;text-align:center',
  img:'width:100%;border-radius:10px;display:block;border:1px solid #eceee7',
  cap:'margin-top:8px;font-size:13px;color:#9aa39a',
  th:'background:#315b4a;color:#fff;padding:10px 12px;text-align:left;font-weight:700',
  td:'padding:10px 12px;border-bottom:1px solid #eef0ea',
  tdc:'padding:10px 12px;border-bottom:1px solid #eef0ea;color:#5b6b60',
  hr:'height:1px;background:#e5e7e0;margin:28px 0;border:none',
  link:'margin:0 0 8px;font-size:15px;line-height:1.8;color:#3a463e',
  cta:'margin:18px 0 0;padding:14px 16px;background:#e9eee8;border-radius:10px;font-size:14px;color:#315b4a;text-align:center',
  li:'margin:0 0 10px;font-size:16px;line-height:1.72;color:#3a463e'
};
function aesc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function para(t,st){ return '<p style="'+st+'">'+aesc(t)+'</p>'; }
function buildArticleHtml(a){
  var h='';
  if(a.topbar) h+=para(a.topbar,A.topbar);
  h+='<h1 style="'+A.h1+'">'+aesc(a.title)+'</h1>';
  if(a.summary) h+='<p style="'+A.meta+'">摘要：'+aesc(a.summary)+'</p>';
  (a.lead||[]).forEach(function(t){ h+=para(t,A.lead); });
  (a.sections||[]).forEach(function(sec){
    h+='<h2 style="'+A.h2+'">'+aesc(sec.h)+'</h2>';
    (sec.paras||[]).forEach(function(t){ h+=para(t,A.p); });
    if(sec.quote) h+='<blockquote style="'+A.quote+'">'+aesc(sec.quote)+'</blockquote>';
    if(sec.figure){
      h+='<figure style="'+A.fig+'"><img src="'+aesc(sec.figure.src||'')+'" style="'+A.img+'">'+
        '<figcaption style="'+A.cap+'">'+aesc(sec.figure.cap)+'</figcaption></figure>';
    }
    if(sec.table){
      var head=(sec.table.head||[]).map(function(x){return '<th style="'+A.th+'">'+aesc(x)+'</th>';}).join('');
      var rows=(sec.table.rows||[]).map(function(r,ri){
        var bg=ri%2?'#f6f8f2':'#fff';
        var tds=r.map(function(c,ci){return '<td style="'+(ci===0?A.td:A.tdc)+';background:'+bg+'">'+aesc(c)+'</td>';}).join('');
        return '<tr style="background:'+bg+'">'+tds+'</tr>';
      }).join('');
      h+='<table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px"><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';
    }
    if(sec.list && sec.list.length){
      h+=sec.list.map(function(t){return '<p style="'+A.li+'">· '+aesc(t)+'</p>';}).join('');
    }
  });
  if(a.closing) h+=para(a.closing,A.p);
  h+='<hr style="'+A.hr+'">';
  (a.links||[]).forEach(function(l){ h+='<p style="'+A.link+'"><strong>'+aesc(l.label)+'：</strong>'+aesc(l.url)+'</p>'; });
  if(a.cta) h+='<p style="'+A.cta+'">'+aesc(a.cta)+'</p>';
  return '<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+aesc(a.title)+'</title></head><body style="margin:0;background:#e9eae4"><div style="'+A.wrap+'">'+h+'</div></body></html>';
}
function buildArticleMd(a){
  var m=[];
  m.push('# '+a.title); m.push('');
  if(a.summary){ m.push('> 摘要：'+a.summary); m.push(''); }
  (a.lead||[]).forEach(function(t){ m.push(t); m.push(''); });
  (a.sections||[]).forEach(function(sec){
    m.push('## '+sec.h); m.push('');
    (sec.paras||[]).forEach(function(t){ m.push(t); m.push(''); });
    if(sec.quote){ m.push('> '+sec.quote); m.push(''); }
    if(sec.figure){ m.push('!['+sec.figure.cap+']('+(sec.figure.src||'')+')'); m.push(''); }
    if(sec.table){
      m.push('| '+(sec.table.head||[]).join(' | ')+' |');
      m.push('| '+(sec.table.head||[]).map(function(){return '---';}).join(' | ')+' |');
      (sec.table.rows||[]).forEach(function(r){ m.push('| '+r.join(' | ')+' |'); });
      m.push('');
    }
    if(sec.list && sec.list.length){ sec.list.forEach(function(t){ m.push('- '+t); }); m.push(''); }
  });
  if(a.closing){ m.push(a.closing); m.push(''); }
  m.push('---'); m.push('');
  (a.links||[]).forEach(function(l){ m.push('**'+l.label+'：**'+l.url); });
  m.push('');
  if(a.cta) m.push('> '+a.cta);
  return m.join('\n');
}

// ---------- template fill ----------
const tplCard = readFileSync(join(ROOT,'templates/card.html'),'utf8');
const tplCover = readFileSync(join(ROOT,'templates/article-cover.html'),'utf8');
const tplDiagram = readFileSync(join(ROOT,'templates/diagram.html'),'utf8');
function fill(tpl,map){ var o=tpl; Object.keys(map).forEach(function(k){ o=o.split('{{'+k+'}}').join(map[k]); }); return o; }
function cardHtml(card, idx, total){
  var badge = card.badge ? '<span class="badge'+(card.badgeGhost?' ghost':'')+'">'+esc(card.badge)+'</span>' : '';
  var map = {
    THEME:'t-'+theme, LOGO:esc(brand.logo||(brand.name||'V').charAt(0)),
    BRAND:esc(brand.name||''), COLUMN:esc(brand.column||''), BADGE:badge,
    MAIN:buildCard(card), FOOTER_LEFT:esc(brand.site||brand.name||''), PAGE:(idx+1)+' / '+total
  };
  return fill(tplCard, map);
}

// ---------- build ----------
mkdirSync(join(outDir,'cards'),{recursive:true});
mkdirSync(join(outDir,'article','images'),{recursive:true});

const cardFiles=[];
cards.forEach(function(card,i){
  var n=String(i+1).padStart(2,'0');
  var p=join(outDir,'cards','card-'+n+'.png');
  renderHtml(cardHtml(card,i,cards.length), p, 1080, 1440, extraCss);
  cardFiles.push(p);
  console.log('  card',n,'->',p);
});

var figIndex=0;
(article.sections||[]).forEach(function(sec){
  var f=sec.figure;
  if(!f) return;
  if(f.image){
    figIndex+=1;
    var src='images/fig'+figIndex+'.png';
    copyFileSync(join(assetsBase,f.image), join(outDir,'article',src));
    f.src=src;
    console.log('  fig(shot)',figIndex,'->',src);
  } else if(f.hero){
    figIndex+=1;
    var src2='images/fig'+figIndex+'.png';
    var tpl=fill(tplDiagram,{
      THEME:'t-'+theme,
      KICKER:esc(f.kicker||'图示'),
      TITLE:hl(f.title||'', f.accent||''),
      VISUAL:hero2(f.hero),
      CAPTION:esc(f.cap||'')
    });
    renderHtml(tpl, join(outDir,'article',src2), 1080, f.height||780, extraCss);
    f.src=src2;
    console.log('  fig(diagram)',figIndex,'->',src2);
  }
});

if(article.cover){
  var cv=article.cover;
  var cvTpl=fill(tplCover,{
    THEME:'t-'+theme,
    KICKER:esc(cv.kicker||''),
    TITLE:(cv.title||[]).map(function(l){return hl(l,cv.accent);}).join('<br>'),
    SUB:esc(cv.sub||''),
    VISUAL:hero2(cv.hero)
  });
  renderHtml(cvTpl, join(outDir,'article','cover.png'), 1080, 460, extraCss);
  console.log('  cover -> article/cover.png');
}

writeFileSync(join(outDir,'article','article.md'), buildArticleMd(article),'utf8');
writeFileSync(join(outDir,'article','article.html'), buildArticleHtml(article),'utf8');
console.log('  article.md / article.html');

// 文案.md
var L=[];
L.push('# '+esc(spec.name||spec.slug||'')+' · 文案'); L.push('');
L.push('> 版本主题：'+theme+'　强调色：'+(spec.accentName||'')+'　生成工具：wechat-mp skill（品牌定制）'); L.push('');
L.push('## 标题备选'); L.push('');
L.push('### 文章（推荐第 '+(((spec.titles&&spec.titles.recommend)||0)+1)+' 条）');
(spec.titles&&spec.titles.article||[]).forEach(function(t,i){ L.push((i+1)+'. '+t+(i===((spec.titles.recommend)||0)?'　**[推荐]**':'')); });
L.push(''); L.push('### 贴图（≤20 字）');
(spec.titles&&spec.titles.image||[]).forEach(function(t,i){ L.push((i+1)+'. '+t); });
L.push(''); L.push('## 摘要（'+(spec.summary||'').length+' 字）'); L.push(''); L.push(spec.summary||'');
L.push(''); L.push('## 贴图配文（≤100 字，图片消息描述）'); L.push(''); L.push(spec.imageCaption||'（未填写）');
L.push(''); L.push('## 贴图逐图文案脚本'); L.push('');
cards.forEach(function(c,i){
  L.push('### 图'+(i+1)+' · '+(c.variant||''));
  if(c.kicker)L.push('- 眉标：'+c.kicker);
  if(c.label)L.push('- 标签：'+c.label);
  if(c.title)L.push('- 标题：'+(Array.isArray(c.title)?c.title.join(' / '):c.title));
  if(c.accent)L.push('- 强调词：'+c.accent);
  if(c.sub)L.push('- 副标题：'+c.sub);
  if(c.body)L.push('- 正文：'+c.body);
  if(c.hero&&c.hero.img)L.push('- 主视觉：产品截图 '+c.hero.img);
  if(c.tags)L.push('- 标签：'+c.tags.join(' / '));
  if(c.caption)L.push('- 图注：'+c.caption);
  if(c.points)L.push('- 回顾：'+c.points.join(' / '));
  if(c.cta)L.push('- CTA：'+c.cta);
  L.push('');
});
writeFileSync(join(outDir,'文案.md'), L.join('\n'),'utf8');

// 发布清单.md
var C=[];
C.push('# 发布清单 · '+(spec.name||spec.slug)); C.push('');
C.push('## 贴图');
C.push('- [ ] 图片共 '+cards.length+' 张，顺序：'+cards.map(function(c){return c.variant;}).join(' → '));
C.push('- [ ] 每张 1080×1440（3:4），PNG；单张 >2MB 时压到 JPG 90');
C.push('- [ ] 首图 3 秒可懂；标题 ≤20 字：'+((spec.titles&&spec.titles.image&&spec.titles.image[0])||''));
C.push('- [ ] 每卡一个信息、一个强调色、标题 ≤2 行；安全区 ≥64px');
C.push('- [ ] 配文 ≤100 字 + 一个 CTA；结尾卡含二维码/关键词');
C.push(''); C.push('## 文章');
C.push('- [ ] 标题：'+((spec.titles&&spec.titles.article&&spec.titles.article[(spec.titles.recommend||0)])||''));
C.push('- [ ] 摘要 ≤54 字（当前 '+(spec.summary||'').length+' 字）');
C.push('- [ ] 封面 1080×460；正文配图 '+figIndex+' 张，编号连续');
C.push('- [ ] 每图有「图N：」图注；段落 ≤4 行');
C.push('- [ ] HTML 为内联样式，粘贴到微信编辑器不丢样式');
C.push('- [ ] 手机预览：无乱码、无失效图片');
C.push(''); C.push('## 交付前自检：见 skill references/publish-checklist.md C 节');
writeFileSync(join(outDir,'发布清单.md'), C.join('\n'),'utf8');

// index.md
var I=[];
I.push('# '+(spec.name||spec.slug)); I.push('');
I.push('## 贴图');
cardFiles.forEach(function(p,i){ I.push('- [cards/card-'+String(i+1).padStart(2,'0')+'.png](cards/card-'+String(i+1).padStart(2,'0')+'.png) — '+cards[i].variant); });
I.push(''); I.push('## 文章');
I.push('- [article/article.md](article/article.md)');
I.push('- [article/article.html](article/article.html)');
I.push('- [article/cover.png](article/cover.png)');
I.push(''); I.push('## 文案');
I.push('- [文案.md](文案.md) · [发布清单.md](发布清单.md)');
writeFileSync(join(outDir,'index.md'), I.join('\n'),'utf8');
console.log('DONE ->', outDir);