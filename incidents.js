(function (global) {
  'use strict';
  // 돌발 이벤트 (2026-11-09, docs/events-and-boss-recipes-v2.md ④).
  // One every 5-7 game days, up to 4 listed under the calendar. Each has its own deadline (instant = 30 real seconds
  // at any speed, otherwise game days). Doing something is better than nothing: most incidents cost you when ignored.
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const finite = (n, lo = -1e12, hi = 1e12) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  const TIERS = { instant: { label: '즉시', days: 0 }, day: { label: '하루', days: 1 }, three: { label: '사흘', days: 3 }, week: { label: '일주일', days: 7 } };
  const MAX_LIST = 4, INSTANT_REAL_SECONDS = 30, REPEAT_DAYS = 30;
  let realRate = 2; // game seconds per real second (1x = 2); set by the app so "instant" stays 30 real seconds.

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, id, log, result } = ctx;
    const DAY = DATA.dayLength || 120;
    const num = n => Math.round(n).toLocaleString('ko-KR');
    const matName = m => (DATA.materials[m] || {}).name || m;

    function init(s) {
      if (!object(s.incidents)) s.incidents = {};
      const st = s.incidents;
      if (st.version !== 1) st.version = 1;
      if (!finite(st.nextAt)) st.nextAt = (s.time || 0) + 3 * DAY;
      if (!Array.isArray(st.list)) st.list = [];
      if (!Array.isArray(st.effects)) st.effects = [];
      if (!object(st.lastSeen)) st.lastSeen = {};
      if (!object(st.flags)) st.flags = {};
      for (const k of ['qualityBoost', 'hireDiscount', 'resolved', 'missed']) if (!finite(st[k], 0)) st[k] = 0;
      if (typeof st.enabled !== 'boolean') st.enabled = false; // the game turns this on (Sim.enableIncidents); bare simulations stay quiet
      if (!Number.isInteger(st.rng) || st.rng < 0) st.rng = ((s.seed || s.rng || 1) * 2654435761 + 97) >>> 0;
      return st;
    }
    // Incidents draw from their own random stream so the rest of the simulation is not shifted by them.
    function random(s) { const st = s.incidents; let t = (st.rng = (st.rng + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function int(s, lo, hi) { return lo + Math.floor(random(s) * (hi - lo + 1)); }

    // ---------- helpers ----------
    const towns = s => getOwnedTowns(s);
    const activeTown = s => getTown(s) || towns(s)[0];
    const townOf = (s, inc) => getTown(s, inc.townId) || activeTown(s);
    function income(s) { // about one game day of sales, the yardstick for gold amounts
      const day = Math.max(3, s.day || 1);
      return clamp(Math.round((s.stats.earned || 0) / day / 10) * 10, 80, 60000);
    }
    function gold(s, n) { s.gold = Math.max(0, Math.round(s.gold + n)); if (n > 0) s.stats.earned = (s.stats.earned || 0) + Math.round(n); }
    function rep(s, n) { s.reputation = Math.max(0, Math.round(s.reputation + n)); }
    function room(s, m) { return ctx.getMaterialRoom ? ctx.getMaterialRoom(s, m) : 1e8; }
    function addMat(s, m, n) { const add = Math.max(0, Math.min(n, room(s, m))); s.materials[m] = (s.materials[m] || 0) + add; return add; }
    function takeMat(s, m, n) { const take = Math.min(s.materials[m] || 0, n); s.materials[m] = (s.materials[m] || 0) - take; return take; }
    function lose(s, m, share) { const n = Math.floor((s.materials[m] || 0) * share); s.materials[m] -= n; return n; }
    function effect(s, key, mult, days, townId) { s.incidents.effects.push({ key, mult, until: s.time + days * DAY, townId: townId || null }); }
    function factor(s, key, townId) {
      let f = 1; const st = s.incidents; if (!st) return 1;
      for (const e of st.effects) if (e.key === key && e.until > s.time && (!e.townId || !townId || e.townId === townId)) f *= e.mult;
      if (key === 'customers' && st.flags.mascot) f *= 1.05;
      return f;
    }
    const smiths = t => t.staff.filter(w => w.role === 'smith');
    const furnaces = t => t.facilities.filter(f => f.type === 'furnace');
    const staffName = (t, sid) => (t.staff.find(w => w.id === sid) || {}).name || '직원';
    const residents = (s, t) => s.adventurers.filter(a => a.resident && a.townId === t.id);
    const heroName = (s, hid) => (s.adventurers.find(a => a.id === hid) || {}).name || '모험가';
    const reserved = (s, item) => ctx.isItemReserved && ctx.isItemReserved(s, item.id);
    const freeItems = (s, t) => t.inventory.filter(i => !i.locked && !reserved(s, i));
    function removeItem(t, item) { const i = t.inventory.indexOf(item); if (i >= 0) t.inventory.splice(i, 1); }
    function sell(s, t, item, k) { removeItem(t, item); const g = Math.round(item.price * k); gold(s, g); s.stats.sold = (s.stats.sold || 0) + 1; return g; }
    const qualityRank = q => DATA.qualityOrder.indexOf(q);
    const maxLevel = s => Math.max(1, ...towns(s).map(t => t.level || 1));
    const season = s => ctx.getCalendar ? ctx.getCalendar(s).month : 1; // 1 봄 · 2 여름 · 3 가을 · 4 겨울
    const night = s => (s.time % DAY) / DAY > .72;
    const craftLevel = t => Math.max(0, ...smiths(t).map(w => w.craftLevel || 1));
    // Mythril gifts only once some smith can actually use it (mythril designs start at crafting Lv20).
    const mythrilTime = s => towns(s).some(t => craftLevel(t) >= 20);
    const weaponRecipes = (s, t) => (ctx.getUnlockedRecipes ? ctx.getUnlockedRecipes(s, t.id) : []).filter(r => r.slot === 'weapon' && !r.bossRecipe && !r.unlockDrop);
    const familyName = f => ({ sword: '검', axe: '도끼', spear: '창', dagger: '단검', bow: '활', crossbow: '석궁', staff: '지팡이', gauntlet: '권갑', shield: '방패', armor: '갑옷' })[f] || '장비';

    // Dispatch on an incident (search party, scouts, hunt): the hero is away for the given days and comes back.
    // 2026-11-09 (user request): every resident is listed with what they are doing. Only these hard blocks stop a pick;
    // anyone busy can still be picked and the party waits until all of them are free, then sets out together.
    const reservedBy = (s, a, inc) => (s.incidents.list || []).find(x => x !== inc && x.status === 'active' && x.task && x.task.type === 'mission' && Array.isArray(x.task.heroIds) && x.task.heroIds.includes(a.id));
    // A hero picked for a dispatch that is still gathering (boss parties must not take them meanwhile).
    const reserved_ = (s, heroId) => (s.incidents.list || []).some(x => x.status === 'active' && x.task && x.task.type === 'mission' && x.task.gathering && Array.isArray(x.task.heroIds) && x.task.heroIds.includes(heroId));
    function missionHardBlock(s, a, inc) {
      if (!a || !a.resident || a.departed || a.townId !== inc.townId) return '이 마을 모험가가 아니에요.';
      if (a.missionId || reservedBy(s, a, inc)) return '다른 파견에 뽑혀 있어요.';
      return '';
    }
    function missionBlock(s, a, inc) {
      const hard = missionHardBlock(s, a, inc); if (hard) return hard;
      if (a.raidId) return '보스 토벌 중이에요.';
      if (a.invasionId) return '마을 방어 중이에요.';
      if (a.injuryUntil > s.time) return '부상 회복 중이에요.';
      if (a.questId) return '재료 의뢰를 맡고 있어요.';
      if (a.enhancement) return '장비 강화 중이에요.';
      if (!['hunting', 'resting'].includes(a.status)) return '대장간에 들러 있어요. 잠시 뒤 보낼 수 있어요.';
      const st = ctx.getCombatStats(a);
      if (a.hp < st.maxHp * .5) return '체력이 절반보다 적어요.';
      if ((a.fatigue || 0) > 70) return '너무 지쳐 있어요.';
      return '';
    }
    function missionChance(s, inc, heroes) {
      const m = inc.task; if (!heroes.length) return 0;
      const avg = heroes.reduce((n, a) => n + ctx.getCombatStats(a).power, 0) / heroes.length;
      return clamp(.5 + (avg / m.power - 1) * .45 + (heroes.length - m.min) * .08 + (m.bonus || 0), .08, .95);
    }

    // ---------- incident catalogue ----------
    // Each: key, name, cat, tier, easy (early game), opportunity (no loss when ignored), when(s,t), setup(s,t,data),
    // story(s,inc), choices: [{label, info(s,inc), can(s,inc) -> reason, run(s,inc) -> message | {task}}], ignore: {info, run}
    const E = [];
    const def = o => E.push(o);

    // 손님·상인
    // Early on (before any smith can use mythril, Lv20) the merchant carries crystal only (user 2026-11-09).
    const merchantSecond = i => i.data.myth === false ? 'crystal' : 'mythril';
    const merchantGoods = i => i.data.myth === false ? '수정 20개' : '수정 10개 · 미스릴 10개';
    def({ key: 'E01', name: '떠돌이 상인', cat: '손님', tier: 'day', easy: true,
      setup: (s, t, d) => { d.myth = mythrilTime(s); d.price = Math.round((10 * DATA.materials.crystal.price + (d.myth ? 10 * DATA.materials.mythril.price : 10 * DATA.materials.crystal.price)) * .6); },
      story: (s, i) => i.data.myth === false ? '커다란 짐을 진 떠돌이 상인이 수정 20개를 시세의 60%에 팔겠대요.' : '커다란 짐을 진 떠돌이 상인이 수정과 미스릴 묶음(각 10개)을 시세의 60%에 팔겠대요.',
      choices: [
        { label: '산다', info: (s, i) => '−' + num(i.data.price) + ' G · ' + merchantGoods(i) + ' (10% 확률로 가짜 섞임)', can: (s, i) => s.gold < i.data.price ? '골드 부족' : '',
          run: (s, i) => { gold(s, -i.data.price); const fake = random(s) < .1 ? int(s, 2, 3) : 0; addMat(s, 'crystal', 10 - fake); addMat(s, merchantSecond(i), 10); return fake ? '샀는데… 수정 ' + fake + '개는 가짜였어요.' : merchantGoods(i) + '를 싸게 샀어요.'; } },
        { label: '깎는다', info: (s, i) => '50%: 시세의 40% · 50%: 상인이 떠남', can: (s, i) => s.gold < Math.round(i.data.price * 2 / 3) ? '골드 부족' : '',
          run: (s, i) => { if (random(s) < .5) { gold(s, -Math.round(i.data.price * 2 / 3)); addMat(s, 'crystal', 10); addMat(s, merchantSecond(i), 10); return '흥정 성공! 시세의 40%에 샀어요.'; } effect(s, 'price:crystal', 1.1, 3); effect(s, 'price:mythril', 1.1, 3); return '상인이 화가 나서 옆 마을로 갔어요. 3일간 수정·미스릴 값 +10%.'; } }],
      ignore: { info: () => '3일간 수정·미스릴 값 +10%', run: s => { effect(s, 'price:crystal', 1.1, 3); effect(s, 'price:mythril', 1.1, 3); return '상인이 옆 마을 가게에 팔았어요. 3일간 수정·미스릴 값 +10%.'; } } });

    def({ key: 'E02', name: '급한 손님', cat: '손님', tier: 'instant', easy: true,
      when: (s, t) => weaponRecipes(s, t).length > 0,
      setup: (s, t, d) => { const list = weaponRecipes(s, t); const r = list[int(s, 0, list.length - 1)]; d.recipeId = r.id; d.recipeName = r.name; d.reward = r.price * 2; },
      story: (s, i) => '"오늘 안에 ' + i.data.recipeName + '이(가) 꼭 필요해요! 값은 두 배로 드릴게요!"',
      choices: [
        { label: '창고에 있는 걸 판다', info: (s, i) => '+' + num(i.data.reward) + ' G', can: (s, i) => freeItems(s, townOf(s, i)).some(x => x.recipeId === i.data.recipeId) ? '' : '창고에 없음',
          run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).find(x => x.recipeId === i.data.recipeId); removeItem(t, item); gold(s, i.data.reward); s.stats.sold++; rep(s, 1); return i.data.recipeName + '을(를) 두 배 값에 팔았어요. +' + num(i.data.reward) + ' G'; } },
        { label: '만들어 드린다', info: (s, i) => '하루 안에 1개 납품 · +' + num(i.data.reward) + ' G · 못 내면 명성 −3',
          run: (s, i) => ({ task: { type: 'deliver', days: 1, needs: [{ recipeId: i.data.recipeId, n: 1, label: i.data.recipeName }], reward: i.data.reward, rep: 1, failRep: -3 } }) }],
      ignore: { info: () => '명성 −2', run: s => { rep(s, -2); return '"문 앞에서 쫓겨났다"는 소문이 났어요. 명성 −2.'; } } });

    def({ key: 'E03', name: '귀족의 방문', cat: '손님', tier: 'day', when: s => maxLevel(s) >= 3,
      story: () => '귀족이 걸작 이상 장비를 보고 싶어 해요.',
      choices: [
        { label: '걸작을 판다', info: () => '걸작 이상 1개 · 시세의 2배 · 명성 +8', can: (s, i) => freeItems(s, townOf(s, i)).some(x => qualityRank(x.quality) >= qualityRank('masterwork')) ? '' : '걸작 이상 장비 없음',
          run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).filter(x => qualityRank(x.quality) >= qualityRank('masterwork')).sort((a, b) => b.price - a.price)[0]; const g = sell(s, t, item, 2); rep(s, 8); return item.name + '을(를) 두 배 값에 팔았어요. +' + num(g) + ' G · 명성 +8'; } },
        { label: '보여 주기만', info: () => '명성 +3', can: (s, i) => freeItems(s, townOf(s, i)).some(x => qualityRank(x.quality) >= qualityRank('fine')) ? '' : '보여 줄 좋은 장비 없음', run: s => { rep(s, 3); return '귀족이 감탄하고 돌아갔어요. 명성 +3'; } },
        { label: '차를 대접한다', info: s => '−' + num(income(s) * .3) + ' G · 명성 변화 없음', run: s => { gold(s, -income(s) * .3); return '귀족이 차를 마시고 조용히 돌아갔어요.'; } }],
      ignore: { info: () => '명성 −4', run: s => { rep(s, -4); return '귀족이 기다리다 화를 내며 떠났어요. 명성 −4.'; } } });

    def({ key: 'E04', name: '단체 손님', cat: '손님', tier: 'instant', easy: true, when: (s, t) => t.inventory.some(x => x.listed),
      story: () => '순례단이 진열대 장비를 한꺼번에 사겠다며 20% 할인을 해 달래요.',
      choices: [
        { label: '전부 판다', info: (s, i) => '진열 장비 전부 80% 값', run: (s, i) => { const t = townOf(s, i), items = t.inventory.filter(x => x.listed && !x.locked && !reserved(s, x)); let g = 0; for (const x of items) g += sell(s, t, x, .8); rep(s, 1); return '진열 장비 ' + items.length + '개를 팔았어요. +' + num(g) + ' G'; } },
        { label: '반만 판다', info: () => '진열 장비 절반 90% 값', run: (s, i) => { const t = townOf(s, i), items = t.inventory.filter(x => x.listed && !x.locked && !reserved(s, x)); const half = items.slice(0, Math.ceil(items.length / 2)); let g = 0; for (const x of half) g += sell(s, t, x, .9); return '진열 장비 ' + half.length + '개를 팔았어요. +' + num(g) + ' G'; } }],
      ignore: { info: () => '명성 −1 · 하루 손님 −10%', run: (s, i) => { rep(s, -1); effect(s, 'customers', .9, 1, i.townId); return '순례단이 실망하고 돌아갔어요. 명성 −1, 하루 동안 손님 −10%.'; } } });

    def({ key: 'E05', name: '견습 지망생', cat: '손님', tier: 'three', easy: true,
      story: () => '"돈은 안 받아도 돼요. 일을 배우게 해 주세요!"',
      choices: [
        { label: '받아 준다', info: s => '−' + num(income(s) * .4) + ' G 숙식비 · 다음 직원 고용비 반값', run: s => { gold(s, -income(s) * .4); s.incidents.hireDiscount = 1; return '견습생을 받아 줬어요. 다음 직원 고용비가 반값이에요.'; } },
        { label: '다른 가게를 소개한다', info: () => '명성 +1', run: s => { rep(s, 1); return '이웃 가게를 소개해 줬어요. 명성 +1'; } }],
      ignore: { info: () => '명성 −1', run: s => { rep(s, -1); return '견습 지망생이 하루 종일 기다리다 돌아갔어요. 명성 −1.'; } } });

    def({ key: 'E06', name: '수상한 의뢰인', cat: '손님', tier: 'day', when: s => towns(s).length >= 2,
      setup: (s, t, d) => { const list = weaponRecipes(s, t); d.price = list.length ? Math.max(...list.map(r => r.price)) : 200; },
      story: () => '표식 없는 무기 10자루를 큰돈에 주문하겠대요.',
      choices: [
        { label: '받는다', info: (s, i) => '7일 안에 무기 10개 · +' + num(i.data.price * 10) + ' G · 30% 확률로 명성 −6',
          run: (s, i) => ({ task: { type: 'deliver', days: 7, needs: [{ slot: 'weapon', n: 10, label: '무기' }], reward: Math.round(i.data.price * 10), rep: 0, failRep: -3, shady: true } }) },
        { label: '거절한다', info: () => '명성 +2', run: s => { rep(s, 2); return '단호하게 거절했어요. 명성 +2'; } },
        { label: '경비대에 알린다', info: s => '명성 +4 · +' + num(income(s) * .5) + ' G 포상금', run: s => { rep(s, 4); gold(s, income(s) * .5); return '경비대가 의뢰인을 쫓아냈어요. 명성 +4'; } }],
      ignore: { info: () => '앙심을 품고 도둑이 들 수 있음', run: s => { s.incidents.flags.grudge = s.time; return '의뢰인이 앙심을 품고 사라졌어요…'; } } });

    def({ key: 'E07', name: '떠돌이 감정사', cat: '손님', tier: 'three', when: (s, t) => freeItems(s, t).length > 0,
      story: () => '감정사가 창고 장비 하나를 감정해 주겠대요.',
      choices: [
        { label: '감정을 맡긴다', info: s => '−' + num(income(s) * .6) + ' G · 가장 비싼 장비 판매가 +25%', can: s => s.gold < income(s) * .6 ? '골드 부족' : '',
          run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).sort((a, b) => b.price - a.price)[0]; if (!item) return '감정할 장비가 없었어요.'; gold(s, -income(s) * .6); item.price = Math.round(item.price * 1.25); return item.name + '의 숨은 가치를 찾았어요. 판매가 +25%'; } },
        { label: '진열대 구경만', info: () => '명성 +1', run: s => { rep(s, 1); return '감정사가 진열대를 칭찬했어요. 명성 +1'; } }],
      ignore: { info: () => '명성 −1', run: s => { rep(s, -1); return '"이 가게 물건은 그저 그렇다"는 소문이 났어요. 명성 −1.'; } } });

    def({ key: 'E08', name: '단골의 부탁', cat: '손님', tier: 'three', easy: true, when: (s, t) => residents(s, t).length > 0,
      setup: (s, t, d) => { const list = residents(s, t); d.heroId = list[int(s, 0, list.length - 1)].id; },
      story: (s, i) => heroName(s, i.data.heroId) + '이(가) 부서진 애장품을 고쳐 달래요.',
      choices: [
        { label: '무료로 고친다', info: () => '철 5 · 명성 +3', can: s => (s.materials.iron || 0) < 5 ? '철 부족' : '', run: (s, i) => { takeMat(s, 'iron', 5); rep(s, 3); return heroName(s, i.data.heroId) + '이(가) 고마워했어요. 명성 +3'; } },
        { label: '돈을 받고 고친다', info: s => '+' + num(income(s) * .4) + ' G', run: s => { gold(s, income(s) * .4); return '수리비를 받고 고쳐 줬어요.'; } }],
      ignore: { info: () => '명성 −2 · 3일간 손님 −5%', run: (s, i) => { rep(s, -2); effect(s, 'customers', .95, 3, i.townId); return '단골이 서운해했어요. 명성 −2, 3일간 손님 −5%.'; } } });

    def({ key: 'E09', name: '이웃 대장장이', cat: '손님', tier: 'three', when: s => towns(s).length >= 2,
      setup: (s, t, d) => { const list = ['iron', 'wood', 'leather'].filter(m => (s.materials[m] || 0) >= 20); d.mat = list.length ? list[int(s, 0, list.length - 1)] : 'iron'; },
      story: (s, i) => '이웃 대장장이가 ' + matName(i.data.mat) + ' 20개를 빌려 달래요. 7일 뒤 갚겠대요.',
      choices: [
        { label: '빌려준다', info: (s, i) => matName(i.data.mat) + ' −20 · 7일 뒤 30개', can: (s, i) => (s.materials[i.data.mat] || 0) < 20 ? '재료 부족' : '', run: (s, i) => { takeMat(s, i.data.mat, 20); return { task: { type: 'wait', days: 7, give: { [i.data.mat]: 30 }, text: '이웃 대장장이가 ' + matName(i.data.mat) + ' 30개로 갚았어요.' } }; } },
        { label: '반만 빌려준다', info: (s, i) => matName(i.data.mat) + ' −10 · 7일 뒤 15개', can: (s, i) => (s.materials[i.data.mat] || 0) < 10 ? '재료 부족' : '', run: (s, i) => { takeMat(s, i.data.mat, 10); return { task: { type: 'wait', days: 7, give: { [i.data.mat]: 15 }, text: '이웃 대장장이가 ' + matName(i.data.mat) + ' 15개로 갚았어요.' } }; } }],
      ignore: { info: (s, i) => '7일간 ' + matName(i.data.mat) + ' 값 +15%', run: (s, i) => { effect(s, 'price:' + i.data.mat, 1.15, 7); return '이웃과 사이가 틀어졌어요. 7일간 ' + matName(i.data.mat) + ' 값 +15%.'; } } });

    def({ key: 'E10', name: '어린이 손님', cat: '손님', tier: 'day', easy: true, opportunity: true,
      story: () => '아이가 동전 몇 닢을 내밀며 장난감 칼을 갖고 싶대요.',
      choices: [
        { label: '나무 칼을 만들어 준다', info: () => '나무 3 · 명성 +2 · 하루 손님 +10%', can: s => (s.materials.wood || 0) < 3 ? '나무 부족' : '', run: (s, i) => { takeMat(s, 'wood', 3); rep(s, 2); effect(s, 'customers', 1.1, 1, i.townId); return '아이가 신나서 마을을 뛰어다녀요. 명성 +2'; } },
        { label: '철로 근사하게', info: () => '철 3 · 나무 2 · 명성 +4', can: s => (s.materials.iron || 0) < 3 || (s.materials.wood || 0) < 2 ? '재료 부족' : '', run: s => { takeMat(s, 'iron', 3); takeMat(s, 'wood', 2); rep(s, 4); return '아이가 반짝이는 칼을 들고 자랑하러 갔어요. 명성 +4'; } }],
      ignore: { info: () => '손해 없음', run: () => '아이가 돌아갔어요.' } });

    // 대장간 사고·운영
    def({ key: 'E11', name: '화덕 과열', cat: '사고', tier: 'instant', easy: true, when: (s, t) => t.queue.some(q => q.staffId),
      setup: (s, t, d) => { const q = t.queue.find(q => q.staffId); d.facilityId = q.facilityId; },
      story: () => '화덕 하나가 너무 뜨거워졌어요! 연기가 피어올라요.',
      choices: [
        { label: '식힌다', info: () => '그 화덕 하루 멈춤', run: (s, i) => { effect(s, 'furnace:' + i.data.facilityId, 0, 1, i.townId); return '화덕을 식혔어요. 하루 쉬었다가 다시 불을 지펴요.'; } },
        { label: '버틴다', info: () => '50%: 지금 장비 품질 +1단계 · 50%: 화덕 이틀 멈춤', run: (s, i) => { if (random(s) < .5) { s.incidents.qualityBoost++; return '뜨거운 불로 잘 벼려졌어요! 다음 완성품 품질 +1단계.'; } effect(s, 'furnace:' + i.data.facilityId, 0, 2, i.townId); return '화덕이 버티지 못했어요. 이틀 멈춰요.'; } }],
      ignore: { info: () => '화덕 이틀 멈춤 · 만들던 장비 망가짐', run: (s, i) => { const t = townOf(s, i); effect(s, 'furnace:' + i.data.facilityId, 0, 2, i.townId); const q = t.queue.find(q => q.facilityId === i.data.facilityId && !q.orderId); if (q) { q.remaining = q.total; } return '화덕이 망가졌어요. 이틀 멈추고, 만들던 장비를 처음부터 다시 만들어야 해요.'; } } });

    def({ key: 'E12', name: '창고에 쥐 떼', cat: '사고', tier: 'three', easy: true, when: s => !s.incidents.flags.cat && !s.incidents.flags.mascot,
      story: () => '창고에 쥐 떼가 들어 가죽과 나무를 갉아먹고 있어요.',
      choices: [
        { label: '고양이를 들인다', info: s => '−' + num(income(s) * .5) + ' G · 앞으로 쥐 사건 없음', run: s => { gold(s, -income(s) * .5); s.incidents.flags.cat = true; return '고양이가 창고를 지켜요. 이제 쥐 걱정 끝!'; } },
        { label: '대청소', info: () => '직원 1명 하루 쉼', run: (s, i) => { const t = townOf(s, i), w = t.staff.find(w => w.role !== 'smith') || t.staff[0]; if (w) effect(s, 'staff:' + w.id, 0, 1, i.townId); return (w ? w.name : '직원') + '이(가) 하루 동안 창고를 청소했어요.'; } }],
      ignore: { info: () => '가죽·나무 20% 손실', run: s => { const a = lose(s, 'leather', .2), b = lose(s, 'wood', .2); return '쥐가 가죽 ' + a + '개와 나무 ' + b + '개를 갉아먹었어요.'; } } });

    def({ key: 'E13', name: '밤 도둑', cat: '사고', tier: 'day', when: (s, t) => freeItems(s, t).length > 0,
      story: () => '밤마다 누군가 창고를 기웃거려요.',
      choices: [
        { label: '경비를 세운다', info: s => '−' + num(income(s) * .6) + ' G', run: s => { gold(s, -income(s) * .6); return '경비 덕분에 도둑이 오지 않았어요.'; } },
        { label: '덫을 놓는다', info: () => '철 5 · 60%: 잡아서 포상금', can: s => (s.materials.iron || 0) < 5 ? '철 부족' : '', run: s => { takeMat(s, 'iron', 5); if (random(s) < .6) { gold(s, income(s) * .8); rep(s, 2); return '도둑을 잡았어요! 포상금을 받았어요. 명성 +2'; } return '도둑이 덫을 피해 달아났어요. 다행히 잃은 건 없어요.'; } }],
      ignore: { info: () => '가장 비싼 장비 1개 도난', run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).sort((a, b) => b.price - a.price)[0]; if (!item) return '도둑이 빈손으로 돌아갔어요.'; removeItem(t, item); return '도둑이 ' + item.name + '을(를) 훔쳐 갔어요.'; } } });

    def({ key: 'E14', name: '비 새는 지붕', cat: '사고', tier: 'three', easy: true,
      story: () => '비가 오자 지붕에서 물이 뚝뚝 떨어져요.',
      choices: [
        { label: '바로 고친다', info: s => '−' + num(income(s) * .8) + ' G', run: s => { gold(s, -income(s) * .8); return '지붕을 튼튼하게 고쳤어요.'; } },
        { label: '임시로 막는다', info: () => '나무 8 · 7일 뒤 다시 샐 수 있음', can: s => (s.materials.wood || 0) < 8 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 8); delete s.incidents.lastSeen.E14; s.incidents.lastSeen.E14 = s.time - (REPEAT_DAYS - 7) * DAY; return '판자로 막아 뒀어요. 언젠가 다시 고쳐야 해요.'; } }],
      ignore: { info: () => '나무·가죽 15% 손실 · 3일간 판매가 −10%', run: (s, i) => { const a = lose(s, 'wood', .15), b = lose(s, 'leather', .15); effect(s, 'sale', .9, 3, i.townId); return '재료가 젖었어요(나무 ' + a + ', 가죽 ' + b + '). 3일간 판매가 −10%.'; } } });

    def({ key: 'E15', name: '직원 다툼', cat: '직원', tier: 'day', when: (s, t) => t.staff.length >= 3,
      setup: (s, t, d) => { const a = t.staff[int(s, 0, t.staff.length - 1)]; const rest = t.staff.filter(w => w !== a); d.a = a.id; d.b = rest[int(s, 0, rest.length - 1)].id; },
      story: (s, i) => staffName(townOf(s, i), i.data.a) + '와(과) ' + staffName(townOf(s, i), i.data.b) + '이(가) 작업 순서로 다퉈요.',
      choices: [
        { label: (s, i) => staffName(townOf(s, i), i.data.a) + ' 편을 든다', info: () => '한 명 3일 +10% · 한 명 3일 −10%', run: (s, i) => { effect(s, 'staff:' + i.data.a, 1.1, 3, i.townId); effect(s, 'staff:' + i.data.b, .9, 3, i.townId); return '다툼은 끝났지만 한 명은 시무룩해요.'; } },
        { label: '화해 회식', info: s => '−' + num(income(s) * .5) + ' G · 둘 다 3일 +10%', run: (s, i) => { gold(s, -income(s) * .5); effect(s, 'staff:' + i.data.a, 1.1, 3, i.townId); effect(s, 'staff:' + i.data.b, 1.1, 3, i.townId); return '맛있게 먹고 화해했어요. 둘 다 3일간 신나게 일해요.'; } }],
      ignore: { info: () => '둘 다 3일간 −15%', run: (s, i) => { effect(s, 'staff:' + i.data.a, .85, 3, i.townId); effect(s, 'staff:' + i.data.b, .85, 3, i.townId); return '분위기가 냉랭해요. 둘 다 3일간 작업 속도 −15%.'; } } });

    def({ key: 'E16', name: '직원 생일', cat: '직원', tier: 'day', easy: true, when: (s, t) => t.staff.length >= 1,
      setup: (s, t, d) => { d.w = t.staff[int(s, 0, t.staff.length - 1)].id; },
      story: (s, i) => '오늘은 ' + staffName(townOf(s, i), i.data.w) + '의 생일이에요!',
      choices: [
        { label: '선물을 준다', info: s => '−' + num(income(s) * .3) + ' G · 3일간 +20%', run: (s, i) => { gold(s, -income(s) * .3); effect(s, 'staff:' + i.data.w, 1.2, 3, i.townId); return '선물을 받고 무척 기뻐해요. 3일간 작업 속도 +20%.'; } },
        { label: '일찍 퇴근시켜 준다', info: () => '반나절 쉼 · 이후 3일 +10%', run: (s, i) => { effect(s, 'staff:' + i.data.w, 0, .5, i.townId); s.incidents.effects.push({ key: 'staff:' + i.data.w, mult: 1.1, until: s.time + 3.5 * DAY, townId: i.townId }); return '푹 쉬고 와서 3일간 더 힘내요.'; } }],
      ignore: { info: () => '3일간 −10%', run: (s, i) => { effect(s, 'staff:' + i.data.w, .9, 3, i.townId); return '생일을 잊어서 서운해해요. 3일간 작업 속도 −10%.'; } } });

    def({ key: 'E17', name: '직원 몸살', cat: '직원', tier: 'instant', easy: true, when: (s, t) => t.staff.length >= 1,
      setup: (s, t, d) => { d.w = t.staff[int(s, 0, t.staff.length - 1)].id; },
      story: (s, i) => staffName(townOf(s, i), i.data.w) + '이(가) 콜록콜록… 몸살이 났어요.',
      choices: [
        { label: '쉬게 한다', info: () => '하루 결근', run: (s, i) => { effect(s, 'staff:' + i.data.w, 0, 1, i.townId); return '하루 푹 쉬고 나면 괜찮아질 거예요.'; } },
        { label: '약을 사 준다', info: s => '−' + num(income(s) * .4) + ' G · 바로 회복', run: s => { gold(s, -income(s) * .4); return '약을 먹고 금방 나았어요.'; } }],
      ignore: { info: () => '3일간 −30%', run: (s, i) => { effect(s, 'staff:' + i.data.w, .7, 3, i.townId); return '아픈 채로 일해요. 3일간 작업 속도 −30%.'; } } });

    def({ key: 'E18', name: '새 담금질법 발견', cat: '직원', tier: 'three', opportunity: true, when: (s, t) => craftLevel(t) >= 5,
      story: () => '대장장이가 우연히 새 담금질법을 찾았어요!',
      choices: [
        { label: '기록해 둔다', info: s => '−' + num(income(s) * .3) + ' G · 다음 제작 3번 품질 +1단계', run: s => { gold(s, -income(s) * .3); s.incidents.qualityBoost += 3; return '비법을 적어 뒀어요. 다음 제작 3번 품질 +1단계.'; } },
        { label: '모두에게 가르친다', info: () => '5일간 제작 속도 +20%', run: (s, i) => { effect(s, 'craft', 1.2, 5, i.townId); return '모두가 새 방법을 익혔어요. 5일간 제작 속도 +20%.'; } }],
      ignore: { info: () => '손해 없음', run: () => '바쁜 사이에 잊어버렸어요.' } });

    def({ key: 'E19', name: '망치가 부러졌다', cat: '사고', tier: 'day', when: (s, t) => smiths(t).length >= 1,
      setup: (s, t, d) => { const list = smiths(t); d.w = list[int(s, 0, list.length - 1)].id; },
      story: (s, i) => staffName(townOf(s, i), i.data.w) + '의 망치 머리가 똑 부러졌어요!',
      choices: [
        { label: '새 망치를 산다', info: s => '−' + num(income(s) * .6) + ' G', run: s => { gold(s, -income(s) * .6); return '새 망치로 더 힘차게 두드려요.'; } },
        { label: '이웃에게 빌린다', info: () => '철 10 (사례)', can: s => (s.materials.iron || 0) < 10 ? '철 부족' : '', run: s => { takeMat(s, 'iron', 10); return '이웃 대장장이의 망치를 빌렸어요.'; } }],
      ignore: { info: () => '그 대장장이 5일간 −30%', run: (s, i) => { effect(s, 'staff:' + i.data.w, .7, 5, i.townId); return '헌 망치로 일해요. 5일간 작업 속도 −30%.'; } } });

    def({ key: 'E20', name: '스카우트 제의', cat: '직원', tier: 'three', when: (s, t) => t.staff.length >= 4,
      setup: (s, t, d) => { d.w = t.staff[int(s, 0, t.staff.length - 1)].id; },
      story: (s, i) => '다른 마을 가게가 ' + staffName(townOf(s, i), i.data.w) + '을(를) 데려가려 해요.',
      choices: [
        { label: '월급을 올려 붙잡는다', info: () => '월급 +10% · 작업 속도 +5% (계속)', run: (s, i) => { const w = townOf(s, i).staff.find(w => w.id === i.data.w); if (w) { w.salary = Math.round(w.salary * 1.1); }
          // The lasting +5% is once per person: a second scout offer for the same worker does not stack it again.
          const key = 'staff:' + i.data.w, already = s.incidents.effects.some(e => e.key === key && e.mult > 1 && e.until - s.time > 1000 * DAY);
          if (!already) effect(s, key, 1.05, 3650, i.townId); return already ? '고마워하며 남기로 했어요. (속도 보너스는 이미 받고 있어요)' : '고마워하며 남기로 했어요.'; } },
        { label: '보너스를 준다', info: s => '−' + num(income(s) * 2) + ' G · 10일간 +10%', run: (s, i) => { gold(s, -income(s) * 2); effect(s, 'staff:' + i.data.w, 1.1, 10, i.townId); return '보너스를 받고 마음을 다잡았어요.'; } }],
      ignore: { info: () => '마음이 떠나 10일간 −40%', run: (s, i) => { effect(s, 'staff:' + i.data.w, .6, 10, i.townId); return '마음이 반쯤 떠났어요. 10일간 작업 속도 −40%.'; } } });

    // 마을·모험가
    def({ key: 'E21', name: '다친 모험가', cat: '모험가', tier: 'day', easy: true, when: (s, t) => residents(s, t).some(a => a.injuryUntil > s.time + DAY),
      setup: (s, t, d) => { const a = residents(s, t).find(a => a.injuryUntil > s.time + DAY); d.heroId = a.id; },
      story: (s, i) => '사냥에서 다친 ' + heroName(s, i.data.heroId) + '이(가) 대장간 앞에 주저앉았어요.',
      choices: [
        { label: '치료비를 대 준다', info: s => '−' + num(income(s) * .5) + ' G · 바로 회복 · 명성 +2', run: (s, i) => { const a = s.adventurers.find(a => a.id === i.data.heroId); gold(s, -income(s) * .5); rep(s, 2); if (a) { a.injuryUntil = s.time; a.hp = Math.max(a.hp, ctx.getCombatStats(a).maxHp * .9); } return '치료를 받고 금방 나았어요. 명성 +2'; } },
        { label: '붕대를 감아 준다', info: () => '가죽 3 · 부상 기간 절반', can: s => (s.materials.leather || 0) < 3 ? '가죽 부족' : '', run: (s, i) => { takeMat(s, 'leather', 3); const a = s.adventurers.find(a => a.id === i.data.heroId); if (a && a.injuryUntil > s.time) a.injuryUntil = s.time + (a.injuryUntil - s.time) / 2; return '붕대를 감아 줬어요. 회복이 빨라져요.'; } }],
      ignore: { info: () => '부상 기간 두 배', run: (s, i) => { const a = s.adventurers.find(a => a.id === i.data.heroId); if (a && a.injuryUntil > s.time) a.injuryUntil = s.time + (a.injuryUntil - s.time) * 2; return '아무도 돌봐 주지 않아 회복이 늦어져요.'; } } });

    const missionPower = (s, t, k) => { const p = residents(s, t).map(a => ctx.getCombatStats(a).power).sort((a, b) => a - b); return Math.max(10, Math.round((p[Math.floor(p.length / 2)] || 20) * k)); };
    def({ key: 'E22', name: '사냥터 이상 징후', cat: '모험가', tier: 'three', when: (s, t) => residents(s, t).length >= 3,
      setup: (s, t, d) => { d.power = missionPower(s, t, .9); },
      story: () => '사냥터 하나에 몬스터가 몰려들었다는 소문이에요.',
      choices: [
        { label: '정찰을 보낸다', info: (s, i) => '1~2명 · 하루 · 성공하면 5일간 재료 값 −30%', run: (s, i) => ({ task: { type: 'mission', min: 1, max: 2, power: i.data.power, days: 1, win: { effects: [['price:iron', .7, 5], ['price:wood', .7, 5], ['price:leather', .7, 5]], rep: 1, text: '정찰 성공! 몬스터를 쫓아내서 5일간 철·나무·가죽 값 −30%.' }, lose: { text: '정찰대가 쫓겨 돌아왔어요.' } } }) },
        { label: '경고문을 붙인다', info: () => '명성 +1 · 3일간 손님 −5%', run: (s, i) => { rep(s, 1); effect(s, 'customers', .95, 3, i.townId); return '경고문 덕분에 다친 사람은 줄었어요.'; } }],
      ignore: { info: () => '5일간 손님 −15%', run: (s, i) => { effect(s, 'customers', .85, 5, i.townId); return '사냥이 위험해져서 모험가들이 몸을 사려요. 5일간 손님 −15%.'; } } });

    def({ key: 'E23', name: '마을 잔치', cat: '마을', tier: 'three',
      story: () => '마을에 큰 잔치가 열려요. 대장간도 한몫 거들어 달래요.',
      choices: [
        { label: '장비를 기부한다', info: () => '창고 장비 1개 · 명성 +8', can: (s, i) => freeItems(s, townOf(s, i)).length ? '' : '창고에 장비 없음', run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).sort((a, b) => a.price - b.price)[0]; removeItem(t, item); rep(s, 8); return item.name + '을(를) 경품으로 내놨어요. 명성 +8'; } },
        { label: '술값을 낸다', info: s => '−' + num(income(s) * .6) + ' G · 명성 +3', run: s => { gold(s, -income(s) * .6); rep(s, 3); return '마을 사람들이 대장간에 건배했어요. 명성 +3'; } }],
      ignore: { info: () => '명성 −3', run: s => { rep(s, -3); return '"인색한 대장간"이라는 말을 들었어요. 명성 −3.'; } } });

    def({ key: 'E24', name: '산사태 예보', cat: '마을', tier: 'day',
      story: () => '"이틀 뒤부터 5일간 길이 막혀 재료가 들어오지 않아요!"',
      choices: [
        { label: '비상 매입', info: () => '지금 철·나무·가죽을 각 50개까지 (시세 +10%)', run: s => { let cost = 0; const got = []; for (const m of ['iron', 'wood', 'leather']) { const p = Math.round(DATA.materials[m].price * 1.1), n = Math.min(50, room(s, m), Math.floor(s.gold / p)); if (n > 0) { s.gold -= n * p; cost += n * p; addMat(s, m, n); got.push(matName(m) + ' ' + n); } } effect(s, 'buyStop', 0, 5); s.incidents.effects[s.incidents.effects.length - 1].from = s.time + 2 * DAY; s.incidents.effects[s.incidents.effects.length - 1].until = s.time + 7 * DAY; return '미리 사 뒀어요(' + (got.join(', ') || '없음') + ') · −' + num(cost) + ' G'; } },
        { label: '길 정비에 돈을 보탠다', info: s => '−' + num(income(s) * 3) + ' G · 막히는 기간 2일 · 명성 +3', can: s => s.gold < income(s) * 3 ? '골드 부족' : '', run: s => { gold(s, -income(s) * 3); rep(s, 3); s.incidents.effects.push({ key: 'buyStop', mult: 0, from: s.time + 2 * DAY, until: s.time + 4 * DAY, townId: null }); return '길을 미리 다져서 막히는 기간이 2일로 줄었어요. 명성 +3'; } }],
      ignore: { info: () => '이틀 뒤부터 5일간 재료 매입 중단', run: s => { s.incidents.effects.push({ key: 'buyStop', mult: 0, from: s.time + 1 * DAY, until: s.time + 6 * DAY, townId: null }); return '곧 길이 막혀요. 5일간 재료를 살 수 없어요.'; } } });

    def({ key: 'E25', name: '경쟁 가게 개업', cat: '마을', tier: 'three', when: s => towns(s).length >= 2,
      story: () => '길 건너편에 번쩍번쩍한 새 대장간이 문을 열었어요.',
      choices: [
        { label: '할인전', info: () => '3일간 판매가 −10% · 손님 +30%', run: (s, i) => { effect(s, 'sale', .9, 3, i.townId); effect(s, 'customers', 1.3, 3, i.townId); return '할인전에 손님이 몰려왔어요!'; } },
        { label: '품질로 승부', info: () => '7일간 판매가 +10%', run: (s, i) => { effect(s, 'sale', 1.1, 7, i.townId); return '"역시 원조가 낫다"는 말이 돌아요. 7일간 판매가 +10%.'; } }],
      ignore: { info: () => '7일간 손님 −20%', run: (s, i) => { effect(s, 'customers', .8, 7, i.townId); return '손님 일부가 새 가게로 갔어요. 7일간 손님 −20%.'; } } });

    def({ key: 'E26', name: '마을 장로의 부탁', cat: '마을', tier: 'three', when: (s, t) => weaponRecipes(s, t).length > 0,
      setup: (s, t, d) => { const list = weaponRecipes(s, t); d.price = list.length ? Math.max(...list.map(r => r.price)) : 120; },
      story: () => '장로님이 경비대에 쓸 장비를 15일 안에 납품해 달래요.',
      choices: [
        { label: '받는다', info: (s, i) => '15일 안에 무기 3 · 보조 장비 2 · +' + num(i.data.price * 5 * 1.8) + ' G · 명성 +10 · 못 내면 명성 −4',
          run: (s, i) => ({ task: { type: 'deliver', days: 15, needs: [{ slot: 'weapon', n: 3, label: '무기' }, { slot: 'offhand', n: 2, label: '보조 장비' }], reward: Math.round(i.data.price * 5 * 1.8), rep: 10, failRep: -4 } }) },
        { label: '정중히 거절한다', info: () => '명성 −1', run: s => { rep(s, -1); return '장로님이 아쉬워하며 돌아갔어요. 명성 −1.'; } }],
      ignore: { info: () => '명성 −3', run: s => { rep(s, -3); return '대답도 없다며 장로님이 서운해해요. 명성 −3.'; } } });

    def({ key: 'E27', name: '실종 모험가', cat: '모험가', tier: 'three', when: (s, t) => residents(s, t).length >= 5,
      setup: (s, t, d) => { const list = residents(s, t).filter(a => !a.raidId && !a.missionId); const a = list[int(s, 0, list.length - 1)]; d.heroId = a.id; d.name = a.name; d.power = missionPower(s, t, .85); },
      story: (s, i) => '사냥 나간 ' + i.data.name + '이(가) 돌아오지 않아요.',
      choices: [
        { label: '구조대를 보낸다', info: () => '1~3명 · 2일 · 성공하면 사례금 · 명성 +4', run: (s, i) => ({ task: { type: 'mission', min: 1, max: 3, power: i.data.power, days: 2, exclude: [i.data.heroId], win: { gold: income(s) * 1.5, rep: 4, text: i.data.name + '을(를) 구해 왔어요! 사례금을 받았어요. 명성 +4' }, lose: { leave: i.data.heroId, text: '구조에 실패했어요… ' + i.data.name + '은(는) 다른 마을로 떠났대요.' } } }) },
        { label: '경비대에 맡긴다', info: s => '−' + num(income(s)) + ' G · 돌아오지만 크게 다침', run: (s, i) => { gold(s, -income(s)); const a = s.adventurers.find(a => a.id === i.data.heroId); if (a) a.injuryUntil = Math.max(a.injuryUntil || 0, s.time + 3 * DAY); return i.data.name + '이(가) 크게 다친 채 돌아왔어요.'; } }],
      ignore: { info: (s, i) => i.data.name + '이(가) 마을을 떠남', run: (s, i) => { const a = s.adventurers.find(a => a.id === i.data.heroId); if (a && ctx.leaveTown) ctx.leaveTown(s, a); return i.data.name + '은(는) 끝내 돌아오지 않았어요. 다른 마을로 갔대요.'; } } });

    def({ key: 'E28', name: '우두머리 출현', cat: '모험가', tier: 'three', when: (s, t) => (s.stats.raidWins || 0) >= 1 && residents(s, t).length >= 4,
      setup: (s, t, d) => { d.power = missionPower(s, t, 1.05); },
      story: () => '사냥터에 덩치 큰 우두머리가 나타났어요!',
      choices: [
        { label: '토벌대를 보낸다', info: () => '2~4명 · 하루 · 이기면 재료 대량과 골드', run: (s, i) => ({ task: { type: 'mission', min: 2, max: 4, power: i.data.power, days: 1, win: { gold: income(s) * 2, mats: { iron: 30, leather: 25, wood: 25 }, rep: 3, text: '우두머리를 물리쳤어요! 재료와 골드를 얻었어요.' }, lose: { injure: true, effects: [['customers', .85, 3]], text: '토벌대가 밀려났어요. 다친 사람이 생겼어요.' } } }) }],
      ignore: { info: () => '5일간 손님 −20%', run: (s, i) => { effect(s, 'customers', .8, 5, i.townId); return '우두머리가 마을 근처를 휘저어요. 5일간 손님 −20%.'; } } });

    def({ key: 'E29', name: '모험가 결혼식', cat: '모험가', tier: 'week', opportunity: true, when: (s, t) => residents(s, t).length >= 4,
      setup: (s, t, d) => { const list = residents(s, t); const a = list[int(s, 0, list.length - 1)], rest = list.filter(x => x !== a), b = rest[int(s, 0, rest.length - 1)]; d.a = a.name; d.b = b.name; },
      story: (s, i) => i.data.a + '와(과) ' + i.data.b + '이(가) 결혼해요! 축하 반지를 맡기고 싶대요.',
      choices: [
        { label: '반지를 만들어 준다', info: () => '7일 안에 장신구 1개 납품 · 명성 +5 · 골드', run: s => ({ task: { type: 'deliver', days: 7, needs: [{ slot: 'accessory', n: 1, label: '장신구' }], reward: Math.round(income(s) * 2), rep: 5, failRep: 0 } }) },
        { label: '축하 선물만', info: s => '−' + num(income(s) * .3) + ' G · 명성 +2', run: s => { gold(s, -income(s) * .3); rep(s, 2); return '두 사람이 고마워했어요. 명성 +2'; } }],
      ignore: { info: () => '손해 없음', run: () => '다른 마을 가게에 반지를 맡겼대요.' } });

    def({ key: 'E30', name: '은퇴하는 모험가', cat: '모험가', tier: 'three', when: (s, t) => residents(s, t).length >= 3,
      setup: (s, t, d) => { const a = residents(s, t).sort((x, y) => y.level - x.level)[0]; d.name = a.name; },
      story: (s, i) => '오래 우리 장비를 쓴 ' + i.data.name + '이(가) 모험가를 그만둔대요.',
      choices: [
        { label: '쓰던 장비를 녹여 받는다', info: s => '−' + num(income(s) * .5) + ' G · 철 20 · 가죽 10', run: s => { gold(s, -income(s) * .5); addMat(s, 'iron', 20); addMat(s, 'leather', 10); return '추억이 담긴 장비를 녹여 재료로 받았어요.'; } },
        { label: '송별회를 연다', info: s => '−' + num(income(s) * .3) + ' G · 명성 +3', run: s => { gold(s, -income(s) * .3); rep(s, 3); return '따뜻한 송별회였어요. 명성 +3'; } }],
      ignore: { info: () => '명성 −1', run: s => { rep(s, -1); return '인사도 못 하고 떠나보냈어요. 명성 −1.'; } } });

    // 시세·날씨
    def({ key: 'E31', name: '광산 조합의 제안', cat: '시세', tier: 'three', easy: true,
      story: () => '"철 100개를 반값에 넘기겠소!"',
      choices: [
        { label: '산다', info: () => '철 최대 100개 · 반값', can: s => room(s, 'iron') < 1 ? '창고 가득' : '', run: s => { const p = Math.max(1, Math.round(DATA.materials.iron.price / 2)), n = Math.min(100, room(s, 'iron'), Math.floor(s.gold / p)); s.gold -= n * p; addMat(s, 'iron', n); return '철 ' + n + '개를 반값에 샀어요. −' + num(n * p) + ' G'; } },
        { label: '절반만 산다', info: () => '철 최대 50개 · 반값', can: s => room(s, 'iron') < 1 ? '창고 가득' : '', run: s => { const p = Math.max(1, Math.round(DATA.materials.iron.price / 2)), n = Math.min(50, room(s, 'iron'), Math.floor(s.gold / p)); s.gold -= n * p; addMat(s, 'iron', n); return '철 ' + n + '개를 반값에 샀어요.'; } }],
      ignore: { info: () => '7일간 철 값 +15%', run: s => { effect(s, 'price:iron', 1.15, 7); return '조합이 경쟁 가게와 계약했어요. 7일간 철 값 +15%.'; } } });

    def({ key: 'E32', name: '가죽 품귀 예보', cat: '시세', tier: 'day',
      story: () => '"사흘 뒤부터 5일간 가죽 값이 두 배가 된대요!"',
      choices: [
        { label: '지금 비축한다', info: () => '지금 값으로 가죽을 50개까지', can: s => room(s, 'leather') < 1 ? '창고 가득' : '', run: s => { const p = DATA.materials.leather.price, n = Math.min(50, room(s, 'leather'), Math.floor(s.gold / p)); s.gold -= n * p; addMat(s, 'leather', n); s.incidents.effects.push({ key: 'price:leather', mult: 2, from: s.time + 3 * DAY, until: s.time + 8 * DAY, townId: null }); return '가죽 ' + n + '개를 미리 사 뒀어요.'; } },
        { label: '사냥꾼 길드와 계약', info: s => '−' + num(income(s) * 1.5) + ' G · 품귀 동안에도 평소 값', run: s => { gold(s, -income(s) * 1.5); return '길드 계약 덕분에 가죽 값 걱정은 없어요.'; } }],
      ignore: { info: () => '5일간 가죽 값 두 배', run: s => { s.incidents.effects.push({ key: 'price:leather', mult: 2, from: s.time + 2 * DAY, until: s.time + 7 * DAY, townId: null }); return '곧 가죽 값이 두 배로 올라요(5일간).'; } } });

    def({ key: 'E33', name: '유행 소식', cat: '시세', tier: 'three',
      setup: (s, t, d) => { const fam = ['sword', 'axe', 'spear', 'dagger', 'bow', 'staff']; d.family = fam[int(s, 0, fam.length - 1)]; },
      story: (s, i) => '"이번 주 마을에 ' + familyName(i.data.family) + ' 바람이 분대요!"',
      choices: [
        { label: '간판을 건다', info: (s, i) => '−' + num(income(s) * .6) + ' G · 7일간 ' + familyName(i.data.family) + ' 판매가 +30%', run: (s, i) => { gold(s, -income(s) * .6); effect(s, 'sale:' + i.data.family, 1.3, 7, i.townId); return '간판을 보고 손님들이 ' + familyName(i.data.family) + '을(를) 찾아요.'; } },
        { label: '진열을 바꾼다', info: () => '7일간 손님 +10%', run: (s, i) => { effect(s, 'customers', 1.1, 7, i.townId); return '유행에 맞춰 진열했어요. 7일간 손님 +10%.'; } }],
      ignore: { info: () => '7일간 손님 −10%', run: (s, i) => { effect(s, 'customers', .9, 7, i.townId); return '경쟁 가게가 유행 손님을 가져갔어요. 7일간 손님 −10%.'; } } });

    def({ key: 'E34', name: '장날', cat: '시세', tier: 'day', easy: true,
      story: () => '내일은 장날이에요! 사람들이 잔뜩 몰려와요.',
      choices: [
        { label: '장터에 자리를 낸다', info: s => '−' + num(income(s) * .5) + ' G · 하루 손님 두 배', run: (s, i) => { gold(s, -income(s) * .5); effect(s, 'customers', 2, 1, i.townId); return '장터 자리를 잡았어요. 하루 손님 두 배!'; } },
        { label: '가게 앞에 좌판', info: () => '하루 손님 +50%', run: (s, i) => { effect(s, 'customers', 1.5, 1, i.townId); return '좌판에 사람들이 기웃거려요. 하루 손님 +50%.'; } }],
      ignore: { info: () => '하루 손님 −30%', run: (s, i) => { effect(s, 'customers', .7, 1, i.townId); return '손님들이 장터로 빠졌어요. 하루 손님 −30%.'; } } });

    def({ key: 'E35', name: '짙은 안개', cat: '날씨', tier: 'instant', easy: true,
      story: () => '앞이 안 보일 만큼 안개가 짙어요.',
      choices: [
        { label: '등불을 켠다', info: () => '나무 5 · 손님 평소대로', can: s => (s.materials.wood || 0) < 5 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 5); return '등불을 보고 손님들이 찾아와요.'; } },
        { label: '작업에 집중', info: () => '하루 판매가 −30% · 제작 속도 +30%', run: (s, i) => { effect(s, 'sale', .7, 1, i.townId); effect(s, 'craft', 1.3, 1, i.townId); return '안개 낀 날은 망치질하기 좋은 날!'; } }],
      ignore: { info: () => '하루 손님 −50%', run: (s, i) => { effect(s, 'customers', .5, 1, i.townId); return '안개 때문에 손님이 반으로 줄었어요.'; } } });

    def({ key: 'E36', name: '유성우 밤', cat: '날씨', tier: 'day', opportunity: true, when: (s, t) => t.staff.length >= 1,
      story: () => '마을 뒷산에 별똥별이 쏟아져요!',
      choices: [
        { label: '직원을 보낸다', info: s => '직원 1명 하루 쉼 · ' + (mythrilTime(s) ? '수정 15 · 미스릴 5' : '수정 20'), run: (s, i) => { const t = townOf(s, i), w = t.staff[int(s, 0, t.staff.length - 1)]; effect(s, 'staff:' + w.id, 0, 1, i.townId); if (mythrilTime(s)) { addMat(s, 'crystal', 15); addMat(s, 'mythril', 5); } else addMat(s, 'crystal', 20); return w.name + '이(가) 반짝이는 돌을 한가득 주워 왔어요.'; } },
        { label: '모험가에게 부탁한다', info: s => '−' + num(income(s) * .4) + ' G · 수정 10', run: s => { gold(s, -income(s) * .4); addMat(s, 'crystal', 10); return '모험가가 수정을 주워 왔어요.'; } }],
      ignore: { info: () => '손해 없음', run: () => '별 구경만 했어요.' } });

    // 특별·희귀
    def({ key: 'E37', name: '전설의 대장장이 유령', cat: '특별', tier: 'instant', when: s => maxLevel(s) >= 4 && season(s) === 4 && night(s),
      story: () => '겨울밤, 모루 옆에 수염 난 대장장이 유령이 나타났어요…',
      choices: [
        { label: '이야기를 듣는다', info: () => '다음 제작 5번 품질 +1단계', run: s => { s.incidents.qualityBoost += 5; return '유령이 옛 비법을 알려 줬어요. 다음 제작 5번 품질 +1단계.'; } },
        { label: '망치를 건넨다', info: () => '창고 무기 1개 · 7일간 제작 속도 +30%', can: (s, i) => freeItems(s, townOf(s, i)).some(x => x.slot === 'weapon') ? '' : '창고에 무기 없음', run: (s, i) => { const t = townOf(s, i), item = freeItems(s, t).find(x => x.slot === 'weapon'); removeItem(t, item); effect(s, 'craft', 1.3, 7, i.townId); return '유령이 망치를 축복해 줬어요. 7일간 제작 속도 +30%.'; } }],
      ignore: { info: () => '3일간 화덕 하나가 꺼짐', run: (s, i) => { const f = furnaces(townOf(s, i))[0]; if (f) effect(s, 'furnace:' + f.id, 0, 3, i.townId); return '유령이 화가 나서 화덕 하나를 꺼 버렸어요(3일).'; } } });

    def({ key: 'E38', name: '왕실 사자', cat: '특별', tier: 'week', when: s => towns(s).length >= 3,
      story: () => '왕실이 걸작 이상 갑옷 1점을 30일 안에 바치라고 해요.',
      choices: [
        { label: '받든다', info: s => '30일 안에 걸작 이상 갑옷 · +' + num(income(s) * 12) + ' G · 명성 +25 · 칭호 · 못 내면 명성 −8', run: s => ({ task: { type: 'deliver', days: 30, needs: [{ slot: 'armor', n: 1, quality: 'masterwork', label: '걸작 이상 갑옷' }], reward: Math.round(income(s) * 12), rep: 25, failRep: -8, title: 'royal' } }) },
        { label: '사양한다', info: () => '명성 −2', run: s => { rep(s, -2); return '아직 실력이 모자라다고 정중히 사양했어요. 명성 −2.'; } }],
      ignore: { info: () => '명성 −6', run: s => { rep(s, -6); return '왕실의 부름을 무시했어요. 명성 −6.'; } } });

    def({ key: 'E39', name: '떠돌이 고양이', cat: '특별', tier: 'three', opportunity: true, when: s => !s.incidents.flags.mascot,
      story: () => '대장간 문 앞에 털이 보송한 고양이가 눌러앉았어요.',
      choices: [
        { label: '이름 지어 들인다', info: s => '−' + num(income(s) * .3) + ' G · 손님 +5% (계속) · 쥐 사건 없음', run: s => { gold(s, -income(s) * .3); s.incidents.flags.mascot = true; return '고양이가 대장간 마스코트가 됐어요!'; } },
        { label: '우유만 주고 보낸다', info: () => '명성 +1', run: s => { rep(s, 1); return '고양이가 우유를 다 먹고 꼬리를 흔들며 갔어요.'; } }],
      ignore: { info: () => '손해 없음', run: () => '고양이는 생선 가게로 갔어요.' } });

    def({ key: 'E40', name: '오래된 지도', cat: '특별', tier: 'week', opportunity: true, when: (s, t) => towns(s).length >= 2 && residents(s, t).length >= 4,
      setup: (s, t, d) => { d.power = missionPower(s, t, 1); },
      story: () => '낡은 지도에 숨겨진 장소가 표시돼 있어요.',
      choices: [
        { label: '탐험대를 보낸다', info: () => '3~5명 · 3일 · 재료 대량과 골드', run: (s, i) => ({ task: { type: 'mission', min: 3, max: 5, power: i.data.power, days: 3, bonus: i.data.bonus || 0, win: { gold: income(s) * 4, mats: mythrilTime(s) ? { crystal: 30, mythril: 15, iron: 30 } : { crystal: 40, iron: 40 }, rep: 4, text: '숨겨진 보물 창고를 찾았어요! 재료와 골드를 가득 얻었어요.' }, lose: { text: '탐험대가 길을 잃고 돌아왔어요.' } } }) },
        { label: '감정사에게 먼저 보인다', info: s => '−' + num(income(s) * .6) + ' G · 성공률 +20% · 마감 7일 다시 시작', keep: true, run: (s, i) => { gold(s, -income(s) * .6); i.data.bonus = .2; i.deadline = s.time + 7 * DAY; i.data.appraised = true; return '감정사가 지도를 자세히 읽어 줬어요. 탐험 성공률 +20%.'; }, can: (s, i) => i.data.appraised ? '이미 감정함' : '' }],
      ignore: { info: () => '손해 없음 (지도가 사라짐)', run: () => '지도가 바래서 읽을 수 없게 됐어요.' } });

    // ===== 2차 (2026-11-09, docs/quests-events2-crisis-v1.md B): follow-ups (E41-E44) and town incidents (E45-E59) =====
    const allPrices = (mult, days) => ['iron', 'wood', 'leather', 'crystal', 'mythril'].map(mat => ['price:' + mat, mult, days]);
    def({ key: 'E41', name: '견습생의 첫 작품', cat: '직원', tier: 'three', after: { key: 'E05', choice: 0, days: 20 },
      story: () => '그때 받아 준 견습생이 처음으로 혼자 만든 칼을 들고 왔어요. 조금 삐뚤지만 눈이 반짝여요.',
      choices: [
        { label: '칭찬해 준다', info: () => '직원 모두 3일간 작업 속도 +10%', run: (s, i) => { effect(s, 'craft', 1.1, 3, i.townId); return '견습생이 신이 나서 모두 기운이 났어요. 3일간 제작 속도 +10%.'; } },
        { label: '냉정하게 평가한다', info: () => '다음 제작 3번 품질 +1단계', run: s => { s.incidents.qualityBoost += 3; return '고칠 점을 꼼꼼히 짚어 줬어요. 다음 제작 3번 품질 +1단계.'; } }],
      ignore: { info: () => '3일간 제작 속도 −10%', run: (s, i) => { effect(s, 'craft', .9, 3, i.townId); return '봐 주지 않아 견습생이 기가 죽었어요. 3일간 제작 속도 −10%.'; } } });

    def({ key: 'E42', name: '경쟁 가게의 도전장', cat: '마을', tier: 'week', after: { key: 'E25', choice: 1, days: 15 },
      story: () => '품질로 승부하겠다는 소문을 들은 경쟁 가게가 도전장을 보냈어요. "누구 칼이 더 좋은지 겨뤄 봅시다!"',
      choices: [
        { label: '도전을 받는다', info: () => '7일 안에 우수 이상 무기 1개 납품 · 이기면 30일간 손님 +10% · 못 내면 명성 −3', run: s => ({ task: { type: 'deliver', days: 7, needs: [{ slot: 'weapon', quality: 'fine', n: 1, label: '우수 이상 무기' }], reward: Math.round(income(s)), rep: 6, failRep: -3, effects: [['customers', 1.1, 30]], winText: '경쟁 가게가 문을 닫았어요! 30일간 손님 +10%' } }) },
        { label: '상대하지 않는다', info: () => '명성 −1', run: s => { rep(s, -1); return '못 본 척했어요. 명성 −1.'; } }],
      ignore: { info: () => '명성 −2', run: s => { rep(s, -2); return '도전을 피했다는 소문이 났어요. 명성 −2.'; } } });

    def({ key: 'E43', name: '새끼 고양이 세 마리', cat: '특별', tier: 'three', opportunity: true, after: { key: 'E39', choice: 0, days: 30 },
      story: () => '마스코트 고양이가 새끼 세 마리를 낳았어요! 대장간이 시끌벅적해요.',
      choices: [
        { label: '이웃에게 분양한다', info: () => '명성 +5', run: s => { rep(s, 5); return '이웃들이 고마워하며 데려갔어요. 명성 +5'; } },
        { label: '모두 키운다', info: s => '−' + num(income(s) * .3) + ' G 사료 · 손님 +3% (계속)', run: s => { gold(s, -income(s) * .3); s.incidents.flags.kittens = true; return '고양이 넷이 손님을 맞아요. 손님 +3%(계속).'; } }],
      ignore: { info: () => '손해 없음', run: () => '새끼들은 어미 곁에서 무럭무럭 자라요.' } });

    def({ key: 'E44', name: '왕실의 두 번째 주문', cat: '특별', tier: 'week', when: s => !!s.incidents.flags.royal && !s.incidents.flags.royal2,
      story: () => '지난 진상에 만족한 왕실이 이번에는 전설 등급 장신구를 30일 안에 바치라고 해요.',
      choices: [
        { label: '받든다', info: s => '30일 안에 전설 이상 장신구 · +' + num(income(s) * 20) + ' G · 명성 +40 · 칭호 · 못 내면 명성 −8', run: s => ({ task: { type: 'deliver', days: 30, needs: [{ slot: 'accessory', n: 1, quality: 'legendary', label: '전설 이상 장신구' }], reward: Math.round(income(s) * 20), rep: 40, failRep: -8, title: 'royal2' } }) },
        { label: '사양한다', info: () => '명성 −3', run: s => { rep(s, -3); return '정중히 사양했어요. 명성 −3.'; } }],
      ignore: { info: () => '명성 −6', run: s => { rep(s, -6); return '왕실의 두 번째 부름을 무시했어요. 명성 −6.'; } } });

    // 초록숲
    def({ key: 'E45', name: '숲의 정령', cat: '특별', tier: 'day', town: 'greenwood', easy: true, opportunity: true,
      story: () => '숲 가장자리 장작더미 위에 반짝이는 작은 잎사귀 정령이 나타났어요.',
      choices: [
        { label: '나무를 바친다', info: () => '나무 10 · 7일간 나무 값 −30%', can: s => (s.materials.wood || 0) < 10 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 10); effect(s, 'price:wood', .7, 7); return '정령이 기뻐하며 숲에 바람을 불어 줬어요. 7일간 나무 값 −30%.'; } },
        { label: '하던 일을 한다', info: () => '변화 없음', run: () => '정령은 조용히 숲으로 돌아갔어요.' }],
      ignore: { info: () => '손해 없음', run: () => '정령이 사라졌어요.' } });

    def({ key: 'E46', name: '멧돼지 무리', cat: '마을', tier: 'three', town: 'greenwood', when: (s, t) => residents(s, t).length >= 3,
      setup: (s, t, d) => { d.power = missionPower(s, t, .8); },
      story: () => '통통한 멧돼지 무리가 마을 울타리를 들이받고 있어요!',
      choices: [
        { label: '사냥대를 보낸다', info: () => '2~3명 · 하루 · 이기면 가죽 대량', run: (s, i) => ({ task: { type: 'mission', min: 2, max: 3, power: i.data.power, days: 1, win: { mats: { leather: 40 }, rep: 2, text: '멧돼지를 쫓아내고 가죽을 잔뜩 얻었어요.' }, lose: { injure: true, effects: [['customers', .85, 3]], text: '멧돼지에게 밀려났어요.' } } }) },
        { label: '울타리를 세운다', info: () => '나무 15', can: s => (s.materials.wood || 0) < 15 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 15); return '튼튼한 울타리로 막았어요.'; } }],
      ignore: { info: () => '3일간 손님 −15%', run: (s, i) => { effect(s, 'customers', .85, 3, i.townId); return '멧돼지가 길을 막아 손님이 줄었어요. 3일간 −15%.'; } } });

    def({ key: 'E47', name: '숲속 장터', cat: '시세', tier: 'day', town: 'greenwood', easy: true,
      story: () => '큰 나무 아래 숲속 장터가 열려요. 등불이 줄줄이 걸렸어요.',
      choices: [
        { label: '좌판을 편다', info: () => '하루 손님 +40%', run: (s, i) => { effect(s, 'customers', 1.4, 1, i.townId); return '좌판에 사람들이 몰렸어요. 하루 손님 +40%.'; } },
        { label: '구경만 한다', info: () => '변화 없음', run: () => '장터를 둘러보고 왔어요.' }],
      ignore: { info: () => '하루 손님 −10%', run: (s, i) => { effect(s, 'customers', .9, 1, i.townId); return '손님들이 장터로 빠졌어요. 하루 −10%.'; } } });

    // 돌다리
    def({ key: 'E48', name: '다리 보수 공사', cat: '마을', tier: 'three', town: 'stonebridge',
      story: () => '오래된 돌다리에 금이 갔어요. 고치지 않으면 길이 막혀요.',
      choices: [
        { label: '돈을 보탠다', info: s => '−' + num(income(s) * 2) + ' G · 명성 +5 · 7일간 재료 값 −10%', can: s => s.gold < income(s) * 2 ? '골드 부족' : '', run: s => { gold(s, -income(s) * 2); rep(s, 5); for (const [k, mult, days] of allPrices(.9, 7)) effect(s, k, mult, days); return '다리가 튼튼해졌어요. 명성 +5, 7일간 재료 값 −10%.'; } },
        { label: '철을 보탠다', info: () => '철 30 · 명성 +2', can: s => (s.materials.iron || 0) < 30 ? '철 부족' : '', run: s => { takeMat(s, 'iron', 30); rep(s, 2); return '철을 보태 다리를 고쳤어요. 명성 +2'; } }],
      ignore: { info: () => '5일간 재료 매입 중단', run: s => { effect(s, 'buyStop', 0, 5); return '다리가 막혔어요. 5일간 재료를 살 수 없어요.'; } } });

    def({ key: 'E49', name: '유적에서 나온 녹슨 검', cat: '특별', tier: 'three', town: 'stonebridge', opportunity: true, when: (s, t) => weaponRecipes(s, t).length > 0,
      story: () => '모험가가 유적에서 희미하게 빛나는 녹슨 검을 주워 왔어요.',
      choices: [
        { label: '복원한다', info: () => '수정 10 · 2일 뒤 우수 이상 무기 1개', can: s => (s.materials.crystal || 0) < 10 ? '수정 부족' : '', run: s => { takeMat(s, 'crystal', 10); return { task: { type: 'wait', days: 2, item: { slot: 'weapon', quality: 'fine' }, text: '복원이 끝났어요! 빛나는 무기를 창고에 넣었어요.' } }; } },
        { label: '녹여서 쓴다', info: () => '철 20', run: s => { const n = addMat(s, 'iron', 20); return '녹여서 철 ' + n + '개를 얻었어요.'; } }],
      ignore: { info: () => '손해 없음', run: () => '검은 다시 먼지에 묻혔어요.' } });

    def({ key: 'E50', name: '광부 조합 파업', cat: '시세', tier: 'day', town: 'stonebridge',
      story: () => '광부들이 곡괭이를 내려놓고 광산 앞에 주저앉았어요.',
      choices: [
        { label: '국밥을 대접한다', info: s => '−' + num(income(s) * .8) + ' G · 7일간 철 값 −15%', run: s => { gold(s, -income(s) * .8); effect(s, 'price:iron', .85, 7); return '배부른 광부들이 다시 일하러 갔어요. 7일간 철 값 −15%.'; } },
        { label: '버틴다', info: () => '3일간 철 값 +10%', run: s => { effect(s, 'price:iron', 1.1, 3); return '파업이 금방 끝났어요. 3일간 철 값 +10%.'; } }],
      ignore: { info: () => '7일간 철 값 +25%', run: s => { effect(s, 'price:iron', 1.25, 7); return '파업이 길어졌어요. 7일간 철 값 +25%.'; } } });

    // 달빛 항구
    def({ key: 'E51', name: '난파선 인양품', cat: '특별', tier: 'week', town: 'moonhaven', opportunity: true, when: (s, t) => residents(s, t).length >= 3,
      setup: (s, t, d) => { d.power = missionPower(s, t, 1); },
      story: () => '맑은 바닷속에 가라앉은 배가 보여요. 보물 상자도요!',
      choices: [
        { label: '잠수 탐사대를 보낸다', info: () => '3~4명 · 2일 · 미스릴·수정 대량', run: (s, i) => ({ task: { type: 'mission', min: 3, max: 4, power: i.data.power, days: 2, win: { gold: income(s) * 2, mats: { mythril: 25, crystal: 25 }, rep: 3, text: '보물 상자를 건져 올렸어요!' }, lose: { text: '파도가 거세서 빈손으로 돌아왔어요.' } } }) },
        { label: '어부에게 사들인다', info: s => '−' + num(income(s)) + ' G · 미스릴 10', run: s => { gold(s, -income(s)); const n = addMat(s, 'mythril', 10); return '어부에게 미스릴 ' + n + '개를 샀어요.'; } }],
      ignore: { info: () => '손해 없음', run: () => '다른 사람이 먼저 건져 갔대요.' } });

    def({ key: 'E52', name: '해적 소문', cat: '마을', tier: 'three', town: 'moonhaven',
      story: () => '수평선에 검은 돛배가 보였다는 소문이 돌아요.',
      choices: [
        { label: '경비대에 무기를 기부한다', info: () => '창고 무기 5개 · 명성 +8', can: (s, i) => freeItems(s, townOf(s, i)).filter(x => x.slot === 'weapon').length >= 5 ? '' : '창고에 무기 5개 없음', run: (s, i) => { const t = townOf(s, i); for (const x of freeItems(s, t).filter(x => x.slot === 'weapon').sort((a, b) => a.price - b.price).slice(0, 5)) removeItem(t, x); rep(s, 8); return '경비대가 든든해졌어요. 명성 +8'; } },
        { label: '문을 일찍 닫는다', info: () => '3일간 판매가 −20%', run: (s, i) => { effect(s, 'sale', .8, 3, i.townId); return '조심해서 손해는 없었어요. 3일간 판매가 −20%.'; } }],
      ignore: { info: () => '진열 장비 1개 도난', run: (s, i) => { const t = townOf(s, i), x = t.inventory.filter(x => x.listed && !x.locked && !reserved(s, x)).sort((a, b) => b.price - a.price)[0]; if (!x) return '해적은 오지 않았어요.'; removeItem(t, x); return '해적이 진열대의 ' + x.name + '을(를) 훔쳐 갔어요.'; } } });

    def({ key: 'E53', name: '큰 배 입항', cat: '손님', tier: 'day', town: 'moonhaven', when: (s, t) => t.inventory.some(x => x.listed),
      story: () => '커다란 상선이 들어왔어요. 선원들이 돈주머니를 흔들며 내려와요.',
      choices: [
        { label: '선원들에게 판다', info: () => '진열 장비 전부 시세 +10%', run: (s, i) => { const t = townOf(s, i), items = t.inventory.filter(x => x.listed && !x.locked && !reserved(s, x)); let g = 0; for (const x of items) g += sell(s, t, x, 1.1); return '진열 장비 ' + items.length + '개를 팔았어요. +' + num(g) + ' G'; } },
        { label: '구경만 한다', info: () => '변화 없음', run: () => '배를 구경하고 왔어요.' }],
      ignore: { info: () => '하루 손님 −10%', run: (s, i) => { effect(s, 'customers', .9, 1, i.townId); return '손님들이 부두로 몰려갔어요. 하루 −10%.'; } } });

    // 해오름 성채
    def({ key: 'E54', name: '기사단 열병식', cat: '마을', tier: 'week', town: 'sunspire',
      story: () => '기사단이 열병식에 입을 중갑 5벌을 15일 안에 납품해 달래요.',
      choices: [
        { label: '받든다', info: s => '15일 안에 중갑 5개 · +' + num(income(s) * 6) + ' G · 명성 +15 · 못 내면 명성 −4', run: s => ({ task: { type: 'deliver', days: 15, needs: [{ family: 'heavy', n: 5, label: '중갑' }], reward: Math.round(income(s) * 6), rep: 15, failRep: -4 } }) },
        { label: '사양한다', info: () => '명성 −2', run: s => { rep(s, -2); return '정중히 사양했어요. 명성 −2.'; } }],
      ignore: { info: () => '명성 −4', run: s => { rep(s, -4); return '기사단이 대답을 기다리다 떠났어요. 명성 −4.'; } } });

    def({ key: 'E55', name: '사막 모래폭풍', cat: '날씨', tier: 'instant', town: 'sunspire',
      story: () => '모래폭풍이 성채를 덮쳐요! 창문이 덜컹거려요.',
      choices: [
        { label: '창문을 막는다', info: () => '나무 10', can: s => (s.materials.wood || 0) < 10 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 10); return '판자로 꼭꼭 막았어요. 피해 없음!'; } },
        { label: '작업을 멈춘다', info: () => '하루 화덕 전부 멈춤', run: (s, i) => { for (const f of furnaces(townOf(s, i))) effect(s, 'furnace:' + f.id, 0, 1, i.townId); return '모래가 잦아들 때까지 하루 쉬었어요.'; } }],
      ignore: { info: () => '재료 10% 손실 · 하루 판매가 −30%', run: (s, i) => { for (const mat of ['iron', 'wood', 'leather']) lose(s, mat, .1); effect(s, 'sale', .7, 1, i.townId); return '모래가 들이쳐 재료 10%를 잃었어요. 하루 판매가 −30%.'; } } });

    def({ key: 'E56', name: '용 비늘 상인', cat: '손님', tier: 'three', town: 'sunspire', opportunity: true,
      story: () => '두건 쓴 상인이 붉은 용 비늘이 가득한 상자를 열어 보여요.',
      choices: [
        { label: '산다', info: s => '−' + num(income(s) * 3) + ' G · 다음 제작 5번 품질 +1단계', can: s => s.gold < income(s) * 3 ? '골드 부족' : '', run: s => { gold(s, -income(s) * 3); s.incidents.qualityBoost += 5; return '용 비늘을 담금질에 섞어요. 다음 제작 5번 품질 +1단계.'; } },
        { label: '깎는다', info: s => '반반: ' + num(income(s) * 1.5) + ' G에 사거나 상인이 떠남', can: s => s.gold < income(s) * 1.5 ? '골드 부족' : '', run: s => { if (random(s) < .5) { gold(s, -income(s) * 1.5); s.incidents.qualityBoost += 5; return '반값에 샀어요! 다음 제작 5번 품질 +1단계.'; } return '상인이 상자를 닫고 떠났어요.'; } }],
      ignore: { info: () => '손해 없음', run: () => '상인은 사막으로 떠났어요.' } });

    // 서리문
    def({ key: 'E57', name: '눈사태로 고립된 상단', cat: '마을', tier: 'three', town: 'frostgate', when: (s, t) => residents(s, t).length >= 3,
      setup: (s, t, d) => { d.power = missionPower(s, t, .95); },
      story: () => '눈사태로 상단 마차가 눈 속에 갇혔어요. 말들이 떨고 있어요.',
      choices: [
        { label: '구조대를 보낸다', info: () => '3~5명 · 2일 · 사례로 재료 대량 · 명성 +6', run: (s, i) => ({ task: { type: 'mission', min: 3, max: 5, power: i.data.power, days: 2, win: { mats: { mythril: 20, crystal: 20, leather: 30 }, rep: 6, text: '상단을 구해 냈어요! 사례로 재료를 잔뜩 받았어요.' }, lose: { injure: true, text: '눈보라에 밀려 돌아왔어요.' } } }) },
        { label: '썰매를 빌려준다', info: s => '−' + num(income(s)) + ' G · 명성 +3', run: s => { gold(s, -income(s)); rep(s, 3); return '썰매로 상단이 빠져나왔어요. 명성 +3'; } }],
      ignore: { info: () => '명성 −4 · 7일간 재료 값 +15%', run: s => { rep(s, -4); for (const [k, mult, days] of allPrices(1.15, 7)) effect(s, k, mult, days); return '상단이 오지 못해 재료가 귀해졌어요. 명성 −4, 7일간 재료 값 +15%.'; } } });

    def({ key: 'E58', name: '오로라의 밤', cat: '날씨', tier: 'day', town: 'frostgate', opportunity: true,
      story: () => '하늘에 초록빛·보랏빛 오로라가 춤춰요.',
      choices: [
        { label: '밤새 일한다', info: () => '하루 제작 속도 +40% · 다음 날 −15%', run: (s, i) => { effect(s, 'craft', 1.4, 1, i.townId); s.incidents.effects.push({ key: 'craft', mult: .85, from: s.time + DAY, until: s.time + 2 * DAY, townId: i.townId }); return '오로라 아래 망치 소리가 밤새 울렸어요.'; } },
        { label: '축제처럼 쉰다', info: () => '3일간 제작 속도 +15%', run: (s, i) => { effect(s, 'craft', 1.15, 3, i.townId); return '푹 쉬고 나니 모두 힘이 나요. 3일간 +15%.'; } }],
      ignore: { info: () => '손해 없음', run: () => '오로라를 구경만 했어요.' } });

    def({ key: 'E59', name: '얼어붙은 화덕', cat: '사고', tier: 'instant', town: 'frostgate', when: (s, t) => furnaces(t).length > 0,
      setup: (s, t, d) => { const list = furnaces(t); d.facilityId = list[int(s, 0, list.length - 1)].id; },
      story: () => '밤새 추위에 화덕 하나가 꽁꽁 얼었어요. 굴뚝에 고드름이 달렸어요.',
      choices: [
        { label: '장작을 더 넣는다', info: () => '나무 15', can: s => (s.materials.wood || 0) < 15 ? '나무 부족' : '', run: s => { takeMat(s, 'wood', 15); return '불길이 되살아났어요!'; } },
        { label: '그대로 둔다', info: () => '그 화덕 하루 멈춤', run: (s, i) => { effect(s, 'furnace:' + i.data.facilityId, 0, 1, i.townId); return '하루 동안 녹기를 기다려요.'; } }],
      ignore: { info: () => '그 화덕 이틀 멈춤', run: (s, i) => { effect(s, 'furnace:' + i.data.facilityId, 0, 2, i.townId); return '화덕이 이틀 동안 얼어 있어요.'; } } });

    const catalog = Object.fromEntries(E.map(e => [e.key, e]));

    // ---------- lifecycle ----------
    function open(s) { return s.incidents.list.filter(i => i.status === 'pending' || i.status === 'active'); }
    function eligible(s, t) {
      const st = s.incidents, early = maxLevel(s) < 2;
      return E.filter(e => {
        if (open(s).some(i => i.key === e.key)) return false;
        if (st.lastSeen[e.key] != null && s.time - st.lastSeen[e.key] < REPEAT_DAYS * DAY) return false;
        if (early && !e.easy && !e.after) return false; // a follow-up the player set up may come early too
        if (e.tier === 'instant' && open(s).some(i => i.tier === 'instant' && i.status === 'pending')) return false;
        if (e.key === 'E12' && (st.flags.cat || st.flags.mascot)) return false;
        if (e.town && t.id !== e.town) return false; // 2차: town-only incidents
        if (e.after && !chainReady(s, e)) return false; // 2차: follows an earlier choice
        try { return !e.when || e.when(s, t); } catch (_) { return false; }
      });
    }
    // A chained incident waits for the earlier one's choice (remembered) plus some days, and comes once per that choice.
    // A follow-up is booked when its earlier choice is made (st.chains[key] = due time) and kept until it appears,
    // so answering the earlier incident differently later does not cancel it.
    function chainReady(s, e) { const due = s.incidents.chains && s.incidents.chains[e.key]; return Number.isFinite(due) && s.time >= due; }
    function remember(s, inc, choice, labelText) {
      const st = s.incidents; if (!object(st.memory)) st.memory = {}; if (!object(st.chains)) st.chains = {};
      st.memory[inc.key] = { choice, label: labelText, at: s.time, incId: inc.id, text: '' };
      for (const f of E) if (f.after && f.after.key === inc.key && f.after.choice === choice && st.chains[f.key] == null) st.chains[f.key] = s.time + f.after.days * DAY;
    }
    function spawn(s, key) {
      const st = init(s), named = key ? catalog[key] : null;
      // A named town incident (E45~E59) happens in its own town, wherever the player is looking.
      let t = named && named.town ? (towns(s).find(x => x.id === named.town) || null) : activeTown(s); if (!t) return null;
      let e = named, data = {};
      if (!e) {
        // General incidents happen in the town on screen; each town's own incidents (E45~E59) are checked against that town,
        // so they come even while the player looks elsewhere (2026-11-09: before, other towns' incidents never came).
        let list = eligible(s, t).filter(x => !x.town).map(x => ({ e: x, t }));
        for (const tt of towns(s)) list.push(...eligible(s, tt).filter(x => x.town === tt.id).map(x => ({ e: x, t: tt })));
        if (st.flags.grudge && s.time - st.flags.grudge < 15 * DAY && list.some(x => x.e.key === 'E13')) list = list.filter(x => x.e.key === 'E13');
        if (list.some(x => x.e.after)) list = list.filter(x => x.e.after); // a waiting follow-up comes first
        // Never raise an incident the player cannot answer right now (every choice blocked = a forced loss).
        while (list.length) {
          const one = list.splice(int(s, 0, list.length - 1), 1)[0], pick = one.e, d = {};
          try { if (pick.setup) pick.setup(s, one.t, d); } catch (_) { continue; }
          const probe = { key: pick.key, townId: one.t.id, data: d, status: 'pending' };
          let open = false; try { open = pick.choices.some(c => !c.can || !c.can(s, probe)); } catch (_) {}
          if (open) { e = pick; data = d; t = one.t; break; }
        }
        if (!e) return null;
      } else {
        try { if (e.setup) e.setup(s, t, data); } catch (_) { return null; }
      }
      const inc = { id: id(s, 'incident'), key: e.key, tier: e.tier, townId: t.id, createdAt: s.time, status: 'pending', deadline: e.tier === 'instant' ? null : s.time + TIERS[e.tier].days * DAY, instantLeft: e.tier === 'instant' ? INSTANT_REAL_SECONDS : null, data, task: null, result: null };
      st.list.push(inc); st.lastSeen[e.key] = s.time;
      if (st.chains && st.chains[e.key] != null) delete st.chains[e.key]; // a booked follow-up has now come
      if (e.key === 'E13') delete st.flags.grudge;
      log(s, 'incident', '돌발 사건 · ' + e.name + ' (' + TIERS[e.tier].label + ')', { townId: t.id, incidentId: inc.id });
      return inc;
    }
    function finish(s, inc, text, ok) {
      inc.status = 'done'; inc.result = text; inc.doneAt = s.time; inc.task = inc.task && inc.task.type === 'mission' ? { type: 'mission', done: true } : null;
      if (ok) s.incidents.resolved++; else s.incidents.missed++;
      const m = s.incidents.memory && s.incidents.memory[inc.key]; if (m && m.incId === inc.id) m.text = String(text).slice(0, 80);
      log(s, 'incident-result', catalog[inc.key].name + ' · ' + text, { townId: inc.townId, incidentId: inc.id });
    }
    function startTask(s, inc, task) {
      // A dispatch must be sent within 3 days (then it is away task.days); other tasks run task.days.
      task.until = s.time + (task.type === 'mission' ? 3 : task.days) * DAY; inc.task = task; inc.status = 'active';
      if (task.type === 'deliver') task.done = task.needs.map(() => 0);
    }
    function choose(s, incId, index) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'pending');
      if (!inc) return result(false, '이미 끝난 사건이에요.');
      const e = catalog[inc.key], c = e.choices[index]; if (!c) return result(false, '고를 수 없는 선택이에요.');
      const why = c.can ? c.can(s, inc) : ''; if (why) return result(false, why);
      if (!c.keep) remember(s, inc, index, label(c, s, inc));
      const out = c.run(s, inc);
      if (out && out.task) { startTask(s, inc, out.task); return result(true, label(c, s, inc) + ' · 진행 중', { incident: inc }); }
      if (c.keep) return result(true, out, { incident: inc });
      finish(s, inc, out, true);
      return result(true, out, { incident: inc });
    }
    const label = (c, s, inc) => typeof c.label === 'function' ? c.label(s, inc) : c.label;
    function matches(item, need) { return (!need.recipeId || item.recipeId === need.recipeId) && (!need.slot || item.slot === need.slot) && (!need.family || (DATA.recipes.find(r => r.id === item.recipeId) || {}).family === need.family) && (!need.quality || qualityRank(item.quality) >= qualityRank(need.quality)) && !item.heirloom; }
    function deliverables(s, inc) {
      const t = townOf(s, inc), used = new Set();
      return inc.task.needs.map((need, k) => { const left = need.n - inc.task.done[k]; const items = freeItems(s, t).filter(i => !used.has(i.id) && matches(i, need)).sort((a, b) => a.price - b.price).slice(0, left); for (const i of items) used.add(i.id); return items; });
    }
    // A warehouse piece an active incident asks for by name (the [만들기] kind) stays off the auto display until it is handed in.
    function holds(s, itemId) {
      const st = s.incidents; if (!st || !st.enabled || !Array.isArray(st.list)) return false;
      for (const inc of st.list) {
        if (inc.status !== 'active' || !inc.task || inc.task.type !== 'deliver') continue;
        const t = townOf(s, inc); if (!t || !t.inventory.some(i => i.id === itemId)) continue;
        for (let k = 0; k < inc.task.needs.length; k++) {
          const need = inc.task.needs[k]; if (!need.recipeId) continue;
          const left = need.n - inc.task.done[k]; if (left <= 0) continue;
          const kept = t.inventory.filter(i => !i.listed && !i.locked && !reserved(s, i) && matches(i, need)).sort((a, b) => a.price - b.price).slice(0, left);
          if (kept.some(i => i.id === itemId)) return true;
        }
      }
      return false;
    }
    // Recipes the incident window offers to make for a need: the named one, or (for "장신구 1개" kinds) the cheapest few that fit.
    const fitsRecipe = (r, need) => need.recipeId ? r.id === need.recipeId : (!need.slot || r.slot === need.slot) && (!need.family || r.family === need.family);
    function makeOptions(s, inc, need) {
      const t = townOf(s, inc); if (!t || !ctx.getUnlockedRecipes) return [];
      return ctx.getUnlockedRecipes(s, t.id).filter(r => !r.bossRecipe && !r.rare && fitsRecipe(r, need)).sort((a, b) => a.price - b.price).slice(0, 3);
    }
    const queuedFor = (s, inc, need) => { const t = townOf(s, inc); return t ? t.queue.filter(q => q.incidentId === inc.id && fitsRecipe(DATA.recipes.find(r => r.id === q.recipeId) || {}, need)).length : 0; };
    // The town to make a piece in, when the recipe still fills an open need of this delivery (null otherwise).
    function makeTown(s, incId, recipeId) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'active' && i.task && i.task.type === 'deliver'); if (!inc) return null;
      const r = DATA.recipes.find(x => x.id === recipeId); if (!r) return null;
      const sets = deliverables(s, inc);
      const open = inc.task.needs.some((need, k) => fitsRecipe(r, need) && makeOptions(s, inc, need).some(o => o.id === r.id) && inc.task.done[k] + sets[k].length + queuedFor(s, inc, need) < need.n);
      return open ? inc.townId : null;
    }
    function deliver(s, incId, onlyItemId) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'active' && i.task && i.task.type === 'deliver');
      if (!inc) return result(false, '납품할 사건이 없어요.');
      const t = townOf(s, inc); let sets, n = 0;
      if (onlyItemId) { // a piece made from the incident window goes in as soon as it is finished
        const item = freeItems(s, t).find(i => i.id === onlyItemId), k = item ? inc.task.needs.findIndex((need, j) => inc.task.done[j] < need.n && matches(item, need)) : -1;
        sets = inc.task.needs.map((_, j) => j === k ? [item] : []);
      } else sets = deliverables(s, inc);
      sets.forEach((items, k) => { for (const item of items) { removeItem(t, item); inc.task.done[k]++; n++; } });
      if (!n) return result(false, '창고에 맞는 장비가 없어요. (잠긴 장비는 제외)');
      if (inc.task.needs.every((need, k) => inc.task.done[k] >= need.n)) {
        const task = inc.task; gold(s, task.reward); rep(s, task.rep || 0);
        let text = '납품 완료! +' + num(task.reward) + ' G' + (task.rep ? ' · 명성 +' + task.rep : '');
        if (task.shady && random(s) < .3) { rep(s, -6); text += ' · 그런데 소문이 났어요. 명성 −6'; }
        if (task.title === 'royal') { st.flags.royal = true; text += ' · 칭호 「왕실 납품 대장간」'; }
        if (task.title === 'royal2') { st.flags.royal2 = true; text += ' · 칭호 「왕실 대장간」'; }
        for (const [key, mult, days] of task.effects || []) effect(s, key, mult, days, key.startsWith('price:') ? null : inc.townId);
        if (task.winText) text += ' · ' + task.winText;
        finish(s, inc, text, true);
        return result(true, text, { incident: inc });
      }
      return result(true, n + '개를 납품했어요. 남은 것: ' + inc.task.needs.map((need, k) => need.label + ' ' + (need.n - inc.task.done[k])).filter((x, k) => inc.task.needs[k].n - inc.task.done[k] > 0).join(', '), { incident: inc });
    }
    function missionInfo(s, incId) {
      const inc = s.incidents && s.incidents.list.find(i => i.id === incId); if (!inc || !inc.task || inc.task.type !== 'mission') return null;
      const t = townOf(s, inc);
      // Stable order (strongest first by level, then id) so the list does not jump around while heroes come and go.
      const list = residents(s, t).filter(a => !(inc.task.exclude || []).includes(a.id)).sort((x, y) => y.level - x.level || String(x.id).localeCompare(String(y.id)));
      return { min: inc.task.min, max: inc.task.max, power: inc.task.power, days: inc.task.days, sent: inc.task.heroIds || null,
        candidates: list.map(a => { const hard = missionHardBlock(s, a, inc), busy = hard ? '' : missionBlock(s, a, inc);
          return { id: a.id, name: a.name, level: a.level, job: a.job, power: ctx.getCombatStats(a).power, block: hard, busy, status: hard || busy || (a.status === 'resting' ? '쉬는 중 · 바로 출발' : '사냥 중 · 바로 출발') }; }) };
    }
    // Set out: the party leaves together once every picked hero is free.
    function departMission(s, inc, heroes) {
      const st = init(s), m = inc.task;
      m.gathering = false; m.chance = missionChance(s, inc, heroes); m.returnAt = s.time + m.days * DAY; m.until = Math.max(m.until, m.returnAt);
      // 위기 순간: once, at 40-70% of the trip, when the game has crises on.
      if (st.crisisOn) m.crisis = { at: s.time + m.days * DAY * (.4 + random(s) * .3), active: false, realLeft: 10, chosen: null, delta: 0 };
      for (const a of heroes) { a.missionId = inc.id; a.status = 'hunting'; a.timer = m.days * DAY; a.total = a.timer; a.path = []; a.destination = null; a.moving = false; a.bubble = null; a.bedId = null; a.huntOutcome = null; }
      log(s, 'incident', heroes.map(a => a.name).join('·') + ' · ' + catalog[inc.key].name + ' 파견 출발 · 예상 성공률 ' + Math.round(m.chance * 100) + '%', { townId: inc.townId, incidentId: inc.id });
    }
    function quoteMission(s, incId, heroIds) {
      const inc = s.incidents && s.incidents.list.find(i => i.id === incId); if (!inc || !inc.task) return 0;
      return missionChance(s, inc, (heroIds || []).map(h => s.adventurers.find(a => a.id === h)).filter(Boolean));
    }
    function sendMission(s, incId, heroIds) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'active' && i.task && i.task.type === 'mission' && !i.task.heroIds);
      if (!inc) return result(false, '보낼 파견이 없어요.');
      const m = inc.task;
      if (!Array.isArray(heroIds) || heroIds.length < m.min) return result(false, '최소 ' + m.min + '명을 골라 주세요.');
      if (heroIds.length > m.max || new Set(heroIds).size !== heroIds.length) return result(false, '최대 ' + m.max + '명까지 보낼 수 있어요.');
      const heroes = heroIds.map(h => s.adventurers.find(a => a.id === h));
      for (const a of heroes) { if ((m.exclude || []).includes(a && a.id)) return result(false, '그 모험가는 보낼 수 없어요.'); const why = missionHardBlock(s, a, inc); if (why) return result(false, (a ? a.name + ': ' : '') + why); }
      m.heroIds = heroIds.slice();
      const waiting = heroes.filter(a => missionBlock(s, a, inc));
      if (!waiting.length) { departMission(s, inc, heroes); return result(true, '파견을 보냈어요. 예상 성공률 ' + Math.round(m.chance * 100) + '%', { incident: inc }); }
      m.gathering = true; m.chance = missionChance(s, inc, heroes);
      log(s, 'incident', catalog[inc.key].name + ' 파견대가 모이는 중 · ' + waiting.map(a => a.name).join('·') + '을(를) 기다려요', { townId: inc.townId, incidentId: inc.id });
      return result(true, '파견대를 꾸렸어요. ' + waiting.map(a => a.name).join('·') + '이(가) 하던 일을 마치면 함께 출발해요.', { incident: inc });
    }
    // 합류 예상 (2026-11-10): game seconds until a waiting hero is likely free (injury, boss fight, hunt), or null.
    function joinEta(s, a, inc) {
      if (!missionBlock(s, a, inc)) return 0;
      if (a.injuryUntil > s.time) return a.injuryUntil - s.time;
      if (a.raidId) { const p = ((s.raidState && s.raidState.parties) || []).find(x => x.id === a.raidId); return p ? Math.max(0, p.remaining || 0) + 6 : null; }
      if (a.status === 'hunting' && a.timer > 0) return a.timer + 6;
      return null;
    }
    // 다시 고르기 (2026-11-10): a party still gathering can be let go and picked again (nobody has left yet).
    function regather(s, incId) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'active'), m = inc && inc.task;
      if (!m || m.type !== 'mission' || !m.gathering) return result(false, '모이는 중인 파견대가 없어요.');
      delete m.heroIds; m.gathering = false; m.chance = 0;
      return result(true, '파견대를 풀었어요. 다시 골라 주세요.', { incident: inc });
    }
    function chooseCrisis(s, incId, choice) {
      const st = init(s), inc = st.list.find(i => i.id === incId && i.status === 'active'), m = inc && inc.task, c = m && m.crisis;
      if (!c || !c.active) return result(false, '지금은 지원할 수 없어요.');
      if (choice === 'potion') { const cost = Math.round(income(s)); if (s.gold < cost) return result(false, '물약 값 ' + num(cost) + ' G가 모자라요.'); gold(s, -cost); c.delta = .12; }
      else if (choice === 'hold') c.delta = random(s) < .5 ? .06 : -.06;
      else if (choice !== 'retreat') return result(false, '고를 수 없는 선택이에요.');
      c.active = false; c.chosen = choice;
      if (choice === 'retreat') {
        for (const id of m.heroIds) { const a = s.adventurers.find(x => x.id === id); if (!a || a.missionId !== inc.id) continue; a.missionId = null; if (!a.invasionId && ctx.returnToTown) ctx.returnToTown(s, a, 'recalled'); }
        finish(s, inc, '파견대를 불러들였어요. 모두 다치지 않고 돌아와요.', false);
        return result(true, '후퇴 명령! 파견대가 돌아와요.');
      }
      m.chance = clamp((m.chance || 0) + c.delta, .05, .95);
      return result(true, choice === 'potion' ? '물약을 보냈어요. 성공률 +12%p' : c.delta > 0 ? '버텨 냈어요! 성공률 +6%p' : '버티다 밀렸어요… 성공률 −6%p');
    }
    function setCrisis(s, on) { init(s).crisisOn = on !== false; return s.incidents.crisisOn; }
    function applyOutcome(s, inc, o) {
      if (o.gold) gold(s, o.gold);
      if (o.rep) rep(s, o.rep);
      if (o.mats) for (const [m, n] of Object.entries(o.mats)) addMat(s, m, n);
      for (const [key, mult, days] of o.effects || []) effect(s, key, mult, days, key.startsWith('price:') || key === 'buyStop' ? null : inc.townId);
      if (o.leave) { const a = s.adventurers.find(a => a.id === o.leave); if (a && ctx.leaveTown) ctx.leaveTown(s, a); }
      return o.text;
    }
    function endMission(s, inc) {
      const m = inc.task, win = random(s) < (m.chance || 0);
      for (const id of m.heroIds || []) {
        const a = s.adventurers.find(a => a.id === id); if (!a || a.missionId !== inc.id) continue;
        a.missionId = null; const st = ctx.getCombatStats(a);
        a.fatigue = Math.min(100, (a.fatigue || 0) + (win ? 20 : 45)); a.hp = clamp(a.hp - st.maxHp * (win ? .15 : .45), 1, st.maxHp);
        if (!win && m.lose && m.lose.injure && random(s) < .5) a.injuryUntil = Math.max(a.injuryUntil || 0, s.time + DAY);
        if (!a.invasionId && ctx.returnToTown) ctx.returnToTown(s, a, win ? 'victory' : 'retreat');
      }
      finish(s, inc, applyOutcome(s, inc, win ? m.win : m.lose), win);
    }
    function dismiss(s, incId) {
      const st = init(s), i = st.list.findIndex(x => x.id === incId && x.status === 'done');
      if (i < 0) return result(false, '');
      st.list.splice(i, 1); return result(true, '');
    }
    function ignore(s, inc) {
      const e = catalog[inc.key]; let text = '';
      remember(s, inc, -1, '그냥 둠');
      try { text = e.ignore.run(s, inc); } catch (_) { text = '그냥 지나갔어요.'; }
      finish(s, inc, (e.opportunity ? '' : '놓쳤어요 · ') + text, false);
    }

    function step(s, dt) {
      const st = init(s);
      for (const inc of st.list) {
        if (inc.status === 'pending') {
          if (inc.tier === 'instant') { inc.instantLeft = Math.max(0, inc.instantLeft - dt / Math.max(.1, realRate)); if (inc.instantLeft <= 0) ignore(s, inc); }
          else if (s.time >= inc.deadline) ignore(s, inc);
        } else if (inc.status === 'active' && inc.task) {
          const m = inc.task;
          if (m.type === 'mission') {
            if (m.heroIds && m.gathering) { // waiting for picked heroes to finish what they are doing
              const heroes = m.heroIds.map(h => s.adventurers.find(a => a.id === h)).filter(a => a && !missionHardBlock(s, a, inc));
              if (heroes.length < m.min) { delete m.heroIds; m.gathering = false; m.until = Math.max(m.until, s.time + DAY); log(s, 'incident', catalog[inc.key].name + ' 파견대가 흩어졌어요. 다시 골라 주세요.', { townId: inc.townId, incidentId: inc.id }); continue; }
              m.heroIds = heroes.map(a => a.id);
              if (heroes.every(a => !missionBlock(s, a, inc))) departMission(s, inc, heroes);
              continue;
            }
            const c = m.heroIds && m.crisis;
            if (c && !c.chosen && !c.active && s.time >= c.at) { c.active = true; c.realLeft = 10; log(s, 'mission-crisis', catalog[inc.key].name + ' 파견대가 위기에 빠졌어요! 10초 안에 지원할 수 있어요.', { townId: inc.townId, incidentId: inc.id }); }
            if (c && c.active) { // the trip waits while the player chooses (real seconds)
              c.realLeft = Math.max(0, c.realLeft - dt / Math.max(.1, realRate)); m.returnAt += dt; m.until = Math.max(m.until, m.returnAt);
              for (const id of m.heroIds) { const a = s.adventurers.find(x => x.id === id); if (a && a.missionId === inc.id) a.timer = (a.timer || 0) + dt; }
              if (c.realLeft <= 0) { c.active = false; c.chosen = 'none'; }
              continue;
            }
            if (m.heroIds && s.time >= m.returnAt) endMission(s, inc);
            else if (!m.heroIds && s.time >= m.until) { finish(s, inc, '파견을 보내지 않아 기회가 지나갔어요.', false); try { if (!catalog[inc.key].opportunity) catalog[inc.key].ignore.run(s, inc); } catch (_) {} }
          } else if (m.type === 'deliver' && s.time >= m.until) {
            if (m.failRep) rep(s, m.failRep);
            finish(s, inc, '납품 기한을 넘겼어요' + (m.failRep ? ' · 명성 ' + m.failRep : ''), false);
          } else if (m.type === 'wait' && s.time >= m.until) {
            for (const [mat, n] of Object.entries(m.give || {})) addMat(s, mat, n);
            if (m.item && ctx.makeItem) { const t = townOf(s, inc), r = weaponRecipes(s, t).sort((a, b) => b.price - a.price)[0]; if (r) { const made = ctx.makeItem(s, t.id, r.id, m.item.quality || 'fine'); if (made) inc.data.itemId = made.id, inc.data.itemQuality = made.quality; } }
            finish(s, inc, m.text || '끝났어요.', true);
          }
        // 2026-11-10: a result waits 5 days (2 days was 30 real seconds at 2x — gone while another window was open).
        } else if (inc.status === 'done' && s.time - inc.doneAt > 5 * DAY) inc.remove = true;
      }
      st.list = st.list.filter(i => !i.remove);
      st.effects = st.effects.filter(e => e.until > s.time);
      // activate delayed effects
      // (an effect with "from" counts only once s.time >= from; see factor())
      const ready = towns(s).some(t => t.staff.length >= 1) && (s.day || 1) >= 3;
      if (!st.enabled) { if (st.nextAt < s.time + 3 * DAY) st.nextAt = s.time + 3 * DAY; return s; }
      if (s.time >= st.nextAt) {
        if (ready && open(s).length < MAX_LIST) spawn(s);
        st.nextAt = s.time + (5 + random(s) * 2) * DAY;
      }
      return s;
    }
    // delayed effects ("from"): rewrite factor to honour them
    function factorWithDelay(s, key, townId) {
      let f = 1; const st = s.incidents; if (!st) return 1;
      for (const e of st.effects) if (e.key === key && e.until > s.time && (e.from == null || s.time >= e.from) && (!e.townId || !townId || e.townId === townId)) f *= e.mult;
      if (key === 'customers' && st.flags.mascot) f *= 1.05;
      if (key === 'customers' && st.flags.kittens) f *= 1.03;
      if (key === 'price:leather' && f > 1 && st.list.some(i => i.key === 'E32' && i.status === 'done' && /길드/.test(i.result || ''))) f = 1;
      return f;
    }

    // Buffs / debuffs for the icons beside the calendar (user request 2026-11-09): what, how much, how long, good or bad.
    function effectsView(s) {
      const st = s.incidents; if (!st) return [];
      const pct = m => (m >= 1 ? '+' : '−') + Math.round(Math.abs(m - 1) * 100) + '%';
      const multi = towns(s).length > 1, townName = id => { const t = multi && id && getTown(s, id); return t ? t.name + ' · ' : ''; };
      const out = [];
      for (const e of st.effects) {
        if (e.until <= s.time) continue;
        const upcoming = e.from != null && s.time < e.from, left = (e.until - Math.max(s.time, e.from || 0)) / DAY;
        let kind = 'other', text = '', good = e.mult >= 1;
        if (e.key === 'customers') { kind = 'customers'; text = '손님 ' + pct(e.mult); }
        else if (e.key === 'sale') { kind = 'sale'; text = '판매가 ' + pct(e.mult); }
        else if (e.key.startsWith('sale:')) { kind = 'sale'; text = familyName(e.key.slice(5)) + ' 판매가 ' + pct(e.mult); }
        else if (e.key === 'craft') { kind = 'craft'; text = '제작 속도 ' + pct(e.mult); }
        else if (e.key.startsWith('staff:')) { const t = getTown(s, e.townId) || activeTown(s), n = t ? staffName(t, e.key.slice(6)) : '직원'; kind = 'staff'; text = e.mult === 0 ? n + ' 쉬는 중' : n + ' 작업 속도 ' + pct(e.mult); }
        else if (e.key.startsWith('furnace:')) { kind = 'furnace'; text = e.mult === 0 ? '화덕 하나 꺼짐' : '화덕 ' + pct(e.mult); }
        else if (e.key.startsWith('price:')) { const m = DATA.materials[e.key.slice(6)]; kind = 'price'; good = e.mult < 1; text = (m ? m.name : '재료') + ' 값 ' + pct(e.mult); }
        else if (e.key === 'buyStop') { kind = 'buyStop'; good = false; text = '재료 구입 불가'; }
        else continue;
        if (e.mult === 1) continue;
        const forever = left > 1000;
        out.push({ kind, good, text: townName(e.townId) + text, when: forever ? '계속' : upcoming ? Math.ceil((e.from - s.time) / DAY) + '일 뒤부터 ' + Math.ceil(left) + '일' : left >= 1 ? Math.ceil(left - .05) + '일 남음' : '오늘까지', upcoming, until: e.until });
      }
      if (st.flags.mascot) out.push({ kind: 'pet', good: true, text: '고양이 마스코트 · 손님 +5%', when: '계속', until: Infinity });
      if (st.flags.kittens) out.push({ kind: 'pet', good: true, text: '새끼 고양이들 · 손님 +3%', when: '계속', until: Infinity });
      if (st.qualityBoost > 0) out.push({ kind: 'quality', good: true, text: '다음 제작 ' + st.qualityBoost + '번 품질 +1단계', when: '제작할 때까지', until: Infinity });
      if (st.hireDiscount > 0) out.push({ kind: 'hire', good: true, text: '다음 직원 고용비 반값', when: '고용할 때까지', until: Infinity });
      return out.sort((a, b) => Number(a.good) - Number(b.good) || a.until - b.until);
    }
    function view(s) {
      const st = s.incidents; if (!st) return [];
      return st.list.map(inc => {
        const e = catalog[inc.key], t = getTown(s, inc.townId);
        const left = inc.status === 'pending' ? (inc.tier === 'instant' ? inc.instantLeft : (inc.deadline - s.time) / DAY) : inc.status === 'active' && inc.task ? ((inc.task.returnAt || inc.task.until) - s.time) / DAY : 0;
        const total = inc.status === 'pending' ? (inc.tier === 'instant' ? INSTANT_REAL_SECONDS : TIERS[inc.tier].days) : inc.task ? (inc.task.type === 'mission' && !inc.task.heroIds ? 3 : inc.task.days) : 1;
        let story = ''; try { story = e.story(s, inc); } catch (_) {}
        const choices = inc.status === 'pending' ? e.choices.map((c, k) => { let info = '', why = ''; try { info = c.info ? c.info(s, inc) : ''; why = c.can ? c.can(s, inc) : ''; } catch (_) {} return { index: k, label: label(c, s, inc), info, blocked: why }; }) : [];
        let ignoreInfo = ''; try { ignoreInfo = e.ignore.info(s, inc); } catch (_) {}
        let task = null;
        if (inc.status === 'active' && inc.task) {
          const m = inc.task;
          if (m.type === 'deliver') { const sets = deliverables(s, inc); task = { type: 'deliver', needs: m.needs.map((need, k) => ({ label: need.label, n: need.n, done: m.done[k], ready: sets[k].length, recipeId: need.recipeId || null, quality: need.quality || null, making: queuedFor(s, inc, need), options: makeOptions(s, inc, need).map(r => ({ id: r.id, name: r.name })) })), reward: m.reward, rep: m.rep || 0 }; }
          else if (m.type === 'mission') task = { type: 'mission', min: m.min, max: m.max, power: m.power, days: m.days, sent: !!m.heroIds, chance: m.chance || 0, heroNames: (m.heroIds || []).map(h => heroName(s, h)), gathering: !!m.gathering,
            waiting: m.gathering ? (m.heroIds || []).map(h => { const a = s.adventurers.find(x => x.id === h); return { name: heroName(s, h), why: a ? missionBlock(s, a, inc) : '', eta: a ? joinEta(s, a, inc) : null }; }) : [],
            crisis: m.crisis ? { active: m.crisis.active, left: m.crisis.realLeft, chosen: m.crisis.chosen, cost: Math.round(income(s)) } : null };
          else task = { type: 'wait' };
        }
        const mem = st.memory && st.memory[inc.key], memory = mem && mem.incId !== inc.id ? '지난번: ' + mem.label + (mem.text ? ' · ' + mem.text : '') : '';
        return { id: inc.id, key: inc.key, name: e.name, cat: e.cat, tier: inc.tier, tierLabel: TIERS[inc.tier].label, status: inc.status, townId: inc.townId, townName: t ? t.name : '', opportunity: !!e.opportunity, memory, local: !!e.town, followUp: !!e.after,
          left: Math.max(0, left), total, unit: inc.status === 'pending' && inc.tier === 'instant' ? 'sec' : 'day', story, choices, ignoreInfo, task, result: inc.result };
      });
    }

    function normalize(s) { init(s); return s; }
    function enable(s, on) { init(s).enabled = on !== false; return s.incidents.enabled; }
    function validate(s) {
      const st = s.incidents;
      if (!object(st) || st.version !== 1 || !finite(st.nextAt) || !Array.isArray(st.list) || st.list.length > 60 || !Array.isArray(st.effects) || st.effects.length > 200 || !object(st.lastSeen) || !object(st.flags)) return false;
      for (const inc of st.list) if (!object(inc) || typeof inc.id !== 'string' || !catalog[inc.key] || !['pending', 'active', 'done'].includes(inc.status) || !object(inc.data)) return false;
      for (const e of st.effects) if (!object(e) || typeof e.key !== 'string' || !finite(e.mult, 0, 10) || !finite(e.until)) return false;
      const live = new Set(st.list.filter(i => i.status === 'active').map(i => i.id));
      for (const a of s.adventurers || []) if (a.missionId != null && !live.has(a.missionId)) return false;
      return true;
    }

    return { init, normalize, validate, step, enable, chooseCrisis, setCrisis, factor: factorWithDelay, view, effectsView, reserved: reserved_, choose, deliver, holds, makeTown, missionInfo, quoteMission, sendMission, regather, dismiss, spawn, catalog: E.map(e => ({ key: e.key, name: e.name, cat: e.cat, tier: e.tier, town: e.town || null, followUp: !!e.after })) };
  }

  const api = { create, setRealRate: r => { if (Number.isFinite(r) && r > 0) realRate = r; } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.ForgeIncidents = api;
})(typeof window !== 'undefined' ? window : globalThis);
