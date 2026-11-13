(function (global) {
  'use strict';

  // Simulation-only module. Adventurers choose their party and own all loot;
  // the shop receives a rare material only through a successful paid trade.
  const MATERIALS = Object.freeze([
    { id: 'ancient_heart', name: '고목의 심장', color: '#91a568', price: 90, minPower: 24, icon: 'wood', rare: true, buyable: false },
    { id: 'giant_core', name: '거인의 핵', color: '#b19d7e', price: 170, minPower: 50, icon: 'ore', rare: true, buyable: false },
    { id: 'star_fragment', name: '별의 파편', color: '#b19bc8', price: 290, minPower: 90, icon: 'crystal', rare: true, buyable: false },
    { id: 'frost_scale', name: '서리용 비늘', color: '#91bdca', price: 460, minPower: 150, icon: 'crystal', rare: true, buyable: false },
    { id: 'abyss_crystal', name: '심연의 결정', color: '#a88aa8', price: 760, minPower: 240, icon: 'crystal', rare: true, buyable: false }
  ].map(Object.freeze));
  const BOSSES = Object.freeze([
    // 2026-11 balance: the first boss is a ~1 hour goal (was beatable by starting heroes within a minute).
    // appearAt 6600 game s = 55 real minutes at 1x.
    { id: 'moss_warden', name: '고목 수호자', regionId: 'greenwood', appearAt: 6600, minPower: 130, partySize: 3, duration: 46, cooldown: 300, materialId: 'ancient_heart', gold: 180, xp: 120, weak: ['axe', 'crossbow'], tactic: 'support' },
    // Graduation exam for Greenwood: just below the migration threshold (150).
    { id: 'stone_colossus', name: '바위 거인', regionId: 'quarry', appearAt: 7800, minPower: 60, partySize: 4, duration: 62, cooldown: 460, materialId: 'giant_core', gold: 220, xp: 140, weak: ['gauntlet', 'spear'], tactic: 'power' },
    { id: 'ruin_oracle', name: '별을 삼킨 예언자', regionId: 'ruins', minPower: 90, partySize: 4, duration: 76, cooldown: 620, materialId: 'star_fragment', gold: 290, xp: 175, weak: ['dagger', 'bow'], tactic: 'variety' },
    { id: 'frost_drake', name: '서리날개 용', regionId: 'ridge', minPower: 150, partySize: 5, duration: 94, cooldown: 800, materialId: 'frost_scale', gold: 470, xp: 260, weak: ['staff', 'crossbow'], tactic: 'support' },
    { id: 'abyss_sovereign', name: '심연의 군주', regionId: 'abyss', minPower: 240, partySize: 6, duration: 116, cooldown: 1040, materialId: 'abyss_crystal', gold: 720, xp: 380, weak: ['sword', 'spear'], tactic: 'variety' },
    // 2026-11-10 사용자 결정: 서리문(5호점)의 최종 보스. Its first fall is the balance target's end point
    // (s.stats.clearedAt; the word "클리어" is never shown in the game). Drops 3 rare recipes like the others.
    // minPower is the base; world-data adds the icekeep region offset (→ ~1160).
    // Balance pass 5 (2026-11-10): base 270 (1159) falls at 16.8~17.7h 1x (8.4~8.9h at 2x) — 사용자: "8~9시간도 괜찮다", kept.
    { id: 'silent_king', name: '얼음성의 침묵왕', regionId: 'icekeep', minPower: 295, partySize: 6, duration: 130, cooldown: 1200, materialId: 'abyss_crystal', gold: 950, xp: 460, final: true, weak: ['axe', 'staff'] }
  ].map(Object.freeze));
  const materialMap = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
  const ACTIVE_OFFERS = new Set(['pending', 'open']);
  const CRISIS_SECONDS = 10; // real seconds to answer a crisis, at any game speed
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const finite = (n, lo = 0, hi = 1e12) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const safeId = v => typeof v === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(v);
  const known = (map, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key);
  const roleOf = a => {
    const job = String(a.jobId || a.job || '');
    if (/cleric|priest|healer|성직|사제|치유/.test(job)) return 'support';
    if (/knight|warrior|swordsman|spearman|fighter|기사|전사|검사|창병|격투/.test(job)) return 'frontline';
    if (/mage|archer|crossbow|마법|궁수|석궁/.test(job)) return 'ranged';
    return 'skirmisher';
  };

  function decorateData(DATA) {
    if (!DATA.materials) DATA.materials = {};
    for (const material of MATERIALS) if (!DATA.materials[material.id]) DATA.materials[material.id] = { ...material };
    DATA.bosses = BOSSES.map(b => ({ ...b }));
  }

  function create(ctx) {
    const { DATA, getCombatStats, getTown, getOwnedTowns, random, int, id, log, result, returnToTown } = ctx;
    if (typeof random !== 'function' || typeof returnToTown !== 'function') throw new Error('ForgeRaids requires deterministic simulation helpers.');
    // World progression decorates these records before the simulation starts.
    // Combat and presentation must use the same adjusted thresholds.
    const bosses = DATA.bosses || BOSSES;
    const bossMap = Object.fromEntries(bosses.map(b => [b.id, b]));
    const heroes = s => s.adventurers || [];
    const towns = s => getOwnedTowns ? getOwnedTowns(s) : Object.values(s.towns || {});
    const canReach = (townId, regionId) => {
      const t = (DATA.towns || []).find(t => t.id === townId);
      return !!t && (!Array.isArray(t.regionIds) || t.regionIds.includes(regionId));
    };

    function init(s) {
      // appearAt: a boss's first appearance (game seconds). Shown as the usual respawn timer until then.
      if (s.raidState === undefined) s.raidState = { version: 1, cooldowns: Object.fromEntries(bosses.map(b => [b.id, b.appearAt || 0])), parties: [], nextAssemblyAt: (s.time || 0) + 18 };
      if (s.rareOffers === undefined) s.rareOffers = [];
      if (object(s.raidState) && object(s.raidState.cooldowns)) for (const b of bosses) if (s.raidState.cooldowns[b.id] === undefined) s.raidState.cooldowns[b.id] = 0;
      for (const a of heroes(s)) {
        if (a.raidId === undefined) a.raidId = null;
        if (a.raidReadyAt === undefined) a.raidReadyAt = 0;
        if (a.rareBag === undefined) a.rareBag = {};
      }
      if (s.stats) for (const key of ['raids', 'raidWins', 'rarePurchases']) if (s.stats[key] === undefined) s.stats[key] = 0;
      return s;
    }

    function eligible(s, a, boss, townId) {
      // Residents join up outside after completing their shop/inn visit and
      // physically leaving town. Never remove a browsing or waiting customer.
      if (!a.resident || a.townId !== townId || a.invasionId || a.injuryUntil > s.time || a.raidId || a.questId || a.enhancement || a.raidReadyAt > s.time || a.status !== 'hunting' || (a.fatigue || 0) > 46) return false;
      const stats = getCombatStats(a);
      return stats.power >= boss.minPower && a.hp >= stats.maxHp * .66;
    }

    function chooseParty(s, boss, townId) {
      if (!canReach(townId, boss.regionId)) return null;
      const pool = heroes(s).filter(a => eligible(s, a, boss, townId)).map(a => ({ a, power: getCombatStats(a).power, role: roleOf(a) })).sort((a, b) => a.power - b.power || a.a.id.localeCompare(b.a.id));
      for (let start = 0; start <= pool.length - boss.partySize; start++) {
        const floor = pool[start].power, band = pool.slice(start).filter(v => v.power <= floor * 1.8);
        if (band.length < boss.partySize) continue;
        const party = [], take = v => { if (v && !party.includes(v)) party.push(v); };
        take(band.find(v => v.role === 'frontline'));
        if (!party.length) continue;
        take(band.find(v => v.role === 'support'));
        take(band.find(v => v.role === 'ranged'));
        if (!party.some(v => v.role === 'support') && !party.some(v => v.role === 'ranged')) take(band.find(v => v.role === 'skirmisher'));
        if (new Set(party.map(v => v.role)).size < 2) continue;
        for (const v of band) { if (party.length >= boss.partySize) break; take(v); }
        if (party.length === boss.partySize) return party.map(v => v.a);
      }
      return null;
    }

    // 2026-11: bosses are only fought by parties the player sends (no adventurer goes on their own).
    // Who can be sent: a resident of a town that reaches the boss, out hunting or resting (not mid-visit, hurt, on a
    // quest, enhancing, defending or already in a fight), with at least half HP and fatigue up to 70.
    function dispatchBlock(s, a, boss) {
      if (!a || !a.resident) return '주민 모험가만 보낼 수 있어요.';
      if (!canReach(a.townId, boss.regionId)) return '이 보스가 있는 마을의 모험가가 아니에요.';
      if (a.raidId) return '다른 토벌에 나가 있어요.';
      if (a.missionId) return '돌발 사건 파견에 나가 있어요.';
      if (ctx.isHeroReserved && ctx.isHeroReserved(s, a.id)) return '돌발 사건 파견대에 뽑혀 모이는 중이에요.';
      if (a.invasionId) return '마을 방어 중이에요.';
      if (a.injuryUntil > s.time) return '부상 회복 중이에요.';
      if (a.questId) return '재료 의뢰를 맡고 있어요.';
      if (a.enhancement) return '장비 강화 중이에요.';
      if (!['hunting', 'resting'].includes(a.status)) return ({ traveling: '마을로 오는 중이에요.', arriving: '마을로 오는 중이에요.', returning: '마을로 돌아오는 중이에요.', departing: '사냥터로 나가는 중이에요.', leaving: '마을을 떠나는 중이에요.', recalling: '마을로 돌아오는 중이에요.', defending: '마을 방어 중이에요.' })[a.status] || '대장간에 들러 있어요. 잠시 뒤 보낼 수 있어요.';
      const stats = getCombatStats(a);
      if (a.hp < stats.maxHp * .5) return '체력이 절반보다 적어요.';
      if ((a.fatigue || 0) > 70) return '너무 지쳐 있어요.';
      return '';
    }
    // Success chance of a chosen party: average power against the boss's requirement, a cleric (+), varied jobs (+),
    // and fewer members than the boss allows (−).
    // 보스 약점 (2026-11-10 사용자): each boss is weak to two weapon types; every member holding one of them adds +5%p
    // (at most +15%p). It is the equipped weapon that counts, so the forge can make the right weapons for a fight.
    // support: healing matters (cleric +16%p) · power: raw strength (power counts ~2.4x, cleric +4%p) · variety: many jobs (+12%p).
    const BOSS_TACTICS = { none: { power: .17, support: .10, variety: .06 }, support: { power: .15, support: .16, variety: .03 }, power: { power: .40, support: .04, variety: .03 }, variety: { power: .15, support: .06, variety: .12 } };
    const weaponType = a => { const w = a && a.equipment && a.equipment.weapon; const r = w && (DATA.recipes || []).find(x => x.id === w.recipeId); return r ? r.type : null; };
    const hitsWeakness = (boss, a) => !!(boss.weak && boss.weak.includes(weaponType(a)));
    function partyChance(boss, members) {
      if (!members.length) return 0;
      const powers = members.map(a => getCombatStats(a).power), roles = members.map(roleOf);
      const average = powers.reduce((a, b) => a + b, 0) / members.length;
      const support = roles.includes('support'), diversity = new Set(roles).size, missing = Math.max(0, boss.partySize - members.length);
      const weak = Math.min(3, members.filter(a => hitsWeakness(boss, a)).length) * .05;
      // 2026-11-14: each boss favours a different party (BOSS_TACTICS), so one formation is not the answer everywhere.
      const k = BOSS_TACTICS[boss.tactic] || BOSS_TACTICS.none;
      return clamp(.58 + (average / boss.minPower - 1) * k.power + (support ? k.support : 0) + (diversity >= 3 ? k.variety : diversity >= 2 ? k.variety * .42 : 0) - missing * .09 + weak, .05, .96);
    }
    function getDispatchInfo(s, bossId) {
      const boss = bossMap[bossId]; if (!boss) return null;
      const candidates = heroes(s).filter(a => a.resident && canReach(a.townId, boss.regionId)).map(a => ({ id: a.id, block: dispatchBlock(s, a, boss), power: getCombatStats(a).power, role: roleOf(a), weak: hitsWeakness(boss, a), weapon: weaponType(a) }));
      return { bossId, partySize: boss.partySize, minPower: boss.minPower, weak: boss.weak || [], candidates };
    }
    function quoteParty(s, bossId, heroIds) {
      const boss = bossMap[bossId]; if (!boss || !Array.isArray(heroIds)) return 0;
      return partyChance(boss, heroIds.map(id => heroes(s).find(a => a.id === id)).filter(Boolean));
    }
    function dispatchParty(s, bossId, heroIds) {
      const boss = bossMap[bossId]; if (!boss) return result(false, '알 수 없는 보스예요.');
      if (!Array.isArray(heroIds) || !heroIds.length) return result(false, '보낼 모험가를 골라 주세요.');
      if (heroIds.length > boss.partySize) return result(false, '최대 ' + boss.partySize + '명까지 보낼 수 있어요.');
      if (new Set(heroIds).size !== heroIds.length) return result(false, '같은 모험가를 두 번 고를 수 없어요.');
      if ((s.raidState.cooldowns[boss.id] || 0) > s.time) return result(false, '보스가 아직 다시 나타나지 않았어요.');
      if (s.raidState.parties.some(p => p.bossId === boss.id && p.status === 'fighting')) return result(false, '이미 토벌대가 싸우고 있어요.');
      const members = heroIds.map(id => heroes(s).find(a => a.id === id));
      if (members.some(a => !a)) return result(false, '모험가를 찾을 수 없어요.');
      for (const a of members) { const block = dispatchBlock(s, a, boss); if (block) return result(false, a.name + ': ' + block); }
      const town = getTown(s, members[0].townId);
      if (!town || members.some(a => a.townId !== town.id)) return result(false, '한 마을의 모험가끼리 파티를 꾸려 주세요.');
      for (const a of members) if (a.status === 'resting') { a.bedId = null; }
      const party = startParty(s, boss, town, members);
      return result(true, boss.name + ' 토벌대를 보냈어요. 예상 성공률 ' + Math.round(party.successChance * 100) + '%', { party });
    }

    function startParty(s, boss, town, members) {
      const stats = members.map(getCombatStats), powers = stats.map(v => v.power), roles = members.map(roleOf);
      const average = powers.reduce((a, b) => a + b, 0) / members.length;
      const successChance = partyChance(boss, members);
      const party = {
        id: id(s, 'raid'), bossId: boss.id, name: boss.name, regionId: boss.regionId, townId: town.id,
        memberIds: members.map(a => a.id), members: members.map((a, i) => ({ id: a.id, name: a.name, job: a.job, role: roles[i], power: powers[i] })),
        power: powers.reduce((a, b) => a + b, 0), averagePower: average, minPower: Math.min(...powers), maxPower: Math.max(...powers), powerRatio: Math.max(...powers) / Math.min(...powers),
        roles, successChance, total: boss.duration, remaining: boss.duration, status: 'fighting', startedAt: s.time, finishedAt: null, outcome: null
      };
      // 위기 순간 (2026-11-09): once, at 40-70% of the fight (from the party id, no dice), when the game has crises on.
      if (s.raidState.crisisOn) {
        let h = 0; for (const ch of party.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        party.crisis = { at: boss.duration * (1 - (.4 + (h % 31) / 100)), active: false, realLeft: CRISIS_SECONDS, chosen: null, delta: 0 };
      }
      s.raidState.parties.push(party);
      for (const a of members) {
        a.raidId = party.id; a.status = 'hunting'; a.regionId = boss.regionId; a.timer = boss.duration; a.total = boss.duration;
        a.path = []; a.destination = null; a.moving = false; a.bubble = null; a.bedId = null; a.huntOutcome = null;
      }
      s.stats.raids++;
      log(s, 'raid-start', members.map(a => a.name).join('·') + ' · ' + boss.name + ' 토벌을 떠났어요. 예상 성공률 ' + Math.round(successChance * 100) + '%', { townId: town.id, regionId: boss.regionId, raidId: party.id, bossId: boss.id, adventurerIds: party.memberIds });
      return party;
    }

    function createOffer(s, a, material) {
      const owned = a.rareBag[material] || 0;
      const reserved = s.rareOffers.filter(o => o.heroId === a.id && o.material === material && ACTIVE_OFFERS.has(o.status)).reduce((sum, o) => sum + o.amount, 0);
      const amount = Math.max(0, owned - reserved); if (!amount) return null;
      const existing = s.rareOffers.find(o => o.heroId === a.id && o.material === material && ACTIVE_OFFERS.has(o.status));
      if (existing) { existing.amount += amount; existing.totalPrice = existing.unitPrice * existing.amount; return existing; }
      const unitPrice = Math.max(1, Math.round(materialMap[material].price * (.92 + random(s) * .16)));
      const offer = { id: id(s, 'rare-offer'), heroId: a.id, sellerName: a.name, townId: a.townId, material, amount, unitPrice, totalPrice: unitPrice * amount, status: 'pending', createdAt: s.time, openedAt: null, soldAt: null };
      s.rareOffers.push(offer); return offer;
    }

    function finishParty(s, party, outcome) {
      const boss = bossMap[party.bossId], members = party.memberIds.map(memberId => heroes(s).find(a => a.id === memberId)).filter(Boolean);
      const victory = outcome === 'victory'; party.remaining = 0; party.status = outcome; party.outcome = outcome; party.finishedAt = s.time;
      s.raidState.cooldowns[boss.id] = s.time + boss.cooldown;
      if (victory) {
        s.stats.raidWins++; s.reputation += 2 + Math.floor(boss.partySize / 2);
        if (!object(s.stats.bossWins)) s.stats.bossWins = {}; // per boss, for growth quests
        s.stats.bossWins[boss.id] = (s.stats.bossWins[boss.id] || 0) + 1;
      }
      // 2026-11-09 v2: a won fight drops one of the boss's 3 rare recipes only 12% of the time; the 8th win in a row
      // without one always drops it. It goes to a member not carrying one, matched to their job where possible, and
      // they come straight to the forge to commission the piece (the shop supplies the materials).
      const pool = (DATA.bossRecipes || {})[boss.id] || [], takers = members.filter(a => !a.bossRecipe);
      if (!object(s.raidState.pity)) s.raidState.pity = {};
      let recipient = null;
      if (victory && pool.length) {
        const misses = s.raidState.pity[boss.id] || 0;
        const drop = takers.length && (misses + 1 >= (DATA.bossRecipePity || 8) || random(s) < (DATA.bossRecipeChance ?? .12));
        if (drop) { recipient = takers[int(s, 0, takers.length - 1)]; s.raidState.pity[boss.id] = 0; }
        else s.raidState.pity[boss.id] = misses + 1;
      }
      let rareCount = 0, recipeName = '';
      if (recipient) {
        const recipes = pool.map(id => (DATA.recipes || []).find(r => r.id === id)).filter(Boolean);
        const jobFamily = DATA.equipment && DATA.equipment.jobWeapons ? DATA.equipment.jobWeapons[recipient.jobId] : null;
        const fits = r => r.slot !== 'weapon' || r.family === jobFamily;
        const made = new Set(Array.isArray(s.stats && s.stats.rareCrafted) ? s.stats.rareCrafted : []);
        const ranked = recipes.filter(fits).length ? recipes.filter(fits) : recipes;
        const fresh = ranked.filter(r => !made.has(r.id)), choice = (fresh.length ? fresh : ranked);
        const recipe = choice[int(s, 0, choice.length - 1)];
        recipient.bossRecipe = { recipeId: recipe.id, bossId: boss.id, gathered: DATA.bossRecipeHunts || 3, needed: DATA.bossRecipeHunts || 3 };
        recipeName = recipe.name; s.stats.rareRecipes = (s.stats.rareRecipes || 0) + 1;
      }
      for (const [i, a] of members.entries()) {
        const stats = getCombatStats(a); a.raidId = null; a.raidReadyAt = s.time + 65;
        if (victory) {
          a.gold = Math.min(1e9, a.gold + Math.round(boss.gold * (.92 + random(s) * .16))); a.xp += Math.max(1, Math.round(boss.xp * (ctx.personalityEffect ? ctx.personalityEffect(a, 'adventurerXp') : 1)));
          if (ctx.xpNeeded) while (a.level < (DATA.adventurerMaxLevel || 300) && a.xp >= ctx.xpNeeded(a)) { a.xp -= ctx.xpNeeded(a); a.level++; a.hp += 8; }
          const stoneBonus = boss.enhancementStoneBonus ?? Math.floor((boss.baseMinPower ?? boss.minPower) / 65);
          a.enhancementStones = Math.min(1e6, (a.enhancementStones || 0) + int(s, 2, 4) + stoneBonus);
          a.fatigue = Math.min(100, (a.fatigue || 0) + int(s, 26, 39) * (ctx.personalityEffect ? ctx.personalityEffect(a, 'huntFatigue') : 1));
          a.hp = clamp(a.hp - stats.maxHp * (.10 + random(s) * .12), 1, getCombatStats(a).maxHp);
          s.stats.hunts++; s.stats.regions[boss.regionId] = (s.stats.regions[boss.regionId] || 0) + 1;
        } else {
          a.fatigue = Math.max(a.fatigue || 0, outcome === 'defeat' ? 92 : 80);
          a.hp = Math.max(1, Math.min(a.hp, stats.maxHp * (outcome === 'defeat' ? .09 : .21)));
          s.stats[outcome === 'defeat' ? 'defeats' : 'retreats']++;
        }
        for (const equipment of Object.values(a.equipment || {})) if (equipment) equipment.durability = Math.max(0, (equipment.durability == null ? 100 : equipment.durability) - int(s, victory ? 7 : 11, victory ? 13 : 19));
        returnToTown(s, a, outcome);
        if (a === recipient) a.bubble = { type: 'book', until: s.time + 35 };
      }
      if (victory && ctx.onBossVictory) ctx.onBossVictory(s, party, boss, 2 + Math.floor(boss.partySize / 2));
      // 게임 클리어 (2026-11-10): the first win over the final boss. Recorded once; the game goes on as free play.
      if (victory && boss.final && !s.stats.clearedAt) {
        s.stats.clearedAt = Math.max(1, s.time);
        log(s, 'game-clear', boss.name + '을(를) 처음 쓰러뜨렸어요! 다섯 마을의 작은 불꽃이 왕국 끝까지 닿았어요.', { townId: party.townId, bossId: boss.id, clearedAt: s.stats.clearedAt });
      }
      const crisisNote = !party.crisis ? '' : party.crisis.chosen === 'potion' ? ' (물약 지원)' : party.crisis.chosen === 'hold' ? (party.crisis.delta > 0 ? ' (버텨 냄)' : ' (버티다 밀림)') : '';
      log(s, victory ? 'raid-victory' : 'raid-retreat', boss.name + crisisNote + (victory ? ' 토벌 성공!' + (recipient ? ' ' + recipient.name + '이(가) 희귀 설계도 「' + recipeName + '」를 얻었어요! 대장간에 전용 장비를 맡기러 와요.' : ' 모험가들이 돌아옵니다.') : ' 토벌대가 ' + (outcome === 'defeat' ? '패배해' : '후퇴해') + ' 여관으로 돌아옵니다.'), { townId: party.townId, regionId: boss.regionId, bossId: boss.id, raidId: party.id, outcome, material: boss.materialId, amount: rareCount });
      const finished = s.raidState.parties.filter(p => p.status !== 'fighting');
      if (finished.length > 20) { const old = new Set(finished.slice(0, finished.length - 20).map(p => p.id)); s.raidState.parties = s.raidState.parties.filter(p => !old.has(p.id)); }
    }


    function cancelTownRaids(s, townId, reason) {
      const cancelled = [];
      for (const party of s.raidState.parties.filter(p => p.status === 'fighting' && p.townId === townId)) {
        party.status = 'cancelled'; party.outcome = 'cancelled'; party.remaining = 0; party.finishedAt = s.time;
        party.cancelReason = reason || '마을 소집';
        for (const heroId of party.memberIds) {
          const hero = heroes(s).find(a => a.id === heroId);
          if (!hero) continue;
          hero.raidId = null; hero.raidReadyAt = Math.max(hero.raidReadyAt || 0, s.time + 65);
          // Recall grants no boss victory, drops, XP, fame, or defeat damage.
          returnToTown(s, hero, 'recalled');
        }
        cancelled.push(party.id);
        log(s, 'raid-recall', party.name + ' 토벌 중단 · ' + party.cancelReason, { townId, raidId: party.id, bossId: party.bossId, memberIds: party.memberIds.slice() });
      }
      const finished = s.raidState.parties.filter(p => p.status !== 'fighting');
      if (finished.length > 20) { const old = new Set(finished.slice(0, finished.length - 20).map(p => p.id)); s.raidState.parties = s.raidState.parties.filter(p => !old.has(p.id)); }
      return cancelled;
    }

    function step(s, dt) {
      init(s);
      for (const party of s.raidState.parties.filter(p => p.status === 'fighting')) {
        const boss = bossMap[party.bossId], members = party.memberIds.map(memberId => heroes(s).find(a => a.id === memberId)).filter(Boolean);
        if (members.length !== party.memberIds.length || members.some(a => a.raidId !== party.id)) { finishParty(s, party, 'retreat'); continue; }
        // 위기 순간: the fight stops while the player has 10 real seconds to choose; untouched, it passes with no change.
        const c = party.crisis;
        if (c && !c.chosen && !c.active && party.remaining <= c.at) {
          c.active = true; c.realLeft = CRISIS_SECONDS;
          log(s, 'raid-crisis', boss.name + ' 토벌대가 몰리고 있어요! 10초 안에 지원할 수 있어요.', { townId: party.townId, bossId: boss.id, raidId: party.id });
        }
        if (c && c.active) {
          c.realLeft = Math.max(0, c.realLeft - dt / Math.max(.1, ctx.realRate ? ctx.realRate() : 2));
          if (c.realLeft <= 0) { c.active = false; c.chosen = 'none'; }
          for (const a of members) { a.timer = party.remaining; a.moving = false; }
          continue;
        }
        party.remaining = Math.max(0, party.remaining - dt);
        const support = party.roles.includes('support');
        for (const a of members) {
          const stats = getCombatStats(a), damage = stats.maxHp * (.0015 + boss.minPower / Math.max(1, stats.power) * .0012) * (support ? .72 : 1) * dt;
          a.hp = Math.max(1, a.hp - damage); a.timer = party.remaining; a.moving = false;
        }
        if (members.some(a => a.hp < getCombatStats(a).maxHp * .14)) finishParty(s, party, 'retreat');
        else if (party.remaining <= 1e-7) finishParty(s, party, random(s) < party.successChance ? 'victory' : random(s) < .35 ? 'defeat' : 'retreat');
      }
      for (const offer of s.rareOffers) {
        if (!ACTIVE_OFFERS.has(offer.status)) continue;
        const seller = heroes(s).find(a => a.id === offer.heroId);
        if (!seller || !getTown(s, offer.townId)) { offer.status = 'withdrawn'; continue; }
        if (offer.status === 'pending' && ['visiting', 'resting', 'enhancing'].includes(seller.status)) {
          offer.status = 'open'; offer.openedAt = s.time; if (!(seller.injuryUntil > s.time) && !seller.invasionId) seller.bubble = { type: 'material', material: offer.material, until: s.time + 7 };
          log(s, 'rare-offer', seller.name + '이(가) ' + materialMap[offer.material].name + ' ' + offer.amount + '개를 ' + offer.totalPrice + ' G에 제안합니다.', { townId: offer.townId, adventurerId: seller.id, offerId: offer.id, material: offer.material, amount: offer.amount });
        }
      }
      // Bosses only fight parties the player sends, so say when one is out again (once per appearance, opened towns only).
      if (!object(s.raidState.announced)) s.raidState.announced = {};
      for (const boss of bosses) {
        const at = s.raidState.cooldowns[boss.id] || 0;
        if (s.time < at || s.raidState.announced[boss.id] === at) continue;
        if (s.raidState.parties.some(p => p.bossId === boss.id && p.status === 'fighting')) continue;
        const region = (DATA.regions || []).find(r => r.id === boss.regionId), townId = region && region.townId;
        if (!townId || !getTown(s, townId)) continue;
        s.raidState.announced[boss.id] = at;
        if (at > 0) log(s, 'boss-ready', boss.name + '이(가) ' + (region ? region.name : '사냥터') + '에 나타났어요. 모험가를 골라 보내 보세요.', { townId, bossId: boss.id, regionId: boss.regionId });
      }
      // No automatic boss parties any more (2026-11): the player sends them from the boss window (dispatchParty).
      if (s.time + 1e-7 >= s.raidState.nextAssemblyAt) s.raidState.nextAssemblyAt = s.time + 8;
      const closed = s.rareOffers.filter(o => !ACTIVE_OFFERS.has(o.status));
      if (closed.length > 50) { const old = new Set(closed.slice(0, closed.length - 50).map(o => o.id)); s.rareOffers = s.rareOffers.filter(o => !old.has(o.id)); }
    }

    // The player's answer to a crisis: potion (gold, +12%p, +16%p with a cleric), hold (50/50 ±6%p), or retreat
    // (home unhurt, no reward, the boss returns after half its usual wait).
    function crisisCost(boss) { return Math.max(1, Math.round(boss.gold)); }
    function chooseCrisis(s, bossId, choice) {
      const party = (s.raidState.parties || []).find(p => p.bossId === bossId && p.status === 'fighting');
      const c = party && party.crisis, boss = bossMap[bossId];
      if (!party || !c || !c.active) return result(false, '지금은 지원할 수 없어요.');
      if (choice === 'potion') {
        const cost = crisisCost(boss); if (s.gold < cost) return result(false, '물약 값 ' + cost + ' G가 모자라요.');
        s.gold -= cost; c.delta = party.roles.includes('support') ? .16 : .12;
      } else if (choice === 'hold') c.delta = random(s) < .5 ? .06 : -.06;
      else if (choice !== 'retreat') return result(false, '고를 수 없는 선택이에요.');
      c.active = false; c.chosen = choice;
      if (choice === 'retreat') {
        party.status = 'cancelled'; party.outcome = 'cancelled'; party.remaining = 0; party.finishedAt = s.time; party.cancelReason = '후퇴 명령';
        for (const heroId of party.memberIds) { const a = heroes(s).find(h => h.id === heroId); if (!a) continue; a.raidId = null; a.raidReadyAt = Math.max(a.raidReadyAt || 0, s.time + 65); returnToTown(s, a, 'recalled'); }
        s.raidState.cooldowns[boss.id] = s.time + boss.cooldown / 2;
        log(s, 'raid-recall', boss.name + ' 토벌대에 후퇴를 명령했어요. 모두 다치지 않고 돌아와요.', { townId: party.townId, raidId: party.id, bossId: boss.id, memberIds: party.memberIds.slice() });
        return result(true, '후퇴 명령! 보스는 조금 뒤 다시 나타나요.');
      }
      party.successChance = clamp(party.successChance + c.delta, .05, .96);
      return result(true, choice === 'potion' ? '물약을 보냈어요. 성공률 +' + Math.round(c.delta * 100) + '%p' : c.delta > 0 ? '버텨 냈어요! 성공률 +6%p' : '버티다 밀렸어요… 성공률 −6%p', { successChance: party.successChance });
    }
    function setCrisis(s, on) { init(s); s.raidState.crisisOn = on !== false; return s.raidState.crisisOn; }

    function getRaidParties(s) { return (s.raidState && s.raidState.parties || []).filter(p => p.status === 'fighting'); }
    function getBosses(s) {
      const state = s.raidState || { cooldowns: {}, parties: [] };
      return bosses.map(boss => {
        const party = state.parties.find(p => p.bossId === boss.id && p.status === 'fighting') || null;
        const last = [...state.parties].reverse().find(p => p.bossId === boss.id && p.status !== 'fighting');
        const respawnAt = state.cooldowns[boss.id] || 0;
        const cooldownRemaining = Math.max(0, respawnAt - s.time);
        const reachable = canReach(s.activeTownId, boss.regionId);
        const eligibleCount = reachable ? heroes(s).filter(a => a.townId === s.activeTownId && !dispatchBlock(s, a, boss)).length : 0;
        const region = (DATA.regions || []).find(r => r.id === boss.regionId);
        const townId = region && region.townId || (DATA.towns || []).find(t => canReach(t.id, boss.regionId))?.id || null;
        const worldTownOpened = !!(townId && getTown(s, townId));
        const worldAvailable = worldTownOpened && !party && cooldownRemaining === 0;
        const worldEligibleCount = worldTownOpened ? heroes(s).filter(a => a.townId === townId && !dispatchBlock(s, a, boss)).length : 0;
        const worldReady = worldAvailable && worldEligibleCount > 0;
        const worldStatus = party ? 'fighting' : cooldownRemaining > 0 ? 'cooldown' : worldTownOpened && !worldReady ? 'recruiting' : 'ready';
        return {
          ...boss, materialName: materialMap[boss.materialId].name, cooldownRemaining, respawnAt,
          rareChance: DATA.bossRecipeChance ?? .12, pityLeft: Math.max(1, (DATA.bossRecipePity || 8) - ((state.pity && state.pity[boss.id]) || 0)),
          activeParty: party, battleRemaining: party ? Math.max(0, party.remaining) : 0,
          reachable, available: reachable && !party && cooldownRemaining === 0, eligibleCount,
          ready: reachable && !party && cooldownRemaining === 0 && eligibleCount > 0,
          lastOutcome: last && last.outcome || null, townId, regionName: region && region.name,
          mapX: region && region.mapX, mapY: region && region.mapY,
          regionRecommendedLevel: region && region.recommendedLevel,
          worldStatus, worldTownOpened, worldAvailable, worldEligibleCount, worldReady,
          assemblyRemaining: Math.max(0, (state.nextAssemblyAt || 0) - s.time)
        };
      });
    }
    function listRareOffers(s) {
      return (s.rareOffers || []).filter(o => o.status === 'open' && o.townId === s.activeTownId).map(o => ({ ...o, materialName: materialMap[o.material].name, color: materialMap[o.material].color, sellerName: heroes(s).find(a => a.id === o.heroId)?.name || o.sellerName })).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    }
    function buyRareOffer(s, offerId, amount, townId) {
      const targetTownId = townId || s.activeTownId;
      if (!getTown(s, targetTownId)) return result(false, '운영 중인 마을의 판매 제안을 선택해주세요.');
      const offer = (s.rareOffers || []).find(o => o.id === offerId && o.status === 'open' && o.townId === targetTownId);
      if (!offer) return result(false, '현재 마을의 판매 제안을 선택해주세요.');
      const quantity = amount === undefined ? offer.amount : amount;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > offer.amount) return result(false, '판매 제안의 남은 수량 안에서 매입해주세요.');
      const cost = quantity * offer.unitPrice;
      const seller = heroes(s).find(a => a.id === offer.heroId);
      if (!seller || !object(seller.rareBag) || (seller.rareBag[offer.material] || 0) < offer.amount) return result(false, '모험가에게 남아 있는 재료가 부족합니다.');
      if (s.gold < cost) return result(false, '희귀 재료를 매입할 골드가 부족합니다.');
      if (seller.gold + cost > 1e9) return result(false, '모험가가 더 받을 수 있는 골드를 초과했습니다.');
      if ((s.materials[offer.material] || 0) + quantity > 1e8) return result(false, '재료 보관 한도에 도달했습니다.');
      s.gold -= cost; seller.gold += cost; seller.rareBag[offer.material] -= quantity;
      s.materials[offer.material] = (s.materials[offer.material] || 0) + quantity;
      if (quantity === offer.amount) { offer.status = 'sold'; offer.soldAt = s.time; }
      else { offer.amount -= quantity; offer.totalPrice = offer.unitPrice * offer.amount; }
      s.stats.rarePurchases++;
      log(s, 'rare-purchase', seller.name + '에게 ' + materialMap[offer.material].name + ' ' + quantity + '개 매입 · −' + cost + ' G', { townId: offer.townId, adventurerId: seller.id, offerId: offer.id, material: offer.material, amount: quantity, gold: -cost });
      return result(true, seller.name + '에게 희귀 재료를 매입했습니다.', { material: offer.material, amount: quantity, cost, sellerId: seller.id });
    }

    function normalize(s) { init(s); return s; }
    function validate(s) {
      try {
        const r = s.raidState;
        if (!object(r) || r.version !== 1 || !object(r.cooldowns) || !Array.isArray(r.parties) || r.parties.length > 25 || !finite(r.nextAssemblyAt) || !Array.isArray(s.rareOffers) || s.rareOffers.length > 1200) return false;
        if (Object.keys(r.cooldowns).some(key => !known(bossMap, key))) return false;
        if (bosses.some(b => !finite(r.cooldowns[b.id]))) return false;
        const seen = new Set(), active = new Map();
        for (const p of r.parties) {
          const b = known(bossMap, p.bossId) ? bossMap[p.bossId] : null;
          // Player-sent parties: 1..partySize members, any jobs (older automatic parties also pass).
          if (!b || !safeId(p.id) || seen.has(p.id) || !safeId(p.townId) || p.regionId !== b.regionId || !getTown(s, p.townId) || !Array.isArray(p.memberIds) || p.memberIds.length < 1 || p.memberIds.length > b.partySize || p.memberIds.some(id => !safeId(id)) || new Set(p.memberIds).size !== p.memberIds.length || !Array.isArray(p.roles)) return false;
          if (!Array.isArray(p.members) || p.members.length !== p.memberIds.length || p.members.some((m, i) => !object(m) || m.id !== p.memberIds[i] || !safeId(m.id) || !finite(m.power, 1) || typeof m.name !== 'string' || m.name.length > 80 || typeof m.job !== 'string' || m.job.length > 50 || !['frontline', 'support', 'ranged', 'skirmisher'].includes(m.role)) || p.roles.length !== p.memberIds.length || p.roles.some((role, i) => role !== p.members[i].role)) return false;
          seen.add(p.id);
          if (!finite(p.total, 1, 1000) || !finite(p.remaining, 0, p.total) || !finite(p.successChance, 0, 1) || !finite(p.startedAt) || !finite(p.power, 1) || !finite(p.minPower, 1) || !finite(p.maxPower, p.minPower) || !finite(p.powerRatio, 1)) return false;
          if (!['fighting', 'victory', 'defeat', 'retreat', 'cancelled'].includes(p.status)) return false;
          if (p.crisis !== undefined && (!object(p.crisis) || !finite(p.crisis.at, 0, 1000) || !finite(p.crisis.realLeft, 0, 60) || typeof p.crisis.active !== 'boolean')) return false;
          if (p.status === 'fighting') for (const heroId of p.memberIds) { const a = heroes(s).find(h => h.id === heroId); if (!a || a.raidId !== p.id || a.status !== 'hunting' || a.regionId !== b.regionId || active.has(heroId)) return false; active.set(heroId, p.id); }
        }
        for (const a of heroes(s)) {
          if (!object(a.rareBag) || !finite(a.raidReadyAt) || (a.raidId !== null && active.get(a.id) !== a.raidId)) return false;
          for (const [material, quantity] of Object.entries(a.rareBag)) if (!known(materialMap, material) || !Number.isInteger(quantity) || !finite(quantity, 0, 1e8)) return false;
        }
        const reserved = new Map();
        for (const o of s.rareOffers) {
          if (!object(o) || !safeId(o.id) || seen.has(o.id) || !known(materialMap, o.material) || !safeId(o.heroId) || !safeId(o.townId) || !Number.isInteger(o.amount) || !finite(o.amount, 1, 1e8) || !Number.isInteger(o.unitPrice) || !finite(o.unitPrice, 1, 100000) || o.totalPrice !== o.unitPrice * o.amount || !finite(o.createdAt) || !['pending', 'open', 'sold', 'withdrawn'].includes(o.status)) return false;
          seen.add(o.id);
          if (ACTIVE_OFFERS.has(o.status)) { const a = heroes(s).find(a => a.id === o.heroId); if (!a || a.townId !== o.townId || !getTown(s, o.townId)) return false; const key = o.heroId + ':' + o.material, total = (reserved.get(key) || 0) + o.amount; reserved.set(key, total); if (total > (a.rareBag[o.material] || 0)) return false; }
        }
        return true;
      } catch (_) { return false; }
    }

    return { init, normalize, validate, step, getBosses, getRaidParties, listRareOffers, buyRareOffer, cancelTownRaids, getDispatchInfo, quoteParty, dispatchParty, chooseCrisis, setCrisis, crisisCost: id => bossMap[id] ? crisisCost(bossMap[id]) : 0 };
  }

  const api = { MATERIALS, BOSSES, decorateData, create, roleOf };
  global.ForgeRaids = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
