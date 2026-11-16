#!/usr/bin/env node
/* 한 파일짜리 HTML로 묶는다.
 *  dist/zombie-survival.html : 그대로 열 수 있는 완전한 문서
 *  dist/artifact.html        : 문서 뼈대(doctype/html/head/body) 없이 내용만 (Claude 아티팩트 게시용)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(s => `/* ${s} */\n` + read(s)).join('\n');
let css = read('css/style.css');
css = css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (m, f) => {
  const b64 = fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '좀비 생존 일지';
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
const body = '<div id="app"><canvas id="game"></canvas></div>';
const safeJs = js.replace(/<\/script/gi, '<\\/script');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const full = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#07080a">
<style>${css}</style>
</head>
<body>
${body}
<script>${safeJs}</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'dist', 'zombie-survival.html'), full);
const art = `<title>${title}</title>
<style>${css}</style>
${body}
<script>${safeJs}</script>
`;
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), art);
console.log('built', (full.length / 1024).toFixed(1) + 'KB', 'scripts:', scripts.length);
