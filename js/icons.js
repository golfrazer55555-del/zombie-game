'use strict';
/* ===== 아이템 아이콘 / UI 아이콘 (16x16 픽셀아트, 코드로 생성) ===== */
(function () {
  const M1 = '#eef2f6', M2 = '#bcc4cc', M3 = '#848c96', M4 = '#565c66';
  const W1 = '#d09a60', W2 = '#a8743e', W3 = '#7e5028', W4 = '#5a361a';
  const batBody = (g) => {
    for (let i = 0; i <= 6; i++) g.disc(6.5 + i, 9.5 - i, 0.9 + i * 0.14, W2);
    g.line(6, 8, 11, 3, W1); g.line(8, 9, 13, 4, W3);
    g.line(2, 13, 6, 9, W4); g.line(3, 13, 6, 10, W3); g.set(2, 13, '#202024'); g.set(3, 12, '#202024'); g.set(3, 13, '#202024');
  };
  const bottleShape = (g, liquid, glass, hi) => {
    g.rect(5, 7, 6, 7, glass); g.rect(6, 5, 4, 2, glass); g.rect(7, 2, 2, 3, glass);
    if (liquid) { g.rect(5, 9, 6, 5, liquid); g.vl(5, 9, 5, shade(liquid, 1.25)); g.vl(10, 9, 5, shade(liquid, 0.75)); }
    g.vl(6, 7, 4, hi); g.set(7, 2, hi); g.vl(10, 7, 2, shade(glass, 0.75));
  };
  const plasticBottle = (g, liquid, cap, label) => {
    g.rect(5, 4, 6, 10, '#c8e4f0'); g.vl(5, 4, 10, '#e8f6ff'); g.vl(10, 4, 10, '#90b8cc');
    if (liquid) { g.rect(5, 6, 6, 8, liquid); g.vl(5, 6, 8, shade(liquid, 1.2)); g.vl(10, 6, 8, shade(liquid, 0.75)); }
    if (label) { g.rect(5, 8, 6, 3, label); g.hl(5, 8, 6, shade(label, 1.3)); }
    g.rect(6, 2, 4, 2, cap); g.hl(6, 2, 4, shade(cap, 1.3));
  };
  const steam = (g, xs) => { for (const [x, y] of xs) g.set(x, y, '#dcdcdc'); };
  const can = (g, body, top) => {
    g.rect(5, 3, 6, 11, body); g.vl(5, 3, 11, shade(body, 1.25)); g.vl(10, 3, 11, shade(body, 0.7));
    g.hl(5, 3, 6, top || '#c8ccd0'); g.hl(5, 13, 6, '#9a9ea4');
  };
  const packet = (g) => { g.rect(3, 2, 10, 12, '#e8dcc0'); g.hl(3, 2, 10, '#f8f0dc'); g.vl(12, 2, 12, '#c4b494'); g.hl(5, 4, 6, '#4a8a3a'); };

  const I = {
    knife: g => { g.line(6, 9, 12, 3, M1); g.line(7, 9, 13, 3, M2); g.line(7, 10, 13, 4, M3); g.set(13, 2, M1); g.line(2, 13, 5, 10, W3); g.line(3, 13, 6, 10, W4); g.set(6, 10, M4); g.set(5, 9, M4); g.set(3, 12, '#c8a060'); },
    bat: g => batBody(g),
    nailbat: g => { batBody(g); for (const [x, y] of [[9, 3], [12, 5], [10, 7], [13, 2], [8, 5], [11, 8], [14, 4]]) { g.set(x, y, M2); } g.set(14, 3, '#8a2020'); g.set(10, 4, '#8a2020'); },
    pan: g => { g.disc(10, 6, 4.6, '#34343a'); g.disc(10, 6, 3.5, '#50505a'); g.disc(9, 5, 1.6, '#64646e'); g.set(8, 4, '#8a8a96'); g.thick(2, 13, 6, 9, '#2a2420', 2); g.line(2, 12, 5, 9, '#4a3a30'); },
    crowbar: g => { g.thick(4, 12, 11, 4, '#b83030', 2); g.line(4, 11, 10, 4, '#e05656'); g.set(11, 3, '#b83030'); g.set(12, 2, '#b83030'); g.set(13, 3, '#b83030'); g.set(13, 4, '#8a2020'); g.set(3, 13, '#8a2020'); g.set(2, 13, '#b83030'); g.set(3, 14, '#8a2020'); },
    axe: g => { g.thick(3, 13, 10, 5, W2, 2); g.line(3, 12, 9, 5, W1); g.rect(10, 1, 2, 6, M3); g.rect(12, 2, 2, 5, M2); g.vl(14, 3, 3, M1); g.rect(8, 3, 2, 2, M4); g.set(11, 1, M2); },
    stoneaxe: g => { g.thick(3, 13, 10, 5, W3, 2); g.line(3, 12, 9, 5, W2); g.oval(11.5, 4.5, 3, 2.6, '#80808a'); g.oval(11, 3.8, 1.9, 1.5, '#a4a4ae'); g.set(9, 6, '#d8c08a'); g.set(10, 6, '#d8c08a'); g.set(9, 5, '#b89a60'); g.set(10, 7, '#b89a60'); },
    machete: g => { g.thick(5, 10, 13, 2, M2, 2); g.line(5, 9, 12, 2, M1); g.line(6, 11, 14, 3, M3); g.set(14, 1, M1); g.thick(2, 13, 5, 10, '#26262c', 2); g.set(5, 11, M4); g.set(6, 10, M4); },
    spear: g => { g.line(2, 14, 11, 5, W2); g.line(3, 14, 12, 5, W3); g.rect(12, 2, 2, 2, '#8a8a92'); g.set(14, 1, '#b4b4bc'); g.set(11, 4, '#9a9aa2'); g.set(13, 4, '#66666e'); g.set(11, 5, '#d8c08a'); g.set(10, 6, '#d8c08a'); },
    hammer: g => { g.thick(3, 13, 9, 7, W2, 2); g.line(3, 12, 8, 7, W1); g.thick(8, 3, 12, 7, M3, 3); g.line(8, 3, 12, 7, M2); g.set(13, 8, M4); g.set(7, 2, M4); },
    torch: g => { g.thick(4, 13, 8, 9, W3, 2); g.disc(10, 7, 2.5, '#c8b080'); g.set(9, 6, '#e8d8a8'); g.oval(11, 4, 2.2, 3, '#ff8a20'); g.oval(11, 4.5, 1.2, 1.8, '#ffe060'); g.set(12, 1, '#e04a1a'); },
    pistol: g => { g.rect(3, 5, 10, 3, '#4a4e56'); g.hl(3, 5, 10, '#727882'); g.set(13, 6, '#2a2c30'); g.rect(4, 8, 3, 5, '#2e2a28'); g.vl(4, 8, 5, '#4a423c'); g.set(7, 8, '#3a3e46'); g.set(8, 9, '#3a3e46'); g.set(7, 10, '#3a3e46'); g.set(12, 4, '#4a4e56'); },
    shotgun: g => { g.rect(1, 6, 4, 3, W3); g.hl(1, 6, 4, W2); g.set(1, 9, W4); g.rect(5, 5, 3, 3, '#3a3e46'); g.rect(8, 5, 7, 2, '#4a4e56'); g.hl(8, 5, 7, '#727882'); g.rect(9, 7, 4, 2, W2); g.hl(9, 7, 4, W1); g.set(6, 8, '#2a2c30'); },
    rifle: g => { g.rect(1, 7, 4, 3, W2); g.hl(1, 7, 4, W1); g.rect(5, 6, 4, 2, W3); g.rect(9, 6, 6, 1, '#4a4e56'); g.rect(6, 4, 5, 1, '#22242a'); g.set(6, 3, '#22242a'); g.set(10, 3, '#22242a'); g.set(7, 4, '#6ab0ff'); g.set(7, 8, '#2a2c30'); g.set(9, 5, '#7a7e86'); },
    bow: g => { for (let y = 1; y <= 14; y++) { const x = 5 + 6 * Math.sin(Math.PI * (y - 1) / 13); g.set(Math.round(x), y, W2); g.set(Math.round(x) + 1, y, W3); } g.vl(5, 1, 14, '#ece4cc'); g.rect(10, 7, 2, 2, '#5a3a22'); },
    ammo9: g => { for (let k = 0; k < 3; k++) { const x = 2 + k * 4; g.rect(x, 7, 3, 6, '#d8a840'); g.vl(x, 7, 6, '#f4cc66'); g.rect(x, 5, 3, 2, '#c07030'); g.set(x + 1, 4, '#c07030'); g.hl(x, 12, 3, '#a87a28'); } },
    shell: g => { for (const [x, y] of [[3, 3], [9, 4]]) { g.rect(x, y, 4, 8, '#c83030'); g.vl(x, y, 8, '#e85656'); g.rect(x, y + 8, 4, 2, '#d8b040'); g.hl(x, y + 8, 4, '#f0d060'); } },
    ammo762: g => { for (const x of [4, 9]) { g.rect(x, 4, 3, 9, '#d8a840'); g.vl(x, 4, 9, '#f4cc66'); g.rect(x, 2, 3, 2, '#a86028'); g.set(x + 1, 1, '#a86028'); } },
    arrow: g => { g.line(3, 13, 12, 4, '#c8a070'); g.set(13, 3, M2); g.set(12, 3, M3); g.set(13, 4, M3); g.set(14, 2, M1); g.set(2, 12, '#e04040'); g.set(3, 14, '#e04040'); g.set(2, 14, '#f4f4f4'); g.set(1, 13, '#f4f4f4'); g.set(4, 14, '#e04040'); },
    bottle: g => bottleShape(g, null, '#6aa878', '#c8f0d0'),
    molotov: g => { bottleShape(g, '#c87830', '#9ec4ac', '#d8f0e0'); g.rect(6, 0, 4, 3, '#e0d0b0'); g.set(9, 0, '#ff8a20'); g.set(10, 1, '#ffd040'); },
    firecracker: g => { for (const [x, y, c] of [[3, 6, '#d83030'], [7, 5, '#ee4444'], [11, 6, '#d83030']]) { g.rect(x, y, 3, 8, c); g.vl(x, y, 8, shade(c, 1.25)); g.hl(x, y + 2, 3, '#e8c040'); g.hl(x, y + 6, 3, '#e8c040'); } g.line(8, 5, 10, 2, '#c8c8c8'); g.set(10, 1, '#ffe060'); g.set(11, 1, '#ff9030'); },
    beans: g => { g.rect(4, 4, 8, 10, '#b8bcc4'); g.hl(4, 4, 8, '#e4e8ec'); g.rect(4, 6, 8, 6, '#d85a30'); g.hl(4, 6, 8, '#f47c4a'); g.set(6, 8, '#7a3a1a'); g.set(8, 9, '#7a3a1a'); g.set(10, 8, '#7a3a1a'); g.vl(4, 4, 10, '#dce0e6'); g.vl(11, 4, 10, '#8a8e96'); g.hl(4, 13, 8, '#9a9ea6'); },
    tuna: g => { g.rect(3, 7, 10, 5, '#b8bcc4'); g.hl(3, 7, 10, '#e4e8ec'); g.rect(3, 8, 10, 3, '#3a6ab0'); g.hl(6, 9, 4, '#e0e8f0'); g.set(10, 8, '#e0e8f0'); g.set(10, 10, '#e0e8f0'); g.set(5, 9, '#e0e8f0'); g.hl(3, 11, 10, '#8a8e96'); },
    chips: g => { g.rect(4, 3, 8, 11, '#e8c030'); g.vl(4, 3, 11, '#f8e070'); g.vl(11, 3, 11, '#c09820'); for (let x = 4; x < 12; x++) { g.set(x, 2 + (x & 1), '#c09820'); g.set(x, 14 - (x & 1), '#c09820'); } g.rect(4, 6, 8, 2, '#d83a2a'); g.oval(8, 10.5, 2.2, 1.6, '#f4d488'); g.set(7, 10, '#ffffff'); },
    chocobar: g => { g.thick(3, 11, 12, 4, '#6a3a20', 3); g.line(3, 10, 11, 3, '#8e5432'); g.rect(1, 11, 3, 3, '#c83030'); g.rect(12, 2, 3, 3, '#c83030'); g.set(7, 8, '#e8c040'); },
    bread: g => { g.oval(8, 9.5, 6.4, 3.6, '#b87434'); g.oval(7.6, 8.6, 5.4, 2.6, '#dca050'); g.line(5, 9, 6, 7, '#a86828'); g.line(8, 9, 9, 7, '#a86828'); g.line(11, 9, 12, 7, '#a86828'); g.hl(4, 7, 3, '#f4c878'); },
    ramen: g => { g.rect(2, 3, 12, 10, '#d02a20'); g.hl(2, 3, 12, '#f04a3a'); g.vl(13, 3, 10, '#a01810'); g.oval(8, 9.5, 3.6, 2, '#f4f4f4'); g.hl(6, 8, 5, '#f0d060'); g.set(7, 7, '#f0d060'); g.set(9, 7, '#f0d060'); g.hl(4, 5, 8, '#ffe060'); },
    ramen_cooked: g => { g.rect(3, 8, 10, 5, '#8a8e96'); g.hl(3, 8, 10, '#c4c8d0'); g.set(2, 9, '#5a5e66'); g.set(13, 9, '#5a5e66'); g.hl(4, 8, 8, '#d84a2a'); g.set(5, 8, '#f0d060'); g.set(8, 8, '#f0d060'); g.set(10, 8, '#f0d060'); g.hl(3, 12, 10, '#6a6e76'); steam(g, [[6, 5], [7, 4], [10, 5], [9, 3]]); },
    apple: g => { g.disc(8, 9, 4.6, '#c82828'); g.disc(7, 8, 2.6, '#e84848'); g.set(6, 7, '#ff9a9a'); g.vl(8, 3, 2, '#6a4224'); g.rect(9, 3, 2, 1, '#4a9a3a'); g.set(10, 2, '#5aaa4a'); },
    berries: g => { g.disc(6, 9.5, 2.2, '#a01830'); g.disc(10.5, 8.5, 2.2, '#c02040'); g.disc(8.5, 12, 2.2, '#b01c38'); g.set(5, 8, '#ff7080'); g.set(9, 7, '#ff7080'); g.set(7, 11, '#ff7080'); g.rect(7, 4, 3, 2, '#4a8a3a'); g.set(10, 4, '#3a7a2a'); g.set(6, 5, '#5a9a4a'); },
    fish: g => { g.oval(7, 8.5, 5.2, 2.9, '#6a8aa8'); g.hl(4, 9, 6, '#c8d8e0'); g.hl(5, 10, 4, '#a8b8c8'); g.hl(4, 6, 6, '#4a6a88'); g.rect(12, 7, 1, 4, '#5a7a98'); g.vl(13, 5, 3, '#5a7a98'); g.vl(13, 10, 3, '#5a7a98'); g.vl(14, 4, 2, '#5a7a98'); g.vl(14, 11, 2, '#5a7a98'); g.set(4, 7, '#101010'); g.set(8, 5, '#4a6a88'); },
    fish_cooked: g => { g.oval(7, 8.5, 5.2, 2.9, '#b8783a'); g.hl(4, 9, 6, '#dca866'); g.hl(4, 6, 6, '#8a5224'); g.rect(12, 7, 1, 4, '#9a6030'); g.vl(13, 5, 3, '#9a6030'); g.vl(13, 10, 3, '#9a6030'); for (const x of [5, 7, 9]) g.vl(x, 7, 3, '#5a2e12'); g.set(4, 7, '#2a1408'); },
    potato: g => { g.oval(8, 9, 5.6, 4.1, '#a87a48'); g.oval(7, 8, 3.6, 2.5, '#c8985e'); g.set(5, 9, '#6a4a28'); g.set(9, 7, '#6a4a28'); g.set(11, 10, '#6a4a28'); },
    potato_cooked: g => { g.oval(8, 9.5, 5.6, 4, '#7a4a24'); g.oval(8, 9, 4.1, 2.8, '#f0d070'); g.oval(7, 8.4, 2, 1.4, '#fff4b0'); steam(g, [[6, 4], [7, 3], [10, 4]]); },
    carrot: g => { for (let i = 0; i < 8; i++) g.disc(4.5 + i * 0.9, 11.5 - i * 0.9, 0.6 + i * 0.2, '#e8782a'); g.line(5, 10, 9, 6, '#ffa050'); g.set(7, 9, '#b8581a'); g.set(9, 8, '#b8581a'); g.line(11, 5, 13, 2, '#4a9a3a'); g.line(11, 5, 14, 4, '#5aaa4a'); g.line(11, 5, 11, 1, '#4a9a3a'); },
    soup: g => { g.oval(8, 11, 5.8, 2.6, '#d8d4c8'); g.oval(8, 9.5, 5.8, 1.8, '#e8883a'); g.hl(4, 9, 3, '#f4a85a'); g.set(6, 9, '#5aaa4a'); g.set(9, 10, '#f0d070'); g.set(11, 9, '#c84a2a'); g.hl(4, 13, 8, '#a8a498'); steam(g, [[6, 6], [7, 5], [10, 6], [9, 4]]); },
    water: g => plasticBottle(g, '#8ccbf0', '#2a5aa8', '#2a6ab8'),
    soda: g => { can(g, '#d02a2a'); g.line(5, 9, 10, 7, '#f4f4f4'); g.line(5, 10, 10, 8, '#f4f4f4'); },
    coffee: g => { can(g, '#6a4024'); g.rect(5, 7, 6, 4, '#e8d8b0'); g.set(8, 9, '#6a4024'); g.set(7, 8, '#6a4024'); },
    water_dirty: g => plasticBottle(g, '#8a6a40', '#5a5a5a', null),
    water_clean: g => { bottleShape(g, '#7ab8e0', '#a8d0c0', '#e0f8f0'); g.set(7, 11, '#e0f4ff'); g.set(8, 12, '#e0f4ff'); },
    bandage: g => { g.disc(7, 9, 4.6, '#f2eee2'); g.ring(7, 9, 2.2, '#c8c0b0'); g.disc(7, 9, 1, '#d8d0c0'); g.rect(10, 10, 4, 3, '#f2eee2'); g.hl(10, 12, 4, '#c8c0b0'); g.set(4, 6, '#ffffff'); },
    painkiller: g => { g.rect(4, 5, 7, 9, '#e88a2a'); g.vl(4, 5, 9, '#f8b050'); g.vl(10, 5, 9, '#b86a1a'); g.rect(4, 3, 7, 2, '#f4f4f4'); g.rect(4, 8, 7, 3, '#f4f4f4'); g.hl(5, 9, 5, '#d83030'); g.rect(12, 11, 3, 2, '#f4f4f4'); },
    firstaid: g => { g.rect(2, 4, 12, 10, '#d83030'); g.hl(2, 4, 12, '#f05656'); g.vl(13, 4, 10, '#a01c1c'); g.rect(7, 6, 2, 6, '#fafafa'); g.rect(5, 8, 6, 2, '#fafafa'); g.rect(6, 2, 4, 1, '#8a1c1c'); g.set(6, 3, '#8a1c1c'); g.set(9, 3, '#8a1c1c'); },
    antibiotic: g => { g.rect(3, 4, 10, 9, '#c8ccd8'); g.hl(3, 4, 10, '#e8ecf4'); g.vl(12, 4, 9, '#9aa0ae'); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.rect(4 + i * 3, 5 + j * 4, 2, 2, '#4a7ad8'); g.set(4 + i * 3, 5 + j * 4, '#8ab0ff'); } },
    stick: g => { g.line(2, 13, 13, 3, '#8a5e36'); g.line(3, 13, 13, 4, '#6a4424'); g.line(8, 8, 9, 4, '#8a5e36'); g.set(9, 3, '#5a9a44'); g.set(5, 11, '#a87848'); },
    log: g => { g.rect(2, 6, 10, 6, '#7a5230'); g.hl(2, 6, 10, '#9a6a40'); g.hl(2, 11, 10, '#5a3a20'); g.set(4, 8, '#5a3a20'); g.set(7, 9, '#5a3a20'); g.set(9, 7, '#5a3a20'); g.oval(12.5, 9, 2.6, 3.2, '#d8b080'); g.oval(12.5, 9, 1.4, 1.8, '#b8905e'); g.set(12, 9, '#8a6a40'); },
    plank: g => { g.rect(1, 4, 14, 3, W1); g.hl(1, 4, 14, '#e4b47e'); g.hl(1, 6, 14, W2); g.rect(2, 9, 13, 3, W2); g.hl(2, 9, 13, W1); g.hl(2, 11, 13, W3); g.set(3, 5, W4); g.set(13, 10, W4); g.set(7, 5, W2); g.set(10, 10, W3); },
    stone: g => { g.oval(8, 9, 5.2, 3.8, '#7a7a80'); g.oval(7, 8, 3.6, 2.5, '#9a9aa0'); g.set(6, 7, '#c4c4ca'); g.set(10, 11, '#5a5a60'); g.set(11, 9, '#66666c'); },
    rag: g => { g.rect(3, 5, 10, 8, '#c8b898'); g.hl(3, 5, 10, '#e0d4b8'); g.line(4, 7, 11, 10, '#a89878'); g.set(9, 6, '#8a7a60'); for (const [x, y] of [[3, 12], [6, 12], [12, 5], [12, 9], [3, 7]]) g.clr(x, y); g.set(8, 12, '#a89878'); },
    cloth: g => { g.rect(4, 4, 8, 10, '#5a7aa8'); g.rect(1, 4, 3, 4, '#5a7aa8'); g.rect(12, 4, 3, 4, '#5a7aa8'); g.rect(6, 4, 4, 1, '#3a5a88'); g.set(7, 5, '#3a5a88'); g.set(8, 5, '#3a5a88'); g.vl(4, 5, 8, '#7a9ac8'); g.hl(1, 4, 3, '#7a9ac8'); g.vl(11, 5, 8, '#4a6a98'); },
    nails: g => { for (const [x, y] of [[3, 4], [6, 6], [9, 3], [12, 6]]) { g.vl(x, y + 1, 7, M2); g.rect(x - 1, y, 3, 1, M3); g.set(x, y + 8, M3); } },
    rope: g => { g.ring(8, 8, 5.2, '#c8a868'); g.ring(8, 8, 4.2, '#a8884a'); g.ring(8, 8, 3.2, '#c8a868'); g.ring(8, 8, 2.2, '#a8884a'); g.line(12, 11, 14, 14, '#c8a868'); },
    scrap: g => { g.rect(3, 7, 6, 4, '#8a8e96'); g.hl(3, 7, 6, '#b0b4bc'); g.line(6, 4, 12, 9, '#6a6e76'); g.line(7, 4, 13, 9, '#a8acb4'); g.set(4, 8, '#a8582a'); g.set(7, 10, '#a8582a'); g.rect(9, 10, 4, 3, '#7a7e86'); g.set(10, 11, '#b8682a'); },
    tape: g => { g.disc(8, 8, 5.6, '#a8acb4'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 8, y + 0.5 - 8) < 2.6) g.clr(x, y); g.ring(8, 8, 5, '#c8ccd4'); g.ring(8, 8, 2.8, '#7a7e86'); },
    gas: g => { g.rect(3, 4, 10, 10, '#c82a2a'); g.vl(3, 4, 10, '#e84a4a'); g.vl(12, 4, 10, '#9a1a1a'); g.line(5, 6, 10, 11, '#a82020'); g.line(10, 6, 5, 11, '#a82020'); g.rect(5, 2, 5, 2, '#9a1a1a'); g.rect(11, 2, 2, 2, '#e8c030'); },
    battery: g => { g.rect(3, 6, 9, 5, '#2a2a30'); g.rect(3, 6, 4, 5, '#d8a030'); g.hl(3, 6, 9, '#5a5a66'); g.hl(3, 6, 4, '#f0c050'); g.rect(12, 7, 2, 3, '#c8ccd0'); g.set(9, 8, '#e8e8e8'); },
    rod: g => { g.line(2, 14, 14, 1, '#5a3a22'); g.line(3, 14, 14, 2, '#8a5e36'); g.disc(5, 11, 1.7, '#7a7e86'); g.set(5, 11, '#c8ccd0'); g.line(14, 1, 14, 8, '#e8e8e8'); g.set(13, 9, '#c8ccd0'); g.set(14, 9, '#c8ccd0'); },
    flashlight: g => { g.rect(2, 6, 8, 4, '#2a2c32'); g.hl(2, 6, 8, '#4a4e56'); g.vl(4, 6, 4, '#1a1c20'); g.vl(6, 6, 4, '#1a1c20'); g.rect(10, 5, 3, 6, '#3a3e46'); g.hl(10, 5, 3, '#5a5e66'); g.vl(13, 6, 4, '#fff4a0'); g.set(8, 5, '#d83030'); },
    saw: g => { g.rect(5, 5, 9, 5, '#c8ccd4'); g.clr(13, 5); g.clr(13, 6); g.clr(12, 5); for (let i = 0; i < 5; i++) g.set(5 + i * 2, 10, '#8a8e96'); g.hl(5, 5, 7, '#eef0f4'); g.rect(1, 4, 4, 7, '#a8703e'); g.vl(1, 4, 7, '#c8905a'); g.clr(2, 6); g.clr(3, 6); g.clr(2, 7); g.clr(3, 7); g.clr(2, 8); g.clr(3, 8); },
    lighter: g => { g.rect(5, 5, 6, 9, '#2a6ad0'); g.vl(5, 5, 9, '#4a8af0'); g.vl(10, 5, 9, '#1a4aa0'); g.rect(5, 3, 6, 2, '#c8ccd0'); g.set(9, 2, '#7a7e86'); g.set(10, 2, '#7a7e86'); g.set(6, 3, '#eef0f4'); },
    sleepbag: g => { g.rect(2, 5, 12, 7, '#4a7a4a'); g.hl(2, 5, 12, '#6a9a6a'); g.hl(2, 11, 12, '#2e522e'); g.oval(13, 8.5, 2, 3.5, '#3a6a3a'); g.ring(13, 8.5, 1.5, '#2a4a2a'); g.vl(5, 5, 7, '#26262a'); g.vl(10, 5, 7, '#26262a'); },
    campfire: g => { g.thick(2, 13, 13, 9, W3, 2); g.thick(3, 9, 13, 13, W2, 2); g.oval(8, 7, 3, 4, '#ff8a20'); g.oval(8, 8, 1.6, 2.4, '#ffe060'); g.set(8, 2, '#e04a1a'); g.set(1, 14, '#8a8a90'); g.set(14, 14, '#8a8a90'); },
    barricade: g => { g.rect(1, 4, 14, 3, W1); g.hl(1, 4, 14, '#e4b47e'); g.rect(1, 10, 14, 3, W2); g.hl(1, 10, 14, W1); g.thick(3, 13, 12, 3, W3, 2); g.set(2, 5, M2); g.set(13, 11, M2); g.set(13, 5, M2); g.set(2, 11, M2); },
    box: g => { g.rect(2, 5, 12, 9, '#8a5a32'); g.rect(2, 5, 12, 3, '#a8744a'); g.hl(2, 5, 12, '#c4905e'); g.hl(2, 8, 12, '#5a3a1e'); g.vl(4, 5, 9, '#6a6a72'); g.vl(11, 5, 9, '#6a6a72'); g.rect(7, 8, 2, 2, '#e8c050'); },
    seed_potato: g => { packet(g); g.oval(8, 9.5, 3.2, 2.4, '#a87a48'); g.set(7, 9, '#c8985e'); g.set(9, 10, '#6a4a28'); },
    seed_carrot: g => { packet(g); g.line(6, 12, 9, 8, '#e8782a'); g.line(7, 12, 10, 8, '#e8782a'); g.line(10, 8, 11, 6, '#4a9a3a'); g.line(10, 8, 12, 8, '#4a9a3a'); },
    schoolbag: g => { g.rect(3, 3, 10, 11, '#2e5aa8'); g.vl(3, 3, 11, '#4a7ac8'); g.vl(12, 3, 11, '#1e3e78'); g.clr(3, 3); g.clr(12, 3); g.rect(5, 8, 6, 5, '#264a8a'); g.hl(5, 8, 6, '#3a66b0'); g.hl(5, 9, 6, '#c8c8c8'); g.rect(6, 1, 4, 2, '#1e3e78'); g.hl(7, 2, 2, null); },
    hikingbag: g => { g.rect(3, 4, 10, 10, '#4a6a3a'); g.vl(3, 4, 10, '#6a8a52'); g.vl(12, 4, 10, '#344a28'); g.rect(3, 1, 10, 3, '#a8743a'); g.hl(3, 1, 10, '#c8945a'); g.rect(5, 9, 6, 4, '#3a5a2c'); g.hl(5, 9, 6, '#4e7040'); g.vl(5, 4, 5, '#2a2a2a'); g.vl(10, 4, 5, '#2a2a2a'); },
    jacket: g => { g.rect(4, 3, 8, 11, '#5a3a26'); g.rect(1, 4, 3, 8, '#5a3a26'); g.rect(12, 4, 3, 8, '#5a3a26'); g.rect(5, 2, 2, 2, '#4a2e1c'); g.rect(9, 2, 2, 2, '#4a2e1c'); g.vl(8, 4, 10, '#c8c8c8'); g.vl(5, 4, 9, '#7a5236'); g.vl(2, 5, 6, '#7a5236'); g.vl(11, 4, 9, '#44301e'); },
    vest: g => { g.rect(4, 3, 8, 11, '#2e3442'); g.rect(3, 5, 1, 7, '#2e3442'); g.rect(12, 5, 1, 7, '#2e3442'); g.clr(7, 3); g.clr(8, 3); g.clr(7, 4); g.clr(8, 4); g.rect(5, 8, 2, 3, '#3e4656'); g.rect(9, 8, 2, 3, '#3e4656'); g.hl(4, 6, 8, '#22262e'); g.hl(5, 12, 6, '#e8e8e8'); g.vl(4, 4, 9, '#454c5e'); },
  };

  Art.icon = {};
  Art.buildIcons = function () {
    for (const id in ITEMS) {
      const g = new PG(16, 16);
      (I[id] || (g2 => { g2.rect(4, 4, 8, 8, '#ff00ff'); }))(g);
      g.outline();
      const cv = g.canvas();
      Art.icon[id] = { c: cv, url: cv.toDataURL(), pg: g };
    }
  };

  /* UI 아이콘 */
  const U = {
    hp: g => { g.disc(4, 4.5, 2.6, '#d83030'); g.disc(8, 4.5, 2.6, '#d83030'); g.rect(2, 5, 9, 2, '#d83030'); g.rect(3, 7, 7, 1, '#d83030'); g.rect(4, 8, 5, 1, '#d83030'); g.rect(5, 9, 3, 1, '#d83030'); g.set(6, 10, '#d83030'); g.set(3, 3, '#ff8a8a'); g.set(4, 3, '#ff6060'); },
    hunger: g => { g.oval(5, 5, 3.2, 3.6, '#c8843a'); g.oval(4.5, 4.5, 2, 2.2, '#e0a050'); g.thick(7, 7, 9, 9, '#f0ead8', 2); g.set(10, 10, '#f0ead8'); g.set(10, 8, '#f0ead8'); g.set(8, 10, '#f0ead8'); },
    thirst: g => { g.set(6, 1, '#4fa3d1'); g.rect(5, 2, 3, 2, '#4fa3d1'); g.disc(6.5, 7, 3.5, '#4fa3d1'); g.set(5, 5, '#a8e0ff'); g.set(4, 6, '#a8e0ff'); },
    sleep: g => { g.disc(6, 6, 4.5, '#d8c870'); g.disc(8, 4.5, 3.8, null); for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (Math.hypot(x + 0.5 - 8.4, y + 0.5 - 4.2) < 3.6) g.clr(x, y); g.set(3, 5, '#fff4b0'); },
    stamina: g => { g.line(8, 1, 4, 7, '#ffd040'); g.line(7, 1, 3, 7, '#ffd040'); g.hl(3, 7, 6, '#ffd040'); g.line(8, 7, 5, 11, '#ffd040'); g.line(7, 7, 4, 11, '#ffd040'); },
    bleed: g => { g.set(6, 1, '#c01818'); g.rect(5, 2, 3, 2, '#c01818'); g.disc(6.5, 7, 3.5, '#c01818'); g.set(5, 5, '#ff6a6a'); },
    sick: g => { g.disc(6, 6, 4.6, '#7aaa3a'); g.set(4, 5, '#1e2a10'); g.set(8, 5, '#1e2a10'); g.hl(4, 8, 5, '#1e2a10'); g.set(3, 3, '#aad86a'); g.set(5, 9, '#c8f06a'); },
    sun: g => { g.disc(6, 6, 3, '#ffd040'); g.set(5, 5, '#fff4b0'); for (let a = 0; a < 8; a++) g.set(Math.round(6 + Math.cos(a * TAU / 8) * 5), Math.round(6 + Math.sin(a * TAU / 8) * 5), '#ffd040'); },
    moon: g => { g.disc(6, 6, 4.4, '#e0e4f0'); for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (Math.hypot(x + 0.5 - 8.4, y + 0.5 - 4.4) < 3.4) g.clr(x, y); g.set(3, 6, '#ffffff'); },
    armor: g => { g.rect(2, 2, 9, 5, '#8a96a8'); g.rect(3, 7, 7, 2, '#8a96a8'); g.rect(4, 9, 5, 1, '#8a96a8'); g.set(6, 10, '#8a96a8'); g.vl(3, 3, 5, '#b8c4d4'); g.hl(3, 2, 7, '#b8c4d4'); },
  };
  const B = { // 16x16 버튼 아이콘
    fist: g => { g.rect(4, 5, 9, 7, '#e8b48c'); g.hl(4, 5, 9, '#f8d0b0'); for (const x of [6, 8, 10]) g.vl(x, 5, 3, '#c98f68'); g.rect(2, 7, 3, 4, '#e8b48c'); g.hl(4, 11, 9, '#c98f68'); g.rect(5, 12, 6, 2, '#5a6b3a'); },
    hand: g => { g.rect(5, 6, 7, 7, '#e8b48c'); for (let i = 0; i < 4; i++) { g.rect(5 + i * 2, 2 + (i === 0 || i === 3 ? 1 : 0), 1, 5, '#e8b48c'); } g.rect(2, 7, 3, 2, '#e8b48c'); g.set(1, 6, '#e8b48c'); g.hl(5, 12, 7, '#c98f68'); g.rect(6, 13, 5, 2, '#5a6b3a'); },
    run: g => { g.rect(4, 7, 8, 4, '#d8d8d8'); g.rect(10, 9, 4, 2, '#d8d8d8'); g.hl(4, 11, 10, '#3a3a3a'); g.hl(4, 7, 6, '#ffffff'); g.rect(4, 4, 4, 3, '#d8d8d8'); for (const y of [5, 8, 11]) g.hl(0, y, 3, '#ffd040'); },
    bag: g => { g.rect(3, 4, 10, 10, '#7a5a36'); g.vl(3, 4, 10, '#98744a'); g.vl(12, 4, 10, '#5a4026'); g.rect(5, 9, 6, 4, '#5a4026'); g.hl(5, 9, 6, '#98744a'); g.rect(6, 1, 4, 3, '#5a4026'); g.clr(7, 2); g.clr(8, 2); },
    craft: g => { g.thick(3, 13, 9, 7, '#a8743e', 2); g.thick(8, 3, 12, 7, '#848c96', 3); g.line(8, 3, 12, 7, '#bcc4cc'); },
    map: g => { g.rect(2, 3, 12, 10, '#d8c8a0'); g.vl(6, 3, 10, '#b8a880'); g.vl(10, 3, 10, '#b8a880'); g.line(3, 10, 8, 6, '#c83030'); g.line(8, 6, 12, 8, '#c83030'); g.set(12, 8, '#c83030'); g.set(4, 5, '#5a9a44'); g.set(11, 11, '#4fa3d1'); },
    pause: g => { g.rect(4, 3, 3, 10, '#e8e4d4'); g.rect(9, 3, 3, 10, '#e8e4d4'); },
    light: g => { g.rect(2, 6, 7, 4, '#3a3e46'); g.rect(9, 5, 3, 6, '#4a4e56'); for (let i = 0; i < 4; i++) g.vl(12 + i, 6 - i, 4 + i * 2, [255, 244, 160, 200 - i * 40]); },
    reload: g => { g.rect(6, 5, 4, 8, '#d8a840'); g.vl(6, 5, 8, '#f4cc66'); g.rect(6, 3, 4, 2, '#c07030'); g.ring(8, 8, 6.4, '#e8e4d4'); },
    close: g => { g.thick(3, 3, 12, 12, '#e8e4d4', 2); g.thick(3, 12, 12, 3, '#e8e4d4', 2); },
  };
  Art.ui = {}; Art.btn = {};
  Art.buildUiIcons = function () {
    for (const k in U) { const g = new PG(13, 13); U[k](g); g.outline(); Art.ui[k] = g.url(); }
    for (const k in B) { const g = new PG(16, 16); B[k](g); g.outline(); Art.btn[k] = g.url(); }
  };
})();
