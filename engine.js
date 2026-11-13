(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ForgeSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // This module deliberately has no DOM, browser timers, or storage dependencies.
  // Every economic change is an action or a deterministic simulation step.
  const VERSION = 3;
  const DATA = {
    dayLength: 120,
    adventurerMaxLevel: 300,
    characterProfiles: {
      raon: { name: '로언', job: '검사', color: '#bc6147' },
      luna: { name: '루미', job: '마법사', color: '#8964a2' },
      rin: { name: '실바', job: '궁수', color: '#5c8870' },
      sera: { name: '노아', job: '도적', color: '#657c9a' }
    },
    materials: {
      iron: { name: '철광석', color: '#9da9ab', price: 8, minPower: 8, icon: 'ore' },
      wood: { name: '참나무', color: '#bd925f', price: 5, minPower: 8, icon: 'wood' },
      leather: { name: '튼튼한 가죽', color: '#bd795a', price: 7, minPower: 8, icon: 'leather' },
      crystal: { name: '빛나는 수정', color: '#a59bd7', price: 24, minPower: 48, icon: 'crystal' },
      mythril: { name: '미스릴', color: '#76c8c2', price: 50, minPower: 80, icon: 'ore' }
    },
    qualityOrder: ['normal', 'good', 'fine', 'masterwork', 'masterpiece', 'legendary', 'mythic'],
    qualities: {
      normal: { name: '일반', label: '일반', color: '#7b806f', multiplier: 1, rank: 0, options: 1, fame: 0, festivalBonus: 15, minCraftLevel: 1 },
      // 2026-11 balance: compressed so quality x enhancement tops out near 2.6x instead of 4.84x.
      good: { name: '양품', label: '양품', color: '#698356', multiplier: 1.05, rank: 1, options: 1, fame: 0, festivalBonus: 30, minCraftLevel: 1 },
      fine: { name: '우수', label: '우수', color: '#438a82', multiplier: 1.1, rank: 2, options: 2, fame: 2, festivalBonus: 45, minCraftLevel: 1 },
      masterwork: { name: '명품', label: '명품', color: '#8767ac', multiplier: 1.2, rank: 3, options: 3, fame: 6, festivalBonus: 90, minCraftLevel: 1 },
      masterpiece: { name: '걸작', label: '걸작', color: '#987322', multiplier: 1.32, rank: 4, options: 3, fame: 10, festivalBonus: 135, minCraftLevel: 10 },
      legendary: { name: '전설', label: '전설', color: '#b76030', multiplier: 1.46, rank: 5, options: 3, fame: 16, festivalBonus: 190, minCraftLevel: 20 },
      mythic: { name: '신화', label: '신화', color: '#b54e72', multiplier: 1.6, rank: 6, options: 3, fame: 24, festivalBonus: 260, minCraftLevel: 30 }
    },
    recipes: [
      { id: 'iron_sword', name: '철 단검', type: 'sword', description: '첫 모험을 함께할 든든한 한 자루.', tier: 1, power: 16, price: 68, cost: { iron: 3, wood: 1 }, duration: 7, icon: 'sword' },
      { id: 'oak_bow', name: '떡갈나무 활', type: 'bow', description: '탄성이 좋은 나무로 깎은 초보 사냥꾼의 활.', tier: 1, power: 18, price: 76, cost: { wood: 4, leather: 1 }, duration: 9, icon: 'bow' },
      { id: 'iron_shield', name: '철제 방패', type: 'shield', description: '고블린의 공격도 견디는 단단한 방패.', tier: 1, power: 21, price: 92, cost: { iron: 4, leather: 2 }, duration: 11, icon: 'shield' },
      { id: 'steel_sword', name: '강철 장검', type: 'sword', description: '반복해서 두드려 불순물을 덜어낸 날카로운 검.', tier: 2, power: 34, price: 162, cost: { iron: 6, wood: 2, leather: 1 }, duration: 13, icon: 'sword' },
      { id: 'hunter_bow', name: '사냥꾼의 활', type: 'bow', description: '숙련된 궁수가 찾는 정교한 복합궁.', tier: 2, power: 38, price: 188, cost: { wood: 6, iron: 2, leather: 3 }, duration: 15, icon: 'bow' },
      { id: 'guard_armor', name: '수호자의 갑옷', type: 'armor', description: '먼 유적을 탐험할 때도 몸을 지켜주는 갑옷.', tier: 2, power: 43, price: 226, cost: { iron: 8, leather: 4 }, duration: 17, icon: 'armor' },
      { id: 'crystal_staff', name: '수정 지팡이', type: 'staff', description: '달빛 유적의 수정이 신비로운 힘을 발한다.', tier: 3, power: 61, price: 308, cost: { wood: 4, crystal: 3, iron: 2 }, duration: 20, icon: 'staff' },
      { id: 'mythril_blade', name: '미스릴 검', type: 'sword', description: '가볍고 날카로운 은빛 금속의 명검.', tier: 3, power: 82, price: 448, cost: { mythril: 3, iron: 6, crystal: 1 }, duration: 24, icon: 'sword' },
      { id: 'dragon_armor', name: '용기사의 갑옷', type: 'armor', description: '용의 둥지에 도전하는 모험가를 위한 걸작.', tier: 3, power: 102, price: 624, cost: { mythril: 5, leather: 6, crystal: 3 }, duration: 28, icon: 'armor' }
    ],
    regions: [
      { id: 'greenwood', name: '속삭임 숲', minPower: 8, duration: 26, gold: 48, xp: 28, color: '#71956d', description: '햇살이 스며드는 초보 모험가의 숲.', loot: { wood: [2, 4], iron: [1, 3], leather: [1, 2] } },
      { id: 'quarry', name: '고블린 광산', minPower: 26, duration: 36, gold: 84, xp: 40, color: '#a48c66', description: '철광석이 풍부한 버려진 광산.', loot: { iron: [3, 6], leather: [1, 3], wood: [1, 2] } },
      { id: 'ruins', name: '달빛 유적', minPower: 48, duration: 46, gold: 138, xp: 56, color: '#9b90b6', description: '푸른 수정이 잠든 고대의 유적.', loot: { crystal: [2, 4], iron: [2, 4], leather: [1, 2] } },
      { id: 'ridge', name: '미스릴 설산', minPower: 80, duration: 58, gold: 204, xp: 74, color: '#79aeb5', description: '눈보라 너머 희귀한 미스릴 광맥.', loot: { mythril: [2, 4], crystal: [1, 3], iron: [3, 5] } },
      { id: 'abyss', name: '용의 둥지', minPower: 120, duration: 70, gold: 292, xp: 98, color: '#b17661', description: '최고의 장비를 갖춘 모험가들의 마지막 도전.', loot: { mythril: [3, 6], crystal: [3, 5], leather: [3, 5] } }
    ],
    upgrades: [
      { id: 'furnace', name: '화로 개선', description: '제작 속도 +22%, 우수·명품 제작 확률 증가', baseCost: 180, maxLevel: 3, icon: 'flame' },
      { id: 'display', name: '진열대 확장', description: '진열 공간 +4칸, 새 장비 판매가 +5%', baseCost: 160, maxLevel: 3, icon: 'shelf' },
      { id: 'apprentice', name: '견습생 고용', description: '제작 대기열 +2칸, 제작 속도 +12%', baseCost: 260, maxLevel: 2, icon: 'person' },
      { id: 'shop', name: '대장간 증축', description: '다음 단계 설계도 해금, 진열 공간 +4칸', baseCost: 480, maxLevel: 2, icon: 'shop' }
    ]
  };

  // Serializable rules only: the renderer never advances an actor or a production job.
  DATA.slots = [
    { id: 'weapon', name: '무기' }, { id: 'offhand', name: '보조장비' },
    { id: 'armor', name: '갑옷' }, { id: 'accessory', name: '장신구' }
  ];
  DATA.recipes.push(
    { id: 'leather_armor', name: '여행자의 가죽옷', type: 'armor', description: '첫 사냥의 상처를 줄여주는 튼튼한 가죽옷.', tier: 1, power: 15, price: 80, cost: { leather: 4, iron: 1 }, duration: 9, icon: 'armor' },
    { id: 'copper_ring', name: '행운의 구리 반지', type: 'accessory', description: '작은 힘과 체력을 더해주는 모험가의 부적.', tier: 1, power: 12, price: 64, cost: { iron: 2, wood: 1 }, duration: 8, icon: 'ring' },
    { id: 'mythril_shield', name: '미스릴 방패', type: 'shield', description: '설산과 용의 둥지에서 몸을 지켜주는 은빛 방패.', tier: 3, power: 70, price: 380, cost: { mythril: 3, iron: 5, leather: 3 }, duration: 22, icon: 'shield' }
  );
  for (const r of DATA.recipes) {
    r.slot = r.type === 'shield' ? 'offhand' : r.type === 'armor' ? 'armor' : r.type === 'accessory' ? 'accessory' : 'weapon';
    r.attack = r.slot === 'weapon' ? r.power : r.slot === 'accessory' ? Math.round(r.power * .3) : 0;
    r.defense = r.slot === 'offhand' ? Math.round(r.power * .75) : r.slot === 'armor' ? Math.round(r.power * .6) : r.slot === 'accessory' ? Math.round(r.power * .2) : 0;
    r.hp = r.slot === 'armor' ? r.power : r.slot === 'offhand' ? Math.round(r.power * .4) : r.slot === 'accessory' ? Math.round(r.power * .5) : 0;
  }
  DATA.facilityTypes = {
    furnace: { id: 'furnace', name: '화덕', w: 2, h: 2, cost: 500, queueSlots: 3, icon: 'flame', description: '제작 대기열 +3칸. 앞에 도착한 제조 직원이 있어야 가동됩니다.' },
    display: { id: 'display', name: '장비 진열대', w: 2, h: 3, cost: 450, stockSlots: 6, icon: 'shelf', description: '장비 진열 공간 +6칸. 판매 직원이 응대하면 판매 수익이 늘어납니다.' },
    enhance: { id: 'enhance', name: '강화 작업대', w: 2, h: 2, cost: 700, icon: 'hammer', description: '모험가가 사냥한 강화석으로 장비를 강화합니다. 실패하면 장비가 파괴됩니다.' }
  };
  DATA.staffCandidates = [
    { id: 'smith', name: '한스', role: 'smith', craftSkill: 55, salesSkill: 20, stamina: 100, cost: 240, spriteIndex: 1 },
    { id: 'artisan', name: '에다', role: 'smith', craftSkill: 78, salesSkill: 32, stamina: 120, cost: 420, spriteIndex: 1 },
    { id: 'seller', name: '벨', role: 'sales', craftSkill: 24, salesSkill: 68, stamina: 100, cost: 220, spriteIndex: 2 },
    { id: 'helper', name: '유리', role: 'smith', craftSkill: 38, salesSkill: 45, stamina: 110, cost: 180, spriteIndex: 2 }
  ];
  DATA.enhancement = {
    maxLevel: 10,
    successRates: [.95, .92, .88, .83, .78, .70, .62, .54, .46, .38],
    stoneCosts: [1, 2, 3, 4, 6, 8, 10, 13, 16, 20],
    fees: [4, 6, 9, 13, 18, 24, 30, 38, 48, 60],
    statSoftCap: 5, statBonusPerLevel: .09, advancedStatBonusPerLevel: .03
  };
  // 2026-11 balance review (docs/balance-review-2026-11-07.md).
  // Shop expansion: 3,000 G then 12,000 G (was 480 / 864).
  const EXPANSION_BASE_COST = 3000, EXPANSION_GROWTH = 4;
  // Heroes pick hunting grounds with a safety margin, so better gear opens better grounds.
  const REGION_SAFETY_MARGIN = 1.15;
  // A lost hunt wears down every equipped item (durability points), creating repair/replacement demand.
  const DEFEAT_DURABILITY_LOSS = [15, 25];
  // Residents who outgrow their town move to the next opened town. Branch towns are populated by migration.
  const MIGRATION_READY_FOR_BRANCH = 3;
  // Hero experience to the next level: 30 + 5 x level.
  const HERO_XP_BASE = 30, HERO_XP_PER_LEVEL = 5;
  // 2026-11-09 balance pass (docs/balance-review-2026-11-09.md): heroes in branch towns (2호점 onward) gain hunt XP faster,
  // so the wait for each next branch is shorter. Graduation needs the previous town's top hunting ground (no margin).
  // Per town (by order): 초록숲 1, 돌다리 2.5, 달빛 항구 2.5, 해오름 성채 3.5, 서리문 3.5.
  // Graduation margin over the previous town's top ground, by destination town: 초록숲 → 돌다리 keeps x1.15 (150) so the
  // first town's bosses (130 / 147) are beaten before its heroes leave (2026-11-10, user decision 'A'); later towns x1.0.
  // 2026-11-10 사용자: balance to the tailored-gear player (sim GEAR=1), final boss ~7h at 2x. Branch-town hunting XP
  // multipliers 2.5/2.5/3.5/3.5 → 1.7/1.7/2.3/2.3 (towns 3~5 were gated by "이주 준비 모험가" power, so this stretches them).
  const BRANCH_HERO_XP_MULT = [1, 1.7, 1.7, 2.3, 2.3], MIGRATION_POWER_MARGIN = [1, 1.15, 1, 1, 1];
  DATA.towns = [
    { id: 'greenwood', name: '초록숲 마을', subtitle: '모든 불꽃이 시작되는 곳', openingCost: 0, requiredLevel: 1, requiredReputation: 0, regionIds: ['greenwood', 'quarry', 'ruins'], x: .29, y: .62 },
    { id: 'stonebridge', name: '돌다리 마을', subtitle: '설산으로 향하는 모험가들의 길목', openingCost: 9000, requiredLevel: 2, requiredReputation: 15, regionIds: ['greenwood', 'quarry', 'ruins', 'ridge', 'abyss'], x: .72, y: .35 }
  ];
  DATA.upgrades = [
    { id: 'furnace', name: '화덕 배치', description: '대기열 +3칸 · 제조 직원 필요', baseCost: 500, maxLevel: 20, icon: 'flame' },
    { id: 'display', name: '진열대 배치', description: '실제 진열 공간 +6칸', baseCost: 450, maxLevel: 20, icon: 'shelf' },
    { id: 'enhance', name: '강화 작업대 배치', description: '모험가의 자율 강화 장소', baseCost: 700, maxLevel: 10, icon: 'hammer' },
    { id: 'apprentice', name: '직원 고용', description: '제조 · 판매 · 체력 능력치를 가진 직원', baseCost: 240, maxLevel: 30, icon: 'person' },
    { id: 'shop', name: '대장간 확장', description: '레벨마다 화덕·진열대 수 증가 · Lv.4 고급, Lv.5 최고급 화덕', baseCost: 480, maxLevel: 2, icon: 'shop' },
    { id: 'inn', name: '여관 증축', description: '침대 +2개 · 새 모험가 유입', baseCost: 300, maxLevel: 47, icon: 'bed' }
  ];
  const raidDataModule = raidModule();
  if (raidDataModule && typeof raidDataModule.decorateData === 'function') raidDataModule.decorateData(DATA);
  const campaignDataModule = campaignModule();
  if (campaignDataModule && typeof campaignDataModule.decorateData === 'function') campaignDataModule.decorateData(DATA);
  const progressionDataModule = progression();
  if (progressionDataModule && typeof progressionDataModule.extendData === 'function') progressionDataModule.extendData(DATA);
  const worldDataModule = extensionModule('world');
  if (worldDataModule && worldDataModule.extendData) worldDataModule.extendData(DATA);
  const equipmentDataModule = extensionModule('equipment');
  if (equipmentDataModule && equipmentDataModule.extendData) equipmentDataModule.extendData(DATA);
  // Special schematics are awarded once per chain and use ordinary materials.
  DATA.recipes.push(
    {...DATA.recipes.find(r=>r.id==='iron_sword'),id:'world_reward_blade',name:'심연을 가른 검',requiredLevel:20,tier:3,power:92,price:650,cost:{iron:8,wood:4,crystal:3},duration:24,attack:92,source:'world-drop',unlockDrop:true,description:'월드 보스를 토벌해 얻는 특별 설계도.'},
    {...DATA.recipes.find(r=>r.id==='iron_shield'),id:'invasion_reward_shield',name:'마을 수호 방패',requiredLevel:8,tier:2,power:44,price:295,cost:{iron:6,wood:3,leather:3},duration:15,defense:33,hp:18,source:'invasion-drop',unlockDrop:true,description:'마을 방어에서 얻는 특별 설계도.'}
  );
  const warehouseDataModule = warehouseModule();
  if (warehouseDataModule && warehouseDataModule.decorateData) warehouseDataModule.decorateData(DATA);
  const workerArt = { smith: 100, artisan: 101, seller: 102, helper: 103, master: 104, apprentice: 105 };
  // Looks for new applicants by role (art-pack.js motion sheets); innkeepers keep the earlier picture (123).
  DATA.staffLooks = { smith: [100, 101, 106, 107, 108, 109, 110, 111], sales: [102, 112, 113, 114], buyer: [115, 116, 117], logistics: [103, 118, 119, 120], enhancer: [121, 122], innkeeper: [123] };
  for (const candidate of DATA.staffCandidates) if (Object.hasOwn(workerArt, candidate.id)) candidate.spriteIndex = workerArt[candidate.id];
  for (const r of DATA.recipes) {
    r.slot = r.slot || (r.type === 'shield' ? 'offhand' : r.type === 'armor' ? 'armor' : r.type === 'accessory' ? 'accessory' : 'weapon');
    if (r.attack == null) r.attack = r.slot === 'weapon' ? r.power : r.slot === 'accessory' ? Math.round(r.power * .3) : 0;
    if (r.defense == null) r.defense = r.slot === 'offhand' ? Math.round(r.power * .75) : r.slot === 'armor' ? Math.round(r.power * .6) : r.slot === 'accessory' ? Math.round(r.power * .2) : 0;
    if (r.hp == null) r.hp = r.slot === 'armor' ? r.power : r.slot === 'offhand' ? Math.round(r.power * .4) : r.slot === 'accessory' ? Math.round(r.power * .5) : 0;
  }
  // 2026-11 boss rare recipes: a recipe that needs a boss's material is that boss's rare recipe. Bosses hand it to an
  // adventurer (not materials to the shop); the adventurer gathers the materials and commissions the piece for themself.
  // These recipes are never made for stock. Town-defence (invasion ember) recipes stay ordinary shop recipes.
  // 2026-11-09 v2 (docs/events-and-boss-recipes-v2.md ⑤): boss materials are retired. The 17 recipes that used them
  // are ordinary shop recipes now (the boss material's value is paid in crystal below Lv20, mythril from Lv20).
  // Each boss instead has 3 rare recipes of its own: ordinary materials in huge amounts, 5-15 game days at the
  // furnace, +12% over the best ordinary piece of the same kind. Old boss materials in a save are paid out in gold.
  {
    const retired = new Set((DATA.bosses || []).map(b => b.materialId));
    for (const m of retired) if (DATA.materials[m]) DATA.materials[m].retired = true;
    for (const r of DATA.recipes) {
      if (!r.cost) continue;
      let value = 0;
      for (const m of Object.keys(r.cost)) if (retired.has(m)) { value += (DATA.materials[m] ? DATA.materials[m].price : 0) * r.cost[m]; delete r.cost[m]; }
      if (!value) continue;
      const level = r.requiredLevel || 1, sub = level >= 20 ? 'mythril' : 'crystal';
      r.cost[sub] = (r.cost[sub] || 0) + Math.max(1, Math.round(value / DATA.materials[sub].price));
      if (r.source === 'raid' || !r.source) r.source = 'standard'; delete r.bossRecipe;
    }
    const DAY = DATA.dayLength || 120;
    const RARE = [
      // [id, name, boss, base recipe, days, cost, description]
      ['rare_moss_sword', '이끼심장 수호검', 'moss_warden', 'forest_blade', 5, { iron: 40, wood: 30, leather: 20 }, '고목 수호자의 심장이 뛰던 자리에서 찾은 설계도로 벼린 검.'],
      ['rare_moss_shield', '나이테 대방패', 'moss_warden', 'giant_guard', 5, { iron: 45, leather: 30, wood: 20 }, '천 년 나이테를 그대로 살려 만든 대방패.'],
      ['rare_moss_light', '새순 망토 경갑', 'moss_warden', 'light_craft_10', 5, { leather: 45, iron: 25, wood: 20 }, '어깨에 새순 망토를 두른 가벼운 경갑.'],
      ['rare_colossus_axe', '바위쪼개기 도끼', 'stone_colossus', 'axe_craft_10', 7, { iron: 60, wood: 40, leather: 20 }, '바위 거인의 몸을 쪼갠 날을 본뜬 도끼.'],
      ['rare_colossus_heavy', '거인 어깨 중갑', 'stone_colossus', 'heavy_craft_10', 7, { iron: 70, leather: 40, crystal: 10 }, '거인의 어깨처럼 넓고 단단한 중갑.'],
      ['rare_colossus_belt', '바위심장 허리띠', 'stone_colossus', 'belt_craft_10', 7, { leather: 60, iron: 40, crystal: 15 }, '바위 심장을 버클로 박은 허리띠.'],
      ['rare_oracle_staff', '별점 예언자의 지팡이', 'ruin_oracle', 'star_staff', 10, { wood: 80, crystal: 60, mythril: 25 }, '예언자가 별을 읽던 지팡이를 되살렸다.'],
      ['rare_oracle_cloth', '밤하늘 수놓은 로브', 'ruin_oracle', 'cloth_craft_20', 10, { leather: 80, crystal: 60, mythril: 25 }, '별자리를 한 땀씩 수놓은 로브.'],
      ['rare_oracle_amulet', '삼킨 별의 목걸이', 'ruin_oracle', 'amulet_craft_20', 10, { crystal: 70, leather: 50, mythril: 30 }, '삼켜진 별 하나를 품은 목걸이.'],
      ['rare_drake_bow', '서리날개 장궁', 'frost_drake', 'frost_bow', 12, { wood: 120, leather: 60, mythril: 50 }, '서리용의 날개 모양을 그대로 본뜬 장궁.'],
      ['rare_drake_quiver', '얼음깃 화살통', 'frost_drake', 'quiver_craft_20', 12, { leather: 120, wood: 60, mythril: 45 }, '얼음 깃 화살이 마르지 않는 화살통.'],
      ['rare_drake_gauntlet', '용발톱 권갑', 'frost_drake', 'gauntlet_craft_20', 12, { leather: 100, mythril: 60, crystal: 50 }, '서리용 발톱을 주먹에 단 권갑.'],
      ['rare_abyss_spear', '군주를 꿰뚫은 창', 'abyss_sovereign', 'astral_spear_30', 15, { iron: 150, mythril: 120, wood: 100 }, '심연의 군주를 꿰뚫었다는 전설의 창.'],
      ['rare_abyss_dagger', '그림자 삼킨 쌍단검', 'abyss_sovereign', 'astral_dagger_30', 15, { iron: 150, mythril: 120, crystal: 80 }, '그림자를 삼켜 소리 없이 베는 쌍단검.'],
      ['rare_abyss_ring', '심연 왕좌의 반지', 'abyss_sovereign', 'astral_crown', 15, { mythril: 150, crystal: 120, iron: 60 }, '심연의 왕좌에 박혀 있던 보석을 얹은 반지.'],
      // 2026-11-10 사용자 요청: the 서리문 final boss drops rare recipes too.
      ['rare_silent_sword', '침묵을 가른 장검', 'silent_king', 'astral_sword_30', 15, { iron: 170, mythril: 140, crystal: 90 }, '얼음성의 침묵을 단칼에 가른 장검.'],
      ['rare_silent_shield', '얼음왕관 방패', 'silent_king', 'astral_shield_30', 15, { iron: 160, mythril: 130, leather: 100 }, '침묵왕의 얼음 왕관을 녹여 두른 방패.'],
      ['rare_silent_staff', '서리별 왕홀', 'silent_king', 'astral_staff_30', 15, { wood: 150, mythril: 140, crystal: 110 }, '얼음성 왕좌 옆에 서 있던 서리별 왕홀.']
    ];
    const REP = { moss_warden: 10, stone_colossus: 12, ruin_oracle: 15, frost_drake: 20, abyss_sovereign: 25, silent_king: 30 };
    for (const [rid, name, bossId, baseId, days, cost, description] of RARE) {
      const base = DATA.recipes.find(r => r.id === baseId); if (!base || DATA.recipes.some(r => r.id === rid)) continue;
      const k = 1.12, value = Object.entries(cost).reduce((sum, [m, n]) => sum + DATA.materials[m].price * n, 0);
      DATA.recipes.push({ ...base, id: rid, name, cost: { ...cost }, power: Math.round(base.power * k), attack: Math.round((base.attack || 0) * k), defense: Math.round((base.defense || 0) * k), hp: Math.round((base.hp || 0) * k),
        price: Math.round(value * 2.5), duration: days * DAY * 7 / 9, craftDays: days, description, source: 'boss', bossRecipe: bossId, rare: true, iconOf: baseId, bossReputation: REP[bossId] || 10, balanceStatus: 'provisional' });
    }
    DATA.bossRecipes = Object.fromEntries((DATA.bosses || []).map(b => [b.id, DATA.recipes.filter(r => r.bossRecipe === b.id).map(r => r.id)]));
  }
  const BOSS_RECIPE_HUNTS = DATA.bossRecipeHunts = 3; // older saves: a carried recipe counts as gathered
  DATA.bossRecipeChance = .12; DATA.bossRecipePity = 8; // drop chance per win; the 8th win in a row without one always drops
  const recipeMap = Object.fromEntries(DATA.recipes.map(r => [r.id, r]));
  const regionMap = Object.fromEntries(DATA.regions.map(r => [r.id, r]));
  const townMap = Object.fromEntries(DATA.towns.map(t => [t.id, t]));
  const staffRoleNames = { smith: '제조', sales: '판매', buyer: '재료 매입', logistics: '물류·진열', enhancer: '강화 보조', innkeeper: '여관 관리' };
  const staffRoleFacilities = { smith: 'furnace', sales: 'display', logistics: 'display', enhancer: 'enhance' };
  const materialIds = Object.keys(DATA.materials);
  const slotIds = DATA.slots.map(x => x.id);
  const heroStatuses = ['visiting', 'departing', 'hunting', 'returning', 'enhancing', 'resting', 'leaving', 'traveling', 'recalling', 'defending'];
  const originalIds = ['raon', 'rin', 'tobi', 'luna', 'bram', 'sera'];
  const goalDefinitions = [
    { id: 'first_craft', title: '첫 번째 불꽃', description: '장비를 1개 제작하세요.', target: 1, reward: 40, value: s => s.stats.crafted },
    { id: 'first_sales', title: '단골의 시작', description: '모험가에게 장비를 3개 판매하세요.', target: 3, reward: 80, value: s => s.stats.sold },
    { id: 'first_quest', title: '서로 돕는 사이', description: '재료 수집 의뢰를 1번 완료하세요.', target: 1, reward: 100, value: s => s.stats.quests },
    { id: 'shop_two', title: '더 큰 꿈', description: '대장간을 1번 증축하세요.', target: 1, reward: 100, value: s => Math.max(...getOwnedTowns(s).map(t => t.level - 1)) },
    { id: 'first_enhance', title: '한 단계 더 강하게', description: '모험가 장비 강화를 3번 성공시키세요.', target: 3, reward: 120, value: s => s.stats.enhanced },
    { id: 'ruins', title: '유적의 문을 열다', description: '돌다리 마을 모험가가 달빛 유적 사냥을 완료하게 하세요.', target: 1, reward: 180, value: s => s.stats.regions.ruins || 0 },
    { id: 'master_shop', title: '마을의 명장', description: '대장간을 최대로 증축하세요.', target: 2, reward: 220, value: s => Math.max(...getOwnedTowns(s).map(t => t.level - 1)) },
    { id: 'dragon', title: '전설을 만드는 곳', description: '모험가가 용의 둥지 사냥을 완료하게 하세요.', target: 1, reward: 500, value: s => s.stats.regions.abyss || 0 },
    { id: 'first_order', title: '당신을 위한 한 자루', description: '진열 장비를 골라 제작 의뢰를 납품하세요.', target: 1, reward: 120, value: s => s.stats.orders },
    { id: 'second_branch', title: '새 마을의 불빛', description: '돌다리 마을에 2호점을 여세요.', target: 2, reward: 200, value: s => getOwnedTowns(s).length }
  ];

  function known(map, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key); }
  function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function finite(n, lo, hi) { return typeof n === 'number' && Number.isFinite(n) && n >= lo && (hi == null || n <= hi); }
  function integer(n, lo, hi) { return Number.isInteger(n) && finite(n, lo, hi); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function random(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function int(s, lo, hi) { return lo + Math.floor(random(s) * (hi - lo + 1)); }
  function id(s, prefix) { return prefix + '-' + (++s.seq); }
  function emptyBag() { return Object.fromEntries(materialIds.map(m => [m, 0])); }
  function result(ok, message, extra) { return Object.assign({ ok, message }, extra || {}); }
  function log(s, type, text, extra) {
    const e = Object.assign({ id: id(s, 'event'), seq: s.seq, time: s.time, type, text }, extra || {});
    s.logs.unshift(e); if (s.logs.length > 60) s.logs.length = 60;
    s.events.push(e); if (s.events.length > 30) s.events.splice(0, s.events.length - 30);
    return e;
  }
  var progressionCache, raidModuleCache, raidsApiCache, campaignModuleCache, campaignApiCache, operationsModuleCache, operationsApiCache, customerModuleCache, customerApiCache, warehouseModuleCache, warehouseApiCache, shopLayoutCache, extensionCache, personalityCache, recruitmentModuleCache, recruitmentApiCache;
  function personality() {
    if (root && root.ForgePersonality) return root.ForgePersonality;
    if (personalityCache !== undefined) return personalityCache;
    if (typeof require === 'function') { try { personalityCache = require('./personality.js'); } catch (_) { personalityCache = null; } }
    return personalityCache || null;
  }
  function personalityEffect(actor, key) { const p = personality(); return p ? p.effect(actor, key) : /Chance$/.test(key) ? 0 : 1; }
  function ensureIdentity(s, actor, kind, options) { const p = personality(); return p ? p.ensure(s, actor, kind, options) : actor; }
  function getPersonality(actor) { const p = personality(); return p ? p.getTrait(actor) : null; }
  function getPersonalities() { const p = personality(); return p ? p.getTraits() : []; }
  function previewIdentity(s, actor, kind) { const p = personality(); return p && p.preview ? p.preview(s, actor, kind) : actor; }
  function recruitmentApi() {
    if (recruitmentApiCache) return recruitmentApiCache;
    let module = root && root.ForgeRecruitment;
    if (!module && typeof require === 'function') {
      if (recruitmentModuleCache === undefined) { try { recruitmentModuleCache = require('./recruitment.js'); } catch (_) { recruitmentModuleCache = null; } }
      module = recruitmentModuleCache;
    }
    if (!module || !module.create) return null;
    recruitmentApiCache = module.create({ DATA, getTown, getOwnedTowns, createStaff, log, result, personality: personality() });
    return recruitmentApiCache;
  }
  function recruitmentHook(name, ...args) { const api = recruitmentApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function advanceRecruitment(s, nowMs) { return recruitmentHook('advance', s, nowMs); }
  function getRecruitmentBoard(s, townId, nowMs) { return recruitmentHook('getBoard', s, townId, nowMs); }
  function postRecruitmentAd(s, townId, nowMs) { return recruitmentHook('postPremium', s, townId, nowMs) || result(false, '모집 공고를 준비 중입니다.'); }
  function hireRecruitmentCandidate(s, offerId, townId, nowMs) { return recruitmentHook('hireCandidate', s, offerId, townId, nowMs) || result(false, '채용 후보를 확인해주세요.'); }
  function progression() {
    if (root && root.ForgeProgression) return root.ForgeProgression;
    if (progressionCache !== undefined) return progressionCache;
    if (typeof require === 'function') { try { progressionCache = require('./progression.js'); } catch (_) { progressionCache = null; } }
    return progressionCache || null;
  }
  function progressionHook(name, ...args) {
    const p = progression();
    if (p && typeof p[name] === 'function') return p[name](...args, { DATA, log, random, id, getTown, getOwnedTowns, getCombatStats, getItemStats, getItemEnhancementMultiplier, getResidents, getEquipmentCapacity, getEquipmentUsage, personalityEffect, researchEffect });
    return null;
  }

  function extensionModule(kind) {
    const globalName = kind === 'world' ? 'ForgeWorld' : 'ForgeEquipment';
    if (root && root[globalName]) return root[globalName];
    if (!extensionCache) extensionCache = {};
    if (Object.hasOwn(extensionCache, kind)) return extensionCache[kind];
    if (typeof require === 'function') { try { extensionCache[kind] = require(kind === 'world' ? './world-data.js' : './equipment-data.js'); } catch (_) { extensionCache[kind] = null; } }
    return extensionCache[kind] || null;
  }
  function campaignModule() {
    if (root && root.ForgeCampaign) return root.ForgeCampaign;
    if (campaignModuleCache !== undefined) return campaignModuleCache;
    if (typeof require === 'function') { try { campaignModuleCache = require('./campaign.js'); } catch (_) { campaignModuleCache = null; } }
    return campaignModuleCache || null;
  }
  function campaignApi() {
    if (campaignApiCache) return campaignApiCache;
    const module = campaignModule(); if (!module || !module.create) return null;
    campaignApiCache = module.create({ DATA, getTown, getOwnedTowns, getResidents, getCombatStats, getTownLayout, random, int, id, log, result,
      setDestination, moveActor, clearRoute, findPath, beginRest, prepareRecall, getRallyPoints, releaseWorker, createStaff, ensureIdentity, personalityEffect,
      cancelTownRaids: (s, townId, reason) => raidHook('cancelTownRaids', s, townId, reason),
      getPayroll, getInnUpgradeCost, getExpansionCost, getBuildCost, grantRecipeDrop });
    return campaignApiCache;
  }
  function campaignHook(name, ...args) { const api = campaignApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getInvasion(s, townId) { return campaignHook('getInvasion', s, townId); }
  function triggerInvasion(s, townId) { return campaignHook('triggerInvasion', s, townId) || result(false, '침공 사건을 준비 중입니다.'); }
  function getFame(s) { return campaignHook('getFame', s) || { value: s.reputation, rank: 0, rankName: '마을의 작은 대장간', nextThreshold: null, progress: 0 }; }
  function getRecruitOffers(s) { return campaignHook('getRecruitOffers', s) || []; }
  function hireRecruit(s, offerId) { return campaignHook('hireRecruit', s, offerId) || result(false, '방문 인재가 없습니다.'); }
  function getTraining(s, staffId) { return campaignHook('getTraining', s, staffId); }
  function getTrainingQuote(s, staffId) { return campaignHook('getTrainingQuote', s, staffId); }
  function trainStaff(s, staffId) { return campaignHook('trainStaff', s, staffId) || result(false, '직원 교육을 준비 중입니다.'); }
  function getReliefQuote(s, townId) { return campaignHook('getReliefQuote', s, townId); }
  function fundRelief(s, townId) { return campaignHook('fundRelief', s, townId) || result(false, '지원할 부상자가 없습니다.'); }
  function getGoldSinks(s) { return campaignHook('getGoldSinks', s) || []; }

  function shopLayout() {
    if (root && root.ForgeShopLayout) return root.ForgeShopLayout;
    if (!shopLayoutCache && typeof require === 'function') shopLayoutCache = require('./shop-layout.js');
    return shopLayoutCache;
  }
  function warehouseModule() {
    if (root && root.ForgeWarehouse) return root.ForgeWarehouse;
    if (warehouseModuleCache !== undefined) return warehouseModuleCache;
    if (typeof require === 'function') { try { warehouseModuleCache = require('./warehouse.js'); } catch (_) { warehouseModuleCache = null; } }
    return warehouseModuleCache || null;
  }
  function warehouseApi() {
    if (warehouseApiCache) return warehouseApiCache;
    const module = warehouseModule(); if (!module || !module.create) return null;
    warehouseApiCache = module.create({ DATA, getTown, getOwnedTowns, result, log, onLayoutChange });
    return warehouseApiCache;
  }
  // Seasonal calendar events (dist/seasons.js): summer caravan market, autumn harvest order, winter cold snap.
  let seasonsModuleCache, seasonsApiCache;
  function seasonsModule() { if (root && root.ForgeSeasons) return root.ForgeSeasons; if (seasonsModuleCache !== undefined) return seasonsModuleCache; if (typeof require === 'function') { try { seasonsModuleCache = require('./seasons.js'); } catch (_) { seasonsModuleCache = null; } } return seasonsModuleCache || null; }
  function seasonsApi() { if (seasonsApiCache) return seasonsApiCache; const module = seasonsModule(); if (!module || typeof module.create !== 'function') return null; seasonsApiCache = module.create({ DATA, getOwnedTowns, getCalendar, random, int, log, result, getMaterialRoom, isCustomerItemReserved }); return seasonsApiCache; }
  function seasonHook(name, ...args) { const api = seasonsApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getSeasonEvents(s) { return seasonHook('getSeasonEvents', s); }
  function buySeasonMarket(s, offerId, amount) { return seasonHook('buyMarket', s, offerId, amount) || result(false, '상단 장터를 준비 중입니다.'); }
  function deliverSeasonHarvest(s, recipeId) { const r = seasonHook('deliverHarvest', s, recipeId) || result(false, '수확제 주문을 준비 중입니다.'); if (r.ok) s.stats.harvestDeliveries = (s.stats.harvestDeliveries || 0) + 1; return r; }
  // Sudden incidents (dist/incidents.js, 2026-11-09): listed under the calendar, each with its own deadline.
  let incidentsModuleCache, incidentsApiCache;
  function incidentsModule() { if (root && root.ForgeIncidents) return root.ForgeIncidents; if (incidentsModuleCache !== undefined) return incidentsModuleCache; if (typeof require === 'function') { try { incidentsModuleCache = require('./incidents.js'); } catch (_) { incidentsModuleCache = null; } } return incidentsModuleCache || null; }
  function incidentsApi() {
    if (incidentsApiCache) return incidentsApiCache; const module = incidentsModule(); if (!module || typeof module.create !== 'function') return null;
    incidentsApiCache = module.create({ DATA, getTown, getOwnedTowns, getCalendar, getUnlockedRecipes, getCombatStats, getMaterialRoom, random, int, id, log, result, returnToTown,
      isItemReserved: isCustomerItemReserved,
      makeItem: (s, townId, recipeId, quality) => { const t = getTown(s, townId); if (!t) return null; const item = itemFromRecipe(s, recipeId, quality); t.inventory.push(item); return item; },
      leaveTown: (s, a) => { if (!a.raidId && !a.invasionId && !a.missionId && a.resident && getTown(s, a.townId)) beginLeave(s, a, true); } });
    return incidentsApiCache;
  }
  function incidentHook(name, ...args) { const api = incidentsApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  // Multiplier from active incident effects (1 when none): craft, staff:<id>, furnace:<id>, sale, sale:<family>,
  // customers, price:<material>, buyStop (0 = buying stopped).
  function incidentFactor(s, key, townId) { return s && s.incidents ? (incidentHook('factor', s, key, townId) ?? 1) : 1; }
  function isIncidentHeld(s, itemId) { return !!(s && s.incidents && incidentHook('holds', s, itemId)); }
  function getIncidents(s) { return incidentHook('view', s) || []; }
  function chooseIncident(s, incidentId, index) { return incidentHook('choose', s, incidentId, index) || result(false, '돌발 사건을 준비 중이에요.'); }
  function deliverIncident(s, incidentId) { const r = incidentHook('deliver', s, incidentId) || result(false, '돌발 사건을 준비 중이에요.'); if (r.ok) operationsHook('reconcile', s); return r; }
  // [만들기] from a delivery incident: crafted in the incident's town, and handed in the moment it is finished.
  function craftForIncident(s, incidentId, recipeId) {
    const townId = incidentHook('makeTown', s, incidentId, recipeId);
    if (!townId) return result(false, '이 사건에 더 만들 장비가 없어요.');
    const r = craft(s, recipeId, townId);
    if (r.ok && r.item) r.item.incidentId = incidentId;
    return r;
  }
  function getIncidentMission(s, incidentId) { return incidentHook('missionInfo', s, incidentId); }
  function quoteIncidentMission(s, incidentId, heroIds) { return incidentHook('quoteMission', s, incidentId, heroIds) || 0; }
  function sendIncidentMission(s, incidentId, heroIds) { return incidentHook('sendMission', s, incidentId, heroIds) || result(false, '돌발 사건을 준비 중이에요.'); }
  function regatherIncidentMission(s, incidentId) { return incidentHook('regather', s, incidentId) || result(false, '돌발 사건을 준비 중이에요.'); }
  function dismissIncident(s, incidentId) { return incidentHook('dismiss', s, incidentId) || result(false, ''); }
  function spawnIncident(s, key) { return incidentHook('spawn', s, key); }
  function getActiveEffects(s) { return (s && s.incidents && incidentHook('effectsView', s)) || []; }
  function getIncidentCatalog() { const api = incidentsApi(); return api && api.catalog ? api.catalog.slice() : []; }
  function enableIncidents(s, on) { return !!incidentHook('enable', s, on); }
  // Game seconds per real second (1x = 2), set by the app every frame: incidents and boss crises count real seconds.
  let engineRealRate = 2;
  function setIncidentRealRate(rate) { if (Number.isFinite(rate) && rate > 0) engineRealRate = rate; const m = incidentsModule(); if (m && m.setRealRate) m.setRealRate(rate); }
  // 위기 순간 (2026-11-09): boss fights (raids.js) and incident dispatches (incidents.js).
  function chooseRaidCrisis(s, bossId, choice) { return raidHook('chooseCrisis', s, bossId, choice) || result(false, '지금은 지원할 수 없어요.'); }
  function getRaidCrisisCost(bossId) { const api = raidApi(); return api && api.crisisCost ? api.crisisCost(bossId) : 0; }
  function chooseMissionCrisis(s, incidentId, choice) { return incidentHook('chooseCrisis', s, incidentId, choice) || result(false, '지금은 지원할 수 없어요.'); }
  function enableCrises(s, on) { raidHook('setCrisis', s, on); incidentHook('setCrisis', s, on); return true; }
  // Craft requests come only from heroes holding a boss rare recipe (the game turns this on with incidents and quests).
  function setRareOrdersOnly(s, on) { if (on) s.rareOrdersOnly = true; else delete s.rareOrdersOnly; return true; }
  // Growth quests (dist/quests.js, 2026-11-09): 70 quests by town chapter; replaces the old hidden goal list.
  let questsModuleCache, questsApiCache;
  function questsModule() { if (root && root.ForgeQuests) return root.ForgeQuests; if (questsModuleCache !== undefined) return questsModuleCache; if (typeof require === 'function') { try { questsModuleCache = require('./quests.js'); } catch (_) { questsModuleCache = null; } } return questsModuleCache || null; }
  function questsApi() { if (questsApiCache) return questsApiCache; const module = questsModule(); if (!module || typeof module.create !== 'function') return null; questsApiCache = module.create({ DATA, getTown, getOwnedTowns, getCombatStats, getResearch, getMaterialRoom, log, result }); return questsApiCache; }
  function questHook(name, ...args) { const api = questsApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getQuestBook(s) { return questHook('view', s); }
  function claimQuest(s, n) { return questHook('claim', s, n) || result(false, '퀘스트를 준비 중이에요.'); }
  function enableQuests(s, on) { return !!questHook('enable', s, on); }
  function getQuestList() { const api = questsApi(); return api ? api.list : []; }
  // Forge research (dist/research.js): per-save gold sink, opens with the second branch.
  let researchModuleCache, researchApiCache;
  function researchModule() { if (root && root.ForgeResearch) return root.ForgeResearch; if (researchModuleCache !== undefined) return researchModuleCache; if (typeof require === 'function') { try { researchModuleCache = require('./research.js'); } catch (_) { researchModuleCache = null; } } return researchModuleCache || null; }
  function researchApi() { if (researchApiCache) return researchApiCache; const module = researchModule(); if (!module || typeof module.create !== 'function') return null; researchApiCache = module.create({ getOwnedTowns, log, result }); return researchApiCache; }
  function researchHook(name, ...args) { const api = researchApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function researchEffect(s, key) { return researchHook('effect', s, key) || 0; }
  function getResearch(s) { return researchHook('getResearch', s); }
  function buyResearch(s, id) { return researchHook('buy', s, id) || result(false, '연구소를 준비 중입니다.'); }
  function warehouseHook(name, ...args) { const api = warehouseApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getWarehouse(s, townId) { return warehouseHook('getWarehouse', s, townId); }
  function getMaterialCapacity(s) { return warehouseHook('getMaterialCapacity', s) ?? 100000000; }
  function getMaterialRoom(s, material) { return warehouseHook('getMaterialRoom', s, material) ?? Math.max(0, 100000000 - (s.materials[material] || 0)); }
  function getEquipmentCapacity(s, townId) { return warehouseHook('getEquipmentCapacity', s, townId) ?? 2000; }
  function getEquipmentUsage(s, townId) { return warehouseHook('getEquipmentUsage', s, townId) ?? 0; }
  function getWarehouseUpgradeCost(s, townId) { return warehouseHook('getWarehouseUpgradeCost', s, townId); }
  function upgradeWarehouse(s, townId) { return warehouseHook('upgradeWarehouse', s, townId) || result(false, '창고 증축을 준비 중입니다.'); }

  function operationsModule() {
    if (root && root.ForgeOperations) return root.ForgeOperations;
    if (operationsModuleCache !== undefined) return operationsModuleCache;
    if (typeof require === 'function') { try { operationsModuleCache = require('./operations.js'); } catch (_) { operationsModuleCache = null; } }
    return operationsModuleCache || null;
  }
  function operationsApi() {
    if (operationsApiCache) return operationsApiCache;
    const module = operationsModule(); if (!module || typeof module.create !== 'function') return null;
    operationsApiCache = module.create({ DATA, getTown, getOwnedTowns, getResidents, getTownLayout, getFacilityWorkSpot, getDisplayStockSpot, getFacilityBackSpot, getCombatStats, random, int, id, log, result,
      setDestination, moveActor, clearRoute, findPath, releaseWorker, craft, getDisplayedItems, listItem, buyRareOffer, canStaffWork,
      getMaterialCapacity, getMaterialRoom, getEquipmentCapacity, getEquipmentUsage, personalityEffect, isItemReserved: (s, itemId) => isCustomerItemReserved(s, itemId) || isIncidentHeld(s, itemId), incidentFactor: (s, key, townId) => incidentFactor(s, key, townId) });
    return operationsApiCache;
  }
  function operationsHook(name, ...args) { const api = operationsApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getOperations(s, townId) { return operationsHook('getOperations', s, townId); }
  function setMaterialPurchaseRule(s, material, rule, townId) { return operationsHook('setMaterialPurchaseRule', s, material, rule, townId) || result(false, '자동 매입 설정을 사용할 수 없습니다.'); }
  function setMaterialPurchaseRules(s, rules, townId) { return operationsHook('setMaterialPurchaseRules', s, rules, townId) || result(false, '자동 매입 설정을 사용할 수 없습니다.'); }
  function setAutoCraftRule(s, recipeId, rule, townId) { return operationsHook('setAutoCraftRule', s, recipeId, rule, townId) || result(false, '자동 제작 설정을 사용할 수 없습니다.'); }
  function removeAutoCraftRule(s, recipeId, townId) { return operationsHook('removeAutoCraftRule', s, recipeId, townId) || result(false, '자동 제작 설정을 사용할 수 없습니다.'); }
  function setAutoDisplay(s, rule, townId) { return operationsHook('setAutoDisplay', s, rule, townId) || result(false, '자동 진열 설정을 사용할 수 없습니다.'); }

  function customerModule() {
    if (root && root.ForgeCustomerService) return root.ForgeCustomerService;
    if (customerModuleCache !== undefined) return customerModuleCache;
    if (typeof require === 'function') { try { customerModuleCache = require('./customer-service.js'); } catch (_) { customerModuleCache = null; } }
    return customerModuleCache || null;
  }
  function customerApi() {
    if (customerApiCache) return customerApiCache;
    const module = customerModule(); if (!module || typeof module.create !== 'function') return null;
    customerApiCache = module.create({ DATA, getTown, getOwnedTowns, getTownLayout, getUnlockedRecipes, getRecipeLevel, getEquipmentCapacity, getEquipmentUsage,
      itemValue, needsItem, craft, id, log, result, getPurchasePrice, sellCustomerItem, onCustomerDone, getSalesWorker: salesWorker,
      setDestination, clearRoute, canStaffWork, getCombatStats });
    return customerApiCache;
  }
  function customerHook(name, ...args) { const api = customerApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function hasCustomerRequest(s, heroId) { return !!customerHook('hasRequest', s, heroId); }
  function isCustomerItemReserved(s, itemId) { return !!customerHook('isItemReserved', s, itemId); }
  function getCustomerService(s, townId) { return customerHook('getCustomerService', s, townId); }
  function setCustomerService(s, settings, townId) { return customerHook('setCustomerService', s, settings, townId) || result(false, '손님 주문 제작을 준비 중입니다.'); }
  function requestCustomerService(s, heroId) { const hero = s.adventurers.find(a => a.id === heroId); return customerHook('request', s, hero) || result(false, '주문 제작할 손님이 없습니다.'); }
  function cancelCustomerRequest(s, heroId, reason) {
    const hero = s.adventurers.find(a => a.id === heroId), active = hasCustomerRequest(s, heroId);
    if (!active) return result(false, '취소할 손님 주문이 없습니다.');
    customerHook('cancel', s, heroId, reason || '주문 취소');
    if (hero && ['visiting', 'returning'].includes(hero.status)) onCustomerDone(s, hero, reason || '주문 취소');
    return result(true, '손님 주문을 취소했습니다. 이미 사용한 재료의 제작은 계속됩니다.');
  }

  function raidModule() {
    if (root && root.ForgeRaids) return root.ForgeRaids;
    if (raidModuleCache !== undefined) return raidModuleCache;
    if (typeof require === 'function') { try { raidModuleCache = require('./raids.js'); } catch (_) { raidModuleCache = null; } }
    return raidModuleCache || null;
  }
  function raidApi() {
    if (raidsApiCache) return raidsApiCache;
    const module = raidModule();
    if (!module || typeof module.create !== 'function') return null;
    raidsApiCache = module.create({ DATA, getCombatStats, getTown, getOwnedTowns, getResidents, random, int, id, log, result, returnToTown, beginRest, beginHunt, xpNeeded, getTownLayout, personalityEffect, realRate: () => engineRealRate, isHeroReserved: (s, heroId) => !!(s.incidents && incidentHook('reserved', s, heroId)), onBossVictory: (s, party, boss, delta) => campaignHook('onBossVictory', s, party, boss, delta) });
    return raidsApiCache;
  }
  function raidHook(name, ...args) { const api = raidApi(); return api && typeof api[name] === 'function' ? api[name](...args) : null; }
  function getBosses(s) { return raidHook('getBosses', s) || []; }
  function getRaidParties(s) { return raidHook('getRaidParties', s) || []; }
  // Boss dispatch (2026-11): the player picks the party; adventurers never go to a boss on their own.
  function getDispatchInfo(s, bossId) { return raidHook('getDispatchInfo', s, bossId); }
  function quoteParty(s, bossId, heroIds) { return raidHook('quoteParty', s, bossId, heroIds) || 0; }
  function dispatchParty(s, bossId, heroIds) { return raidHook('dispatchParty', s, bossId, heroIds) || result(false, '토벌 준비 중이에요.'); }
  function listRareOffers(s) { return raidHook('listRareOffers', s) || []; }
  function buyRareOffer(s, offerId, amount, townId) {
    const offer = (s.rareOffers || []).find(offer => offer.id === offerId && offer.status === 'open');
    if (offer) {
      const room = getMaterialRoom(s, offer.material);
      if (room <= 0) return result(false, '창고의 재료별 보관 한도에 도달했습니다. 창고를 증축해주세요.');
      if (amount == null) amount = Math.min(offer.amount, room);
      else if (!integer(amount, 1, offer.amount) || amount > room) return result(false, '창고의 남은 재료 보관 공간을 확인해주세요.');
    }
    const purchased = raidHook('buyRareOffer', s, offerId, amount, townId) || result(false, '희귀 재료 거래를 준비 중입니다.');
    if (purchased.ok) operationsHook('reconcile', s);
    return purchased;
  }
  function getRecipeLevel(r) { return progressionHook('getRecipeLevel', r) || r.requiredLevel || (r.tier === 3 ? 20 : r.tier === 2 ? 10 : 1); }
  function canStaffWork(w) { const p = progression(); return p && p.canWork ? p.canWork(w) : w.stamina >= w.maxStamina * .2 && !(w.salaryDebt > 0); }
  function getCalendar(s) { return progressionHook('getCalendar', s) || { year: Math.floor((s.day - 1) / 120) + 1, month: Math.floor((s.day - 1) % 120 / 30) + 1, day: (s.day - 1) % 30 + 1 }; }
  function getStaffRank(w) { return progressionHook('getStaffRank', w) || (w.craftLevel >= 20 ? '고급' : w.craftLevel >= 10 ? '중급' : '초급'); }
  function getCraftXpNeeded(level) { return progressionHook('getCraftXpNeeded', level) ?? 40 + level * 20; }
  function getFestival(s) { return progressionHook('getFestival', s); }
  function getFestivalCandidates(s) { return (progressionHook('getFestivalCandidates', s) || []).filter(item => !isCustomerItemReserved(s, item.id)); }
  function getFestivalScore(item) { return progressionHook('getFestivalScore', item) || 0; }
  function submitFestival(s, itemId) {
    if (isCustomerItemReserved(s, itemId)) return result(false, '카운터 손님에게 전달할 장비입니다. 손님 주문을 마친 뒤 출품해주세요.');
    const submitted = progressionHook('submitFestival', s, itemId) || result(false, '제작 축제를 준비 중입니다.');
    if (submitted.ok) { operationsHook('reconcile', s); s.stats.festivalEntries = (s.stats.festivalEntries || 0) + 1; }
    return submitted;
  }
  function withdrawFestival(s, entryId) { return progressionHook('withdrawFestival', s, entryId) || result(false, '출품 기록을 찾을 수 없습니다.'); }
  function getPayroll(s) { return progressionHook('getPayroll', s); }
  function payWages(s, staffId) { return progressionHook('payWages', s, staffId) || result(false, '미지급 급여가 없습니다.'); }

  function roster() {
    if (root && root.ForgeRoster) return root.ForgeRoster.characters;
    if (typeof require === 'function') { try { return require('./npc-roster.js').characters; } catch (_) {} }
    return originalIds.map((key, i) => ({ id: key, name: ({ tobi: '토비', bram: '브람' })[key] || DATA.characterProfiles[key].name, job: ({ tobi: '모험가', bram: '기사' })[key] || DATA.characterProfiles[key].job, color: ({ tobi: '#c69a5d', bram: '#8299b0' })[key] || DATA.characterProfiles[key].color, preferredType: ['sword', 'bow', 'shield', 'staff', 'armor', 'sword'][i], sprite: [10, 12, 8, 11, 9, 13][i] }));
  }
  function getTown(s, townId) { const key = townId || s.activeTownId; return s.towns && known(s.towns, key) ? s.towns[key] : null; }
  function getOwnedTowns(s) { return Object.values(s.towns); }
  function getResidents(s, townId) { const t = getTown(s, townId); return t ? s.adventurers.filter(a => a.townId === t.id && a.resident) : []; }
  function getInnCapacity(s, townId) { const t = getTown(s, townId); return t ? (t.innVersion === 2 ? t.innLevel * 8 : Math.min(100, 4 + t.innLevel * 2)) : 0; }
  function getStockCapacity(s, townId) { const t = getTown(s, townId); return t ? t.facilities.filter(f => f.type === 'display').length * 6 : 0; }
  function getQueueCapacity(s, townId) { const t = getTown(s, townId); return t ? t.facilities.filter(f => f.type === 'furnace').length * 3 : 0; }
  function grantRecipeDrop(s,id,probability,townId) {
    if(!recipeMap[id]?.unlockDrop || (s.unlockedDrops||[]).includes(id) || random(s)>=probability)return false;
    if(!s.unlockedDrops)s.unlockedDrops=[];s.unlockedDrops.push(id);
    log(s,'recipe-unlock',recipeMap[id].name+' 설계도를 획득했습니다!',{townId,recipeId:id});return true;
  }
  function getUnlockedRecipes(s, townId) { const t = getTown(s, townId); const level = t ? Math.max(0, ...t.staff.filter(w => w.role === 'smith').map(w => w.craftLevel)) : 0; return DATA.recipes.filter(r => !r.bossRecipe && getRecipeLevel(r) <= level && (!r.unlockDrop || (s.unlockedDrops||[]).includes(r.id))); }
  function getTownLayout(s, townId) {
    const t = getTown(s, townId); if (!t) return null;
    return shopLayout().get(t);
  }
  function getFacilityWorkSpot(f) { return { x: f.type === 'furnace' ? f.x + f.w - .15 : f.x + f.w / 2, y: f.y + f.h + .5 }; }
  // Where display staff set goods down: the table's upper (back) side, which faces the staff door they come from;
  // the front spot is the fallback when the floor above the table is blocked.
  function getDisplayStockSpot(t, f) { return getFacilityBackSpot(t, f); }
  // Staff side of a facility (display stocking, anvil helper): above it when that floor is open, otherwise beside its
  // upper half (e.g. an anvil against the back wall); never the front spot where adventurers stand.
  function getFacilityBackSpot(t, f) {
    const spots = [{ x: f.x + f.w / 2, y: f.y - .5 }, { x: f.x + f.w + .5, y: f.y + .5 }, { x: f.x - .5, y: f.y + .5 }];
    return spots.find(p => walkable(t, Math.floor(p.x), Math.floor(p.y), null, true)) || getFacilityWorkSpot(f);
  }
  function getCounterWorkSpot(t, worker) {
    const points = shopLayout().get(t).counter.staffSpots;
    return worker && integer(worker.counterSlot, 0, points.length - 1) ? points[worker.counterSlot] : null;
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function inside(x, y, f) { return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h; }
  function walkable(t, x, y, facilities, staffAccess) {
    // The previous schema must be checked against its own walls before the
    // one-time floorplan migration can safely preserve an active invasion.
    if (t.layoutVersion === undefined) {
      if (x < -10 || x > t.width + 1 || y < -1 || y > Math.max(t.height + 4, 4 + Math.ceil(Math.min(100, 4 + t.innLevel * 2) / 3) * 2)) return false;
      if (x >= 0 && x < t.width && y >= 0 && y < t.height) {
        const door = y === t.height - 1 && (x === Math.floor(t.width / 2) || x === Math.floor(t.width / 2) - 1);
        if ((x === 0 || x === t.width - 1 || y === 0 || y === t.height - 1) && !door) return false;
        if ((facilities || t.facilities).some(f => inside(x, y, f))) return false;
      }
      return true;
    }
    return shopLayout().structuralWalkable(t, x, y, staffAccess) && !(facilities || t.facilities).some(f => inside(x, y, f));
  }
  function findPath(t, from, to, facilities, staffAccess) {
    if (staffAccess === undefined) staffAccess = !from.equipment;
    const sx = Math.floor(from.x), sy = Math.floor(from.y), tx = Math.floor(to.x), ty = Math.floor(to.y);
    if (!walkable(t, tx, ty, facilities, staffAccess)) return null;
    const start = sx + ',' + sy, target = tx + ',' + ty;
    if (start === target) return dist(from, to) > .02 ? [{ x: to.x, y: to.y }] : [];
    const queue = [[sx, sy]], previous = new Map([[start, null]]); let head = 0;
    while (head < queue.length && queue.length < 10000) {
      const [x, y] = queue[head++];
      for (const [nx, ny] of [[x, y + 1], [x + 1, y], [x - 1, y], [x, y - 1]]) {
        const key = nx + ',' + ny;
        if (previous.has(key) || !walkable(t, nx, ny, facilities, staffAccess)) continue;
        previous.set(key, x + ',' + y);
        if (key === target) {
          const path = []; let cursor = key;
          while (cursor !== start) { const p = cursor.split(',').map(Number); path.push({ x: p[0] + .5, y: p[1] + .5 }); cursor = previous.get(cursor); }
          path.reverse();
          if (!path.length || dist(path[path.length - 1], to) > .01) path.push({ x: to.x, y: to.y });
          return path;
        }
        queue.push([nx, ny]);
      }
    }
    return null;
  }
  function setDestination(t, actor, target) {
    if (actor.destination && dist(actor.destination, target) < .01 && (actor.path.length || dist(actor, target) < .05)) return true;
    const path = findPath(t, actor, target);
    actor.destination = { x: target.x, y: target.y };
    actor.path = path || []; actor.moving = !!actor.path.length;
    return path !== null;
  }
  // Walking speeds (2026-11), tuned so every walker in the village picture moves at the same on-screen pace
  // (~110 px/s on the 1280-wide picture):
  // - indoors: the caller's pace (2.8 tiles/s);
  // - the road from the forge door to the town exit (entrance.y+1 .. exit.y, 2.5 tiles): ROAD_WALK_SPEED. The village
  //   picture and the world map both show this stretch as the whole trip to / from the hunting grounds (~5.6 s);
  // - the rest of the outdoors (forge ↔ inn): OUTDOOR_WALK_SPEED, because that walk is long in tiles but short on screen.
  const ROAD_WALK_SPEED = .44, OUTDOOR_WALK_SPEED = 2.55;
  function onVillageGround(t, actor) {
    if (t.layoutVersion === undefined) return false;
    const L = shopLayout().get(t), c = shopLayout().contains, x = actor.x, y = actor.y;
    if (c(L.shop, x, y) || (L.inn && c(L.inn, x, y)) || y < L.shop.y) return false;
    return !(Math.abs(x - L.entrance.x) < 1.5 && y < L.exit.y + .01 && y >= L.shop.y + L.shop.h - .01);
  }
  function moveActor(t, actor, dt, speed) {
    if (actor.equipment && speed > OUTDOOR_WALK_SPEED * .5 && onVillageGround(t, actor)) speed = OUTDOOR_WALK_SPEED;
    let remaining = dt * speed; actor.moving = false;
    while (remaining > 1e-8 && actor.path && actor.path.length) {
      const next = actor.path[0];
      if (!walkable(t, Math.floor(next.x), Math.floor(next.y), undefined, !actor.equipment)) { actor.path = findPath(t, actor, actor.destination) || []; break; }
      const d = dist(actor, next);
      if (d <= remaining + 1e-8) { actor.x = next.x; actor.y = next.y; remaining -= d; actor.path.shift(); actor.moving = actor.moving || d > 1e-7; }
      else { actor.x += (next.x - actor.x) / d * remaining; actor.y += (next.y - actor.y) / d * remaining; actor.moving = true; remaining = 0; }
    }
    return !actor.path.length && (!actor.destination || dist(actor, actor.destination) < .06);
  }
  function clearRoute(actor) { actor.path = []; actor.destination = null; actor.moving = false; }
  function layoutFacilityFits(t, f, facilities) {
    if (!shopLayout().facilityRegion(t, f) || facilities.some(other => other !== f && shopLayout().overlaps(other, f))) return false;
    const all = facilities.includes(f) ? facilities : facilities.concat(f), layout = shopLayout().get(t);
    if (all.some(other => !findPath(t, layout.entrance, getFacilityWorkSpot(other), all, other.type === 'furnace'))) return false;
    const staffPoints = [layout.restPoint, layout.warehouse.pickupPoint, ...layout.counter.staffSpots, ...layout.counter.buyingSpots];
    return staffPoints.every(point => findPath(t, layout.entrance, point, all, true)) && !!findPath(t, layout.entrance, layout.counter.customerSpot, all, false);
  }
  function relocateFacilities(t, allowLegacySpace) {
    const original = t.facilities.slice(), fixed = [], pending = [];
    // Preserve compatible player placements before finding room for moved ones.
    for (const f of original) {
      if (shopLayout().facilityRegion(t, f) && !fixed.some(other => shopLayout().overlaps(other, f)) && walkable(t, Math.floor(getFacilityWorkSpot(f).x), Math.floor(getFacilityWorkSpot(f).y), fixed, f.type === 'furnace')) fixed.push(f);
      else pending.push(f);
    }
    for (let i = fixed.length - 1; i >= 0; i--) if (!layoutFacilityFits(t, fixed[i], fixed)) pending.unshift(...fixed.splice(i, 1));
    function place(f) {
      const room = f.type === 'furnace' ? shopLayout().get(t).workshop : shopLayout().get(t).shop;
      for (let y = room.y + 1; y < (f.type === 'furnace' ? room.y + room.h - 2 : t.height - 2); y++) for (let x = 1; x < t.width - 1; x++) {
        const candidate = { ...f, x, y };
        if (layoutFacilityFits(t, candidate, fixed)) { f.x = x; f.y = y; fixed.push(f); return true; }
      }
      return false;
    }
    // Bigger footprints first leave fewer stranded pockets in legacy layouts.
    pending.sort((a, b) => Number(b.type === 'furnace') - Number(a.type === 'furnace') || b.w * b.h - a.w * a.h || original.indexOf(a) - original.indexOf(b));
    for (const f of pending) {
      let placed = place(f);
      while (!placed && allowLegacySpace && f.type === 'furnace' && t.workshopExtraDepth < 30) { t.workshopExtraDepth += 3; placed = place(f); }
      while (!placed && allowLegacySpace && f.type !== 'furnace' && t.retailExtraDepth < 12) { t.retailExtraDepth += 2; t.height += 2; placed = place(f); }
      if (!placed) throw new Error('기존 시설을 안전하게 배치할 공간이 없습니다.');
    }
    // The existing array/order and IDs remain stable for jobs and saved references.
    t.facilities = original;
  }
  function repositionIfBlocked(t, actor, preferred) {
    const staffAccess = !actor.equipment;
    if (walkable(t, Math.floor(actor.x), Math.floor(actor.y), undefined, staffAccess)) return;
    const layout = shopLayout().get(t), anchor = preferred || (staffAccess ? layout.restPoint : layout.entrance);
    if (walkable(t, Math.floor(anchor.x), Math.floor(anchor.y), undefined, staffAccess)) { actor.x = anchor.x; actor.y = anchor.y; return; }
    for (let radius = 1; radius < 80; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const x = Math.floor(anchor.x) + dx, y = Math.floor(anchor.y) + dy;
      if (walkable(t, x, y, undefined, staffAccess)) { actor.x = x + .5; actor.y = y + .5; return; }
    }
  }
  // Each resting worker gets its own spot around the rest point (layout.restSpots) so they do not stand on one tile.
  function restSpotFor(t, worker) {
    const layout = shopLayout().get(t), spots = layout.restSpots || [layout.restPoint], i = Math.max(0, t.staff.indexOf(worker));
    for (let k = 0; k < spots.length; k++) { const p = spots[(i + k) % spots.length]; if (walkable(t, Math.floor(p.x), Math.floor(p.y), undefined, true)) return p; }
    return layout.restPoint;
  }
  function onLayoutChange(s, t, options) {
    relocateFacilities(t, !!(options && options.legacy));
    const layout = getTownLayout(s, t.id);
    for (const invasion of s.campaign && s.campaign.invasions || []) {
      if (invasion.townId !== t.id || !['recalling', 'battle'].includes(invasion.status)) continue;
      if (invasion.rallyPoints.some(point => !findPath(t, layout.entrance, point, undefined, false))) {
        const points = getRallyPoints(s, t, invasion.memberIds.length);
        if (points.length < invasion.memberIds.length) throw new Error('방어 인원이 모일 수 있는 공간이 부족합니다.');
        invasion.rallyPoints = invasion.memberIds.map((heroId, i) => ({ heroId, x: points[i].x, y: points[i].y }));
        invasion.rallyPoint = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
        invasion.arrivedIds = invasion.status === 'battle' ? invasion.memberIds.slice() : invasion.rallyPoints.filter(point => {
          const hero = s.adventurers.find(hero => hero.id === point.heroId); return hero && dist(hero, point) < .08;
        }).map(point => point.heroId);
      }
    }
    for (const f of t.facilities) { f.active = false; f.staffId = null; if (f.type === 'furnace') f.taskId = null; }
    for (const q of t.queue) { q.staffId = null; q.status = 'paused'; }
    for (const worker of t.staff) {
      delete worker.assistSlot; worker.facilityId = null; worker.counterSlot = null; clearRoute(worker);
      if (!['resting', 'training'].includes(worker.status)) worker.status = 'idle';
      repositionIfBlocked(t, worker, layout.restPoint);
      if (worker.status === 'resting') setDestination(t, worker, restSpotFor(t, worker));
    }
    for (const hero of s.adventurers.filter(a => a.townId === t.id)) {
      clearRoute(hero); hero.browseSpot = null;
      repositionIfBlocked(t, hero, layout.entrance);
      if (hero.status === 'hunting') { hero.x = layout.exit.x; hero.y = layout.exit.y; continue; }
      if (['traveling', 'leaving', 'departing'].includes(hero.status)) setDestination(t, hero, layout[hero.status === 'traveling' ? 'entrance' : 'exit']);
      else if (hero.status === 'resting') {
        const bed = layout.inn.beds.find(bed => bed.id === hero.bedId); if (bed) setDestination(t, hero, bed);
      } else if (hero.status === 'enhancing') {
        const f = hero.enhancement && t.facilities.find(f => f.id === hero.enhancement.facilityId); if (f) setDestination(t, hero, getFacilityWorkSpot(f));
      } else if (hero.invasionId) {
        const invasion = s.campaign && s.campaign.invasions.find(event => event.id === hero.invasionId);
        const index = invasion && invasion.memberIds.indexOf(hero.id), target = invasion && invasion.rallyPoints[index];
        if (target && invasion.status === 'battle') { hero.x = target.x; hero.y = target.y; }
        else if (target) setDestination(t, hero, target);
      } else if (hero.checkoutPending || hasCustomerRequest(s, hero.id)) setDestination(t, hero, layout.counter.customerSpot);
      else setDestination(t, hero, browsingPoint(s, t, hero));
    }
  }
  // 2026-11 layout v6: the warehouse room is gone (its shelves stand in the workshop's storage corner) and the shop and
  // workshop are 4 tiles wider. Staff saved inside the old warehouse room are moved to the new pickup spot.
  function widenAndCloseWarehouse(s, t) {
    t.width += 4;
    const pickup = shopLayout().get(t).warehouse.pickupPoint;
    for (const w of t.staff) if (Number.isFinite(w.x) && w.x < 0 && w.y < 0) { w.x = pickup.x; w.y = pickup.y; w.path = []; w.destination = null; }
  }  // Developer tool (admin panel): arrange the current town like the 2026-11 layout preview — 3 furnaces along the
  // workshop back wall from the right, 4 display tables across the lower shop, 2 anvils at the top right (2026-11 sketch). Existing
  // facilities are reused (same IDs, queued jobs keep their furnace); missing ones are added free of charge.
  // The normal layout repair then moves anything that does not fit and restarts staff and routes.
  // 2026-11: facilities have fixed places. Each type fills its slots in order; a purchase takes the next free slot.
  function getFacilitySlots(t) {
    // The furnace row is anchored to the workshop's front (bottom) edge, so a deeper workshop keeps it in place.
    const layout = shopLayout().get(t), W = t.width, rearY = layout.workshop.y + layout.workshop.h - 7;
    // Furnaces 4 tiles apart from the left wall (x 1/5/9). Displays fill inner-left, inner-right, outer-left, outer-right
    // so the shop stays balanced at every level; one anvil at the top-left.
    return { furnace: [[1, rearY], [5, rearY], [9, rearY]], display: [[6, 7], [W - 8, 7], [2, 7], [W - 4, 7]], enhance: [[1, 1]] };
  }
  // 2026-11 design: what each forge level allows (the map itself never grows).
  const FORGE_LEVEL_CAPS = Object.freeze({ furnace: [1, 2, 3, 3, 3], display: [1, 2, 3, 3, 4], enhance: [1, 1, 1, 1, 1] });
  const FURNACE_GRADE_LEVEL = Object.freeze({ 2: 4, 3: 5 }); // 고급 화덕 from Lv.4, 최고급 from Lv.5
  function facilityCap(t, type) { const caps = FORGE_LEVEL_CAPS[type]; return caps ? caps[clamp(t.level || 1, 1, 5) - 1] : 0; }
  function getForgeLevelInfo(level) {
    const i = clamp(level || 1, 1, 5) - 1;
    return { level: i + 1, furnace: FORGE_LEVEL_CAPS.furnace[i], display: FORGE_LEVEL_CAPS.display[i], enhance: FORGE_LEVEL_CAPS.enhance[i], furnaceGrade: i + 1 >= 5 ? 3 : i + 1 >= 4 ? 2 : 1 };
  }
  function getFreeFacilitySlot(s, type) {
    const t = getTown(s), slots = t && getFacilitySlots(t)[type]; if (!slots) return null;
    for (const [x, y] of slots) {
      if (t.facilities.some(f => f.type === type && f.x === x && f.y === y)) continue;
      if (canPlaceFacility(s, type, x, y).ok) return { x, y };
    }
    return null;
  }
  function buyFacility(s, type) {
    const slot = getFreeFacilitySlot(s, type);
    if (!slot) return result(false, '이 시설을 더 놓을 자리가 없어요.');
    return placeFacility(s, type, slot.x, slot.y);
  }
  function arrangePreviewLayout(s) {
    const t = getTown(s), layout = getTownLayout(s, t.id), W = t.width, rearY = layout.workshop.y + 1;
    if (t.facilities.some(f => f.heroId)) return result(false, '모험가가 강화 작업대를 쓰고 있어요. 끝난 뒤 다시 눌러주세요.');
    const slots = getFacilitySlots(t);
    const original = t.facilities.slice(), placed = [];
    for (const [type, all] of Object.entries(slots)) {
      const own = original.filter(f => f.type === type), spots = all.slice(0, facilityCap(t, type));
      spots.forEach(([x, y], i) => { const f = own[i] || createFacility(s, type, x, y); f.x = x; f.y = y; placed.push(f); });
    }
    // Facilities beyond the preview counts are removed (their build cost is refunded). A surplus furnace hands its
    // queued jobs to the kept furnaces when they have room; otherwise it stays.
    const kept = placed.slice();
    let refund = 0, removed = 0;
    for (const f of original.filter(f => !placed.includes(f))) {
      if (f.type === 'furnace') {
        const jobs = t.queue.filter(q => q.facilityId === f.id), targets = kept.filter(k => k.type === 'furnace');
        const room = targets.map(k => DATA.facilityTypes.furnace.queueSlots - t.queue.filter(q => q.facilityId === k.id).length);
        if (jobs.length > room.reduce((a, b) => a + b, 0)) { kept.push(f); continue; }
        for (const q of jobs) { const i = room.findIndex(n => n > 0); room[i]--; q.facilityId = targets[i].id; q.staffId = null; q.status = 'paused'; }
      }
      refund += DATA.facilityTypes[f.type].cost; removed++;
      for (const w of t.staff) if (w.facilityId === f.id) w.facilityId = null;
    }
    t.facilities = kept;
    // Fewer displays may hold fewer items: the overflow goes back to the warehouse (unlisted, not lost).
    const listed = t.inventory.filter(i => i.listed), capacity = getStockCapacity(s);
    for (const item of listed.slice(capacity)) item.listed = false;
    try { onLayoutChange(s, t); } catch (error) { t.facilities = original; return result(false, '배치할 공간이 부족해요.'); }
    s.gold += refund;
    return result(true, '배치 예시를 적용했어요(Lv.' + t.level + ' 기준 화덕 ' + facilityCap(t, 'furnace') + ' · 진열대 ' + facilityCap(t, 'display') + ' · 모루 ' + facilityCap(t, 'enhance') + ')' + (removed ? ' · 남는 시설 ' + removed + '개 정리, ' + refund + ' G 환불' : '') + '.');
  }
  // 2026-11 layout v2/v3: the rear rooms moved back behind a wall band (v2: 3 tiles, v3: 4 tiles with an empty gap).
  // Older layout saves shift every rear-room position (furnaces, staff and their targets behind the shop) by the
  // difference, then re-run the normal layout repair so jobs and routes restart from valid spots.
  function migrateRearRooms(s) {
    const L = shopLayout();
    for (const t of getOwnedTowns(s)) {
      if (t.layoutVersion === undefined || t.layoutVersion === L.VERSION || !(t.layoutVersion in L.GAP_BY_VERSION)) continue;
      const oldGap = L.GAP_BY_VERSION[t.layoutVersion], gap = L.WALL_GAP - oldGap;
      for (const f of t.facilities) if (f.type === 'furnace') f.y -= gap;
      for (const w of t.staff) {
        if (Number.isFinite(w.y) && w.y < -oldGap) w.y -= gap;
        else if (Number.isFinite(w.y) && w.y < 0) w.y = -L.WALL_GAP - .5;
        if (w.destination && w.destination.y < -oldGap) w.destination = { ...w.destination, y: w.destination.y - gap };
        w.path = [];
      }
      if (t.layoutVersion < 6) widenAndCloseWarehouse(s, t);
      t.layoutVersion = L.VERSION;
      onLayoutChange(s, t);
    }
  }
  // 2026-11: the equipment display became a 2x3 table (long side going away). Saves made with the old 3x1 display
  // keep their display where it still fits, otherwise move it to the nearest free spot; if none exists, refund it.
  function normalizeDisplayFootprints(s) {
    const d = DATA.facilityTypes.display, previous = s.activeTownId;
    for (const t of getOwnedTowns(s)) {
      // Pre-floorplan saves are resized just before their one-time reflow (normalizeFloorplans), which makes room for them.
      if (t.layoutVersion === undefined) continue;
      const old = t.facilities.filter(f => f.type === 'display' && (f.w !== d.w || f.h !== d.h));
      if (!old.length) continue;
      s.activeTownId = t.id;
      for (const f of old) {
        const ox = f.x, oy = f.y; f.w = d.w; f.h = d.h;
        if (canPlaceFacility(s, 'display', f.x, f.y, f.id).ok) continue;
        let best = null;
        for (let y = -2; y < t.height; y++) for (let x = 1; x < t.width - 1; x++) {
          const score = Math.abs(x - ox) + Math.abs(y - oy);
          if ((!best || score < best.score) && canPlaceFacility(s, 'display', x, y, f.id).ok) best = { x, y, score };
        }
        if (best) { f.x = best.x; f.y = best.y; continue; }
        t.facilities = t.facilities.filter(v => v !== f); s.gold += d.cost;
        for (const w of t.staff) if (w.facilityId === f.id) w.facilityId = null;
      }
    }
    s.activeTownId = previous;
  }
  // 2026-11 (design change): the forge no longer grows. Every town has the base map (22 x 12 shop, 8-deep workshop)
  // and the forge level only decides how many facilities fit (see FORGE_LEVEL_CAPS). On load each town is settled:
  // the map goes back to the base size, facilities move onto their fixed slots in order, and facilities beyond the
  // level's allowance are removed with their base build cost refunded (their jobs move to a kept furnace, a hero
  // using a removed anvil keeps a paid enhancement for later). Staff left inside a facility or the counter step out.
  function settleTownToLevel(s, t) {
    const L = shopLayout(); let changed = false, refund = 0;
    if (t.width !== L.BASE_WIDTH || t.height !== 12 || t.workshopExtraDepth || t.retailExtraDepth) {
      t.width = L.BASE_WIDTH; t.height = 12; t.workshopExtraDepth = 0; t.retailExtraDepth = 0; changed = true;
    }
    const slots = getFacilitySlots(t);
    for (const type of Object.keys(slots)) {
      const cap = Math.min(facilityCap(t, type), slots[type].length), spots = slots[type].slice(0, cap);
      const own = t.facilities.filter(f => f.type === type);
      const busy = f => !!(f.heroId || f.taskId || f.staffId || t.queue.some(q => q.facilityId === f.id));
      const onSpot = f => spots.findIndex(([x, y]) => f.x === x && f.y === y);
      // Keep facilities already on a slot first, then busy ones, then the rest in their current order.
      const ranked = own.slice().sort((a, b) => (onSpot(b) >= 0) - (onSpot(a) >= 0) || busy(b) - busy(a));
      const kept = ranked.slice(0, cap), extra = ranked.slice(cap), taken = new Set(kept.map(onSpot).filter(i => i >= 0));
      for (const f of kept) {
        if (onSpot(f) >= 0) continue;
        const i = spots.findIndex((_, j) => !taken.has(j)); taken.add(i);
        f.x = spots[i][0]; f.y = spots[i][1]; changed = true;
      }
      for (const f of extra) {
        if (type === 'furnace') for (const q of t.queue) if (q.facilityId === f.id) { q.facilityId = kept[0].id; q.staffId = null; q.status = 'paused'; }
        if (f.heroId) for (const a of s.adventurers) if (a.enhancement && a.enhancement.facilityId === f.id) {
          if (a.enhancement.paid) a.pendingEnhancement = { ...a.enhancement, facilityId: null };
          a.enhancement = null; a.status = 'visiting'; a.timer = 1; clearRoute(a);
        }
        for (const w of t.staff) if (w.facilityId === f.id || w.assignedFacilityId === f.id) { releaseWorker(t, w); w.assignedFacilityId = null; w.status = 'idle'; }
        refund += DATA.facilityTypes[type].cost; changed = true;
      }
      t.facilities = t.facilities.filter(f => !extra.includes(f));
    }
    for (const f of t.facilities) for (const w of t.staff) if (Number.isFinite(w.x) && L.contains(f, Math.floor(w.x), Math.floor(w.y))) { w.y = f.y + f.h + .5; w.path = []; changed = true; }
    const counter = L.get(t).counter;
    for (const w of t.staff) if (Number.isFinite(w.y) && L.contains(counter, Math.floor(w.x), Math.floor(w.y))) { w.y = counter.y - .6; w.path = []; changed = true; }
    s.gold += refund;
    // Fewer displays hold fewer items: the overflow goes back to the warehouse (unlisted, not lost).
    const capacity = t.facilities.filter(f => f.type === 'display').length * 6, listed = t.inventory.filter(i => i.listed);
    for (const item of listed.slice(capacity)) { item.listed = false; changed = true; }
    if (changed) onLayoutChange(s, t);
    return { changed, refund };
  }
  function respaceFixedSlots(s) {
    const previous = s.activeTownId;
    for (const t of getOwnedTowns(s)) { if (t.layoutVersion === undefined) continue; s.activeTownId = t.id; settleTownToLevel(s, t); }
    s.activeTownId = previous;
  }
  function normalizeFloorplans(s) {
    for (const t of getOwnedTowns(s)) {
      for (const worker of t.staff) if (worker.counterSlot === undefined) worker.counterSlot = null;
      if (t.layoutVersion === undefined) {
        for (const f of t.facilities) if (f.type === 'display') { f.w = DATA.facilityTypes.display.w; f.h = DATA.facilityTypes.display.h; }
        widenAndCloseWarehouse(s, t);
        t.layoutVersion = shopLayout().VERSION; t.workshopExtraDepth = 0; t.retailExtraDepth = 0;
        onLayoutChange(s, t, { legacy: true });
      }
    }
    for (const hero of s.adventurers) if (hero.checkoutPending === undefined) hero.checkoutPending = false;
    return s;
  }
  function itemFromRecipe(s, recipeId, quality) {
    const r = recipeMap[recipeId], q = DATA.qualities[quality || 'normal'];
    return { id: id(s, 'item'), recipeId, name: r.name, slot: r.slot, quality: quality || 'normal', power: Math.round(r.power * q.multiplier), price: Math.round(r.price * q.multiplier), enhance: 0, durability: 100, listed: false, locked: false };
  }
  function getItemEnhancementMultiplier(level) {
    const rules = DATA.enhancement, value = clamp(level || 0, 0, rules.maxLevel);
    return 1 + Math.min(value, rules.statSoftCap) * rules.statBonusPerLevel + Math.max(0, value - rules.statSoftCap) * rules.advancedStatBonusPerLevel;
  }
  const STARTER_ATTACK = 6;
  function getItemStats(item) {
    if (!item) return { attack: 0, defense: 0, hp: 0 };
    if (item.recipeId === 'starter') return { attack: Math.max(0, item.power || 0), defense: 0, hp: 0 };
    const r = recipeMap[item.recipeId]; if (!r) return { attack: 0, defense: 0, hp: 0 };
    const factor = (item.power / r.power) * getItemEnhancementMultiplier(item.enhance) * (.82 + clamp(item.durability == null ? 100 : item.durability, 0, 100) * .0018);
    const bonus = progressionHook('getItemBonus', item) || {};
    return { attack: Math.max(0, Math.round(r.attack * factor) + (bonus.attack || 0)), defense: Math.max(0, Math.round(r.defense * factor) + (bonus.defense || 0)), hp: Math.max(0, Math.round(r.hp * factor) + (bonus.hp || 0)) };
  }
  function getEquipmentSlots(a) { return DATA.slots.map(slot => ({ ...slot, item: a.equipment ? a.equipment[slot.id] || null : null })); }
  function getCombatStats(a) {
    const b = a.baseStats || { attack: 7, defense: 3, maxHp: 58 };
    let attack = b.attack + Math.max(0, a.level - 1) * 2, defense = b.defense + Math.max(0, a.level - 1), maxHp = b.maxHp + Math.max(0, a.level - 1) * 8;
    for (const slot of slotIds) { const stats = getItemStats(a.equipment && a.equipment[slot]); attack += stats.attack; defense += stats.defense; maxHp += stats.hp; }
    attack = Math.round(attack * personalityEffect(a, 'attack'));
    maxHp = Math.round(maxHp * personalityEffect(a, 'maxHp'));
    const power = Math.max(1, Math.floor(attack * .75 + defense * .65 + maxHp * .045 + a.level * 1.2));
    return { attack, defense, maxHp, hp: clamp(a.hp == null ? maxHp : a.hp, 0, maxHp), power };
  }
  function getPower(a) { return getCombatStats(a).power; }
  function equip(a, item) { const before = getCombatStats(a).maxHp; a.equipment[item.slot] = item; a.hp = clamp(a.hp + Math.max(0, getCombatStats(a).maxHp - before), 1, getCombatStats(a).maxHp); }
  function createStaff(s, t, candidate, name) {
    const worker = { id: id(s, 'staff'), name: name || candidate.name, role: candidate.role, candidateId: candidate.id, salary: candidate.salary || 30, salaryDebt: 0, trainingId: null, craftLevel: candidate.craftLevel || 1, craftXp: 0, dexterity: candidate.dexterity == null ? candidate.craftSkill : candidate.dexterity, eloquence: candidate.eloquence == null ? candidate.salesSkill : candidate.eloquence, craftSkill: candidate.craftSkill, salesSkill: candidate.salesSkill, stamina: candidate.stamina, maxStamina: candidate.stamina, status: 'idle', x: 2.5, y: t.height - 2.5, facilityId: null, assignedFacilityId: null, spriteIndex: candidate.spriteIndex, moving: false, path: [], destination: null, bubble: null, operationTask: null };
    worker.potentialGrade=candidate.potentialGrade||'C';if(candidate.gradeLegacy)worker.gradeLegacy=true;
    const layout = shopLayout().get(t), start = candidate.role === 'sales' ? layout.counter.staffSpots[0] : { x: 1.5, y: layout.workshop.y + layout.workshop.h - 1.5 };
    worker.x = start.x; worker.y = start.y; worker.counterSlot = null;
    if (candidate.identityVersion) for (const key of ['identityVersion', 'baseName', 'traitId', 'name']) worker[key] = candidate[key];
    ensureIdentity(s, worker, 'staff');
    if (!candidate.salaryTraitApplied) worker.salary = Math.max(1, Math.round(worker.salary * personalityEffect(worker, 'staffSalary')));
    progressionHook('initializeStaff', s, worker); return worker;
  }
  function createFacility(s, type, x, y) { const d = DATA.facilityTypes[type]; return { id: id(s, 'facility'), type, x, y, w: d.w, h: d.h, active: false, taskId: null, staffId: null, heroId: null }; }
  function createTown(s, townId) {
    const t = { id: townId, name: townMap[townId].name, level: 1, width: shopLayout().BASE_WIDTH, height: 12, layoutVersion: shopLayout().VERSION, workshopExtraDepth: 0, retailExtraDepth: 0, warehouseLevel: 1, innLevel: 1, innVersion: 2, innLegacyCapacity: 0, innLayoutHeight: 8, facilities: [], staff: [], queue: [], inventory: [], arrivalTimer: 18 };
    t.facilities.push(createFacility(s, 'furnace', 1, -7 - shopLayout().WALL_GAP), createFacility(s, 'display', 6, 7), createFacility(s, 'enhance', 1, 1));
    t.staff.push(createStaff(s, t, DATA.staffCandidates[0], '대장장이 한스'), createStaff(s, t, DATA.staffCandidates[2], '상인 벨'));
    t.inventory.push(itemFromRecipe(s, 'iron_sword'), itemFromRecipe(s, 'oak_bow'));
    for (const item of t.inventory) item.listed = true;
    return t;
  }
  const browsingCache = new WeakMap();
  function browsingCandidates(s, t) {
    const signature = [t.width, t.height, t.innLevel, t.layoutVersion, t.warehouseLevel, t.workshopExtraDepth, ...t.facilities.map(f => [f.id, f.type, f.x, f.y].join(':'))].join('|');
    const cached = browsingCache.get(t);
    if (cached && cached.signature === signature) return cached.points;
    const layout = getTownLayout(s, t.id), workSpots = t.facilities.map(getFacilityWorkSpot);
    const displays = t.facilities.filter(f => f.type === 'display').map(getFacilityWorkSpot);
    const points = [], horizontal = 1.6, vertical = 2.1;
    function add(x, y, outside) {
      const p = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
      if (!walkable(t, Math.floor(p.x), Math.floor(p.y), undefined, false)) return;
      // A full character is wider than a floor tile. Keep the front doorway,
      // employee work positions, and the resting corner clear for actual paths.
      if (Math.abs(p.x - layout.entrance.x) < 1.7 && p.y >= t.height - 3) return;
      if (workSpots.some(spot => dist(p, spot) < 1.45) || dist(p, layout.restPoint) < 1.6) return;
      if (dist(p, layout.counter.customerSpot) < 2 || shopLayout().contains({ x: layout.counter.x, y: 1, w: layout.counter.w + 1, h: 4 }, p.x, p.y)) return;
      if (t.facilities.some(f => p.x >= f.x - .55 && p.x < f.x + f.w + .55 && p.y >= f.y - .25 && p.y < f.y + f.h + .45)) return;
      if (!findPath(t, layout.entrance, p, undefined, false)) return;
      const nearest = displays.length ? Math.min(...displays.map(spot => dist(p, spot))) : dist(p, { x: t.width / 2, y: t.height / 2 });
      points.push({ ...p, rank: (outside ? 1000 : 0) + nearest });
    }
    for (let row = 0; 1.75 + row * vertical <= t.height - 1.75; row++) {
      for (let col = 0; 1.75 + col * horizontal <= t.width - 1.5; col++) add(1.75 + col * horizontal, 1.75 + row * vertical, false);
    }
    // Large inns can bring more shoppers than fit indoors. Keep additional
    // waiting positions in the courtyard, with the exit lane left open.
    const bottom = layout.bounds.y + layout.bounds.h - .75;
    for (let row = 0; t.height + 1.5 + row * vertical <= bottom; row++) {
      for (let col = 0; 1.75 + col * horizontal <= t.width - 1.5; col++) add(1.75 + col * horizontal, t.height + 1.5 + row * vertical, true);
    }
    points.sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x);
    const positions = points.map(({ x, y }) => ({ x, y }));
    browsingCache.set(t, { signature, points: positions });
    return positions;
  }
  function browsingPoint(s, t, a) {
    const occupied = s.adventurers.filter(h => h.id !== a.id && h.townId === t.id && ['visiting', 'returning'].includes(h.status)).map(h => h.browseSpot || h.destination || { x: h.x, y: h.y });
    const available = p => !occupied.some(other => Math.abs(p.x - other.x) < 1.5 && Math.abs(p.y - other.y) < 2);
    const candidates = browsingCandidates(s, t);
    const previous = a.browseSpot && candidates.find(p => dist(p, a.browseSpot) < .01);
    const chosen = previous && available(previous) ? previous : candidates.find(available);
    // Courtyard capacity exceeds the resident limit at every inn size; this
    // fallback is only for imported transient actors after a layout change.
    const target = chosen || candidates.slice().sort((p, q) => Math.min(...occupied.map(o => dist(q, o)), 1000) - Math.min(...occupied.map(o => dist(p, o)), 1000))[0] || { x: 1.75, y: t.height + 1.5 };
    a.browseSpot = { x: target.x, y: target.y };
    return a.browseSpot;
  }
  function getRallyPoints(s, town, count) {
    const all = browsingCandidates(s, town), outside = all.filter(p => p.y >= town.height), inside = all.filter(p => p.y < town.height);
    return outside.concat(inside).slice(0, count).map(p => ({ x: p.x, y: p.y }));
  }
  function prepareRecall(s, a, target) {
    customerHook('cancel', s, a.id, '마을 방어 소집');
    a.checkoutPending = false;
    const town = getTown(s, a.townId);
    if (a.enhancement) {
      const task = a.enhancement, facility = town.facilities.find(f => f.id === task.facilityId);
      if (task.paid) a.pendingEnhancement = { ...task, facilityId: null };
      if (facility) { facility.heroId = null; facility.active = false; }
      a.enhancement = null;
    }
    a.status = 'recalling'; a.browseSpot = null; a.bedId = null; a.huntOutcome = null; a.visitContinuation = false;
    a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'combat', until: s.time + 1 };
    clearRoute(a); setDestination(town, a, target);
  }
  const potentialFactors={S:1.5,A:1.3,B:1.15,C:1,D:.85,E:.7,F:.5};
  function heroPotential(s,id){let h=(s.rng>>>0)^2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);const n=(h>>>0)%100;return n<1?'S':n<5?'A':n<15?'B':n<40?'C':n<70?'D':n<90?'E':'F';}
  function createHero(s, t, template, resident, legacy=false) {
    const p = template || roster().find(r => !s.adventurers.some(a => a.id === r.id)); if (!p) return null;
    const localRegion = DATA.regions.find(r => townMap[t.id].regionIds.includes(r.id)) || DATA.regions[0];
    const potentialGrade=legacy?'C':heroPotential(s,p.id),factor=potentialFactors[potentialGrade];
    const baseStats = { attack: Math.max(1,Math.round((p.baseStats ? p.baseStats.attack : p.attack || 7)*factor)), defense: Math.max(0,Math.round((p.baseStats ? p.baseStats.defense : p.defense || 3)*factor)), maxHp: Math.max(1,Math.round((p.baseStats ? p.baseStats.maxHp : p.maxHp || p.hp || 58)*factor)) };
    // Match the actual starting equipment and the character's own stats. Town
    // residents must be able to hunt locally even when the map spans Lv.300.
    // Adventurers arrive empty-handed (no "초보자의 장비"); the +6 attack it used to give is part of their own stats.
    baseStats.attack += STARTER_ATTACK;
    const entryHero = { id: p.id, level: t.id === 'greenwood' && p.id === 'bram' ? 2 : 1, baseStats, equipment: { weapon: null } };
    ensureIdentity(s, entryHero, 'adventurer');
    if (t.id !== 'greenwood') while (entryHero.level < DATA.adventurerMaxLevel && getPower(entryHero) < localRegion.minPower) entryHero.level++;
    const level = clamp(campaignHook('newHeroLevel', s, entryHero.level) || entryHero.level, 1, DATA.adventurerMaxLevel);
    const arrivalGoldBonus = townMap[t.id].arrivalGoldBonus ?? (t.id === 'greenwood' ? 0 : localRegion.minPower * 6);
    const exit = getTownLayout(s, t.id).exit;
    const a = { id: p.id, name: p.name, job: p.job, jobId: p.jobId || 'adventurer', color: p.color || '#b89778', sprite: p.sprite, visualId: p.visualId, potentialGrade, baseStats, level, xp: 0, gold: 230 + int(s, 0, 40) + arrivalGoldBonus, equipment: { weapon: null, offhand: null, armor: null, accessory: null }, townId: t.id, resident: !!resident, status: 'traveling', x: exit.x, y: exit.y, timer: 3, total: 3, regionId: localRegion.id, questId: null, discount: 0, bag: emptyBag(), preferredType: DATA.equipment && DATA.equipment.jobWeapons && DATA.equipment.jobWeapons[p.jobId] || p.preferredType || 'sword', visits: 0, fatigue: resident ? 0 : 60, enhancementStones: 0, hp: 1, moving: false, path: [], destination: null, bubble: resident ? null : { type: 'bed', until: s.time + 20 }, bedId: null, enhancement: null, orderCooldown: 0, huntOutcome: null, raidId: null, raidReadyAt: 0, rareBag: {}, browseSpot: null, invasionId: null, injuryUntil: 0, medicalCost: 0, recruitRank: getFame(s).rank, pendingEnhancement: null, lastInvasionId: null, visitContinuation: false, checkoutPending: false, bossRecipe: null };
    ensureIdentity(s, a, 'adventurer');
    a.hp = getCombatStats(a).maxHp;
    s.adventurers.push(a); setDestination(t, a, getTownLayout(s, t.id).entrance);
    return a;
  }
  function createState(seed) {
    const s = { version: VERSION, time: 0, day: 1, gold: 1200, reputation: 0, rng: Number.isInteger(seed) ? seed >>> 0 : 927416, seq: 0, materials: { ...emptyBag(), iron: 24, wood: 18, leather: 12, crystal: 2, mythril: 0 }, activeTownId: 'greenwood', towns: {}, adventurers: [], quests: [], orders: [], stats: { crafted: 0, sold: 0, enhanced: 0, enhancementAttempts: 0, destroyed: 0, quests: 0, orders: 0, earned: 0, hunts: 0, defeats: 0, retreats: 0, repaired: 0, arrivals: 0, departures: 0, regions: {} }, logs: [], events: [], completedGoals: [], gatherCooldown: 0, enhancementService: true };
    if (personality()) personality().initialize(s);
    s.bossMaterialsRetired = true;
    const t = createTown(s, 'greenwood'); s.towns.greenwood = t;
    for (let i = 0; i < originalIds.length; i++) {
      const p = roster().find(r => r.id === originalIds[i]); const a = createHero(s, t, p, true);
      if (i === 3 || i === 5) { a.status = 'hunting'; a.timer = i === 3 ? 18 : 25; a.total = 26; a.huntOutcome = null; clearRoute(a); }
      else { a.status = 'visiting'; a.timer = 3 + i * 2; const point = browsingPoint(s, t, a); a.x = point.x; a.y = point.y; clearRoute(a); }
    }
    progressionHook('initialize', s); raidHook('init', s); campaignHook('init', s); warehouseHook('init', s); operationsHook('init', s); customerHook('init', s); seasonHook('init', s); researchHook('init', s); incidentHook('init', s); questHook('init', s); recruitmentHook('initialize', s, 0);
    log(s, 'welcome', '대장장이 라이프에 오신 것을 환영합니다. 직원과 모험가가 움직이기 시작했어요.');
    return applyCharacterProfiles(s);
  }
  function applyCharacterProfiles(s) {
    for (const a of s.adventurers) {
      if (known(DATA.characterProfiles, a.id)) {
        const profile = DATA.characterProfiles[a.id];
        if (!a.identityVersion) Object.assign(a, profile);
        else { a.job = profile.job; a.color = profile.color; }
      }
      const p = roster().find(x => x.id === a.id);
      if (p) { a.sprite = p.sprite; a.visualId = p.visualId; a.jobId = p.jobId || a.jobId;
        if (DATA.equipment && DATA.equipment.jobWeapons && DATA.equipment.jobWeapons[a.jobId]) a.preferredType = DATA.equipment.jobWeapons[a.jobId];
      }
    }
    return s;
  }


  function getDisplayedItems(s, townId) { const t = getTown(s, townId); return t ? t.inventory.filter(item => item.listed) : []; }
  function listItem(s, itemId, townId) {
    const t = getTown(s, townId), item = t && t.inventory.find(i => i.id === itemId);
    if (!item) return result(false, '창고에서 장비를 찾을 수 없습니다.');
    if (isCustomerItemReserved(s, itemId)) return result(false, '카운터 손님에게 전달할 장비입니다.');
    if (item.locked) return result(false, '잠금을 해제한 뒤 진열해주세요.');
    if (item.listed) return result(false, '이미 진열 중인 장비입니다.');
    if (getDisplayedItems(s, t.id).length >= getStockCapacity(s, t.id)) {
      // Only suggest another display when this forge level still has room for one.
      const more = t.facilities.filter(f => f.type === 'display').length < getForgeLevelInfo(t.level).display;
      return result(false, '진열대가 가득 찼어요. ' + (more ? '시설 배치에서 진열대를 하나 더 놓거나, 진열 중인 장비를 내려주세요.' : '팔리면 자리가 생겨요. 진열 중인 장비를 내리거나 대장간 레벨을 올려 진열대를 늘릴 수 있어요.'));
    }
    item.listed = true; return result(true, item.name + '을(를) 진열했습니다. 이제 모험가가 구매할 수 있습니다.');
  }
  function unlistItem(s, itemId, townId) {
    const t = getTown(s, townId), item = t && t.inventory.find(i => i.id === itemId);
    if (!item || !item.listed) return result(false, '진열된 장비를 선택해주세요.');
    if (getEquipmentUsage(s, t.id) >= getEquipmentCapacity(s, t.id)) return result(false, '창고가 가득 찼습니다. 창고를 증축하거나 장비를 진열해주세요.');
    item.listed = false; return result(true, item.name + '을(를) 창고로 회수했습니다.');
  }
  function listAllItems(s, townId) {
    const t = getTown(s, townId); if (!t) return result(false, '운영 중인 마을을 선택해주세요.');
    let count = 0;
    for (const item of t.inventory) if (!item.listed && !item.locked && !isCustomerItemReserved(s, item.id) && !isIncidentHeld(s, item.id) && getDisplayedItems(s, t.id).length < getStockCapacity(s, t.id)) { item.listed = true; count++; }
    return result(count > 0, count ? count + '개 장비를 진열했습니다.' : '진열할 장비가 없거나 진열대가 가득 찼습니다.', { count });
  }
  function toggleItemLock(s, itemId, locked, townId) {
    const t = getTown(s, townId), item = t && t.inventory.find(i => i.id === itemId);
    if (!item) return result(false, '장비를 찾을 수 없습니다.');
    if (isCustomerItemReserved(s, itemId)) return result(false, '카운터 손님에게 전달할 장비입니다.');
    if (locked != null && typeof locked !== 'boolean') return result(false, '잠금 값을 확인해주세요.');
    delete item.autoProtected;
    item.locked = locked == null ? !item.locked : locked;
    return result(true, item.name + (item.locked ? '을(를) 잠갔습니다. 판매·납품되지 않습니다.' : '의 잠금을 해제했습니다.'), { locked: item.locked });
  }

  function getBuildCost(s, type) {
    const t = getTown(s); if (!t || !known(DATA.facilityTypes, type)) return null;
    const n = t.facilities.filter(f => f.type === type).length;
    const townIndex = DATA.towns.findIndex(town => town.id === t.id);
    const townMultiplier = [1, 2, 4, 7, 12][Math.max(0, townIndex)] || 1;
    return n >= facilityCap(t, type) ? null : Math.round(DATA.facilityTypes[type].cost * townMultiplier * Math.pow(1.18, Math.max(0, n - 1)));
  }
  function canPlaceFacility(s, type, x, y, ignoreId) {
    const t = getTown(s), d = known(DATA.facilityTypes, type) ? DATA.facilityTypes[type] : null;
    if (!t || !d || !integer(x, 1, t.width) || !integer(y, -80, t.height)) return result(false, '대장간 안의 타일을 선택해주세요.');
    const f = { id: ignoreId || 'preview', type, x, y, w: d.w, h: d.h };
    if (!shopLayout().facilityRegion(t, f)) return result(false, type === 'furnace' ? '화덕은 뒤쪽 작업실에 배치해주세요. 벽·문·직원 휴식 공간은 비워주세요.' : '매대와 강화대는 앞쪽 매장에 배치해주세요. 카운터와 출입 통로는 비워주세요.');
    const other = t.facilities.filter(o => o.id !== ignoreId);
    if (other.some(o => x < o.x + o.w && x + d.w > o.x && y < o.y + o.h && y + d.h > o.y)) return result(false, '다른 시설과 겹칩니다.');
    const actors = t.staff.concat(s.adventurers.filter(a => a.townId === t.id && a.status !== 'hunting'));
    if (actors.some(a => inside(a.x, a.y, f))) return result(false, '캐릭터가 서 있는 곳에는 배치할 수 없어요.');
    const facilities = other.concat(f), entrance = getTownLayout(s, t.id).entrance;
    const invasion = s.campaign && s.campaign.invasions.find(inv => inv.townId === t.id && ['recalling', 'battle'].includes(inv.status));
    if (invasion) for (const target of invasion.rallyPoints) {
      if (target.x >= f.x - .55 && target.x < f.x + f.w + .55 && target.y >= f.y - .25 && target.y < f.y + f.h + .45 || dist(target, getFacilityWorkSpot(f)) < 1.45 || !findPath(t, entrance, target, facilities)) return result(false, '소집 중인 주민의 집결 위치와 귀환 통로를 비워주세요.');
    }
    for (const placed of facilities) {
      const spot = getFacilityWorkSpot(placed);
      if (!findPath(t, entrance, spot, facilities, placed.type === 'furnace')) return result(false, '시설 앞까지 걸어갈 통로가 필요합니다.');
    }
    const layout = getTownLayout(s, t.id), staffPoints = [layout.restPoint, layout.warehouse.pickupPoint, ...layout.counter.staffSpots, ...layout.counter.buyingSpots];
    if (staffPoints.some(point => !findPath(t, entrance, point, facilities, true)) || !findPath(t, entrance, layout.counter.customerSpot, facilities, false)) return result(false, '카운터·창고·직원 휴식 공간까지 통로를 남겨주세요.');
    if (actors.some(a => !findPath(t, a, entrance, facilities))) return result(false, '캐릭터의 이동 통로가 막힙니다.');
    return result(true, '여기에 배치할 수 있습니다.');
  }
  function refreshRoutes(t, actors) { for (const a of actors) if (a.destination) { const target = a.destination; a.destination = null; setDestination(t, a, target); } }
  function placeFacility(s, type, x, y) {
    const check = canPlaceFacility(s, type, x, y); if (!check.ok) return check;
    const cost = getBuildCost(s, type); if (cost == null) return result(false, '지금 대장간 레벨에서는 더 놓을 수 없어요. 대장간을 확장해주세요.');
    if (s.gold < cost) return result(false, '배치 비용 ' + cost + ' G가 필요합니다.');
    const t = getTown(s), facility = createFacility(s, type, x, y);
    s.gold -= cost; t.facilities.push(facility); s.reputation += 2;
    refreshRoutes(t, t.staff.concat(s.adventurers.filter(a => a.townId === t.id)));
    log(s, 'build', t.name + ' · ' + DATA.facilityTypes[type].name + ' 배치 완료', { townId: t.id, facilityId: facility.id, gold: -cost });
    return result(true, DATA.facilityTypes[type].name + '를 배치했습니다.', { facility, cost });
  }
  function releaseWorker(t, worker) {
    for (const f of t.facilities) if (f.staffId === worker.id) { f.staffId = null; f.active = false; }
    for (const q of t.queue) if (q.staffId === worker.id) { q.staffId = null; q.status = 'paused'; }
    delete worker.assistSlot; worker.facilityId = null; worker.counterSlot = null; worker.bubble = null; worker.operationTask = null; clearRoute(worker);
  }
  function moveFacility(s, facilityId, x, y) {
    const t = getTown(s), f = t.facilities.find(v => v.id === facilityId);
    if (!f) return result(false, '시설을 찾을 수 없습니다.');
    if (f.heroId) return result(false, '모험가가 강화 작업대를 사용하고 있어요. 끝난 뒤 옮겨주세요.');
    const check = canPlaceFacility(s, f.type, x, y, f.id); if (!check.ok) return check;
    for (const staff of t.staff) if (staff.facilityId === f.id) { releaseWorker(t, staff); staff.status = 'idle'; }
    f.x = x; f.y = y; f.active = false; f.staffId = null;
    refreshRoutes(t, t.staff.concat(s.adventurers.filter(a => a.townId === t.id)));
    log(s, 'move-facility', DATA.facilityTypes[f.type].name + '의 위치를 옮겼습니다.', { townId: t.id, facilityId: f.id });
    return result(true, '시설을 옮겼습니다.');
  }
  // 2026-11-10 balance pass 4 (2배속 10시간 기준): Lv.4→5 was 192,000 (×4 again) and "다섯 마을 모두 5단계" was one of the
// last goals to finish → 150,000. Lv.2~4 (3,000 / 12,000 / 48,000) are unchanged.
const EXPANSION_LV5_COST = 150000;
function getExpansionCost(s) { const t = getTown(s); return t.level >= 5 ? null : t.level === 4 ? EXPANSION_LV5_COST : Math.round(EXPANSION_BASE_COST * Math.pow(EXPANSION_GROWTH, t.level - 1)); }
  function expandShop(s) {
    const t = getTown(s), cost = getExpansionCost(s);
    if (campaignHook('isTownBlocked', s, t.id)) return result(false, '모든 주민의 방어가 끝난 뒤 작업장을 증축할 수 있습니다.');
    if (cost == null) return result(false, '대장간이 최고 단계(Lv.5)예요.');
    if (s.gold < cost) return result(false, '확장 비용 ' + cost + ' G가 필요합니다.');
    // 2026-11: the map stays the same size; a higher level only allows more facilities / better furnaces.
    s.gold -= cost; t.level++; s.reputation += 4;
    const info = getForgeLevelInfo(t.level);
    const unlocks = '화덕 ' + info.furnace + '개 · 진열대 ' + info.display + '개 · 강화 작업대 ' + info.enhance + '개' + (info.furnaceGrade === 3 ? ' · 최고급 화덕' : info.furnaceGrade === 2 ? ' · 고급 화덕' : '');
    log(s, 'upgrade', t.name + ' 대장간 Lv.' + t.level + ' · ' + unlocks, { townId: t.id, upgradeId: 'shop', gold: -cost });
    updateGoals(s); return result(true, '대장간 Lv.' + t.level + '! 이제 ' + unlocks + '까지 쓸 수 있어요.', { cost });
  }
  function getInnUpgradeCost(s) { const t = getTown(s); if (!t || t.innLevel >= 5) return null; const townIndex = DATA.towns.findIndex(town => town.id === t.id); return [1600, 5000, 16000, 45000][t.innLevel - 1] * ([1, 2, 4, 7, 12][Math.max(0, townIndex)] || 1); }
  function upgradeInn(s) {
    const t = getTown(s), cost = getInnUpgradeCost(s);
    if (cost == null) return result(false, '여관의 최대 정원은 40명입니다.');
    if (s.gold < cost) return result(false, '여관 증축 비용 ' + cost + ' G가 필요합니다.');
    s.gold -= cost; t.innLevel++; t.arrivalTimer = Math.min(t.arrivalTimer, 4); s.reputation += 2;
    log(s, 'inn', t.name + ' 여관 증축 · 수용 인원 ' + getInnCapacity(s) + '명. 새 모험가가 찾아옵니다.', { townId: t.id, gold: -cost });
    return result(true, '여관 수용 인원을 8명 늘렸습니다.', { cost });
  }
  function getHireCost(s, candidateId) {
    const c = DATA.staffCandidates.find(x => x.id === candidateId), t = getTown(s);
    return !c || t.staff.length >= 30 ? null : Math.round(c.cost * (1 + Math.max(0, t.staff.length - 2) * .12) * (s.incidents && s.incidents.hireDiscount > 0 ? .5 : 1));
  }
  function hireStaff(s, candidateId) {
    const c = DATA.staffCandidates.find(x => x.id === candidateId), cost = getHireCost(s, candidateId);
    if (!c || cost == null) return result(false, '고용 가능한 직원을 선택해주세요.');
    if (s.gold < cost) return result(false, '고용 비용 ' + cost + ' G가 필요합니다.');
    if (s.incidents && s.incidents.hireDiscount > 0) s.incidents.hireDiscount = 0; // the apprentice's half-price hire is used
    const t=getTown(s),rank=heroPotential(s,c.id+'-'+s.seq),factor=potentialFactors[rank],candidate={...c,potentialGrade:rank,craftLevel:c.role==='smith'?1:c.craftLevel};
    candidate.dexterity=Math.round(Math.min(c.dexterity??c.craftSkill,66)*factor);candidate.craftSkill=candidate.dexterity;
    candidate.eloquence=Math.round(Math.min(c.eloquence??c.salesSkill,66)*factor);candidate.salesSkill=candidate.eloquence;candidate.stamina=Math.round(c.stamina*factor);
    const employee = createStaff(s, t, candidate, c.name + (t.staff.some(w => w.name.startsWith(c.name)) ? ' ' + (t.staff.length + 1) : ''));
    s.gold -= cost; t.staff.push(employee);
    log(s, 'hire', employee.name + ' 고용 · 제작기술 Lv.' + employee.craftLevel + ' / 손놀림 ' + employee.dexterity + ' / 말솜씨 ' + employee.eloquence + ' / 체력 ' + employee.maxStamina, { townId: t.id, staffId: employee.id, gold: -cost });
    return result(true, employee.name + '이(가) 출근했습니다.', { staff: employee, cost });
  }
  function assignStaff(s, staffId, role, facilityId, townId) {
    const t = getTown(s, townId), worker = t && t.staff.find(x => x.id === staffId);
    if (worker && worker.trainingId) return result(false, '교육을 마친 뒤 담당 업무를 변경해주세요.');
    if (!worker || !known(staffRoleNames, role)) return result(false, '직원과 담당 업무를 확인해주세요.');
    const f = facilityId ? t.facilities.find(x => x.id === facilityId) : null;
    if (facilityId && (!f || f.type !== staffRoleFacilities[role])) return result(false, '업무에 맞는 시설을 선택해주세요.');
    // Craft skill is earned only by working as a smith (every hiring path starts smiths at Lv.1).
    // A worker without smith experience therefore starts at craft Lv.1 when first made a smith;
    // former smiths keep the level they earned.
    if (worker.role === 'smith') worker.smithHistory = true;
    const firstSmithShift = role === 'smith' && worker.role !== 'smith' && worker.smithHistory !== true;
    const resetLevel = firstSmithShift && worker.craftLevel > 1;
    releaseWorker(t, worker); worker.role = role; worker.assignedFacilityId = f ? f.id : null; worker.status = 'idle';
    if (role === 'smith') worker.smithHistory = true;
    if (resetLevel) { worker.craftLevel = 1; worker.craftXp = 0; worker.salaryBaseLevel = 1; }
    return result(true, worker.name + '의 업무를 ' + staffRoleNames[role] + '로 지정했습니다.' + (resetLevel ? ' 제작기술은 제조 업무로만 쌓이므로 제작 Lv.1부터 시작합니다.' : ''), { craftLevelReset: resetLevel });
  }
  function craftSpeed(worker) { return worker ? ((.7 + worker.craftLevel * .12) * personalityEffect(worker, 'staffSpeed')) / .82 : 1; }
  function getCraftDuration(s, recipeId, staffId) {
    const r=known(recipeMap,recipeId)?recipeMap[recipeId]:null;if(!r)return null;
    const town=getTown(s), workers=town?town.staff.filter(w=>w.role==='smith'&&(!staffId||w.id===staffId)):[];
    const speed=(workers.length?Math.max(...workers.map(craftSpeed)):1)*(1+researchEffect(s,'craftSpeed'));
    return (r.duration * 9 / 7) / speed;
  }
  function getFurnaceGradeQuote(s, facilityId, townId) {
    const t=getTown(s,townId), f=t && t.facilities.find(x=>x.id===facilityId && x.type==='furnace');
    if(!f) return null;
    const grade=f.grade||1, next=grade+1, townIndex=DATA.towns.findIndex(x=>x.id===t.id), multiplier=[1,2,4,7,12][Math.max(0,townIndex)]||1;
    if(grade>=3) return {grade, next:null, cost:null, allowed:false};
    const requiredLevel=FURNACE_GRADE_LEVEL[next], cost=(next===2?2500:10000)*multiplier;
    return {grade,next,cost,requiredLevel,allowed:t.level>=requiredLevel && s.gold>=cost && !f.taskId};
  }
  function upgradeFurnace(s, facilityId, townId) {
    const t=getTown(s,townId), f=t && t.facilities.find(x=>x.id===facilityId&&x.type==='furnace'), quote=getFurnaceGradeQuote(s,facilityId,townId);
    if(!quote||!quote.allowed) return result(false, '대장간 레벨·골드·작업 종료 여부를 확인해주세요.');
    s.gold-=quote.cost; f.grade=quote.next; log(s,'furnace-upgrade',t.name+' 화덕 등급 '+quote.next+' · −'+quote.cost+' G',{townId:t.id,facilityId:f.id,gold:-quote.cost});
    return result(true,'화덕을 '+(quote.next===2?'고급':'최고급')+'으로 개선했습니다.',{cost:quote.cost});
  }
  function assistantSpot(f, slot) { return {x:f.x+(slot===0?.35:.95),y:f.y+f.h+.5}; }
  function getFurnaceWorkers(s, townId, facilityId) {
    const t=getTown(s,townId), f=t&&t.facilities.find(x=>x.id===facilityId&&x.type==='furnace');
    if(!f) return [];
    const leader=t.staff.find(w=>w.id===f.staffId);
    if(!leader||leader.status!=='working'||!canStaffWork(leader)||leader.trainingId||leader.salaryDebt||dist(leader,getFacilityWorkSpot(f))>=.08) return [];
    return [leader,...t.staff.filter(w=>w!==leader&&w.role==='smith'&&w.facilityId===f.id&&integer(w.assistSlot,0,1)&&w.status==='working'&&canStaffWork(w)&&!w.trainingId&&!w.salaryDebt&&dist(w,assistantSpot(f,w.assistSlot))<.08)].slice(0,f.grade||1);
  }
  function craft(s, recipeId, townId, orderId) {
    const r = known(recipeMap, recipeId) ? recipeMap[recipeId] : null, t = getTown(s, townId);
    if (!r) return result(false, '존재하지 않는 설계도입니다.');
    if(r.unlockDrop && !(s.unlockedDrops||[]).includes(r.id))return result(false,'아직 획득하지 않은 설계도입니다.');
    if (!t) return result(false, '운영 중인 마을을 선택해주세요.');
    // A boss rare recipe is only made on its owner's commission. The shop supplies the (huge) materials.
    const bossOrder = r.bossRecipe ? s.orders.find(o => o.id === orderId && o.status === 'open' && o.heirloom && o.recipeId === r.id && o.townId === t.id) : null;
    if (r.bossRecipe && !bossOrder) return result(false, '보스 희귀 설계도는 설계도를 가진 모험가의 의뢰로만 만들 수 있어요.');
    if (bossOrder && t.queue.some(q => q.orderId === bossOrder.id)) return result(false, '이 전용 장비는 이미 화덕에서 만들고 있어요.');
    if (!t.staff.some(w => w.role === 'smith' && w.craftLevel >= getRecipeLevel(r))) return result(false, '제작기술 레벨 ' + getRecipeLevel(r) + ' 이상의 직원이 필요한 설계도입니다.');
    const furnaces = t.facilities.filter(f => f.type === 'furnace').map(f => ({ f, count: t.queue.filter(q => q.facilityId === f.id).length })).filter(v => v.count < 3).sort((a, b) => a.count - b.count);
    if (!furnaces.length) {
      // Point at what actually helps: a free furnace slot at this level, a forge level-up, or just waiting.
      const owned = t.facilities.filter(f => f.type === 'furnace').length, cap = getForgeLevelInfo(t.level).furnace;
      const hint = owned < cap ? ' 시설 배치에서 화덕을 하나 더 놓을 수 있어요.' : t.level < 5 ? ' 하나가 끝나면 바로 이어서 예약할 수 있어요. 대장간 레벨을 올리면 화덕이 늘어나요.' : ' 하나가 끝나면 바로 이어서 예약할 수 있어요.';
      return result(false, '화덕 대기열이 가득 찼어요.' + hint);
    }
    if (t.inventory.length + t.queue.length + (s.festival ? s.festival.entries.filter(e => e.townId === t.id).length : 0) >= 2000) return result(false, '창고에 2,000개까지 보관할 수 있습니다.');
    if (getEquipmentUsage(s, t.id) >= getEquipmentCapacity(s, t.id)) return result(false, '완성품을 보관할 창고 공간이 부족합니다. 장비를 진열하거나 창고를 증축해주세요.');
    for (const [m, n] of Object.entries(r.cost)) if (!known(DATA.materials, m) || !finite(s.materials[m], n)) return result(false, (DATA.materials[m] ? DATA.materials[m].name : '필요 재료') + '이 부족합니다.' + (bossOrder ? ' (' + n + '개 필요, 지금 ' + (s.materials[m] || 0) + '개)' : ''));
    for (const [m, n] of Object.entries(r.cost)) s.materials[m] -= n;
    const duration=r.duration * 9 / 7;
    const entry = { id: id(s, 'craft'), townId: t.id, recipeId, total: duration, remaining: duration, facilityId: furnaces[0].f.id, staffId: null, status: 'waiting' };
    // Crafted for a request: the finished piece goes straight to the requester (see completeCraft).
    if (orderId && s.orders.some(o => o.id === orderId && o.status === 'open' && o.townId === t.id && o.recipeId === recipeId)) entry.orderId = orderId;
    t.queue.push(entry);
    log(s, 'craft-start', r.name + ' 제작 예약 · 직원이 화덕 앞에 도착하면 시작합니다.', { townId: t.id, recipeId });
    return result(true, r.name + ' 제작을 예약했습니다.', { item: entry });
  }
  function getCraftQualityChances(s, worker) {
    const level = clamp(worker && worker.craftLevel || 1, 1, 30), dexterity = clamp(worker && worker.dexterity || 0, 0, 100);
    const master = Math.min(.4, Math.min(.3, .01 + dexterity * .0013 + Math.max(0, s && s.reputation || 0) * .0001) + personalityEffect(worker, 'masterworkChance') + researchEffect(s, 'masterworkChance'));
    const fine = Math.min(.55, .10 + dexterity * .003), remainder = Math.max(0, 1 - master - fine);
    // The old masterwork pool is shared by all higher qualities. Skill unlocks
    // rare outcomes without turning high dexterity into guaranteed masterpieces.
    const shares = { masterpiece: level >= 10 ? .16 : 0, legendary: level >= 20 ? .045 : 0, mythic: level >= 30 ? .008 : 0 };
    const chances = { normal: remainder * .65, good: remainder * .35, fine,
      masterwork: master * (1 - shares.masterpiece - shares.legendary - shares.mythic),
      masterpiece: master * shares.masterpiece, legendary: master * shares.legendary, mythic: master * shares.mythic };
    return DATA.qualityOrder.map(key => ({ id: key, name: DATA.qualities[key].name, chance: chances[key], minCraftLevel: DATA.qualities[key].minCraftLevel, unlocked: level >= DATA.qualities[key].minCraftLevel }));
  }
  function completeCraft(s, t, entry, worker) {
    const r = recipeMap[entry.recipeId];
    let roll = random(s), quality = 'normal';
    for (const candidate of getCraftQualityChances(s, worker).reverse()) {
      if (roll < candidate.chance) { quality = candidate.id; break; }
      roll -= candidate.chance;
    }
    if (r.rare && quality === 'normal') quality = 'good'; // boss rare pieces are at least 'good'
    if (s.incidents && s.incidents.qualityBoost > 0 && !r.rare) { const order = DATA.qualityOrder, i = order.indexOf(quality); if (i < order.length - 1 && DATA.qualities[order[i + 1]].minCraftLevel <= (worker && worker.craftLevel || 1)) quality = order[i + 1]; s.incidents.qualityBoost--; }
    const item = itemFromRecipe(s, r.id, quality);
    if (!object(s.stats.qualityCrafted)) s.stats.qualityCrafted = {};
    s.stats.qualityCrafted[quality] = (s.stats.qualityCrafted[quality] || 0) + 1;
    const p = progression();
    if (p && p.onCraft) progressionHook('onCraft', s, t, item, worker);
    else { worker.craftXp += r.tier * 12; while (worker.craftLevel < 30 && worker.craftXp >= getCraftXpNeeded(worker.craftLevel)) { worker.craftXp -= getCraftXpNeeded(worker.craftLevel); worker.craftLevel++; } }
    for(const id of entry.participants||[]) {const helper=t.staff.find(w=>w.id===id);if(helper&&helper!==worker)progressionHook('awardCraftGrowth',s,item,helper);}
    campaignHook('onCraft', s, t, item, worker);
    t.inventory.push(item);
    // Made for a request: hand it over now, or set it aside (locked) until the requester can take it.
    const order = entry.orderId && s.orders.find(o => o.id === entry.orderId && o.status === 'open');
    if (order) {
      if (!orderReceiveBlock(s, order, item)) { t.queue.splice(t.queue.indexOf(entry), 1); s.stats.crafted++; deliverOrderItem(s, t, order, item); return; }
      item.locked = true; item.listed = false; order.reservedItemId = item.id;
    }
    // Made from a delivery incident's window: hand it in right away (before keep-quality rules can lock it).
    if (entry.incidentId && s.incidents) {
      const handed = incidentHook('deliver', s, entry.incidentId, item.id);
      if (handed && handed.ok) {
        t.queue.splice(t.queue.indexOf(entry), 1); s.stats.crafted++;
        log(s, 'crafted', worker.name + ' · ' + (quality === 'normal' ? '' : DATA.qualities[quality].name + ' ') + r.name + ' 완성 · 돌발 사건에 바로 납품했어요.', { townId: t.id, recipeId: r.id, quality });
        return;
      }
    }
    operationsHook('onCraft', s, t, item, worker);
    t.queue.splice(t.queue.indexOf(entry), 1); s.stats.crafted++;
    customerHook('onCraft', s, t, item, worker, entry);
    const destination = isCustomerItemReserved(s, item.id) ? '카운터 손님에게 전달할 준비가 되었습니다.' : item.autoProtected ? '자동 보관 규칙에 따라 창고에 잠금 보관했습니다.' : '창고에 보관했습니다. 진열해야 판매됩니다.';
    log(s, 'crafted', worker.name + ' · ' + (quality === 'normal' ? '' : DATA.qualities[quality].name + ' ') + r.name + ' 완성 · ' + destination, { townId: t.id, recipeId: r.id, quality, itemId: item.id });
  }
  function tickStaff(s, t, dt) {
    for (const f of t.facilities) if (f.type !== 'enhance') f.active = false;
    for (const w of t.staff) {
      if (w.role !== 'smith' && w.role !== 'sales') continue;
      if (w.trainingId) continue;
      if (w.salaryDebt > 0) { releaseWorker(t, w); w.status = 'idle'; w.stamina = Math.min(w.maxStamina, w.stamina + dt * 2); continue; }
      if (!canStaffWork(w) && w.status !== 'resting') { releaseWorker(t, w); w.status = 'resting'; setDestination(t, w, restSpotFor(t, w)); }
      if (w.status === 'resting') {
        const arrived = moveActor(t, w, dt, 2.8); w.bubble = { type: 'bed', until: s.time + 1 };
        if (arrived) w.stamina = Math.min(w.maxStamina, w.stamina + dt * 9);
        if (w.stamina >= w.maxStamina * .65) { w.status = 'idle'; w.bubble = null; clearRoute(w); }
        continue;
      }
      if (w.role === 'smith') {
        let q = t.queue.find(q => q.staffId === w.id), helper = false, f = null;
        if (!q && integer(w.assistSlot,0,1)) {
          f=t.facilities.find(x=>x.id===w.facilityId&&x.type==='furnace');
          q=f&&t.queue.find(x=>x.facilityId===f.id&&x.staffId&&x.staffId!==w.id);
          if(!q||w.assistSlot>=(f.grade||1)-1){releaseWorker(t,w);q=null;f=null;} else helper=true;
        }
        if (!q) {
          const choices=t.facilities.filter(f=>f.type==='furnace'&&(!w.assignedFacilityId||f.id===w.assignedFacilityId)&&(!f.staffId||f.staffId===w.id));
          // Any waiting job at a free furnace that this smith is skilled enough for (not only the first one in line).
          const canMake=x=>!x.staffId&&w.craftLevel>=getRecipeLevel(recipeMap[x.recipeId]);
          for(const station of choices){const candidate=t.queue.find(x=>x.facilityId===station.id&&canMake(x));if(candidate){q=candidate;f=station;q.staffId=w.id;f.staffId=w.id;w.facilityId=f.id;break;}}
          // 2026-11: jobs piled up behind another smith on one furnace used to leave the second smith standing idle.
          // An idle smith now carries such a job over to a free furnace (that has room) and makes it there.
          if(!q){
            const free=choices.filter(st=>!st.staffId&&t.queue.filter(x=>x.facilityId===st.id).length<3&&!t.queue.some(x=>x.facilityId===st.id&&canMake(x)));
            const waiting=t.queue.find(x=>canMake(x)&&t.facilities.some(o=>o.id===x.facilityId&&o.staffId&&o.staffId!==w.id));
            if(free.length&&waiting){f=free[0];q=waiting;q.facilityId=f.id;q.status='waiting';q.staffId=w.id;f.staffId=w.id;w.facilityId=f.id;}
          }
        }
        if (!q) {
          for(const station of t.facilities.filter(x=>x.type==='furnace'&&(x.grade||1)>1&&(!w.assignedFacilityId||x.id===w.assignedFacilityId))){
            const candidate=t.queue.find(x=>x.facilityId===station.id&&x.staffId&&x.staffId!==w.id);if(!candidate||w.craftLevel<getRecipeLevel(recipeMap[candidate.recipeId]))continue;
            const occupied=new Set(t.staff.filter(other=>other!==w&&other.facilityId===station.id&&integer(other.assistSlot,0,1)).map(other=>other.assistSlot));
            const slot=Array.from({length:(station.grade||1)-1},(_,i)=>i).find(i=>!occupied.has(i));
            if(slot!==undefined){q=candidate;f=station;helper=true;w.facilityId=f.id;w.assistSlot=slot;break;}
          }
        }
        if (!q) {
          if(w.facilityId||w.assistSlot!=null||w.counterSlot!=null)releaseWorker(t,w);
          const layout=getTownLayout(s,t.id),spots=[];
          for(let y=layout.workshop.y+1;y<layout.workshop.y+layout.workshop.h;y++)for(let x=1;x<t.width-1;x++)
            if(walkable(t,x,y,undefined,true)&&!t.facilities.some(f=>dist({x:x+.5,y:y+.5},getFacilityWorkSpot(f))<1.1))spots.push({x:x+.5,y:y+.5});
          const index=t.staff.filter(other=>other.role==='smith').indexOf(w),spot=spots[index];
          if(spot){setDestination(t,w,spot);moveActor(t,w,dt,2.8);}
          w.status='idle';w.stamina=Math.min(w.maxStamina,w.stamina+dt*2);continue;
        }
        f=f||t.facilities.find(x=>x.id===q.facilityId);const spot=helper?assistantSpot(f,w.assistSlot):getFacilityWorkSpot(f);if(!helper)f.taskId=q.id;
        setDestination(t,w,spot);const arrived=moveActor(t,w,dt,3);
        if(!arrived||dist(w,spot)>.08){w.status='walking';if(!helper)q.status='waiting';w.bubble=null;continue;}
        w.status='working';w.bubble={type:'hammer',until:s.time+.5};if(!helper){f.active=true;f.staffId=w.id;q.status='working';}
      } else {
        const points = getTownLayout(s, t.id).counter.staffSpots;
        if (w.counterSlot == null) w.counterSlot = points.findIndex((point, index) => !t.staff.some(other => other !== w && other.role === 'sales' && other.counterSlot === index && canStaffWork(other) && !other.trainingId));
        if (!integer(w.counterSlot, 0, points.length - 1)) { releaseWorker(t, w); w.status = 'idle'; w.stamina = Math.min(w.maxStamina, w.stamina + dt * 2); continue; }
        const f = t.facilities.find(f => f.type === 'display' && (!w.assignedFacilityId || f.id === w.assignedFacilityId) && (!f.staffId || f.staffId === w.id));
        if (!f) { releaseWorker(t, w); w.status = 'idle'; w.stamina = Math.min(w.maxStamina, w.stamina + dt * 2); continue; }
        w.facilityId = f.id; f.staffId = w.id; const spot = getCounterWorkSpot(t, w);
        setDestination(t, w, spot); const arrived = moveActor(t, w, dt, 2.8);
        w.status = arrived && dist(w, spot) < .08 ? 'selling' : 'walking'; w.bubble = null;
        if (arrived) w.stamina = Math.min(w.maxStamina, w.stamina + dt * .3);
      }
    }
    for(const f of t.facilities.filter(x=>x.type==='furnace')) {
      const q=t.queue.find(x=>x.id===f.taskId&&x.staffId===f.staffId), workers=q?getFurnaceWorkers(s,t.id,f.id):[];
      if(!q||!workers.length)continue;
      if(!q.participants)q.participants=[];for(const worker of workers)if(!q.participants.includes(worker.id))q.participants.push(worker.id);
      const incident=incidentFactor(s,'furnace:'+f.id,t.id)*incidentFactor(s,'craft',t.id)*incidentFactor(s,'staff:'+workers[0].id,t.id);
      q.remaining=Math.max(0,q.remaining-dt*workers.length*craftSpeed(workers[0])*(1+researchEffect(s,'craftSpeed'))*incident);
      const fatigue=Math.max(0,1-researchEffect(s,'staffFatigue'));
      for(const worker of workers)worker.stamina=Math.max(0,worker.stamina-dt*(.6+worker.dexterity*.014)*personalityEffect(worker,'staffFatigue')*fatigue);
      if(q.remaining<=1e-7){completeCraft(s,t,q,workers[0]);f.taskId=null;for(const worker of t.staff.filter(x=>x.facilityId===f.id&&x.role==='smith')){releaseWorker(t,worker);worker.status='idle';}f.active=false;f.staffId=null;}
    }
    releaseStaleClaims(t);
  }
  // A smith who moves to another furnace (or a seller to another display) used to leave their id on the old one,
  // which made every later save fail its check. Drop claims whose worker is no longer at that facility.
  function releaseStaleClaims(t) {
    for (const f of t.facilities) if (f.staffId && !t.staff.some(w => w.id === f.staffId && w.facilityId === f.id)) { f.staffId = null; f.active = false; }
    for (const q of t.queue) if (q.staffId && !t.staff.some(w => w.id === q.staffId && w.role === 'smith' && w.facilityId === q.facilityId)) { q.staffId = null; if (q.status === 'working' || q.status === 'waiting') q.status = 'paused'; }
  }
  function getUpgradeCost(s, key) {
    if (key === 'shop') return getExpansionCost(s);
    if (key === 'inn') return getInnUpgradeCost(s);
    if (key === 'apprentice') return getHireCost(s, 'smith');
    if (key === 'warehouse') return getWarehouseUpgradeCost(s);
    return getBuildCost(s, key);
  }
  function upgrade(s, key) {
    if (key === 'shop') return expandShop(s);
    if (key === 'inn') return upgradeInn(s);
    if (key === 'apprentice') return hireStaff(s, 'smith');
    if (key === 'warehouse') return upgradeWarehouse(s);
    if (!known(DATA.facilityTypes, key)) return result(false, '존재하지 않는 시설입니다.');
    const t = getTown(s);
    const rear = getTownLayout(s, t.id).workshop, firstY = key === 'furnace' ? rear.y + 1 : 1, lastY = key === 'furnace' ? rear.y + rear.h - 2 : t.height - 2;
    for (let y = firstY; y < lastY; y++) for (let x = 1; x < t.width - 1; x++) if (canPlaceFacility(s, key, x, y).ok) return placeFacility(s, key, x, y);
    return result(false, '지금 대장간 레벨에서는 더 놓을 수 없어요. 대장간을 확장해주세요.');
  }
  function buyMaterial(s, material, amount) {
    const m = known(DATA.materials, material) ? DATA.materials[material] : null;
    if (!m || !integer(amount, 1, 10000)) return result(false, '구매할 재료와 수량을 확인해주세요.');
    if (m.buyable === false) return result(false, '이 희귀 재료는 보스를 토벌한 모험가에게 직접 매입해야 합니다.');
    if (amount > getMaterialRoom(s, material)) return result(false, '창고의 재료별 보관 한도를 넘습니다. 수량을 줄이거나 창고를 증축해주세요.');
    if (incidentFactor(s, 'buyStop') === 0) return result(false, '길이 막혀서 지금은 재료를 살 수 없어요.');
    const cost = Math.round(getMaterialPrices(material).direct * incidentFactor(s, 'price:' + material)) * amount;
    if (s.gold < cost) return result(false, '골드가 부족합니다. ' + cost + ' G가 필요해요.');
    if (s.materials[material] + amount > 100000000) return result(false, '재료 보관 한도에 도달했습니다.');
    s.gold -= cost; s.materials[material] += amount;
    log(s, 'supply', m.name + ' ' + amount + '개 구입 · −' + cost + ' G', { material, amount, gold: -cost });
    return result(true, m.name + ' ' + amount + '개를 받았습니다.', { cost });
  }
  function gather(s) {
    if (s.gatherCooldown > 0) return result(false, Math.ceil(s.gatherCooldown) + '초 후에 다시 재료를 모을 수 있어요.');
    s.materials.iron = Math.min(100000000, s.materials.iron + 4); s.materials.wood = Math.min(100000000, s.materials.wood + 3); s.materials.leather = Math.min(100000000, s.materials.leather + 2); s.gatherCooldown = 45;
    log(s, 'gather', '마을 주변에서 철광석 4개 · 참나무 3개 · 가죽 2개를 모았습니다.');
    return result(true, '기초 재료를 모았습니다.');
  }
  // 2026-11 fixed material prices (the player no longer sets quest rewards or discounts), per unit:
  // quest = posted request, adventurers gather it (cheapest, takes time) · auto = buyer staff buys from adventurers'
  // bags (operations.js pays DATA price, ×1) · direct = instant purchase (×4).
  const MATERIAL_PRICE_RATES = Object.freeze({ quest: .8, auto: 1, direct: 4 });
  function getMaterialPrices(material) {
    const p = known(DATA.materials, material) ? DATA.materials[material].price : 0;
    return { quest: p ? Math.max(1, Math.round(p * MATERIAL_PRICE_RATES.quest)) : 0, auto: Math.round(p * MATERIAL_PRICE_RATES.auto), direct: Math.round(p * MATERIAL_PRICE_RATES.direct) };
  }
  function getQuestQuote(material, amount) { return known(DATA.materials, material) && integer(amount, 1, 10000) ? getMaterialPrices(material).quest * amount : 0; }
  const QUEST_BOARD_SIZE = 5;
  // How many more of a material may still be requested: warehouse room minus what open requests will bring in,
  // so finished requests never overfill the warehouse.
  function getQuestRoom(s, material) {
    const incoming = s.quests.filter(q => q.material === material && q.status !== 'completed').reduce((sum, q) => sum + q.amount, 0);
    return Math.max(0, getMaterialRoom(s, material) - incoming);
  }
  function questRegions(townId, material) {
    const town = townMap[townId];
    return town ? DATA.regions.filter(r => town.regionIds.includes(r.id) && r.loot[material]) : [];
  }
  function canCollectQuest(a, material, amount) {
    return a.bag[material] >= amount || questRegions(a.townId, material).some(r => getPower(a) >= r.minPower);
  }
  function postQuest(s, input) {
    if (!object(input)) return result(false, '의뢰 내용을 확인해주세요.');
    const { material, amount } = input, t = getTown(s);
    if (!known(DATA.materials, material) || !integer(amount, 1, 10000)) return result(false, '재료 의뢰는 1~10,000개까지 등록할 수 있어요.');
    if (DATA.materials[material].buyable === false) return result(false, '보스 희귀 재료는 일반 수집 의뢰 대신 모험가에게 직접 매입합니다.');
    // Fixed price, no next-purchase discount (input.reward / input.discount are ignored).
    const reward = getQuestQuote(material, amount), discount = 0, room = getQuestRoom(s, material);
    if (amount > room) return result(false, DATA.materials[material].name + '은(는) 창고에 ' + room.toLocaleString('ko-KR') + '개까지만 더 받을 수 있어요. 수량을 줄이거나 창고를 증축해주세요.');
    if (s.quests.filter(q => q.townId === t.id && q.status !== 'completed').length >= QUEST_BOARD_SIZE) return result(false, '진행 중인 재료 의뢰는 ' + QUEST_BOARD_SIZE + '건까지예요. 끝나면 다시 게시할 수 있어요.');
    if (!getResidents(s).some(a => canCollectQuest(a, material, amount))) return result(false, '이 마을에서 해당 재료를 모을 수 있는 모험가가 없습니다. 사냥터와 필요 전투력을 확인해주세요.');
    if (s.gold < reward) return result(false, '의뢰 보상 ' + reward + ' G를 미리 맡겨야 합니다.');
    s.gold -= reward;
    const quest = { id: id(s, 'quest'), townId: t.id, material, amount, reward, discount, status: 'open', adventurerId: null, progress: 0, createdAt: s.time, completedAt: null };
    s.quests.push(quest);
    while (s.quests.length > 48) { const index = s.quests.findIndex(q => q.status === 'completed'); if (index < 0) break; s.quests.splice(index, 1); }
    log(s, 'quest-post', DATA.materials[material].name + ' ' + amount + '개 수집 의뢰 · 보상 ' + reward + ' G 예치', { townId: t.id, questId: quest.id, material, amount });
    return result(true, '재료 의뢰를 게시했습니다.', { quest });
  }
  // Several requests at once (the board's checked rows). All or nothing: board room, gold and gatherers are
  // checked for the whole list before anything is posted.
  function postQuests(s, list) {
    const entries = Array.isArray(list) ? list.filter(object) : [];
    if (!entries.length) return result(false, '의뢰할 재료를 골라주세요.');
    const t = getTown(s), seen = new Set();
    for (const e of entries) {
      if (!known(DATA.materials, e.material) || !integer(e.amount, 1, 10000)) return result(false, '재료 의뢰는 1~10,000개까지 등록할 수 있어요.');
      if (DATA.materials[e.material].buyable === false) return result(false, '보스 희귀 재료는 일반 수집 의뢰 대신 모험가에게 직접 매입합니다.');
      if (seen.has(e.material)) return result(false, '같은 재료가 두 번 들어 있어요.'); seen.add(e.material);
      const room = getQuestRoom(s, e.material);
      if (e.amount > room) return result(false, DATA.materials[e.material].name + '은(는) 창고에 ' + room.toLocaleString('ko-KR') + '개까지만 더 받을 수 있어요. 수량을 줄이거나 창고를 증축해주세요.');
      if (!getResidents(s).some(a => canCollectQuest(a, e.material, e.amount))) return result(false, DATA.materials[e.material].name + '을(를) 모을 수 있는 모험가가 이 마을에 없어요. 사냥터와 필요 전투력을 확인해주세요.');
    }
    const open = s.quests.filter(q => q.townId === t.id && q.status !== 'completed').length;
    if (open + entries.length > QUEST_BOARD_SIZE) return result(false, '진행 중인 재료 의뢰는 ' + QUEST_BOARD_SIZE + '건까지예요. 지금 ' + Math.max(0, QUEST_BOARD_SIZE - open) + '건 더 게시할 수 있어요.');
    const total = entries.reduce((sum, e) => sum + getQuestQuote(e.material, e.amount), 0);
    if (s.gold < total) return result(false, '의뢰비 ' + total.toLocaleString('ko-KR') + ' G가 필요해요.');
    const quests = entries.map(e => postQuest(s, { material: e.material, amount: e.amount }).quest);
    return result(true, '재료 의뢰 ' + quests.length + '건을 게시했어요 · −' + total.toLocaleString('ko-KR') + ' G', { quests, total });
  }
  function cancelQuest(s, questId) {
    const q = s.quests.find(q => q.id === questId && q.townId === s.activeTownId);
    if (!q) return result(false, '의뢰를 찾을 수 없습니다.');
    if (q.status !== 'open') return result(false, '모험가가 수락한 의뢰는 취소할 수 없습니다.');
    s.gold += q.reward; s.quests.splice(s.quests.indexOf(q), 1);
    log(s, 'quest-cancel', '의뢰를 취소하고 ' + q.reward + ' G를 돌려받았습니다.', { questId, gold: q.reward });
    return result(true, '맡긴 보상을 돌려받았습니다.');
  }
  function activeQuest(s, a) { return a.questId ? s.quests.find(q => q.id === a.questId && q.status === 'active') : null; }
  function handleQuests(s, a) {
    let q = activeQuest(s, a);
    if (!q) {
      a.questId = null;
      q = s.quests.find(q => q.townId === a.townId && q.status === 'open' && canCollectQuest(a, q.material, q.amount));
      if (!q) return;
      q.status = 'active'; q.adventurerId = a.id; a.questId = q.id;
      log(s, 'quest-accept', a.name + '이(가) ' + DATA.materials[q.material].name + ' 의뢰를 수락했습니다.', { townId: a.townId, adventurerId: a.id, questId: q.id });
    }
    if (!canCollectQuest(a, q.material, q.amount)) {
      q.status = 'open'; q.adventurerId = null; q.progress = 0; a.questId = null;
      return;
    }
    q.progress = Math.min(q.amount, a.bag[q.material]);
    if (a.bag[q.material] < q.amount) return;
    a.bag[q.material] -= q.amount; s.materials[q.material] += q.amount; a.gold += q.reward; a.questId = null;
    q.status = 'completed'; q.progress = q.amount; q.completedAt = s.time; s.stats.quests++; s.reputation += 4;
    log(s, 'quest-complete', a.name + ' · ' + DATA.materials[q.material].name + ' ' + q.amount + '개 납품', { townId: a.townId, adventurerId: a.id, questId: q.id, material: q.material, amount: q.amount });
  }
  function qualityRank(q) { return DATA.qualityOrder.indexOf(q || 'normal'); }
  function itemValue(item) { const v = getItemStats(item); return v.attack + v.defense * .9 + v.hp * .18; }
  function needsItem(a, item) {
    const current = a.equipment[item.slot];
    if (current && current.heirloom) return false; // a hero keeps the gear the shop made from their own boss recipe
    return !current || itemValue(item) > itemValue(current) * 1.03 || (current.durability < 35 && item.power >= current.power * .9);
  }
  function salesWorker(t) { return t.staff.filter(w => w.role === 'sales' && w.status === 'selling' && canStaffWork(w) && getCounterWorkSpot(t, w) && dist(w, getCounterWorkSpot(t, w)) < .08 && t.facilities.some(f => f.id === w.facilityId && f.type === 'display')).sort((a, b) => b.eloquence - a.eloquence)[0] || null; }
  function getPurchasePrice(s, a, item) {
    const town = a && getTown(s, a.townId), worker = town && salesWorker(town);
    const family = recipeMap[item.recipeId] && recipeMap[item.recipeId].family, incident = incidentFactor(s, 'sale', a.townId) * (family ? incidentFactor(s, 'sale:' + family, a.townId) : 1);
    return Math.max(1, Math.round(item.price * (1 + (worker ? worker.eloquence * .002 * personalityEffect(worker, 'salesEloquence') : 0)) * (1 + researchEffect(s, 'salePrice')) * (1 - a.discount) * personalityEffect(a, 'purchasePrice') * incident));
  }
  function settleSale(s, a, item, price, worker) {
    const town = getTown(s, a.townId), discount = a.discount;
    a.gold -= price; s.gold += price; s.stats.earned += price; s.stats.sold++; s.reputation++; a.discount = 0;
    town.inventory.splice(town.inventory.indexOf(item), 1); item.listed = false; equip(a, item);
    if (worker) {
      worker.stamina = Math.max(0, worker.stamina - 3 * personalityEffect(worker, 'staffFatigue'));
      worker.eloquence = Math.min(100, worker.eloquence + .1);
      worker.salesLevel = worker.salesLevel || 1; worker.salesXp = (worker.salesXp || 0) + 10;
      while (worker.salesLevel < 30 && worker.salesXp >= 20 + worker.salesLevel * 10) {
        worker.salesXp -= 20 + worker.salesLevel * 10; worker.salesLevel++;
        worker.eloquence = Math.min(100, worker.eloquence + .2);
      }
      if (worker.salesLevel >= 30) worker.salesXp = 0;
      worker.salesSkill = worker.eloquence;
    }
    setSatisfactionBubble(s, a, 'heart');
    log(s, 'sale', a.name + ' · ' + item.name + ' 구매 · +' + price + ' G' + (discount ? ' (' + Math.round(discount * 100) + '% 의뢰 할인)' : ''), { townId: town.id, adventurerId: a.id, itemId: item.id, recipeId: item.recipeId, gold: price, discount });
    operationsHook('reconcile', s);
    return true;
  }
  function sellCustomerItem(s, a, item) {
    if (!a || !s.adventurers.includes(a) || !a.resident || !['visiting', 'returning'].includes(a.status) || a.invasionId || a.injuryUntil > s.time) return false;
    const town = getTown(s, a.townId), worker = salesWorker(town);
    if (!worker || !item || item.locked || item.listed || !town.inventory.includes(item) || !needsItem(a, item)) return false;
    if (dist(a, getTownLayout(s, town.id).counter.customerSpot) >= .15 || a.pendingEnhancement && a.pendingEnhancement.slot === item.slot) return false;
    const request = town.customerService && town.customerService.requests.find(r => r.heroId === a.id && r.itemId === item.id && r.status === 'ready');
    if (!request) return false;
    const price = getPurchasePrice(s, a, item);
    if (price > a.gold) return false;
    if (a.bubble && ['order', 'hammer'].includes(a.bubble.type)) a.bubble = null;
    return settleSale(s, a, item, price, worker);
  }
  // What this hero could buy from the display right now (best first), and whether something wanted was too dear.
  function purchaseOptions(s, a) {
    const t = getTown(s, a.townId), requested = s.orders.filter(o => o.adventurerId === a.id && o.status === 'open').map(o => o.recipeId);
    const potential = t.inventory.filter(item => item.listed && !item.locked && !isCustomerItemReserved(s, item.id) && (!a.pendingEnhancement || item.slot !== a.pendingEnhancement.slot));
    const options = potential.map(item => ({ item, price: getPurchasePrice(s, a, item), score: itemValue(item) * (recipeMap[item.recipeId].type === a.preferredType ? 1.2 : 1) - itemValue(a.equipment[item.slot]) })).filter(v => !requested.includes(v.item.recipeId) && needsItem(a, v.item) && v.price <= a.gold).sort((a, b) => b.score - a.score || a.price - b.price);
    return { options, tooDear: !options.length && potential.some(item => !requested.includes(item.recipeId) && needsItem(a, item) && getPurchasePrice(s, a, item) > a.gold) };
  }
  // Would this visit leave a craft request at the counter? (Same gates as offerOrder, without side effects.)
  const bringsBossRecipe = a => !!(a.bossRecipe && a.bossRecipe.gathered >= a.bossRecipe.needed);
  function mayOfferOrder(s, a) {
    const t = getTown(s, a.townId);
    if (bringsBossRecipe(a) && !s.orders.some(o => o.adventurerId === a.id && o.status === 'open')) return true;
    if (s.rareOrdersOnly) return false;
    return a.visits % 2 === 1 && !(a.orderCooldown > s.time) && !s.orders.some(o => o.adventurerId === a.id && o.status === 'open') && s.orders.filter(o => o.townId === t.id && o.status === 'open').length < 3;
  }
  function attemptPurchase(s, a) {
    if (!a || !s.adventurers.includes(a) || !a.resident || !['visiting', 'returning'].includes(a.status)) return false;
    if (a.invasionId || a.injuryUntil > s.time || hasCustomerRequest(s, a.id)) return false;
    const t = getTown(s, a.townId), worker = salesWorker(t);
    const requested = s.orders.filter(o => o.adventurerId === a.id && o.status === 'open').map(o => o.recipeId);
    const potential = t.inventory.filter(item => item.listed && !item.locked && !isCustomerItemReserved(s, item.id) && (!a.pendingEnhancement || item.slot !== a.pendingEnhancement.slot));
    const options = potential.map(item => ({ item, price: getPurchasePrice(s, a, item), score: itemValue(item) * (recipeMap[item.recipeId].type === a.preferredType ? 1.2 : 1) - itemValue(a.equipment[item.slot]) })).filter(v => !requested.includes(v.item.recipeId) && needsItem(a, v.item) && v.price <= a.gold).sort((a, b) => b.score - a.score || a.price - b.price);
    if (!options.length) {
      if (potential.some(item => !requested.includes(item.recipeId) && needsItem(a, item) && getPurchasePrice(s, a, item) > a.gold)) setSatisfactionBubble(s, a, 'angry');
      return false;
    }
    return settleSale(s, a, options[0].item, options[0].price, worker);
  }
  function orderPayout(o, item) { return Math.round(item.price * (1 + o.basePremium + (qualityRank(item.quality) >= qualityRank(o.bonusQuality) ? o.qualityBonus : 0))); }
  function getOrders(s) { return s.orders.filter(o => o.townId === s.activeTownId && o.status === 'open'); }
  // 2026-11 flow: any matching item in the town can be handed over: storage first, then the display. Locked gear is
  // never offered — a manual lock or the auto-keep rule ("걸작 이상 보관") means "not for sale or requests"; unlock it in
  // the warehouse to hand it over. Items set aside for a counter customer or another request are not offered either.
  // The item made for this request is always a candidate. The payout is capped at the deposit.
  function getOrderCandidates(s, orderId) {
    const o = getOrders(s).find(o => o.id === orderId); if (!o) return [];
    const heldForOthers = new Set(s.orders.filter(x => x !== o && x.status === 'open' && x.reservedItemId).map(x => x.reservedItemId));
    return getTown(s).inventory.filter(i => i.recipeId === o.recipeId && (i.id === o.reservedItemId || (!i.locked && !heldForOthers.has(i.id) && !isCustomerItemReserved(s, i.id))))
      .sort((a, b) => Number(!!a.listed) - Number(!!b.listed));
  }
  function orderReceiveBlock(s, order, item) {
    const hero = s.adventurers.find(a => a.id === order.adventurerId);
    if (!hero) return '의뢰한 모험가가 마을을 떠났습니다.';
    if (hero.invasionId || hero.injuryUntil > s.time) return '마을 방어와 부상 회복이 끝난 뒤 장비를 전달해주세요.';
    if (hero.pendingEnhancement && hero.pendingEnhancement.slot === item.slot) return '중단했던 강화가 끝난 뒤 해당 슬롯의 장비를 전달해주세요.';
    if (hero.status === 'enhancing' && hero.enhancement && hero.enhancement.slot === item.slot) return '해당 장비를 강화 중입니다. 강화가 끝난 뒤 전달해주세요.';
    return '';
  }
  // Hand an item to the requester: equip it, pay the shop from the deposit (capped), return the rest to the hero.
  function deliverOrderItem(s, t, order, item) {
    const hero = s.adventurers.find(a => a.id === order.adventurerId);
    const payout = Math.min(orderPayout(order, item), order.escrow);
    const index = t.inventory.indexOf(item); if (index >= 0) t.inventory.splice(index, 1);
    item.listed = false; item.locked = false; if (order.heirloom) item.heirloom = true; equip(hero, item); hero.gold += order.heirloom ? Math.max(0, Math.min(order.escrow - payout, order.paid ?? 0)) : order.escrow - payout;
    s.gold += payout; s.stats.earned += payout; s.stats.sold++; s.stats.orders++; s.reputation += order.heirloom ? (recipeMap[order.recipeId].bossReputation || 6) : 3;
    if (order.heirloom) { if (!Array.isArray(s.stats.rareCrafted)) s.stats.rareCrafted = []; if (!s.stats.rareCrafted.includes(item.recipeId)) s.stats.rareCrafted.push(item.recipeId); }
    order.status = 'completed'; order.completedAt = s.time; order.itemId = item.id; order.payout = payout; order.escrow = 0; delete order.reservedItemId;
    if (order.heirloom) log(s, 'order-complete', hero.name + '의 전용 장비 ' + item.name + ' 완성! 이제 늘 착용하고 다녀요 · 제작비 +' + payout + ' G', { townId: t.id, adventurerId: hero.id, orderId: order.id, itemId: item.id, recipeId: item.recipeId, gold: payout });
    else log(s, 'order-complete', hero.name + '에게 ' + (item.quality === 'normal' ? '' : DATA.qualities[item.quality].name + ' ') + item.name + ' 전달 · +' + payout + ' G', { townId: t.id, adventurerId: hero.id, orderId: order.id, itemId: item.id, recipeId: item.recipeId, gold: payout });
    operationsHook('reconcile', s); updateGoals(s);
    return payout;
  }
  // Start crafting the requested item right away; the finished piece goes straight to the requester.
  function craftForOrder(s, orderId) {
    const order = getOrders(s).find(o => o.id === orderId);
    if (!order) return result(false, '진행 중인 제작 의뢰를 찾을 수 없습니다.');
    if (order.reservedItemId || getTown(s).queue.some(q => q.orderId === orderId)) return result(false, '이 의뢰의 장비는 이미 제작 중이에요.');
    return craft(s, order.recipeId, undefined, orderId);
  }
  // Settle requests whose item is ready and set aside (the hero was away or hurt when it was finished).
  function settleReadyOrders(s) {
    for (const order of s.orders) {
      if (order.status !== 'open' || !order.reservedItemId) continue;
      const t = getTown(s, order.townId), item = t && t.inventory.find(i => i.id === order.reservedItemId);
      if (!item) { delete order.reservedItemId; continue; }
      if (!orderReceiveBlock(s, order, item)) deliverOrderItem(s, t, order, item);
    }
  }
  function getOrderPayout(s, orderId, itemId) { const o = getOrders(s).find(o => o.id === orderId), item = getOrderCandidates(s, orderId).find(i => i.id === itemId); return o && item ? orderPayout(o, item) : null; }
  function offerOrder(s, a) {
    if (!a || !s.adventurers.includes(a) || !a.resident || !['visiting', 'returning'].includes(a.status)) return false;
    if (a.invasionId || a.injuryUntil > s.time || hasCustomerRequest(s, a.id)) return false;
    const t = getTown(s, a.townId);
    if (s.orders.some(o => o.adventurerId === a.id && o.status === 'open')) return false;
    // A hero holding a boss rare recipe with all its materials gathered asks for their own piece (fee only).
    const held = a.bossRecipe && recipeMap[a.bossRecipe.recipeId];
    if (held && a.bossRecipe.gathered >= a.bossRecipe.needed) {
      // v2: the shop supplies the materials; the reward (about 2.5x their value) is held as the deposit. The hero pays
      // what they can and the rest is the town's bounty for the boss. 30 game days to finish it.
      if (s.orders.length >= 60 && !s.orders.some(o => o.status !== 'open')) return false;
      const fee = Math.max(1, Math.round(held.price * 1.5)), paid = Math.min(Math.max(0, Math.floor(a.gold)), fee);
      a.gold -= paid;
      const order = { id: id(s, 'order'), townId: t.id, adventurerId: a.id, recipeId: held.id, status: 'open', basePremium: .01, bonusQuality: 'normal', qualityBonus: 0, escrow: fee, paid, createdAt: s.time, expiresAt: s.time + 30 * DATA.dayLength, heirloom: true, bossId: a.bossRecipe.bossId };
      s.orders.push(order); a.bossRecipe = null; if (!a.bubble || a.bubble.until <= s.time) a.bubble = { type: 'order', until: s.time + 9 };
      while (s.orders.length > 60) { const old = s.orders.findIndex(o => o.status !== 'open'); if (old < 0) break; s.orders.splice(old, 1); }
      log(s, 'order', a.name + '이(가) 보스 희귀 설계도를 가져왔어요 · ' + held.name + ' 전용 제작 의뢰 · 보수 약 ' + held.price + ' G · 마감 30일', { townId: t.id, adventurerId: a.id, orderId: order.id, recipeId: held.id });
      return true;
    }
    // 2026-11-09 (user decision): once the game turns this on (after the hands-on missions), ordinary heroes no longer place craft requests.
    if (s.rareOrdersOnly) return false;
    if (a.orderCooldown > s.time || s.orders.filter(o => o.townId === t.id && o.status === 'open' && !o.heirloom).length >= 3) return false;
    const recipes = getUnlockedRecipes(s, t.id).filter(r => {
      const current = a.equipment[r.slot]; if (current && current.heirloom) return false; return !current || current.recipeId === 'starter' || current.power < r.power * .9;
    }).sort((x, y) => (y.type === a.preferredType ? 1 : 0) - (x.type === a.preferredType ? 1 : 0) || x.price - y.price);
    for (const r of recipes) {
      const smithLevel = Math.max(1, ...t.staff.filter(w => w.role === 'smith' && w.craftLevel >= getRecipeLevel(r)).map(w => w.craftLevel));
      const bestQuality = DATA.qualityOrder.filter(key => DATA.qualities[key].minCraftLevel <= smithLevel).slice(-1)[0];
      const maxPrice = Math.max(Math.round(r.price * DATA.qualities[bestQuality].multiplier * 1.2), ...t.inventory.filter(i => i.recipeId === r.id).map(i => i.price));
      const escrow = Math.ceil(maxPrice * 1.45);
      if (a.gold < escrow + 20) continue;
      a.gold -= escrow;
      const order = { id: id(s, 'order'), townId: t.id, adventurerId: a.id, recipeId: r.id, status: 'open', basePremium: .25, bonusQuality: 'fine', qualityBonus: .2, escrow, createdAt: s.time, expiresAt: s.time + 600 };
      s.orders.push(order); a.orderCooldown = s.time + 180; if (!a.bubble || a.bubble.until <= s.time) a.bubble = { type: 'order', until: s.time + 7 };
      while (s.orders.length > 60) { const old = s.orders.findIndex(o => o.status !== 'open'); if (old < 0) break; s.orders.splice(old, 1); }
      log(s, 'order', a.name + '의 제작 의뢰 · ' + r.name + ' · 시세 +25%, 우수 이상 +20% 추가', { townId: t.id, adventurerId: a.id, orderId: order.id, recipeId: r.id });
      return true;
    }
    a.orderCooldown = s.time + 35; return false;
  }
  // Tutorial (hands-on guide): one fixed request from a local adventurer for the cheapest gear the shop can make now.
  // The adventurer's deposit is topped up if needed so the request is real (same rules as any request).
  function createTutorialOrder(s) {
    const t = getTown(s); if (!t) return result(false, '운영 중인 마을이 없어요.');
    const r = getUnlockedRecipes(s, t.id).filter(x => !x.bossRecipe && !x.unlockDrop).sort((a, b) => a.price - b.price || getRecipeLevel(a) - getRecipeLevel(b))[0];
    if (!r) return result(false, '만들 수 있는 장비가 없어요.');
    const a = s.adventurers.find(h => h.townId === t.id && h.resident && !h.invasionId && !s.orders.some(o => o.adventurerId === h.id && o.status === 'open'));
    if (!a) return result(false, '부탁할 모험가가 없어요.');
    if (s.orders.length >= 60) { const old = s.orders.findIndex(o => o.status !== 'open'); if (old < 0) return result(false, '의뢰가 너무 많아요.'); s.orders.splice(old, 1); }
    const escrow = Math.ceil(r.price * 1.45);
    if (a.gold < escrow) a.gold = escrow;
    a.gold -= escrow;
    const order = { id: id(s, 'order'), townId: t.id, adventurerId: a.id, recipeId: r.id, status: 'open', basePremium: .25, bonusQuality: 'fine', qualityBonus: .2, escrow, createdAt: s.time, expiresAt: s.time + 9000 };
    s.orders.push(order); a.orderCooldown = s.time + 180;
    log(s, 'order', a.name + '의 제작 의뢰 · ' + r.name + ' · 시세 +25%, 우수 이상 +20% 추가', { townId: t.id, adventurerId: a.id, orderId: order.id, recipeId: r.id });
    return result(true, a.name + '의 부탁이 들어왔어요.', { order, recipe: r, adventurer: a });
  }
  // Tutorial gifts: materials and/or gold handed to the player once, within the normal storage limits.
  function grantTutorialSupplies(s, gift) {
    const materials = gift && gift.materials || {}, gold = Math.max(0, Math.round(gift && gift.gold || 0));
    for (const [m, n] of Object.entries(materials)) if (!known(DATA.materials, m) || !Number.isInteger(n) || n < 0 || n > 10000) return result(false, '잘못된 지원 재료입니다.');
    for (const [m, n] of Object.entries(materials)) s.materials[m] = Math.min(100000000, (s.materials[m] || 0) + n);
    if (gold) s.gold = Math.min(1000000000000, s.gold + gold);
    return result(true, '지원 물품을 받았어요.');
  }
  function fulfillOrder(s, orderId, itemId) {
    const order = getOrders(s).find(o => o.id === orderId);
    if (!order) return result(false, '진행 중인 제작 의뢰를 찾을 수 없습니다.');
    if (order.expiresAt <= s.time) return result(false, '제작 의뢰의 기간이 끝났습니다.');
    const item = getOrderCandidates(s, orderId).find(i => i.id === itemId);
    if (!item) return result(false, '의뢰와 일치하는 장비를 선택해주세요.');
    const blocked = orderReceiveBlock(s, order, item); if (blocked) return result(false, blocked);
    const payout = deliverOrderItem(s, getTown(s), order, item);
    return result(true, '장비를 전달하고 ' + payout + ' G를 받았습니다.', { payout, item });
  }

  // s is optional (research bonus); older callers pass only (item, hero).
  function getEnhancementInfo(item, hero, s) {
    const level = item && item.enhance || 0, maxed = !item || item.recipeId === 'starter' || level >= DATA.enhancement.maxLevel;
    const successRate = maxed ? 0 : Math.min(.98, DATA.enhancement.successRates[level] + personalityEffect(hero, 'enhancementChance') + (s ? researchEffect(s, 'enhanceChance') : 0));
    return { nextLevel: Math.min(DATA.enhancement.maxLevel, level + 1), fee: maxed ? 0 : DATA.enhancement.fees[level], stones: maxed ? 0 : DATA.enhancement.stoneCosts[level], successRate, destructionRate: maxed ? 0 : 1 - successRate, maxed };
  }
  function startEnhancement(s, heroId, slot) {
    const a = s.adventurers.find(a => a.id === heroId);
    if (!a || a.invasionId || a.injuryUntil > s.time || !a.resident || !s.enhancementService || !['visiting', 'returning'].includes(a.status)) return result(false, '마을에 돌아온 모험가가 강화를 이용할 수 있습니다.');
    if (hasCustomerRequest(s, a.id)) return result(false, '주문한 장비를 받은 뒤 강화를 이용합니다.');
    const t = getTown(s, a.townId), f = t.facilities.find(f => f.type === 'enhance' && !f.heroId);
    if (!f) return result(false, '사용 가능한 강화 작업대가 없습니다.');
    const pending = a.pendingEnhancement && (!slot || slot === a.pendingEnhancement.slot) ? a.pendingEnhancement : null;
    if (pending) slot = pending.slot;
    if (!slot) slot = slotIds.filter(key => a.equipment[key] && !getEnhancementInfo(a.equipment[key]).maxed).sort((x, y) => (a.equipment[x].enhance || 0) - (a.equipment[y].enhance || 0))[0];
    if (!slotIds.includes(slot) || !a.equipment[slot]) return result(false, '강화할 장비가 없습니다.');
    const info = getEnhancementInfo(a.equipment[slot], a, s);
    if (info.maxed) return result(false, '이 장비는 더 강화할 수 없습니다.');
    if (!pending && (a.enhancementStones < info.stones || a.gold < info.fee)) return result(false, '모험가의 강화석이나 수수료가 부족합니다.');
    if (a.fatigue >= 75 || a.hp < getCombatStats(a).maxHp * .3) return result(false, '피곤한 모험가는 여관에서 먼저 쉬어야 합니다.');
    const spot = getFacilityWorkSpot(f), path = findPath(t, a, spot);
    if (!path) return result(false, '강화 작업대까지 갈 수 없습니다.');
    f.heroId = a.id; a.checkoutPending = false; a.visitContinuation = false; a.browseSpot = null; a.status = 'enhancing'; a.enhancement = pending ? { ...pending, facilityId: f.id } : { facilityId: f.id, slot, itemId: a.equipment[slot].id, remaining: 3, total: 3, paid: false, fee: info.fee, stones: info.stones, successRate: info.successRate };
    if (pending) a.pendingEnhancement = null;
    clearRoute(a); setDestination(t, a, spot); a.bubble = null;
    return result(true, a.name + '이(가) 강화 작업대로 향합니다.');
  }
  // 2026-11: today's enhancement tally per town (anvil hover card). Resets when the day changes.
  function enhanceToday(s, t) {
    if (!t.enhanceToday || t.enhanceToday.day !== s.day) t.enhanceToday = { day: s.day, ok: 0, fail: 0, fees: 0 };
    return t.enhanceToday;
  }
  // Read-only view of an anvil for the hover card: who is enhancing what right now, the helper, today's results.
  function getEnhanceBench(s, townId, facilityId) {
    const t = getTown(s, townId), f = t && t.facilities.find(x => x.id === facilityId && x.type === 'enhance');
    if (!t || !f) return null;
    const hero = f.heroId && s.adventurers.find(a => a.id === f.heroId), task = hero && hero.enhancement, item = task && hero.equipment[task.slot];
    const speed = operationsHook('getEnhancementMultiplier', s, t, f) || 1, today = t.enhanceToday && t.enhanceToday.day === s.day ? t.enhanceToday : { ok: 0, fail: 0, fees: 0 };
    return {
      user: task && item ? { name: hero.name, item: item.name, from: item.enhance || 0, to: (item.enhance || 0) + 1, successRate: task.successRate, remaining: task.remaining, paid: !!task.paid } : null,
      helper: speed > 1, speed, today: { ok: today.ok, fail: today.fail, fees: today.fees }
    };
  }
  function finishEnhancement(s, a, success) {
    const t = getTown(s, a.townId), task = a.enhancement, f = t.facilities.find(f => f.id === task.facilityId), item = a.equipment[task.slot];
    if (item && item.id === task.itemId) enhanceToday(s, t)[success ? 'ok' : 'fail']++;
    if (success && item && item.id === task.itemId) {
      item.enhance++; item.durability = 100; s.stats.enhanced++; s.reputation++;
      s.stats.maxEnhance = Math.max(s.stats.maxEnhance || 0, item.enhance);
      log(s, 'enhance', a.name + ' · ' + item.name + ' +' + item.enhance + ' 강화 성공!', { townId: t.id, adventurerId: a.id, recipeId: item.recipeId, enhance: item.enhance, gold: task.fee });
    } else if (item && item.id === task.itemId) {
      a.equipment[task.slot] = null; a.hp = Math.min(a.hp, getCombatStats(a).maxHp); s.stats.destroyed++;
      log(s, 'enhance-destroy', a.name + ' · ' + item.name + ' 강화 실패로 파괴! 새 장비를 찾습니다.', { townId: t.id, adventurerId: a.id, recipeId: item.recipeId, slot: task.slot, itemId: item.id, gold: task.fee });
    }
    if (f) { f.active = false; f.heroId = null; }
    a.enhancement = null; a.checkoutPending = false; a.visitContinuation = false; a.status = 'visiting'; a.timer = 2; a.bubble = item && item.id === task.itemId ? {type:success?'heart':'angry',until:s.time+4,source:'enhance'} : null; clearRoute(a); setDestination(t, a, browsingPoint(s, t, a));
  }
  function tickEnhancement(s, a, dt) {
    const t = getTown(s, a.townId), task = a.enhancement, f = task && t.facilities.find(f => f.id === task.facilityId);
    if (!task || !f) { a.status = 'visiting'; a.enhancement = null; a.timer = 1; return; }
    const spot = getFacilityWorkSpot(f), item = a.equipment[task.slot];
    const arrived = moveActor(t, a, dt, 2.7);
    if (!arrived || dist(a, spot) > .08) { f.active = false; a.bubble = null; return; }
    if (!item || item.id !== task.itemId) { f.heroId = null; f.active = false; a.enhancement = null; a.status = 'visiting'; a.timer = 1; return; }
    if (!task.paid) {
      if (a.enhancementStones < task.stones || a.gold < task.fee) { f.heroId = null; a.enhancement = null; a.status = 'visiting'; a.timer = 2; return; }
      a.enhancementStones -= task.stones; a.gold -= task.fee; s.gold += task.fee; s.stats.earned += task.fee; s.stats.enhancementAttempts++; task.paid = true; enhanceToday(s, t).fees += task.fee;
      log(s, 'enhance-start', a.name + ' · 강화석 ' + task.stones + '개 사용 · 수수료 +' + task.fee + ' G', { townId: t.id, adventurerId: a.id, gold: task.fee });
    }
    const speed = operationsHook('getEnhancementMultiplier', s, t, f) || 1;
    f.active = true; a.bubble = { type: 'hammer', until: s.time + .5 }; task.remaining = Math.max(0, task.remaining - dt * speed);
    if (task.remaining <= 1e-7) finishEnhancement(s, a, random(s) < task.successRate);
  }
  // 2026-11 balance: heroes now level up themselves to graduate town by town (no auto-levelled branch
  // newcomers), so the mid/late curve is flatter (was 42 + 24 x level).
  function xpNeeded(a) { return HERO_XP_BASE + a.level * HERO_XP_PER_LEVEL; }
  function chooseRegion(s, a) {
    const p = getPower(a), metadata = townMap[a.townId] || DATA.towns[0];
    const local = DATA.regions.filter(r => metadata.regionIds.includes(r.id) && r.minPower <= p);
    const safe = local.filter(r => r.minPower * REGION_SAFETY_MARGIN <= p);
    const available = safe.length ? safe : local.slice(0, 1);
    const q = activeQuest(s, a);
    if (q && a.bag[q.material] < q.amount) {
      const options = available.filter(r => r.loot[q.material]);
      options.sort((x, y) => (y.loot[q.material][0] + y.loot[q.material][1]) / y.duration - (x.loot[q.material][0] + x.loot[q.material][1]) / x.duration);
      if (options.length) return options[0];
    }
    return available[available.length - 1] || DATA.regions.find(r => metadata.regionIds.includes(r.id)) || DATA.regions[0];
  }
  function beginHunt(s, a) {
    customerHook('cancel', s, a.id, '사냥터로 출발');
    a.checkoutPending = false;
    a.visitContinuation = false;
    const town = getTown(s, a.townId);
    // Departure is part of the village scene. Hunting time and damage begin
    // only after this actor has walked through the front door to the exit.
    a.browseSpot = null; a.regionId = chooseRegion(s, a).id; a.status = 'departing';
    a.timer = 0; a.total = 0; a.huntOutcome = null; a.bubble = null; a.bedId = null;
    clearRoute(a); setDestination(town, a, getTownLayout(s, town.id).exit);
  }
  // --- Migration: residents "graduate" to the next opened town once they can hunt there. ---
  function townOrder(townId) { return DATA.towns.findIndex(t => t.id === townId); }
  function previousTownId(townId) { const i = townOrder(townId); return i > 0 ? DATA.towns[i - 1].id : null; }
  // A resident "graduates" once they can safely clear the hardest ground of their current town.
  function migrationPower(townId) {
    const from = previousTownId(townId); if (!from) return 0;
    const d = townMap[from]; return Math.round(Math.max(...DATA.regions.filter(r => d.regionIds.includes(r.id)).map(r => r.minPower)) * (MIGRATION_POWER_MARGIN[DATA.towns.findIndex(t => t.id === townId)] || 1));
  }
  function readyToMigrate(s, a, townId) {
    return !!a.resident && !a.departed && a.townId === previousTownId(townId) && getPower(a) >= migrationPower(townId);
  }
  function getMigrationReadyCount(s, townId) {
    const from = previousTownId(townId); if (!from) return 0;
    return s.adventurers.filter(a => readyToMigrate(s, a, townId)).length;
  }
  // Why a ready hero cannot move right now ('' = can move).
  function migrationBlock(s, a, nextId) {
    if (a.raidId) return '보스 토벌 중이에요.';
    if (a.missionId || (s.incidents && incidentHook('reserved', s, a.id))) return '돌발 사건 파견대에 있어요.'; // moving broke up the chosen party
    if (a.questId) return '재료 의뢰를 맡고 있어요.';
    if (a.invasionId) return '마을 방어 중이에요.';
    if (a.injuryUntil > s.time) return '부상 회복 중이에요.';
    if (a.enhancement || a.pendingEnhancement) return '장비 강화 중이에요.';
    if (hasCustomerRequest(s, a.id)) return '주문한 장비를 기다리고 있어요.';
    // a hero waiting for their boss rare piece stays until it is delivered (moving expired the commission)
    if (s.orders.some(o => o.status === 'open' && o.heirloom && o.adventurerId === a.id)) return '전용 장비를 기다리고 있어요.';
    if (getResidents(s, nextId).length >= getInnCapacity(s, nextId)) return getTown(s, nextId).name + ' 여관에 빈 침대가 없어요.';
    return '';
  }
  function migrationTarget(s, a) {
    const next = DATA.towns[townOrder(a.townId) + 1];
    if (!next || !getTown(s, next.id) || !readyToMigrate(s, a, next.id)) return null;
    return migrationBlock(s, a, next.id) ? null : next.id;
  }
  // 2026-11-10 사용자: migration is the player's call. Ready heroes are listed (with why some cannot go yet) and the
  // player sends the ones they pick; nobody leaves on their own.
  function getMigrationCandidates(s) {
    const out = [];
    for (const a of s.adventurers) {
      const next = DATA.towns[townOrder(a.townId) + 1];
      if (!next || !getTown(s, next.id) || !readyToMigrate(s, a, next.id)) continue;
      out.push({ id: a.id, name: a.name, level: a.level, power: getPower(a), from: a.townId, fromName: townMap[a.townId].name, to: next.id, toName: townMap[next.id].name, block: migrationBlock(s, a, next.id) });
    }
    return out.sort((x, y) => townOrder(x.from) - townOrder(y.from) || y.power - x.power || x.id.localeCompare(y.id));
  }
  function migrateResidents(s, heroIds) {
    if (!Array.isArray(heroIds) || !heroIds.length) return result(false, '보낼 모험가를 골라 주세요.');
    let moved = 0; const failed = [];
    for (const id of heroIds) { const r = migrateResident(s, id); if (r.ok) moved++; else failed.push(id); }
    if (!moved) return result(false, '지금은 보낼 수 있는 모험가가 없어요.');
    return result(true, moved + '명이 다음 마을로 떠났어요.' + (failed.length ? ' ' + failed.length + '명은 일을 마친 뒤 다시 물어볼게요.' : ''), { moved, failed });
  }
  // Ask once per hero and destination: newly ready heroes are announced together (one event per check).
  function checkMigrationReady(s) {
    if (s.time < (s.migrationCheckAt || 0)) return; s.migrationCheckAt = s.time + 3;
    const fresh = [];
    for (const a of s.adventurers) {
      const next = DATA.towns[townOrder(a.townId) + 1];
      if (!next || !getTown(s, next.id) || !readyToMigrate(s, a, next.id) || a.migrationAsked === next.id) continue;
      a.migrationAsked = next.id; fresh.push(a);
    }
    if (fresh.length) log(s, 'migration-ready', (fresh.length === 1 ? fresh[0].name + '이(가)' : fresh[0].name + ' 외 ' + (fresh.length - 1) + '명이') + ' 다음 마을로 옮겨 갈 만큼 강해졌어요. 보낼까요?', { heroIds: fresh.map(a => a.id), townId: fresh[0].townId });
  }
  function migrateHero(s, a, townId) {
    const from = getTown(s, a.townId), to = getTown(s, townId), layout = getTownLayout(s, townId);
    expireOrdersFor(s, a); customerHook('cancel', s, a.id, '다른 마을로 이주');
    // The hero's open rare-material offers follow them to the new town.
    for (const o of s.rareOffers || []) if (o.heroId === a.id && ['pending', 'open'].includes(o.status)) o.townId = townId;
    clearRoute(a); a.townId = townId; a.x = layout.exit.x; a.y = layout.exit.y;
    a.status = 'traveling'; a.timer = 3; a.total = 3; a.bedId = null; a.browseSpot = null; a.bubble = null; a.huntOutcome = null;
    a.checkoutPending = false; a.visitContinuation = false;
    a.regionId = (DATA.regions.find(r => townMap[townId].regionIds.includes(r.id)) || DATA.regions[0]).id;
    s.stats.migrations = (s.stats.migrations || 0) + 1;
    setDestination(to, a, layout.entrance);
    log(s, 'migration', a.name + ' · ' + from.name + '에서 실력을 쌓아 ' + to.name + '(으)로 이주했습니다 · Lv.' + a.level, { townId, adventurerId: a.id });
  }
  // Public action: move one ready resident to the next opened town now (same rules as automatic migration).
  function migrateResident(s, heroId) {
    const a = s.adventurers.find(h => h.id === heroId);
    if (!a) return result(false, '모험가를 찾을 수 없습니다.');
    const target = migrationTarget(s, a);
    if (!target) { const next = DATA.towns[townOrder(a.townId) + 1], why = next && getTown(s, next.id) && readyToMigrate(s, a, next.id) ? migrationBlock(s, a, next.id) : ''; return result(false, why ? a.name + ': ' + why : '다음 마을이 열려 있고, 이 마을을 졸업할 만큼 강하며, 다음 마을 여관에 빈 침대가 있어야 이주할 수 있습니다.'); }
    migrateHero(s, a, target);
    return result(true, a.name + '이(가) ' + getTown(s, target).name + '(으)로 이주했습니다.', { townId: target });
  }
  function startHuntAtExit(s, a) {
    const t = getTown(s, a.townId), r = chooseRegion(s, a);
    if (dist(a, getTownLayout(s, t.id).exit) >= .06) return;
    a.regionId = r.id; a.status = 'hunting'; a.timer = r.duration * (.94 + random(s) * .12) * personalityEffect(a, 'huntDuration') / Math.max(.3, incidentFactor(s, 'customers', a.townId)); a.total = a.timer;
    a.huntOutcome = null; a.bubble = null; clearRoute(a);
  }
  function returnToTown(s, a, outcome) {
    customerHook('cancel', s, a.id, '마을로 귀환');
    a.checkoutPending = false;
    a.visitContinuation = false;
    const t = getTown(s, a.townId), q = activeQuest(s, a), exit = getTownLayout(s, t.id).exit;
    a.status = 'returning'; a.huntOutcome = outcome; a.timer = 3; a.total = 3; a.x = exit.x; a.y = exit.y; clearRoute(a);
    if (outcome === 'defeat' || outcome === 'retreat') a.bubble = { type: 'bed', until: s.time + 60 };
    else if (q && a.bag[q.material] > 0) a.bubble = { type: 'material', material: q.material, until: s.time + 30 };
    else a.bubble = null;
    setDestination(t, a, browsingPoint(s, t, a));
  }
  function finishHunt(s, a, retreat) {
    const r = regionMap[a.regionId], stats = getCombatStats(a);
    const success = !retreat && random(s) < clamp(.72 + (stats.power / r.minPower - 1) * .16 - a.fatigue * .0015, .3, .96);
    // Seasonal modifiers (winter cold snap: more XP/loot, harsher defeats).
    const season = seasonHook('huntModifiers', s) || { xp: 1, loot: 1, defeatWear: 1 };
    if (success) {
      const rich = random(s) < .16;
      for (const [m, range] of Object.entries(r.loot)) a.bag[m] = Math.min(100000000, a.bag[m] + Math.round((int(s, range[0], range[1]) + (rich ? 1 : 0)) * season.loot));
      a.gold = Math.min(1000000000, a.gold + Math.round(r.gold * (rich ? 1.3 : 1))); a.xp += Math.max(1, Math.round(r.xp * personalityEffect(a, 'adventurerXp') * season.xp * (1 + researchEffect(s, 'huntXp')) * (BRANCH_HERO_XP_MULT[DATA.towns.findIndex(x => x.id === a.townId)] || 1))); a.enhancementStones = Math.min(1000000, a.enhancementStones + int(s, 1, 2) + Math.floor(DATA.regions.indexOf(r) / 2));
      let levels = 0;
      while (a.level < DATA.adventurerMaxLevel && a.xp >= xpNeeded(a)) { a.xp -= xpNeeded(a); a.level++; levels++; a.hp += 8; }
      a.fatigue = Math.min(100, a.fatigue + int(s, 18, 27) * personalityEffect(a, 'huntFatigue')); a.hp = Math.max(1, Math.min(getCombatStats(a).maxHp, a.hp - int(s, 4, 9) - Math.floor(r.minPower / 7)));
      for (const slot of slotIds) if (a.equipment[slot]) a.equipment[slot].durability = Math.max(0, a.equipment[slot].durability - int(s, 5, 10));
      a.hp = Math.min(a.hp, getCombatStats(a).maxHp);
      s.stats.hunts++; s.stats.regions[r.id] = (s.stats.regions[r.id] || 0) + 1;
      const q = activeQuest(s, a); if (q) q.progress = Math.min(q.amount, a.bag[q.material]);
      if (a.bossRecipe && a.bossRecipe.gathered < a.bossRecipe.needed) {
        a.bossRecipe.gathered++;
        if (a.bossRecipe.gathered >= a.bossRecipe.needed) log(s, 'hunt', a.name + ' · ' + recipeMap[a.bossRecipe.recipeId].name + ' 재료를 다 모았어요. 대장간에 제작을 맡기러 와요.', { townId: a.townId, adventurerId: a.id });
      }
      log(s, levels ? 'levelup' : 'hunt', a.name + ' · ' + r.name + ' 사냥 완료 · 강화석 획득' + (levels ? ' · Lv.' + a.level : ''), { townId: a.townId, adventurerId: a.id, regionId: r.id });
      returnToTown(s, a, 'victory');
    } else {
      a.fatigue = Math.max(a.fatigue, retreat ? 78 : 90); a.hp = Math.max(1, Math.min(a.hp, stats.maxHp * (retreat ? .22 : .08)));
      if (!retreat) for (const slot of slotIds) if (a.equipment[slot]) a.equipment[slot].durability = Math.max(0, a.equipment[slot].durability - int(s, DEFEAT_DURABILITY_LOSS[0], DEFEAT_DURABILITY_LOSS[1]) * season.defeatWear);
      s.stats[retreat ? 'retreats' : 'defeats']++;
      log(s, retreat ? 'retreat' : 'defeat', a.name + ' · ' + r.name + (retreat ? '에서 후퇴했습니다. 여관에서 쉬어야 해요.' : '에서 패배했습니다. 여관으로 돌아옵니다.'), { townId: a.townId, adventurerId: a.id, regionId: r.id });
      returnToTown(s, a, retreat ? 'retreat' : 'defeat');
    }
  }
  function expireOrdersFor(s, hero) {
    for (const o of s.orders) if (o.status === 'open' && o.adventurerId === hero.id) { hero.gold += o.heirloom ? Math.min(o.escrow, o.paid ?? o.escrow) : o.escrow; o.escrow = 0; o.status = 'expired'; }
  }
  function beginLeave(s, a, quiet) {
    customerHook('cancel', s, a.id, '마을을 떠남');
    a.checkoutPending = false;
    a.visitContinuation = false;
    const t = getTown(s, a.townId);
    if (a.enhancement) { const f = t.facilities.find(f => f.id === a.enhancement.facilityId); if (f) { f.heroId = null; f.active = false; } a.enhancement = null; }
    const q = activeQuest(s, a); if (q) { q.status = 'open'; q.adventurerId = null; q.progress = 0; a.questId = null; }
    expireOrdersFor(s, a); a.browseSpot = null; a.resident = false; a.status = 'leaving'; a.fatigue = Math.max(a.fatigue, 65); a.bubble = { type: 'bed', until: s.time + 120 }; a.bedId = null; clearRoute(a); setDestination(t, a, getTownLayout(s, t.id).exit);
    if (!quiet) log(s, 'no-bed', a.name + ' · 여관에 빈 침대가 없어 피곤한 채 다른 마을로 떠납니다.', { townId: t.id, adventurerId: a.id });
  }
  function beginRest(s, a) {
    customerHook('cancel', s, a.id, '여관에서 휴식');
    a.checkoutPending = false;
    a.visitContinuation = false;
    const t = getTown(s, a.townId), residents = getResidents(s, t.id), index = residents.findIndex(h => h.id === a.id), beds = getTownLayout(s, t.id).inn.beds;
    if (!a.resident || index < 0 || index >= beds.length) { beginLeave(s, a); return; }
    const bed = beds[index]; a.browseSpot = null; a.status = 'resting'; a.bedId = bed.id; a.timer = 8; a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'bed', until: s.time + 120 }; clearRoute(a); setDestination(t, a, bed);
  }
  function setSatisfactionBubble(s, a, type) {
    if (a.injuryUntil > s.time || a.invasionId) return;
    if (a.bubble && a.bubble.until > s.time && (a.bubble.source==='enhance'||['bed', 'incapacitated', 'combat', 'material', 'hammer'].includes(a.bubble.type))) return;
    a.bubble = { type, until: s.time + 3 };
  }
  function finishVisit(s, a) {
    a.checkoutPending = false;
    if (startEnhancement(s, a.id).ok) return;
    if (a.fatigue >= 50 || a.hp <= getCombatStats(a).maxHp * .6) beginRest(s, a);
    else beginHunt(s, a);
  }
  function onCustomerDone(s, a, reason) {
    if (!a || !s.adventurers.includes(a) || a.invasionId || !['visiting', 'returning'].includes(a.status)) return;
    a.checkoutPending = false; a.status = 'visiting';
    if (a.injuryUntil > s.time || a.fatigue >= 70 || a.hp <= getCombatStats(a).maxHp * .35) { beginRest(s, a); return; }
    if (!a.bubble || a.bubble.type !== 'heart') { a.bubble = null; setSatisfactionBubble(s, a, 'angry'); }
    a.visitContinuation = true; a.timer = 3;
  }
  function visit(s, a) {
    a.visits++; handleQuests(s, a);
    if (a.injuryUntil > s.time || a.fatigue >= 70 || a.hp <= getCombatStats(a).maxHp * .35 || ['defeat', 'retreat'].includes(a.huntOutcome)) { a.huntOutcome = null; beginRest(s, a); return; }
    // Shoppers browse on the sales floor, then pay at the front of the counter.
    // Public attemptPurchase remains an immediate action for UI/tool callers.
    // Someone with nothing to buy and no request to leave goes straight back out (no pointless walk to the counter).
    if (!hasCustomerRequest(s, a.id)) { const plan = purchaseOptions(s, a); if (!plan.options.length && !mayOfferOrder(s, a)) { if (plan.tooDear) setSatisfactionBubble(s, a, 'angry'); finishVisit(s, a); return; } }
    a.checkoutPending = true; a.timer = 0;
    setDestination(getTown(s, a.townId), a, getTownLayout(s, a.townId).counter.customerSpot);
  }
  function completeVisit(s, a) {
    a.checkoutPending = false;
    attemptPurchase(s, a);
    if (a.visits % 2 === 1 || bringsBossRecipe(a)) offerOrder(s, a);
    if (a.bubble && ['heart', 'angry'].includes(a.bubble.type) && a.bubble.until > s.time) { a.visitContinuation = true; a.timer = 3; return; }
    finishVisit(s, a);
  }
  function tickHero(s, a, dt) {
    const t = getTown(s, a.townId);
    if (a.injuryUntil > s.time && a.status !== 'resting') { beginRest(s, a); return; }
    if (a.bubble && a.bubble.until <= s.time) a.bubble = null;
    if (hasCustomerRequest(s, a.id)) {
      setDestination(t, a, getTownLayout(s, t.id).counter.customerSpot);
      const outsideReturning=a.status==='returning'&&a.y>=getTownLayout(s,t.id).entrance.y+1; // slow only outside the exit nook
      moveActor(t, a, dt, outsideReturning ? ROAD_WALK_SPEED : 2.8); a.timer = 0;
      const request = t.customerService.requests.find(r => r.heroId === a.id);
      a.bubble = { type: request && request.reason === 'crafting' ? 'hammer' : 'order', until: s.time + 1 };
      return;
    }
    if (a.status === 'departing') {
      setDestination(t, a, getTownLayout(s, t.id).exit);
      const entrance=getTownLayout(s,t.id).entrance;
      if (moveActor(t, a, dt, a.y >= entrance.y + 1 ? ROAD_WALK_SPEED : 2.8)) startHuntAtExit(s, a);
      return;
    }
    if (a.status === 'hunting') {
      a.moving = false; a.timer = Math.max(0, a.timer - dt);
      const r = regionMap[a.regionId]; a.hp = Math.max(1, a.hp - dt * (.1 + r.minPower / Math.max(1, getPower(a)) * .18));
      if (a.hp <= getCombatStats(a).maxHp * .15 || a.fatigue >= 95) finishHunt(s, a, true);
      else if (a.timer <= 1e-7) finishHunt(s, a, false);
      return;
    }
    if (a.status === 'enhancing') { tickEnhancement(s, a, dt); return; }
    if (a.status === 'leaving') {
      const entrance=getTownLayout(s,t.id).entrance;
      if (moveActor(t, a, dt, a.y >= entrance.y + 1 ? ROAD_WALK_SPEED : 2.6)) { a.departed = true; s.stats.departures++; }
      return;
    }
    if (a.status === 'traveling') {
      const entrance=getTownLayout(s,t.id).entrance;
      if (!moveActor(t, a, dt, a.y >= entrance.y + 1 ? ROAD_WALK_SPEED : 2.8)) return;
      if (!a.resident) {
        if (campaignHook('isTownBlocked', s, t.id)) { a.bubble = { type: 'combat', until: s.time + 1 }; return; }
        if (getResidents(s, t.id).length < getInnCapacity(s, t.id)) { a.resident = true; a.fatigue = 30; s.stats.arrivals++; }
        else { beginLeave(s, a); return; }
      }
      a.status = 'visiting'; a.timer = 2; clearRoute(a); setDestination(t, a, browsingPoint(s, t, a));
      return;
    }
    if (a.status === 'resting') {
      const residents = getResidents(s, t.id), index = residents.findIndex(h => h.id === a.id);
      if (!a.resident || index < 0) { beginLeave(s, a); return; }
      a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'bed', until: s.time + 1 };
      // Re-route old indoor bed destinations to the single public entrance.
      setDestination(t, a, getTownLayout(s, t.id).inn.entrance);
      if (!moveActor(t, a, dt, 2.5)) return;
      const maxHp = getCombatStats(a).maxHp, speed = (operationsHook('getRestMultiplier', s, t, a) || 1) * (1 + researchEffect(s, 'restSpeed'));
      a.fatigue = Math.max(0, a.fatigue - dt * 6 * speed); a.hp = Math.min(maxHp, a.hp + dt * Math.max(8, maxHp * .06) * speed); a.timer = Math.max(0, a.timer - dt * speed);
      if (a.injuryUntil > s.time && speed > 1) a.injuryUntil = Math.max(s.time, a.injuryUntil - dt * (speed - 1));
      if (a.injuryUntil <= s.time && a.fatigue <= 15 && a.hp >= maxHp * .95 && a.timer <= 1e-7) { a.bedId = null; a.status = 'visiting'; a.timer = 2; a.bubble = null; clearRoute(a); setDestination(t, a, browsingPoint(s, t, a)); }
      return;
    }
    // Back from the hunting grounds: walk the road from the town exit to the forge door first (the village picture and
    // the world map show this walk), instead of waiting at the exit and then rushing in at indoor pace.
    if (a.status === 'returning' && !a.destination && a.y > getTownLayout(s, t.id).entrance.y + .06) setDestination(t, a, getTownLayout(s, t.id).entrance);
    const outsideReturning=a.status==='returning'&&a.y>=getTownLayout(s,t.id).entrance.y+1; // slow only outside the exit nook
    if (!moveActor(t, a, dt, outsideReturning ? ROAD_WALK_SPEED : 2.8)) return;
    a.timer = Math.max(0, a.timer - dt);
    if (a.timer > 1e-7) return;
    if (a.status === 'returning') {
      handleQuests(s, a);
      if (a.fatigue >= 70 || a.hp < getCombatStats(a).maxHp * .35 || ['retreat', 'defeat'].includes(a.huntOutcome)) { a.huntOutcome = null; beginRest(s, a); }
      else { a.status = 'visiting'; a.timer = 2; }
    } else if (a.checkoutPending) completeVisit(s, a);
    else if (a.visitContinuation) { a.visitContinuation = false; finishVisit(s, a); }
    else visit(s, a);
  }
  function tickArrivals(s, t, dt) {
    if (campaignHook('isTownBlocked', s, t.id)) return;
    // Only the first town receives newcomers; branch towns grow through migration.
    if (townOrder(t.id) > 0) return;
    t.arrivalTimer = Math.max(0, t.arrivalTimer - dt);
    if (t.arrivalTimer > 1e-7) return;
    const free = getResidents(s, t.id).length < getInnCapacity(s, t.id), candidates = roster().filter(p => !s.adventurers.some(a => a.id === p.id));
    const otherVacancy = getOwnedTowns(s).some(other => other.id !== t.id && getResidents(s, other.id).length < getInnCapacity(s, other.id));
    if (candidates.length && (free || !otherVacancy && !s.adventurers.some(a => a.townId === t.id && !a.resident))) {
      const a = createHero(s, t, campaignHook('pickRecruit', s, candidates) || candidates[0], free);
      if (free) { s.stats.arrivals++; log(s, 'arrival', a.name + ' · ' + a.job + ' · ' + t.name + '의 새 모험가가 되었습니다.', { townId: t.id, adventurerId: a.id }); }
    }
    t.arrivalTimer = free ? 12 : 55;
  }
  function getBranchRequirements(s, townId) {
    const d = known(townMap, townId) ? townMap[townId] : null;
    if (!d) return { ok: false, opened: false, cost: 0, message: '알 수 없는 마을입니다.', conditions: [] };
    const opened = !!getTown(s, townId), currentLevel = Math.max(...getOwnedTowns(s).map(t => t.level)), conditions = [
      { label: '대장간 ' + d.requiredLevel + '단계', met: currentLevel >= d.requiredLevel },
      { label: '평판 ' + d.requiredReputation, met: s.reputation >= d.requiredReputation },
      { label: d.openingCost + ' G', met: s.gold >= d.openingCost }
    ];
    const index = DATA.towns.findIndex(t => t.id === townId);
    let migrationReady = 0, migrationPowerNeeded = 0;
    if (index > 0) {
      const previous = DATA.towns[index - 1];
      migrationReady = getMigrationReadyCount(s, townId); migrationPowerNeeded = migrationPower(townId);
      conditions.push({ label: previous.name + ' 이주 준비 모험가 ' + Math.min(migrationReady, MIGRATION_READY_FOR_BRANCH) + '/' + MIGRATION_READY_FOR_BRANCH + '명 (전투력 ' + migrationPowerNeeded + ' 이상)', met: migrationReady >= MIGRATION_READY_FOR_BRANCH });
      conditions.unshift({ label: previous.name + ' 지점 개점', met: !!getTown(s, previous.id) });
    }
    const ok = !opened && conditions.every(c => c.met);
    return { ok, opened, cost: d.openingCost, requiredLevel: d.requiredLevel, requiredReputation: d.requiredReputation, currentLevel, reputation: s.reputation, migrationReady, migrationRequired: index > 0 ? MIGRATION_READY_FOR_BRANCH : 0, migrationPower: migrationPowerNeeded, conditions, message: opened ? '이미 운영 중인 지점입니다.' : ok ? '새 지점을 열 수 있습니다.' : '개점 조건을 먼저 충족해주세요.' };
  }
  function openBranch(s, townId) {
    const check = getBranchRequirements(s, townId); if (!check.ok) return result(false, check.message);
    const t = createTown(s, townId); s.gold -= check.cost; s.towns[townId] = t;
    warehouseHook('init', s); operationsHook('init', s); customerHook('init', s); recruitmentHook('initialize', s, 0);
    // Branch towns are populated by residents who graduate from the previous town (see migrationTarget).
    const branchNumber = getOwnedTowns(s).length, previous = DATA.towns[townOrder(townId) - 1];
    log(s, 'branch', t.name + '에 ' + branchNumber + '호점 개점! ' + (previous ? previous.name + '에서 실력을 쌓은 모험가들이 이주해 옵니다.' : '새 화덕·진열대·강화대와 직원이 준비되었습니다.'), { townId, gold: -check.cost });
    updateGoals(s); return result(true, t.name + '에 ' + branchNumber + '호점을 열었습니다.', { town: t, cost: check.cost });
  }
  function switchTown(s, townId) { if (!getTown(s, townId)) return result(false, '운영 중인 마을을 선택해주세요.'); s.activeTownId = townId; return result(true, getTown(s).name + '으로 이동했습니다.'); }
  function getNextGoal(s) {
    const g = goalDefinitions.find(g => !s.completedGoals.includes(g.id));
    return g ? { id: g.id, title: g.title, description: g.description, progress: Math.min(g.target, g.value(s)), target: g.target, reward: g.reward, complete: false } : { id: 'complete', title: '전설의 대장간', description: '모든 목표를 달성했습니다. 여러 마을의 대장간을 계속 키워보세요.', progress: 1, target: 1, reward: 0, complete: true };
  }
  function updateGoals(s) {
    if (s.questBook && s.questBook.enabled) return; // growth quests took over the old goal list (no double rewards)
    for (const g of goalDefinitions) if (!s.completedGoals.includes(g.id) && g.value(s) >= g.target) {
      s.completedGoals.push(g.id); s.gold += g.reward; s.reputation += 2;
      log(s, 'goal', '목표 달성 · ' + g.title + ' · +' + g.reward + ' G', { gold: g.reward, goalId: g.id });
    }
  }
  function tick(s, dt) {
    s.time += dt; s.day = Math.floor(s.time / DATA.dayLength) + 1; s.gatherCooldown = Math.max(0, s.gatherCooldown - dt);
    progressionHook('step', s, dt); seasonHook('step', s, dt); incidentHook('step', s, dt);
    campaignHook('step', s, dt);
    customerHook('step', s, dt);
    operationsHook('step', s, dt);
    for (const o of s.orders) if (o.status === 'open' && o.expiresAt <= s.time) {
      // v2: an unmade boss piece past its 30 days — the hero is let down, the recipe is gone, reputation −5.
      // A piece already on the furnace keeps going (it is delivered when done).
      const making = o.heirloom && getTown(s, o.townId)?.queue.some(q => q.orderId === o.id);
      if (making) continue;
      const hero = s.adventurers.find(a => a.id === o.adventurerId); if (hero) hero.gold += o.heirloom ? Math.min(o.escrow, o.paid ?? o.escrow) : o.escrow;
      if (o.heirloom) s.reputation = Math.max(0, s.reputation - 5);
      if (o.reservedItemId) { const item = getTown(s, o.townId)?.inventory.find(i => i.id === o.reservedItemId); if (item) item.locked = false; delete o.reservedItemId; }
      o.escrow = 0; o.status = 'expired';
      log(s, 'order-expired', o.heirloom ? (hero ? hero.name : '모험가') + '이(가) 전용 장비를 기다리다 실망했어요 · 희귀 설계도가 사라졌어요 · 명성 −5' : '제작 의뢰의 기간이 끝나 모험가에게 예치금을 돌려주었습니다.', { townId: o.townId, orderId: o.id });
    }
    settleReadyOrders(s);
    checkMigrationReady(s);
    for (const t of getOwnedTowns(s)) { tickStaff(s, t, dt); operationsHook('tickSupportStaff', s, t, dt); tickArrivals(s, t, dt); }
    for (const a of s.adventurers) if (!a.raidId && !a.invasionId && !a.missionId) tickHero(s, a, dt);
    for (const a of s.adventurers) if (a.missionId) { a.timer = Math.max(0, (a.timer || 0) - dt); a.moving = false; }
    raidHook('step', s, dt);
    questHook('step', s);
    s.adventurers = s.adventurers.filter(a => !a.departed);
    operationsHook('reconcile', s);
    updateGoals(s);
  }
  function step(s, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return s;
    let left = Math.min(dt, 3600);
    while (left > 1e-9) { const slice = Math.min(.25, left); tick(s, slice); left -= slice; }
    return s;
  }

  function validBag(bag) { return object(bag) && materialIds.every(m => integer(bag[m], 0, 100000000)) && Object.keys(bag).every(m => known(DATA.materials, m)); }
  function safeId(value) { return typeof value === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(value); }
  function validPoint(p) { return object(p) && finite(p.x, -100, 500) && finite(p.y, -100, 500); }
  function validMotion(a) { return validPoint(a) && typeof a.moving === 'boolean' && Array.isArray(a.path) && a.path.length <= 2000 && a.path.every(validPoint) && (a.destination === null || validPoint(a.destination)); }
  function validBubble(b, time) { return b === null || object(b) && ['material', 'hammer', 'bed', 'order', 'combat', 'book', 'heart', 'angry', 'incapacitated'].includes(b.type) && finite(b.until, 0, time + 10000) && (b.type !== 'material' || known(DATA.materials, b.material)); }
  // The number of the check that last rejected a state (shown with a failed save so the cause can be found).
  let lastInvalid = null;
  function invalid(n) { lastInvalid = n; return false; }
  function validateState(s) {
    lastInvalid = null;
    try {
      if (s.unlockedDrops!==undefined && (!Array.isArray(s.unlockedDrops)||new Set(s.unlockedDrops).size!==s.unlockedDrops.length||s.unlockedDrops.some(id=>!recipeMap[id]?.unlockDrop))) return invalid(1);
      if (!object(s) || s.version !== VERSION || !finite(s.time, 0, 1000000000) || !integer(s.day, 1, 10000000) || s.day !== Math.floor(s.time / DATA.dayLength) + 1) return invalid(2);
      if (!integer(s.gold, 0, 1000000000000) || !integer(s.reputation, 0, 1000000000) || !integer(s.rng, 0, 4294967295) || !integer(s.seq, 0, Number.MAX_SAFE_INTEGER - 100000) || !validBag(s.materials)) return invalid(3);
      if (!object(s.towns) || !Object.keys(s.towns).length || Object.keys(s.towns).length > DATA.towns.length || Object.keys(s.towns).some(k => !known(townMap, k)) || !known(s.towns, s.activeTownId)) return invalid(4);
      if (!finite(s.gatherCooldown, 0, 45) || typeof s.enhancementService !== 'boolean') return invalid(5);
      const ids = new Set(), heroIds = new Set(), facilityIds = new Set(), staffIds = new Set(), allowedHeroes = new Set(roster().map(a => a.id));
      function unique(v) { if (!safeId(v) || ids.has(v)) return invalid(6); ids.add(v); return true; }
      function validItem(item, expectedSlot, allowStarter) {
        if (!object(item) || !unique(item.id) || !slotIds.includes(item.slot) || expectedSlot && item.slot !== expectedSlot || !known(DATA.qualities, item.quality) || !integer(item.power, 1, 100000) || !integer(item.price, 1, 10000000) || typeof item.listed !== 'boolean' || typeof item.locked !== 'boolean' || !integer(item.enhance, 0, DATA.enhancement.maxLevel) || !finite(item.durability, 0, 100) || typeof item.name !== 'string' || item.name.length > 80) return invalid(7);
        if (item.autoProtected !== undefined && item.autoProtected !== true) return invalid(8);
        if (progressionHook('validateOptions', item) === false) return invalid(9);
        if (item.recipeId === 'starter') return !!allowStarter && item.slot === 'weapon';
        return known(recipeMap, item.recipeId) && recipeMap[item.recipeId].slot === item.slot;
      }
      for (const [key, t] of Object.entries(s.towns)) {
        if (!object(t) || t.id !== key || typeof t.name !== 'string' || t.name.length > 80 || !integer(t.level, 1, 5) || (t.layoutVersion === undefined ? t.width !== 18 + (t.level - 1) * 4 || t.height !== 12 + (t.level - 1) * 2 : !((t.width === shopLayout().BASE_WIDTH && t.height === 12 + (t.retailExtraDepth || 0)) || (t.width === shopLayout().BASE_WIDTH + (t.level - 1) * 4 && t.height === 12 + (t.level - 1) * 2 + (t.retailExtraDepth || 0)))) || !integer(t.innLevel, 1, t.innVersion === 2 ? 5 : 48) || (t.innVersion !== undefined && t.innVersion !== 2) || (t.innVersion === 2 && (!integer(t.innLegacyCapacity, 0, 100) || !integer(t.innLayoutHeight, 8, 10))) || !finite(t.arrivalTimer, 0, 10000)) return invalid(10);
        if (t.layoutVersion === undefined && (t.workshopExtraDepth !== undefined || t.retailExtraDepth !== undefined)) return invalid(11);
        if (t.layoutVersion !== undefined && (t.layoutVersion !== shopLayout().VERSION || !integer(t.workshopExtraDepth, 0, 30) || t.workshopExtraDepth % 3 !== 0 || !integer(t.retailExtraDepth, 0, 12) || t.retailExtraDepth % 2 !== 0)) return invalid(12);
        if (!Array.isArray(t.facilities) || !t.facilities.length || t.facilities.length > 50 || !Array.isArray(t.staff) || t.staff.length > 30) return invalid(13);
        for (const f of t.facilities) {
          if (!object(f) || (f.grade !== undefined && (f.type !== 'furnace' || !integer(f.grade,1,3))) || !unique(f.id) || !known(DATA.facilityTypes, f.type) || !integer(f.x, 1, t.width - 2) || !integer(f.y, -80, t.height - 3) || !((f.w === DATA.facilityTypes[f.type].w && f.h === DATA.facilityTypes[f.type].h) || (t.layoutVersion === undefined && f.type === 'display' && f.w === 3 && f.h === 1)) || typeof f.active !== 'boolean' || ![f.taskId, f.staffId, f.heroId].every(v => v === null || safeId(v))) return invalid(14);
          if (t.layoutVersion === undefined ? f.y < 1 || f.x + f.w > t.width - 1 || f.y + f.h > t.height - 2 : !shopLayout().facilityRegion(t, f)) return invalid(15);
          facilityIds.add(f.id);
          if (t.facilities.some(o => o !== f && f.x < o.x + o.w && f.x + f.w > o.x && f.y < o.y + o.h && f.y + f.h > o.y)) return invalid(16);
        }
        if (!Array.isArray(t.inventory) || !Array.isArray(t.queue) || t.inventory.length + t.queue.length > 2000 || getDisplayedItems(s, t.id).length > getStockCapacity(s, t.id) || t.queue.length > getQueueCapacity(s, t.id)) return invalid(17);
        for (const item of t.inventory) if (!validItem(item, null, false)) return invalid(18);
        for (const q of t.queue) {
          if (!object(q) || (q.participants!==undefined && (!Array.isArray(q.participants)||q.participants.length>30||new Set(q.participants).size!==q.participants.length||q.participants.some(id=>!safeId(id)))) || !unique(q.id) || q.townId !== t.id || !known(recipeMap, q.recipeId) || !finite(q.total, .1, 4000) || !finite(q.remaining, 0, q.total) || !t.facilities.some(f => f.id === q.facilityId && f.type === 'furnace') || !['waiting', 'working', 'paused'].includes(q.status) || q.staffId !== null && !safeId(q.staffId)) return invalid(19);
        }
        for (const f of t.facilities) if (t.queue.filter(q => q.facilityId === f.id).length > 3) return invalid(20);
        for (const w of t.staff) {
          if (!object(w) || (w.potentialGrade!==undefined && !Object.hasOwn(potentialFactors,w.potentialGrade)) || !unique(w.id) || typeof w.name !== 'string' || w.name.length > 80 || !known(staffRoleNames, w.role) || !['idle', 'walking', 'working', 'selling', 'resting', 'training'].includes(w.status) || !integer(w.craftLevel, 1, 30) || !integer(w.craftXp, 0, 1000000) || !finite(w.dexterity, 0, 100) || !finite(w.eloquence, 0, 100) || !finite(w.craftSkill, 0, 100) || !finite(w.salesSkill, 0, 100) || !finite(w.maxStamina, 1, 1000) || !finite(w.stamina, 0, w.maxStamina) || !validMotion(w) || !validBubble(w.bubble, s.time)) return invalid(21);
          if (w.assistSlot !== undefined && (!integer(w.assistSlot,0,1) || w.role !== 'smith' || !t.facilities.some(f=>f.id===w.facilityId && f.type==='furnace' && w.assistSlot<(f.grade||1)-1) || t.staff.some(other=>other!==w && other.facilityId===w.facilityId && other.assistSlot===w.assistSlot))) return invalid(22);
          if (![w.facilityId, w.assignedFacilityId].every(v => v === null || t.facilities.some(f => f.id === v))) return invalid(23);
          if (w.counterSlot !== undefined && w.counterSlot !== null && (!integer(w.counterSlot, 0, 1) || w.role !== 'sales')) return invalid(24);
          staffIds.add(w.id);
        }
        for (const q of t.queue) if (q.staffId && !t.staff.some(w => w.id === q.staffId && w.role === 'smith' && w.facilityId === q.facilityId)) return invalid(25);
        for (const f of t.facilities) {
          if (f.staffId && !t.staff.some(w => w.id === f.staffId && w.facilityId === f.id)) return invalid(26);
          if (f.taskId && !t.queue.some(q => q.id === f.taskId && q.facilityId === f.id)) return invalid(27);
          if (f.type === 'furnace' && f.active && !t.staff.some(w => w.id === f.staffId && w.status === 'working' && w.stamina > 0 && dist(w, getFacilityWorkSpot(f)) < .08 && t.queue.some(q => q.id === f.taskId && q.staffId === w.id && q.status === 'working'))) return invalid(28);
        }
      }
      if (!Array.isArray(s.adventurers) || s.adventurers.length > 200) return invalid(29);
      for (const a of s.adventurers) {
        if (!object(a) || (a.potentialGrade!==undefined && !Object.hasOwn(potentialFactors,a.potentialGrade)) || !unique(a.id) || !allowedHeroes.has(a.id) || !known(s.towns, a.townId) || typeof a.resident !== 'boolean' || typeof a.name !== 'string' || a.name.length > 40 || typeof a.job !== 'string' || a.job.length > 40 || typeof a.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(a.color)) return invalid(30);
        if (!integer(a.level, 1, DATA.adventurerMaxLevel) || !integer(a.xp, 0, 1000000000) || !integer(a.gold, 0, 1000000000) || !heroStatuses.includes(a.status) || !finite(a.timer, 0, 10000) || !finite(a.total, 0, 10000) || !known(regionMap, a.regionId) || !finite(a.discount, 0, .5) || !validBag(a.bag) || !integer(a.visits, 0, 1000000000) || !finite(a.fatigue, 0, 100) || !integer(a.enhancementStones, 0, 1000000) || !finite(a.orderCooldown, 0, s.time + 10000) || !validMotion(a) || !validBubble(a.bubble, s.time)) return invalid(31);
        if (!object(a.baseStats) || !integer(a.baseStats.attack, 1, 100000) || !integer(a.baseStats.defense, 0, 100000) || !integer(a.baseStats.maxHp, 1, 1000000) || !finite(a.hp, 0, getCombatStats(a).maxHp + 1e-6)) return invalid(32);
        if (a.bossRecipe !== null && (!object(a.bossRecipe) || !known(recipeMap, a.bossRecipe.recipeId) || !recipeMap[a.bossRecipe.recipeId].bossRecipe || typeof a.bossRecipe.bossId !== 'string' || !integer(a.bossRecipe.needed, 1, 10) || !integer(a.bossRecipe.gathered, 0, a.bossRecipe.needed))) return invalid(92);
        if (!object(a.equipment) || Object.keys(a.equipment).length !== 4 || !slotIds.every(slot => a.equipment[slot] === null || validItem(a.equipment[slot], slot, true))) return invalid(33);
        if (a.questId !== null && !safeId(a.questId)) return invalid(34);
        if (a.browseSpot != null && !validPoint(a.browseSpot)) return invalid(35);
        if (a.checkoutPending !== undefined && typeof a.checkoutPending !== 'boolean') return invalid(36);
        if (a.status === 'departing' && (!a.resident || a.raidId || a.checkoutPending || a.timer !== 0 || a.total !== 0)) return invalid(37);
        if (a.bedId !== null && !getTownLayout(s, a.townId).inn.beds.some(b => b.id === a.bedId)) return invalid(38);
        if (a.sprite !== undefined && !integer(a.sprite, 0, 1000) || a.visualId !== undefined && (typeof a.visualId !== 'string' || !/^npc_\d{3}$/.test(a.visualId))) return invalid(39);
        if (a.status === 'enhancing') {
          const e = a.enhancement, f = e && getTown(s, a.townId).facilities.find(f => f.id === e.facilityId);
          if (!object(e) || !f || f.type !== 'enhance' || f.heroId !== a.id || !slotIds.includes(e.slot) || !a.equipment[e.slot] || a.equipment[e.slot].id !== e.itemId || a.equipment[e.slot].recipeId === 'starter' || a.equipment[e.slot].enhance >= DATA.enhancement.maxLevel || !finite(e.remaining, 0, 3) || e.total !== 3 || typeof e.paid !== 'boolean' || !integer(e.fee, 1, 10000) || !integer(e.stones, 1, 100) || !finite(e.successRate, 0, 1)) return invalid(40);
        } else if (a.enhancement !== null) return invalid(41);
        heroIds.add(a.id);
      }
      for (const t of getOwnedTowns(s)) {
        if (getResidents(s, t.id).length > Math.max(getInnCapacity(s, t.id), t.innVersion === 2 ? t.innLegacyCapacity : 0)) return invalid(42);
        for (const f of t.facilities) if (f.heroId && !s.adventurers.some(a => a.id === f.heroId && a.townId === t.id && a.status === 'enhancing' && a.enhancement.facilityId === f.id)) return invalid(43);
      }
      if (s.festival && Array.isArray(s.festival.entries)) for (const entry of s.festival.entries) {
        if (!object(entry) || !unique(entry.id) || !validItem(entry.item, null, false)) return invalid(44);
      }
      if (!Array.isArray(s.quests) || s.quests.length > 48) return invalid(45);
      for (const t of getOwnedTowns(s)) if (s.quests.filter(q => q.townId === t.id && q.status !== 'completed').length > 3) return invalid(46);
      for (const q of s.quests) {
        if (!object(q) || !unique(q.id) || !known(s.towns, q.townId) || !known(DATA.materials, q.material) || !integer(q.amount, 1, 10000) || !integer(q.reward, 0, 10000000) || !finite(q.discount, 0, .5) || !['open', 'active', 'completed'].includes(q.status) || !integer(q.progress, 0, q.amount) || !finite(q.createdAt, 0, s.time)) return invalid(47);
        if (q.status === 'open' && q.adventurerId !== null || q.status !== 'open' && !safeId(q.adventurerId)) return invalid(48);
        if (q.status === 'completed' && (!finite(q.completedAt, q.createdAt, s.time) || q.progress !== q.amount) || q.status !== 'completed' && q.completedAt !== null) return invalid(49);
        if (q.status === 'active' && !s.adventurers.some(a => a.id === q.adventurerId && a.questId === q.id && a.townId === q.townId)) return invalid(50);
      }
      for (const a of s.adventurers) if (a.questId !== null && !s.quests.some(q => q.id === a.questId && q.status === 'active' && q.adventurerId === a.id)) return invalid(51);
      if (!Array.isArray(s.orders) || s.orders.length > 60) return invalid(52);
      for (const o of s.orders) {
        if (!object(o) || !unique(o.id) || !known(s.towns, o.townId) || !safeId(o.adventurerId) || !known(recipeMap, o.recipeId) || !['open', 'completed', 'expired'].includes(o.status) || !finite(o.basePremium, .01, 2) || !known(DATA.qualities, o.bonusQuality) || !finite(o.qualityBonus, 0, 2) || !integer(o.escrow, 0, 100000000) || !finite(o.createdAt, 0, s.time) || !finite(o.expiresAt, o.createdAt, s.time + 10000)) return invalid(53);
        if (o.status === 'open' && (!heroIds.has(o.adventurerId) || o.escrow <= 0) || o.status !== 'open' && o.escrow !== 0) return invalid(54);
        if (o.status === 'completed' && (!safeId(o.itemId) || !integer(o.payout, 1, 100000000) || !finite(o.completedAt, o.createdAt, s.time))) return invalid(55);
        if (o.heirloom !== undefined && (o.heirloom !== true || !recipeMap[o.recipeId].bossRecipe)) return invalid(90);
        if (o.heirloom === undefined && recipeMap[o.recipeId].bossRecipe) return invalid(91);
      }
      const counters = ['crafted', 'sold', 'enhanced', 'enhancementAttempts', 'destroyed', 'quests', 'orders', 'earned', 'hunts', 'defeats', 'retreats', 'repaired', 'arrivals', 'departures'];
      if (!object(s.stats) || !counters.every(k => integer(s.stats[k], 0, 1000000000000)) || !object(s.stats.regions) || !Object.keys(s.stats.regions).every(k => known(regionMap, k) && integer(s.stats.regions[k], 0, 1000000000000))) return invalid(56);
      if (!Array.isArray(s.completedGoals) || new Set(s.completedGoals).size !== s.completedGoals.length || !s.completedGoals.every(key => goalDefinitions.some(g => g.id === key))) return invalid(57);
      for (const [key, max] of [['logs', 60], ['events', 30]]) if (!Array.isArray(s[key]) || s[key].length > max || !s[key].every(e => object(e) && safeId(e.id) && integer(e.seq, 0, s.seq) && finite(e.time, 0, s.time) && typeof e.type === 'string' && e.type.length <= 50 && typeof e.text === 'string' && e.text.length <= 500)) return invalid(58);
      const pv = progressionHook('validate', s), rv = raidHook('validate', s), cv = campaignHook('validate', s), ov = operationsHook('validate', s), wv = warehouseHook('validate', s), csv = customerHook('validate', s);
      if (pv === false || Array.isArray(pv) && pv.length || rv === false || Array.isArray(rv) && rv.length || cv === false || ov === false || wv === false || csv === false) return invalid(59);
      if (personality() && personality().validate(s) === false || recruitmentHook('validate', s) === false || seasonHook('validate', s) === false) return invalid(60);
      if (s.incidents !== undefined && incidentHook('validate', s) === false) return invalid(61);
      if (s.questBook !== undefined && questHook('validate', s) === false) return invalid(62);
      if (s.rareOrdersOnly !== undefined && s.rareOrdersOnly !== true) return invalid(63);
      if (researchHook('validate', s) === false) return invalid(62);
      return true;
    } catch (_) { return invalid(61); }
  }

  // The old schema is checked before converting it; malformed imports never
  // receive defaults that could conceal negative resources or broken references.
  function validLegacyBag(bag) { const keys = ['iron', 'wood', 'leather', 'crystal', 'mythril']; return object(bag) && keys.every(k => integer(bag[k], 0, 100000000)) && Object.keys(bag).every(k => keys.includes(k)); }
  function validateLegacy(s) {
    try {
      if (!object(s) || s.version !== 1 || !finite(s.time, 0, 1000000000) || s.day !== Math.floor(s.time / DATA.dayLength) + 1 || !integer(s.gold, 0, 1000000000000) || !integer(s.reputation, 0, 1000000000) || !integer(s.rng, 0, 4294967295) || !integer(s.seq, 0, Number.MAX_SAFE_INTEGER - 100000) || !validLegacyBag(s.materials)) return false;
      if (!object(s.upgrades) || !integer(s.upgrades.shop, 0, 2) || !integer(s.upgrades.furnace, 0, 3) || !integer(s.upgrades.display, 0, 3) || !integer(s.upgrades.apprentice, 0, 2)) return false;
      if (!Array.isArray(s.inventory) || !Array.isArray(s.queue) || s.inventory.length + s.queue.length > 8 + s.upgrades.display * 4 + s.upgrades.shop * 4 || s.queue.length > 3 + s.upgrades.apprentice * 2) return false;
      const ids = new Set();
      function unique(value) { if (!safeId(value) || ids.has(value)) return false; ids.add(value); return true; }
      for (const i of s.inventory) if (!object(i) || !unique(i.id) || !known(recipeMap, i.recipeId) || !known(DATA.qualities, i.quality) || !integer(i.power, 1, 100000) || !integer(i.price, 1, 10000000)) return false;
      for (const q of s.queue) if (!object(q) || !unique(q.id) || !known(recipeMap, q.recipeId) || !finite(q.total, .1, 4000) || !finite(q.remaining, 0, q.total)) return false;
      if (!Array.isArray(s.adventurers) || s.adventurers.length !== 6 || new Set(s.adventurers.map(a => a.id)).size !== 6) return false;
      for (const a of s.adventurers) {
        if (!object(a) || !unique(a.id) || !originalIds.includes(a.id) || !integer(a.level, 1, 99) || !integer(a.xp, 0, 1000000) || !integer(a.gold, 0, 1000000000) || !['visiting', 'hunting', 'returning', 'resting'].includes(a.status) || !finite(a.timer, 0, 10000) || !known(regionMap, a.regionId) || !finite(a.discount, 0, .5) || !validLegacyBag(a.bag) || !integer(a.visits, 0, 1000000000)) return false;
        if (typeof a.name !== 'string' || a.name.length > 40 || typeof a.job !== 'string' || a.job.length > 40 || !/^#[0-9a-fA-F]{6}$/.test(a.color)) return false;
        if (a.equipment !== null) { const e = a.equipment; if (!object(e) || (e.recipeId !== 'starter' && !known(recipeMap, e.recipeId)) || typeof e.name !== 'string' || e.name.length > 80 || !integer(e.power, 1, 100000) || !integer(e.enhance, 0, 3) || !finite(e.durability, 0, 100) || e.quality != null && !known(DATA.qualities, e.quality)) return false; }
      }
      if (!Array.isArray(s.quests) || s.quests.length > 24 || s.quests.filter(q => q.status !== 'completed').length > 3) return false;
      for (const q of s.quests) {
        if (!object(q) || !unique(q.id) || !known(DATA.materials, q.material) || !integer(q.amount, 1, 30) || !integer(q.reward, 0, 100000) || !finite(q.discount, 0, .5) || !['open', 'active', 'completed'].includes(q.status) || !integer(q.progress, 0, q.amount) || !finite(q.createdAt, 0, s.time)) return false;
        if (q.status === 'open' && q.adventurerId !== null || q.status !== 'open' && !originalIds.includes(q.adventurerId)) return false;
        if (q.status === 'completed' && (!finite(q.completedAt, q.createdAt, s.time) || q.progress !== q.amount) || q.status !== 'completed' && q.completedAt !== null) return false;
        if (q.status === 'active' && !s.adventurers.some(a => a.id === q.adventurerId && a.questId === q.id)) return false;
      }
      for (const a of s.adventurers) if (a.questId !== null && !s.quests.some(q => q.id === a.questId && q.adventurerId === a.id && q.status === 'active')) return false;
      if (!object(s.stats) || !['crafted', 'sold', 'enhanced', 'quests', 'earned', 'hunts', 'repaired'].every(k => integer(s.stats[k], 0, 1000000000000)) || !object(s.stats.regions) || !Object.keys(s.stats.regions).every(k => known(regionMap, k) && integer(s.stats.regions[k], 0, 1000000000000))) return false;
      if (!Array.isArray(s.completedGoals) || new Set(s.completedGoals).size !== s.completedGoals.length || !s.completedGoals.every(key => goalDefinitions.some(g => g.id === key)) || !finite(s.gatherCooldown, 0, 45) || typeof s.enhancementService !== 'boolean') return false;
      for (const [key, max] of [['logs', 60], ['events', 30]]) if (!Array.isArray(s[key]) || s[key].length > max || !s[key].every(e => object(e) && safeId(e.id) && integer(e.seq, 0, s.seq) && finite(e.time, 0, s.time) && typeof e.type === 'string' && e.type.length <= 50 && typeof e.text === 'string' && e.text.length <= 500)) return false;
      return true;
    } catch (_) { return false; }
  }
  function migrateLegacy(old) {
    const s = { ...old, materials: { ...emptyBag(), ...old.materials }, version: VERSION, activeTownId: 'greenwood', towns: {}, orders: [] };
    s.stats = { enhancementAttempts: old.stats.enhanced, destroyed: 0, orders: 0, defeats: 0, retreats: 0, arrivals: 0, departures: 0, ...old.stats };
    const t = createTown(s, 'greenwood'); s.towns.greenwood = t; t.inventory = []; t.level = old.upgrades.shop + 1; t.width = shopLayout().BASE_WIDTH + old.upgrades.shop * 4; t.height = 12 + old.upgrades.shop * 2;
    s.adventurers = [];
    for (const oldHero of old.adventurers) {
      const p = roster().find(a => a.id === oldHero.id), a = createHero(s, t, p, true, true), generated = a.equipment.weapon;
      const identity = a.identityVersion ? { identityVersion: a.identityVersion, baseName: a.baseName, traitId: a.traitId, name: a.name } : {};
      const replacement = { ...oldHero, equipment: { weapon: null, offhand: null, armor: null, accessory: null } };
      // The old display name is not part of the newly generated identity.
      Object.assign(a, replacement, identity); a.bag = { ...emptyBag(), ...oldHero.bag }; a.townId = t.id; a.resident = true; a.total = Math.max(a.timer, 1); a.orderCooldown = s.time + 10;
      if (oldHero.equipment) {
        const e = oldHero.equipment, r = recipeMap[e.recipeId], slot = e.recipeId === 'starter' ? 'weapon' : r.slot;
        a.equipment[slot] = { ...e, id: generated ? generated.id : id(s, 'item'), slot, quality: e.quality || 'normal', price: r ? Math.round(r.price * DATA.qualities[e.quality || 'normal'].multiplier) : 1, listed: false, locked: false };
      }
      a.hp = getCombatStats(a).maxHp;
      const point = browsingPoint(s, t, a); a.x = point.x; a.y = point.y; clearRoute(a);
      if (a.status === 'hunting') { const exit = getTownLayout(s, t.id).exit; a.x = exit.x; a.y = exit.y; }
      else if (a.status === 'resting') beginRest(s, a);
      else if (a.status === 'returning') { const timer = a.timer; returnToTown(s, a, 'victory'); a.timer = timer; }
    }
    function add(type) {
      const rear = getTownLayout(s, t.id).workshop, firstY = type === 'furnace' ? rear.y + 1 : 1, lastY = type === 'furnace' ? rear.y + rear.h - 2 : t.height - 2;
      for (let y = firstY; y < lastY; y++) for (let x = 1; x < t.width - 1; x++) if (canPlaceFacility(s, type, x, y).ok) { t.facilities.push(createFacility(s, type, x, y)); return; }
      throw new Error('이전 시설을 안전하게 배치할 공간이 없습니다.');
    }
    const oldStock = 8 + old.upgrades.display * 4 + old.upgrades.shop * 4;
    while (getStockCapacity(s) < oldStock) add('display');
    const neededFurnaces = Math.max(1 + old.upgrades.furnace, Math.ceil((3 + old.upgrades.apprentice * 2) / 3));
    while (t.facilities.filter(f => f.type === 'furnace').length < neededFurnaces) add('furnace');
    for (let i = 0; i < old.upgrades.apprentice; i++) t.staff.push(createStaff(s, t, DATA.staffCandidates[0], '견습생 ' + (i + 1)));
    for (const w of t.staff) if (w.role === 'smith') { w.dexterity = Math.min(100, w.dexterity + old.upgrades.furnace * 8); w.craftSkill = w.dexterity; w.craftLevel = Math.max(1 + old.upgrades.furnace, ...DATA.recipes.filter(r => ['iron_sword', 'oak_bow', 'iron_shield', 'steel_sword', 'hunter_bow', 'guard_armor', 'crystal_staff', 'mythril_blade', 'dragon_armor'].includes(r.id) && r.tier <= old.upgrades.shop + 1).map(getRecipeLevel)); }
    for (const item of old.inventory) t.inventory.push({ ...item, name: recipeMap[item.recipeId].name, slot: recipeMap[item.recipeId].slot, enhance: 0, durability: 100, listed: true, locked: false });
    const furnaces = t.facilities.filter(f => f.type === 'furnace');
    t.queue = old.queue.map((q, i) => ({ ...q, townId: t.id, facilityId: furnaces[Math.floor(i / 3)].id, staffId: null, status: 'waiting' }));
    s.quests = old.quests.map(q => ({ ...q, townId: t.id }));
    delete s.inventory; delete s.queue; delete s.upgrades;
    s.rng = old.rng;
    progressionHook('initialize', s); raidHook('init', s); campaignHook('init', s); warehouseHook('init', s); operationsHook('init', s); customerHook('init', s); seasonHook('init', s); researchHook('init', s); incidentHook('init', s); questHook('init', s);
    return applyCharacterProfiles(s);
  }
  function migrateV2(s) {
    const oldMaterials = ['iron', 'wood', 'leather', 'crystal', 'mythril', 'ancient_heart', 'giant_core', 'star_fragment', 'frost_scale', 'abyss_crystal'];
    if (!object(s.materials) || !oldMaterials.every(m => integer(s.materials[m], 0, 100000000)) || Object.keys(s.materials).some(m => !known(DATA.materials, m))) throw new Error('invalid legacy materials');
    if (!Array.isArray(s.adventurers) || !object(s.towns)) throw new Error('invalid legacy state');
    s.materials = { ...emptyBag(), ...s.materials };
    for (const a of s.adventurers) {
      if (!object(a.bag) || !oldMaterials.every(m => integer(a.bag[m], 0, 100000000)) || Object.keys(a.bag).some(m => !known(DATA.materials, m))) throw new Error('invalid legacy bag');
      a.bag = { ...emptyBag(), ...a.bag }; a.visitContinuation = false;
    }
    const rng = s.rng; s.version = VERSION; campaignHook('init', s); s.rng = rng;
    return s;
  }
  // 2026-11-09 v2: boss materials are out of the game. Stock is paid out at its price, adventurers' sale offers close,
  // and old boss commissions for what are now ordinary recipes become ordinary commissions.
  function retireBossMaterials(s) {
    if (s.bossMaterialsRetired === true) return; // once per save (new games start with it set)
    s.bossMaterialsRetired = true;
    const retired = Object.keys(DATA.materials).filter(m => DATA.materials[m].retired);
    let refund = 0;
    if (object(s.materials)) for (const m of retired) if (s.materials[m] > 0) { refund += s.materials[m] * DATA.materials[m].price; s.materials[m] = 0; }
    for (const o of Array.isArray(s.rareOffers) ? s.rareOffers : []) if (o && retired.includes(o.material) && ['pending', 'open'].includes(o.status)) o.status = 'withdrawn';
    for (const t of object(s.towns) ? Object.values(s.towns) : []) if (t && t.operations && object(t.operations.materialRules)) for (const m of retired) delete t.operations.materialRules[m];
    for (const a of Array.isArray(s.adventurers) ? s.adventurers : []) {
      if (!a) continue;
      if (object(a.rareBag)) for (const m of retired) if (a.rareBag[m]) { a.gold = Math.min(1e9, (a.gold || 0) + a.rareBag[m] * DATA.materials[m].price); delete a.rareBag[m]; }
      if (a.bossRecipe && !(recipeMap[a.bossRecipe.recipeId] && recipeMap[a.bossRecipe.recipeId].bossRecipe)) a.bossRecipe = null;
    }
    for (const o of Array.isArray(s.orders) ? s.orders : []) if (o && o.heirloom && !(recipeMap[o.recipeId] && recipeMap[o.recipeId].bossRecipe)) { delete o.heirloom; delete o.bossId; }
    if (refund > 0 && Number.isFinite(s.gold)) {
      s.gold = Math.round(s.gold + refund);
      if (Array.isArray(s.logs)) log(s, 'notice', '보스 재료가 게임에서 빠졌어요. 갖고 있던 보스 재료를 시세대로 ' + Math.round(refund).toLocaleString('ko-KR') + ' G로 바꿔 드렸어요.', {});
    }
  }
  function normalizeState(data) {
    try {
      let clone = JSON.parse(JSON.stringify(data));
      if (!object(clone)) throw new Error('invalid state');
      if (clone.version === 1) {
        if (!validateLegacy(clone)) throw new Error('invalid legacy state');
        clone = migrateLegacy(clone);
      } else if (clone.version === 2) clone = migrateV2(clone);
      else if (clone.version !== VERSION || !clone.campaign) throw new Error('invalid state');
      progressionHook('normalize', clone); raidHook('normalize', clone); campaignHook('normalize', clone); warehouseHook('normalize', clone); operationsHook('normalize', clone); customerHook('normalize', clone); seasonHook('normalize', clone); researchHook('normalize', clone); incidentHook('normalize', clone); questHook('normalize', clone);
      if (personality()) personality().initialize(clone);
      recruitmentHook('normalize', clone, 0);
      for (const town of getOwnedTowns(clone)) for (const worker of town.staff) if (Object.hasOwn(workerArt, worker.candidateId) && !(Number.isInteger(worker.spriteIndex) && worker.spriteIndex >= 100 && worker.spriteIndex <= 123)) worker.spriteIndex = workerArt[worker.candidateId];
      migrateRearRooms(clone);
      normalizeDisplayFootprints(clone);
      // The old "초보자의 장비" starter weapon is gone: its attack moves into the adventurer's own stats.
      for (const hero of Array.isArray(clone.adventurers) ? clone.adventurers : []) {
        if (hero && hero.bossRecipe === undefined) hero.bossRecipe = null;
        const w = hero && hero.equipment && hero.equipment.weapon;
        if (w && w.recipeId === 'starter' && hero.baseStats && Number.isInteger(hero.baseStats.attack)) { hero.baseStats.attack += Math.max(0, Math.round(w.power || 0)); hero.equipment.weapon = null; }
      }
      retireBossMaterials(clone);
      // Saves written while the stale-claim bug existed (a worker's id left on a facility they had left) are repaired, not rejected.
      for (const town of getOwnedTowns(clone)) if (Array.isArray(town.facilities) && Array.isArray(town.staff) && Array.isArray(town.queue)) releaseStaleClaims(town);
      // Validate first (a malformed save must be rejected, not "repaired" by the settlement), then settle the towns.
      if (!validateState(clone)) throw new Error('invalid state');
      respaceFixedSlots(clone);
      for(const hero of clone.adventurers)if(hero.potentialGrade===undefined){hero.potentialGrade='C';hero.gradeLegacy=true;}
      for(const town of getOwnedTowns(clone))for(const worker of town.staff)if(worker.potentialGrade===undefined){worker.potentialGrade='C';worker.gradeLegacy=true;}
      for(const board of Object.values(clone.recruitment?.boards||{}))for(const offer of board.candidates)if(offer.potentialGrade===undefined){offer.potentialGrade='C';offer.gradeLegacy=true;}
      for(const offer of clone.campaign.recruitOffers||[])if(offer.potentialGrade===undefined){offer.potentialGrade='C';offer.gradeLegacy=true;}
      for (const town of getOwnedTowns(clone)) if (town.innVersion === undefined) {
        const oldCapacity = Math.min(100, 4 + town.innLevel * 2);
        town.innLayoutHeight = 8 + Math.min(2, Math.floor((oldCapacity - 6) / 24));
        town.innLevel = Math.min(5, Math.max(town.innLevel, Math.ceil(oldCapacity / 8)));
        town.innLegacyCapacity = oldCapacity > 40 ? oldCapacity : 0;
        town.innVersion = 2;
      }
      normalizeFloorplans(clone);
      respaceFixedSlots(clone); // pre-floorplan saves get their level settlement right after their one-time reflow
      if (!validateState(clone)) throw new Error('invalid floorplan');
      return applyCharacterProfiles(clone);
    } catch (cause) {
      const error = new Error('저장 파일의 형식이 올바르지 않습니다. 기존 게임은 유지됩니다.');
      // A short code for bug reports: which validation check failed, or the underlying error.
      error.detail = lastInvalid != null ? 'V' + lastInvalid : String(cause && cause.message || cause).slice(0, 80);
      throw error;
    }
  }

  return {
    VERSION, DATA, createState, applyCharacterProfiles, step, craft, postQuest, cancelQuest, upgrade, buyMaterial, gather,
    getTown, getOwnedTowns, getResidents, getTownLayout, getFacilityWorkSpot, getCounterWorkSpot, getStockCapacity, getQueueCapacity, getUnlockedRecipes,
    getWarehouse, getMaterialCapacity, getMaterialRoom, getEquipmentCapacity, getEquipmentUsage, getWarehouseUpgradeCost, upgradeWarehouse,
    getBuildCost, canPlaceFacility, placeFacility, moveFacility, arrangePreviewLayout, getFacilitySlots, getFreeFacilitySlot, buyFacility, getForgeLevelInfo, getEnhanceBench, craftForOrder, expandShop, getExpansionCost, upgradeInn, getInnUpgradeCost, getInnCapacity, getFurnaceGradeQuote, upgradeFurnace, getFurnaceWorkers,
    hireStaff, getHireCost, assignStaff, getCraftDuration, getCraftQualityChances, getUpgradeCost,
    advanceRecruitment, getRecruitmentBoard, postRecruitmentAd, hireRecruitmentCandidate, getPersonality, getPersonalities, previewIdentity,
    getCombatStats, getItemStats, getItemEnhancementMultiplier, getEquipmentSlots, getPower, getEnhancementInfo, getEnhancementQuote: getEnhancementInfo, startEnhancement,
    getOrders, getOrderCandidates, getOrderPayout, fulfillOrder, offerOrder, attemptPurchase,
    listItem, unlistItem, listAllItems, toggleItemLock, getDisplayedItems,
    getRecipeLevel, getCalendar, getStaffRank, getCraftXpNeeded, getFestival, getFestivalCandidates, getFestivalScore, submitFestival, withdrawFestival, getPayroll, payWages,
    getBosses, getRaidParties, getDispatchInfo, quoteParty, dispatchParty, listRareOffers, buyRareOffer,
    getInvasion, triggerInvasion, getFame, getRecruitOffers, hireRecruit, getTraining, getTrainingQuote, trainStaff, getReliefQuote, fundRelief, getGoldSinks, getFinanceGuide: getGoldSinks,
    getOperations, setMaterialPurchaseRule, setMaterialPurchaseRules, setAutoCraftRule, removeAutoCraftRule, setAutoDisplay, grantRecipeDrop,
    getCustomerService, setCustomerService, requestCustomerService, cancelCustomerRequest, hasCustomerRequest, isCustomerItemReserved,
    openBranch, switchTown, getBranchRequirements, ROAD_WALK_SPEED, getQuestQuote, getMaterialPrices, postQuests, getQuestRoom, getDisplayStockSpot, getFacilityBackSpot, getNextGoal, xpNeeded, chooseRegion, validateState, normalizeState,
    createTutorialOrder, grantTutorialSupplies, getMigrationReadyCount, migrateResident, getMigrationCandidates, migrateResidents, regatherIncidentMission, getSeasonEvents, buySeasonMarket, deliverSeasonHarvest,
    getResearch, buyResearch, researchEffect,
    getIncidents, chooseIncident, deliverIncident, craftForIncident, getIncidentMission, quoteIncidentMission, sendIncidentMission, dismissIncident, spawnIncident, getIncidentCatalog, getActiveEffects, enableIncidents, setIncidentRealRate, incidentFactor,
    getQuestBook, claimQuest, enableQuests, getQuestList, chooseRaidCrisis, getRaidCrisisCost, enableCrises, chooseMissionCrisis, setRareOrdersOnly
  };
});
