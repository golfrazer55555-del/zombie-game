'use strict';
/* ===== 게임 데이터: 아이템, 제작법, 전리품, 좀비, 설정 ===== */

// cat: melee gun ammo throw food med mat tool place seed wear
// hold: 손에 들었을 때 아이콘 회전 기준 (a: 아이콘이 향한 각도, gx/gy: 손잡이 위치)
const DIAG = -Math.PI / 4;
const ITEMS = {
  // ── 근접 무기 ──
  knife:    { name: '식칼', cat: 'melee', stack: 1, dur: 60, desc: '가볍고 빠르다. 날이 쉽게 상한다.', melee: { dmg: 15, range: 16, arc: 1.0, cd: 0.34, kb: 40, stam: 4, targets: 1, kind: 'blade' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  bat:      { name: '야구방망이', cat: 'melee', stack: 1, dur: 80, desc: '넓게 휘둘러 좀비를 밀쳐낸다.', melee: { dmg: 22, range: 21, arc: 1.7, cd: 0.6, kb: 150, stam: 9, targets: 2, kind: 'blunt' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  nailbat:  { name: '못 박힌 방망이', cat: 'melee', stack: 1, dur: 90, desc: '못을 박아 살상력을 높인 방망이.', melee: { dmg: 33, range: 21, arc: 1.7, cd: 0.62, kb: 150, stam: 9, targets: 2, kind: 'blunt' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  pan:      { name: '프라이팬', cat: 'melee', stack: 1, dur: 150, desc: '튼튼하다. 맞으면 꽤 아프다.', melee: { dmg: 18, range: 17, arc: 1.4, cd: 0.55, kb: 170, stam: 8, targets: 1, kind: 'metal' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  crowbar:  { name: '쇠지렛대', cat: 'melee', stack: 1, dur: 220, desc: '거의 부서지지 않는 믿음직한 쇠막대.', melee: { dmg: 25, range: 20, arc: 1.3, cd: 0.55, kb: 110, stam: 8, targets: 1, kind: 'metal' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  axe:      { name: '도끼', cat: 'melee', stack: 1, dur: 130, desc: '강력하지만 느리다. 나무를 벨 수 있다.', melee: { dmg: 42, range: 21, arc: 1.3, cd: 0.82, kb: 120, stam: 12, targets: 1, kind: 'blade', chop: 2 }, hold: { a: DIAG, gx: 3, gy: 12 } },
  stoneaxe: { name: '돌도끼', cat: 'melee', stack: 1, dur: 45, desc: '직접 만든 도끼. 나무를 벨 수 있다.', melee: { dmg: 18, range: 18, arc: 1.2, cd: 0.7, kb: 80, stam: 10, targets: 1, kind: 'blunt', chop: 1 }, hold: { a: DIAG, gx: 3, gy: 12 } },
  machete:  { name: '마체테', cat: 'melee', stack: 1, dur: 110, desc: '길고 날카로운 칼. 빠르고 강하다.', melee: { dmg: 31, range: 21, arc: 1.5, cd: 0.5, kb: 70, stam: 8, targets: 2, kind: 'blade' }, hold: { a: DIAG, gx: 3, gy: 12 } },
  spear:    { name: '나무 창', cat: 'melee', stack: 1, dur: 40, desc: '멀리서 찌를 수 있다.', melee: { dmg: 21, range: 30, arc: 0.5, cd: 0.55, kb: 80, stam: 7, targets: 2, kind: 'pierce', thrust: true }, hold: { a: DIAG, gx: 2, gy: 13 } },
  hammer:   { name: '망치', cat: 'melee', stack: 1, dur: 140, desc: '바리케이드 제작과 수리에 필요하다.', melee: { dmg: 14, range: 16, arc: 1.2, cd: 0.5, kb: 90, stam: 6, targets: 1, kind: 'metal' }, hold: { a: DIAG, gx: 3, gy: 12 }, tool: 'hammer' },
  torch:    { name: '횃불', cat: 'tool', stack: 1, dur: 100, desc: '들고 있으면 주변을 밝힌다. 서서히 타들어간다.', melee: { dmg: 9, range: 17, arc: 1.2, cd: 0.55, kb: 60, stam: 6, targets: 1, kind: 'fire', burn: true }, hold: { a: DIAG, gx: 4, gy: 12 }, tool: 'torch', nodur: true },
  // ── 원거리 무기 ──
  pistol:   { name: '권총', cat: 'gun', stack: 1, desc: '강력하지만 총성이 멀리 퍼진다.', gun: { dmg: 32, pellets: 1, spread: 0.05, cd: 0.28, mag: 12, reload: 1.4, range: 230, ammo: 'ammo9', noise: 24, pierce: 1, shake: 2.5, snd: 'pistol' }, hold: { a: 0, gx: 4, gy: 9 } },
  shotgun:  { name: '산탄총', cat: 'gun', stack: 1, desc: '가까운 좀비 무리를 쓸어버린다. 엄청 시끄럽다.', gun: { dmg: 17, pellets: 7, spread: 0.32, cd: 0.9, mag: 6, reload: 2.4, range: 150, ammo: 'shell', noise: 32, pierce: 1, shake: 5, snd: 'shotgun' }, hold: { a: 0, gx: 4, gy: 9 } },
  rifle:    { name: '사냥 소총', cat: 'gun', stack: 1, desc: '한 발로 여러 좀비를 꿰뚫는다.', gun: { dmg: 85, pellets: 1, spread: 0.01, cd: 1.1, mag: 5, reload: 2.2, range: 380, ammo: 'ammo762', noise: 36, pierce: 3, shake: 4, snd: 'rifle' }, hold: { a: 0, gx: 4, gy: 9 } },
  bow:      { name: '활', cat: 'gun', stack: 1, desc: '조용하다. 화살은 다시 주울 수 있다.', gun: { dmg: 40, pellets: 1, spread: 0.03, cd: 0.85, mag: 1, reload: 0.5, range: 230, ammo: 'arrow', noise: 1.5, pierce: 1, shake: 0.5, snd: 'bow', proj: 380 }, hold: { a: 0, gx: 9, gy: 8 } },
  // ── 탄약 ──
  ammo9:    { name: '9mm 탄', cat: 'ammo', stack: 60, desc: '권총 탄약.' },
  shell:    { name: '산탄', cat: 'ammo', stack: 30, desc: '산탄총 탄약.' },
  ammo762:  { name: '소총탄', cat: 'ammo', stack: 30, desc: '사냥 소총 탄약.' },
  arrow:    { name: '화살', cat: 'ammo', stack: 30, desc: '활에 쓰는 화살.' },
  // ── 투척 ──
  bottle:   { name: '빈 병', cat: 'throw', stack: 10, desc: '물을 담을 수 있다. 던지면 깨지는 소리로 좀비를 유인한다.', throw: 'bottle' },
  molotov:  { name: '화염병', cat: 'throw', stack: 5, desc: '던지면 불바다가 된다.', throw: 'molotov' },
  firecracker: { name: '폭죽', cat: 'throw', stack: 5, desc: '오랫동안 요란한 소리를 내 좀비를 끌어모은다.', throw: 'firecracker' },
  // ── 음식·음료 (h: 배고픔, t: 갈증, e: 피로, sick: 병 걸릴 확률) ──
  beans:    { name: '통조림', cat: 'food', stack: 6, desc: '든든한 콩 통조림.', food: { h: 34, t: -3 } },
  tuna:     { name: '참치캔', cat: 'food', stack: 6, desc: '기름진 참치.', food: { h: 26, t: -4 } },
  chips:    { name: '과자', cat: 'food', stack: 8, desc: '짭짤하다. 목이 마른다.', food: { h: 14, t: -6 } },
  chocobar: { name: '초코바', cat: 'food', stack: 8, desc: '달콤한 에너지.', food: { h: 12, e: 4 } },
  bread:    { name: '빵', cat: 'food', stack: 6, desc: '조금 딱딱해졌다.', food: { h: 24 } },
  ramen:    { name: '라면', cat: 'food', stack: 8, desc: '그냥 씹어 먹을 수도 있지만 끓이면 훨씬 낫다.', food: { h: 18, t: -8 } },
  ramen_cooked: { name: '끓인 라면', cat: 'food', stack: 4, desc: '뜨끈한 국물. 최고의 사치.', food: { h: 46, t: 12, e: 6 } },
  apple:    { name: '사과', cat: 'food', stack: 8, desc: '아삭하다.', food: { h: 11, t: 7 } },
  berries:  { name: '산딸기', cat: 'food', stack: 12, desc: '덤불에서 딴 열매.', food: { h: 6, t: 3 } },
  fish:     { name: '생선', cat: 'food', stack: 6, desc: '날로 먹으면 탈이 날 수 있다.', food: { h: 13, sick: 0.45 } },
  fish_cooked: { name: '구운 생선', cat: 'food', stack: 6, desc: '노릇하게 구운 생선.', food: { h: 36, t: -2 } },
  potato:   { name: '감자', cat: 'food', stack: 10, desc: '날감자는 맛이 없다.', food: { h: 8, sick: 0.15 } },
  potato_cooked: { name: '구운 감자', cat: 'food', stack: 10, desc: '포슬포슬하다.', food: { h: 26 } },
  carrot:   { name: '당근', cat: 'food', stack: 10, desc: '생으로 먹어도 괜찮다.', food: { h: 10, t: 4 } },
  soup:     { name: '채소 수프', cat: 'food', stack: 4, desc: '몸이 따뜻해진다.', food: { h: 50, t: 22, e: 5 } },
  water:    { name: '생수', cat: 'food', stack: 6, desc: '깨끗한 물.', food: { t: 42, ret: 'bottle' }, drink: true },
  soda:     { name: '탄산음료', cat: 'food', stack: 6, desc: '미지근하지만 달다.', food: { t: 26, h: 4 }, drink: true },
  coffee:   { name: '캔커피', cat: 'food', stack: 6, desc: '잠이 조금 깬다.', food: { t: 12, e: 18 }, drink: true },
  water_dirty: { name: '흙탕물', cat: 'food', stack: 6, desc: '마시면 병에 걸릴 수 있다. 끓여 마시자.', food: { t: 30, sick: 0.55, ret: 'bottle' }, drink: true },
  water_clean: { name: '끓인 물', cat: 'food', stack: 6, desc: '끓여서 안전한 물.', food: { t: 38, ret: 'bottle' }, drink: true },
  // ── 의료 ──
  bandage:  { name: '붕대', cat: 'med', stack: 10, desc: '출혈을 멈추고 체력을 조금 회복한다.', med: { hp: 8, bleed: true } },
  painkiller: { name: '진통제', cat: 'med', stack: 10, desc: '서서히 체력을 회복한다.', med: { hot: 28 } },
  firstaid: { name: '구급상자', cat: 'med', stack: 4, desc: '큰 상처도 치료한다.', med: { hp: 45, bleed: true } },
  antibiotic: { name: '항생제', cat: 'med', stack: 10, desc: '병을 치료한다.', med: { cure: true } },
  // ── 재료 ──
  stick:    { name: '나뭇가지', cat: 'mat', stack: 20, desc: '숲 바닥이나 덤불에서 구할 수 있다.' },
  log:      { name: '통나무', cat: 'mat', stack: 10, desc: '도끼로 나무를 베어 얻는다.' },
  plank:    { name: '판자', cat: 'mat', stack: 20, desc: '건설 재료.' },
  stone:    { name: '돌', cat: 'mat', stack: 20, desc: '숲 바닥에서 주울 수 있다.' },
  rag:      { name: '천 조각', cat: 'mat', stack: 20, desc: '붕대, 끈, 횃불의 재료.' },
  cloth:    { name: '헌 옷', cat: 'mat', stack: 10, desc: '찢으면 천 조각이 된다.' },
  nails:    { name: '못', cat: 'mat', stack: 40, desc: '건설에 쓰인다.' },
  rope:     { name: '끈', cat: 'mat', stack: 20, desc: '여러 도구를 만드는 데 쓰인다.' },
  scrap:    { name: '고철', cat: 'mat', stack: 20, desc: '쓸모가 있을지도 모른다.' },
  tape:     { name: '청테이프', cat: 'mat', stack: 10, desc: '무기를 수리할 수 있다.', repair: 30 },
  gas:      { name: '휘발유', cat: 'mat', stack: 5, desc: '화염병의 재료.' },
  battery:  { name: '배터리', cat: 'mat', stack: 10, desc: '사용하면 손전등을 충전한다.', battery: true },
  // ── 도구 ──
  rod:      { name: '낚싯대', cat: 'tool', stack: 1, dur: 60, desc: '물가에서 사용해 물고기를 낚는다.', tool: 'rod', hold: { a: DIAG, gx: 2, gy: 13 } },
  flashlight: { name: '손전등', cat: 'tool', stack: 1, dur: 100, desc: '밤에 앞을 밝힌다. 좀비 눈에도 잘 띈다.', tool: 'flashlight', hold: { a: 0, gx: 3, gy: 8 }, nodur: true },
  saw:      { name: '톱', cat: 'tool', stack: 1, dur: 80, desc: '통나무를 판자로 켠다.', tool: 'saw', hold: { a: DIAG, gx: 3, gy: 12 } },
  lighter:  { name: '라이터', cat: 'tool', stack: 1, dur: 30, desc: '불을 붙인다.', tool: 'lighter' },
  sleepbag: { name: '침낭', cat: 'tool', stack: 1, desc: '어디서든 잠을 잘 수 있다.', tool: 'sleepbag' },
  // ── 설치물 ──
  campfire: { name: '모닥불', cat: 'place', stack: 3, desc: '요리하고 물을 끓인다. 밤을 밝힌다.', place: 'campfire' },
  barricade: { name: '바리케이드', cat: 'place', stack: 5, desc: '길목을 막는다. 깨진 창문이나 문틀에도 설치할 수 있다.', place: 'barricade' },
  box:      { name: '보관함', cat: 'place', stack: 3, desc: '물건을 보관한다.', place: 'box' },
  // ── 씨앗 ──
  seed_potato: { name: '감자 씨앗', cat: 'seed', stack: 20, desc: '풀밭이나 흙에 심는다. 하루 반 뒤에 수확.', seed: 'potato' },
  seed_carrot: { name: '당근 씨앗', cat: 'seed', stack: 20, desc: '풀밭이나 흙에 심는다. 하루 반 뒤에 수확.', seed: 'carrot' },
  // ── 장비 ──
  schoolbag: { name: '책가방', cat: 'wear', stack: 1, desc: '가방 칸 +6', wear: { slot: 'bag', slots: 6 } },
  hikingbag: { name: '등산 배낭', cat: 'wear', stack: 1, desc: '가방 칸 +12', wear: { slot: 'bag', slots: 12 } },
  jacket:   { name: '가죽 재킷', cat: 'wear', stack: 1, desc: '받는 피해 20% 감소', wear: { slot: 'body', armor: 0.2 } },
  vest:     { name: '방탄 조끼', cat: 'wear', stack: 1, desc: '받는 피해 35% 감소', wear: { slot: 'body', armor: 0.35 } },
};
for (const id in ITEMS) ITEMS[id].id = id;

const CAT_NAME = { melee: '근접 무기', gun: '원거리 무기', ammo: '탄약', throw: '투척', food: '음식', med: '의료', mat: '재료', tool: '도구', place: '설치물', seed: '씨앗', wear: '장비' };

// 제작법: need=[[id,n]], tools=[[대체 가능한 도구들]], fire=모닥불 근처 필요, ret=부산물
const RECIPES = [
  { out: 'rag', n: 3, cat: 'basic', need: [['cloth', 1]] },
  { out: 'rope', n: 1, cat: 'basic', need: [['rag', 3]] },
  { out: 'bandage', n: 1, cat: 'med', need: [['rag', 2]] },
  { out: 'plank', n: 2, cat: 'basic', need: [['log', 1]], tools: [['saw', 'axe', 'stoneaxe']] },
  { out: 'torch', n: 1, cat: 'tool', need: [['stick', 1], ['rag', 1]], tools: [['lighter']] },
  { out: 'campfire', n: 1, cat: 'build', need: [['log', 2], ['stone', 4], ['stick', 2]], tools: [['lighter']] },
  { out: 'barricade', n: 1, cat: 'build', need: [['plank', 3], ['nails', 4]], tools: [['hammer']] },
  { out: 'box', n: 1, cat: 'build', need: [['plank', 4], ['nails', 4]], tools: [['hammer']] },
  { out: 'sleepbag', n: 1, cat: 'tool', need: [['rag', 6], ['rope', 2]] },
  { out: 'rod', n: 1, cat: 'tool', need: [['stick', 2], ['rope', 2], ['nails', 1]] },
  { out: 'stoneaxe', n: 1, cat: 'weapon', need: [['stick', 2], ['stone', 2], ['rope', 1]] },
  { out: 'spear', n: 1, cat: 'weapon', need: [['stick', 3], ['stone', 1], ['rope', 1]] },
  { out: 'nailbat', n: 1, cat: 'weapon', need: [['bat', 1], ['nails', 6]], tools: [['hammer']] },
  { out: 'bow', n: 1, cat: 'weapon', need: [['stick', 3], ['rope', 2]] },
  { out: 'arrow', n: 5, cat: 'weapon', need: [['stick', 3], ['stone', 1]] },
  { out: 'molotov', n: 1, cat: 'weapon', need: [['bottle', 1], ['gas', 1], ['rag', 1]] },
  { out: 'fish_cooked', n: 1, cat: 'cook', need: [['fish', 1]], fire: true },
  { out: 'water_clean', n: 1, cat: 'cook', need: [['water_dirty', 1]], fire: true },
  { out: 'potato_cooked', n: 1, cat: 'cook', need: [['potato', 1]], fire: true },
  { out: 'ramen_cooked', n: 1, cat: 'cook', need: [['ramen', 1], ['water_clean', 1]], fire: true, ret: [['bottle', 1]] },
  { out: 'soup', n: 1, cat: 'cook', need: [['potato', 1], ['carrot', 1], ['water_clean', 1]], fire: true, ret: [['bottle', 1]] },
];
RECIPES.forEach((r, i) => { r.id = i; });
const RECIPE_CATS = [['all', '전체'], ['basic', '재료'], ['weapon', '무기'], ['tool', '도구'], ['build', '건설'], ['med', '의료'], ['cook', '요리']];

// 전리품 테이블: [id, 가중치, 최소, 최대]
const LOOT = {
  fridge:   { rolls: [1, 3], empty: 0.2, items: [['water', 4, 1, 2], ['soda', 4, 1, 2], ['apple', 3, 1, 2], ['bread', 2, 1, 1], ['carrot', 1.5, 1, 3], ['potato', 1.5, 1, 3], ['coffee', 2, 1, 1], ['beans', 1, 1, 1]] },
  cabinet:  { rolls: [1, 3], empty: 0.25, items: [['beans', 4, 1, 2], ['tuna', 3, 1, 2], ['ramen', 4, 1, 3], ['chips', 2, 1, 2], ['knife', 1.2, 1, 1], ['pan', 0.9, 1, 1], ['bottle', 3, 1, 2], ['lighter', 1, 1, 1], ['water', 1, 1, 1]] },
  drawer:   { rolls: [1, 2], empty: 0.3, items: [['cloth', 4, 1, 2], ['rag', 3, 1, 3], ['battery', 2, 1, 2], ['tape', 1.5, 1, 1], ['lighter', 1.5, 1, 1], ['bandage', 1, 1, 2], ['painkiller', 1, 1, 2], ['chocobar', 1, 1, 2], ['rope', 1.5, 1, 1], ['ammo9', 0.3, 3, 8], ['flashlight', 0.6, 1, 1], ['firecracker', 0.4, 1, 2]] },
  wardrobe: { rolls: [1, 2], empty: 0.25, items: [['cloth', 6, 1, 3], ['jacket', 0.7, 1, 1], ['schoolbag', 0.9, 1, 1], ['hikingbag', 0.3, 1, 1], ['rag', 2, 1, 2], ['bat', 0.6, 1, 1]] },
  medicine: { rolls: [1, 2], empty: 0.3, items: [['bandage', 3, 1, 3], ['painkiller', 2, 1, 2], ['antibiotic', 1.2, 1, 1], ['rag', 2, 1, 2], ['firstaid', 0.3, 1, 1]] },
  sofa:     { rolls: [1, 1], empty: 0.65, items: [['lighter', 2, 1, 1], ['chocobar', 2, 1, 1], ['battery', 2, 1, 1], ['chips', 1, 1, 1], ['ammo9', 0.4, 2, 5]] },
  books:    { rolls: [1, 1], empty: 0.75, items: [['rag', 2, 1, 2], ['lighter', 1, 1, 1], ['seed_potato', 0.6, 1, 2], ['seed_carrot', 0.6, 1, 2]] },
  desk:     { rolls: [1, 2], empty: 0.35, items: [['battery', 3, 1, 2], ['tape', 2, 1, 1], ['painkiller', 1.5, 1, 1], ['chocobar', 1.5, 1, 1], ['coffee', 1.5, 1, 1], ['ammo9', 0.8, 3, 8], ['flashlight', 0.7, 1, 1]] },
  workbench:{ rolls: [1, 3], empty: 0.2, items: [['hammer', 1.5, 1, 1], ['saw', 1.2, 1, 1], ['nails', 4, 4, 12], ['tape', 2, 1, 2], ['scrap', 2, 1, 3], ['crowbar', 0.9, 1, 1], ['axe', 0.6, 1, 1], ['rope', 1.5, 1, 2], ['flashlight', 1, 1, 1], ['plank', 1.5, 2, 4]] },
  mart:     { rolls: [1, 3], empty: 0.22, items: [['chips', 4, 1, 3], ['chocobar', 4, 1, 3], ['water', 4, 1, 2], ['soda', 4, 1, 2], ['ramen', 4, 1, 3], ['beans', 2, 1, 2], ['tuna', 2, 1, 2], ['coffee', 2, 1, 2], ['battery', 1.5, 1, 2], ['lighter', 1.5, 1, 1], ['firecracker', 0.9, 1, 2], ['bandage', 0.6, 1, 1]] },
  drinks:   { rolls: [1, 3], empty: 0.15, items: [['water', 5, 1, 3], ['soda', 5, 1, 3], ['coffee', 3, 1, 2]] },
  hardware: { rolls: [1, 3], empty: 0.2, items: [['nails', 4, 5, 15], ['plank', 2, 2, 5], ['hammer', 1, 1, 1], ['saw', 1, 1, 1], ['axe', 0.8, 1, 1], ['crowbar', 1, 1, 1], ['tape', 2, 1, 2], ['rope', 2, 1, 3], ['flashlight', 1, 1, 1], ['battery', 2, 1, 3], ['seed_potato', 1.2, 2, 4], ['seed_carrot', 1.2, 2, 4], ['machete', 0.4, 1, 1], ['gas', 0.6, 1, 1]] },
  pharmacy: { rolls: [1, 3], empty: 0.2, items: [['bandage', 4, 1, 3], ['painkiller', 3, 1, 3], ['antibiotic', 2, 1, 2], ['firstaid', 1, 1, 1], ['water', 1, 1, 1]] },
  police:   { rolls: [1, 2], empty: 0.3, items: [['pistol', 1, 1, 1], ['ammo9', 4, 6, 16], ['shotgun', 0.5, 1, 1], ['shell', 2, 3, 8], ['vest', 0.8, 1, 1], ['flashlight', 1.5, 1, 1], ['painkiller', 0.6, 1, 2], ['rifle', 0.2, 1, 1], ['ammo762', 0.5, 3, 6]] },
  register: { rolls: [1, 1], empty: 0.5, items: [['lighter', 2, 1, 1], ['battery', 2, 1, 2], ['chocobar', 1, 1, 1], ['firecracker', 1, 1, 2]] },
  crate:    { rolls: [1, 3], empty: 0.3, items: [['plank', 3, 2, 5], ['nails', 3, 4, 10], ['scrap', 3, 1, 3], ['rope', 2, 1, 2], ['beans', 1.5, 1, 3], ['water', 1.5, 1, 2], ['gas', 0.8, 1, 1], ['tape', 1, 1, 1], ['cloth', 1, 1, 2]] },
  trash:    { rolls: [1, 2], empty: 0.45, items: [['bottle', 4, 1, 2], ['rag', 2, 1, 2], ['scrap', 2, 1, 2], ['cloth', 1, 1, 1], ['chips', 0.6, 1, 1], ['battery', 0.4, 1, 1]] },
  car:      { rolls: [1, 2], empty: 0.35, items: [['gas', 1.5, 1, 1], ['water', 1.5, 1, 1], ['rag', 1, 1, 2], ['tape', 1, 1, 1], ['crowbar', 0.6, 1, 1], ['bat', 0.5, 1, 1], ['flashlight', 0.8, 1, 1], ['ammo9', 0.4, 3, 8], ['hikingbag', 0.2, 1, 1], ['chocobar', 1, 1, 2]] },
  policecar:{ rolls: [1, 2], empty: 0.3, items: [['ammo9', 3, 4, 10], ['shell', 1.5, 2, 6], ['flashlight', 1.5, 1, 1], ['bandage', 1, 1, 2], ['pistol', 0.4, 1, 1]] },
  vending:  { rolls: [1, 2], empty: 0.3, items: [['soda', 5, 1, 3], ['water', 3, 1, 2], ['coffee', 3, 1, 2], ['chocobar', 2, 1, 2]] },
  shed:     { rolls: [1, 3], empty: 0.2, items: [['seed_potato', 3, 2, 5], ['seed_carrot', 3, 2, 5], ['axe', 0.9, 1, 1], ['rope', 2, 1, 3], ['plank', 2, 2, 4], ['rod', 1, 1, 1], ['rifle', 0.25, 1, 1], ['ammo762', 0.7, 3, 6], ['gas', 1, 1, 1], ['nails', 2, 4, 10], ['saw', 0.7, 1, 1]] },
  cabin:    { rolls: [1, 3], empty: 0.2, items: [['rod', 1.5, 1, 1], ['beans', 2, 1, 2], ['water', 2, 1, 2], ['lighter', 1.5, 1, 1], ['rope', 2, 1, 2], ['bow', 0.5, 1, 1], ['arrow', 1, 3, 8], ['flashlight', 1, 1, 1], ['rag', 2, 1, 3], ['axe', 0.5, 1, 1]] },
  zombie:   { rolls: [1, 1], empty: 0.72, items: [['rag', 3, 1, 2], ['cloth', 2, 1, 1], ['chocobar', 1, 1, 1], ['bandage', 1, 1, 1], ['lighter', 0.7, 1, 1], ['battery', 0.7, 1, 1], ['ammo9', 0.4, 2, 6], ['water', 0.6, 1, 1], ['painkiller', 0.4, 1, 1]] },
};

// 가구/사물 정의 (loot: 전리품 테이블)
const FURN = {
  fridge:   { name: '냉장고', loot: 'fridge' },
  stove:    { name: '가스레인지' },
  counter:  { name: '찬장', loot: 'cabinet' },
  sink:     { name: '싱크대', loot: 'cabinet' },
  table:    { name: '식탁', w: 2 },
  sofa:     { name: '소파', w: 2, loot: 'sofa' },
  tv:       { name: 'TV' },
  bookshelf:{ name: '책장', loot: 'books' },
  drawer:   { name: '서랍장', loot: 'drawer' },
  wardrobe: { name: '옷장', loot: 'wardrobe' },
  bed:      { name: '침대', h: 2, bed: true },
  toilet:   { name: '변기' },
  bathtub:  { name: '욕조', w: 2 },
  medcab:   { name: '약장', loot: 'medicine' },
  shelf:    { name: '진열대', loot: 'mart' },
  register: { name: '계산대', loot: 'register' },
  drinkfridge: { name: '음료 냉장고', loot: 'drinks' },
  locker:   { name: '보관함', loot: 'police' },
  desk:     { name: '책상', loot: 'desk' },
  workbench:{ name: '작업대', w: 2, loot: 'workbench' },
  crate:    { name: '나무 상자', loot: 'crate' },
  trash:    { name: '쓰레기통', loot: 'trash' },
  dumpster: { name: '대형 쓰레기통', w: 2, loot: 'trash' },
  bench:    { name: '벤치', w: 2 },
  hydrant:  { name: '소화전' },
  mailbox:  { name: '우체통' },
  vending:  { name: '자판기', loot: 'vending' },
  gaspump:  { name: '주유기' },
  car:      { name: '자동차', loot: 'car' },
  policecar:{ name: '경찰차', loot: 'policecar' },
  carwreck: { name: '불탄 자동차' },
  haybale:  { name: '건초더미' },
};

const ZTYPES = {
  walker:  { name: '일반 좀비', hp: 55, spd: 23, dmg: 9, atk: 1.25, reach: 11, sight: 118, r: 4.5, mass: 1, stun: 0.32, sprite: 'walker' },
  runner:  { name: '빠른 좀비', hp: 38, spd: 66, dmg: 7, atk: 0.85, reach: 11, sight: 140, r: 4.5, mass: 0.8, stun: 0.35, sprite: 'runner' },
  brute:   { name: '덩치 큰 좀비', hp: 290, spd: 19, dmg: 24, atk: 1.7, reach: 15, sight: 110, r: 7.5, mass: 4, stun: 0.08, sprite: 'brute', breaker: 3.5 },
  crawler: { name: '기어다니는 좀비', hp: 32, spd: 11, dmg: 10, atk: 1.1, reach: 10, sight: 80, r: 5, mass: 0.7, stun: 0.4, sprite: 'crawler', grab: 1.5 },
};

// 게임 시작 전 설정 (난이도 곡선 없음: 시작할 때 정한 값이 끝까지 유지됨)
const OPTIONS = [
  { k: 'zCount', label: '좀비 수', vals: ['적음', '보통', '많음', '지옥'], def: 1 },
  { k: 'zSpeed', label: '좀비 속도', vals: ['느림', '보통', '빠름'], def: 1 },
  { k: 'zPower', label: '좀비 체력·공격력', vals: ['약함', '보통', '강함'], def: 1 },
  { k: 'runner', label: '빠른 좀비', vals: ['없음', '적음', '보통', '많음'], def: 2 },
  { k: 'brute', label: '덩치 큰 좀비', vals: ['없음', '적음', '보통', '많음'], def: 2 },
  { k: 'crawler', label: '기어다니는 좀비', vals: ['없음', '적음', '보통', '많음'], def: 2 },
  { k: 'respawn', label: '좀비 재생성', vals: ['끄기', '켜기'], def: 1 },
  { k: 'loot', label: '아이템 양', vals: ['희귀', '보통', '풍부'], def: 1 },
  { k: 'needs', label: '배고픔·갈증 속도', vals: ['느림', '보통', '빠름'], def: 1 },
  { k: 'dayLen', label: '하루 길이', vals: ['8분', '12분', '20분'], def: 1 },
  { k: 'start', label: '시작 물품', vals: ['없음', '기본', '넉넉'], def: 1 },
  { k: 'menuPause', label: '가방·제작 창을 열면', vals: ['시간 흐름', '일시정지'], def: 0 },
];
const PRESETS = [
  { name: '쉬움', v: { zCount: 0, zSpeed: 0, zPower: 0, runner: 1, brute: 1, crawler: 1, respawn: 1, loot: 2, needs: 0, start: 2 } },
  { name: '보통', v: { zCount: 1, zSpeed: 1, zPower: 1, runner: 2, brute: 2, crawler: 2, respawn: 1, loot: 1, needs: 1, start: 1 } },
  { name: '어려움', v: { zCount: 2, zSpeed: 1, zPower: 2, runner: 2, brute: 2, crawler: 2, respawn: 1, loot: 0, needs: 2, start: 1 } },
  { name: '악몽', v: { zCount: 3, zSpeed: 2, zPower: 2, runner: 3, brute: 3, crawler: 3, respawn: 1, loot: 0, needs: 2, start: 0 } },
];
function defaultSettings() {
  const s = {}; for (const o of OPTIONS) s[o.k] = o.def; s.look = 0; s.seed = ''; return s;
}
function deriveSettings(s) {
  return {
    zCount: [55, 120, 205, 320][s.zCount],
    zSpeed: [0.72, 1, 1.3][s.zSpeed],
    zHp: [0.7, 1, 1.4][s.zPower],
    zDmg: [0.7, 1, 1.4][s.zPower],
    wRunner: [0, 6, 13, 24][s.runner],
    wBrute: [0, 3, 6, 11][s.brute],
    wCrawler: [0, 6, 12, 20][s.crawler],
    respawn: s.respawn === 1,
    loot: [0.55, 1, 1.6][s.loot],
    needs: [0.65, 1, 1.45][s.needs],
    daySec: [8, 12, 20][s.dayLen] * 60,
    start: s.start,
    menuPause: s.menuPause === 1,
  };
}

// 플레이어 외형
const LOOKS = [
  { name: '민준', skin: '#e8b48c', skinS: '#c98f68', hair: '#4a2e1c', hairH: '#6e4628', top: '#5a6b3a', topH: '#71844a', topS: '#435229', pants: '#3a4660', pantsS: '#2c3549', shoe: '#3b2a20', shoeH: '#5a4030' },
  { name: '서연', skin: '#f0c4a0', skinS: '#d29e7c', hair: '#1e1a22', hairH: '#3a3440', top: '#a8343a', topH: '#c4484c', topS: '#80262c', pants: '#52525e', pantsS: '#3d3d47', shoe: '#2a2a30', shoeH: '#444450' },
  { name: '지호', skin: '#d6a07a', skinS: '#b58060', hair: '#c9a44a', hairH: '#e6c66a', top: '#35608c', topH: '#4878a6', topS: '#264869', pants: '#8a7a56', pantsS: '#6c5f42', shoe: '#4a3426', shoeH: '#664a36' },
  { name: '영수', skin: '#c88e68', skinS: '#a87050', hair: '#a8a8a8', hairH: '#cfcfcf', top: '#6e4a30', topH: '#86603e', topS: '#553824', pants: '#2e2e36', pantsS: '#222228', shoe: '#1e1e22', shoeH: '#38383e' },
];
