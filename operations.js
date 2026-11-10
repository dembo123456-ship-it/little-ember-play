(function (global) {
  'use strict';

  // This module owns no clock, storage, or DOM. Every transfer is performed by
  // a paid, rested employee during a simulation tick, after reaching the job.
  const ROLES = Object.freeze(['buyer', 'logistics', 'enhancer', 'innkeeper']);
  const MAX_TARGET = 1000000;
  const SUPPORT_MULTIPLIER = 1.5, MAX_CRAFT_PLANS = 3, DEFAULT_CRAFT_TARGET = 3;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const integer = (value, min, max) => Number.isInteger(value) && finite(value, min, max);
  const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(value);
  const exactKeys = (value, keys) => record(value) && keys.every(key => own(value, key)) && Object.keys(value).every(key => keys.includes(key));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ruleValid = rule => exactKeys(rule, ['enabled', 'targetStock']) && typeof rule.enabled === 'boolean' && integer(rule.targetStock, 0, MAX_TARGET);
  const defaults = () => ({ version: 1, materialRules: {}, craftRules: {}, autoDisplay: { enabled: false, keepQuality: 'none' }, craftCursor: 0, purchaseCursor: 0 });

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, getTownLayout, getFacilityWorkSpot, getDisplayStockSpot, getFacilityBackSpot, setDestination, moveActor, clearRoute, log, result } = ctx;
    const QUALITY = Object.freeze(Object.fromEntries(DATA.qualityOrder.map((key, index) => [key, index])));
    const displayValid = rule => exactKeys(rule, ['enabled', 'keepQuality']) && typeof rule.enabled === 'boolean' && (rule.keepQuality === 'none' || own(QUALITY, rule.keepQuality));
    const fatigueMultiplier = worker => ctx.personalityEffect ? ctx.personalityEffect(worker, 'staffFatigue') : 1;
    const recipes = new Map(DATA.recipes.map(recipe => [recipe.id, recipe]));
    const materialIds = Object.keys(DATA.materials).filter(id => DATA.materials[id].price > 0 && (DATA.materials[id].buyable !== false || DATA.materials[id].rare));
    const materialSet = new Set(materialIds);
    const townList = s => record(s) && record(s.towns) ? getOwnedTowns(s).filter(record) : [];
    const config = town => town.operations === undefined ? defaults() : town.operations;
    const heroById = (s, id) => (s.adventurers || []).find(hero => hero.id === id);
    const workingAllowed = worker => !worker.trainingId && !(worker.salaryDebt > 0) && worker.stamina >= worker.maxStamina * .2 && worker.status !== 'resting';
    const activeWorker = worker => workingAllowed(worker) && worker.status === 'working' && worker.operationTask && worker.operationTask.phase === 'work';

    function configValid(value) {
      return exactKeys(value, ['version', 'materialRules', 'craftRules', 'autoDisplay', 'craftCursor', 'purchaseCursor']) && value.version === 1 &&
        record(value.materialRules) && Object.entries(value.materialRules).every(([id, rule]) => materialSet.has(id) && ruleValid(rule)) &&
        record(value.craftRules) && Object.entries(value.craftRules).every(([id, rule]) => recipes.has(id) && ruleValid(rule)) &&
        displayValid(value.autoDisplay) && integer(value.craftCursor, 0, MAX_TARGET) && integer(value.purchaseCursor, 0, MAX_TARGET);
    }

    function init(s) {
      for (const town of townList(s)) {
        // Missing is a legacy state; null, partial, or malformed is not.
        if (town.operations === undefined) town.operations = defaults();
        // 2026-11: "0 = keep making forever" was removed (it drained materials into piles of unsold stock);
        // old plans become a target of 3.
        const rules = town.operations && town.operations.craftRules;
        if (rules && typeof rules === 'object') for (const rule of Object.values(rules)) if (rule && rule.targetStock === 0) rule.targetStock = DEFAULT_CRAFT_TARGET;
        if (Array.isArray(town.staff)) for (const worker of town.staff) if (worker.operationTask === undefined) worker.operationTask = null;
      }
      return s;
    }

    function taskValid(task, worker) {
      if (task === undefined || task === null) return true;
      if (!record(task)) return false;
      const common = ['type', 'phase', 'remaining', 'total'];
      if (task.type === 'purchase') return worker.role === 'buyer' && exactKeys(task, common.concat(['source', 'material', 'heroId', 'offerId'])) &&
        ['travel', 'work'].includes(task.phase) && task.total === 2 && finite(task.remaining, 0, 2) && materialSet.has(task.material) && safeId(task.heroId) &&
        ((task.source === 'bag' && task.offerId === null && DATA.materials[task.material].buyable !== false) || (task.source === 'offer' && safeId(task.offerId) && DATA.materials[task.material].rare === true));
      // 2026-11: a display trip carries up to 6 items (itemIds; itemId is the first). Older saves carry one item.
      if (task.type === 'display') return worker.role === 'logistics' && (exactKeys(task, common.concat(['itemId', 'facilityId'])) ||
        (exactKeys(task, common.concat(['itemId', 'itemIds', 'facilityId'])) && Array.isArray(task.itemIds) && task.itemIds.length >= 1 && task.itemIds.length <= 6 && task.itemIds.every(safeId) && task.itemIds[0] === task.itemId && new Set(task.itemIds).size === task.itemIds.length)) &&
        ['pickup', 'delivery', 'work'].includes(task.phase) && task.total === 1 && finite(task.remaining, 0, 1) && safeId(task.itemId) && safeId(task.facilityId);
      if (task.type === 'enhance') return worker.role === 'enhancer' && exactKeys(task, common.concat(['facilityId'])) && ['travel', 'work'].includes(task.phase) && task.total === 0 && task.remaining === 0 && safeId(task.facilityId);
      return task.type === 'care' && worker.role === 'innkeeper' && exactKeys(task, common.concat(['heroId'])) && ['travel', 'work'].includes(task.phase) && task.total === 0 && task.remaining === 0 && safeId(task.heroId);
    }

    function taskKey(task) {
      if (task.type === 'purchase') return task.source === 'offer' ? 'offer:' + task.offerId : 'bag:' + task.heroId + ':' + task.material;
      return task.type + ':' + (task.itemId || task.facilityId || task.heroId);
    }

    function taskReferencesValid(s, town, task) {
      if (task.type === 'display') return town.inventory.some(item => item.id === task.itemId) && !(ctx.isItemReserved && ctx.isItemReserved(s, task.itemId)) && town.facilities.some(facility => facility.id === task.facilityId && facility.type === 'display');
      if (task.type === 'enhance') return town.facilities.some(facility => facility.id === task.facilityId && facility.type === 'enhance');
      const hero = heroById(s, task.heroId);
      if (!hero || hero.townId !== town.id) return false;
      if (task.type === 'care') return !!hero.bedId && getTownLayout(s, town.id).inn.beds.some(bed => bed.id === hero.bedId);
      return task.source === 'bag' || (s.rareOffers || []).some(offer => offer.id === task.offerId && offer.status === 'open' && offer.townId === town.id && offer.heroId === hero.id && offer.material === task.material);
    }

    function validate(s) {
      try {
        const checkItem = item => !item || item.autoProtected === undefined || typeof item.autoProtected === 'boolean' && (!item.autoProtected || item.locked === true && item.listed === false);
        for (const town of townList(s)) {
          if (town.operations !== undefined && !configValid(town.operations)) return false;
          const reserved = new Set();
          for (const worker of town.staff || []) {
            if (!taskValid(worker.operationTask, worker)) return false;
            if (worker.operationTask) {
              if (!taskReferencesValid(s, town, worker.operationTask)) return false;
              const key = taskKey(worker.operationTask);
              if (reserved.has(key)) return false;
              reserved.add(key);
              const hero = worker.operationTask.heroId && heroById(s, worker.operationTask.heroId);
              if (hero && hero.townId !== town.id) return false;
            }
          }
          if (!(town.inventory || []).every(checkItem)) return false;
        }
        if (!(s.festival && s.festival.entries || []).every(entry => checkItem(entry.item))) return false;
        return (s.adventurers || []).every(hero => Object.values(hero.equipment || {}).every(checkItem));
      } catch (_) { return false; }
    }

    function mutableTown(s, townId) {
      const town = getTown(s, townId);
      if (!town) return null;
      if (town.operations === undefined) town.operations = defaults();
      return configValid(town.operations) ? town : null;
    }

    function setMaterialPurchaseRule(s, material, rule, townId) {
      if (!materialSet.has(material) || !ruleValid(rule)) return result(false, '매입할 재료와 0~1,000,000개의 목표 재고를 확인해주세요.');
      const capacity = ctx.getMaterialCapacity(s);
      if (rule.targetStock > capacity) return result(false, '현재 체인 창고는 재료별 ' + capacity + '개까지 매입할 수 있습니다. 창고를 확장하거나 목표 수량을 낮춰주세요.');
      const town = mutableTown(s, townId);
      if (!town) return result(false, '운영 중인 지점과 자동운영 설정을 확인해주세요.');
      town.operations.materialRules[material] = { enabled: rule.enabled, targetStock: rule.targetStock };
      return result(true, DATA.materials[material].name + ' 자동 매입 설정을 저장했습니다.');
    }

    function setMaterialPurchaseRules(s, rules, townId) {
      if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return result(false, '매입 설정을 확인해주세요.');
      const capacity=ctx.getMaterialCapacity(s), entries=Object.entries(rules);
      if(entries.some(([id,rule])=>!materialSet.has(id)||!ruleValid(rule)||rule.targetStock>capacity)) return result(false, '재료와 창고 한도 안의 목표 수량을 확인해주세요.');
      const town=mutableTown(s,townId);if(!town)return result(false,'운영 중인 지점과 자동운영 설정을 확인해주세요.');
      for(const [id,rule] of entries)town.operations.materialRules[id]={enabled:rule.enabled,targetStock:rule.targetStock};
      return result(true,'재료 매입 설정을 저장했습니다.');
    }

    function setAutoCraftRule(s, recipeId, rule, townId) {
      if (!recipes.has(recipeId) || !ruleValid(rule) || rule.targetStock < 1) return result(false, '유지할 재고는 1개 이상으로 정해주세요.');
      const town = mutableTown(s, townId);
      if (!town) return result(false, '운영 중인 지점과 자동운영 설정을 확인해주세요.');
      // 2026-11: up to 3 auto-craft plans per town (existing plans can always be edited).
      if (!own(town.operations.craftRules, recipeId) && Object.keys(town.operations.craftRules).length >= MAX_CRAFT_PLANS) return result(false, '자동 제작은 ' + MAX_CRAFT_PLANS + '개까지 등록할 수 있어요. 기존 계획을 삭제한 뒤 추가해주세요.');
      town.operations.craftRules[recipeId] = { enabled: rule.enabled, targetStock: rule.targetStock };
      return result(true, recipes.get(recipeId).name + ' 자동 제작 설정을 저장했습니다.');
    }
    function removeAutoCraftRule(s, recipeId, townId) {
      const town = mutableTown(s, townId);
      if (!town || !own(town.operations.craftRules, recipeId)) return result(false, '삭제할 자동 제작 계획이 없어요.');
      delete town.operations.craftRules[recipeId];
      return result(true, (recipes.get(recipeId)?.name || '장비') + ' 자동 제작을 삭제했어요.');
    }

    function keptByRule(item, settings) {
      return settings.enabled && settings.keepQuality !== 'none' && own(QUALITY, item.quality) && QUALITY[item.quality] >= QUALITY[settings.keepQuality];
    }

    function protectItem(item, settings) {
      // Listed items and manual locks are explicit player choices.
      if (item.listed) return;
      if (item.autoProtected === true && !keptByRule(item, settings)) { item.locked = false; delete item.autoProtected; }
      if (keptByRule(item, settings) && !item.locked) { item.locked = true; item.autoProtected = true; }
    }

    function setAutoDisplay(s, settings, townId) {
      if (!displayValid(settings)) return result(false, '자동 진열과 보관할 품질을 확인해주세요.');
      const town = mutableTown(s, townId);
      if (!town) return result(false, '운영 중인 지점과 자동운영 설정을 확인해주세요.');
      town.operations.autoDisplay = { enabled: settings.enabled, keepQuality: settings.keepQuality };
      for (const item of town.inventory) protectItem(item, settings);
      return result(true, '자동 진열·품질 보관 설정을 저장했습니다.');
    }

    function onCraft(s, town, item) {
      if (town.operations === undefined) town.operations = defaults();
      if (configValid(town.operations)) protectItem(item, town.operations.autoDisplay);
    }

    function stockCount(s, town, recipeId) {
      // Locked/kept items are not for sale, so they must not satisfy the auto-craft stock target
      // (otherwise "keep masterwork" silently stops production once kept items pile up).
      const finished = town.inventory.filter(item => item.recipeId === recipeId && !item.locked).length;
      const queued = town.queue.filter(task => task.recipeId === recipeId).length;
      const submitted = (s.festival && s.festival.entries || []).filter(entry => entry.townId === town.id && entry.item && entry.item.recipeId === recipeId).length;
      return { finished, queued, submitted, total: finished + queued + submitted };
    }

    function scheduleCrafts(s, town) {
      const rules = Object.entries(town.operations.craftRules).filter(([, rule]) => rule.enabled);
      if (!rules.length) return;
      const slots = Math.max(0, town.facilities.filter(facility => facility.type === 'furnace').length * 3 - town.queue.length);
      for (let slot = 0; slot < slots; slot++) {
        let queued = false;
        for (let attempt = 0; attempt < rules.length; attempt++) {
          const index = (town.operations.craftCursor + attempt) % rules.length;
          const [recipeId, rule] = rules[index];
          if (rule.targetStock > 0 && stockCount(s, town, recipeId).total >= rule.targetStock) continue;
          if (ctx.craft(s, recipeId, town.id).ok) { town.operations.craftCursor = (index + 1) % rules.length; queued = true; break; }
        }
        if (!queued) break;
      }
    }

    function step(s) {
      init(s);
      reconcile(s);
      for (const town of townList(s)) if (configValid(town.operations)) scheduleCrafts(s, town);
    }

    function questReserved(s, hero, material) {
      return (s.quests || []).filter(quest => quest.status === 'active' && quest.adventurerId === hero.id && quest.material === material).reduce((sum, quest) => sum + quest.amount, 0);
    }

    function canSellBag(hero, town) {
      return hero && hero.resident && hero.townId === town.id && !hero.invasionId && ['visiting', 'returning', 'resting'].includes(hero.status);
    }

    function purchaseQuote(s, town, task) {
      const rule = town.operations.materialRules[task.material], material = DATA.materials[task.material], hero = heroById(s, task.heroId);
      if (!rule || !rule.enabled || !hero || hero.townId !== town.id) return null;
      // Saved targets can predate warehouses. Preserve the user's target, but
      // every quote (including the final commit) obeys today's shared capacity.
      const needed = Math.max(0, Math.min(rule.targetStock, ctx.getMaterialCapacity(s)) - (s.materials[task.material] || 0));
      let available, unitPrice;
      if (task.source === 'offer') {
        if (!canSellBag(hero, town)) return null;
        const offer = (s.rareOffers || []).find(offer => offer.id === task.offerId && offer.status === 'open' && offer.townId === town.id && offer.heroId === hero.id && offer.material === task.material);
        if (!offer || !material.rare || !integer(offer.unitPrice, 1, 100000)) return null;
        available = Math.min(offer.amount, (hero.rareBag || {})[task.material] || 0); unitPrice = offer.unitPrice;
      } else {
        if (!canSellBag(hero, town) || material.buyable === false) return null;
        if (ctx.incidentFactor && ctx.incidentFactor(s, 'buyStop') === 0) return null; // incident: the roads are closed
        available = Math.max(0, ((hero.bag || {})[task.material] || 0) - questReserved(s, hero, task.material)); unitPrice = Math.max(1, Math.round(material.price * (ctx.incidentFactor ? ctx.incidentFactor(s, 'price:' + task.material) : 1)));
      }
      if (!(unitPrice > 0)) return null;
      const amount = Math.min(needed, available, Math.floor(s.gold / unitPrice), Math.floor((1000000000 - hero.gold) / unitPrice), 100000000 - (s.materials[task.material] || 0));
      return amount > 0 ? { hero, amount, unitPrice, cost: amount * unitPrice } : null;
    }

    function reservedTasks(town, except) {
      return town.staff.filter(worker => worker !== except && worker.operationTask).map(worker => worker.operationTask);
    }

    function choosePurchase(s, town, worker, advanceCursor = true) {
      const rules = Object.entries(town.operations.materialRules).filter(([, rule]) => rule.enabled);
      const reserved = new Set(reservedTasks(town, worker).map(taskKey));
      for (let n = 0; n < rules.length; n++) {
        const index = (town.operations.purchaseCursor + n) % rules.length, [material] = rules[index];
        const base = { type: 'purchase', phase: 'travel', remaining: 2, total: 2, material };
        const candidates = DATA.materials[material].rare ? (s.rareOffers || []).filter(offer => offer.status === 'open' && offer.townId === town.id && offer.material === material).map(offer => ({ ...base, source: 'offer', heroId: offer.heroId, offerId: offer.id })) :
          (s.adventurers || []).filter(hero => canSellBag(hero, town)).map(hero => ({ ...base, source: 'bag', heroId: hero.id, offerId: null }));
        for (const candidate of candidates) if (!reserved.has(taskKey(candidate)) && purchaseQuote(s, town, candidate)) {
          if (advanceCursor) town.operations.purchaseCursor = (index + 1) % rules.length;
          return candidate;
        }
      }
      return null;
    }

    function displayCapacity(town) { return town.facilities.filter(facility => facility.type === 'display').length * 6; }
    function listedCount(town) { return town.inventory.filter(item => item.listed).length; }
    function displayCandidate(s, item, settings) { return !item.listed && !item.locked && !item.autoProtected && !keptByRule(item, settings) && !(ctx.isItemReserved && ctx.isItemReserved(s, item.id)); }

    function taskItems(task) { return Array.isArray(task.itemIds) ? task.itemIds : [task.itemId]; }
    // One trip carries as many items as fit (up to a full table of 6), instead of one item per walk.
    function chooseDisplay(s, town, worker) {
      if (!town.operations.autoDisplay.enabled) return null;
      const reserved = reservedTasks(town, worker).filter(task => task.type === 'display'), carried = new Set(reserved.flatMap(taskItems));
      const free = displayCapacity(town) - listedCount(town) - carried.size;
      if (free <= 0) return null;
      const items = town.inventory.filter(item => displayCandidate(s, item, town.operations.autoDisplay) && !carried.has(item.id)).slice(0, Math.min(6, free));
      const facilities = town.facilities.filter(f => f.type === 'display' && (!worker.assignedFacilityId || worker.assignedFacilityId === f.id));
      facilities.sort((a, b) => reserved.filter(task => task.facilityId === a.id).length - reserved.filter(task => task.facilityId === b.id).length);
      return items.length && facilities.length ? { type: 'display', phase: 'pickup', remaining: 1, total: 1, itemId: items[0].id, itemIds: items.map(item => item.id), facilityId: facilities[0].id } : null;
    }

    function needsCare(s, hero) {
      if (!hero || hero.status !== 'resting' || !hero.bedId || hero.invasionId) return false;
      const maxHp = ctx.getCombatStats(hero).maxHp;
      return hero.injuryUntil > s.time || hero.fatigue > 15 || hero.hp < maxHp * .95 || hero.timer > 0;
    }

    function chooseSupport(s, town, worker) {
      const reserved = reservedTasks(town, worker);
      if (worker.role === 'enhancer') {
        const facilities = town.facilities.filter(f => f.type === 'enhance' && (!worker.assignedFacilityId || f.id === worker.assignedFacilityId) && !reserved.some(task => task.type === 'enhance' && task.facilityId === f.id));
        facilities.sort((a, b) => Number(!!b.heroId) - Number(!!a.heroId));
        return facilities.length ? { type: 'enhance', phase: 'travel', remaining: 0, total: 0, facilityId: facilities[0].id } : null;
      }
      const patients = (s.adventurers || []).filter(hero => hero.resident && hero.townId === town.id && needsCare(s, hero) && !reserved.some(task => task.type === 'care' && task.heroId === hero.id));
      patients.sort((a, b) => Number(b.injuryUntil > s.time) - Number(a.injuryUntil > s.time) || b.fatigue - a.fatigue || a.id.localeCompare(b.id));
      return patients.length ? { type: 'care', phase: 'travel', remaining: 0, total: 0, heroId: patients[0].id } : null;
    }

    function buyingPoint(s, town, worker) {
      const index = Math.max(0, town.staff.filter(w => w.role === 'buyer').indexOf(worker));
      const spots = getTownLayout(s, town.id).counter.buyingSpots;
      return spots[index % spots.length];
    }
    function pickupPoint(s, town, worker) {
      return getTownLayout(s, town.id).warehouse.pickupPoint;
    }
    function carePoint(s, town, hero) {
      const bed = getTownLayout(s, town.id).inn.beds.find(bed => bed.id === hero.bedId);
      return bed ? { x: bed.x + .65, y: bed.y } : null;
    }

    function cancelTask(worker) { worker.operationTask = null; worker.facilityId = null; worker.bubble = null; worker.status = 'idle'; clearRoute(worker); }
    function reconcile(s) {
      for (const town of townList(s)) for (const worker of town.staff || []) {
        if (worker.operationTask && (!taskValid(worker.operationTask, worker) || !taskReferencesValid(s, town, worker.operationTask))) cancelTask(worker);
      }
      return s;
    }
    function arrive(town, worker, point, dt) {
      if (!point) return false;
      setDestination(town, worker, point);
      const arrived = moveActor(town, worker, dt, 2.8);
      if (!arrived || distance(worker, point) > .08) { worker.status = 'walking'; worker.bubble = null; return false; }
      return true;
    }

    function tickPurchase(s, town, worker, dt) {
      const task = worker.operationTask, quote = purchaseQuote(s, town, task);
      if (!quote) { cancelTask(worker); return; }
      if (!arrive(town, worker, buyingPoint(s, town, worker), dt)) return;
      task.phase = 'work'; worker.status = 'working'; worker.bubble = { type: 'material', material: task.material, until: s.time + 1 };
      worker.stamina = Math.max(0, worker.stamina - dt * .8 * fatigueMultiplier(worker)); task.remaining = Math.max(0, task.remaining - dt);
      if (task.remaining > 1e-7) return;
      const current = purchaseQuote(s, town, task);
      if (current) {
        if (task.source === 'offer') ctx.buyRareOffer(s, task.offerId, current.amount, town.id);
        else {
          s.gold -= current.cost; current.hero.gold += current.cost; current.hero.bag[task.material] -= current.amount; s.materials[task.material] += current.amount;
          log(s, 'material-purchase', worker.name + ' · ' + current.hero.name + '에게 ' + DATA.materials[task.material].name + ' ' + current.amount + '개 매입 · −' + current.cost + ' G', { townId: town.id, staffId: worker.id, adventurerId: current.hero.id, material: task.material, amount: current.amount, gold: -current.cost });
        }
      }
      cancelTask(worker);
    }

    function tickDisplay(s, town, worker, dt) {
      const task = worker.operationTask, facility = town.facilities.find(f => f.id === task.facilityId && f.type === 'display');
      const items = taskItems(task).map(id => town.inventory.find(item => item.id === id)).filter(item => item && displayCandidate(s, item, town.operations.autoDisplay));
      if (!town.operations.autoDisplay.enabled || !items.length || !facility || listedCount(town) >= displayCapacity(town)) { cancelTask(worker); return; }
      // Goods are set down from the table's upper side (the staff door side), not walked around to the front.
      const point = task.phase === 'pickup' ? pickupPoint(s, town, worker) : (getDisplayStockSpot ? getDisplayStockSpot(town, facility) : getFacilityWorkSpot(facility));
      if (!arrive(town, worker, point, dt)) return;
      worker.bubble = { type: 'order', until: s.time + 1 };
      if (task.phase === 'pickup') { task.phase = 'delivery'; worker.status = 'walking'; clearRoute(worker); return; }
      task.phase = 'work'; worker.status = 'working'; worker.stamina = Math.max(0, worker.stamina - dt * fatigueMultiplier(worker)); task.remaining = Math.max(0, task.remaining - dt);
      if (task.remaining <= 1e-7) {
        const placed = [];
        for (const item of items) { if (listedCount(town) >= displayCapacity(town)) break; if (ctx.listItem(s, item.id, town.id).ok) placed.push(item); }
        if (placed.length) log(s, 'auto-display', worker.name + ' · ' + placed[0].name + (placed.length > 1 ? ' 외 ' + (placed.length - 1) + '개' : '') + '를 매대로 운반해 진열했습니다.', { townId: town.id, staffId: worker.id, itemId: placed[0].id, itemIds: placed.map(item => item.id) });
        cancelTask(worker);
      }
    }

    function tickSupport(s, town, worker, dt) {
      const task = worker.operationTask;
      let point, active;
      if (task.type === 'enhance') {
        const facility = town.facilities.find(f => f.id === task.facilityId && f.type === 'enhance');
        if (!facility) { cancelTask(worker); return; }
        // The helper works from the anvil's staff side, so the adventurer at the front spot never overlaps them.
        point = getFacilityBackSpot ? getFacilityBackSpot(town, facility) : getFacilityWorkSpot(facility);
        const hero = facility.heroId && heroById(s, facility.heroId);
        active = !!(hero && hero.enhancement && hero.enhancement.facilityId === facility.id);
      } else {
        const hero = heroById(s, task.heroId);
        if (!hero || hero.townId !== town.id || !needsCare(s, hero)) { cancelTask(worker); return; }
        point = carePoint(s, town, hero); active = true;
      }
      if (!arrive(town, worker, point, dt)) return;
      task.phase = 'work'; worker.status = active ? 'working' : 'idle'; worker.bubble = active ? { type: task.type === 'care' ? 'heart' : 'hammer', until: s.time + 1 } : null;
      worker.stamina = active ? Math.max(0, worker.stamina - dt * .8 * fatigueMultiplier(worker)) : Math.min(worker.maxStamina, worker.stamina + dt * 2);
    }

    function tickSupportStaff(s, town, dt) {
      if (!configValid(town.operations)) return;
      for (const worker of town.staff) {
        if (!ROLES.includes(worker.role)) continue;
        if (worker.trainingId) { if (worker.operationTask) cancelTask(worker); worker.status = 'training'; continue; }
        if (worker.salaryDebt > 0) { cancelTask(worker); worker.stamina = Math.min(worker.maxStamina, worker.stamina + dt * 2); continue; }
        if (worker.stamina < worker.maxStamina * .2 && worker.status !== 'resting') { cancelTask(worker); worker.status = 'resting'; }
        if (worker.status === 'resting') {
          const point = getTownLayout(s, town.id).restPoint;
          setDestination(town, worker, point); const reached = moveActor(town, worker, dt, 2.8);
          worker.bubble = { type: 'bed', until: s.time + 1 };
          if (reached) worker.stamina = Math.min(worker.maxStamina, worker.stamina + dt * 9);
          if (worker.stamina >= worker.maxStamina * .65) { worker.status = 'idle'; worker.bubble = null; clearRoute(worker); }
          continue;
        }
        if (!worker.operationTask) worker.operationTask = worker.role === 'buyer' ? choosePurchase(s, town, worker) : worker.role === 'logistics' ? chooseDisplay(s, town, worker) : chooseSupport(s, town, worker);
        if (!worker.operationTask) { worker.status = 'idle'; worker.bubble = null; worker.stamina = Math.min(worker.maxStamina, worker.stamina + dt * 2); continue; }
        if (worker.operationTask.type === 'purchase') tickPurchase(s, town, worker, dt);
        else if (worker.operationTask.type === 'display') tickDisplay(s, town, worker, dt);
        else tickSupport(s, town, worker, dt);
      }
    }

    function getEnhancementMultiplier(s, town, facility) {
      if (typeof town === 'string') town = getTown(s, town);
      if (typeof facility === 'string' && town) facility = town.facilities.find(f => f.id === facility);
      if (!town || !facility) return 1;
      const spot = getFacilityBackSpot ? getFacilityBackSpot(town, facility) : getFacilityWorkSpot(facility);
      return town.staff.some(worker => worker.role === 'enhancer' && activeWorker(worker) && worker.operationTask.type === 'enhance' && worker.operationTask.facilityId === facility.id && distance(worker, spot) <= .08) ? SUPPORT_MULTIPLIER : 1;
    }

    function getRestMultiplier(s, town, hero) {
      if (typeof town === 'string') town = getTown(s, town);
      if (!town || !hero || !needsCare(s, hero)) return 1;
      const spot = carePoint(s, town, hero);
      return spot && town.staff.some(worker => worker.role === 'innkeeper' && activeWorker(worker) && worker.operationTask.type === 'care' && worker.operationTask.heroId === hero.id && distance(worker, spot) <= .08) ? SUPPORT_MULTIPLIER : 1;
    }

    function craftStatus(s, town, enabled, stock) {
      const state = (state, reason) => ({ state, reason });
      if (!enabled.length) return state('off', '자동 제작이 꺼져 있습니다.');
      const enabledIds = new Set(enabled.map(([id]) => id));
      const queued = town.queue.filter(task => enabledIds.has(task.recipeId));
      const running = queued.some(task => {
        const worker = town.staff.find(worker => worker.id === task.staffId), facility = town.facilities.find(facility => facility.id === task.facilityId);
        return task.status === 'working' && facility && facility.active && worker && worker.status === 'working' && workingAllowed(worker);
      });
      if (running) return state('working', '제조 직원이 화덕에서 장비를 만들고 있습니다.');
      if (queued.length) return state('waiting', '제조 직원의 이동·휴식·급여·훈련을 확인해주세요.');
      const needed = enabled.filter(([id, rule]) => rule.targetStock === 0 || stock[id].total < rule.targetStock);
      if (!needed.length) return state('ready', '완성품이 목표 재고를 채웠습니다.');
      const submitted = (s.festival && s.festival.entries || []).filter(entry => entry.townId === town.id).length;
      if (town.inventory.length + town.queue.length + submitted >= 2000) return state('waiting', '창고의 2,000개 보관 한도에 도달했습니다.');
      const capacity = ctx.getEquipmentCapacity(s, town.id);
      if (ctx.getEquipmentUsage(s, town.id) >= capacity) return state('waiting', '창고의 장비 ' + capacity + '칸이 가득 찼습니다. 진열·판매하거나 창고를 확장해주세요.');
      const furnaces = town.facilities.filter(facility => facility.type === 'furnace');
      if (!furnaces.length) return state('waiting', '제작할 화덕을 배치해주세요.');
      if (town.queue.length >= furnaces.length * 3) return state('waiting', '화덕 제작 대기열의 빈자리를 기다립니다.');
      const smiths = town.staff.filter(worker => worker.role === 'smith');
      if (!smiths.length) return state('waiting', '제조 담당 직원을 배정해주세요.');
      const qualified = needed.filter(([id]) => smiths.some(worker => worker.craftLevel >= (recipes.get(id).requiredLevel || 1)));
      if (!qualified.length) return state('waiting', '이 제작법을 배운 제조 직원이 필요합니다.');
      const canAfford = qualified.some(([id]) => Object.entries(recipes.get(id).cost).every(([material, count]) => (s.materials[material] || 0) >= count));
      if (!canAfford) {
        const missing = Object.entries(recipes.get(qualified[0][0]).cost).find(([material, count]) => (s.materials[material] || 0) < count);
        return state('waiting', (missing ? DATA.materials[missing[0]].name + ' 등 ' : '') + '제작 재료를 기다립니다.');
      }
      return state('ready', '다음 제작을 대기열에 예약합니다.');
    }

    function getOperations(s, townId) {
      const town = getTown(s, townId);
      if (!town) return null;
      const settings = config(town);
      if (!configValid(settings)) return { townId: town.id, valid: false, reason: '자동운영 설정을 확인해주세요.' };
      const materialCapacity = ctx.getMaterialCapacity(s);
      const materialRules = Object.fromEntries(materialIds.map(id => {
        const rule = settings.materialRules[id] || { enabled: false, targetStock: Math.min(100, materialCapacity) };
        return [id, { ...rule, effectiveTarget: Math.min(rule.targetStock, materialCapacity), maxTarget: materialCapacity, capped: rule.targetStock > materialCapacity }];
      }));
      const craftRules = Object.fromEntries(DATA.recipes.map(recipe => [recipe.id, { ...(settings.craftRules[recipe.id] || { enabled: false, targetStock: 0 }) }]));
      const staffCounts = Object.fromEntries(ROLES.map(role => [role, town.staff.filter(worker => worker.role === role).length]));
      const state = (state, reason) => ({ state, reason });
      const taskWorkers = town.staff.filter(worker => worker.operationTask && workingAllowed(worker));
      const buyRules = Object.entries(materialRules).filter(([, rule]) => rule.enabled);
      const craftEnabled = Object.entries(craftRules).filter(([, rule]) => rule.enabled);
      const stock = Object.fromEntries(DATA.recipes.map(recipe => [recipe.id, stockCount(s, town, recipe.id)]));
      const needsPurchase = buyRules.some(([id, rule]) => (s.materials[id] || 0) < rule.effectiveTarget);
      const warehouseLimited = buyRules.some(([id, rule]) => (s.materials[id] || 0) > materialCapacity || rule.capped && (s.materials[id] || 0) >= materialCapacity);
      let purchase = !buyRules.length ? state('off', '자동 매입이 꺼져 있습니다.') : !needsPurchase ? warehouseLimited ? state('waiting', '재료별 창고 상한 ' + materialCapacity + '개에 도달했습니다. 재료를 사용하거나 창고를 확장해주세요.') : state('ready', '공유 창고의 목표 재고를 확보했습니다.') : !staffCounts.buyer ? state('waiting', '재료 매입 담당 직원을 배정해주세요.') : taskWorkers.some(worker => worker.operationTask.type === 'purchase') ? state('working', '매입 직원이 이동하거나 거래하고 있습니다.') : state('waiting', '거래할 모험가 재료·골드·직원 근무를 기다립니다.');
      const craft = craftStatus(s, town, craftEnabled, stock);
      let display = !settings.autoDisplay.enabled ? state('off', '자동 진열이 꺼져 있습니다.') : !staffCounts.logistics ? state('waiting', '물류·진열 담당 직원을 배정해주세요.') : taskWorkers.some(worker => worker.operationTask.type === 'display') ? state('working', '직원이 창고에서 매대로 장비를 운반하고 있습니다.') : listedCount(town) >= displayCapacity(town) ? state('waiting', '진열대의 빈자리를 기다립니다.') : !town.inventory.some(item => displayCandidate(s, item, settings.autoDisplay)) ? state('ready', '진열할 장비가 없습니다. 잠금·보관 품질은 유지됩니다.') : state('waiting', '운반 직원의 근무를 기다립니다.');
      const support = !staffCounts.enhancer && !staffCounts.innkeeper ? state('off', '강화 보조·여관 간호 직원이 없습니다.') : town.staff.some(worker => activeWorker(worker) && ['enhance', 'care'].includes(worker.operationTask.type)) ? state('working', '강화대와 여관에서 담당 업무를 돕고 있습니다.') : state('waiting', '담당 작업점으로 이동하거나 지원할 대상을 기다립니다.');
      return { townId: town.id, valid: true, materialCapacity, materialRules, craftRules, autoDisplay: { ...settings.autoDisplay }, staffCounts, status: { purchase, craft, display, support }, recipeStock: stock,
        materialStock: Object.fromEntries(materialIds.map(id => [id, s.materials[id] || 0])),
        workers: town.staff.filter(worker => ROLES.includes(worker.role)).map(worker => ({ id: worker.id, name: worker.name, role: worker.role, status: worker.status, stamina: worker.stamina, maxStamina: worker.maxStamina, salaryDebt: worker.salaryDebt || 0, training: !!worker.trainingId, task: worker.operationTask ? { ...worker.operationTask } : null })) };
    }

    return { init, normalize: init, validate, reconcile, step, tickSupportStaff, onCraft, getEnhancementMultiplier, getRestMultiplier, getOperations, setMaterialPurchaseRule, setMaterialPurchaseRules, setAutoCraftRule, removeAutoCraftRule, setAutoDisplay };
  }

  const api = { ROLES, MAX_TARGET, SUPPORT_MULTIPLIER, create };
  global.ForgeOperations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
