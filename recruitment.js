(function (root, factory) {
  'use strict';
  const api = factory();
  root.ForgeRecruitment = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This clock is explicitly supplied by the application. It is independent
  // of simulation time, speed, rendering frames, and the engine's random seed.
  const VERSION = 1;
  const REFRESH_MS = 600000;
  const PREMIUM_COOLDOWN_MS = 120000;
  const BASIC_COUNT = 6;
  const PREMIUM_COUNT = 3;
  const MAX_CANDIDATES = 12;
  const MAX_STAFF = 30;
  const PREMIUM_TALENT_CHANCE = .2;
  const ROLES = ['smith', 'sales', 'buyer', 'logistics', 'enhancer', 'innkeeper'];
  const GRADES = ['regular', 'talented', 'expert'];
  const MAX_TIME = Number.MAX_SAFE_INTEGER - REFRESH_MS;
  const own = (o, key) => !!o && Object.prototype.hasOwnProperty.call(o, key);
  const record = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
  const stamp = n => integer(n, 0, MAX_TIME);
  const safeId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(id);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const clone = value => JSON.parse(JSON.stringify(value));

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, createStaff } = ctx;
    const result = ctx.result || ((ok, message, extra) => Object.assign({ ok, message }, extra || {}));
    const log = ctx.log || (() => {});
    const templates = new Map((DATA.staffCandidates || []).map(candidate => [candidate.id, candidate]));
    const towns = s => getOwnedTowns(s).filter(Boolean);
    const premiumCost = townId => 600 * (Math.max(0, (DATA.towns || []).findIndex(town => town.id === townId)) + 1);

    function random(s) {
      const state = s.recruitment;
      state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
      return state.rng / 4294967296;
    }
    function roll(s, low, high) { return low + Math.floor(random(s) * (high - low + 1)); }
    function pick(s, list) { return list[roll(s, 0, list.length - 1)]; }
    function id(s) { return 'staff-offer-' + (++s.seq); }
    function timeNow(state, nowMs) {
      // A backwards system clock freezes the observed time instead of granting
      // extra refreshes or shortening a paid advertisement's cooldown.
      return Math.max(state.lastObservedAt, stamp(nowMs) ? nowMs : state.lastObservedAt);
    }
    function fameRank(s) { return s.reputation >= 40000 ? 4 : s.reputation >= 18000 ? 3 : s.reputation >= 6000 ? 2 : s.reputation >= 1800 ? 1 : 0; } // same scale as campaign fame ranks (2026-11-09)
    function templateFor(role, grade) {
      const preferred = grade === 'expert' ? 'master' : grade === 'talented' ? 'artisan' : role === 'smith' ? 'smith' : role === 'sales' ? 'seller' : 'helper';
      return templates.get(preferred) || templates.get(role === 'sales' ? 'seller' : 'smith') || templates.values().next().value;
    }
    // A look from the role's pool, chosen from the running id counter (no extra random draw, so boards stay reproducible).
    function lookFor(s, role, grade, template) {
      if (grade === 'expert' && role === 'smith') return template.spriteIndex || 104;
      const pool = (DATA.staffLooks && DATA.staffLooks[role]) || [];
      return pool.length ? pool[(s.seq * 7 + role.length) % pool.length] : (template.spriteIndex || 100);
    }
    function ensureIdentity(s, actor, premium) {
      if (ctx.personality && typeof ctx.personality.ensure === 'function') ctx.personality.ensure(s, actor, 'staff', { premium: !!premium });
    }

    function makeCandidate(s, town, role, source, at, forceRegular) {
      const premium = source === 'premium';
      const talented = !forceRegular && random(s) < (premium ? PREMIUM_TALENT_CHANCE : .035);
      const grade = talented ? (random(s) < .15 ? 'expert' : 'talented') : 'regular';
      const template = templateFor(role, grade);
      const region = Math.max(0, (DATA.towns || []).findIndex(t => t.id === town.id));
      const bonus = Math.min(4, region) + Math.min(2, Math.floor(fameRank(s) / 2));
      const craftLevel = role === 'smith' ? 1 : grade === 'expert' ? roll(s, 20, 24) : grade === 'talented' ? roll(s, 10, 19) : clamp(roll(s, 1, premium ? 6 : 5) + bonus, 1, 11);
      const skillBoost = grade === 'expert' ? 25 : grade === 'talented' ? 15 : premium ? 5 : 0;
      let dexterity = clamp(roll(s, role === 'smith' ? 42 : 25, role === 'smith' ? 64 : 49) + skillBoost + bonus, 0, 100);
      let eloquence = clamp(roll(s, role === 'sales' ? 52 : 25, role === 'sales' ? 74 : 50) + skillBoost + bonus, 0, 100);
      let maxStamina = roll(s, 90, 120) + (grade === 'expert' ? 25 : grade === 'talented' ? 15 : 0);
      const rankRoll=random(s),potentialGrade=rankRoll<.01?'S':rankRoll<.05?'A':rankRoll<.15?'B':rankRoll<.40?'C':rankRoll<.70?'D':rankRoll<.90?'E':'F';
      const factor={S:1.5,A:1.3,B:1.15,C:1,D:.85,E:.7,F:.5}[potentialGrade];
      dexterity=Math.round(Math.min(dexterity,66)*factor);eloquence=Math.round(Math.min(eloquence,66)*factor);maxStamina=Math.round(maxStamina*factor);
      const templateLevel = template.craftLevel || 1;
      const templateDexterity = template.dexterity ?? template.craftSkill ?? 40;
      const templateEloquence = template.eloquence ?? template.salesSkill ?? 30;
      const skillPremium = Math.max(0, dexterity - templateDexterity) * 3 + Math.max(0, eloquence - templateEloquence) * 3;
      const cost = Math.max(100, Math.round((template.cost || 180) * (.9 + random(s) * .2) + Math.max(0, craftLevel - templateLevel) * 22 + skillPremium));
      const rawSalary = Math.max(60, Math.round((template.salary || 100) * (1 + Math.max(0, craftLevel - templateLevel) * .035) + skillPremium * .12));
      const candidate = {
        id: id(s), candidateId: template.id, townId: town.id, role,
        name: template.name || '새 지원자', spriteIndex: lookFor(s, role, grade, template),
        craftLevel, dexterity, eloquence, craftSkill: dexterity, salesSkill: eloquence,
        stamina: maxStamina, maxStamina, cost, rawSalary, salary: rawSalary,
        grade, potentialGrade, talent: talented, source, createdAt: at,
        expiresAt: at > 0 ? at + REFRESH_MS : 0,
        salaryTraitApplied: true
      };
      ensureIdentity(s, candidate, premium);
      const salaryEffect = ctx.personality && typeof ctx.personality.effect === 'function' ? ctx.personality.effect(candidate, 'staffSalary') : 1;
      candidate.salary = Math.max(1, Math.round(rawSalary * (Number.isFinite(salaryEffect) && salaryEffect > 0 ? salaryEffect : 1)));
      candidate.baseSalary = candidate.salary;
      return candidate;
    }

    function basicCandidates(s, town, at, count, firstBatch) {
      // Keep the first board useful for a new shop: two makers, one seller,
      // purchasing, logistics, and one further support role.
      const roles = ['smith', 'smith', 'sales', 'buyer', 'logistics', pick(s, ['enhancer', 'innkeeper'])];
      return roles.slice(0, count).map((role, index) => makeCandidate(s, town, role, 'basic', at, firstBatch || index === 0));
    }
    function newBoard(s, town, at) {
      return {
        townId: town.id, cycle: 1, generatedAt: at,
        nextRefreshAt: at > 0 ? at + REFRESH_MS : 0,
        premiumReadyAt: 0,
        candidates: basicCandidates(s, town, at, BASIC_COUNT, true)
      };
    }
    function initialize(s, nowMs = 0) {
      if (!record(s) || !integer(s.seq, 0, Number.MAX_SAFE_INTEGER - 100000)) return s;
      if (!own(s, 'recruitment')) {
        const at = stamp(nowMs) && nowMs > 0 ? nowMs : 0;
        s.recruitment = { version: VERSION, rng: ((s.rng >>> 0) ^ 0x9e3779b9) >>> 0, armed: at > 0, lastObservedAt: at, boards: {} };
      }
      if (!validate(s)) return s;
      const recruitment = s.recruitment;
      const at = recruitment.armed ? recruitment.lastObservedAt : 0;
      for (const town of towns(s)) if (!own(recruitment.boards, town.id)) recruitment.boards[town.id] = newBoard(s, town, at);
      return s;
    }
    function normalize(s, nowMs = 0) {
      // Loading never rerolls a valid board. The app's next real-clock update
      // handles expiry once, after the saved state has been validated.
      return initialize(s, nowMs);
    }
    function advance(s, nowMs = Date.now()) {
      initialize(s, 0);
      if (!validate(s) || !record(s.recruitment)) return result(false, '채용 정보의 형식을 확인해주세요.');
      const recruitment = s.recruitment, now = timeNow(recruitment, nowMs);
      if (!recruitment.armed) {
        if (now <= 0) return result(true, '채용 시계를 준비하고 있습니다.', { refreshed: [] });
        recruitment.armed = true; recruitment.lastObservedAt = now;
        for (const board of Object.values(recruitment.boards)) {
          board.generatedAt = now; board.nextRefreshAt = now + REFRESH_MS;
          for (const candidate of board.candidates) { candidate.createdAt = now; candidate.expiresAt = now + REFRESH_MS; }
        }
        return result(true, '채용 공고를 시작했습니다.', { refreshed: [] });
      }
      recruitment.lastObservedAt = now;
      const refreshed = [];
      for (const town of towns(s)) {
        const board = recruitment.boards[town.id];
        board.candidates = board.candidates.filter(candidate => candidate.expiresAt > now);
        if (now >= board.nextRefreshAt) {
          // Paid applicants keep their own full ten-minute application window,
          // even when the ordinary bulletin refreshes a moment after purchase.
          const premium = board.candidates.filter(candidate => candidate.source === 'premium');
          board.cycle++;
          board.generatedAt = now; board.nextRefreshAt = now + REFRESH_MS;
          board.candidates = premium.concat(basicCandidates(s, town, now, Math.min(BASIC_COUNT, MAX_CANDIDATES - premium.length), false));
          refreshed.push(town.id);
        }
      }
      return result(true, refreshed.length ? '새 지원자가 채용 공고를 보고 찾아왔습니다.' : '채용 공고를 확인했습니다.', { refreshed });
    }

    function getBoard(s, townId, nowMs = Date.now()) {
      const town = getTown(s, townId), recruitment = s && s.recruitment;
      if (!town || !recruitment || !validate(s) || !own(recruitment.boards, town.id)) return { valid: false, townId: town && town.id || townId || null, candidates: [], message: '채용 공고를 준비하고 있습니다.' };
      const board = recruitment.boards[town.id], now = timeNow(recruitment, nowMs);
      const remaining = recruitment.armed ? Math.max(0, board.nextRefreshAt - now) : REFRESH_MS;
      const candidates = board.candidates.filter(candidate => !recruitment.armed || candidate.expiresAt > now).map(candidate => ({
        ...clone(candidate), remainingMs: recruitment.armed ? Math.max(0, candidate.expiresAt - now) : REFRESH_MS,
        canHire: s.gold >= candidate.cost && town.staff.length < MAX_STAFF,
        gradeName: candidate.grade === 'expert' ? '명장 후보' : candidate.grade === 'talented' ? '숙련 인재' : '일반 지원자'
      }));
      const cost = premiumCost(town.id), cooldownRemainingMs = Math.max(0, board.premiumReadyAt - now);
      const room = MAX_CANDIDATES - candidates.length;
      const reason = town.staff.length >= MAX_STAFF ? '이 지점의 직원 정원 30명이 가득 찼습니다.' : cooldownRemainingMs > 0 ? '이전 고급 공고의 지원자를 기다려주세요.' : room < PREMIUM_COUNT ? '지원자 자리를 3칸 이상 비워주세요.' : s.gold < cost ? '고급 공고료 ' + cost + ' G가 필요합니다.' : null;
      return {
        valid: true, townId: town.id, townName: town.name, armed: recruitment.armed,
        cycle: board.cycle, lastObservedAt: recruitment.lastObservedAt,
        generatedAt: board.generatedAt, nextRefreshAt: board.nextRefreshAt,
        refreshInMs: remaining, basicRefreshInMs: remaining,
        refreshDue: recruitment.armed && now >= board.nextRefreshAt,
        intervalMs: REFRESH_MS, maxCandidates: MAX_CANDIDATES, maxStaff: MAX_STAFF,
        currentStaff: town.staff.length, candidates,
        premium: { cost, readyAt: board.premiumReadyAt, cooldownMs: PREMIUM_COOLDOWN_MS,
          cooldownRemainingMs, applicantCount: PREMIUM_COUNT, talentChance: PREMIUM_TALENT_CHANCE,
          canPost: !reason, reason }
      };
    }

    function postPremium(s, townId, nowMs = Date.now()) {
      const advanced = advance(s, nowMs);
      if (!advanced.ok) return advanced;
      const town = getTown(s, townId), view = getBoard(s, townId, nowMs);
      if (!town || !view.valid) return result(false, '공고를 낼 지점을 선택해주세요.');
      if (!view.premium.canPost) return result(false, view.premium.reason);
      const recruitment = s.recruitment, board = recruitment.boards[town.id], now = recruitment.lastObservedAt;
      if (!recruitment.armed) return result(false, '실제 시간을 확인한 뒤 공고를 낼 수 있습니다.');
      const applicants = [];
      for (let i = 0; i < PREMIUM_COUNT; i++) applicants.push(makeCandidate(s, town, pick(s, ['smith', 'smith', 'smith', 'sales', 'sales', 'buyer', 'logistics', 'enhancer', 'innkeeper']), 'premium', now, false));
      s.gold -= view.premium.cost;
      board.premiumReadyAt = now + PREMIUM_COOLDOWN_MS;
      board.candidates.push(...applicants);
      log(s, 'recruitment-ad', town.name + ' 고급 채용 공고 · 지원자 ' + PREMIUM_COUNT + '명 · −' + view.premium.cost + ' G', { townId: town.id, gold: -view.premium.cost });
      return result(true, '고급 공고를 보고 새 지원자 3명이 찾아왔습니다. 각 지원자는 실제 10분 동안 기다립니다.', { cost: view.premium.cost, candidates: clone(applicants), board: getBoard(s, town.id, now) });
    }

    function hireCandidate(s, offerId, townId, nowMs = Date.now()) {
      const advanced = advance(s, nowMs);
      if (!advanced.ok) return advanced;
      const town = getTown(s, townId), board = town && s.recruitment.boards[town.id];
      if (!town || !board) return result(false, '지원자가 방문한 지점을 선택해주세요.');
      const offer = board.candidates.find(candidate => candidate.id === offerId && candidate.expiresAt > s.recruitment.lastObservedAt);
      if (!offer) return result(false, '이 지원자의 모집 기간이 끝났거나 이미 고용했습니다. 현재 공고에서 선택해주세요.');
      if (town.staff.length >= MAX_STAFF) return result(false, '한 지점에 직원은 30명까지 고용할 수 있습니다.');
      if (s.gold < offer.cost) return result(false, '고용비 ' + offer.cost + ' G가 필요합니다.');
      const template = templates.get(offer.candidateId);
      if (!template) return result(false, '지원자의 직종 정보를 확인해주세요.');
      const candidate = { ...template, ...offer, id: offer.candidateId, stamina: offer.maxStamina, craftLevel: offer.role === 'smith' ? 1 : offer.craftLevel };
      const worker = createStaff(s, town, candidate, offer.name);
      for (const key of ['baseName', 'traitId', 'identityVersion', 'name']) if (own(offer, key)) worker[key] = offer[key];
      ensureIdentity(s, worker, offer.source === 'premium');
      // The displayed salary is the contract salary. Do not apply a personality
      // discount a second time after createStaff has copied the offer.
      worker.salary = offer.salary; worker.baseSalary = offer.salary;
      worker.salaryBaseLevel = worker.craftLevel; worker.salaryTraitApplied = true;
      worker.candidateId = offer.candidateId; worker.recruitedOfferId = offer.id;
      worker.spriteIndex = offer.spriteIndex;
      town.staff.push(worker); s.gold -= offer.cost;
      board.candidates.splice(board.candidates.indexOf(offer), 1);
      log(s, 'recruitment-hire', offer.name + ' 고용 · 제작 Lv.' + worker.craftLevel + ' · 월급 ' + offer.salary + ' G · −' + offer.cost + ' G', { townId: town.id, staffId: worker.id, offerId: offer.id, salary: offer.salary, gold: -offer.cost });
      return result(true, offer.name + '이(가) 대장간 직원이 되었습니다.', { staff: worker, cost: offer.cost, salary: offer.salary });
    }

    function validate(s) {
      try {
        if (!own(s, 'recruitment')) return true;
        const state = s.recruitment;
        if (!record(state) || state.version !== VERSION || !integer(state.rng, 0, 4294967295) || typeof state.armed !== 'boolean' || !stamp(state.lastObservedAt) || !record(state.boards)) return false;
        if (!state.armed && state.lastObservedAt !== 0 || state.armed && state.lastObservedAt <= 0) return false;
        const townMap = new Map(towns(s).map(town => [town.id, town]));
        const ids = new Set();
        for (const [townId, board] of Object.entries(state.boards)) {
          if (!townMap.has(townId) || !record(board) || board.townId !== townId || !integer(board.cycle, 1, 1000000000) || !stamp(board.generatedAt) || !stamp(board.nextRefreshAt) || !stamp(board.premiumReadyAt) || !Array.isArray(board.candidates) || board.candidates.length > MAX_CANDIDATES) return false;
          if (!state.armed && (board.generatedAt !== 0 || board.nextRefreshAt !== 0 || board.premiumReadyAt !== 0)) return false;
          if (state.armed && (board.generatedAt <= 0 || board.generatedAt > state.lastObservedAt || board.nextRefreshAt !== board.generatedAt + REFRESH_MS)) return false;
          for (const offer of board.candidates) {
            if (!record(offer) || (offer.potentialGrade!==undefined && !['S','A','B','C','D','E','F'].includes(offer.potentialGrade)) || !safeId(offer.id) || ids.has(offer.id) || offer.townId !== townId || !templates.has(offer.candidateId) || !ROLES.includes(offer.role) || !GRADES.includes(offer.grade) || typeof offer.talent !== 'boolean' || offer.talent !== (offer.grade !== 'regular') || !['basic', 'premium'].includes(offer.source)) return false;
            if (typeof offer.name !== 'string' || !offer.name.length || offer.name.length > 80 || !integer(offer.spriteIndex, 0, 199) || !integer(offer.craftLevel, 1, 30) || !integer(offer.dexterity, 0, 100) || !integer(offer.eloquence, 0, 100) || offer.craftSkill !== offer.dexterity || offer.salesSkill !== offer.eloquence || !integer(offer.maxStamina, 1, 1000) || offer.stamina !== offer.maxStamina) return false;
            if (!integer(offer.cost, 1, 1000000) || !integer(offer.rawSalary, 1, 1000000) || !integer(offer.salary, 1, 1000000) || offer.baseSalary !== offer.salary || offer.salaryTraitApplied !== true || !stamp(offer.createdAt) || !stamp(offer.expiresAt)) return false;
            if (!state.armed && (offer.createdAt !== 0 || offer.expiresAt !== 0) || state.armed && (offer.createdAt <= 0 || offer.createdAt > state.lastObservedAt || offer.expiresAt !== offer.createdAt + REFRESH_MS)) return false;
            if (offer.source === 'basic' && (offer.createdAt !== board.generatedAt || offer.expiresAt !== board.nextRefreshAt)) return false;
            ids.add(offer.id);
          }
        }
        return true;
      } catch (_) { return false; }
    }

    return { initialize, normalize, advance, getBoard, postPremium, hireCandidate, validate };
  }

  return { VERSION, REFRESH_MS, PREMIUM_COOLDOWN_MS, BASIC_COUNT, PREMIUM_COUNT, MAX_CANDIDATES, MAX_STAFF, PREMIUM_TALENT_CHANCE, create };
});
