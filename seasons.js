(function (global) {
  'use strict';

  // Seasonal calendar events (2026-11). One event per season on the in-game calendar
  // (30 days per season, 120 days per year; at 2x speed a season lasts 15 real minutes):
  //   spring  : equipment festival (existing, progression.js) — listed here for the overview only
  //   summer  : travelling caravan market — limited material stock for gold (a gold sink)
  //   autumn  : harvest bulk order — deliver crafted gear for a large reward
  //   winter  : cold-snap hunting season — +30% hunt XP/loot, defeats wear gear twice as hard
  // Numbers are provisional; overall balance is tuned later together with every other system.
  const VERSION = 1;
  const DAYS_PER_SEASON = 30, DAYS_PER_YEAR = 120, NOTICE_DAYS = 3;
  const EVENTS = Object.freeze([
    { id: 'festival', season: 1, start: 10, end: 14, name: '장비 축제', icon: 'trophy', description: '좋은 장비를 출품하고 15일에 시상합니다.' },
    { id: 'market', season: 2, start: 8, end: 12, name: '떠돌이 상단 장터', icon: 'gem', description: '상단이 재료를 한정 수량으로 팝니다. 평소 시세보다 비싸지만 바로 살 수 있고, 다음 마을의 재료와 보스 재료도 조금 섞여 있어요.' },
    { id: 'harvest', season: 3, start: 5, end: 20, name: '수확제 대량 주문', icon: 'scroll', description: '마을이 장비를 대량으로 주문합니다. 기한 안에 모두 납품하면 큰 보상을 받아요.' },
    { id: 'coldsnap', season: 4, start: 1, end: 30, name: '한파 사냥철', icon: 'shield', description: '사냥 경험치·전리품이 30% 늘지만, 패배하면 장비가 두 배로 상합니다.' }
  ].map(Object.freeze));
  const MARKET = Object.freeze({ ownedMarkup: 2.5, nextTierMarkup: 3.5, bossMarkup: 2.5, ownedBase: 20, ownedPerTown: 10, nextBase: 6, nextPerTown: 2 });
  const HARVEST = Object.freeze({ rewardMultiplier: 1.8, reputationPerTown: 30, expiredShare: .4 });
  const COLDSNAP = Object.freeze({ xp: 1.3, loot: 1.3, defeatWear: 2 });
  const BOSS_MATERIALS = Object.freeze({ ancient_heart: 'greenwood', giant_core: 'greenwood', star_fragment: 'stonebridge', frost_scale: 'moonhaven', abyss_crystal: 'sunspire' });

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const startDay = e => (e.season - 1) * DAYS_PER_SEASON + e.start;
  const endDay = e => (e.season - 1) * DAYS_PER_SEASON + e.end;

  function create(ctx) {
    const { DATA, getOwnedTowns, getCalendar, random, int, log, result } = ctx;
    const eventMap = Object.fromEntries(EVENTS.map(e => [e.id, e]));

    function blank() { return { version: VERSION, market: null, harvest: null, notices: [] }; }
    function init(s) { if (!object(s.seasonEvents)) s.seasonEvents = blank(); return s; }
    function normalize(s) { return init(s); }

    function calendar(s) {
      const c = getCalendar(s);
      const dayOfYear = c.dayOfYear || ((c.month - 1) * DAYS_PER_SEASON + c.day);
      return { year: c.year, season: c.month, day: c.day, dayOfYear };
    }
    function phase(e, c) {
      if (c.dayOfYear < startDay(e)) return { status: c.dayOfYear >= startDay(e) - NOTICE_DAYS ? 'soon' : 'upcoming', daysUntil: startDay(e) - c.dayOfYear, daysLeft: 0 };
      if (c.dayOfYear <= endDay(e)) return { status: 'active', daysUntil: 0, daysLeft: endDay(e) - c.dayOfYear + 1 };
      return { status: 'done', daysUntil: DAYS_PER_YEAR - c.dayOfYear + startDay(e), daysLeft: 0 };
    }
    function noticeOnce(s, key, type, text, extra) {
      const ev = s.seasonEvents; if (ev.notices.includes(key)) return false;
      ev.notices.push(key); if (ev.notices.length > 24) ev.notices.splice(0, ev.notices.length - 24);
      log(s, type, text, extra); return true;
    }

    // --- Material tiers from the chain's progress ---
    function townIndex(id) { return DATA.towns.findIndex(t => t.id === id); }
    function lootOfTown(townId) {
      const town = DATA.towns.find(t => t.id === townId), out = new Set();
      if (!town) return out;
      for (const r of DATA.regions) if (town.regionIds.includes(r.id)) for (const m of Object.keys(r.loot || {})) out.add(m);
      return out;
    }
    function materialTiers(s) {
      const owned = getOwnedTowns(s).map(t => t.id), obtainable = new Set();
      for (const id of owned) for (const m of lootOfTown(id)) obtainable.add(m);
      const furthest = Math.max(...owned.map(townIndex)), next = DATA.towns[furthest + 1], nextTier = new Set();
      if (next) for (const m of lootOfTown(next.id)) if (!obtainable.has(m)) nextTier.add(m);
      const boss = Object.keys(BOSS_MATERIALS).filter(m => DATA.materials[m] && !DATA.materials[m].retired && owned.includes(BOSS_MATERIALS[m]));
      return { owned, obtainable, nextTier, boss };
    }

    // --- Summer: caravan market ---
    function openMarket(s, c) {
      const tiers = materialTiers(s), towns = tiers.owned.length, offers = [];
      const add = (material, amount, markup) => {
        const m = DATA.materials[material]; if (!m || !(m.price > 0) || amount < 1) return;
        offers.push({ id: 'market-' + c.year + '-' + material, material, amount, sold: 0, unitPrice: Math.ceil(m.price * markup) });
      };
      for (const m of ['iron', 'wood', 'leather', 'crystal', 'mythril']) if (tiers.obtainable.has(m)) add(m, MARKET.ownedBase + MARKET.ownedPerTown * towns, MARKET.ownedMarkup);
      for (const m of ['iron', 'wood', 'leather', 'crystal', 'mythril']) if (tiers.nextTier.has(m)) add(m, MARKET.nextBase + MARKET.nextPerTown * towns, MARKET.nextTierMarkup);
      for (const m of tiers.boss) add(m, int(s, 1, 3), MARKET.bossMarkup);
      s.seasonEvents.market = { year: c.year, status: 'open', offers, spent: 0 };
      log(s, 'season-start', '여름 떠돌이 상단이 도착했습니다. 12일까지 재료를 한정 수량으로 팝니다.', { seasonEvent: 'market' });
    }
    function closeMarket(s) {
      const market = s.seasonEvents.market; if (!market || market.status !== 'open') return;
      market.status = 'closed';
      const bought = market.offers.reduce((n, o) => n + o.sold, 0);
      log(s, 'season-end', '떠돌이 상단이 떠났습니다.' + (bought ? ' 재료 ' + bought + '개 · ' + market.spent + ' G 거래.' : ''), { seasonEvent: 'market' });
    }
    function buyMarket(s, offerId, amount) {
      const market = s.seasonEvents && s.seasonEvents.market;
      if (!market || market.status !== 'open') return result(false, '지금은 상단 장터가 열려 있지 않아요.');
      const offer = market.offers.find(o => o.id === offerId);
      if (!offer) return result(false, '그 상품을 찾을 수 없어요.');
      const left = offer.amount - offer.sold, want = amount === undefined ? left : amount;
      if (!integer(want, 1, 1000000)) return result(false, '살 수량을 확인해주세요.');
      if (want > left) return result(false, '남은 수량은 ' + left + '개예요.');
      const room = ctx.getMaterialRoom ? ctx.getMaterialRoom(s, offer.material) : Infinity;
      if (want > room) return result(false, '창고에 ' + DATA.materials[offer.material].name + '을(를) ' + room + '개만 더 넣을 수 있어요.');
      const cost = want * offer.unitPrice;
      if (s.gold < cost) return result(false, cost + ' G가 필요해요.');
      s.gold -= cost; s.materials[offer.material] = (s.materials[offer.material] || 0) + want; offer.sold += want; market.spent += cost;
      s.stats.seasonMarketSpent = (s.stats.seasonMarketSpent || 0) + cost;
      log(s, 'season-purchase', '상단 장터 · ' + DATA.materials[offer.material].name + ' ' + want + '개 구매 · −' + cost + ' G', { seasonEvent: 'market', gold: -cost });
      return result(true, DATA.materials[offer.material].name + ' ' + want + '개를 샀어요.', { cost, amount: want });
    }

    // --- Autumn: harvest bulk order ---
    function craftableRecipes(s) {
      const tiers = materialTiers(s), level = Math.max(1, ...getOwnedTowns(s).flatMap(t => t.staff.filter(w => w.role === 'smith').map(w => w.craftLevel || 1)));
      return DATA.recipes.filter(r => (r.source || 'standard') === 'standard' && (r.requiredLevel || 1) <= level && Object.keys(r.cost || {}).every(m => tiers.obtainable.has(m)))
        .sort((a, b) => (b.requiredLevel || 1) - (a.requiredLevel || 1) || b.price - a.price || a.id.localeCompare(b.id));
    }
    function openHarvest(s, c) {
      const towns = getOwnedTowns(s).length, pool = craftableRecipes(s);
      if (!pool.length) return;
      const top = pool.slice(0, Math.max(1, Math.ceil(pool.length / 2)));
      const first = top[Math.floor(random(s) * top.length)];
      const rest = pool.filter(r => r.slot !== first.slot);
      const second = rest.length ? rest[Math.floor(random(s) * rest.length)] : null;
      const lines = [{ recipeId: first.id, required: 3 + towns, delivered: 0 }];
      if (second) lines.push({ recipeId: second.id, required: 4 + 2 * towns, delivered: 0 });
      const value = lines.reduce((sum, l) => sum + DATA.recipes.find(r => r.id === l.recipeId).price * l.required, 0);
      s.seasonEvents.harvest = { year: c.year, status: 'open', lines, reward: Math.round(value * HARVEST.rewardMultiplier), reputation: HARVEST.reputationPerTown * towns, paid: 0 };
      const names = lines.map(l => DATA.recipes.find(r => r.id === l.recipeId).name + ' ' + l.required + '개').join(', ');
      log(s, 'season-start', '가을 수확제 대량 주문: ' + names + ' · 20일까지 납품하면 ' + s.seasonEvents.harvest.reward + ' G', { seasonEvent: 'harvest' });
    }
    function lineValue(line) { const r = DATA.recipes.find(x => x.id === line.recipeId); return r ? r.price : 0; }
    function deliverable(s, recipeId) {
      const out = [];
      for (const town of getOwnedTowns(s)) for (const item of town.inventory) {
        if (item.recipeId !== recipeId || item.locked) continue;
        if (ctx.isCustomerItemReserved && ctx.isCustomerItemReserved(s, item.id)) continue;
        out.push({ town, item });
      }
      return out;
    }
    function deliverHarvest(s, recipeId) {
      const harvest = s.seasonEvents && s.seasonEvents.harvest;
      if (!harvest || harvest.status !== 'open') return result(false, '지금은 수확제 주문을 받지 않아요.');
      const line = harvest.lines.find(l => l.recipeId === recipeId);
      if (!line) return result(false, '주문에 없는 장비예요.');
      const need = line.required - line.delivered;
      if (need <= 0) return result(false, '이 장비는 이미 모두 납품했어요.');
      const stock = deliverable(s, recipeId).slice(0, need);
      if (!stock.length) return result(false, '납품할 수 있는 장비가 없어요. 잠근 장비와 손님 예약 장비는 제외돼요.');
      for (const { town, item } of stock) { item.listed = false; town.inventory.splice(town.inventory.indexOf(item), 1); }
      line.delivered += stock.length;
      const name = DATA.recipes.find(r => r.id === recipeId).name;
      if (harvest.lines.every(l => l.delivered >= l.required)) {
        harvest.status = 'completed'; harvest.paid = harvest.reward;
        s.gold += harvest.reward; s.reputation += harvest.reputation; s.stats.earned += harvest.reward;
        s.stats.seasonHarvestPaid = (s.stats.seasonHarvestPaid || 0) + harvest.reward;
        s.stats.harvestCompleted = (s.stats.harvestCompleted || 0) + 1;
        log(s, 'season-complete', '수확제 주문을 모두 납품했습니다! +' + harvest.reward + ' G · 명성 +' + harvest.reputation, { seasonEvent: 'harvest', gold: harvest.reward });
        return result(true, name + ' ' + stock.length + '개 납품 · 주문 완료!', { delivered: stock.length, completed: true });
      }
      log(s, 'season-delivery', '수확제 납품 · ' + name + ' ' + stock.length + '개 (' + line.delivered + '/' + line.required + ')', { seasonEvent: 'harvest' });
      return result(true, name + ' ' + stock.length + '개를 납품했어요.', { delivered: stock.length, completed: false });
    }
    function closeHarvest(s) {
      const harvest = s.seasonEvents.harvest; if (!harvest || harvest.status !== 'open') return;
      harvest.status = 'expired';
      const partial = Math.round(harvest.lines.reduce((sum, l) => sum + Math.min(l.delivered, l.required) * lineValue(l), 0) * HARVEST.rewardMultiplier * HARVEST.expiredShare);
      harvest.paid = partial;
      if (partial) { s.gold += partial; s.stats.earned += partial; s.stats.seasonHarvestPaid = (s.stats.seasonHarvestPaid || 0) + partial; }
      log(s, 'season-end', '수확제 주문 기한이 끝났습니다.' + (partial ? ' 납품한 만큼 ' + partial + ' G를 받았어요.' : ' 납품한 장비가 없어요.'), { seasonEvent: 'harvest', gold: partial });
    }

    // --- Winter: cold snap ---
    function huntModifiers(s) {
      const c = calendar(s), e = eventMap.coldsnap;
      return c.dayOfYear >= startDay(e) && c.dayOfYear <= endDay(e) ? { xp: COLDSNAP.xp, loot: COLDSNAP.loot, defeatWear: COLDSNAP.defeatWear, active: true } : { xp: 1, loot: 1, defeatWear: 1, active: false };
    }

    function step(s) {
      init(s);
      const c = calendar(s), ev = s.seasonEvents;
      for (const e of EVENTS) {
        if (e.id === 'festival') continue;
        const p = phase(e, c), key = c.year + ':' + e.id;
        if (p.status === 'soon') noticeOnce(s, key + ':notice', 'season-notice', '곧 ' + e.name + ' · ' + p.daysUntil + '일 뒤 시작', { seasonEvent: e.id });
        if (e.id === 'market') {
          if (ev.market && ev.market.status === 'open' && (ev.market.year !== c.year || p.status !== 'active')) closeMarket(s);
          if (p.status === 'active' && (!ev.market || ev.market.year !== c.year)) openMarket(s, c);
        } else if (e.id === 'harvest') {
          if (ev.harvest && ev.harvest.status === 'open' && (ev.harvest.year !== c.year || p.status !== 'active')) closeHarvest(s);
          if (p.status === 'active' && (!ev.harvest || ev.harvest.year !== c.year)) openHarvest(s, c);
        } else if (e.id === 'coldsnap') {
          if (p.status === 'active') noticeOnce(s, key + ':start', 'season-start', '한파 사냥철이 시작됐어요. 사냥 보상이 늘지만, 패배하면 장비가 크게 상합니다.', { seasonEvent: 'coldsnap' });
          // Winter ends with the year, so the end notice is given once the new year begins.
          const prev = (c.year - 1) + ':coldsnap';
          if (p.status !== 'active' && ev.notices.includes(prev + ':start')) noticeOnce(s, prev + ':end', 'season-end', '한파가 물러갔습니다. 사냥이 평소대로 돌아와요.', { seasonEvent: 'coldsnap' });
        }
      }
    }

    function getSeasonEvents(s) {
      init(s);
      const c = calendar(s), ev = s.seasonEvents;
      const events = EVENTS.map(e => ({ ...e, startDayOfYear: startDay(e), endDayOfYear: endDay(e), ...phase(e, c) }));
      const market = ev.market && ev.market.year === c.year ? { ...ev.market, offers: ev.market.offers.map(o => ({ ...o, left: o.amount - o.sold, name: DATA.materials[o.material].name, basePrice: DATA.materials[o.material].price })) } : null;
      const harvest = ev.harvest && ev.harvest.year === c.year ? { ...ev.harvest, lines: ev.harvest.lines.map(l => { const r = DATA.recipes.find(x => x.id === l.recipeId); return { ...l, name: r ? r.name : l.recipeId, slot: r && r.slot, requiredLevel: r && r.requiredLevel || 1, available: deliverable(s, l.recipeId).length }; }) } : null;
      const current = events.find(e => e.status === 'active') || null, next = events.filter(e => e.status !== 'active').sort((a, b) => a.daysUntil - b.daysUntil)[0] || null;
      return { calendar: c, events, current, next, market, harvest, coldsnap: huntModifiers(s) };
    }

    function validate(s) {
      try {
        const ev = s.seasonEvents;
        if (ev === undefined) return true;
        if (!object(ev) || ev.version !== VERSION || !Array.isArray(ev.notices) || ev.notices.length > 24 || !ev.notices.every(k => typeof k === 'string' && k.length <= 60)) return false;
        if (ev.market !== null) {
          const m = ev.market;
          if (!object(m) || !integer(m.year, 1, 100000) || !['open', 'closed'].includes(m.status) || !integer(m.spent, 0, 1e12) || !Array.isArray(m.offers) || m.offers.length > 12) return false;
          const ids = new Set();
          for (const o of m.offers) {
            if (!object(o) || typeof o.id !== 'string' || ids.has(o.id) || !own(DATA.materials, o.material) || !integer(o.amount, 1, 1e6) || !integer(o.sold, 0, o.amount) || !integer(o.unitPrice, 1, 1e6)) return false;
            ids.add(o.id);
          }
        }
        if (ev.harvest !== null) {
          const h = ev.harvest;
          if (!object(h) || !integer(h.year, 1, 100000) || !['open', 'completed', 'expired'].includes(h.status) || !integer(h.reward, 0, 1e12) || !integer(h.reputation, 0, 1e9) || !integer(h.paid, 0, 1e12) || !Array.isArray(h.lines) || !h.lines.length || h.lines.length > 4) return false;
          for (const l of h.lines) if (!object(l) || !DATA.recipes.some(r => r.id === l.recipeId) || !integer(l.required, 1, 10000) || !integer(l.delivered, 0, l.required)) return false;
        }
        return true;
      } catch (_) { return false; }
    }

    return { init, normalize, step, validate, getSeasonEvents, buyMarket, deliverHarvest, huntModifiers };
  }

  const api = { VERSION, EVENTS, MARKET, HARVEST, COLDSNAP, create };
  global.ForgeSeasons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
