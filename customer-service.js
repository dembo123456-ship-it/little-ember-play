(function (global) {
  'use strict';

  // Counter orders own references to real production and inventory. They never
  // mint equipment, advance a second clock, or collect payment in advance.
  const VERSION = 1;
  const MAX_ATTEMPTS = 8;
  const WAIT_TIMEOUT = 240;
  const REASONS = Object.freeze({
    waiting: '손님의 장비를 제작 대기열에 예약합니다.',
    materials: '다시 제작할 재료를 기다립니다.',
    queue: '화덕 대기열의 빈자리를 기다립니다.',
    warehouse: '완성품을 보관할 창고 공간을 기다립니다.',
    staff: '제조 직원의 이동·휴식·급여·훈련을 기다립니다.',
    crafting: '제조 직원이 손님의 장비를 만들고 있습니다.',
    sales: '완성품을 보관하고 계산대 직원을 기다립니다.',
    counter: '손님이 계산대에 도착하기를 기다립니다.',
    protected: '보관 품질은 창고에 남기고 손님용 장비를 다시 만듭니다.',
    'all-protected': '모든 품질 보관 중입니다. 판매할 품질을 허용하면 재개합니다.',
    budget: '모험가의 구매 예산을 확인합니다.'
  });
  const REQUEST_KEYS = ['id', 'heroId', 'recipeId', 'status', 'queueId', 'itemId', 'createdAt', 'expiresAt', 'attempts', 'protectedCount', 'nextAttemptAt', 'reason'];
  const own = (value, key) => !!value && Object.prototype.hasOwnProperty.call(value, key);
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const exactKeys = (value, keys) => record(value) && keys.every(key => own(value, key)) && Object.keys(value).every(key => keys.includes(key));
  const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const integer = (value, min, max) => Number.isInteger(value) && finite(value, min, max);
  const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(value);
  const defaults = () => ({ version: VERSION, enabled: false, requests: [] });

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, getTownLayout, getUnlockedRecipes, getRecipeLevel, itemValue, needsItem, craft, id, log, result } = ctx;
    const QUALITY = Object.freeze(Object.fromEntries(DATA.qualityOrder.map((key, index) => [key, index])));
    const recipes = new Map(DATA.recipes.map(recipe => [recipe.id, recipe]));
    const towns = s => record(s) && record(s.towns) ? getOwnedTowns(s).filter(record) : [];
    const config = town => town.customerService === undefined ? defaults() : town.customerService;
    const heroById = (s, heroId) => (s.adventurers || []).find(hero => hero.id === heroId);
    const validConfig = value => exactKeys(value, ['version', 'enabled', 'requests']) && value.version === VERSION && typeof value.enabled === 'boolean' && Array.isArray(value.requests) && value.requests.length <= 200;
    const canWait = (s, hero, town) => !!hero && hero.resident === true && hero.townId === town.id && ['visiting', 'returning'].includes(hero.status) && !hero.invasionId && !hero.raidId && !(hero.injuryUntil > s.time) && !hero.departed && hero.fatigue < 70 && hero.hp > ctx.getCombatStats(hero).maxHp * .35;
    const atCounter = (s, hero, town) => {
      const point = getTownLayout(s, town.id).counter.customerSpot;
      // `moving` records whether this frame contained a step for animation. It
      // can still be true on the frame moveActor finishes the route. Check the
      // actual route endpoint so a newly arrived customer can inquire at once,
      // while somebody passing the counter on a longer route cannot.
      const arrived = (!hero.path || hero.path.length === 0) && (!hero.destination || Math.hypot(hero.x - hero.destination.x, hero.y - hero.destination.y) < .06);
      return Math.hypot(hero.x - point.x, hero.y - point.y) < .15 && arrived;
    };
    const preservation = town => town.operations && town.operations.autoDisplay || { enabled: false, keepQuality: 'none' };
    const allProtected = town => preservation(town).enabled === true && preservation(town).keepQuality === 'normal';
    const keptByRule = (town, item) => {
      const settings = preservation(town);
      return settings.enabled === true && own(QUALITY, settings.keepQuality) && own(QUALITY, item.quality) && QUALITY[item.quality] >= QUALITY[settings.keepQuality];
    };
    const activeCraft = (town, entry) => {
      if (!entry || entry.status !== 'working') return false;
      const worker = town.staff.find(worker => worker.id === entry.staffId), facility = town.facilities.find(facility => facility.id === entry.facilityId);
      return !!worker && worker.role === 'smith' && worker.status === 'working' && !worker.trainingId && ctx.canStaffWork(worker) && !!facility && facility.active && facility.taskId === entry.id && facility.staffId === worker.id;
    };

    function init(s) {
      // Only absence is a legacy save. Reject, rather than repair, malformed data.
      for (const town of towns(s)) if (town.customerService === undefined) town.customerService = defaults();
      return s;
    }

    function hasRequest(s, heroId) {
      return towns(s).some(town => validConfig(config(town)) && config(town).requests.some(request => request.heroId === heroId));
    }

    function isItemReserved(s, itemId) {
      return towns(s).some(town => validConfig(config(town)) && config(town).requests.some(request => request.status === 'ready' && request.itemId === itemId));
    }

    function validate(s) {
      try {
        const requestIds = new Set(), customers = new Set(), queues = new Set(), items = new Set(), occupied = new Set();
        for (const town of towns(s)) for (const list of [town.inventory, town.queue, town.facilities, town.staff]) for (const object of list || []) occupied.add(object.id);
        for (const hero of s.adventurers || []) { occupied.add(hero.id); for (const item of Object.values(hero.equipment || {})) if (item) occupied.add(item.id); }
        for (const list of [s.quests, s.orders, s.rareOffers, s.logs, s.events,
          s.festival && s.festival.entries, s.raidState && s.raidState.parties,
          s.campaign && s.campaign.invasions, s.campaign && s.campaign.recruitOffers, s.campaign && s.campaign.training]) {
          for (const object of list || []) { occupied.add(object.id); if (object.item) occupied.add(object.item.id); }
        }
        for (const town of towns(s)) {
          if (town.customerService === undefined) continue;
          const settings = town.customerService;
          if (!validConfig(settings) || !settings.enabled && settings.requests.length) return false;
          for (const request of settings.requests) {
            if (!exactKeys(request, REQUEST_KEYS) || !safeId(request.id) || !/^customer-[1-9]\d*$/.test(request.id) || !integer(Number(request.id.slice(9)), 1, s.seq) || requestIds.has(request.id) || occupied.has(request.id) || !safeId(request.heroId) || customers.has(request.heroId) || !recipes.has(request.recipeId) || !['waiting', 'crafting', 'ready'].includes(request.status)) return false;
            if (!finite(request.createdAt, 0, s.time) || request.expiresAt !== request.createdAt + WAIT_TIMEOUT || !integer(request.attempts, 0, MAX_ATTEMPTS) || !integer(request.protectedCount, 0, request.attempts) || !finite(request.nextAttemptAt, request.createdAt, s.time + .25 + 1e-6) || !own(REASONS, request.reason)) return false;
            const hero = heroById(s, request.heroId);
            if (!canWait(s, hero, town)) return false;
            if (request.status === 'waiting') {
              if (request.queueId !== null || request.itemId !== null) return false;
            } else if (request.status === 'crafting') {
              if (!safeId(request.queueId) || queues.has(request.queueId) || request.itemId !== null || request.attempts < 1 || !town.queue.some(entry => entry.id === request.queueId && entry.townId === town.id && entry.recipeId === request.recipeId)) return false;
              queues.add(request.queueId);
            } else {
              // A just-changed preservation policy may lock this item before the
              // next tick releases its reservation and schedules a replacement.
              if (request.queueId !== null || !safeId(request.itemId) || items.has(request.itemId) || request.attempts < 1 || !town.inventory.some(item => item.id === request.itemId && item.recipeId === request.recipeId && item.listed === false)) return false;
              items.add(request.itemId);
            }
            requestIds.add(request.id); customers.add(request.heroId);
          }
        }
        return requestIds.size <= 200;
      } catch (_) { return false; }
    }

    function prototype(recipe, price) {
      return { recipeId: recipe.id, name: recipe.name, slot: recipe.slot, quality: 'normal', power: recipe.power, price: price == null ? recipe.price : price, enhance: 0, durability: 100, listed: false, locked: false, options: [] };
    }

    function maximumPrice(s, hero, town, recipe) {
      const settings = preservation(town), level = Math.max(1, ...town.staff.filter(worker => worker.role === 'smith' && worker.craftLevel >= getRecipeLevel(recipe)).map(worker => worker.craftLevel));
      const ceiling = settings.enabled && own(QUALITY, settings.keepQuality) ? QUALITY[settings.keepQuality] : DATA.qualityOrder.length;
      const highest = DATA.qualityOrder.filter(key => QUALITY[key] < ceiling && DATA.qualities[key].minCraftLevel <= level).slice(-1)[0] || 'normal';
      // Crafting options can add 15%; the best seller can add 20%. Reserve no
      // money, but choose a recipe the customer can afford even after that roll.
      const price = Math.ceil(Math.round(recipe.price * DATA.qualities[highest].multiplier) * 1.15), item = prototype(recipe, price);
      return Math.max(ctx.getPurchasePrice(s, hero, item), Math.max(1, Math.round(price * 1.2 * (1 - hero.discount))));
    }

    function chooseRecipe(s, hero, town) {
      const commissioned = new Set((s.orders || []).filter(order => order.adventurerId === hero.id && order.status === 'open').map(order => order.recipeId));
      return getUnlockedRecipes(s, town.id).filter(recipe => {
        if (commissioned.has(recipe.id) || hero.pendingEnhancement && hero.pendingEnhancement.slot === recipe.slot || !needsItem(hero, prototype(recipe)) || maximumPrice(s, hero, town, recipe) > hero.gold) return false;
        if (!Object.entries(recipe.cost).every(([material, count]) => (s.materials[material] || 0) >= count)) return false;
        return !town.inventory.some(item => item.listed && !item.locked && !isItemReserved(s, item.id) && item.recipeId === recipe.id && needsItem(hero, item) && ctx.getPurchasePrice(s, hero, item) <= hero.gold);
      }).map(recipe => ({ recipe, score: itemValue(prototype(recipe)) * (recipe.type === hero.preferredType ? 1.2 : 1) - itemValue(hero.equipment[recipe.slot]) }))
        .sort((a, b) => b.score - a.score || a.recipe.price - b.recipe.price || a.recipe.id.localeCompare(b.recipe.id))[0]?.recipe || null;
    }

    function request(s, hero) { return result(false, '손님 주문 자동 제작은 종료되었습니다.'); }

    function cancel(s, heroId, reason) {
      let removed = false;
      for (const town of towns(s)) {
        const settings = config(town);
        if (!validConfig(settings)) continue;
        for (const order of settings.requests.slice()) if (order.heroId === heroId) {
          settings.requests.splice(settings.requests.indexOf(order), 1);
          // Materials were consumed by craft(); an abandoned queue entry still
          // finishes normally. Its result is no longer reserved for this hero.
          if (reason !== 'sold') log(s, 'customer-cancel', (heroById(s, heroId)?.name || '손님') + ' · 자동 제작 문의 종료' + (reason === 'timeout' ? ' · 대기 시간 초과' : reason === 'attempt-limit' ? ' · 보관 품질 연속 제작 한도' : reason === 'unaffordable' ? ' · 구매 예산 부족' : ''), { townId: town.id, adventurerId: heroId, customerRequestId: order.id, reason: typeof reason === 'string' ? reason.slice(0, 80) : 'cancelled' });
          removed = true;
        }
      }
      return removed;
    }

    function finish(s, town, order, reason) {
      const hero = heroById(s, order.heroId);
      cancel(s, order.heroId, reason);
      if (canWait(s, hero, town)) ctx.onCustomerDone(s, hero, reason);
    }

    function schedule(s, town, order, hero) {
      if (order.status !== 'waiting' || s.time < order.nextAttemptAt) return;
      if (allProtected(town)) { order.reason = 'all-protected'; return; }
      if (order.attempts >= MAX_ATTEMPTS) { finish(s, town, order, 'attempt-limit'); return; }
      const recipe = recipes.get(order.recipeId);
      if (!recipe || !needsItem(hero, prototype(recipe))) { finish(s, town, order, 'equipment-changed'); return; }
      if (maximumPrice(s, hero, town, recipe) > hero.gold) { finish(s, town, order, 'unaffordable'); return; }
      if (!town.staff.some(worker => worker.role === 'smith' && worker.craftLevel >= getRecipeLevel(recipe))) { order.reason = 'staff'; return; }
      if (!Object.entries(recipe.cost).every(([material, count]) => (s.materials[material] || 0) >= count)) { order.reason = 'materials'; return; }
      if (ctx.getEquipmentUsage(s, town.id) >= ctx.getEquipmentCapacity(s, town.id)) { order.reason = 'warehouse'; return; }
      if (town.queue.length >= town.facilities.filter(facility => facility.type === 'furnace').length * 3) { order.reason = 'queue'; return; }
      const crafted = craft(s, recipe.id, town.id);
      if (!crafted.ok || !crafted.item) { order.reason = 'queue'; return; }
      order.status = 'crafting'; order.queueId = crafted.item.id; order.itemId = null; order.attempts++; order.reason = 'staff';
    }

    function protectAndRetry(s, town, order, item) {
      // The scheduler runs once before repeat production. A fixed time delay
      // would let repeat plans steal this slot on frames shorter than .25s.
      order.queueId = null; order.itemId = null; order.status = 'waiting'; order.protectedCount++; order.reason = 'protected'; order.nextAttemptAt = s.time;
      log(s, 'customer-protected', DATA.qualities[item.quality].name + ' ' + item.name + '은 창고에 보관 · 손님용 장비 다시 제작', { townId: town.id, adventurerId: order.heroId, customerRequestId: order.id, itemId: item.id, recipeId: item.recipeId, quality: item.quality });
    }

    function onCraft(s, town, item, worker, entry) {
      const settings = config(town);
      if (!validConfig(settings) || !entry) return;
      const order = settings.requests.find(order => order.status === 'crafting' && order.queueId === entry.id);
      if (!order) return;
      const hero = heroById(s, order.heroId);
      if (!canWait(s, hero, town)) { cancel(s, order.heroId, 'unavailable'); return; }
      if (item.locked || item.autoProtected || keptByRule(town, item)) { protectAndRetry(s, town, order, item); return; }
      order.queueId = null; order.itemId = item.id; order.status = 'ready'; order.reason = 'sales'; order.nextAttemptAt = s.time;
    }

    function step(s) {
      init(s);
      for (const town of towns(s)) {
        const settings = config(town);
        if (!validConfig(settings)) continue;
        for (const order of settings.requests.slice()) {
          const hero = heroById(s, order.heroId);
          if (!canWait(s, hero, town)) { cancel(s, order.heroId, 'unavailable'); continue; }
          if (!settings.enabled) { finish(s, town, order, 'disabled'); continue; }
          if (s.time >= order.expiresAt) { finish(s, town, order, 'timeout'); continue; }
          if (order.status === 'waiting') schedule(s, town, order, hero);
          else if (order.status === 'crafting') {
            const entry = town.queue.find(entry => entry.id === order.queueId);
            if (!entry) { finish(s, town, order, 'missing-production'); continue; }
            order.reason = activeCraft(town, entry) ? 'crafting' : 'staff';
          } else {
            const item = town.inventory.find(item => item.id === order.itemId);
            if (!item) { finish(s, town, order, 'missing-item'); continue; }
            if (item.locked || item.autoProtected || keptByRule(town, item)) { protectAndRetry(s, town, order, item); schedule(s, town, order, hero); continue; }
            if (!needsItem(hero, item)) { finish(s, town, order, 'equipment-changed'); continue; }
            if (ctx.getPurchasePrice(s, hero, item) > hero.gold) { finish(s, town, order, 'unaffordable'); continue; }
            if (!atCounter(s, hero, town)) { order.reason = 'counter'; continue; }
            if (!ctx.getSalesWorker(town)) { order.reason = 'sales'; continue; }
            if (ctx.sellCustomerItem(s, hero, item)) { finish(s, town, order, 'sold'); continue; }
          }
          if (settings.requests.includes(order)) hero.bubble = { type: order.reason === 'crafting' ? 'hammer' : 'order', until: s.time + 1 };
        }
      }
      return s;
    }

    function setCustomerService(s, settings, townId) {
      if (settings && settings.enabled === true) return result(false, '손님 주문 자동 제작은 종료되었습니다.');
      if (!exactKeys(settings, ['enabled']) || typeof settings.enabled !== 'boolean') return result(false, '방문 손님 자동 제작 설정을 확인해주세요.');
      const town = getTown(s, townId);
      if (!town) return result(false, '운영 중인 지점을 선택해주세요.');
      if (town.customerService === undefined) town.customerService = defaults();
      if (!validConfig(town.customerService)) return result(false, '방문 손님 자동 제작 설정을 확인해주세요.');
      town.customerService.enabled = settings.enabled;
      if (!settings.enabled) for (const order of town.customerService.requests.slice()) finish(s, town, order, 'disabled');
      return result(true, '방문 손님 자동 제작을 ' + (settings.enabled ? '켰습니다.' : '껐습니다. 진행 중인 제작품은 창고에 보관됩니다.'));
    }

    function getCustomerService(s, townId) {
      const town = getTown(s, townId);
      if (!town) return null;
      const settings = config(town);
      if (!validConfig(settings)) return { townId: town.id, valid: false, reason: '방문 손님 자동 제작 설정을 확인해주세요.' };
      const requests = settings.requests.map(order => {
        const hero = heroById(s, order.heroId), recipe = recipes.get(order.recipeId), entry = order.queueId && town.queue.find(entry => entry.id === order.queueId);
        const reason = order.status === 'crafting' ? activeCraft(town, entry) ? 'crafting' : 'staff' : order.reason;
        return { ...order, heroName: hero ? hero.name : '떠난 손님', recipeName: recipe ? recipe.name : '알 수 없는 장비', reason: REASONS[reason], remaining: Math.max(0, order.expiresAt - s.time), progress: order.status === 'ready' ? 1 : entry ? Math.max(0, Math.min(1, 1 - entry.remaining / entry.total)) : 0 };
      });
      const working = requests.find(order => order.status === 'crafting' && order.reason === REASONS.crafting), ready = requests.find(order => order.status === 'ready');
      let status;
      if (!settings.enabled) status = { state: 'off', reason: '방문 손님 자동 제작이 꺼져 있습니다.' };
      else if (allProtected(town)) status = { state: 'blocked', reason: REASONS['all-protected'] };
      else if (ready) status = { state: 'ready', reason: ready.reason };
      else if (working) status = { state: 'working', reason: working.reason };
      else if (requests.length) status = { state: 'waiting', reason: requests[0].reason };
      else status = { state: 'idle', reason: '원하는 진열품이 없는 손님이 계산대에 오면 제작합니다.' };
      return { townId: town.id, valid: true, enabled: settings.enabled, maxAttempts: MAX_ATTEMPTS, waitTimeout: WAIT_TIMEOUT, activeCount: requests.length, requests, status };
    }

    function normalize(s) {
      init(s);
      if (!validate(s)) throw new Error('invalid customer orders');
      for (const town of towns(s)) {
        for (const order of town.customerService.requests.slice()) finish(s, town, order, 'disabled');
        town.customerService.enabled = false;
      }
      return s;
    }
    return { init, normalize, validate, request, step, onCraft, cancel, hasRequest, isItemReserved, getCustomerService, setCustomerService };
  }

  const api = { VERSION, MAX_ATTEMPTS, WAIT_TIMEOUT, create };
  global.ForgeCustomerService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
