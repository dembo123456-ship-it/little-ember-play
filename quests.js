(function (global) {
  'use strict';
  // 성장 퀘스트 (2026-11-09, docs/quests-events2-crisis-v1.md A): 70 quests in chapters by town, from the first hire to
  // the legendary forge. Completion is computed from the save each time; only claimed rewards are stored.
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const TOWNS = ['greenwood', 'stonebridge', 'moonhaven', 'sunspire', 'frostgate'];
  const CHAPTERS = [
    { n: 1, town: 'greenwood', name: '1장 · 초록숲', reward: { gold: 3000, mats: { crystal: 20, mythril: 5 } } },
    { n: 2, town: 'stonebridge', name: '2장 · 돌다리', reward: { gold: 10000, mats: { mythril: 20 } } },
    { n: 3, town: 'moonhaven', name: '3장 · 달빛 항구', reward: { gold: 25000, mats: { mythril: 40, crystal: 40 } } },
    { n: 4, town: 'sunspire', name: '4장 · 해오름 성채', reward: { gold: 60000, mats: { mythril: 80 } } },
    { n: 5, town: 'frostgate', name: '5장 · 서리문', reward: { gold: 100000, mats: {} } },
    { n: 6, town: 'frostgate', name: '마지막 장 · 전설의 대장간', reward: null }
  ];

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, getCombatStats, getResearch, log, result } = ctx;
    const owned = s => getOwnedTowns(s);
    const town = (s, id) => getTown(s, id);
    const allStaff = s => owned(s).flatMap(t => t.staff);
    const role = (s, r, townId) => (townId ? (town(s, townId) ? town(s, townId).staff : []) : allStaff(s)).filter(w => w.role === r).length;
    const fac = (s, townId, type) => { const t = town(s, townId); return t ? t.facilities.filter(f => f.type === type).length : 0; };
    const lvl = (s, townId) => { const t = town(s, townId); return t ? t.level : 0; };
    const maxOf = (s, key) => Math.max(0, ...owned(s).map(t => t[key] || 0));
    const craftMax = s => Math.max(0, ...allStaff(s).filter(w => w.role === 'smith').map(w => w.craftLevel || 0));
    const quality = (s, q) => { const order = DATA.qualityOrder, from = order.indexOf(q), made = s.stats.qualityCrafted || {}; return order.slice(from).reduce((n, k) => n + (made[k] || 0), 0); };
    const anyRule = (s, key) => owned(s).some(t => t.operations && object(t.operations[key]) && Object.values(t.operations[key]).some(r => r && r.enabled));
    const autoDisplay = s => owned(s).some(t => t.operations && t.operations.autoDisplay && t.operations.autoDisplay.enabled);
    const research = s => { const r = getResearch ? getResearch(s) : null; return r && Array.isArray(r.nodes) ? r.nodes : []; };
    const researchTotal = s => research(s).reduce((n, x) => n + (x.level || 0), 0);
    const boss = (s, id) => (s.stats.bossWins || {})[id] || 0;
    const rareMade = s => Array.isArray(s.stats.rareCrafted) ? s.stats.rareCrafted.length : 0;
    const resolved = s => s.incidents ? s.incidents.resolved || 0 : 0;
    const defended = s => (s.campaign && Array.isArray(s.campaign.invasions) ? s.campaign.invasions : []).filter(i => i.status === 'recovery' || i.status === 'resolved').length;
    const enhanceMax = s => {
      let m = 0;
      for (const a of s.adventurers || []) for (const it of Object.values(a.equipment || {})) if (it) m = Math.max(m, it.enhance || 0);
      for (const t of owned(s)) for (const it of t.inventory) m = Math.max(m, it.enhance || 0);
      return m;
    };
    const strong = (s, townId, power) => (s.adventurers || []).filter(a => a.resident && a.townId === townId && getCombatStats(a).power >= power).length;
    const g = gold => ({ gold });
    const m = (mats, gold) => ({ gold: gold || 0, mats });

    // [n, chapter, name, condition text, value(s), target, reward, go (screen to open)]
    const Q = [
      [1, 1, '첫 식구', '직원을 1명 더 고용하기 (초록숲 직원 3명)', s => (town(s, 'greenwood') || { staff: [] }).staff.length, 3, g(200), 'staff'],
      [2, 1, '첫 불꽃', '장비 1개 제작', s => s.stats.crafted, 1, m({ iron: 10, wood: 10 }), 'craft'],
      [3, 1, '단골의 시작', '장비 5개 판매', s => s.stats.sold, 5, g(300), 'warehouse'],
      [4, 1, '더 큰 꿈', '초록숲 대장간 2단계로 증축', s => lvl(s, 'greenwood'), 2, g(500), 'upgrades'],
      [5, 1, '화덕 하나 더', '초록숲에 화덕 2개 배치', s => fac(s, 'greenwood', 'furnace'), 2, m({ iron: 15, leather: 15 }), 'upgrades'],
      [6, 1, '두 번째 망치', '초록숲 제조 직원 2명 (화덕마다 한 명)', s => role(s, 'smith', 'greenwood'), 2, g(300), 'staff'],
      [7, 1, '서로 돕는 사이', '재료 의뢰 3번 완료', s => s.stats.quests, 3, g(400), 'quests'],
      // 2026-11-09: ordinary heroes no longer place craft requests (only rare-recipe holders do), so this one is incidents now.
      [8, 1, '부탁 들어주기', '돌발 사건 3개 해결', resolved, 3, g(500), null],
      [9, 1, '진열대 채우기', '초록숲에 진열대 2개 배치', s => fac(s, 'greenwood', 'display'), 2, m({ iron: 20 }), 'upgrades'],
      [10, 1, '여관 손보기', '초록숲 여관 2단계', s => (town(s, 'greenwood') || {}).innLevel || 0, 2, g(600), 'inn'],
      [11, 1, '창고 넓히기', '초록숲 창고 2단계', s => (town(s, 'greenwood') || {}).warehouseLevel || 0, 2, m({ wood: 30, leather: 20 }), 'warehouse'],
      [12, 1, '한 단계 더 강하게', '장비 강화 3번 성공', s => s.stats.enhanced, 3, g(700), 'adventurers'],
      [13, 1, '손에 익은 망치', '제조 직원 제작기술 Lv.10', craftMax, 10, m({ crystal: 10 }), 'staff'],
      [14, 1, '우수한 솜씨', '우수 이상 장비 5개 제작', s => quality(s, 'fine'), 5, g(800), 'craft'],
      [15, 1, '장 보는 사람', '매입 직원 1명 + 자동 매입 1개 켜기', s => (role(s, 'buyer') > 0 ? 1 : 0) + (anyRule(s, 'materialRules') ? 1 : 0), 2, g(1000), 'operations'],
      [16, 1, '쉬지 않는 화덕', '자동 제작 계획 1개 켜기', s => anyRule(s, 'craftRules') ? 1 : 0, 1, m({ iron: 30 }), 'operations'],
      [17, 1, '마을의 대장간', '초록숲 대장간 3단계로 증축', s => lvl(s, 'greenwood'), 3, g(1500), 'upgrades'],
      [18, 1, '마을을 지켜라', '마을 방어 1번 치러 내기', defended, 1, g(1200), null],
      [19, 1, '고목 수호자', '고목 수호자 토벌', s => boss(s, 'moss_warden'), 1, g(2000), 'boss:moss_warden'],
      [20, 1, '떠날 준비', '초록숲에 전투력 150 이상 모험가 3명', s => strong(s, 'greenwood', 150), 3, m({ crystal: 20 }), 'adventurers'],
      [21, 1, '새 마을의 불빛', '돌다리 마을 2호점 열기', s => owned(s).length, 2, g(3000), 'world'],

      [22, 2, '돌다리의 첫 망치', '돌다리에 제조 직원 1명', s => role(s, 'smith', 'stonebridge'), 1, g(1500), 'staff'],
      [23, 2, '두 마을 살림', '모든 마을 합쳐 직원 6명', s => allStaff(s).length, 6, g(2000), 'staff'],
      [24, 2, '연구소 문을 열다', '연구 1단계 올리기', researchTotal, 1, g(2500), 'research'],
      [25, 2, '짐 나르는 손', '운반 직원 1명 + 자동 진열 켜기', s => (role(s, 'logistics') > 0 ? 1 : 0) + (autoDisplay(s) ? 1 : 0), 2, g(2000), 'operations'],
      [26, 2, '명품 대장간', '명품 이상 장비 3개 제작', s => quality(s, 'masterwork'), 3, m({ mythril: 10 }), 'craft'],
      [27, 2, '바위 거인', '바위 거인 토벌', s => boss(s, 'stone_colossus'), 1, g(4000), 'boss:stone_colossus'],
      [28, 2, '봄의 장비 축제', '장비 축제에 1번 출품', s => s.stats.festivalEntries || 0, 1, g(3000), 'festival'],
      [29, 2, '동네 해결사', '돌발 사건 10개 해결', resolved, 10, g(3000), null],
      [30, 2, '돌다리의 대장간', '돌다리 대장간 3단계', s => lvl(s, 'stonebridge'), 3, g(4000), 'upgrades'],
      [31, 2, '걸작의 문턱', '걸작 이상 장비 1개 제작', s => quality(s, 'masterpiece'), 1, m({ mythril: 15 }), 'craft'],
      [32, 2, '유적의 문을 열다', '모험가가 달빛 유적 사냥 완료', s => (s.stats.regions || {}).ruins || 0, 1, g(5000), 'world'],
      [33, 2, '별을 삼킨 예언자', '별을 삼킨 예언자 토벌', s => boss(s, 'ruin_oracle'), 1, g(6000), 'boss:ruin_oracle'],
      [34, 2, '첫 희귀 설계도', '보스에게서 희귀 설계도 얻기', s => s.stats.rareRecipes || 0, 1, m({ crystal: 30 }), 'world'],
      [35, 2, '그만을 위한 장비', '보스 전용 장비 1개 완성', rareMade, 1, g(8000), 'orders'],
      [36, 2, '더 넓은 창고', '아무 마을 창고 3단계', s => maxOf(s, 'warehouseLevel'), 3, m({ mythril: 20 }), 'warehouse'],
      [37, 2, '명장의 대장간', '아무 마을 대장간 4단계', s => maxOf(s, 'level'), 4, g(8000), 'upgrades'],
      [38, 2, '이름난 대장간', '명성 15,000', s => s.reputation, 15000, g(5000), 'fame'],
      [39, 2, '바다로', '달빛 항구 3호점 열기', s => owned(s).length, 3, g(10000), 'world'],

      [40, 3, '항구의 세 화덕', '달빛 항구에 화덕 3개', s => fac(s, 'moonhaven', 'furnace'), 3, g(6000), 'upgrades'],
      [41, 3, '세 마을의 식구', '모든 마을 합쳐 직원 15명', s => allStaff(s).length, 15, g(8000), 'staff'],
      [42, 3, '고급 대장장이', '제작기술 Lv.20 직원', craftMax, 20, m({ mythril: 30 }), 'staff'],
      [43, 3, '전설의 시작', '전설 등급 장비 1개 제작', s => quality(s, 'legendary'), 1, g(15000), 'craft'],
      [44, 3, '일곱 번의 담금질', '+7 이상 강화된 장비 1개', enhanceMax, 7, g(10000), 'adventurers'],
      [45, 3, '연구에 빠지다', '연구 합계 10단계', researchTotal, 10, g(12000), 'research'],
      [46, 3, '서리날개 용', '서리날개 용 토벌', s => boss(s, 'frost_drake'), 1, g(15000), 'boss:frost_drake'],
      [47, 3, '가을 수확제', '수확제 주문에 1번 납품', s => s.stats.harvestDeliveries || 0, 1, g(12000), 'season'],
      [48, 3, '큰 여관', '아무 마을 여관 4단계', s => maxOf(s, 'innLevel'), 4, g(10000), 'inn'],
      [49, 3, '최고의 대장간', '아무 마을 대장간 5단계', s => maxOf(s, 'level'), 5, g(20000), 'upgrades'],
      [50, 3, '마을의 해결사', '돌발 사건 30개 해결', resolved, 30, g(15000), null],
      [51, 3, '왕국에 알려진 이름', '명성 50,000', s => s.reputation, 50000, g(15000), 'fame'],
      [52, 3, '성채로', '해오름 성채 4호점 열기', s => owned(s).length, 4, g(25000), 'world'],

      [53, 4, '성채의 대장간', '해오름 성채 대장간 3단계', s => lvl(s, 'sunspire'), 3, g(20000), 'upgrades'],
      [54, 4, '산더미 창고', '아무 마을 창고 4단계', s => maxOf(s, 'warehouseLevel'), 4, m({ mythril: 50 }), 'warehouse'],
      [55, 4, '신화의 손', '제작기술 Lv.30 직원', craftMax, 30, g(30000), 'staff'],
      [56, 4, '심연의 군주', '심연의 군주 토벌', s => boss(s, 'abyss_sovereign'), 1, g(40000), 'boss:abyss_sovereign'],
      [57, 4, '전용 장비 수집가', '서로 다른 보스 전용 장비 5종 완성', rareMade, 5, m({ mythril: 60, crystal: 60 }), 'orders'],
      [58, 4, '열 번의 담금질', '+10 강화 장비 1개', enhanceMax, 10, g(40000), 'adventurers'],
      [59, 4, '왕실의 부름', '왕실 사자 진상 성공, 또는 걸작 이상 장비 10개 제작', s => s.incidents && s.incidents.flags && s.incidents.flags.royal ? 10 : quality(s, 'masterpiece'), 10, g(30000), 'craft'],
      [60, 4, '연구의 대가', '연구 합계 30단계', researchTotal, 30, g(40000), 'research'],
      [61, 4, '전설이 된 이름', '명성 120,000', s => s.reputation, 120000, g(30000), 'fame'],
      [62, 4, '마지막 마을', '서리문 5호점 열기', s => owned(s).length, 5, g(60000), 'world'],

      [63, 5, '다섯 개의 불꽃', '다섯 마을 모두 대장간 5단계', s => owned(s).filter(t => t.level >= 5).length, 5, g(80000), 'upgrades'],
      [64, 5, '신화를 벼리다', '신화 등급 장비 1개 제작', s => quality(s, 'mythic'), 1, g(100000), 'craft'],
      // 2026-11-10: 서리문 final boss added → "all bosses" means all 6 (it said 5 and could skip one).
      [65, 5, '모든 보스를 넘어', '보스 ' + (DATA.bosses || []).length + '마리 모두 각각 3번 이상 토벌', s => (DATA.bosses || []).filter(b => boss(s, b.id) >= 3).length, (DATA.bosses || []).length || 5, g(60000), 'world'],
      // 2026-11-10 pass 2 (2배속 10시간 기준): 15 kinds took 30h+ (12 by 20h) → 12 kinds.
      [66, 5, '희귀 장비 도감', '보스 전용 장비 12종 완성 (칭호 「전설을 벼린 자」)', rareMade, 12, { gold: 80000, title: '전설을 벼린 자' }, 'orders'],
      [67, 5, '끝없는 창고', '아무 마을 창고 5단계', s => maxOf(s, 'warehouseLevel'), 5, g(50000), 'warehouse'],
      // 2026-11-10 (2배속 10시간 기준): all eight at Lv.10 cost ~7M G more than the game pays by the end → Lv.8 (pass 1)
      // → Lv.7 (pass 3: with cheaper research, Lv.8 everywhere still came only after 30h).
      [68, 5, '모든 비밀', '연구 8종 모두 7단계', s => research(s).filter(x => x.level >= Math.min(7, x.maxLevel || 10)).length, 8, g(100000), 'research'],
      [69, 5, '큰 대장간 가문', '모든 마을 합쳐 직원 40명', s => allStaff(s).length, 40, g(60000), 'staff'],
      [70, 6, '전설의 대장간', '1~5장 퀘스트 모두 완료 (칭호 「전설의 대장간」)', s => (s.questBook ? s.questBook.claimed.filter(n => n < 70).length : 0), 69, { gold: 200000, title: '전설의 대장간' }, null]
    ].map(([n, chapter, name, text, value, target, reward, go]) => ({ n, chapter, name, text, value, target, reward, go }));
    const byN = new Map(Q.map(q => [q.n, q]));

    function init(s) {
      if (!object(s.questBook)) s.questBook = {};
      const b = s.questBook;
      if (b.version !== 1) b.version = 1;
      if (typeof b.enabled !== 'boolean') b.enabled = false; // the game turns this on; bare simulations stay quiet
      if (!Array.isArray(b.claimed)) b.claimed = [];
      if (!Array.isArray(b.notified)) b.notified = [];
      if (!Array.isArray(b.chapters)) b.chapters = [];
      if (!Array.isArray(b.titles)) b.titles = [];
      if (!Number.isFinite(b.checkAt)) b.checkAt = 0;
      return b;
    }
    const unlocked = (s, q) => q.chapter === 1 || (q.chapter <= 5 ? !!getTown(s, CHAPTERS[q.chapter - 1].town) : !!getTown(s, 'frostgate'));
    // A quest that was once complete stays complete (2026-11-10): counts like "초록숲에 전투력 150 이상 모험가 3명" or
    // staff numbers can drop again (heroes migrate to the new town), which used to take back an unclaimed [완료].
    const reached = (s, q) => !!(s.questBook && Array.isArray(s.questBook.notified) && s.questBook.notified.includes(q.n));
    function progress(s, q) { if (reached(s, q)) return q.target; let v = 0; try { v = Number(q.value(s)) || 0; } catch (_) {} return Math.max(0, Math.min(q.target, v)); }
    const done = (s, q) => progress(s, q) >= q.target;

    function room(s, mat) { return ctx.getMaterialRoom ? ctx.getMaterialRoom(s, mat) : 1e8; }
    function giveReward(s, reward) {
      const parts = [];
      if (reward.gold) { s.gold = Math.round(s.gold + reward.gold); parts.push('+' + reward.gold.toLocaleString('ko-KR') + ' G'); }
      for (const [mat, n] of Object.entries(reward.mats || {})) {
        const add = Math.max(0, Math.min(n, room(s, mat))); s.materials[mat] = (s.materials[mat] || 0) + add;
        const name = (DATA.materials[mat] || {}).name || mat;
        parts.push(name + ' +' + add + (add < n ? ' (창고가 가득해 ' + (n - add) + '개는 못 받음)' : ''));
      }
      if (reward.title && !s.questBook.titles.includes(reward.title)) { s.questBook.titles.push(reward.title); parts.push('칭호 「' + reward.title + '」'); }
      return parts.join(' · ');
    }
    function rewardText(reward) {
      if (!reward) return '';
      const parts = [];
      if (reward.gold) parts.push(reward.gold.toLocaleString('ko-KR') + ' G');
      for (const [mat, n] of Object.entries(reward.mats || {})) parts.push(((DATA.materials[mat] || {}).name || mat) + ' ' + n);
      if (reward.title) parts.push('칭호 「' + reward.title + '」');
      return parts.join(' · ');
    }
    // The same reward split into pieces, so the screen can put a coin by gold and the material's picture by materials.
    function rewardParts(reward) {
      if (!reward) return [];
      const parts = [];
      if (reward.gold) parts.push({ kind: 'gold', text: reward.gold.toLocaleString('ko-KR') + ' G' });
      for (const [mat, n] of Object.entries(reward.mats || {})) parts.push({ kind: 'mat', mat, text: ((DATA.materials[mat] || {}).name || mat) + ' ' + n });
      if (reward.title) parts.push({ kind: 'title', text: '칭호 「' + reward.title + '」' });
      return parts;
    }

    function claim(s, n) {
      const b = init(s), q = byN.get(Number(n));
      if (!q) return result(false, '알 수 없는 퀘스트예요.');
      if (b.claimed.includes(q.n)) return result(false, '이미 보상을 받았어요.');
      if (!unlocked(s, q)) return result(false, '아직 열리지 않은 장이에요.');
      if (!done(s, q)) return result(false, '아직 조건을 채우지 못했어요.');
      b.claimed.push(q.n);
      let text = q.name + ' 완료 · ' + giveReward(s, q.reward);
      log(s, 'quest-claim', '퀘스트 · ' + text, { questId: q.n });
      const ch = CHAPTERS[q.chapter - 1];
      if (ch.reward && !b.chapters.includes(ch.n) && Q.filter(x => x.chapter === ch.n).every(x => b.claimed.includes(x.n))) {
        b.chapters.push(ch.n);
        const chText = giveReward(s, ch.reward);
        log(s, 'quest-chapter', ch.name + ' 완료! 장 보상 ' + chText, { chapter: ch.n });
        text += ' · ' + ch.name + ' 완료! ' + chText;
      }
      return result(true, text, { quest: q.n });
    }

    function step(s) {
      const b = init(s);
      if (!b.enabled || s.time < b.checkAt) return s;
      b.checkAt = s.time + 2;
      for (const q of Q) {
        if (b.claimed.includes(q.n) || b.notified.includes(q.n) || !unlocked(s, q)) continue;
        if (done(s, q)) { b.notified.push(q.n); log(s, 'quest-ready', '퀘스트 완료 · ' + q.name, { questId: q.n }); }
      }
      return s;
    }

    function view(s) {
      const b = s.questBook || { claimed: [], chapters: [], titles: [] };
      const open = Q.filter(q => !b.claimed.includes(q.n) && unlocked(s, q));
      // Finished quests come first so their reward can always be claimed, even when earlier ones are still open
      // (a player who skips material requests or the festival must not get stuck behind them).
      const shown = [...open.filter(q => done(s, q)), ...open.filter(q => !done(s, q))].slice(0, 3);
      const current = shown.length ? shown[0].chapter : Math.max(1, ...CHAPTERS.filter(c => c.n <= 5 && getTown(s, c.town)).map(c => c.n));
      const ch = CHAPTERS[current - 1], inCh = Q.filter(q => q.chapter === current);
      const nextLocked = Q.find(q => !b.claimed.includes(q.n) && !unlocked(s, q));
      return {
        chapter: { n: ch.n, name: ch.name, done: inCh.filter(q => b.claimed.includes(q.n)).length, total: inCh.length, reward: rewardText(ch.reward) },
        quests: shown.map(q => ({ n: q.n, name: q.name, text: q.text, progress: progress(s, q), target: q.target, complete: done(s, q), reward: rewardText(q.reward), rewardParts: rewardParts(q.reward), go: q.go })),
        ready: open.filter(q => done(s, q)).length,
        claimed: b.claimed.length, total: Q.length,
        next: nextLocked && !shown.length ? CHAPTERS[nextLocked.chapter - 1].name + '은(는) 다음 마을을 열면 시작돼요.' : '',
        titles: b.titles.slice()
      };
    }
    function enable(s, on) { init(s).enabled = on !== false; return s.questBook.enabled; }
    function normalize(s) { init(s); return s; }
    function validate(s) {
      const b = s.questBook;
      if (!object(b) || b.version !== 1 || typeof b.enabled !== 'boolean') return false;
      for (const k of ['claimed', 'notified', 'chapters']) if (!Array.isArray(b[k]) || b[k].length > 200 || b[k].some(n => !Number.isInteger(n))) return false;
      if (!Array.isArray(b.titles) || b.titles.some(t => typeof t !== 'string')) return false;
      if (new Set(b.claimed).size !== b.claimed.length || b.claimed.some(n => !byN.has(n))) return false;
      return Number.isFinite(b.checkAt);
    }
    return { init, step, view, claim, enable, normalize, validate, list: Q.map(q => ({ n: q.n, chapter: q.chapter, name: q.name, text: q.text, target: q.target })), chapters: CHAPTERS.map(c => ({ n: c.n, name: c.name })) };
  }
  const api = { create, TOWNS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.ForgeQuests = api;
})(typeof window !== 'undefined' ? window : globalThis);
