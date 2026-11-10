(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ForgeShopLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Tile geometry is shared by simulation and renderer.  A point is a tile
  // centre; every structural footprint below is also a real walking obstacle.
  // VERSION 3 (2026-11): a 4-tile band separates the shop from the rear rooms, Stardew-style: an empty gap between the
  // two rooms (crossed by a short staff corridor) and the shop's 3-tile back wall face. The workshop and the warehouse
  // sit WALL_GAP tiles further back than in VERSION 1 (VERSION 2 used a 3-tile band without the gap).
  // VERSION 6: no separate warehouse room (its shelves stand along the workshop's left wall) and the shop/workshop are
  // 4 tiles wider (base width 22, see BASE_WIDTH).
  // VERSION 7: the workshop is mirrored — furnaces along the left of the back wall, the storage corner on the right.
  const VERSION = 7, WALL_GAP = 4, BASE_WIDTH = 22, GAP_BY_VERSION = { 1: 0, 2: 3, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4 };
  const cache = new WeakMap();
  function contains(rect, x, y) { return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h; }
  function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function get(town) {
    const key = [town.id, town.width, town.height, town.level, town.warehouseLevel, town.workshopExtraDepth, town.innLevel, town.innVersion, town.innLegacyCapacity, town.innLayoutHeight].join(':');
    const cached = cache.get(town); if (cached && cached.key === key) return cached.layout;
    const level = town.level || 1, width = town.width || BASE_WIDTH, height = town.height || 12;
    const warehouseLevel = town.warehouseLevel || 1;
    // 2026-11: the workshop no longer deepens with the forge level (the map is fixed; levels only add facilities).
    // A save from before the change (wider than the base map) keeps its old depth until it is settled on load.
    const workshopDepth = (width > BASE_WIDTH ? 6 + level * 2 : 8) + (town.workshopExtraDepth || 0);
    const capacity = town.innVersion === 2 ? Math.max((town.innLevel || 1) * 8, town.innLegacyCapacity || 0) : Math.min(100, 4 + (town.innLevel || 1) * 2), innHeight = town.innVersion === 2 ? town.innLayoutHeight : 8 + Math.min(2, Math.floor((capacity - 6) / 24));
    // The inn stands to the RIGHT of the shop, matching the village picture (forge left, inn right).
    const innX = width + 2, innEntrance = { x: innX + 3.5, y: 1 + innHeight + .5 };
    // VERSION 5 (2026-11 sketch): a 6-tile sales counter on the left (above display columns 1-2), the staff door and
    // corridor right above its centre, so the right side of the shop is free for the enhancement anvils.
    // 2026-11 (user layout): the counter, the staff door and the corridor are centred on the front entrance.
    const mid = Math.floor(width / 2), cw = 6, cx = mid - cw / 2;
    const staffDoor = { x: mid - 1, y: 0, w: 2, h: 1 }, corridor = { x: mid - 1, y: -WALL_GAP, w: 2, h: WALL_GAP };
    const rearBottom = -WALL_GAP;
    const warehouseDoor = null;
    const counter = {
      // 2026-11: one row higher (row 2); staff stand on row 1 right behind it.
      x: cx, y: 2, w: cw, h: 1,
      staffSpots: [{ x: mid - 1, y: 1.4 }, { x: mid + 1, y: 1.4 }],
      // On the walking line from the front door (tile centre mid + .5), so customers walk straight up to it.
      customerSpot: { x: mid + .5, y: 3.5 },
      buyingSpots: [{ x: mid - 2, y: 1.5 }, { x: mid + .5, y: 1.5 }],
      staffArea: { x: cx, y: 1, w: cw + 1, h: 1 }
    };
    const left = -11, top = rearBottom - workshopDepth - 2;
    // Large populations still need outdoor standing space for gatherings.
    const bottom = Math.max(height + 4, 5 + Math.ceil(capacity / 3) * 2);
    const layout = {
      version: VERSION,
      shop: { x: 0, y: 0, w: width, h: height },
      salesFloor: { x: 1, y: 1, w: width - 2, h: height - 2 },
      workshop: { x: 0, y: rearBottom - workshopDepth, w: width, h: workshopDepth },
      // Storage corner (former warehouse room): a 9-tile strip on the workshop's right side with two rows of shelves (3 each)
      // and crates; staff pick up goods in the aisle between the shelf rows. Kept as layout.warehouse so storage logic keeps one place to look.
      warehouse: { x: width - 9, y: rearBottom - workshopDepth + 1, w: 8, h: workshopDepth - 1, level: warehouseLevel, door: null, storageCorner: true, side: 'right', pickupPoint: { x: width - 5.5, y: rearBottom - workshopDepth + 2.5 } },
      inn: { x: innX, y: 1, w: 7, h: innHeight, level: town.innLevel || 1, capacity, entrance: innEntrance, beds: Array.from({ length: capacity }, (_, i) => ({ id: town.id + '-bed-' + (i + 1), x: innEntrance.x, y: innEntrance.y })) },
      partition: { x: 0, y: rearBottom, w: width, h: WALL_GAP + 1, door: staffDoor, corridor },
      wallGap: WALL_GAP, corridor, staffDoor, warehouseDoor, counter,
      entrance: { x: Math.floor(width / 2) + .5, y: height - .5 },
      exit: { x: Math.floor(width / 2) + .5, y: height + 3 },
      // Staff rest spot: open floor in the lower workshop, between the furnace row and the corridor.
      // (bottom-left corner of the workshop, away from the centred corridor)
      restPoint: { x: 2.5, y: rearBottom - 1.5 },
      // Resting staff stand on separate spots around the rest point instead of piling up on one tile.
      restSpots: [[0, 0], [1.25, 0], [-1.25, 0], [2.5, 0], [0, 1], [1.25, 1], [-1.25, 1], [2.5, 1]].map(([dx, dy]) => ({ x: 2.5 + dx, y: rearBottom - 1.5 + dy })),
      // Left side keeps its old extent so actors saved near the former left-hand inn can still walk out.
      bounds: { x: left, y: top, w: innX + 10 - left, h: bottom - top }
    };
    layout.warehouse.shelves = storageShelves(layout.warehouse);
    // Staff pick goods up in the aisle between the two shelf rows (just in front of the upper row), never on a shelf.
    if (layout.warehouse.shelves.length) layout.warehouse.pickupPoint = { x: layout.warehouse.pickupPoint.x, y: layout.warehouse.shelves[0].base + .6 };
    cache.set(town, { key, layout }); return layout;
  }

  // Storage-corner shelves (art: 133x219 px at half scale = about 2.08 x 3.42 tiles). Two rows of up to 3 against the
  // side wall; the warehouse level sets how many stand (Lv.1-5: 1/2/3/4/6), upper row first. Each shelf's floor
  // footprint (the 1.6 tiles above its base line) blocks walking, so nobody walks through a shelf.
  const SHELF_W = 133 * .5 / 32, SHELF_H = 219 * .5 / 32, SHELF_DEPTH = 1.6;
  function storageShelves(warehouse) {
    if (!warehouse || !warehouse.storageCorner) return [];
    const lower = warehouse.y + warehouse.h - 1, upper = lower - SHELF_H - 1;
    const right = warehouse.side === 'right', edge = right ? warehouse.x + warehouse.w + 1 - .1 : warehouse.x - 1 + .1, dir = right ? -1 : 1;
    const count = [1, 2, 3, 4, 6][Math.max(1, Math.min(5, warehouse.level || 1)) - 1], shelves = [];
    [upper, lower].forEach((base, row) => { for (let i = 0; i < 3 && row * 3 + i < count; i++) {
      const cx = edge + dir * (SHELF_W / 2 + i * SHELF_W);
      shelves.push({ cx, base, variant: row * 3 + i, x: cx - SHELF_W / 2, y: base - SHELF_DEPTH, w: SHELF_W, h: SHELF_DEPTH });
    } });
    return shelves;
  }
  // A tile is blocked by a shelf when its centre lies on the shelf's floor footprint.
  function onShelf(warehouse, x, y) { return (warehouse.shelves || []).some(s => contains(s, x + .5, y + .5)); }

  function structuralWalkable(town, x, y, staffAccess) {
    const layout = get(town), shop = layout.shop, workshop = layout.workshop, warehouse = layout.warehouse;
    const b = layout.bounds;
    if (x < b.x + 1 || x > b.x + b.w - 2 || y < b.y + 1 || y > b.y + b.h - 1) return false;
    // Keep outdoor walkers off the strip hugging the front wall (except in front of the door):
    // a full character drawn there overlaps the wall and looks like it walks through it.
    if (y === shop.y + shop.h && x >= shop.x && x < shop.x + shop.w && x !== Math.floor(shop.w / 2) && x !== Math.floor(shop.w / 2) - 1) return false;
    if (contains(shop, x, y)) {
      const frontDoor = y === shop.h - 1 && (x === Math.floor(shop.w / 2) || x === Math.floor(shop.w / 2) - 1);
      const backDoor = y === 0 && contains(layout.staffDoor, x, y);
      if ((x === 0 || x === shop.w - 1 || y === 0 || y === shop.h - 1) && !frontDoor && !(backDoor && staffAccess !== false)) return false;
      if (contains(layout.counter, x, y) || (layout.counter.return && contains(layout.counter.return, x, y))) return false;
      if (staffAccess === false && contains(layout.counter.staffArea, x, y)) return false;
    }
    // The wall band between the shop and the rear rooms: only the staff corridor is open.
    if (y >= -WALL_GAP && y < 0 && x >= shop.x && x < shop.x + shop.w) return staffAccess !== false && contains(layout.corridor, x, y);
    if (contains(workshop, x, y)) {
      if (staffAccess === false) return false;
      if (x === 0 || x === workshop.w - 1 || y === workshop.y) return false;
      if (onShelf(warehouse, x, y)) return false;
    }
    return true;
  }

  function facilityRegion(town, facility) {
    const layout = get(town), room = facility.type === 'furnace' ? layout.workshop : layout.shop;
    const bottom = facility.type === 'furnace' ? -WALL_GAP - 1 : town.height - 2;
    if (facility.x < 1 || facility.x + facility.w > town.width - 1 || facility.y < room.y + 1 || facility.y + facility.h > bottom) return false;
    if (facility.type !== 'furnace') {
      // Keep the whole counter island and the staff entrance approach clear.
      if (overlaps(facility, { x: layout.counter.x, y: 1, w: layout.counter.w + 1, h: 4 })) return false;
    }
    // Furnaces stay out of the storage corner (shelves, pickup spot, rest spot) along the workshop's left wall.
    if (facility.type === 'furnace' && overlaps(facility, layout.warehouse)) return false;
    const reserved = facility.type === 'furnace' ? [layout.restPoint, layout.warehouse.pickupPoint, { x: layout.corridor.x + 1, y: -WALL_GAP - .5 }] : [layout.counter.customerSpot];
    return !reserved.some(point => contains(facility, point.x, point.y));
  }

  return { VERSION, WALL_GAP, BASE_WIDTH, GAP_BY_VERSION, get, contains, overlaps, structuralWalkable, facilityRegion, storageShelves };
});
