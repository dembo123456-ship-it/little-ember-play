(function (global) {
  'use strict';

  // Equipment occupies its own branch's warehouse. Materials remain in the
  // chain's shared pool; every owned warehouse contributes the same allowance
  // to EACH material, never a single combined stack limit.
  const LEVELS = Object.freeze([
    // 2026-11 design: per-material limit 50/100/150/200/300 and 1/2/3/4/6 shelves; the room itself never grows.
    { level: 1, name: '작은 창고', capacity: 50, shelves: 1, upgradeCost: 300 },
    { level: 2, name: '정돈된 창고', capacity: 100, shelves: 2, upgradeCost: 800 },
    { level: 3, name: '확장 창고', capacity: 150, shelves: 3, upgradeCost: 2000 },
    { level: 4, name: '대형 창고', capacity: 200, shelves: 4, upgradeCost: 5000 },
    { level: 5, name: '중앙 물류 창고', capacity: 300, shelves: 6, upgradeCost: null }
  ].map(Object.freeze));
  const MAX_LEVEL = LEVELS.length;
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const levelOf = town => town && town.warehouseLevel === undefined ? 1 : town && town.warehouseLevel;
  const levelValid = level => Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL;
  const definition = town => levelValid(levelOf(town)) ? LEVELS[levelOf(town) - 1] : null;

  function decorateData(DATA) {
    DATA.warehouseLevels = LEVELS.map(row => ({ ...row, equipmentCapacity: row.capacity, materialCapacity: row.capacity, materialContribution: row.capacity, cost: row.upgradeCost }));
    if (Array.isArray(DATA.upgrades) && !DATA.upgrades.some(row => row.id === 'warehouse')) DATA.upgrades.push({ id: 'warehouse', name: '창고 확장', description: '재료별 보관 한도 · 장비 보관량 · 창고 선반 증가', baseCost: LEVELS[0].upgradeCost, maxLevel: MAX_LEVEL - 1, icon: 'box' });
    return DATA;
  }

  function create(ctx) {
    const { DATA, getTown, getOwnedTowns, result, log } = ctx;
    const towns = s => record(s) && record(s.towns) ? getOwnedTowns(s).filter(record) : [];
    const materialKnown = material => typeof material === 'string' && Object.prototype.hasOwnProperty.call(DATA.materials, material);

    function init(s) {
      // Only an absent field is a legacy save. Never repair invalid levels or
      // discard resources which predate the new capacity system.
      for (const town of towns(s)) if (town.warehouseLevel === undefined) town.warehouseLevel = 1;
      return s;
    }

    function validate(s) {
      return towns(s).every(town => town.warehouseLevel === undefined || levelValid(town.warehouseLevel));
    }

    function getMaterialCapacity(s) {
      return towns(s).reduce((sum, town) => sum + (definition(town)?.capacity || 0), 0);
    }

    function getMaterialRoom(s, material) {
      if (!materialKnown(material)) return 0;
      return Math.max(0, getMaterialCapacity(s) - ((s.materials || {})[material] || 0));
    }

    function getEquipmentCapacity(s, townId) {
      const town = getTown(s, townId);
      return town ? definition(town)?.capacity || 0 : 0;
    }

    function equipmentCounts(s, town) {
      const inventory = town.inventory || [];
      const storedEquipment = inventory.filter(item => !item.listed).length;
      const listedEquipment = inventory.length - storedEquipment;
      const queuedEquipment = (town.queue || []).length;
      const festivalReservations = (s.festival?.entries || []).filter(entry => entry.townId === town.id).length;
      const reservedEquipment = queuedEquipment + festivalReservations;
      return { storedEquipment, listedEquipment, queuedEquipment, festivalReservations, reservedEquipment, equipmentUsed: storedEquipment + reservedEquipment };
    }

    function getEquipmentUsage(s, townId) {
      const town = getTown(s, townId);
      return town ? equipmentCounts(s, town).equipmentUsed : 0;
    }

    function getWarehouseUpgradeCost(s, townId) {
      return definition(getTown(s, townId))?.upgradeCost ?? null;
    }

    function getWarehouse(s, townId) {
      const town = getTown(s, townId);
      if (!town) return null;
      const current = definition(town);
      if (!current) return { valid: false, townId: town.id, reason: '창고 단계를 확인해주세요.' };
      const counts = equipmentCounts(s, town), next = LEVELS[current.level] || null;
      const materialCapacity = getMaterialCapacity(s), materialContribution = current.capacity;
      return {
        valid: true, townId: town.id, level: current.level, name: current.name, maxLevel: MAX_LEVEL,
        shelves: current.shelves,
        equipmentCapacity: current.capacity, ...counts,
        equipmentFree: Math.max(0, current.capacity - counts.equipmentUsed),
        equipmentOverflow: Math.max(0, counts.equipmentUsed - current.capacity),
        atCap: counts.equipmentUsed >= current.capacity,
        materialCapacity, materialContribution,
        materialOverflow: Object.keys(DATA.materials).filter(id => (s.materials[id] || 0) > materialCapacity).map(id => ({ id, stored: s.materials[id], overflow: s.materials[id] - materialCapacity })),
        upgradeCost: current.upgradeCost, nextLevel: next ? next.level : null,
        nextEquipmentCapacity: next ? next.capacity : null,
        nextMaterialCapacity: next ? materialCapacity - materialContribution + next.capacity : null,
        nextMaterialContribution: next ? next.capacity : null,
        nextShelves: next ? next.shelves : null
      };
    }

    function upgradeWarehouse(s, townId) {
      const town = getTown(s, townId), current = definition(town);
      if (!town || !current) return result(false, '운영 중인 지점과 창고 단계를 확인해주세요.');
      if (current.upgradeCost === null) return result(false, '창고를 최대 크기까지 확장했습니다.');
      if (!(Number.isFinite(s.gold) && s.gold >= current.upgradeCost)) return result(false, '창고 확장에 ' + current.upgradeCost + ' G가 필요합니다.');
      s.gold -= current.upgradeCost;
      town.warehouseLevel = current.level + 1;
      if (typeof ctx.onLayoutChange === 'function') ctx.onLayoutChange(s, town);
      const warehouse = getWarehouse(s, town.id);
      log(s, 'warehouse-upgrade', town.name + ' 창고 Lv.' + warehouse.level + ' · 장비 ' + warehouse.equipmentCapacity + '칸 · 체인 재료별 ' + warehouse.materialCapacity + '개 보관', { townId: town.id, warehouseLevel: town.warehouseLevel, gold: -current.upgradeCost });
      return result(true, '창고를 확장했습니다. 장비 보관량과 재료별 매입 상한이 늘어났습니다.', { cost: current.upgradeCost, warehouse });
    }

    return { init, normalize: init, validate, getWarehouse, getMaterialCapacity, getMaterialRoom, getEquipmentCapacity, getEquipmentUsage, getWarehouseUpgradeCost, upgradeWarehouse };
  }

  const api = { LEVELS, MAX_LEVEL, decorateData, create };
  global.ForgeWarehouse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
