(function (global) {
  'use strict';

  // Achievements (2026-11, docs/research-achievements-v1.0.md). PERMANENT: unlocks live in a profile
  // that is stored apart from the game save (browser key little-ember-profile-v1), so they survive a new game.
  // They give points and titles only, no gameplay bonus. Ids are fixed so they can map 1:1 to Steam later.
  const VERSION = 1;
  const PROFILE_KEY = 'little-ember-profile-v1';
  const CATEGORIES = Object.freeze([
    ['craft', '제작'], ['sales', '판매·매출'], ['enhance', '강화'], ['heroes', '모험가'], ['towns', '지점'], ['battle', '보스·침공'], ['events', '행사'], ['research', '연구'], ['forge', '명성·직원']
  ].map(([id, name]) => Object.freeze({ id, name })));
  const a = (id, category, name, description, metric, target, points, title) => Object.freeze({ id, category, name, description, metric, target, points, title: title || null });
  const LIST = Object.freeze([
    a('craft_1', 'craft', '첫 망치질', '장비를 처음으로 완성하기', 'crafted', 1, 10),
    a('craft_100', 'craft', '손에 익은 망치', '장비 100개 완성하기', 'crafted', 100, 10),
    a('craft_1000', 'craft', '쉬지 않는 화덕', '장비 1,000개 완성하기', 'crafted', 1000, 20),
    a('craft_10000', 'craft', '만 번의 담금질', '장비 10,000개 완성하기', 'crafted', 10000, 50, '만 번의 담금질'),
    a('quality_masterpiece', 'craft', '첫 걸작', '걸작 품질 장비 만들기', 'masterpieces', 1, 20),
    a('quality_legendary', 'craft', '전설이 깃든 날', '전설 품질 장비 만들기', 'legendaries', 1, 20),
    a('quality_mythic', 'craft', '신화의 불꽃', '신화 품질 장비 만들기', 'mythics', 1, 50, '신화를 벼린 손'),
    a('smith_10', 'craft', '어엿한 장인', '제조 직원 제작기술 Lv.10', 'maxCraftLevel', 10, 10),
    a('smith_20', 'craft', '숙련된 장인', '제조 직원 제작기술 Lv.20', 'maxCraftLevel', 20, 20),
    a('smith_30', 'craft', '대장인', '제조 직원 제작기술 Lv.30', 'maxCraftLevel', 30, 50, '대장인의 공방'),
    a('sold_1', 'sales', '첫 손님', '장비를 처음으로 팔기', 'sold', 1, 10),
    a('sold_500', 'sales', '단골이 생겼어요', '장비 500개 팔기', 'sold', 500, 10),
    a('sold_5000', 'sales', '마을의 대장간', '장비 5,000개 팔기', 'sold', 5000, 20, '마을의 대장간'),
    a('earned_100k', 'sales', '든든한 금고', '누적 매출 10만 G', 'earned', 100000, 10),
    a('earned_1m', 'sales', '번창하는 가게', '누적 매출 100만 G', 'earned', 1000000, 20),
    a('earned_10m', 'sales', '황금 망치', '누적 매출 1,000만 G', 'earned', 10000000, 50, '황금 망치'),
    a('gold_1m', 'sales', '금화 산더미', '골드 100만 G를 한 번에 보유하기', 'gold', 1000000, 20),
    a('enhance_5', 'enhance', '빛나는 칼날', '+5 강화 장비 탄생', 'maxEnhance', 5, 10),
    a('enhance_10', 'enhance', '극한의 강화', '+10 강화 장비 탄생', 'maxEnhance', 10, 50, '+10의 장인'),
    a('hero_50', 'heroes', '믿음직한 모험가', '레벨 50 모험가', 'maxHeroLevel', 50, 10),
    a('hero_150', 'heroes', '이름난 모험가', '레벨 150 모험가', 'maxHeroLevel', 150, 20),
    a('hero_300', 'heroes', '살아있는 전설', '레벨 300 모험가', 'maxHeroLevel', 300, 50, '전설을 키운 대장간'),
    a('migrate_1', 'heroes', '첫 졸업', '모험가가 처음으로 다음 마을로 이주', 'migrations', 1, 10),
    a('migrate_50', 'heroes', '졸업생 50명', '모험가 50명이 다음 마을로 이주', 'migrations', 50, 20),
    a('town_2', 'towns', '두 번째 불꽃', '2호점 열기', 'towns', 2, 10),
    a('town_3', 'towns', '항구의 불빛', '3호점 열기', 'towns', 3, 20),
    a('town_4', 'towns', '성채의 대장간', '4호점 열기', 'towns', 4, 20),
    a('town_5', 'towns', '다섯 마을의 불꽃', '5호점 열기', 'towns', 5, 50, '다섯 마을의 대장장이'),
    a('raid_1', 'battle', '첫 토벌', '월드보스 처음 토벌', 'raidWins', 1, 10),
    a('raid_25', 'battle', '보스 사냥꾼의 무기고', '월드보스 25회 토벌', 'raidWins', 25, 20, '보스 사냥꾼의 무기고'),
    a('invasion_1', 'battle', '마을을 지켜라', '마을 침공을 처음 겪어내기', 'invasions', 1, 10),
    a('festival_gold', 'events', '축제의 주인공', '장비 축제 금상', 'festivalGold', 1, 20, '축제의 주인공'),
    a('harvest_1', 'events', '풍년의 대장간', '가을 수확제 주문을 모두 납품', 'harvestCompleted', 1, 10),
    a('research_1', 'research', '첫 연구', '대장간 연구 처음 완료', 'researchLevels', 1, 10),
    a('research_max', 'research', '한 우물 파기', '연구 하나를 최고 단계까지', 'researchMaxed', 1, 20),
    a('research_all', 'research', '모든 비법의 주인', '모든 연구를 최고 단계까지', 'researchAllMaxed', 1, 50, '비법의 주인'),
    a('fame_top', 'forge', '전설의 대장간', '가장 높은 명성 단계 도달', 'fameTop', 1, 50, '전설의 대장간'),
    a('staff_10', 'forge', '열 명의 손', '모든 지점 직원 합계 10명', 'staffTotal', 10, 10)
  ]);
  const byId = Object.fromEntries(LIST.map(x => [x.id, x]));

  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const n = v => Number.isFinite(v) ? v : 0;

  // Numbers from one game state. `api` is the engine (getOwnedTowns, getFame, getResearch); missing parts count as 0.
  function metrics(s, api) {
    const st = object(s && s.stats) ? s.stats : {}, q = object(st.qualityCrafted) ? st.qualityCrafted : {};
    const towns = api && api.getOwnedTowns ? api.getOwnedTowns(s) : [];
    const heroes = Array.isArray(s && s.adventurers) ? s.adventurers : [];
    const fame = api && api.getFame ? api.getFame(s) : null, research = api && api.getResearch ? api.getResearch(s) : null;
    const results = s && s.festival && Array.isArray(s.festival.results) ? s.festival.results : [];
    return {
      crafted: n(st.crafted), sold: n(st.sold), earned: n(st.earned), gold: n(s && s.gold),
      masterpieces: n(q.masterpiece), legendaries: n(q.legendary), mythics: n(q.mythic),
      maxCraftLevel: Math.max(0, ...towns.flatMap(t => (t.staff || []).filter(w => w.role === 'smith').map(w => n(w.craftLevel)))),
      maxEnhance: n(st.maxEnhance), maxHeroLevel: Math.max(0, ...heroes.map(h => n(h.level))),
      migrations: n(st.migrations), towns: towns.length, raidWins: n(st.raidWins), invasions: n(st.invasions),
      festivalGold: results.some(r => r && r.rank === 1) ? 1 : 0, harvestCompleted: n(st.harvestCompleted),
      researchLevels: research ? research.totalLevels : 0, researchMaxed: research ? research.maxedCount : 0,
      researchAllMaxed: research && research.nodes.length && research.maxedCount === research.nodes.length ? 1 : 0,
      fameTop: fame && fame.nextThreshold === null ? 1 : 0,
      staffTotal: towns.reduce((sum, t) => sum + (t.staff || []).length, 0)
    };
  }

  function blankProfile() { return { version: VERSION, unlocked: {}, title: null }; }
  // Accepts anything (corrupt storage, older shape) and returns a clean profile; unknown ids are dropped.
  function normalizeProfile(raw) {
    const p = blankProfile();
    if (!object(raw) || !object(raw.unlocked)) return p;
    for (const [id, at] of Object.entries(raw.unlocked)) if (byId[id] && typeof at === 'string' && at.length <= 40) p.unlocked[id] = at;
    if (typeof raw.title === 'string' && p.unlocked[raw.title] && byId[raw.title].title) p.title = raw.title;
    return p;
  }

  // Unlock everything the state now satisfies. Mutates the profile; returns the newly unlocked definitions.
  function evaluate(profile, m, now) {
    const fresh = [];
    for (const def of LIST) if (!profile.unlocked[def.id] && n(m[def.metric]) >= def.target) {
      profile.unlocked[def.id] = now || new Date().toISOString(); fresh.push(def);
    }
    return fresh;
  }

  function summary(profile, m) {
    const items = LIST.map(def => {
      const at = profile.unlocked[def.id] || null, value = m ? Math.min(def.target, n(m[def.metric])) : 0;
      return { ...def, unlocked: !!at, unlockedAt: at, value: at ? def.target : value, progress: at ? 1 : value / def.target };
    });
    const unlocked = items.filter(i => i.unlocked);
    return {
      items, categories: CATEGORIES.map(c => ({ ...c, total: items.filter(i => i.category === c.id).length, unlocked: unlocked.filter(i => i.category === c.id).length })),
      unlockedCount: unlocked.length, total: LIST.length, points: unlocked.reduce((sum, i) => sum + i.points, 0), maxPoints: LIST.reduce((sum, i) => sum + i.points, 0),
      titles: unlocked.filter(i => i.title).map(i => ({ id: i.id, title: i.title })), title: profile.title && byId[profile.title] ? byId[profile.title].title : null, titleId: profile.title
    };
  }

  function setTitle(profile, id) {
    if (id === null || id === '') { profile.title = null; return true; }
    if (!byId[id] || !byId[id].title || !profile.unlocked[id]) return false;
    profile.title = id; return true;
  }

  const api = { VERSION, PROFILE_KEY, CATEGORIES, LIST, metrics, blankProfile, normalizeProfile, evaluate, summary, setTitle };
  global.ForgeAchievements = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
