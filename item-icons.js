// Equipment and material icons (2026-11): one 960-wide atlas, rows of 10 slots of 96px, cut from art/items/items-NN.
// The order matches docs/art-request-items.md (recipes, then materials); slot = index in ids.
(function (global) {
  'use strict';
  const SRC = 'assets/items/items-v2.png' /* 12 rows; style.css .item-pic uses 1000% 1200% */, SLOT = 96, COLS = 10;
  const ids = Object.freeze(['axe_craft_1','axe_craft_10','axe_craft_20','astral_axe_30','oak_bow','hunter_bow','frost_bow','astral_bow_30','crossbow_craft_1','crossbow_craft_10','ranger_crossbow','crossbow_craft_20','astral_crossbow_30','dagger_craft_1','dagger_craft_10','dagger_craft_20','astral_dagger_30','gauntlet_craft_1','gauntlet_craft_10','gauntlet_craft_20','astral_gauntlet_30','spear_craft_1','iron_spear','spear_craft_10','spear_craft_20','astral_spear_30','apprentice_staff','star_staff','crystal_staff','astral_staff_30','ember_guard_staff','iron_sword','forest_blade','ember_guard_sword','steel_sword','world_reward_blade','mythril_blade','abyss_blade','astral_sword_30','focus_craft_1','focus_craft_10','focus_craft_20','quiver_craft_1','quiver_craft_10','quiver_craft_20','iron_shield','invasion_reward_shield','ember_guard_shield','giant_guard','mythril_shield','dragon_aegis','astral_shield_30','tome_craft_1','tome_craft_10','tome_craft_20','leather_armor','guard_armor','moon_mantle','dragon_armor','cloth_craft_1','cloth_craft_10','cloth_craft_20','heavy_craft_1','heavy_craft_10','ember_guard_armor','heavy_craft_20','light_craft_1','light_craft_10','light_craft_20','copper_ring','traveler_charm','astral_crown','amulet_craft_1','amulet_craft_10','amulet_craft_20','ember_guard_amulet','belt_craft_1','belt_craft_10','belt_craft_20','ring_craft_1','ring_craft_10','ring_craft_20','iron','wood','leather','crystal','mythril','ancient_heart','giant_core','star_fragment','frost_scale','abyss_crystal','invasion_ember',
    // 2026-11-09: boss rare pieces (art/items/items-11, items-12) and the rare recipe scroll.
    'rare_moss_sword','rare_moss_shield','rare_moss_light','rare_colossus_axe','rare_colossus_heavy','rare_colossus_belt','rare_oracle_staff','rare_oracle_cloth','rare_oracle_amulet','rare_drake_bow',
    'rare_drake_quiver','rare_drake_gauntlet','rare_abyss_spear','rare_abyss_dagger','rare_abyss_ring','rare_recipe_scroll',
    // 2026-11-10: 서리문 final boss pieces (art/items/rare_silent_*.png via scripts/add-item-icons.ps1).
    'rare_silent_sword','rare_silent_shield','rare_silent_staff']);
  const index = new Map(ids.map((id, i) => [id, i]));
  // Fallback only: a rare piece without its own slot borrows its base piece's icon.
  const ALIAS = { rare_moss_sword: 'forest_blade', rare_moss_shield: 'giant_guard', rare_moss_light: 'light_craft_10', rare_colossus_axe: 'axe_craft_10', rare_colossus_heavy: 'heavy_craft_10', rare_colossus_belt: 'belt_craft_10',
    rare_oracle_staff: 'star_staff', rare_oracle_cloth: 'cloth_craft_20', rare_oracle_amulet: 'amulet_craft_20', rare_drake_bow: 'frost_bow', rare_drake_quiver: 'quiver_craft_20', rare_drake_gauntlet: 'gauntlet_craft_20',
    rare_abyss_spear: 'astral_spear_30', rare_abyss_dagger: 'astral_dagger_30', rare_abyss_ring: 'astral_crown' };
  for (const [id, base] of Object.entries(ALIAS)) if (!index.has(id) && index.has(base)) index.set(id, index.get(base));
  const rows = Math.ceil(ids.length / COLS);
  // Source rect of an icon in the atlas, or null when the id has no icon.
  function source(id) { const i = index.get(id); return i === undefined ? null : { x: i % COLS * SLOT, y: Math.floor(i / COLS) * SLOT, w: SLOT, h: SLOT }; }
  // CSS background-position for an atlas drawn at background-size COLS*100% rows*100%.
  function cssPosition(id) { const i = index.get(id); if (i === undefined) return null; const c = i % COLS, r = Math.floor(i / COLS); return (c * 100 / (COLS - 1)).toFixed(4) + '% ' + (r * 100 / (rows - 1)).toFixed(4) + '%'; }
  const api = Object.freeze({ src: SRC, slot: SLOT, cols: COLS, rows, ids, has: id => index.has(id), source, cssPosition });
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.ForgeItemIcons = api;
})(typeof window !== 'undefined' ? window : globalThis);
