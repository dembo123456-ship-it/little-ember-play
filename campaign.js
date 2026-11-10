(function (root, factory) {
  'use strict';
  const api = factory(); root.ForgeCampaign = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // These are provisional functional rules. Economic/combat balance is a
  // separate review; existing recipe, hunt, wage and boss rates are untouched.
  const CONFIG = Object.freeze({ firstInvasionGrace: 2400, invasionJitter: 600, nextInvasionMin: 1800, nextInvasionJitter: 1200, battleSeconds: 20, injuryMin: 240, injuryJitter: 120, trainingSeconds: 30, reliefAid: 30 });
  const RANKS = Object.freeze([
    // 2026-11-09: same scale as the branch reputation requirements (1,200 / 6,000 / 18,000 / 40,000).
    { min: 0, name: '마을의 작은 대장간' }, { min: 1800, name: '알려진 대장간' },
    { min: 6000, name: '명망 있는 제작소' }, { min: 18000, name: '왕국의 명장' }, { min: 40000, name: '전설의 대장간' }
  ]);
  const safeId = v => typeof v === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(v);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const finite = (n, lo = 0, hi = 1e12) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  const integer = (n, lo = 0, hi = 1e12) => Number.isInteger(n) && finite(n, lo, hi);
  const point = p => object(p) && finite(p.x, -100, 500) && finite(p.y, -100, 500);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const activePhases = ['recalling', 'battle'];
  function decorateData(DATA) {
    DATA.materials.invasion_ember = { name: '수호의 불씨', color: '#f0b35b', price: 0, minPower: 0, icon: 'crystal', rare: true, buyable: false, source: 'invasion', description: '마을 침공을 함께 막아낸 뒤에만 대장간이 받는 특별한 재료.' };
    DATA.campaign = { ...CONFIG, fameRanks: RANKS.map(r => ({ ...r })) };
  }
  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, getResidents, getCombatStats, getTownLayout, random, int, id, log, result } = ctx;
    const heroes = s => s.adventurers;
    const workers = s => getOwnedTowns(s).flatMap(t => t.staff);
    const findHero = (s, heroId) => heroes(s).find(a => a.id === heroId);
    const findWorker = (s, staffId) => workers(s).find(w => w.id === staffId);
    function initHero(a) {
      if (a.invasionId === undefined) a.invasionId = null;
      if (a.injuryUntil === undefined) a.injuryUntil = 0;
      if (a.medicalCost === undefined) a.medicalCost = 0;
      if (a.recruitRank === undefined) a.recruitRank = 0;
      if (a.pendingEnhancement === undefined) a.pendingEnhancement = null;
      if (a.lastInvasionId === undefined) a.lastInvasionId = null;
    }
    function init(s) {
      if (s.campaign === undefined) s.campaign = { version: 1, nextInvasionAt: s.time + CONFIG.firstInvasionGrace + int(s, 0, CONFIG.invasionJitter), nextRecruitAt: s.time + 180, invasions: [], recruitOffers: [], training: [] };
      for (const a of heroes(s)) initHero(a);
      for (const w of workers(s)) if (w.trainingId === undefined) w.trainingId = null;
      for (const key of ['invasions', 'invasionInjuries', 'invasionWalletLoss', 'reliefSpent', 'trainingSpent', 'recruitHires']) if (s.stats[key] === undefined) s.stats[key] = 0;
      return s;
    }
    // v1/v2 migration calls init explicitly. A v3 import must already carry
    // its campaign state; missing injury/training fields must not erase work.
    function normalize(s) { return s; }
    function getFame(s) {
      const value = s.reputation, rank = RANKS.reduce((chosen, r, i) => value >= r.min ? i : chosen, 0), current = RANKS[rank], next = RANKS[rank + 1];
      return { value, rank, rankName: current.name, nextThreshold: next ? next.min : null, progress: next ? Math.min(1, (value - current.min) / (next.min - current.min)) : 1, description: '우수 이상 품질 제작과 월드 보스 승리로 명성이 높아지면 숙련 모험가와 인재가 찾아옵니다.' };
    }
    function pickRecruit(s, candidates) {
      const desiredCohort = getFame(s).rank * 2;
      return candidates.slice().sort((a, b) => Math.abs(Math.floor((a.recruitOrder || 0) / 20) - desiredCohort) - Math.abs(Math.floor((b.recruitOrder || 0) / 20) - desiredCohort) || (a.recruitOrder || 0) - (b.recruitOrder || 0))[0] || null;
    }
    function newHeroLevel(s, localLevel) { return Math.min(DATA.adventurerMaxLevel || 300, localLevel + getFame(s).rank * 3); }
    function onCraft(s, town, item, worker) {
      const delta = DATA.qualities[item.quality] && DATA.qualities[item.quality].fame || 0;
      if (!delta) return;
      s.reputation += delta;
      log(s, 'fame-craft', DATA.qualities[item.quality].name + ' ' + item.name + ' 완성 · 명성 +' + delta, { townId: town.id, itemId: item.id, recipeId: item.recipeId, quality: item.quality, itemName: item.name, options: (item.options || []).map(o => ({ ...o })), item: JSON.parse(JSON.stringify(item)), craftedBy: worker.name, delta, reputation: s.reputation });
    }
    function onBossVictory(s, party, boss, delta) {
      if(boss.id==='abyss_sovereign')ctx.grantRecipeDrop(s,'world_reward_blade',.05,party.townId);
      // Raids already credited its existing victory reputation amount.
      log(s, 'fame-boss', boss.name + ' 토벌 성공 · 명성 +' + delta, { townId: party.townId, bossId: boss.id, bossName: boss.name, regionId: boss.regionId, delta, reputation: s.reputation, memberIds: party.memberIds.slice(), material: boss.materialId });
    }
    function currentInvasion(s, townId) { return [...s.campaign.invasions].reverse().find(inv => inv.townId === (townId || s.activeTownId)) || null; }
    function isTownBlocked(s, townId) { return !!(s.campaign && s.campaign.invasions.some(inv => inv.townId === townId && activePhases.includes(inv.status))); }
    function getInvasion(s, townId) {
      if (!s.campaign) return null;
      const inv = currentInvasion(s, townId); if (!inv) return null;
      const remaining = inv.injuredIds.map(heroId => findHero(s, heroId)).filter(Boolean).map(a => Math.max(0, a.injuryUntil - s.time));
      return { ...inv, phase: inv.status, arrivedCount: inv.arrivedIds.length, totalMembers: inv.memberIds.length, injuredCount: inv.injuredIds.length, injuryRemaining: Math.max(0, ...remaining), recoveringCount: remaining.filter(n => n > 0).length };
    }
    function triggerInvasion(s, townId) {
      const town = getTown(s, townId || s.activeTownId);
      if (!town) return result(false, '운영 중인 마을을 선택해주세요.');
      if (s.campaign.invasions.some(inv => activePhases.includes(inv.status))) return result(false, '이미 다른 마을의 소집 또는 방어가 진행 중입니다.');
      const residents = getResidents(s, town.id);
      if (!residents.length) return result(false, '방어에 참여할 주민 모험가가 없습니다.');
      const positions = ctx.getRallyPoints(s, town, residents.length);
      if (positions.length < residents.length) return result(false, '주민이 모두 모일 수 있는 이동 공간이 필요합니다.');
      for (let i = 0; i < residents.length; i++) if (!ctx.findPath(town, residents[i], positions[i])) return result(false, '돌아오는 주민의 이동 통로가 막혀 있습니다.');
      const invasion = {
        id: id(s, 'invasion'), townId: town.id, townName: town.name, invaderName: '잿빛 철갑 멧돼지', status: 'recalling',
        memberIds: residents.map(a => a.id), rallyPoints: residents.map((a, i) => ({ heroId: a.id, x: positions[i].x, y: positions[i].y })),
        rallyPoint: { x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length, y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length },
        arrivedIds: [], startedAt: s.time, battleStartedAt: null, battleRemaining: CONFIG.battleSeconds, battleTotal: CONFIG.battleSeconds,
        reward: { material: 'invasion_ember', amount: Math.max(1, Math.ceil(residents.length / 5)) }, rewarded: false,
        injuredIds: [], totalWalletLoss: 0, walletLossByHero: {}, assistedIds: [], reliefFunded: 0, endedAt: null, resolvedAt: null
      };
      ctx.cancelTownRaids(s, town.id, town.name + ' 침공으로 전원 귀환');
      s.campaign.invasions.push(invasion);
      s.campaign.nextInvasionAt = s.time + CONFIG.nextInvasionMin + int(s, 0, CONFIG.nextInvasionJitter);
      for (let i = 0; i < residents.length; i++) { const a = residents[i]; a.invasionId = invasion.id; a.lastInvasionId = invasion.id; ctx.prepareRecall(s, a, positions[i]); }
      s.stats.invasions++;
      log(s, 'invasion-start', town.name + '에 잿빛 철갑 멧돼지이 나타났습니다! 주민 모험가 ' + residents.length + '명을 모두 소집합니다.', { townId: town.id, invasionId: invasion.id, memberIds: invasion.memberIds.slice(), count: residents.length });
      return result(true, '모든 주민 모험가가 자기 마을의 집결지로 이동합니다.', { invasion });
    }
    function finishBattle(s, inv) {
      if (inv.rewarded) return;
      const members = inv.memberIds.map(heroId => findHero(s, heroId)).filter(Boolean);
      const wounded = members.filter(() => random(s) < .75);
      for (const a of members) { if (wounded.length >= Math.ceil(members.length * .6)) break; if (!wounded.includes(a)) wounded.push(a); }
      inv.injuredIds = wounded.map(a => a.id);
      for (const a of members) {
        const injured = wounded.includes(a), combatLoss = Math.min(a.gold, Math.floor(a.gold * (.25 + random(s) * .2)));
        a.gold -= combatLoss;
        const medicalBill = injured ? 40 + a.level * 4 : 0, medicalPaid = Math.min(a.gold, medicalBill);
        a.gold -= medicalPaid; a.medicalCost += medicalBill - medicalPaid;
        inv.walletLossByHero[a.id] = { combatLoss, medicalPaid, total: combatLoss + medicalPaid, medicalDebt: medicalBill - medicalPaid };
        inv.totalWalletLoss += combatLoss + medicalPaid;
        a.invasionId = null; a.huntOutcome = null; a.visitContinuation = false;
        if (injured) {
          a.injuryUntil = Math.max(a.injuryUntil, s.time + CONFIG.injuryMin + int(s, 0, CONFIG.injuryJitter));
          a.hp = Math.max(1, Math.min(a.hp, getCombatStats(a).maxHp * .18)); a.fatigue = Math.max(95, a.fatigue);
          ctx.beginRest(s, a);
        } else {
          a.fatigue = Math.min(100, a.fatigue + 35); a.hp = Math.max(1, a.hp - getCombatStats(a).maxHp * .12);
          ctx.beginRest(s, a);
        }
      }
      ctx.grantRecipeDrop(s,'invasion_reward_shield',.08,inv.townId);
      inv.rewarded = true; inv.status = 'recovery'; inv.endedAt = s.time; inv.battleRemaining = 0;
      s.materials[inv.reward.material] = Math.min(1e8, (s.materials[inv.reward.material] || 0) + inv.reward.amount);
      s.stats.invasionInjuries += wounded.length; s.stats.invasionWalletLoss += inv.totalWalletLoss;
      log(s, 'invasion-end', inv.townName + ' 방어 완료 · 부상 ' + wounded.length + '명 · 모험가 지갑 손실 ' + inv.totalWalletLoss + ' G · 수호의 불씨 +' + inv.reward.amount, { townId: inv.townId, invasionId: inv.id, injuredCount: wounded.length, totalWalletLoss: inv.totalWalletLoss, material: inv.reward.material, amount: inv.reward.amount });
    }
    function stepInvasions(s, dt) {
      for (const inv of s.campaign.invasions) {
        if (inv.status === 'recalling') {
          const town = getTown(s, inv.townId), arrived = [];
          for (const position of inv.rallyPoints) {
            const a = findHero(s, position.heroId); if (!a) continue;
            a.status = 'recalling'; a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'combat', until: s.time + 1 };
            ctx.setDestination(town, a, position);
            if (ctx.moveActor(town, a, dt, 2.6) && dist(a, position) < .08) arrived.push(a.id);
          }
          inv.arrivedIds = arrived;
          if (arrived.length === inv.memberIds.length) {
            inv.status = 'battle'; inv.battleStartedAt = s.time;
            for (const heroId of inv.memberIds) { const a = findHero(s, heroId); a.status = 'defending'; a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'combat', until: s.time + inv.battleTotal + 1 }; ctx.clearRoute(a); }
            log(s, 'invasion-battle', inv.townName + ' 주민 ' + arrived.length + '명이 모두 도착했습니다. 함께 마을을 지킵니다!', { townId: inv.townId, invasionId: inv.id, count: arrived.length });
          }
        } else if (inv.status === 'battle') {
          inv.battleRemaining = Math.max(0, inv.battleRemaining - dt);
          for (const heroId of inv.memberIds) { const a = findHero(s, heroId); if (a) { a.moving = false; a.bubble = { type: a.injuryUntil > s.time ? 'incapacitated' : 'combat', until: s.time + 1 }; } }
          if (inv.battleRemaining <= 1e-7) finishBattle(s, inv);
        } else if (inv.status === 'recovery' && inv.injuredIds.every(heroId => { const a = findHero(s, heroId); return !a || a.injuryUntil <= s.time; })) {
          inv.status = 'resolved'; inv.resolvedAt = s.time;
        }
      }
      if (s.time >= s.campaign.nextInvasionAt && !s.campaign.invasions.some(inv => activePhases.includes(inv.status))) {
        const towns = getOwnedTowns(s).filter(t => getResidents(s, t.id).length > 0);
        if (towns.length) triggerInvasion(s, towns[int(s, 0, towns.length - 1)].id);
        else s.campaign.nextInvasionAt = s.time + 60;
      }
      const ended = s.campaign.invasions.filter(inv => inv.status === 'resolved');
      if (ended.length > 20) { const prune = new Set(ended.slice(0, ended.length - 20).map(inv => inv.id)); s.campaign.invasions = s.campaign.invasions.filter(inv => !prune.has(inv.id)); }
    }
    function getReliefQuote(s, townId) {
      const town = getTown(s, townId || s.activeTownId), inv = town && currentInvasion(s, town.id);
      const eligible = inv && ['recovery', 'resolved'].includes(inv.status) ? inv.injuredIds.filter(heroId => !inv.assistedIds.includes(heroId)).map(heroId => findHero(s, heroId)).filter(a => a && (a.injuryUntil > s.time || a.medicalCost > 0)) : [];
      const cost = eligible.reduce((total, a) => total + 60 + a.medicalCost, 0), walletFull = eligible.some(a => a.gold + CONFIG.reliefAid > 1e9);
      return { ok: eligible.length > 0 && !walletFull && s.gold >= cost, message: walletFull ? '지원 대상의 금화 보관 한도를 초과합니다.' : !eligible.length ? '현재 지원할 침공 부상자가 없습니다.' : s.gold < cost ? '구호 비용 ' + cost + ' G가 필요합니다.' : '치료비와 생활 지원금을 지급하고 남은 회복 시간을 절반으로 줄입니다.', townId: town && town.id, invasionId: inv && inv.id, cost, count: eligible.length, heroIds: eligible.map(a => a.id), aidPerHero: CONFIG.reliefAid, reductionFraction: .5 };
    }
    function fundRelief(s, townId) {
      const quote = getReliefQuote(s, townId); if (!quote.ok) return result(false, quote.message);
      const inv = s.campaign.invasions.find(inv => inv.id === quote.invasionId);
      s.gold -= quote.cost; s.stats.reliefSpent += quote.cost; inv.reliefFunded += quote.cost;
      for (const heroId of quote.heroIds) {
        const a = findHero(s, heroId); a.medicalCost = 0; a.gold += CONFIG.reliefAid;
        a.injuryUntil = s.time + Math.max(0, a.injuryUntil - s.time) * .5;
        a.hp = Math.min(getCombatStats(a).maxHp, a.hp + getCombatStats(a).maxHp * .25); a.fatigue = Math.max(0, a.fatigue - 20);
        inv.assistedIds.push(heroId);
      }
      log(s, 'invasion-relief', inv.townName + ' 부상자 ' + quote.count + '명 구호 · −' + quote.cost + ' G', { townId: inv.townId, invasionId: inv.id, heroIds: quote.heroIds.slice(), count: quote.count, gold: -quote.cost });
      return result(true, '구호금을 지급했습니다. 부상자는 여관에서 남은 회복을 이어갑니다.', quote);
    }
    function getTraining(s, staffId) {
      const active = s.campaign.training.filter(task => task.status === 'studying');
      return staffId ? active.find(task => task.staffId === staffId) || null : active;
    }
    // 2026-11: training raises what the role actually uses — smiths: craft level; sellers: 말솜씨 (eloquence, sale price);
    // buyers, logistics, enhancer and inn staff: 체력 (max stamina, they work longer before resting).
    const TRAIN_STAT = { sales: 'eloquence', buyer: 'stamina', logistics: 'stamina', enhancer: 'stamina', innkeeper: 'stamina' };
    const STAT_TRAINING = { eloquence: { name: '말솜씨', gain: 4, max: 100, cost: v => 50 + Math.round(v * 3) }, stamina: { name: '체력', gain: 10, max: 200, cost: v => 50 + Math.round(v * 1.2) } };
    function getTrainingQuote(s, staffId) {
      const town = getTown(s), worker = town.staff.find(w => w.id === staffId), task = worker && getTraining(s, worker.id);
      if (!worker) return { ok: false, message: '현재 지점의 직원을 선택해주세요.', cost: 0, staffId };
      const stat = TRAIN_STAT[worker.role];
      if (stat) {
        const def = STAT_TRAINING[stat], cur = stat === 'stamina' ? worker.maxStamina : worker.eloquence, maxedStat = cur >= def.max, statCost = def.cost(cur), to = Math.min(def.max, cur + def.gain);
        return { ok: !maxedStat && !task && worker.salaryDebt === 0 && s.gold >= statCost, message: task ? '이 직원은 교육을 받고 있습니다.' : maxedStat ? def.name + '이 최고치에 도달했습니다.' : worker.salaryDebt > 0 ? '미지급 급여를 먼저 정산해주세요.' : s.gold < statCost ? '교육비 ' + statCost + ' G가 필요합니다.' : def.name + '을 올리는 유료 교육입니다. 교육 중에는 일을 쉽니다.', cost: maxedStat ? 0 : statCost, staffId, townId: town.id, stat, statName: def.name, from: cur, to, fromLevel: worker.craftLevel, toLevel: worker.craftLevel, duration: CONFIG.trainingSeconds, activeTraining: task, remaining: task && task.remaining, total: task && task.total };
      }
      const cost = 50 + worker.craftLevel * 25, maxed = worker.craftLevel >= 30;
      return { ok: !maxed && !task && worker.salaryDebt === 0 && s.gold >= cost, message: task ? '이 직원은 교육을 받고 있습니다.' : maxed ? '최고 제작 레벨에 도달했습니다.' : worker.salaryDebt > 0 ? '미지급 급여를 먼저 정산해주세요.' : s.gold < cost ? '교육비 ' + cost + ' G가 필요합니다.' : '제작 레벨을 한 단계 올리는 유료 교육입니다. 교육 중에는 제조·판매를 쉽니다.', cost: maxed ? 0 : cost, staffId, townId: town.id, fromLevel: worker.craftLevel, toLevel: Math.min(30, worker.craftLevel + 1), duration: CONFIG.trainingSeconds, activeTraining: task, remaining: task && task.remaining, total: task && task.total };
    }
    function trainStaff(s, staffId) {
      const q = getTrainingQuote(s, staffId); if (!q.ok) return result(false, q.message);
      const worker = findWorker(s, staffId), town = getTown(s), task = { id: id(s, 'training'), staffId, townId: town.id, status: 'studying', remaining: q.duration, total: q.duration, startedAt: s.time, completedAt: null, cost: q.cost, targetLevel: q.toLevel };
      if (q.stat) { task.stat = q.stat; task.gain = q.to - q.from; delete task.targetLevel; }
      s.gold -= q.cost; s.stats.trainingSpent += q.cost; s.campaign.training.push(task); worker.trainingId = task.id;
      ctx.releaseWorker(town, worker); worker.status = 'training'; ctx.setDestination(town, worker, getTownLayout(s, town.id).restPoint);
      log(s, 'training-start', worker.name + (q.stat ? ' ' + q.statName + ' 교육 시작 · ' + q.from + ' → ' + q.to : ' 제작 교육 시작 · Lv.' + q.fromLevel + ' → ' + q.toLevel) + ' · −' + q.cost + ' G', { townId: town.id, staffId, trainingId: task.id, gold: -q.cost });
      return result(true, worker.name + '의 교육을 시작했습니다.', { task, cost: q.cost });
    }
    function stepTraining(s, dt) {
      for (const task of getTraining(s)) {
        const worker = findWorker(s, task.staffId), town = getTown(s, task.townId); if (!worker || !town) continue;
        worker.status = 'training'; worker.bubble = { type: 'book', until: s.time + 1 };
        ctx.setDestination(town, worker, getTownLayout(s, town.id).restPoint);
        if (!ctx.moveActor(town, worker, dt, 2.8) || worker.salaryDebt > 0) continue;
        task.remaining = Math.max(0, task.remaining - dt); worker.stamina = Math.min(worker.maxStamina, worker.stamina + dt);
        if (task.remaining <= 1e-7) {
          let done;
          if (task.stat === 'eloquence') { worker.eloquence = Math.min(100, worker.eloquence + task.gain); done = '말솜씨 ' + worker.eloquence; }
          else if (task.stat === 'stamina') { worker.maxStamina = Math.min(200, worker.maxStamina + task.gain); worker.stamina = worker.maxStamina; done = '체력 ' + worker.maxStamina; }
          else {
            worker.craftLevel = task.targetLevel; worker.craftXp = 0; done = '제작 Lv.' + worker.craftLevel;
            worker.salary = Math.round(worker.baseSalary * (1 + Math.max(0, worker.craftLevel - (worker.salaryBaseLevel || 1)) * .025));
          }
          worker.trainingId = null; worker.status = 'idle'; worker.bubble = null; ctx.clearRoute(worker);
          task.status = 'completed'; task.completedAt = s.time;
          log(s, 'training-complete', worker.name + '의 교육 완료 · ' + done, { townId: town.id, staffId: worker.id, trainingId: task.id });
        }
      }
      const completed = s.campaign.training.filter(t => t.status === 'completed');
      if (completed.length > 30) { const prune = new Set(completed.slice(0, completed.length - 30).map(t => t.id)); s.campaign.training = s.campaign.training.filter(t => !prune.has(t.id)); }
    }
    function makeRecruitOffer(s, town) {
      const fame = getFame(s), apprentice = fame.rank === 0 || random(s) < .3;
      const level = 1;
      const dexterity = Math.min(95, 32 + fame.rank * 11 + int(s, 0, 12)), eloquence = 25 + int(s, 0, 35), salary = 90 + level * 24 + fame.rank * 35;
      const name = (apprentice ? '견습 ' : '장인 ') + ['아린', '도윤', '미하', '엘린', '테스', '루카'][int(s, 0, 5)];
      const offer = { id: id(s, 'recruit'), townId: town.id, name, kind: apprentice ? 'apprentice' : 'employee', role: 'smith', craftLevel: level, dexterity, eloquence, maxStamina: 100 + fame.rank * 5, salary, cost: 180 + level * 65 + fame.rank * 80, requiredFame: RANKS[fame.rank].min, rank: fame.rank, spriteIndex: apprentice ? 105 : level >= 20 ? 104 : level >= 10 ? 101 : 100, status: 'available', createdAt: s.time, expiresAt: s.time + 600 };
      const rankRoll=(s.rng>>>0)%100, potentialGrade=rankRoll<1?'S':rankRoll<5?'A':rankRoll<15?'B':rankRoll<40?'C':rankRoll<70?'D':rankRoll<90?'E':'F',factor={S:1.5,A:1.3,B:1.15,C:1,D:.85,E:.7,F:.5}[potentialGrade];
      offer.potentialGrade=potentialGrade;offer.dexterity=Math.round(Math.min(offer.dexterity,66)*factor);offer.eloquence=Math.round(Math.min(offer.eloquence,66)*factor);offer.maxStamina=Math.round(offer.maxStamina*factor);
      if (ctx.ensureIdentity) ctx.ensureIdentity(s, offer, 'staff', { premium: fame.rank >= 3 });
      if (ctx.personalityEffect) offer.salary = Math.max(1, Math.round(offer.salary * ctx.personalityEffect(offer, 'staffSalary')));
      offer.salaryTraitApplied = true;
      s.campaign.recruitOffers.push(offer);
      log(s, 'recruit-arrival', offer.name + '이(가) 소문을 듣고 찾아왔습니다 · 제작 Lv.' + level + ' · 월급 ' + offer.salary + ' G', { townId: town.id, offerId: offer.id, name: offer.name, craftLevel: level, salary: offer.salary, rank: fame.rank });
      return offer;
    }
    function getRecruitOffers(s) { return s.campaign.recruitOffers.filter(o => o.status === 'available' && o.expiresAt > s.time && o.townId === s.activeTownId); }
    function hireRecruit(s, offerId) {
      const offer = getRecruitOffers(s).find(o => o.id === offerId), town = getTown(s);
      if (!offer) return result(false, '현재 마을을 방문 중인 인재를 선택해주세요.');
      if (town.staff.length >= 30) return result(false, '한 지점에 직원은 30명까지 고용할 수 있습니다.');
      if (s.gold < offer.cost) return result(false, '고용비 ' + offer.cost + ' G가 필요합니다.');
      const candidate = { id: offer.kind === 'apprentice' ? 'apprentice' : offer.craftLevel >= 20 ? 'master' : offer.craftLevel >= 10 ? 'artisan' : 'smith', name: offer.name, role: offer.role, craftLevel: offer.role === 'smith' ? 1 : offer.craftLevel, dexterity: offer.dexterity, eloquence: offer.eloquence, craftSkill: offer.dexterity, salesSkill: offer.eloquence, stamina: offer.maxStamina, salary: offer.salary, spriteIndex: offer.spriteIndex };
      candidate.potentialGrade=offer.potentialGrade||'C';if(offer.gradeLegacy)candidate.gradeLegacy=true;
      if (offer.identityVersion) for (const key of ['identityVersion', 'baseName', 'traitId', 'name']) candidate[key] = offer[key];
      // Offers loaded from older saves keep the displayed salary as agreed.
      candidate.salaryTraitApplied = true;
      const worker = ctx.createStaff(s, town, candidate, offer.name); worker.recruitedOfferId = offer.id;
      town.staff.push(worker); s.gold -= offer.cost; s.stats.recruitHires++; offer.status = 'hired'; offer.hiredAt = s.time; offer.staffId = worker.id;
      log(s, 'recruit-hired', offer.name + ' 고용 · 제작 Lv.' + worker.craftLevel + ' · −' + offer.cost + ' G', { townId: town.id, staffId: worker.id, offerId, gold: -offer.cost });
      return result(true, offer.name + '이(가) 대장간 직원이 되었습니다.', { staff: worker, cost: offer.cost });
    }
    function stepRecruitment(s) {
      for (const offer of s.campaign.recruitOffers) if (offer.status === 'available' && offer.expiresAt <= s.time) offer.status = 'expired';
      if (s.time >= s.campaign.nextRecruitAt) {
        s.campaign.nextRecruitAt = s.time + 180;
        for (const town of getOwnedTowns(s)) if (!isTownBlocked(s, town.id) && s.campaign.recruitOffers.filter(o => o.townId === town.id && o.status === 'available').length < 2) makeRecruitOffer(s, town);
      }
      const old = s.campaign.recruitOffers.filter(o => o.status !== 'available');
      if (old.length > 30) { const prune = new Set(old.slice(0, old.length - 30).map(o => o.id)); s.campaign.recruitOffers = s.campaign.recruitOffers.filter(o => !prune.has(o.id)); }
    }
    function getGoldSinks(s) {
      const town = getTown(s), staff = town.staff.find(w => w.craftLevel < 30 && !w.trainingId), training = staff && getTrainingQuote(s, staff.id), relief = getReliefQuote(s), offer = getRecruitOffers(s)[0], payroll = ctx.getPayroll(s);
      const choices = [
        { id: 'training', label: '직원 제작 교육', description: '교육 시간 동안 작업을 쉬고 제작 레벨을 올립니다.', cost: training ? training.cost : null, action: 'train-staff', targetId: staff && staff.id, available: !!(training && training.ok) },
        { id: 'relief', label: '침공 후 구호', description: '치료비·생활비 지원과 회복 시간 단축.', cost: relief.cost || null, action: 'fund-relief', available: relief.ok },
        { id: 'recruit', label: '방문 인재 고용', description: '명성을 듣고 찾아온 직원의 기술과 월급을 비교하세요.', cost: offer ? offer.cost : null, action: 'hire-recruit', targetId: offer && offer.id, available: !!offer && s.gold >= offer.cost },
        { id: 'inn', label: '여관 증축', description: '침대를 늘려 새 모험가가 머물게 합니다.', cost: ctx.getInnUpgradeCost(s), action: 'upgrade-inn' },
        { id: 'shop', label: '대장간 확장', description: '레벨이 오르면 화덕·진열대를 더 놓을 수 있어요.', cost: ctx.getExpansionCost(s), action: 'expand-shop' },
        { id: 'warehouse', label: '창고 확장', description: '장비 보관량과 재료별 자동 매입 한도, 실제 창고 면적을 늘립니다.', cost: (DATA.warehouseLevels || []).find(row => row.level === (town.warehouseLevel || 1))?.upgradeCost ?? null, action: 'upgrade-warehouse' },
        { id: 'wages', label: '미지급 급여 정산', description: '월급이 밀린 직원이 작업에 복귀합니다.', cost: payroll && payroll.totalDebt || null, action: 'pay-wages' },
        { id: 'furnace', label: '화덕 추가', description: '제작 대기열을 늘립니다. 별도 제조 직원이 필요합니다.', cost: ctx.getBuildCost(s, 'furnace'), action: 'place-furnace' },
        { id: 'display', label: '진열대 추가', description: '직접 판매에 올릴 수 있는 장비 수를 늘립니다.', cost: ctx.getBuildCost(s, 'display'), action: 'place-display' }
      ];
      return choices.map(c => ({ ...c, townId: town.id, available: c.available == null ? c.cost != null && c.cost > 0 && s.gold >= c.cost : c.available }));
    }
    function step(s, dt) {
      stepInvasions(s, dt); stepTraining(s, dt); stepRecruitment(s);
      for (const a of heroes(s)) if (a.medicalCost > 0 && a.gold > 0 && !a.invasionId) { const payment = Math.min(a.gold, a.medicalCost); a.gold -= payment; a.medicalCost -= payment; }
    }
    function validate(s) {
      try {
        const c = s.campaign;
        if (!object(c) || c.version !== 1 || !finite(c.nextInvasionAt) || !finite(c.nextRecruitAt) || !Array.isArray(c.invasions) || c.invasions.length > 25 || !Array.isArray(c.recruitOffers) || c.recruitOffers.length > 50 || !Array.isArray(c.training) || c.training.length > 180) return false;
        const coreIds = [];
        for (const town of getOwnedTowns(s)) for (const values of [town.staff, town.facilities, town.queue, town.inventory]) coreIds.push(...values.map(v => v.id));
        for (const hero of heroes(s)) { coreIds.push(hero.id); coreIds.push(...Object.values(hero.equipment).filter(Boolean).map(item => item.id)); }
        for (const values of [s.quests, s.orders, s.raidState.parties, s.rareOffers, s.festival.entries]) coreIds.push(...values.map(v => v.id));
        const seen = new Set(coreIds), occupied = new Set();
        const unique = value => { if (!safeId(value) || seen.has(value)) return false; seen.add(value); return true; };
        const record = v => object(v) && Object.keys(v).every(safeId);
        for (const inv of c.invasions) {
          if (!object(inv) || !unique(inv.id) || !getTown(s, inv.townId) || !['recalling', 'battle', 'recovery', 'resolved'].includes(inv.status) || !Array.isArray(inv.memberIds) || !inv.memberIds.length || inv.memberIds.length > 100 || inv.memberIds.some(v => !safeId(v)) || new Set(inv.memberIds).size !== inv.memberIds.length || !Array.isArray(inv.rallyPoints) || inv.rallyPoints.length !== inv.memberIds.length || !point(inv.rallyPoint)) return false;
          if (inv.rallyPoints.some((p, i) => !point(p) || p.heroId !== inv.memberIds[i]) || new Set(inv.rallyPoints.map(p => p.x + ',' + p.y)).size !== inv.memberIds.length || !Array.isArray(inv.arrivedIds) || new Set(inv.arrivedIds).size !== inv.arrivedIds.length || inv.arrivedIds.some(heroId => !inv.memberIds.includes(heroId))) return false;
          if (!finite(inv.startedAt, 0, s.time) || !finite(inv.battleTotal, 1, 1000) || !finite(inv.battleRemaining, 0, inv.battleTotal) || typeof inv.rewarded !== 'boolean' || !object(inv.reward) || inv.reward.material !== 'invasion_ember' || !integer(inv.reward.amount, 1, 1000) || !Array.isArray(inv.injuredIds) || new Set(inv.injuredIds).size !== inv.injuredIds.length || inv.injuredIds.some(heroId => !inv.memberIds.includes(heroId)) || !integer(inv.totalWalletLoss) || !record(inv.walletLossByHero) || !Array.isArray(inv.assistedIds) || new Set(inv.assistedIds).size !== inv.assistedIds.length || inv.assistedIds.some(heroId => !inv.injuredIds.includes(heroId)) || !integer(inv.reliefFunded)) return false;
          if (activePhases.includes(inv.status)) {
            if (inv.rewarded || inv.injuredIds.length || Object.keys(inv.walletLossByHero).length || inv.totalWalletLoss) return false;
            if (getResidents(s, inv.townId).some(a => !inv.memberIds.includes(a.id))) return false;
            for (const p of inv.rallyPoints) {
              const a = findHero(s, p.heroId);
              if (!a || a.townId !== inv.townId || !a.resident || a.invasionId !== inv.id || a.raidId || occupied.has(a.id) || a.status !== (inv.status === 'battle' ? 'defending' : 'recalling')) return false;
              occupied.add(a.id);
              if (inv.arrivedIds.includes(a.id) && dist(a, p) >= .08) return false;
              if (!ctx.findPath(getTown(s, inv.townId), getTownLayout(s, inv.townId).entrance, p)) return false;
              if (inv.status === 'battle' && (a.path.length || a.destination !== null || a.moving)) return false;
            }
            if (inv.status === 'battle' && (inv.arrivedIds.length !== inv.memberIds.length || !finite(inv.battleStartedAt, inv.startedAt, s.time))) return false;
            if (inv.status === 'recalling' && inv.battleStartedAt !== null) return false;
          } else {
            if (!inv.rewarded || !finite(inv.battleStartedAt, inv.startedAt, s.time) || !finite(inv.endedAt, inv.battleStartedAt, s.time) || inv.battleRemaining !== 0 || inv.memberIds.some(heroId => !Object.hasOwn(inv.walletLossByHero, heroId))) return false;
            if (inv.status === 'resolved' && !finite(inv.resolvedAt, inv.endedAt, s.time)) return false;
            let total = 0;
            for (const [heroId, loss] of Object.entries(inv.walletLossByHero)) { if (!inv.memberIds.includes(heroId) || !object(loss) || !integer(loss.combatLoss) || !integer(loss.medicalPaid) || !integer(loss.medicalDebt) || loss.total !== loss.combatLoss + loss.medicalPaid) return false; total += loss.total; }
            if (total !== inv.totalWalletLoss) return false;
          }
        }
        const activeTraining = new Set();
        for (const task of c.training) {
          // Craft training carries targetLevel; stat training (말솜씨 / 체력) carries stat and gain instead.
          const statTask = task.stat !== undefined;
          if (statTask && (!['eloquence', 'stamina'].includes(task.stat) || !integer(task.gain, 1, 50) || task.targetLevel !== undefined)) return false;
          if (!object(task) || !unique(task.id) || !getTown(s, task.townId) || !safeId(task.staffId) || !['studying', 'completed'].includes(task.status) || (!statTask && !integer(task.targetLevel, 2, 30)) || !integer(task.cost, 1, 1e7) || !finite(task.startedAt, 0, s.time) || !finite(task.total, 1, 1000) || !finite(task.remaining, 0, task.total)) return false;
          if (task.status === 'studying') { const w = getTown(s, task.townId).staff.find(w => w.id === task.staffId); if (!w || w.trainingId !== task.id || w.status !== 'training' || (!statTask && task.targetLevel !== w.craftLevel + 1) || activeTraining.has(w.id)) return false; activeTraining.add(w.id); }
          else if (!finite(task.completedAt, task.startedAt, s.time) || task.remaining !== 0) return false;
        }
        for (const offer of c.recruitOffers) {
          if (!object(offer) || !unique(offer.id) || !getTown(s, offer.townId) || typeof offer.name !== 'string' || offer.name.length > 80 || !['employee', 'apprentice'].includes(offer.kind) || !['smith', 'sales'].includes(offer.role) || !integer(offer.craftLevel, 1, 30) || !finite(offer.dexterity, 0, 100) || !finite(offer.eloquence, 0, 100) || !finite(offer.maxStamina, 1, 1000) || !integer(offer.salary, 1, 1e6) || !integer(offer.cost, 1, 1e7) || !integer(offer.requiredFame) || !integer(offer.rank, 0, 4) || !integer(offer.spriteIndex, 0, 1000) || !['available', 'hired', 'expired'].includes(offer.status) || !finite(offer.createdAt, 0, s.time) || !finite(offer.expiresAt, offer.createdAt)) return false;
          if (offer.status === 'hired' && (!safeId(offer.staffId) || !finite(offer.hiredAt, offer.createdAt, s.time))) return false;
        }
        for (const a of heroes(s)) {
          if (['recalling', 'defending'].includes(a.status) !== !!a.invasionId) return false;
          if (a.invasionId !== null && !occupied.has(a.id) || !finite(a.injuryUntil) || !integer(a.medicalCost) || !integer(a.recruitRank, 0, 4) || a.lastInvasionId !== null && !safeId(a.lastInvasionId)) return false;
          if (a.pendingEnhancement !== null) { const p = a.pendingEnhancement; if (a.enhancement || !object(p) || !p.paid || !['weapon', 'offhand', 'armor', 'accessory'].includes(p.slot) || !a.equipment[p.slot] || a.equipment[p.slot].id !== p.itemId || a.equipment[p.slot].recipeId === 'starter' || a.equipment[p.slot].enhance >= DATA.enhancement.maxLevel || !finite(p.remaining, 0, 3) || p.total !== 3 || !integer(p.fee, 1, 10000) || !integer(p.stones, 1, 100) || !finite(p.successRate, 0, 1)) return false; }
        }
        for (const w of workers(s)) if (w.trainingId !== null && !activeTraining.has(w.id)) return false;
        return ['invasions', 'invasionInjuries', 'invasionWalletLoss', 'reliefSpent', 'trainingSpent', 'recruitHires'].every(key => integer(s.stats[key]));
      } catch (_) { return false; }
    }
    return { init, initHero, normalize, validate, step, getInvasion, triggerInvasion, isTownBlocked, getFame, pickRecruit, newHeroLevel, onCraft, onBossVictory, getRecruitOffers, hireRecruit, getTraining, getTrainingQuote, trainStaff, getReliefQuote, fundRelief, getGoldSinks };
  }
  return { CONFIG, RANKS, decorateData, create };
});
