(function (global) {
  'use strict';

  // Game canvas: 1280x720 logical pixels (16:9 base resolution for PC and mobile landscape).
  const W = 1280, H = 720;
  const FONT = '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  const C = {
    ink: '#654d3e', light: '#fff9eb', paper: '#f3e9d2', brown: '#a97a50',
    darkWood: '#76503a', gold: '#d9a452', coral: '#cc765d', sage: '#74896b',
    grass: '#b9c997', grassDark: '#91a77b', stone: '#d5c7a6', shadow: '#564b3b'
  };
  const SPRITES = { raon: 10, rin: 12, tobi: 0, luna: 11, bram: 9, sera: 13 };
  const LEGACY_SPRITES = { 10: 7, 11: 8, 12: 6, 13: 4 };
  // Tight alpha bounds, embedded so the game also opens directly from disk.
  const SPRITE_CROPS = [
    { x: 100, y: 62, w: 256, h: 333 }, { x: 438, y: 54, w: 247, h: 345 },
    { x: 751, y: 92, w: 271, h: 309 }, { x: 1075, y: 77, w: 279, h: 325 },
    { x: 1425, y: 44, w: 279, h: 355 }, { x: 111, y: 466, w: 240, h: 346 },
    { x: 437, y: 468, w: 249, h: 344 }, { x: 758, y: 466, w: 253, h: 348 },
    { x: 1058, y: 458, w: 307, h: 355 }, { x: 1428, y: 472, w: 242, h: 342 }
  ];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function noise(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function rounded(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lineWidth) {
    rounded(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 2; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function line(ctx, points, color, width) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function text(ctx, value, x, y, size, color, weight, align) {
    ctx.font = `${weight || 500} ${size || 14}px ${FONT}`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color || C.ink;
    ctx.fillText(String(value), x, y);
  }
  // 2026-11: soft contact shadow, densest right under the object and fading out, so things sit on the floor.
  function shadow(ctx, x, y, rx, ry, alpha) {
    const a = alpha || 0.15;
    if (!ctx.createRadialGradient || !(rx > 0) || !(ry > 0)) { ellipse(ctx, x, y, rx, ry, `rgba(68,48,36,${a})`); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(52,34,22,${Math.min(.5, a * 2.1)})`); g.addColorStop(.55, `rgba(60,40,26,${Math.min(.36, a * 1.4)})`); g.addColorStop(1, 'rgba(68,48,36,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // Real seconds at the current speed for on-screen timers (app.js sets LittleEmberGameRate; 2 = 1x speed).
  const gameRate = () => { try { return (global.LittleEmberGameRate && global.LittleEmberGameRate()) || 2; } catch (_) { return 2; } };
  // Painted icons (2026-11-10): the same art as the screen icons (app.js shares LittleEmberIconArt).
  const paintedIcons = {};
  function paintedIcon(kind) {
    const art = global.LittleEmberIconArt && global.LittleEmberIconArt[kind === 'worldBoss' ? 'boss' : kind]; if (!art || typeof Image === 'undefined') return null;
    let img = paintedIcons[kind]; if (!img) { img = paintedIcons[kind] = new Image(); img.src = art; }
    return img.complete && img.naturalWidth ? img : null;
  }
  function icon(ctx, kind, x, y, size, color) {
    const art = paintedIcon(kind);
    if (art) { ctx.drawImage(art, x - size / 2, y - size / 2, size, size); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = 2; ctx.strokeStyle = color || C.ink; ctx.fillStyle = color || C.ink;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'hammer') {
      ctx.rotate(-0.65); box(ctx, -3, -2, 6, 13, 1.5, color || C.ink);
      box(ctx, -8.5, -9, 17, 8, 2, color || C.ink);
    } else if (kind === 'sword') {
      line(ctx, [[-6, 8], [7, -7]], color, 3);
      line(ctx, [[1, -2], [6, 2]], color, 2.2);
      line(ctx, [[-7, 8], [-8, 9]], color, 4);
      ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(10, -10); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill();
    } else if (kind === 'scroll') {
      box(ctx, -7, -9, 13, 18, 2, null, color, 1.8);
      line(ctx, [[-3, -4], [3, -4]], color, 1.7); line(ctx, [[-3, 0], [3, 0]], color, 1.7);
      line(ctx, [[-3, 4], [1, 4]], color, 1.7);
    } else if (kind === 'coin') {
      // A filled gold coin (an outline with a bar read as a stray "ㅣ" in the bubble).
      ellipse(ctx, 0, 0, 9, 9, '#f4c64e', '#b07a24', 1.8);
      ellipse(ctx, 0, 0, 5.6, 5.6, null, '#d39a32', 1.4);
      ellipse(ctx, -3, -3.4, 1.8, 1.2, 'rgba(255,250,220,.9)');
    } else if (kind === 'bed') {
      box(ctx, -10, -2, 20, 9, 2, null, color, 1.8);
      box(ctx, -8, -7, 7, 6, 2, color);
      line(ctx, [[-11, -9], [-11, 10]], color, 2);
      line(ctx, [[11, -3], [11, 10]], color, 2);
      line(ctx, [[-9, 3], [9, 3]], color, 1.8);
    } else if (kind === 'heart') {
      ctx.beginPath();ctx.moveTo(0,8);ctx.bezierCurveTo(-17,-1,-9,-15,0,-6);ctx.bezierCurveTo(9,-15,17,-1,0,8);ctx.fill();
    } else if (kind === 'combat') {
      line(ctx,[[-8,-8],[8,8]],color,3);line(ctx,[[8,-8],[-8,8]],color,3);line(ctx,[[-9,4],[-4,9]],color,2);line(ctx,[[4,9],[9,4]],color,2);
    } else if (kind === 'boss' || kind === 'worldBoss') {
      ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-11,-10);ctx.lineTo(-10,1);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(6,-4);ctx.lineTo(11,-10);ctx.lineTo(10,1);ctx.lineTo(5,5);ctx.closePath();ctx.fill();
      ellipse(ctx,0,1,7.5,9,color||C.ink);
      line(ctx,[[-4,-1],[-2,1]],'#fff5df',1.7);line(ctx,[[4,-1],[2,1]],'#fff5df',1.7);
      line(ctx,[[-2,6],[2,6]],'#fff5df',1.4);
      if(kind==='worldBoss')line(ctx,[[-6,-7],[-7,-13],[-2,-10],[0,-15],[2,-10],[7,-13],[6,-7]],'#d9ac58',2);
    } else if (kind === 'incapacitated') {
      box(ctx,-9,-8,18,17,3,null,color,1.8);line(ctx,[[-4,-4],[4,4]],color,2);line(ctx,[[4,-4],[-4,4]],color,2);
    } else if (kind === 'angry') {
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){ctx.save();ctx.rotate(a);line(ctx,[[3,-8],[3,-3],[8,-3]],color,2);ctx.restore();}
    } else if (kind === 'book') {
      box(ctx,-9,-8,18,17,2,null,color,1.8);line(ctx,[[0,-7],[0,8]],color,1.5);line(ctx,[[-6,-2],[-2,-2]],color,1);line(ctx,[[2,-2],[6,-2]],color,1);
    } else if (kind === 'material') {
      ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-10, -1); ctx.lineTo(-4, -8);
      ctx.lineTo(6, -9); ctx.lineTo(10, -2); ctx.lineTo(7, 7); ctx.closePath();
      ctx.fillStyle = color || '#8ca5a1'; ctx.fill();
      line(ctx, [[-4, -8], [0, 0], [7, 7]], '#e9f0dc', 1.2);
      line(ctx, [[-9, -1], [0, 0], [9, -2]], '#c7d7cd', 1.2);
    } else if (kind === 'leaf') {
      ctx.beginPath(); ctx.moveTo(-7, 6); ctx.bezierCurveTo(-13, -3, 1, -11, 9, -9);
      ctx.bezierCurveTo(10, -1, 4, 11, -7, 6); ctx.fill();
      line(ctx, [[-7, 9], [4, -4]], '#fff9eb', 1.5);
    } else {
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(2, -2, 10, 0);
      ctx.quadraticCurveTo(2, 2, 0, 10); ctx.quadraticCurveTo(-2, 2, -10, 0);
      ctx.quadraticCurveTo(-2, -2, 0, -10); ctx.fill();
    }
    ctx.restore();
  }
  function pill(ctx, label, x, y, options) {
    const o = options || {}, size = o.size || 12;
    ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
    const w = ctx.measureText(label).width + (o.icon ? 43 : 24), h = o.height || 29;
    ctx.shadowColor = 'rgba(58,40,23,.10)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2;
    box(ctx, x - w / 2, y - h / 2, w, h, 9, o.fill || 'rgba(255,250,237,.96)', o.stroke || 'rgba(114,84,55,.20)', 1);
    ctx.shadowColor = 'transparent';
    if (o.icon) icon(ctx, o.icon, x - w / 2 + 16, y, 15, o.color || C.ink);
    text(ctx, label, x + (o.icon ? 9 : 0), y + .5, size, o.color || C.ink, 700);
    ctx.restore();
    return { x: x - w / 2, y: y - h / 2, w, h };
  }
  function worldLevelText(level, range) {
    return Array.isArray(range) && range.length === 2 ? `권장 Lv.${range[0]}–${range[1]}` : `권장 Lv.${level || 1}`;
  }
  function bossTimer(seconds) {
    const whole = Math.max(0, Math.ceil(Number(seconds) || 0));
    return String(Math.floor(whole / 60)).padStart(2, '0') + ':' + String(whole % 60).padStart(2, '0');
  }
  function tree(ctx, x, y, scale, hue) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
    shadow(ctx, 0, 9, 32, 11, .10);
    box(ctx, -5, -21, 10, 32, 3, '#927458', '#7a664b', 1.4);
    const col = hue || '#88a576';
    ellipse(ctx, -13, -29, 23, 24, col, '#739164', 1.5);
    ellipse(ctx, 15, -31, 23, 25, col, '#739164', 1.5);
    ellipse(ctx, 0, -49, 25, 27, '#9eb483', '#789567', 1.5);
    ellipse(ctx, -7, -56, 12, 8, 'rgba(218,228,172,.24)');
    ctx.restore();
  }
  function pine(ctx, x, y, scale, snowy) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
    shadow(ctx, 0, 7, 22, 8, .09);
    box(ctx, -4, -17, 8, 24, 2, '#88715b');
    const fill = snowy ? '#8ba5a0' : '#78977a';
    for (let i = 0; i < 3; i++) {
      const top = -65 + i * 17, half = 16 + i * 5;
      ctx.beginPath(); ctx.moveTo(0, top); ctx.quadraticCurveTo(half * .6, top + 18, half, top + 28);
      ctx.quadraticCurveTo(0, top + 35, -half, top + 28); ctx.quadraticCurveTo(-half * .5, top + 15, 0, top);
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#668678'; ctx.lineWidth = 1.2; ctx.stroke();
      if (snowy) { ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(half * .60, top + 19); ctx.quadraticCurveTo(0, top + 24, -half * .60, top + 19); ctx.closePath(); ctx.fillStyle = '#edf3e6'; ctx.fill(); }
    }
    ctx.restore();
  }
  function rock(ctx, x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
    ctx.beginPath(); ctx.moveTo(-23, 8); ctx.lineTo(-25, -6); ctx.lineTo(-9, -21); ctx.lineTo(13, -18); ctx.lineTo(25, 0); ctx.lineTo(16, 11); ctx.closePath();
    ctx.fillStyle = color || '#b8b8a1'; ctx.fill(); ctx.strokeStyle = '#929781'; ctx.lineWidth = 1.5; ctx.stroke();
    line(ctx, [[-9, -19], [-2, -2], [22, 1]], 'rgba(255,255,239,.32)', 2);
    ctx.restore();
  }
  function plant(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
    box(ctx, -13, -1, 26, 24, 7, '#bc8767', '#8d684f', 2);
    box(ctx, -16, -5, 32, 10, 4, '#d7a581', '#8d684f', 2);
    for (const [rx, ry, a] of [[-12, -15, -.6], [12, -19, .6], [0, -28, 0], [-8, -30, -.3], [10, -35, .4]]) {
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(a);
      ellipse(ctx, 0, 0, 7, 15, '#8ca171', '#73875e', 1); ctx.restore();
    }
    ctx.restore();
  }
  function weapon(ctx, x, y, kind, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1);
    if (kind === 'bow') {
      ctx.beginPath(); ctx.arc(0, 0, 19, -1.1, 1.1); ctx.strokeStyle = '#a97b47'; ctx.lineWidth = 5; ctx.stroke();
      line(ctx, [[8.5, -17], [8.5, 17]], '#efe4c8', 1.2);
    } else if (kind === 'shield') {
      ctx.beginPath(); ctx.moveTo(-14, -17); ctx.lineTo(14, -17); ctx.lineTo(13, 5); ctx.quadraticCurveTo(7, 18, 0, 22); ctx.quadraticCurveTo(-7, 18, -13, 5); ctx.closePath();
      ctx.fillStyle = '#9fb8b4'; ctx.fill(); ctx.strokeStyle = '#5f7570'; ctx.lineWidth = 2.5; ctx.stroke();
      line(ctx, [[0, -11], [0, 13]], '#e4deba', 4); line(ctx, [[-7, -3], [7, -3]], '#e4deba', 4);
    } else {
      ctx.rotate(.45); box(ctx, -3, 7, 6, 16, 2, '#8d6146', '#654c39', 1);
      box(ctx, -12, 4, 24, 5, 2, '#c7a866', '#8f764c', 1);
      ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-5, -23); ctx.lineTo(0, -31); ctx.lineTo(5, -23); ctx.lineTo(5, 4); ctx.closePath();
      ctx.fillStyle = '#c6d6ce'; ctx.fill(); ctx.strokeStyle = '#748a85'; ctx.lineWidth = 1.6; ctx.stroke();
      line(ctx, [[0, -23], [0, 2]], '#eef2df', 1.5);
    }
    ctx.restore();
  }

  // World geometry is expressed in tiles by ForgeSim, then painted at a stable
  // scale. Expansion adds floor tiles; it never shrinks the existing furniture.
  const TILE = 32, HERO_HEIGHT = 64, STAFF_HEIGHT = 68;
  const FACILITY_NAMES = { furnace: '화덕', display: '장비 진열대', enhance: '강화 단조대' };
  const STAFF_ROLE_NAMES = { smith: '제조', sales: '판매', buyer: '재료 매입', logistics: '물류·진열', enhancer: '강화 보조', innkeeper: '여관 관리' };
  // One or two short lines per job for the staff hover card (effects match operations.js / engine.js).
  const STAFF_ROLE_HELP = {
    smith: ['화덕에서 장비를 만들어요', '제작 레벨이 오르면 만들 수 있는 장비가 늘어나요'],
    sales: ['카운터에서 손님에게 장비를 팔아요', '언변이 높을수록 더 비싸게 팔아요'],
    buyer: ['자동 매입: 모험가가 가진 재료를 사 와요'],
    logistics: ['자동 진열: 창고 장비를 진열대로 날라요'],
    enhancer: ['강화 작업대 옆에서 모험가의 강화를 도와요', '도와주는 동안 강화가 1.5배 빨라져요'],
    innkeeper: ['여관에서 쉬는 모험가를 간호해요', '간호받는 모험가는 1.5배 빨리 회복해요']
  };
  const STAFF_WORK_BUBBLES = { smith: 'hammer', sales: 'coin', buyer: 'coin', logistics: 'order', enhancer: 'hammer', innkeeper: 'heart' };
  const STATUS_NAMES = { recalling: '마을 방어를 위해 귀환 중', defending: '마을을 지키는 중', training: '책을 읽으며 수련 중', visiting: '장비를 둘러보는 중', departing: '사냥터로 출발', hunting: '사냥 중', returning: '마을로 귀환 중', enhancing: '장비 강화 중', resting: '여관에서 회복 중', leaving: '다른 마을로 이동 중', traveling: '여행 중', walking: '작업장으로 이동 중', working: '제작 중', selling: '판매 중', idle: '대기 중' };
  // The atlas is transparent and every furnace is cold. Its fire is drawn only
  // for an engine-confirmed active furnace. Crop metadata is embedded for file://.
  const FACILITY_CROPS = {
    furnace: { x: 137, y: 16, w: 290, h: 313 }, enhance: { x: 621, y: 78, w: 288, h: 252 }, display: { x: 1092, y: 55, w: 319, h: 270 },
    bed: { x: 158, y: 372, w: 260, h: 299 }, bench: { x: 563, y: 413, w: 404, h: 235 }, crate: { x: 1084, y: 435, w: 314, h: 203 },
    innSign: { x: 166, y: 707, w: 255, h: 290 }, counter: { x: 568, y: 723, w: 391, h: 259 }, barrel: { x: 1140, y: 723, w: 218, h: 266 }
  };

  // 2026-11 shop art (assets/shop): compact atlases cut from the art/shop-assets concept sheets at ~2x game size.
  // shop-tiles panels are inset past the concept outline so they tile.
  const SHOP_OBJECT_CROPS = {
    furnace: { x: 4, y: 4, w: 171, h: 222 }, fire: { x: 179, y: 4, w: 76, h: 60 }, anvil: { x: 259, y: 4, w: 114, h: 120 },
    shelf: { x: 377, y: 4, w: 133, h: 219 }, desk: { x: 514, y: 4, w: 185, h: 90 }, table: { x: 703, y: 4, w: 128, h: 274 },
    oreCrate: { x: 835, y: 4, w: 112, h: 80 },
    // art/shop-interior: O10 counter (6 tiles), D1 staff doorway (2x3 tiles), R1 room border pieces.
    counter: { x: 951, y: 4, w: 384, h: 104 }, staffDoor: { x: 1339, y: 4, w: 128, h: 192 },
    frameTL: { x: 1471, y: 4, w: 67, h: 66 }, frameTR: { x: 1542, y: 4, w: 66, h: 66 }, frameBL: { x: 1612, y: 4, w: 67, h: 65 }, frameBR: { x: 1683, y: 4, w: 66, h: 65 },
    frameH: { x: 1753, y: 4, w: 105, h: 25 }, frameV: { x: 1862, y: 4, w: 24, h: 85 },
    // Wall decor (H8 weapon board, H9 tool rack, H10 shields, H11 torch) and floor props (O23 armor stand, O24 weapon barrel).
    weaponBoard: { x: 1890, y: 4, w: 160, h: 122 }, toolRack: { x: 2054, y: 4, w: 192, h: 125 }, shieldRack: { x: 2250, y: 4, w: 160, h: 86 },
    torch: { x: 2414, y: 4, w: 36, h: 100 }, armorStand: { x: 2454, y: 4, w: 65, h: 176 }, weaponBarrel: { x: 2523, y: 4, w: 57, h: 160 }
  };
  // 2026-11 decor atlas (dist/assets/shop/shop-decor.png), cut from art/shop-interior/sheet-A/B/C + torch art at the
  // objects atlas scale (each sheet's reference anvil matched to the atlas anvil).
  const SHOP_DECOR_CROPS = {
    glassSword: { x: 4, y: 4, w: 245, h: 106 }, glassBow: { x: 253, y: 4, w: 245, h: 106 }, velvetSword: { x: 502, y: 4, w: 114, h: 192 }, spearBanner: { x: 620, y: 4, w: 151, h: 168 }, helmetShelf: { x: 775, y: 4, w: 228, h: 122 },
    guildBanner: { x: 4, y: 200, w: 124, h: 151 }, painting: { x: 132, y: 200, w: 169, h: 117 }, window: { x: 305, y: 200, w: 145, h: 145 }, potionShelf: { x: 454, y: 200, w: 179, h: 105 },
    // Mannequins re-cut 2026-11 with a clean anti-aliased outline (no grey halo), same slots.
    mannequinPlate: { x: 637, y: 202, w: 117, h: 188 }, mannequinLeather: { x: 759, y: 202, w: 109, h: 189 }, mannequinRobe: { x: 873, y: 202, w: 107, h: 192 },
    caseSword: { x: 4, y: 398, w: 216, h: 112 }, caseJewel: { x: 224, y: 398, w: 214, h: 113 }, bowStand: { x: 442, y: 398, w: 195, h: 130 }, shieldStand: { x: 641, y: 398, w: 196, h: 129 }, plant: { x: 841, y: 398, w: 141, h: 152 },
    toolBoard: { x: 4, y: 554, w: 267, h: 147 }, bellows: { x: 275, y: 554, w: 113, h: 158 }, blueprints: { x: 392, y: 554, w: 255, h: 146 }, chains: { x: 651, y: 554, w: 195, h: 146 },
    horseshoes: { x: 4, y: 716, w: 215, h: 84 }, bladeRack: { x: 223, y: 716, w: 200, h: 141 }, apron: { x: 427, y: 716, w: 184, h: 152 }, ingotShelf: { x: 615, y: 716, w: 223, h: 119 }, sootyWindow: { x: 842, y: 716, w: 145, h: 138 },
    torchBase: { x: 4, y: 872, w: 58, h: 99 }, flame1: { x: 66, y: 872, w: 50, h: 53 }, flame2: { x: 120, y: 872, w: 51, h: 58 }, flame3: { x: 175, y: 872, w: 51, h: 55 },
    gate: { x: 230, y: 872, w: 350, h: 230 }, stepStones: { x: 584, y: 872, w: 231, h: 147 }, threshold: { x: 819, y: 872, w: 170, h: 40 }, doorMat: { x: 4, y: 1106, w: 148, h: 87 }
  };
  const WALL_DECOR_SCALE = .4;
  // wood = F1 shop floor, stone = F2 workshop floor, wall = W1 shop wall (right post cut so it repeats), wallWorkshop = W2 brick panel only (no vertical posts).
  const SHOP_TILE_CROPS = { wood: { x: 4, y: 4, w: 256, h: 256 }, stone: { x: 264, y: 4, w: 256, h: 256 }, wall: { x: 524, y: 4, w: 244, h: 192 }, wallWorkshop: { x: 772, y: 4, w: 107, h: 192 },
    // 2026-11 plain walls: beam / baseboard strips from W1 and post-free bodies (W1 plaster, W2 brick).
    wallBeam: { x: 4, y: 268, w: 256, h: 18 }, wallBase: { x: 4, y: 290, w: 256, h: 22 }, wallPlaster: { x: 264, y: 268, w: 99, h: 152 }, wallBrick: { x: 367, y: 268, w: 122, h: 152 } };
  // Fixed forge view scale (% of the whole-shop framing; 100 = whole complex, lower = closer).
  const DEFAULT_SHOP_VIEW_SCALE = 60;
  // Back walls are shown as a front face 3 tiles tall (3/4 top-down).
  const BACK_WALL_HEIGHT = 96;
  // Atlas pixels -> world pixels for every shop sprite and tile (atlas is 2x of the on-screen size).
  const SHOP_ART_SCALE = .5;
  // Facility / fixture type -> object sprite.
  const SHOP_ART_FOR = { furnace: 'furnace', enhance: 'anvil', display: 'table', crate: 'oreCrate', 'stock-rack': 'shelf' };

  class ForgeScene {
    constructor(canvas, options) {
      if (!canvas || typeof canvas.getContext !== 'function') throw new Error('ForgeScene needs a canvas.');
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.options = options || {};
      this.view = 'shop'; this.motion = new Map(); this.worldMotion = new Map(); this.hitTargets = [];
      this.hover = null; this.pointer = null; this.lastTime = 0; this.placement = null;
      this.worldCamera = { x: 1040, y: 820, zoom: .38 }; this.worldCameraInitialized = false; this.worldFocusedTownId = null; this.worldBackdrop = null;
      this.camera = { x: 144, y: 224, zoom: 1 }; this.cameras = new Map(); this.cameraTown = null;
      // 2026-11: the forge is viewed at a fixed 60% scale, one room at a time (shop or workshop), switched with focusRoom().
      this.shopViewScale = DEFAULT_SHOP_VIEW_SCALE; this.shopRoom = 'shop'; this.cameraTween = null;
      this.backdrops = new Map(); this.drag = null; this.suppressClick = false; this._time = 0;
      this.worldMapImage = new Image(); this.worldMapLoaded = false;
      const worldMapReady = new Promise(resolve => {
        this.worldMapImage.onload = () => { this.worldMapLoaded = true; if (this.view === 'world' && this.worldFocusedTownId) this.focusTown(this.worldFocusedTownId, { zoom: this.worldCamera.zoom }); resolve(true); };
        this.worldMapImage.onerror = () => resolve(false);
      });
      this.worldMapImage.src = this.options.worldMapSrc || 'assets/ui/world-map.png'; this.villageSign = null; this._loadVillageSign(this.options.villageSignSrc || 'assets/ui/village-sign.webp');
      this.characters = new Image(); this.facilityImage = new Image();
      this.charactersLoaded = false; this.facilitiesLoaded = false; this.spriteCrops = [];
      this.characters.decoding = 'async'; this.facilityImage.decoding = 'async';
      const charactersReady = new Promise(resolve => {
        this.characters.onload = () => { this.charactersLoaded = true; this._prepareCrops(); resolve(true); };
        this.characters.onerror = () => resolve(false);
      });
      const facilitiesReady = new Promise(resolve => {
        this.facilityImage.onload = () => { this.facilitiesLoaded = true; resolve(true); };
        this.facilityImage.onerror = () => resolve(false);
      });
      this.shopObjects = new Image(); this.shopTiles = new Image(); this.shopObjectsLoaded = false; this.shopTilesLoaded = false; this.shopPatterns = null;
      this.shopObjects.decoding = 'async'; this.shopTiles.decoding = 'async';
      const shopObjectsReady = new Promise(resolve => { this.shopObjects.onload = () => { this.shopObjectsLoaded = true; resolve(true); }; this.shopObjects.onerror = () => resolve(false); });
      const shopTilesReady = new Promise(resolve => { this.shopTiles.onload = () => { this.shopTilesLoaded = true; this.shopPatterns = null; this.backdrops.clear(); resolve(true); }; this.shopTiles.onerror = () => resolve(false); });
      this.shopObjects.src = this.options.shopObjectsSrc || 'assets/shop/shop-objects.png';
      // Decor sheet (wall pieces are baked into the room backdrop, so the backdrop is rebuilt once it arrives).
      this.shopDecor = new Image(); this.shopDecorLoaded = false; this.shopDecor.decoding = 'async';
      this.shopDecor.onload = () => { this.shopDecorLoaded = true; this.backdrops.clear(); };
      this.shopDecor.src = this.options.shopDecorSrc || 'assets/shop/shop-decor.png';
      // Painted equipment icons (item-icons.js atlas) for items lying on the display tables.
      this.itemIcons = null;
      if (global.ForgeItemIcons && typeof Image !== 'undefined') { const image = new Image(); image.decoding = 'async'; image.onload = () => { this.itemIcons = image; }; image.src = global.ForgeItemIcons.src; }
      // Furnace fire: 3 equal frames (flame + coal bed, bottom-centred) from art/shop-interior/furnace-flame-frames.png.
      this.furnaceFlame = new Image(); this.furnaceFlameLoaded = false; this.furnaceFlame.decoding = 'async';
      this.furnaceFlame.onload = () => { this.furnaceFlameLoaded = true; };
      this.furnaceFlame.src = this.options.furnaceFlameSrc || 'assets/shop/furnace-flame.png';
      // Town-defence battle (art/battle via scripts/build-battle-art.ps1): armoured boar 3 x 2 cells of 256
      // (idle, ready, charge / hit, dizzy, flee; feet at (128, 214)) and three dust puffs (cells of 128).
      this.battleBoar = new Image(); this.battleBoarLoaded = false; this.battleBoar.decoding = 'async';
      this.battleBoar.onload = () => { this.battleBoarLoaded = true; };
      this.battleBoar.src = this.options.battleBoarSrc || 'assets/battle/boar.png';
      this.battleDust = new Image(); this.battleDustLoaded = false; this.battleDust.decoding = 'async';
      this.battleDust.onload = () => { this.battleDustLoaded = true; };
      this.battleDust.src = this.options.battleDustSrc || 'assets/battle/dust.png';
      // World-map fog (art/world via scripts/build-world-clouds.ps1): six painted clouds (3 x 2 cells of 512 x 256)
      // and a soft mist patch for the next town.
      this.worldCloudArt = new Image(); this.worldCloudArtLoaded = false; this.worldCloudArt.decoding = 'async';
      this.worldCloudArt.onload = () => { this.worldCloudArtLoaded = true; this._cloudShadows = null; };
      this.worldCloudArt.src = this.options.worldCloudsSrc || 'assets/world/clouds.png';
      this.worldMistArt = new Image(); this.worldMistArtLoaded = false; this.worldMistArt.decoding = 'async';
      this.worldMistArt.onload = () => { this.worldMistArtLoaded = true; };
      this.worldMistArt.src = this.options.worldMistSrc || 'assets/world/mist.png';
      this.shopTiles.src = this.options.shopTilesSrc || 'assets/shop/shop-tiles.png';
      this.characters.src = this.options.charactersSrc || 'assets/characters.png';
      this.facilityImage.src = this.options.facilitiesSrc || 'assets/facilities.png';
      this.npcSheets = new Map(); const npcReady = [];
      if (global.ForgeNPC) for (const character of global.ForgeNPC.characters) {
        const image = new Image(), entry = { image, loaded: false, character };
        image.decoding = 'async'; this.npcSheets.set(character.index, entry);
        npcReady.push(new Promise(resolve => {
          image.onload = () => { entry.loaded = image.naturalWidth === global.ForgeNPC.SHEET_SIZE.width && image.naturalHeight === global.ForgeNPC.SHEET_SIZE.height; resolve(entry.loaded); };
          image.onerror = () => resolve(false);
        }));
        image.src = this.options.npcSources && this.options.npcSources[character.id] || character.sheet;
      }
      this.artSheets = new Map(); const artReady = [], art = global.ForgeArt;
      const artPaths = art ? [...new Set([...(art.staff || []).map(a=>a.sheet), ...Object.values(art.bubbles || {}).map(a=>a.sheet), art.monster && art.monster.sheet].filter(Boolean))] : [];
      for (const path of artPaths) {
        const image = new Image(), entry = { image, loaded: false }; this.artSheets.set(path, entry); image.decoding = 'async';
        artReady.push(new Promise(resolve => { image.onload = () => { entry.loaded = true; resolve(true); }; image.onerror = () => resolve(false); }));
        image.src = this.options.artSources && this.options.artSources[path] || path;
      }
      this.assetsLoaded = Promise.all([charactersReady, facilitiesReady, worldMapReady, shopObjectsReady, shopTilesReady, ...npcReady, ...artReady]);
      ForgeScene._latest = this;
      this.canvas.setAttribute('aria-label', '매장과 뒤쪽 제작 작업실, 창고가 나뉜 대장간 마을. 카운터 뒤 문으로 직원들이 오갑니다. 시설, 창고, 직원, 모험가를 눌러 관리합니다. 직원을 끌어 화덕·카운터·진열대·모루에 놓으면 담당이 바뀝니다. 휠이나 위·아래 방향키로 작업실과 매장을 오갑니다. C 제작, I 진열대, Q 의뢰, U 시설, Escape 배치 취소.');
      this.canvas.setAttribute('aria-keyshortcuts', 'C I Q U ArrowLeft ArrowRight ArrowUp ArrowDown Escape');
      if (!this.canvas.hasAttribute('tabindex')) this.canvas.setAttribute('tabindex', '0');
      this.canvas.style.touchAction = 'none';
      this._onMove = e => {
        const p = this._coords(e); this.pointer = p;
        if (this.drag) {
          const dx = p.x - this.drag.last.x, dy = p.y - this.drag.last.y;
          if (Math.hypot(p.x - this.drag.start.x, p.y - this.drag.start.y) > 5) this.drag.moved = true;
          // 2026-11: a staff member picked up in the forge is carried to a furnace / counter / display / anvil / storage.
          if (this.drag.staff) {
            if (this.drag.moved) this.staffDrop = this._staffDropAt(p);
            // Carrying someone to the screen's top / bottom edge slides to the workshop / shop.
            if (this.drag.moved && !this.cameraTween) { if (p.y < 48 && this.shopRoom !== 'workshop') this.focusRoom('workshop'); else if (p.y > H - 48 && this.shopRoom === 'workshop') this.focusRoom('shop'); }
          }
          // 2026-11: the forge view is fixed (rooms switch with the button / wheel); a drag there only nudges the button.
          else if (this.drag.moved && this.view !== 'world') { if (!this.drag.nudged) { this.drag.nudged = true; if (this.options.onDragBlocked) this.options.onDragBlocked(); } }
          else if (this.drag.moved) this.panBy(-dx / this._activeCamera().zoom, -dy / this._activeCamera().zoom);
          this.drag.last = p;
        }
        this._updateHover();
      };
      this._onDown = e => {
        if (this.placement && this.view === 'shop' && e.button !== 1) return;
        if (e.button !== undefined && e.button !== 0 && e.button !== 1) return;
        const p = this._coords(e); this.pointer = p; this._updateHover(); this.drag = { start: p, last: p, moved: false };
        const picked = this.hover;
        if (this.view !== 'world' && picked && picked.kind === 'staff' && this._town && (this._town.staff || []).some(w => w.id === picked.id)) { this.drag.staff = picked.id; this.drag.staffName = picked.title; }
        if (this.canvas.setPointerCapture && e.pointerId !== undefined) this.canvas.setPointerCapture(e.pointerId);
      };
      this._onUp = e => {
        if (this.drag && this.drag.moved) this.suppressClick = true;
        if (this.drag && this.drag.staff && this.drag.moved && e.clientX !== undefined) {
          const target = this._staffDropAt(this._coords(e));
          if (target && this.options.onDropStaff) this.options.onDropStaff(this.drag.staff, target.role, target.facilityId);
        }
        this.drag = null; this.staffDrop = null;
        if (this.canvas.releasePointerCapture && this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      };
      this._onLeave = () => { if (!this.drag) { this.pointer = null; this.hover = null; this.canvas.style.cursor = 'default'; } };
      this._onClick = e => {
        if (this.suppressClick) { this.suppressClick = false; return; }
        this.pointer = this._coords(e); this._updateHover();
        if (this.placement && this.view === 'shop') {
          const p = this._placementAtPointer();
          if (p && p.valid && this.options.onPlaceFacility) this.options.onPlaceFacility(this.placement.type, p.x, p.y, this.placement.moveId);
          return;
        }
        const h = this.hover; if (!h) return;
        const handler = { adventurer: 'onSelectAdventurer', staff: 'onSelectStaff', facility: 'onSelectFacility', town: 'onSelectTown', region: 'onSelectRegion', boss: 'onSelectBoss', station: 'onSelectStation', incident: 'onSelectIncident' }[h.kind];
        if (h.kind === 'town' && this.view === 'world') this.focusTown(h.id);
        if (handler && this.options[handler]) this.options[handler](h.id);
        else if (h.kind === 'region' && this.options.onSelectStation) this.options.onSelectStation('adventurers');
      };
      this._onWheel = e => {
        e.preventDefault(); this.pointer = this._coords(e);
        // The forge view scale is fixed (60%); the wheel moves between the shop and the workshop instead.
        if (this.view !== 'world') { if (Math.abs(e.deltaY) > 4) this.focusRoom(e.deltaY < 0 ? 'workshop' : 'shop'); return; }
        if (e.deltaY < 0) this.zoomBy(1.08, this.pointer);
        else if (e.deltaY > 0) this.zoomBy(1 / 1.08, this.pointer);
      };
      this._onKey = e => {
        const key = String(e.key).toLowerCase(), mapping = { c: 'craft', i: 'inventory', q: 'quest', u: 'upgrades' };
        if (mapping[key] && this.options.onSelectStation) { e.preventDefault(); this.options.onSelectStation(mapping[key]); }
        else if (key === 'escape' && this.placement) { e.preventDefault(); this.setPlacement(null); if (this.options.onCancelPlacement) this.options.onCancelPlacement(); }
        else if (/^arrow/.test(key) && this.view !== 'world') {
          // The forge view is fixed: ↑ / ↓ switch between the workshop and the shop (like the wheel), ← / → do nothing.
          e.preventDefault(); if (key === 'arrowup') this.focusRoom('workshop'); else if (key === 'arrowdown') this.focusRoom('shop');
        } else if (/^arrow/.test(key)) {
          e.preventDefault(); this.panBy(key === 'arrowleft' ? -64 : key === 'arrowright' ? 64 : 0, key === 'arrowup' ? -64 : key === 'arrowdown' ? 64 : 0);
        } else if (this.view === 'world' && (key === '+' || key === '=')) { e.preventDefault(); this.zoomBy(1.12); }
        else if (this.view === 'world' && key === '-') { e.preventDefault(); this.zoomBy(1 / 1.12); }
      };
      for (const [event, fn] of [['pointermove', this._onMove], ['pointerdown', this._onDown], ['pointerup', this._onUp], ['pointercancel', this._onUp], ['pointerleave', this._onLeave], ['click', this._onClick], ['keydown', this._onKey]]) this.canvas.addEventListener(event, fn);
      this.canvas.addEventListener('wheel', this._onWheel, { passive: false }); this._resize();
    }

    static getWorldBosses(state) {
      const sim = global.ForgeSim;
      if (!state || !sim || !sim.getBosses) return [];
      return sim.getBosses(state).map(boss => {
        const region = sim.DATA.regions.find(r => r.id === boss.regionId);
        if (!region || !Number.isFinite(region.mapX) || !Number.isFinite(region.mapY)) return null;
        const phase = boss.worldStatus || (boss.activeParty ? 'fighting' : boss.cooldownRemaining > 0 ? 'cooldown' : boss.ready ? 'ready' : 'recruiting');
        // These are simulation values only. Rendering, pausing, and reopening
        // the map never advance a boss clock.
        const timerSeconds = phase === 'fighting' ? Math.max(0, boss.activeParty.remaining) : phase === 'cooldown' ? boss.cooldownRemaining : 0;
        const timerText = bossTimer(timerSeconds);
        const statusText = phase === 'fighting' ? '전투 ' + timerText : phase === 'cooldown' ? '재출현 ' + timerText : phase === 'recruiting' ? '출현 중 · 보낼 모험가 없음' : boss.worldTownOpened ? '출현 중 · 파견 가능' : '마을 개점 필요';
        return { ...boss, mapX: region.mapX, mapY: region.mapY, townId: boss.townId || region.townId, regionName: region.name, phase, timerSeconds, timerText, statusText, worldBoss: boss.id === 'abyss_sovereign' || !!boss.final };
      }).filter(Boolean);
    }

    static getSpriteIndex(adventurer, index) {
      const a = adventurer || {};
      if (Number.isInteger(a.spriteIndex)) return a.spriteIndex;
      const resolved = global.ForgeNPC && global.ForgeNPC.getForAdventurer(a); if (resolved) return resolved.index;
      if (a.visualId && global.ForgeNPC) { const c = global.ForgeNPC.characters.find(c => c.id === a.visualId || c.adventurerId === a.visualId); if (c) return c.index; }
      if (SPRITES[a.id] !== undefined) return SPRITES[a.id];
      const job = String(a.job || '');
      if (/마법|마도/.test(job)) return 11;
      if (/궁수|수렵/.test(job)) return 12;
      if (/기사/.test(job)) return 9;
      if (/검사|검객|전사/.test(job)) return 10;
      if (/도적|정찰/.test(job)) return 13;
      return [0, 10, 12, 11, 9, 13][Math.abs(index || 0) % 6];
    }

    static getStaffSpriteIndex(worker) {
      const art=global.ForgeArt, definition=art&&art.getStaffFor&&art.getStaffFor(worker||{});
      return definition ? definition.index : worker&&Number.isInteger(worker.spriteIndex) ? worker.spriteIndex : worker&&worker.role==='sales'?2:1;
    }
    static drawStaffPortrait(canvas, worker, options) {
      const instance=ForgeScene._latest;if(!instance||!canvas)return;
      const draw=()=>{
        const ctx=canvas.getContext('2d'),w=canvas.width||96,h=canvas.height||96,opts=options||{},art=global.ForgeArt;
        const definition=art&&art.getStaffFor&&art.getStaffFor(worker||{}),entry=definition&&instance.artSheets.get(definition.sheet);
        ctx.clearRect(0,0,w,h);if(opts.background){ctx.fillStyle=opts.background;ctx.fillRect(0,0,w,h);}
        if(entry&&entry.loaded){
          const source=definition.source,padding=Math.max(2,Math.min(w,h)*.055),sourceHeight=opts.fullBody?source.h:source.h*.68;
          const scale=Math.min((w-padding*2)/source.w,(h-padding*2)/sourceHeight),dw=source.w*scale,dh=sourceHeight*scale;
          ctx.imageSmoothingEnabled=true;ctx.drawImage(entry.image,source.x,source.y,source.w,sourceHeight,(w-dw)/2,(h-dh)/2,dw,dh);
        }else instance._drawSprite(ctx,worker&&worker.role==='sales'?2:1,w/2,h*.96,h*.9,0,false,1,{moving:false});
      };
      draw();instance.assetsLoaded.then(draw);
    }

    _drawStaffSprite(ctx,index,x,y,height,bob,moving,animation) {
      const art=global.ForgeArt,definition=art&&art.getStaffByIndex&&art.getStaffByIndex(index);
      if(!definition)return false;
      const entry=this.artSheets.get(definition.sheet);if(!entry||!entry.loaded)return false;
      let source=definition.source,flip=!!(animation&&animation.facing&&animation.facing.flipX);
      // Motion sheets: the same pose cells as the adventurers (front / front-diagonal / back-diagonal, walk frames).
      if(definition.motion&&global.ForgeNPC){const frame=global.ForgeNPC.selectFrame(animation||{moving:!!moving}),cell=frame.cell,size=definition.cell;source={x:cell%3*size+definition.source.x,y:Math.floor(cell/3)*size+definition.source.y,w:definition.source.w,h:definition.source.h};flip=!!frame.flipX;}
      const pivot=definition.pivot||{x:source.w/2,y:source.h},scale=height/(definition.contentHeight||source.h);
      ctx.save();ctx.translate(x,y+(definition.motion?0:(bob||0)));
      if(flip)ctx.scale(-1,1);
      if(!moving){const breath=Math.sin(this._time*2.5+index*.71);ctx.scale(1-breath*.006,1+breath*.012);}
      if(moving&&!definition.motion)ctx.rotate(Math.sin(this._time*10+index)*.014);
      ctx.drawImage(entry.image,source.x,source.y,source.w,source.h,-pivot.x*scale,-pivot.y*scale,source.w*scale,source.h*scale);ctx.restore();return true;
    }
    _drawMonster(ctx,x,y,height,now) {
      const definition=global.ForgeArt&&global.ForgeArt.monster,entry=definition&&this.artSheets.get(definition.sheet);
      if(!entry||!entry.loaded)return false;
      const source=definition.source,pivot=definition.pivot||{x:source.w/2,y:source.h},scale=height/(definition.contentHeight||source.h);
      shadow(ctx,x,y+1,height*.40,height*.09,.15);
      ctx.save();ctx.translate(x,y+Math.sin(now*3)*.7);
      ctx.drawImage(entry.image,source.x,source.y,source.w,source.h,-pivot.x*scale,-pivot.y*scale,source.w*scale,source.h*scale);ctx.restore();return true;
    }
    // One cell of the boar sheet, feet on (x, y); bodyHeight is the idle body's height on screen. flip = face left.
    _drawBoar(ctx,cell,x,y,bodyHeight,flip) {
      if(!this.battleBoarLoaded)return false;
      const s=bodyHeight/150,sx=(cell%3)*256,sy=Math.floor(cell/3)*256;
      ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);
      ctx.drawImage(this.battleBoar,sx,sy,256,256,-128*s,-214*s,256*s,256*s);ctx.restore();return true;
    }
    // A dust puff that grows and fades over `life` (0..1).
    _drawDust(ctx,cell,x,y,size,life) {
      if(!this.battleDustLoaded||life<0||life>1)return;
      const grow=.6+life*.6;ctx.save();ctx.globalAlpha=Math.max(0,1-life*life);
      ctx.drawImage(this.battleDust,cell*128,0,128,128,x-size*grow/2,y-size*grow*.75,size*grow,size*grow);ctx.restore();
    }
    // The fight in front of the town: the boar in the middle (ready → charge → hit, looping), up to four defenders
    // stepping in from both sides, and dust puffs where they clash.
    _drawBattle(ctx,event,state,now) {
      const cycle=2.4,t=(now%cycle)/cycle,cell=t<.25?0:t<.45?1:t<.7?2:3;
      const charge=cell===2?Math.sin((t-.45)/.25*Math.PI)*14:cell===3?-6:0;
      shadow(ctx,charge,4,48,12,.18);
      const members=(event.memberIds||[]).map(id=>state.adventurers.find(a=>a.id===id)).filter(Boolean).slice(0,4);
      const spots=[[-78,-8,false],[80,-6,true],[-68,16,false],[72,18,true]];
      const behind=[],front=[];members.forEach((hero,i)=>{(spots[i][1]<0?behind:front).push([hero,i]);});
      const drawHero=([hero,i])=>{const [sx,sy,left]=spots[i],lunge=Math.max(0,Math.sin(now*4.2+i*1.7))*10;this._drawSprite(ctx,ForgeScene.getSpriteIndex(hero),sx+(left?-lunge:lunge),sy,52,0,true,1,{moving:true,dx:left?-1:1,dy:.1,walkTime:now+i*.13});};
      behind.forEach(drawHero);
      if(!this._drawBoar(ctx,cell,charge,0,66,false))this._drawMonster(ctx,0,0,70,now);
      front.forEach(drawHero);
      for(let i=0;i<3;i++){const life=((now*.9+i/3)%1),side=i%2?1:-1;this._drawDust(ctx,i,side*(26+life*30)+charge,-6-life*10,42,life);}
    }
    _drawEncounter(ctx,event,x,y,state,now,scale) {
      if(!event||event.status==='resolved')return;
      const k=scale||1;
      ctx.save();ctx.translate(x,y);ctx.scale(k,k);
      if(event.status==='recalling'){
        if(!this._drawBoar(ctx,0,0,0,62,false)&&!this._drawMonster(ctx,0,0,75,now))icon(ctx,'combat',0,-30,40,'#b8795a');
        this._bubble(ctx,'angry',0,-91,now,null,false);
        const sweep=(Math.sin(now*2)+1)/2;
        ellipse(ctx,0,3,48+sweep*8,14+sweep*3,null,`rgba(184,100,77,${.35-sweep*.2})`,1.8);
      }else if(event.status==='battle'&&this.battleBoarLoaded){
        this._drawBattle(ctx,event,state,now);
      }else if(event.status==='battle'){
        shadow(ctx,0,6,67,17,.13);
        for(let i=0;i<7;i++){
          const angle=i*Math.PI*2/7+now*.13;
          ellipse(ctx,Math.cos(angle)*42,Math.sin(angle)*14-28,29+Math.sin(now*4+i)*3,23+Math.sin(now*3+i)*2,'#e8ddc5','#bfae8d',1.2);
        }
        ctx.save();ctx.beginPath();ctx.ellipse(0,-30,62,42,0,0,Math.PI*2);ctx.clip();
        const phase=Math.floor(now*2.2);
        if(phase%2===0)this._drawMonster(ctx,Math.sin(now*5)*7,-2,77,now);
        else{
          const memberIds=event.memberIds||[],hero=state.adventurers.find(a=>a.id===memberIds[Math.floor(phase/2)%Math.max(1,memberIds.length)]);
          if(hero)this._drawSprite(ctx,ForgeScene.getSpriteIndex(hero),Math.sin(now*5)*8,2,65,0,false,1,{moving:false});
        }
        ctx.restore();
        for(let i=0;i<4;i++)ellipse(ctx,(i-1.5)*25+Math.sin(now*5+i)*4,-5+Math.cos(now*3+i)*3,23,13,'#ece1ca','#c4b493',1);
        for(let i=0;i<3;i++)icon(ctx,'spark',Math.cos(now*3+i*2.1)*61,-36+Math.sin(now*3+i*2.1)*30,8+(i%2)*3,'#d3a35c');
      }else if(event.status==='recovery'&&event.injuredCount>0){
        this._bubble(ctx,'incapacitated',0,-27,now,null,false);
      }
      ctx.restore();
      // 2026-11: no hover/click area for the after-battle recovery marker (it sat over the shop entrance).
      if(event.status!=='recovery')this._hitWorld('incident',event.id,x-79*k,y-112*k,158*k,133*k,{title:event.status==='recalling'?'마을 방어 소집':event.status==='battle'?'모험가들의 마을 방어전':'부상자 회복',detail:event.status==='recalling'?`${event.arrivedCount||0}/${event.totalMembers||event.memberIds.length}명 집결`:event.status==='battle'?`함께 싸우는 중 · ${Math.ceil(event.battleRemaining||0)}초`:`여관에서 ${event.injuredCount||0}명 회복 중`});
    }

    static drawPortrait(canvas, index, options) {
      const instance = ForgeScene._latest;
      if (!instance || !canvas) return;
      const draw = () => {
        const ctx = canvas.getContext('2d'), w = canvas.width || 96, h = canvas.height || 96;
        ctx.clearRect(0, 0, w, h);
        const opts = options || {};
        if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, w, h); }
        const pack = global.ForgeNPC, packed = pack && pack.getByIndex(index);
        if (packed) {
          const entry = instance.npcSheets.get(index);
          const geometry = pack.portraitGeometry({ index, width: w, height: h, padding: Math.max(2, Math.min(w, h) * .045) });
          if (entry && entry.loaded) {
            const s = geometry.source, d = geometry.destination;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(entry.image, s.x, s.y, s.w, s.h, d.x, d.y, d.w, d.h);
          } else {
            instance._drawSprite(ctx, index, geometry.anchor.x, geometry.anchor.y, geometry.scale * pack.CONTENT_HEIGHT, 0, false, 1);
          }
          return;
        }
        ctx.save(); ctx.translate(w / 2, h * 1.20); ctx.scale(w / 96, h / 96);
        instance._drawSprite(ctx, index, 0, 0, 128, 0, false, 1);
        ctx.restore();
      };
      draw(); instance.assetsLoaded.then(draw);
    }



    setView(view) {
      this.view = view === 'world' ? 'world' : 'shop'; this.hover = null; this.hitTargets = []; this.drag = null;
      if (this.view === 'world' && !this.worldCameraInitialized) this.resetCamera();
    }
    setLayout() { /* Facility layout comes from the simulation's tile map. */ }
    setPlacement(placement) { this.placement = placement ? { ...placement } : null; this.hover = null; if (placement) this.setView('shop'); }
    _activeCamera() { return this.view === 'world' ? this.worldCamera : this.camera; }
    getCameraState() { return { ...this._activeCamera(), view: this.view, focusedTownId: this.worldFocusedTownId }; }
    panBy(dx, dy) { const camera=this._activeCamera(); camera.x += Number(dx)||0; camera.y += Number(dy)||0; this._clampCamera(); }
    // View scale: 100% = the shop's default framing, 200% = zoomed out (twice the area), 50% = zoomed in.
    _shopZoomRange() { const base = this.shopBaseZoom || this.camera.zoom || 1; return { base, min: base / 2, max: base * 2 }; }
    zoomBy(factor, anchor) {
      const f = Number(factor); if (!(f > 0) || f === 1) return;
      const camera=this._activeCamera(), a=anchor||{x:W/2,y:H/2}, before=this._screenToWorld(a);
      if (this.view === 'world') camera.zoom = clamp(camera.zoom * f, .30, 1.45);
      else { const r = this._shopZoomRange(); camera.zoom = clamp(camera.zoom * f, r.min, r.max); this.shopViewScale = 100 * r.base / camera.zoom; }
      const after=this._screenToWorld(a); camera.x+=before.x-after.x; camera.y+=before.y-after.y; this._clampCamera();
    }
    getViewScale() { if (this.view === 'world') return null; return Math.round(100 * this._shopZoomRange().base / this.camera.zoom); }
    setViewScale(percent) {
      if (this.view === 'world') return; const p = clamp(Number(percent) || 100, 50, 200), r = this._shopZoomRange();
      this.zoomBy(r.base * 100 / p / this.camera.zoom);
      this.shopViewScale = p;
    }
    // Presentation-only positions: align each town to the illustrated landmark.
    // Gameplay IDs and saved world/region data remain untouched.
    _illustratedPoint(townId, x, y, regionId) {
      if (!this.worldMapLoaded) return { x, y };
      // Points use pixels in the shipped 1024×678 map image. Keep hit areas,
      // labels, heroes and camera focus on the same illustrated landmarks.
      const towns={greenwood:[233,491],stonebridge:[365,362],moonhaven:[586,529],sunspire:[638,300],frostgate:[741,120]};
      const regions={
        greenwood:[169,445],meadow:[299,465],oldroad:[279,525],quarry:[359,435],fern_hollow:[146,511],brook_glen:[206,564],moss_cavern:[126,531],boar_thicket:[319,554],sunny_orchard:[385,564],ancient_grove:[432,525],
        riverbank:[286,372],ruins:[492,186],abandoned_mine:[392,299],fortress:[532,246],granite_pass:[326,299],willow_marsh:[239,325],shattered_bridge:[465,359],echo_tunnel:[329,252],sunken_archive:[405,239],ironwood_crossing:[236,242],
        ridge:[512,392],coast:[704,531],catacombs:[585,398],pearl_delta:[472,538],saltwind_cliffs:[741,491],lunar_mangrove:[465,505],coral_labyrinth:[758,551],siren_cove:[694,465],tideglass_isle:[797,545],forgotten_lighthouse:[658,435],
        abyss:[852,283],desert:[731,319],canyon:[538,325],ember_mesa:[817,325],ochre_dunes:[777,239],windscar_waste:[665,222],scorpion_oasis:[751,186],sunken_maze:[578,352],dragonbone_basin:[618,332],amber_watch:[585,189],
        tundra:[797,153],icekeep:[691,53],astral:[854,90],lava:[847,272],frostpine:[678,120],whitechasm:[568,73],silent_steppe:[618,103],glacier_maze:[774,56],starfall_crater:[870,166],obsidian_peak:[525,73]
      };
      const point=regionId ? regions[regionId] : towns[townId];
      return point ? { x:-90+point[0]*2300/1024, y:30+point[1]*1660/678 } : {x,y};
    }
    focusTown(townId, options) {
      const world=global.ForgeWorld, data=global.ForgeSim&&global.ForgeSim.DATA;
      const metadata=world&&world.getTown(townId), town=data&&data.towns.find(t=>t.id===townId);
      if (!metadata&&!town) return false;
      const position=this._illustratedPoint(townId,metadata?metadata.x:town.mapX,metadata?metadata.y:town.mapY), x=position.x, y=position.y;
      if (!Number.isFinite(x)||!Number.isFinite(y)) return false;
      this.worldFocusedTownId=townId; this.worldCamera.x=x; this.worldCamera.y=y;
      this.worldCamera.zoom=clamp(Math.max(this.worldCamera.zoom,options&&Number(options.zoom)||.78),.30,1.45); this.worldCameraInitialized=true;
      this._clampWorldCamera(); return true;
    }
    focusIncident(incidentId) {
      const sim=global.ForgeSim; if (!this._state||!sim||!sim.getInvasion) return false;
      const towns=sim.DATA.towns||[];
      for (const town of towns) { const event=sim.getInvasion(this._state,town.id); if(event&&event.id===incidentId){this.setView('world');return this.focusTown(town.id,{zoom:.95});} }
      return false;
    }
    // Centre of one forge room for the room-by-room view: 'shop' (with its back wall and the doorstep) or 'workshop'.
    _roomCenter(room) {
      const layout = this._layout; if (!layout || !layout.workshop) return null;
      const shop = layout.shop, rear = layout.workshop, x = (shop.x + shop.w / 2) * TILE;
      if (room === 'workshop') return { x, y: ((rear.y * TILE - BACK_WALL_HEIGHT - 12) + (rear.y + rear.h) * TILE + 12) / 2 };
      return { x, y: ((TILE - BACK_WALL_HEIGHT - 12) + (shop.y + shop.h) * TILE + 2.75 * TILE) / 2 };
    }
    // Slide the camera to the shop or the workshop.
    focusRoom(room, animate = true) {
      if (this.view === 'world') return;
      const target = this._roomCenter(room); if (!target) return;
      this.shopRoom = room === 'workshop' ? 'workshop' : 'shop';
      if (!animate) { this.cameraTween = null; this.camera.x = target.x; this.camera.y = target.y; this._clampCamera(); return; }
      this.cameraTween = { fromX: this.camera.x, fromY: this.camera.y, toX: target.x, toY: target.y, start: this._time || 0, duration: .45 };
    }
    // Which room the camera currently shows (by its centre relative to the band between the rooms).
    getRoomFocus() {
      if (this.view === 'world' || !this._layout || !this._layout.workshop) return null;
      if (this.cameraTween) return this.shopRoom;
      const rear = this._layout.workshop, middle = ((rear.y + rear.h) * TILE + TILE - BACK_WALL_HEIGHT) / 2;
      return this.camera.y < middle ? 'workshop' : 'shop';
    }    resetCamera() {
      const previousZoom=this._activeCamera().zoom;
      if (this.view==='world') {
        const world=global.ForgeWorld&&global.ForgeWorld.WORLD||{width:2080,height:1640};
        this.worldCamera={x:world.width/2,y:world.height/2,zoom:Math.max(.30,Math.min((W-28)/world.width,(H-28)/world.height))};this.worldCameraInitialized=true;this._clampWorldCamera();
        this.worldCamera.zoom=Math.max(previousZoom,this.worldCamera.zoom);
      } else {
        // The shop recentres on its default framing and keeps the player's chosen view scale (50-200%).
        this.cameraTween=null; this._resetShopCamera();
      }
      this._clampCamera();
    }
    _resetShopCamera() {
      const layout = this._layout;
      if (!layout) { this.camera = { x: 144, y: 224, zoom: 1 }; return; }
      const shop = layout.shop, rear = layout.workshop || shop, warehouse = layout.warehouse || shop, inn = layout.inn;
      const left = Math.min(shop.x, warehouse.x) * TILE - 28;
      const right = (shop.x + shop.w) * TILE + 35;
      const top = Math.min(rear.y, warehouse.y) * TILE - 77;
      // A very large inn remains explorable by panning; it should not make the
      // actual shop unreadably small when returning to this branch.
      // Include the doorstep signpost to the village and keep it above the bottom menu bar overlay.
      const bottom = (shop.y + shop.h) * TILE + 2.75 * TILE + 64;
      this.camera = { x: (left + right) / 2, y: (top + bottom) / 2, zoom: clamp(Math.min((W - 36) / (right - left), (H - 34) / (bottom - top), 1), .42, 1) };
      this.shopBaseZoom = this.camera.zoom;
      this.camera.zoom = clamp(this.shopBaseZoom * 100 / (this.shopViewScale || DEFAULT_SHOP_VIEW_SCALE), this.shopBaseZoom / 2, this.shopBaseZoom * 2);
      const target = this._roomCenter(this.shopRoom || 'shop'); if (target) { this.camera.x = target.x; this.camera.y = target.y; }
      this._clampShopCamera();
    }
    _clampCamera() { if(this.view==='world')this._clampWorldCamera();else this._clampShopCamera(); }
    _clampWorldCamera() {
      const world=global.ForgeWorld&&global.ForgeWorld.WORLD||{width:2080,height:1640}, c=this.worldCamera, hw=W/c.zoom/2, hh=H/c.zoom/2;
      c.x=world.width+80<hw*2?world.width/2:clamp(c.x,hw-40,world.width-hw+40);
      c.y=world.height+80<hh*2?world.height/2:clamp(c.y,hh-40,world.height-hh+40);
    }
    _clampShopCamera() {
      if (!this._layout) return;
      const b=this._layout.bounds, halfW=W/this.camera.zoom/2, halfH=H/this.camera.zoom/2;
      // Room-by-room view: the camera may always centre the workshop and the shop, even past the layout bounds.
      const rearC=this._roomCenter('workshop'),shopC=this._roomCenter('shop');
      const left=b.x*TILE,top=Math.min(b.y*TILE-24,rearC?rearC.y-halfH:Infinity),right=(b.x+b.w)*TILE,bottom=Math.max((b.y+b.h)*TILE+24,shopC?shopC.y+halfH:-Infinity);
      this.camera.x=right-left<halfW*2?(left+right)/2:clamp(this.camera.x,left+halfW,right-halfW);
      this.camera.y=bottom-top<halfH*2?(top+bottom)/2:clamp(this.camera.y,top+halfH,bottom-halfH);
    }
    // 2026-11: the canvas backing store matches the size it is actually shown at (CSS size x devicePixelRatio).
    // It used to be a fixed 1280x720 (x dpr) image stretched/shrunk by the browser, which blurred all canvas text
    // (tooltips, labels). Drawing still uses the 1280x720 logical coordinates via setTransform(ratio).
    _resize() {
      const shown = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect().width : 0;
      // Capped at 2.5x (3200x1800) so very large / high-DPI screens stay smooth.
      const ratio = clamp(((shown || W) / W) * (global.devicePixelRatio || 1), .5, 2.5);
      const width = Math.round(W * ratio), height = Math.round(H * ratio);
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width; this.canvas.height = height;
        if (this.ctx) { this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high'; }
      }
      this.ratio = width / W;
    }
    _coords(event) { const r = this.canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) * W / r.width, y: (event.clientY - r.top) * H / r.height }; }
    _screenToWorld(p) { const c=this._activeCamera();return {x:(p.x-W/2)/c.zoom+c.x,y:(p.y-H/2)/c.zoom+c.y}; }
    _worldToScreen(p) { const c=this._activeCamera();return {x:(p.x-c.x)*c.zoom+W/2,y:(p.y-c.y)*c.zoom+H/2}; }
    _hitWorld(kind, id, x, y, w, h, extra) {
      const p = this._worldToScreen({ x, y }); this.hitTargets.push({ kind, id, x: p.x, y: p.y, w: w * this._activeCamera().zoom, h: h * this._activeCamera().zoom, ...(extra || {}) });
    }
    _updateHover() {
      this.hover = null;
      if (this.pointer && !this.placement) for (let i = this.hitTargets.length - 1; i >= 0; i--) {
        const h = this.hitTargets[i], p = this.pointer;
        if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) { this.hover = h; break; }
      }
      // Staff in the forge can be picked up and carried to a post: they show the open hand.
      this.canvas.style.cursor = this.drag && this.drag.moved ? 'grabbing' : this.placement ? 'crosshair' : this.hover && this.hover.kind === 'staff' && this.view !== 'world' ? 'grab' : this.hover && this.hover.kind !== 'info' ? 'pointer' : this.view === 'world' ? 'grab' : 'default';
    }

    _prepareCrops() {
      const width = this.characters.naturalWidth, height = this.characters.naturalHeight;
      if (width === 1774 && height === 887) { this.spriteCrops = SPRITE_CROPS.map(c => ({ ...c })); return; }
      const cellW = width / 5, cellH = height / 2;
      let pixels = null;
      try {
        const tmp = document.createElement('canvas'); tmp.width = width; tmp.height = height;
        const c = tmp.getContext('2d', { willReadFrequently: true }); c.drawImage(this.characters, 0, 0);
        pixels = c.getImageData(0, 0, width, height).data;
      } catch (_) { /* Grid crops still render when an asset is served cross-origin. */ }
      for (let i = 0; i < 10; i++) {
        const x0 = Math.floor((i % 5) * cellW), y0 = Math.floor(Math.floor(i / 5) * cellH);
        let left = Math.floor(cellW), top = Math.floor(cellH), right = 0, bottom = 0, found = false;
        if (pixels) {
          for (let y = 0; y < Math.floor(cellH); y += 2) for (let x = 0; x < Math.floor(cellW); x += 2) {
            const p = ((y0 + y) * width + x0 + x) * 4;
            if (pixels[p + 3] > 48) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); found = true; }
          }
        }
        if (found) {
          left = Math.max(0, left - 2); top = Math.max(0, top - 2);
          right = Math.min(cellW - 1, right + 3); bottom = Math.min(cellH - 1, bottom + 3);
          this.spriteCrops.push({ x: x0 + left, y: y0 + top, w: right - left + 1, h: bottom - top + 1 });
        } else this.spriteCrops.push({ x: x0, y: y0, w: cellW, h: cellH });
      }
    }



    render(state, visualTimeSeconds) {
      if (!state) return;
      const now = Number.isFinite(visualTimeSeconds) ? visualTimeSeconds : performance.now() / 1000;
      const dt = this.lastTime ? clamp(now - this.lastTime, 0, .12) : 0;
      this.lastTime = now; this._state = state; this._time = now;
      this._resize(); const ctx = this.ctx;
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; this.hitTargets = [];
      const sim = global.ForgeSim;
      this._town = sim && sim.getTown ? sim.getTown(state) : state.towns && state.towns[state.activeTownId];
      if (!this._town) { text(ctx, '마을을 준비하고 있어요', W / 2, H / 2, 18, C.ink, 600); return; }
      this._layout = sim && sim.getTownLayout ? sim.getTownLayout(state) : this._fallbackLayout(this._town);
      if (this.cameraTown !== this._town.id) {
        if (this.cameraTown) this.cameras.set(this.cameraTown, { ...this.camera });
        this.cameraTown = this._town.id; this.motion.clear();
        if (this.cameras.has(this.cameraTown)) this.camera = { ...this.cameras.get(this.cameraTown) }; else this._resetShopCamera();
      }
      if (this.cameraTween && this.view !== 'world') {
        const tw = this.cameraTween, k = clamp((now - tw.start) / tw.duration, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.camera.x = tw.fromX + (tw.toX - tw.fromX) * e; this.camera.y = tw.fromY + (tw.toY - tw.fromY) * e;
        if (k >= 1) this.cameraTween = null;
      }
      this._clampCamera();
      if (this.view === 'world') this._drawWorld(ctx, state, now, dt); else this._drawShop(ctx, state, now, dt);
      this._updateHover(); this._drawHoverCard(ctx); this._drawStaffDrag(ctx);
    }
    // Where a carried staff member would go: furnace → 제조, counter / display → 판매 (물류 staff keep 물류 on a display),
    // anvil → 강화 보조, storage → 물류·진열, material board → 재료 매입.
    _staffDropAt(p) {
      if (!p || !this._town) return null;
      for (let i = this.hitTargets.length - 1; i >= 0; i--) {
        const h = this.hitTargets[i];
        if (h.kind === 'staff' || h.kind === 'adventurer' || !(p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)) continue;
        let role = null, facilityId = null, label = '';
        if (h.kind === 'facility') {
          const f = (this._town.facilities || []).find(x => x.id === h.id);
          if (f) { role = { furnace: 'smith', display: 'sales', enhance: 'enhancer' }[f.type] || null; facilityId = f.id; label = { furnace: '화덕 담당', display: '진열대 담당', enhance: '모루 담당' }[f.type]; }
        } else if (h.id === 'counter') { role = 'sales'; label = '카운터 담당'; }
        else if (h.kind === 'station' && h.id === 'warehouse') { role = 'logistics'; label = '창고·진열 담당'; }
        if (role) return { role, facilityId, label, hit: h };
      }
      return null;
    }
    _drawStaffDrag(ctx) {
      const d = this.drag, p = this.pointer; if (!d || !d.staff || !d.moved || !p) return;
      const t = this.staffDrop; ctx.save();
      // A see-through copy of the carried worker follows the pointer.
      const worker = this._town && (this._town.staff || []).find(w => w.id === d.staff);
      if (worker) { try { this._drawSprite(ctx, ForgeScene.getStaffSpriteIndex(worker), p.x, p.y + 26, STAFF_HEIGHT * this._activeCamera().zoom, 0, false, .7); } catch (_) {} }
      if (t) {
        const h = t.hit; ctx.fillStyle = 'rgba(255,214,120,.18)'; ctx.strokeStyle = '#f0a83a'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(h.x - 3, h.y - 3, h.w + 6, h.h + 6, 10) : ctx.rect(h.x - 3, h.y - 3, h.w + 6, h.h + 6); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      const label = (d.staffName || '직원') + (t ? ' → ' + t.label : '');
      ctx.font = `700 12px ${FONT}`; const w = ctx.measureText(label).width + 24, x = clamp(p.x + 14, 8, W - w - 8), y = clamp(p.y - 34, 8, H - 34);
      ctx.shadowColor = 'rgba(70,51,31,.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      box(ctx, x, y, w, 26, 13, t ? '#fff1d2' : '#fffbee', t ? '#e59a35' : '#bda980', 1.5); ctx.shadowColor = 'transparent';
      text(ctx, label, x + w / 2, y + 17, 12, t ? '#a2581a' : '#74563a', 800);
      ctx.restore();
    }
    _fallbackLayout(t) {
      if (global.ForgeShopLayout && typeof global.ForgeShopLayout.get === 'function') return global.ForgeShopLayout.get(t);
      const capacity = Math.min(100, 6 + Math.max(0, (t.innLevel || 1) - 1) * 2), height = 8 + Math.min(2, Math.floor((capacity - 6) / 24));
      const innX = (t.width || 18) + 2, entrance = { x: innX + 3.5, y: 1 + height + .5 };
      return { shop: { x: 0, y: 0, w: t.width || 18, h: t.height || 12 }, inn: { x: innX, y: 1, w: 7, h: height, capacity, entrance, beds: Array.from({ length: capacity }, (_, i) => ({ id: 'bed-' + i, ...entrance })) }, entrance: { x: 9.5, y: 11.5 }, exit: { x: 9.5, y: 15 }, bounds: { x: -11, y: -2, w: innX + 10 + 11, h: Math.max((t.height || 12) + 6, height + 4) } };
    }

    _insideInn(actor, staff) {
      const entrance = this._layout && this._layout.inn && this._layout.inn.entrance;
      if (!entrance || !actor || actor.path && actor.path.length) return false;
      if (staff) {
        const task = actor.operationTask;
        if (actor.role !== 'innkeeper' || actor.status !== 'working' || !task || task.type !== 'care' || task.phase !== 'work') return false;
        // Care workers use the doorway or its adjacent service position.
        return Math.min(Math.hypot(actor.x - entrance.x, actor.y - entrance.y), Math.hypot(actor.x - entrance.x - .65, actor.y - entrance.y)) < .15;
      }
      return actor.status === 'resting' && !!actor.bedId && Math.hypot(actor.x - entrance.x, actor.y - entrance.y) < .15;
    }

    // Presentation projection only: never changes an actor, route or save.
    static getVillageActors(state, layout, doors) {
      if(!state||!layout||!doors)return [];
      const townId=state.activeTownId,shop=layout.shop,entry=layout.entrance,inn=layout.inn.entrance;
      const clamp01=v=>Math.max(0,Math.min(1,v)),point=(x,y)=>({x:x*W,y:y*H});
      // road: centre of the dirt road in the village picture (background cropped to 16:9 by background-size:cover).
      const forge=point(doors.forge.x,doors.forge.y),guesthouse=point(doors.inn.x,doors.inn.y),road=.855;
      const fj=point(doors.forge.x,road),ij=point(doors.inn.x,road),junction=point(.50,road);
      const center=[junction,point(.48,.72),point(.52,.62),point(.54,.57),point(.50,.52)];
      const between=[forge,fj,ij,guesthouse],depart=[forge,fj,...center],arrival=[...depart].reverse();
      return (state.adventurers||[]).filter(a=>a.townId===townId&&a.status!=='hunting'&&Number.isFinite(a.x)&&Number.isFinite(a.y)).flatMap(a=>{
        const atInn=Math.hypot(a.x-inn.x,a.y-inn.y)<.16,indoors=a.x>=shop.x&&a.x<shop.x+shop.w&&a.y<shop.y+shop.h-.5;
        if(indoors||(a.status==='resting'&&atInn))return [];
        // The village road maps only the slow outdoor stretch (engine: y >= entrance.y + 1 walks at .55).
        // The doorway nook above it is walked at indoor pace and stays at the forge door, so nobody darts
        // along the road near the building.
        const outdoor=entry.y+1,out=clamp01((a.y-outdoor)/Math.max(1,layout.exit.y-outdoor));let pos;
        if(['departing','leaving'].includes(a.status))pos=ForgeScene.pointOnWorldRoute(depart,out);
        else if(['returning','traveling'].includes(a.status))pos=ForgeScene.pointOnWorldRoute(arrival,1-out);
        // Progress from the shop door toward the inn door, whichever side the inn stands on.
        // Forge ↔ inn: progress follows the walker's x from the shop door to the inn door, continuously (no jump).
        else {const span=inn.x-entry.x,u=Math.abs(span)<1?0:clamp01((a.x-entry.x)/span);
          pos=ForgeScene.pointOnWorldRoute(between,u);
        }
        return pos?[{actor:a,x:pos.x,y:pos.y}]:[];
      });
    }
    renderVillage(surface,state,now,doors) {
      if(!surface||!state||!doors)return;
      const ctx=surface.getContext('2d'),layout=global.ForgeSim.getTownLayout(state),elapsed=this.villageTime===undefined?0:clamp(now-this.villageTime,0,.12);
      this.villageTime=now;if(this.villageTown!==state.activeTownId){this.villageTown=state.activeTownId;this.villageMotion=new Map();}
      const motion=this.villageMotion||(this.villageMotion=new Map()),seen=new Set();
      ctx.clearRect(0,0,W,H);
      ctx.save();
      const actors=ForgeScene.getVillageActors(state,layout,doors).sort((a,b)=>a.y-b.y);
      for(const [index,p] of actors.entries()){
        const a=p.actor,old=motion.get(a.id),dx=old?p.x-old.x:0,dy=old?p.y-old.y:0;
        const moving=!!old&&elapsed>0&&Math.hypot(dx,dy)>.03&&Math.hypot(dx,dy)<W*.25;
        const animation=elapsed<=0&&old?old.animation:global.ForgeNPC?global.ForgeNPC.advanceMotion(old&&old.animation,{dx,dy,dt:elapsed,teleport:!moving}):{moving,dx,dy,walkTime:now};
        motion.set(a.id,{x:p.x,y:p.y,animation});seen.add(a.id);
        this._drawSprite(ctx,ForgeScene.getSpriteIndex(a,index),p.x,p.y,52,animation.moving?Math.sin(now*11+index)*.8:0,animation.moving,1,animation);
      }
      for(const id of motion.keys())if(!seen.has(id))motion.delete(id);
      ctx.restore();
    }

    _drawShop(ctx, state, now, dt) {
      const town = this._town, layout = this._layout;
      const encounter=global.ForgeSim&&global.ForgeSim.getInvasion?global.ForgeSim.getInvasion(state,town.id):null;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2 - this.camera.x * this.camera.zoom, H / 2 - this.camera.y * this.camera.zoom); ctx.scale(this.camera.zoom, this.camera.zoom);
      // Clip visual output to the owned rooms; simulation routes are unchanged.
      ctx.beginPath();for(const room of [layout.shop,layout.workshop,layout.warehouse].filter(Boolean))ctx.rect(room.x*TILE-16,room.y*TILE-BACK_WALL_HEIGHT-16,room.w*TILE+32,room.h*TILE+BACK_WALL_HEIGHT+32);
      if(layout.corridor)ctx.rect(layout.corridor.x*TILE-16,layout.corridor.y*TILE-16,layout.corridor.w*TILE+32,layout.corridor.h*TILE+48);
      const doorstep=this._doorstep(layout);if(doorstep)ctx.rect(doorstep.x-2,doorstep.y,doorstep.w+4,doorstep.h+2);ctx.clip();
      const cacheKey = `${town.id}:${layout.shop.w}:${layout.shop.h}:${layout.inn.capacity}:${layout.workshop?.h || 0}:${layout.warehouse?.w || 0}`;
      if (!this.backdrops.has(cacheKey)) {
        this.backdrops.set(cacheKey, this._createTownBackdrop(layout));
        if (this.backdrops.size > 2) this.backdrops.delete(this.backdrops.keys().next().value);
      }
      const backdrop = this.backdrops.get(cacheKey); ctx.drawImage(backdrop.canvas, backdrop.x, backdrop.y);
      if (layout.workshop && layout.corridor) this._drawWallFlames(ctx, this._workshopWallPlan(layout));
      this._drawRoomSigns(ctx, town, layout);
      this._drawVillageSign(ctx, layout);
      if (this.placement) this._drawPlacementGrid(ctx);
      const facilities = town.facilities || [];
      for (const f of facilities) this._drawFacilityGround(ctx, f, now);
      // The inn is an exterior. Capacity remains simulation data, not room UI.
      const actors = [], renderedIds = new Set();
      const innEntrance = layout.inn.entrance || { x: layout.inn.x + layout.inn.w / 2, y: layout.inn.y + layout.inn.h + .5 };

      for (const fixture of this._warehouseFixtures(layout.warehouse)) actors.push({ kind: fixture.kind, y: fixture.y * TILE, fixture });
      if (layout.corridor) for (const prop of this._shopFloorProps(layout)) actors.push({ kind: 'prop', y: prop.y, prop });
      if (layout.staffDoor) actors.push({ kind: 'partition', y: TILE - 2 });
      if (layout.counter) {
        actors.push({ kind: 'counter', y: (layout.counter.y + layout.counter.h) * TILE, counter: layout.counter });
        if (layout.counter.return) actors.push({ kind: 'counter-return', y: (layout.counter.return.y + layout.counter.return.h) * TILE, counter: layout.counter.return });
      }
      facilities.forEach(f => actors.push({ kind: 'facility', y: (f.y + f.h) * TILE - 4, facility: f }));
      for (const [i, staff] of (town.staff || []).entries()) {
        if (this._insideInn(staff, true)) continue;
        const m = this._actorMotion('staff:' + staff.id, staff, dt);
        renderedIds.add('staff:' + staff.id);
        actors.push({ kind: 'staff', y: m.y, actor: staff, motion: m, index: ForgeScene.getStaffSpriteIndex(staff), order: i });
      }
      const visitors = (state.adventurers || []).filter(a => a.townId === town.id && a.status !== 'hunting' && !(encounter&&encounter.status==='battle'&&a.invasionId===encounter.id&&a.status==='defending'));
      // Only the rooms and the doorstep are shown; the rest of the outdoors is off-stage.
      const onStage = m => {
        const tx = m.x / TILE, ty = m.y / TILE;
        if (ty < layout.shop.y + layout.shop.h && tx >= layout.shop.x && tx < layout.shop.x + layout.shop.w) return true;
        return !!doorstep && m.x >= doorstep.x && m.x <= doorstep.x + doorstep.w && m.y >= doorstep.y && m.y <= doorstep.y + doorstep.h;
      };
      visitors.forEach((a, i) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || this._insideInn(a, false)) return;
        const m = this._actorMotion('hero:' + a.id, a, dt); renderedIds.add('hero:' + a.id);
        if (!onStage(m)) return;
        actors.push({ kind: 'adventurer', y: m.y, actor: a, motion: m, index: ForgeScene.getSpriteIndex(a, i), order: i });
      });
      for (const id of this.motion.keys()) if (!renderedIds.has(id)) this.motion.delete(id);
      actors.sort((a, b) => a.y - b.y || (a.kind === 'inn' ? -1 : 1));
      for (const actor of actors) {
        if (actor.kind === 'facility') this._drawFacility(ctx, actor.facility, now);
        else if (actor.kind === 'inn') this._drawInnExterior(ctx, layout.inn, state);
        else if (actor.kind === 'partition') this._drawPartition(ctx, layout);
        else if (actor.kind === 'counter' || actor.kind === 'counter-return') this._drawCounter(ctx, actor.counter, actor.kind === 'counter-return');
        else if (actor.kind === 'stock-rack') this._drawStockRack(ctx, actor.fixture);
        else if (actor.kind === 'prop') { const c = SHOP_DECOR_CROPS[actor.prop.name]; if (c) shadow(ctx, actor.prop.x, actor.prop.y - 3, c.w * SHOP_ART_SCALE * .42, 7, .2); this._drawShopSprite(ctx, actor.prop.name, actor.prop.x, actor.prop.y); }
        else if (actor.kind === 'stock-crate') this._drawArt(ctx, 'crate', actor.fixture.x * TILE, actor.fixture.y * TILE, 40, 35);
        else this._drawActor(ctx, actor, state, now);
      }

      // 2026-11: the town-defence marker is not drawn in the forge view: its rally point lies outside the room (below the
      // entrance wall), so only a cut-off sliver showed. The fight is shown beside the town on the world map.
      if (this.placement) this._drawPlacementGhost(ctx);
      ctx.restore();
      // 2026-11: no furnace/inn status pill in the forge view (bottom-left).
      if (this.placement) {
        const p = this._placementAtPointer();
        const label = this.placement.moveId ? '옮길 자리를 눌러주세요' : `${FACILITY_NAMES[this.placement.type] || '시설'} 놓을 자리를 눌러주세요`;
        pill(ctx, p && !p.valid ? p.message || '여기에는 놓을 수 없어요' : label, W / 2, 26, { size: 12, height: 32, icon: 'hammer', fill: p && !p.valid ? '#fff0e8' : '#fff9df', color: p && !p.valid ? '#b36450' : '#6d7e55' });
      }
    }

    _createTownBackdrop(layout) {
      const b = layout.bounds, x = b.x * TILE - 40, y = b.y * TILE - 88 - BACK_WALL_HEIGHT;
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(b.w * TILE + 80); canvas.height = Math.ceil(b.h * TILE + 176 + BACK_WALL_HEIGHT);
      const ctx = canvas.getContext('2d'); ctx.translate(-x, -y);
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, canvas.width, canvas.height);
      if (layout.workshop && layout.warehouse) this._paintShopComplex(ctx, layout);
      else this._paintRoom(ctx, layout.shop, false);
      return { canvas, x, y };
    }

    _paintFloor(ctx, room, kind) {
      const x = room.x * TILE, y = room.y * TILE, w = room.w * TILE, h = room.h * TILE;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const art = this._shopPattern(ctx, kind === 'workshop' ? 'stone' : 'wood');
      if (art) {
        ctx.translate(x, y); ctx.fillStyle = art.pattern; ctx.fillRect(0, 0, w, h);
        if (kind === 'warehouse') { ctx.fillStyle = 'rgba(120,104,80,.18)'; ctx.fillRect(0, 0, w, h); }
        ctx.restore(); return;
      }
      if (kind === 'workshop') {
        const colors = ['#b8b2a1', '#c3bdad', '#bcb5a4', '#c8c1ae'];
        ctx.fillStyle = '#a49f91'; ctx.fillRect(x, y, w, h);
        for (let row = 0; row < room.h; row++) for (let col = -1; col < room.w; col++) {
          const sx = x + col * TILE * 1.5 + row % 2 * TILE * .75, sy = y + row * TILE;
          box(ctx, sx + 1, sy + 1, TILE * 1.5 - 2, TILE - 2, 3, colors[(row + col + 8) % colors.length], '#aaa493', .7);
          line(ctx, [[sx + 5, sy + 5], [sx + TILE * 1.5 - 6, sy + 5]], 'rgba(247,242,217,.26)', .9);
        }
      } else {
        const colors = kind === 'warehouse' ? ['#c9b68f', '#d0bd98', '#c4b18a'] : ['#d6ae78', '#dfb981', '#d3a975', '#dcba87'];
        for (let row = 0; row < room.h; row++) {
          ctx.fillStyle = colors[row % colors.length]; ctx.fillRect(x, y + row * TILE, w, TILE);
          line(ctx, [[x, y + (row + 1) * TILE - 1], [x + w, y + (row + 1) * TILE - 1]], kind === 'warehouse' ? '#ae9b78' : '#b18a5a', 1);
          for (let col = -1; col < room.w / 3 + 1; col++) {
            const px = x + col * TILE * 3 + row % 2 * TILE * 1.5;
            line(ctx, [[px, y + row * TILE], [px, y + (row + 1) * TILE]], kind === 'warehouse' ? '#b09d7c' : '#b78e5d', 1);
            line(ctx, [[px + 10, y + row * TILE + 9], [px + 54, y + row * TILE + 9]], 'rgba(255,244,215,.20)', 1);
            if ((row + col) % 4 === 0) ellipse(ctx, px + 35, y + row * TILE + 22, 7, 1.4, null, 'rgba(124,88,55,.12)', 1);
          }
        }
      }
      ctx.restore();
    }

    _paintBackWall(ctx, room, kind) {
      const x = room.x * TILE, y = room.y * TILE, w = room.w * TILE;
      const stone = kind === 'workshop';
      if (this._paintWallFace(ctx, x, x + w, y - BACK_WALL_HEIGHT, stone ? 'brick' : 'plaster')) return;
      box(ctx, x, y - 49, w, 49, 2, stone ? '#d8ceb6' : '#dfc9a2');
      if (stone) for (let row = 0; row < 3; row++) {
        line(ctx, [[x, y - 47 + row * 16], [x + w, y - 47 + row * 16]], '#b7aa91', 1);
        for (let col = 0; col < room.w / 2 + 1; col++) {
          const xx = x + col * TILE * 2 + row % 2 * TILE;
          line(ctx, [[xx, y - 47 + row * 16], [xx, y - 31 + row * 16]], '#b7aa91', 1);
        }
      }
      for (let bx = x + 3; bx < x + w; bx += TILE * 4) {
        box(ctx, bx, y - 49, 8, 49, 1, '#94704d', '#806044', 1);
        line(ctx, [[bx + 3, y - 43], [bx + 3, y - 7]], '#b18a61', 1);
      }
      box(ctx, x - 8, y - 57, w + 16, 12, 3, '#9f7953', '#74553c', 2);
      line(ctx, [[x - 4, y - 53], [x + w + 4, y - 53]], '#bd976c', 2);
      box(ctx, x, y - 7, w, 9, 1, '#9d7851', '#7f5d3f', 1);
      if (stone) for (const wx of [x + 23, x + w - 61]) {
        box(ctx, wx, y - 41, 34, 27, 4, '#acbdb2', '#876747', 2);
        line(ctx, [[wx + 17, y - 40], [wx + 17, y - 15]], '#e9d6b4', 2.5);
        line(ctx, [[wx + 2, y - 28], [wx + 32, y - 28]], '#e9d6b4', 2.5);
        box(ctx, wx - 3, y - 14, 40, 4, 1, '#a47e57', '#806044', 1);
      }
    }

    _paintShopComplex(ctx, layout) {
      const shop = layout.shop, rear = layout.workshop, warehouse = layout.warehouse;
      const x = shop.x * TILE, y = rear.y * TILE, w = shop.w * TILE, h = (shop.h - rear.y) * TILE;
      // Layout v6: no separate warehouse room; layout.warehouse is the storage corner inside the workshop.
      const separateWarehouse = !warehouse.storageCorner;
      const wx = warehouse.x * TILE, wy = warehouse.y * TILE, ww = warehouse.w * TILE, wh = warehouse.h * TILE;
      shadow(ctx, x + w / 2 + 4, shop.h * TILE + 9, w / 2 + 18, 17, .13);
      if (separateWarehouse) shadow(ctx, wx + ww / 2, wy + wh + 9, ww / 2 + 12, 13, .1);
      // Stardew-like rooms (layout v3): each room has its own thick rounded border, the rooms stand apart with an
      // empty gap between them, and a short staff corridor crosses the gap. The shop's back wall face is drawn over
      // the band as an actor (_drawPartition) so people in the corridor pass behind it.
      const corridor = layout.corridor, rearBottom = (rear.y + rear.h) * TILE, shopTop = TILE - BACK_WALL_HEIGHT, B = 12;
      // 2026-11: one building outline for all rooms. Each layer (dark edge, wood band, light stripe, wood, inner
      // edge) is filled for every room rectangle before the next layer, so the workshop, the corridor and the shop
      // merge into one continuous border with no corner pieces or seams; floors and walls are painted over the inside.
      const rooms = [];
      if (separateWarehouse) rooms.push([wx, wy - BACK_WALL_HEIGHT, ww, wh + BACK_WALL_HEIGHT]);
      rooms.push([x, y - BACK_WALL_HEIGHT, w, rear.h * TILE + BACK_WALL_HEIGHT]);
      rooms.push([x, corridor ? shopTop : 0, w, shop.h * TILE - (corridor ? shopTop : 0)]);
      if (corridor) rooms.push([corridor.x * TILE, rearBottom - 4, corridor.w * TILE, shopTop - rearBottom + 8]);
      rooms.push([Math.floor(shop.w / 2) * TILE - TILE, shop.h * TILE - 4, 2 * TILE, TILE + 4]); // exit nook
      for (const [e, color] of [[B + 2, '#4a2a14'], [B - .5, '#b8692f'], [B - 3, '#e7a463'], [B - 4.5, '#c8783c'], [2.5, '#6b3d1d']]) {
        for (const [rx, ry, rw, rh] of rooms) box(ctx, rx - e, ry - e, rw + e * 2, rh + e * 2, Math.max(2, e * .8), color);
      }
      const doorX = Math.floor(shop.w / 2) * TILE;
      if (separateWarehouse) this._paintFloor(ctx, warehouse, 'warehouse');
      this._paintFloor(ctx, rear, 'workshop');
      this._paintFloor(ctx, shop, 'shop');
      // 2026-11 (Stardew-like): the exit is a 2x1-tile nook sticking out under the shop's front edge; the building
      // border wraps around it (it is one of the outline rectangles) and the floor runs into it.
      this._paintFloor(ctx, { x: doorX / TILE - 1, y: shop.h - .1, w: 2, h: 1.1 }, 'shop');
      if (separateWarehouse) this._paintBackWall(ctx, warehouse, 'warehouse');
      this._paintBackWall(ctx, rear, 'workshop');
      this._workshopWallDecor(ctx, layout);
      if (corridor) {
        // Corridor floor from the workshop down through the doorway; it cuts both rooms' borders.
        const cx0 = corridor.x * TILE, cw = corridor.w * TILE, art = this._shopPattern(ctx, 'stone');
        ctx.save(); ctx.beginPath(); ctx.rect(cx0, rearBottom - 2, cw, TILE - rearBottom + 2); ctx.clip();
        if (art) { ctx.translate(cx0, rearBottom); ctx.fillStyle = art.pattern; ctx.fillRect(0, -2, cw, TILE - rearBottom + 2); }
        else { ctx.fillStyle = '#c3bdad'; ctx.fillRect(cx0, rearBottom - 2, cw, TILE - rearBottom + 2); }
        ctx.restore();
      }
      // The stockroom portal cuts both boundary tiles, at exactly the same rows used by the walking graph.
      const sideDoor = layout.warehouseDoor || warehouse.door;
      if (sideDoor) {
        const openingTop = sideDoor.y * TILE, openingBottom = (sideDoor.y + sideDoor.h) * TILE;
        box(ctx, -TILE - 3, openingTop, TILE + 8, openingBottom - openingTop, 3, '#c9bf9e', '#998b70', 1);
        for (const sy of [openingTop, openingBottom]) {
          box(ctx, -9, sy - 3, 15, 6, 2, '#96734f', '#74573e', 1);
          line(ctx, [[-TILE + 1, sy], [-8, sy]], '#d8d0b2', 1.2);
        }
      }
      // 2026-11: no low front wall strip, threshold or door mat; the room border (with an opening) frames the entrance.
      // A soft shadow under each back wall joins the wall and the floor.
      const wallShadow = (sx, sy, sw) => { const gr = ctx.createLinearGradient(0, sy, 0, sy + 16); gr.addColorStop(0, 'rgba(70,40,20,.30)'); gr.addColorStop(1, 'rgba(70,40,20,0)'); ctx.fillStyle = gr; ctx.fillRect(sx, sy, sw, 16); };
      wallShadow(x, (rear.y + 1) * TILE - TILE, w);
      if (corridor) wallShadow(x, TILE, w);
    }

    _paintRoom(ctx, room, inn) {
      const x = room.x * TILE, y = room.y * TILE, w = room.w * TILE, h = room.h * TILE;
      shadow(ctx, x + w / 2 + 4, y + h + 9, w / 2 + 18, 17, .13);
      box(ctx, x - 8, y - BACK_WALL_HEIGHT - 10, w + 16, h + BACK_WALL_HEIGHT + 22, 8, '#927154', '#70533e', 3);
      box(ctx, x - 3, y - 49, w + 6, h + 55, 4, inn ? '#b8a084' : '#bd9566', '#826044', 2);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      const colors = inn ? ['#d9c4a1', '#dfcbac', '#d5be9a'] : ['#d6ae78', '#dfb981', '#d3a975', '#dcba87'];
      for (let row = 0; row < room.h; row++) {
        ctx.fillStyle = colors[row % colors.length]; ctx.fillRect(x, y + row * TILE, w, TILE);
        line(ctx, [[x, y + (row + 1) * TILE - 1], [x + w, y + (row + 1) * TILE - 1]], inn ? '#bfa782' : '#b18a5a', 1);
        for (let col = -1; col < room.w / 3 + 1; col++) {
          const px = x + col * TILE * 3 + (row % 2) * TILE * 1.5;
          line(ctx, [[px, y + row * TILE], [px, y + (row + 1) * TILE]], inn ? '#c3ab87' : '#b78e5d', 1);
          line(ctx, [[px + 10, y + row * TILE + 9], [px + 54, y + row * TILE + 9]], 'rgba(255,240,198,.17)', 1);
          if ((row + col) % 4 === 0) ellipse(ctx, px + 35, y + row * TILE + 22, 7, 1.4, null, 'rgba(124,88,55,.12)', 1);
        }
      }
      if (inn) {
        box(ctx, x + 10, y + 13, w - 20, h - 26, 4, 'rgba(144,133,146,.20)', 'rgba(136,120,134,.26)', 2);
        line(ctx, [[x + 15, y + 18], [x + w - 15, y + 18]], '#ded6c7', 1.5);
      }
      ctx.restore();
      // Back wall is upright, side and front walls are cut low for visibility.
      box(ctx, x, y - 49, w, 49, 2, inn ? '#e6d4b1' : '#e6c99e', null);
      for (let bx = x + 4; bx <= x + w; bx += TILE * 4) {
        box(ctx, bx, y - 49, 8, 49, 1, '#94704d', '#806044', 1);
        line(ctx, [[bx + 3, y - 43], [bx + 3, y - 7]], '#b18a61', 1);
      }
      box(ctx, x - 8, y - 57, w + 16, 12, 3, '#9f7953', '#74553c', 2);
      line(ctx, [[x - 4, y - 53], [x + w + 4, y - 53]], '#bd976c', 2);
      box(ctx, x, y - 7, w, 9, 1, '#9d7851', '#7f5d3f', 1);
      const windows = inn ? [x + 20, x + w - 53] : [x + 23, x + w - 62];
      for (const wx of windows) {
        box(ctx, wx, y - 41, 34, 27, 4, '#b1c4b2', '#876747', 2);
        line(ctx, [[wx + 17, y - 40], [wx + 17, y - 15]], '#f1deb8', 2.5);
        line(ctx, [[wx + 2, y - 28], [wx + 32, y - 28]], '#f1deb8', 2.5);
        box(ctx, wx - 3, y - 14, 40, 4, 1, '#a47e57', '#806044', 1);
        line(ctx, [[wx + 5, y - 37], [wx + 12, y - 32]], 'rgba(250,250,217,.55)', 2);
      }
      box(ctx, x - 7, y - 2, 7, h + 5, 2, '#a77d52', '#7c5b3f', 1.2);
      box(ctx, x + w, y - 2, 7, h + 5, 2, '#a77d52', '#7c5b3f', 1.2);
      const doorCenter = inn ? x + w / 2 : this._layout.entrance.x * TILE;
      box(ctx, x - 7, y + h - 3, Math.max(0, doorCenter - 42 - x + 7), 8, 2, '#a87e54', '#7f5b3e', 1.2);
      box(ctx, doorCenter + 42, y + h - 3, Math.max(0, x + w + 7 - doorCenter - 42), 8, 2, '#a87e54', '#7f5b3e', 1.2);
      box(ctx, doorCenter - 41, y + h - 1, 82, 7, 2, '#d3c3a0', '#a39476', 1);
      box(ctx, doorCenter - 25, y + h - 35, 50, 25, 4, inn ? '#a7a2a0' : '#ad9067', 'rgba(107,81,53,.25)', 1);
      line(ctx, [[doorCenter - 18, y + h - 28], [doorCenter + 18, y + h - 28]], 'rgba(255,236,195,.25)', 1);
    }

    // --- Village signpost at the shop's front door (replaces the old top-left view switcher). ---
    _loadVillageSign(src) {
      if (typeof Image !== 'function') return;
      const image = new Image(); image.decoding = 'async';
      image.onload = () => { this.villageSign = ForgeScene.cutoutSign(image); };
      image.onerror = () => { this.villageSign = null; };
      image.src = src;
    }
    // Remove a flat light background connected to the image border (art may arrive with a white backdrop),
    // soften the fringe, trim, and keep a small cached canvas.
    static cutoutSign(image) {
      try {
        const nw = image.naturalWidth || image.width, nh = image.naturalHeight || image.height;
        if (!nw || !nh || typeof document === 'undefined') return null;
        const scale = Math.min(1, 320 / Math.max(nw, nh)), w = Math.max(1, Math.round(nw * scale)), h = Math.max(1, Math.round(nh * scale));
        const work = document.createElement('canvas'); work.width = w; work.height = h;
        const c = work.getContext('2d', { willReadFrequently: true }); c.drawImage(image, 0, 0, w, h);
        const data = c.getImageData(0, 0, w, h), px = data.data, removed = new Uint8Array(w * h), seen = new Uint8Array(w * h), stack = [];
        const background = i => px[i + 3] < 12 || Math.min(px[i], px[i + 1], px[i + 2]) > 222 && Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) < 26;
        for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
          if (!background(p * 4)) continue;
          removed[p] = 1; px[p * 4 + 3] = 0;
          const x = p % w, y = (p - x) / w;
          if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
        }
        let left = w, top = h, right = -1, bottom = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const p = y * w + x, i = p * 4; if (removed[p]) continue;
          const edge = x > 0 && removed[p - 1] || x < w - 1 && removed[p + 1] || y > 0 && removed[p - w] || y < h - 1 && removed[p + w];
          const low = Math.min(px[i], px[i + 1], px[i + 2]);
          if (edge && low > 170) px[i + 3] = Math.round(px[i + 3] * clamp((255 - low) / 85, 0, 1));
          if (px[i + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
        if (right < left) return null;
        c.putImageData(data, 0, 0);
        const out = document.createElement('canvas'); out.width = right - left + 1; out.height = bottom - top + 1;
        out.getContext('2d').drawImage(work, left, top, out.width, out.height, 0, 0, out.width, out.height);
        // Solid silhouette used to draw the hover outline around the object.
        const silhouette = document.createElement('canvas'); silhouette.width = out.width; silhouette.height = out.height;
        const sc = silhouette.getContext('2d'); sc.drawImage(out, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#ffe9a3'; sc.fillRect(0, 0, out.width, out.height);
        // Anchor the post (not the arrow board) on the ground: centre of the opaque span low on the post.
        let anchor = .4; const row = top + Math.round((bottom - top) * .78); let a = -1, b = -1;
        for (let x = left; x <= right; x++) if (px[(row * w + x) * 4 + 3] > 64) { if (a < 0) a = x; b = x; }
        if (a >= 0) anchor = ((a + b) / 2 - left) / out.width;
        return { canvas: out, silhouette, w: out.width, h: out.height, anchor };
      } catch (_) { return null; }
    }
    _doorstep(layout) {
      const e = layout && layout.entrance, shop = layout && layout.shop;
      if (!e || !shop) return null;
      // 2026-11: the 2x1 exit nook under the front edge (people leaving walk through it and off-stage).
      const cx = Math.floor(shop.w / 2) * TILE;
      return { x: cx - TILE, y: (shop.y + shop.h) * TILE - 2, w: 2 * TILE, h: TILE + 2 };
    }
    // The exit nook leads to the village: hovering it glows, clicking it goes out (same as the "마을로" button).
    _drawVillageSign(ctx, layout) {
      const step = this._doorstep(layout); if (!step) return;
      const hovered = this.hover && this.hover.kind === 'station' && this.hover.id === 'village';
      if (hovered) { box(ctx, step.x + 2, step.y + 2, step.w - 4, step.h - 4, 4, 'rgba(255,224,140,.35)', '#ffd978', 2); }
      this._hitWorld('station', 'village', step.x, step.y - TILE, step.w, step.h + TILE, { title: '마을로 나가기' });
    }
    // 2026-11: no painted room signs inside the forge. The back walls themselves stay clickable (invisible hit areas):
    // workshop wall -> crafting, storage corner -> warehouse, shop back wall -> facilities/upgrades.
    _drawRoomSigns(ctx, town, layout) {
      const rear = layout.workshop, warehouse = layout.warehouse, H = BACK_WALL_HEIGHT;
      if (rear) {
        const corner = warehouse && warehouse.storageCorner, x0 = corner && warehouse.side !== 'right' ? (warehouse.x + warehouse.w) * TILE : 0, x1 = corner && warehouse.side === 'right' ? warehouse.x * TILE : rear.w * TILE;
        // 2026-11: the workshop back wall is decoration only (no "제작 작업실" hover/click area).
        void x0; void x1;
      }
      if (warehouse) {
        const label = `창고 Lv.${warehouse.level || town.warehouseLevel || 1}`;
        const top = warehouse.storageCorner ? rear.y * TILE - H : warehouse.y * TILE - 49;
        this._hitWorld('station', 'warehouse', (warehouse.storageCorner && warehouse.side !== 'right' ? 0 : warehouse.x * TILE), top, warehouse.w * TILE + (warehouse.storageCorner ? TILE : 0), (warehouse.y + warehouse.h) * TILE - top, this._warehouseCard(label));
      }
      // 2026-11: the shop back wall is decoration only (no "대장간 Lv." hover/click there any more).
    }
    // Sales counter card: who is serving, who is waiting to pay, and what the counter is for.
    _counterCard(town) {
      const state = this._state, sellers = (town.staff || []).filter(w => w.role === 'sales');
      const serving = sellers.filter(w => w.status === 'selling').length;
      const waiting = (state.adventurers || []).filter(a => a.townId === town.id && a.checkoutPending).length;
      const sold = state.stats && state.stats.sold || 0;
      return { title: '계산대', lines: [
        '판매 직원이 손님에게 장비를 팔고, 돌아온 모험가의 재료를 사들여요',
        '판매 직원: ' + sellers.length + '명' + (sellers.length ? ' (지금 응대 중 ' + serving + '명)' : ' · 판매 직원을 배정해 주세요'),
        '계산 기다리는 손님: ' + waiting + '명',
        '지금까지 판매: ' + sold.toLocaleString('ko-KR') + '개'
      ] };
    }
    // Layout v2: the shop's back wall as a 3-tile front face (W1 art) standing on the wall band, with a top beam over the
    // band and an open doorway (lintel above) where the staff corridor runs through.
    _drawShopBackWall(ctx, layout) {
      const door = layout.staffDoor, width = layout.shop.w * TILE, base = TILE, H = BACK_WALL_HEIGHT, top = base - H;
      const bandTop = (layout.workshop.y + layout.workshop.h) * TILE, start = door.x * TILE, end = (door.x + door.w) * TILE;
      const face = (x0, x1) => {
        if (x1 <= x0 || this._paintWallFace(ctx, x0, x1, top, 'plaster')) return;
        ctx.fillStyle = '#dfc69e'; ctx.fillRect(x0, top, x1 - x0, H);
      };
      face(0, start); face(end, width);
      this._shopWallDecor(ctx, layout);
      const doorArt = this.shopObjectsLoaded && SHOP_OBJECT_CROPS.staffDoor;
      if (doorArt) {
        // D1 doorway art fills the wall section above the corridor (staff walking through pass behind it).
        ctx.drawImage(this.shopObjects, doorArt.x, doorArt.y, doorArt.w, doorArt.h, start, top, end - start, H);
      } else {
        // Doorway: two posts and a lintel; the corridor floor shows through the opening.
        const lintel = 26;
        box(ctx, start - 2, top, end - start + 4, lintel, 2, '#a68154', '#725339', 1.5);
        for (const px of [start - 6, end - 2]) box(ctx, px, top, 8, base - top, 2, '#8d6948', '#6f523a', 1.2);
        box(ctx, (start + end) / 2 - 27, top + 4, 54, 18, 4, '#eee2c2', '#9b7c50', 1);
        text(ctx, '직원 전용', (start + end) / 2, top + 13, 8.5, '#806849', 800);
      }
    }

    _drawPartition(ctx, layout) {
      const door = layout.staffDoor, width = layout.shop.w * TILE;
      if (!door) return;
      if (layout.corridor) return this._drawShopBackWall(ctx, layout);
      const start = door.x * TILE, end = (door.x + door.w) * TILE, base = TILE;
      const segment = (x, w) => {
        if (w <= 0) return;
        box(ctx, x, base - 38, w, 38, 2, '#dfc69e', '#9e7b54', 1.1);
        line(ctx, [[x + 3, base - 27], [x + w - 3, base - 27]], '#eed8b4', 1.3);
        box(ctx, x - 2, base - 45, w + 4, 10, 2, '#a78256', '#75563b', 1.2);
        line(ctx, [[x, base - 42], [x + w, base - 42]], '#c9a371', 1.4);
        box(ctx, x, base - 5, w, 6, 1, '#9d7951', '#81613f', .7);
        for (let bx = x + TILE * 2; bx < x + w - TILE; bx += TILE * 4) box(ctx, bx, base - 35, 7, 30, 1, '#ad8961', '#94704c', .5);
      };
      segment(0, start); segment(end, width - end);
      box(ctx, 39, 1, 174, 26, 4, '#f9eed3', '#ae8c60', 1.1);
      icon(ctx, 'sword', 56, 14, 15, '#9b7950');
      text(ctx, '매장 · 장비 진열 / 강화', 134, 14, 10.5, '#85653f', 800);
      // The doorway is genuinely open: no painted door panel crosses the two
      // passable tiles. The thin leaf is folded against the right jamb.
      box(ctx, start - 3, -2, end - start + 6, TILE + 4, 2, '#c7bb96', '#a19170', .8);
      for (const px of [start - 5, end - 3]) {
        box(ctx, px, -33, 8, 68, 2, '#8d6948', '#6f523a', 1.2);
        line(ctx, [[px + 3, -28], [px + 3, 29]], '#b08a5d', 1.4);
      }
      box(ctx, start - 8, -40, end - start + 16, 12, 3, '#a68154', '#725339', 1.5);
      ctx.beginPath(); ctx.moveTo(end - 1, -24); ctx.lineTo(end + 9, -18); ctx.lineTo(end + 9, 28); ctx.lineTo(end - 1, 34); ctx.closePath(); ctx.fillStyle = '#a17b4d'; ctx.fill(); ctx.strokeStyle = '#725438'; ctx.lineWidth = 1.2; ctx.stroke();
      ellipse(ctx, end + 5, 10, 1.6, 1.6, '#d1b574');
      box(ctx, (start + end) / 2 - 27, -55, 54, 18, 4, '#eee2c2', '#9b7c50', 1);
      text(ctx, '직원 전용', (start + end) / 2, -46, 8.5, '#806849', 800);
    }

    _drawCounter(ctx, rect, isReturn) {
      const x = rect.x * TILE, w = rect.w * TILE, base = (rect.y + rect.h) * TILE, top = base - 50;
      if (this.shopObjectsLoaded) {
        const long = !isReturn && SHOP_OBJECT_CROPS.counter;
        if (long) {
          // O10 long counter art drawn across the whole counter footprint.
          const c = SHOP_OBJECT_CROPS.counter, dw = w + 8, dh = c.h * dw / c.w;
          shadow(ctx, x + w / 2 + 2, base + 1, dw / 2 + 4, 8, .18);
          ctx.drawImage(this.shopObjects, c.x, c.y, c.w, c.h, x - 4, base - dh + 4, dw, dh);
        } else this._drawShopDesk(ctx, x + w / 2, base, isReturn);
        if (!isReturn) {
          // The desk art is drawn exactly as made (no stretching, no painted label); the hover card names it.
          this._hitWorld('info', 'counter', x - 4, top - 14, w + 8, 69, this._counterCard(this._town)); // hover-only card, no click
        }
        return;
      }
      shadow(ctx, x + w / 2 + 2, base + 3, w / 2 + 6, 7, .13);
      box(ctx, x, top + 16, w, 34, 2, '#a77d50', '#745438', 1.5);
      box(ctx, x + 4, top + 21, w - 8, 24, 2, '#bc9461', '#8e6b45', .8);
      for (let dx = 24; dx < w - 8; dx += 36) line(ctx, [[x + dx, top + 22], [x + dx, top + 44]], '#a88053', .9);
      box(ctx, x - 3, top + 2, w + 6, 18, 3, '#d3b382', '#805c3c', 1.6);
      line(ctx, [[x + 2, top + 6], [x + w - 1, top + 6]], '#edcfa0', 1.8);
      box(ctx, x + 2, base - 5, w - 4, 6, 1, '#8e6846', '#745438', .8);
      if (!isReturn) {
        // Ledger, bell, and coin tray distinguish the sales counter from a rack.
        box(ctx, x + 15, top - 7, 28, 18, 2, '#e8ddc0', '#a7946f', .8);
        line(ctx, [[x + 29, top - 5], [x + 29, top + 9]], '#b4a17b', .8);
        for (const yy of [-2, 3, 7]) line(ctx, [[x + 18, top + yy], [x + 25, top + yy]], '#bbac8b', .7);
        ellipse(ctx, x + w - 20, top + 4, 8, 3, '#9a7950', '#755637', .8);
        ellipse(ctx, x + w - 20, top, 5.5, 5.5, '#d8b863', '#9f8049', .8);
        ellipse(ctx, x + w - 20, top - 6, 2, 1.5, '#ead292', '#a98b52', .6);
        box(ctx, x + w - 46, top - 1, 14, 11, 2, '#8b6943', '#735238', .7);
        for (let i = 0; i < 3; i++) ellipse(ctx, x + w - 42 + i * 3, top + 4 - i % 2, 2.3, 1.8, '#e0bb5e', '#b58c3f', .5);
        text(ctx, '계산 · 재료 매입', x + w / 2, top + 33, 9.2, '#705337', 800);
        this._hitWorld('info', 'counter', x - 4, top - 14, w + 8, 69, this._counterCard(this._town)); // hover-only card, no click
      }
    }

    // The counter desk, bottom-centred at (cx, base), same scale as every shop sprite, never stretched.
    // The 1-tile return piece of the L counter uses a short plain cut of the same desk: its left end (atlas columns 0-12),
    // the plain top before the book (13-46) and its right end (172-184), so nothing is repeated or squashed.
    _drawShopDesk(ctx, cx, base, plain) {
      const c = SHOP_OBJECT_CROPS.desk, s = SHOP_ART_SCALE, h = c.h * s, img = this.shopObjects, top = base - h;
      const parts = plain ? [[0, 13], [13, 34], [172, 13]] : [[0, c.w]];
      const total = parts.reduce((sum, p) => sum + p[1], 0) * s;
      shadow(ctx, cx + 2, base + 1, total / 2 + 6, 8, .18);
      let px = cx - total / 2;
      for (const [sx, sw] of parts) { ctx.drawImage(img, c.x + sx, c.y, sw, c.h, px, top, sw * s, h); px += sw * s; }
      return { x: cx - total / 2, y: top, w: total, h };
    }

    _warehouseFixtures(warehouse) {
      if (!warehouse) return [];
      // 2026-11: shelves stand along the left wall (like a library's bookcases), crates sit to their right. Visual only.
      // Storage corner (layout v6): two rows of 3 shelves side by side, a 2-tile aisle between the rows (pickup spot),
      // the lower row ends one row above the workshop floor's last row so the staff corridor exit stays clear.
      const fixtures = [];
      if (warehouse.storageCorner) {
        const shelfW = SHOP_OBJECT_CROPS.shelf.w * SHOP_ART_SCALE / TILE, shelfH = SHOP_OBJECT_CROPS.shelf.h * SHOP_ART_SCALE / TILE;
        const lower = warehouse.y + warehouse.h - 1, upper = lower - shelfH - 2 + 1;
        const right = warehouse.side === 'right', edge = right ? warehouse.x + warehouse.w + 1 - .1 : warehouse.x - 1 + .1, dir = right ? -1 : 1;
        // Shelf places come from the shared layout (shop-layout.js), which also makes them walking obstacles.
        const shelves = warehouse.shelves || (global.ForgeShopLayout && global.ForgeShopLayout.storageShelves(warehouse)) || [];
        for (const s of shelves) fixtures.push({ kind: 'stock-rack', x: s.cx, y: s.base, variant: s.variant });
        // Ore crates only appear once the warehouse reaches Lv.5 (user design: two lone crates looked odd before that).
        const cx = edge + dir * (shelfW * 3 + .9), crates = (warehouse.level || 1) >= 5 ? [[cx, upper - .3], [cx + dir * .7, upper + .35], [cx + dir * .1, lower - .2]] : [];
        for (const [x, y] of crates) fixtures.push({ kind: 'stock-crate', x, y });
        return fixtures;
      }
      const shelves = Math.max(2, Math.floor((warehouse.h - 2) / 2));
      for (let i = 0; i < shelves; i++) fixtures.push({ kind: 'stock-rack', x: warehouse.x + 1.75, y: warehouse.y + 2 + i * 2, variant: i });
      const crates = [[3.85, 1.35], [4.45, 2.0], [3.55, 2.05]].slice(0, Math.min(3, (warehouse.level || 1) + 1));
      for (const [dx, dy] of crates) fixtures.push({ kind: 'stock-crate', x: warehouse.x + dx, y: warehouse.y + dy });
      return fixtures;
    }

    _drawStockRack(ctx, fixture) {
      const x = fixture.x * TILE, y = fixture.y * TILE, w = 79, h = 71;
      shadow(ctx, x, y, 42, 8, .16);
      if (this._drawShopSprite(ctx, 'shelf', x, y + 2)) return;
      box(ctx, x - w / 2, y - h, w, h - 5, 3, '#8b7150', '#6f573c', 1.6);
      box(ctx, x - w / 2 + 5, y - h + 6, w - 10, h - 16, 2, '#b39870', '#94754e', .8);
      for (const yy of [y - 38, y - 10]) {
        box(ctx, x - w / 2 - 2, yy - 4, w + 4, 7, 1.5, '#c2a273', '#80633e', .9);
        line(ctx, [[x - w / 2, yy - 3], [x + w / 2, yy - 3]], '#dbc29a', 1);
      }
      for (const dx of [-w / 2 + 3, w / 2 - 8]) box(ctx, x + dx, y - h + 2, 5, h + 1, 1, '#aa8759', '#785c3d', .7);
      const variant = fixture.variant % 3;
      for (let i = 0; i < 3; i++) {
        const sx = x - 24 + i * 23;
        if ((i + variant) % 3 === 0) {
          for (let j = 0; j < 3; j++) { box(ctx, sx - 7 + j * 3, y - 61 + j % 2 * 3, 10, 18, 3, '#bc9463', '#80613f', .7); ellipse(ctx, sx - 2 + j * 3, y - 60 + j % 2 * 3, 4.5, 2, '#dfbb89', '#957047', .6); }
        } else icon(ctx, 'material', sx, y - 52, 19, (i + variant) % 3 === 1 ? '#91a4a2' : '#b2a4c2');
        box(ctx, sx - 8, y - 29, 17, 17, 2, i % 2 ? '#c1ab84' : '#c0a06e', '#8e7250', .7);
        line(ctx, [[sx - 5, y - 26], [sx + 6, y - 15]], '#dfc89e', 2);
        box(ctx, sx - 4, y - 24, 8, 6, 1, '#eee0bb');
      }
    }

    _drawFacilityGround(ctx, f, now) {
      const x = f.x * TILE, y = f.y * TILE, w = f.w * TILE, h = f.h * TILE;
      if (f.type === 'furnace') {
        // 2026-11: no stone mat under furnaces (the workshop floor art is enough).
      } else if (false) {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(ctx, x - 4 + c * (w + 8) / 3, y + r * (h + 5) / 3, (w + 5) / 3, (h + 1) / 3, 3, r % 2 ? '#c8bea6' : '#c2b8a0', '#aaa08a', .7);
      } else if (f.type === 'display') {
        box(ctx, x - 7, y - 4, w + 14, h + 12, 5, '#9aa182', '#7c8568', 1.6);
        box(ctx, x - 2, y + 1, w + 4, h + 2, 3, null, '#b9bda0', 1.2);
      } else {
        ellipse(ctx, x + w / 2, y + h - 3, w / 2 + 7, 24, '#b1a9ab', '#91878e', 1.3);
        ellipse(ctx, x + w / 2, y + h - 3, w / 2 - 2, 17, null, '#d1c8c5', 1);
      }
      if (this.hover && this.hover.kind === 'facility' && this.hover.id === f.id) {
        box(ctx, x - 7, y - 3, w + 14, h + 13, 5, 'rgba(255,242,182,.15)', '#fff3be', 2);
      }
    }

    _drawFacility(ctx, f, now) {
      const x = (f.x + f.w / 2) * TILE, y = (f.y + f.h) * TILE;
      const width = f.type === 'display' ? 64 : f.type === 'furnace' ? 86 : 78;
      const height = f.type === 'furnace' ? 111 : f.type === 'display' ? 137 : 76;
      const moving = this.placement && this.placement.moveId === f.id;
      ctx.save(); if (moving) ctx.globalAlpha = .35;
      shadow(ctx, x + 1, y - 2, width * .44, 9, .18);
      const rect = this._drawArt(ctx, f.type, x, y, width, height);
      if (f.type === 'furnace' && f.active === true) this._drawFurnaceFire(ctx, rect, now, f.id);
      else if (f.type === 'furnace' && rect) this._drawFurnaceEmbers(ctx, rect, now, f.id);
      if (f.type === 'enhance' && f.active === true) {
        const flicker = .3 + Math.sin(now * 7) * .1;
        ellipse(ctx, x, y - height * .43, 17, 8, `rgba(213,185,239,${flicker})`);
        icon(ctx, 'spark', x + Math.sin(now * 3) * 15, y - height * .62, 8, '#f8e1a2');
      }
      if (f.type === 'display') {
        const displays = (this._town.facilities || []).filter(v => v.type === 'display'), index = displays.findIndex(v => v.id === f.id);
        const visibleStock = global.ForgeSim && global.ForgeSim.getDisplayedItems ? global.ForgeSim.getDisplayedItems(this._state, this._town.id) : (this._town.inventory || []).filter(item => item.listed);
        const items = visibleStock.slice(index * 6, index * 6 + 6);
        // The table runs away from the viewer: all six slots show, 2 across x 3 along the table top (back row first).
        items.forEach((item, i) => {
          const recipe = global.ForgeSim && global.ForgeSim.DATA && global.ForgeSim.DATA.recipes;
          const r = Array.isArray(recipe) ? recipe.find(r => r.id === item.recipeId) : recipe && recipe[item.recipeId];
          const type = r && r.type || item.type || (item.slot === 'offhand' ? 'shield' : 'sword');
          const cx = x + (i % 2 ? 11 : -11), cy = y - 108 + Math.floor(i / 2) * 32;
          const pic = this._itemIcon(item.recipeId);
          if (pic) ctx.drawImage(pic.image, pic.src.x, pic.src.y, pic.src.w, pic.src.h, cx - 12, cy - 12, 24, 24);
          else weapon(ctx, cx, cy, type, .42);
        });
        const badgeX = x + width / 2 - 3, badgeY = y - height + 6;
        box(ctx, badgeX - 13, badgeY - 9, 29, 18, 5, '#fff7e3', '#b29870', 1);
        text(ctx, `${items.length}/6`, badgeX + 1, badgeY, 9, '#85704c', 800);
      }
      const task = (this._town.queue || []).find(q => q.id === f.taskId);
      if (f.type === 'furnace' && task) {
        const pct = clamp(task.total ? 1 - Number(task.remaining || 0) / task.total : Number(task.progress || 0), 0, 1);
        const barY = y - height - 7;
        box(ctx, x - 29, barY - 4, 58, 8, 4, '#e9d9b8', '#a88959', .8);
        if (pct > .01) box(ctx, x - 28, barY - 3, Math.max(2, 56 * pct), 6, 3, f.active ? '#cc8550' : '#aaa082');
      }
      ctx.restore();
      const status = f.active ? f.type === 'furnace' ? '직원이 제작 중이에요' : '모험가가 강화 중이에요' : f.type === 'furnace' ? '직원이 도착하면 불을 지펴요' : f.type === 'display' ? '진열 공간 6칸' : '강화석을 쓰고 수수료를 받아요';
      this._hitWorld('facility', f.id, x - width / 2, y - height, width, height + 10, this._facilityCard(f, status));
    }
    // Hover card for the storage corner: what the current warehouse level holds, and what the next level adds.
    _warehouseCard(label) {
      const sim = global.ForgeSim, w = sim && sim.getWarehouse ? sim.getWarehouse(this._state, this._town.id) : null;
      if (!w || !w.valid) return { title: label, detail: '창고 · 재료와 장비를 보관해요' };
      const n = v => Number(v || 0).toLocaleString('ko-KR');
      const lines = ['재료: 종류마다 ' + n(w.materialCapacity) + '개까지', '장비: ' + n(w.equipmentUsed) + ' / ' + n(w.equipmentCapacity) + '칸 사용 중', '선반: ' + w.shelves + '개'];
      if (w.nextLevel) lines.push('다음 Lv.' + w.nextLevel + ': 재료 ' + n(w.nextMaterialCapacity) + '개 · 선반 ' + w.nextShelves + '개');
      return { title: label, lines };
    }
    // Hover card for a facility: furnace grade / speed / crew, the six display slots, or the anvil's short status.
    // What this furnace is making right now (item and time left), or why it is waiting.
    _furnaceNow(f, crew) {
      const town = this._town, queue = (town.queue || []).filter(q => q.facilityId === f.id);
      const task = queue.find(q => q.id === f.taskId) || queue[0];
      if (!task) return [];
      const recipes = global.ForgeSim && global.ForgeSim.DATA && global.ForgeSim.DATA.recipes;
      const r = Array.isArray(recipes) ? recipes.find(v => v.id === task.recipeId) : recipes && recipes[task.recipeId];
      const name = (r && r.name) || task.name || '장비', left = Math.max(0, Math.ceil((Number(task.remaining) || 0) / gameRate()));
      if (f.active) return ['지금 만드는 중: ' + name + (left ? ' · 남은 시간 ' + left + '초' : '')];
      const staff = town.staff || (this._state && this._state.staff || []).filter(v => !v.townId || v.townId === town.id);
      const smith = crew || staff.some(v => v.role === 'smith' && (!v.facilityId || v.facilityId === f.id));
      return ['다음 제작: ' + name + (smith ? ' · 대장장이가 곧 시작해요' : ' · 대장장이를 화덕에 배치해주세요')];
    }

    _facilityCard(f, status) {
      const sim = global.ForgeSim, state = this._state, town = this._town;
      if (f.type === 'furnace') {
        const grade = f.grade || 1, names = ['화덕', '고급 화덕', '최고급 화덕'];
        const crew = sim && sim.getFurnaceWorkers ? sim.getFurnaceWorkers(state, town.id, f.id).length : 0;
        const jobs = (town.queue || []).filter(q => q.facilityId === f.id).length;
        return { title: names[grade - 1] || '화덕', lines: [
          '함께 일하는 인원: 최대 ' + grade + '명 (지금 ' + crew + '명)',
          '제작 속도: 1명당 ×1 (지금 ×' + Math.max(crew, 0) + ')',
          '제작 대기열: ' + jobs + ' / 3',
        ].concat(this._furnaceNow(f, crew), grade < 3 ? ['등급 개선은 클릭 → 시설 배치에서'] : []) };
      }
      if (f.type === 'display') {
        const displays = (town.facilities || []).filter(v => v.type === 'display'), index = displays.findIndex(v => v.id === f.id);
        const stock = sim && sim.getDisplayedItems ? sim.getDisplayedItems(state, town.id) : (town.inventory || []).filter(item => item.listed);
        const items = stock.slice(index * 6, index * 6 + 6);
        const lines = Array.from({ length: 6 }, (_, i) => {
          const item = items[i]; if (!item) return (i + 1) + '. 비어 있음';
          const quality = sim && sim.DATA && sim.DATA.qualities && sim.DATA.qualities[item.quality];
          // "1. (우수) 숲길의 목걸이 · 69 G": grade first, then name (+enhance), then price.
          return (i + 1) + '. ' + (quality ? '(' + (quality.label || quality.name) + ') ' : '') + (item.name || '장비') + (item.enhance ? ' +' + item.enhance : '') + (item.price ? ' · ' + Math.round(item.price).toLocaleString('ko-KR') + ' G' : '');
        });
        // Empty slots while sellable gear waits in storage: say who fills them, or how to do it by hand.
        if (items.length < 6) {
          const waiting = (town.inventory || []).filter(item => !item.listed && !item.locked && !item.autoProtected && !(sim && sim.isCustomerItemReserved && sim.isCustomerItemReserved(state, item.id))).length;
          const porter = (town.staff || []).some(w => w.role === 'logistics') && town.operations && town.operations.autoDisplay && town.operations.autoDisplay.enabled;
          if (waiting) lines.push(porter ? '창고에 진열할 장비 ' + waiting + '개 · 물류 직원이 곧 채워요' : '창고에 진열할 장비 ' + waiting + '개 · 작업대의 장비 보관에서 진열하세요');
          else if (!items.length) lines.push('진열할 장비가 없어요 · 화덕에서 장비를 만들어주세요');
        }
        return { title: '장비 진열대 (' + items.length + '/6)', lines };
      }
      if (f.type === 'enhance' && sim && sim.getEnhanceBench) {
        const b = sim.getEnhanceBench(state, town.id, f.id), n = v => Math.round(v || 0).toLocaleString('ko-KR');
        if (b && b.user) return { title: '강화 단조대', lines: [ // A: someone is enhancing right now
          '사용 중: ' + b.user.name + ' · ' + b.user.item + ' +' + b.user.from + ' → +' + b.user.to,
          '성공 확률 ' + Math.round((b.user.successRate || 0) * 100) + '% · 실패하면 장비가 부서져요',
          '남은 시간 ' + Math.max(0, Math.ceil((b.user.remaining || 0) / gameRate())) + '초 · ' + (b.helper ? '강화 도우미 함께 있음 (속도 ×' + b.speed + ')' : '강화 도우미 없음')
        ] };
        if (b) return { title: '강화 단조대', lines: [ // B: idle
          '모험가가 강화석과 수수료를 내고 장비를 강화해요',
          '오늘 강화 성공 ' + b.today.ok + '번 · 실패 ' + b.today.fail + '번 · 수수료 수입 ' + n(b.today.fees) + ' G',
          '강화 도우미: ' + (b.helper ? '있음 (속도 ×' + b.speed + ')' : '없음 (배정하면 속도 ×1.5)')
        ] };
      }
      return { title: FACILITY_NAMES[f.type] || '시설', detail: status };
    }

    // Draws one object from the 2026-11 shop sheet, bottom-centred at (x, y), fitted inside maxWidth x maxHeight.
    // Hang a wall decoration: centred at cx, its top at topY (world pixels), same scale as every shop sprite.
    _drawDecor(ctx, name, cx, topY) {
      const c = SHOP_OBJECT_CROPS[name]; if (!c || !this.shopObjectsLoaded) return;
      const w = c.w * SHOP_ART_SCALE, h = c.h * SHOP_ART_SCALE;
      ctx.drawImage(this.shopObjects, c.x, c.y, c.w, c.h, cx - w / 2, topY, w, h);
    }
    // 2026-11 decor sheets (A: shop wall, B: shop floor, C: workshop wall, animated torch). Wall pieces hang at
    // WALL_DECOR_SCALE so they fit the 3-tile wall; floor pieces use SHOP_ART_SCALE like every other floor sprite.
    // Hang one wall piece centred at (cx, cy); 'top' anchors banners by their top edge instead.
    _hang(ctx, name, cx, cy, anchor) {
      const c = SHOP_DECOR_CROPS[name]; if (!c || !this.shopDecorLoaded) return;
      const s = WALL_DECOR_SCALE, w = c.w * s, h = c.h * s;
      ctx.drawImage(this.shopDecor, c.x, c.y, c.w, c.h, cx - w / 2, anchor === 'top' ? cy : cy - h / 2, w, h);
    }
    // Wall torch: iron cup on the wall; the flame (3 frames) is drawn every frame by _drawTorchFlame.
    _torchBase(ctx, cx, cy) {
      const c = SHOP_DECOR_CROPS.torchBase; if (!c || !this.shopDecorLoaded) return;
      const s = WALL_DECOR_SCALE, w = c.w * s, h = c.h * s;
      ctx.drawImage(this.shopDecor, c.x, c.y, c.w, c.h, cx - w / 2, cy - h / 2, w, h);
    }
    _drawTorchFlame(ctx, cx, cy, seed) {
      if (!this.shopDecorLoaded) return;
      // 4 frames a second (was 7), and the flame sits a little higher so it rises out of the cup.
      const frame = SHOP_DECOR_CROPS['flame' + (1 + Math.floor((this._time || 0) * 4 + seed) % 3)];
      const s = WALL_DECOR_SCALE, base = SHOP_DECOR_CROPS.torchBase.h * s, w = frame.w * s, h = frame.h * s;
      ctx.drawImage(this.shopDecor, frame.x, frame.y, frame.w, frame.h, cx - w / 2, cy - base / 2 - h + base * .06, w, h);
    }
    // Wall layout. The shop wall fills the space right of the staff door with an evenly spaced row (extra pieces join
    // when the shop is widened); the workshop wall follows the furnace row (centres at x 2/7/12 tiles) and the storage.
    // 2026-11 (user layout): helmet shelf left of the staff door; right of the door the long sword board and the glass
    // cases (sword, bow) run up to the three mannequins standing in the top-right corner. No torches or window here.
    _shopWallPlan(layout) {
      const top = TILE - BACK_WALL_HEIGHT, cy = top + 47, door = layout.staffDoor;
      // Centred staff door: sword case, long sword board and helmet shelf on the left wall; bow case (and extras when
      // the shop is wider) between the door and the corner mannequins.
      const plan = [], put = row => { for (const { name, x } of row) plan.push({ name, x, y: name === 'guildBanner' ? top + 10 : /Shelf$/.test(name) ? cy + 6 : cy, anchor: name === 'guildBanner' ? 'top' : null }); };
      // (user layout) left of the door: sword case and bow case, the leftmost tile kept empty; right of the door:
      // the helmet shelf.
      put(this._spreadDecor(TILE, door.x * TILE - 6, ['glassSword', 'glassBow'], ['painting']));
      plan.push({ name: 'helmetShelf', x: this._helmetSpot(layout), y: cy - 4 });
      return plan;
    }
    // Centre of the free wall between the staff door and the corner mannequins (helmet shelf above, shields below).
    _helmetSpot(layout) {
      const door = layout.staffDoor;
      return ((door.x + door.w) * TILE + this._mannequinRow(layout)[0].left) / 2;
    }
    // Warrior, mage, leather mannequins side by side against the back wall in the shop's top-right corner.
    _mannequinRow(layout) {
      let right = layout.shop.w * TILE - 3; const out = [];
      for (const name of ['mannequinLeather', 'mannequinRobe', 'mannequinPlate']) {
        const w = SHOP_DECOR_CROPS[name].w * SHOP_ART_SCALE;
        out.unshift({ name, x: right - w / 2, y: 1.75 * TILE, left: right - w }); right -= w + 2;
      }
      return out;
    }
    // Evenly spaced row between start and end: the base pieces always, extras while they still fit (min gap 20px).
    _spreadDecor(start, end, base, extras) {
      const items = [...base], minGap = 20, width = list => list.reduce((t, n) => t + this._decorWidth(n), 0);
      for (const extra of extras) { if (width([...items, extra]) + minGap * (items.length + 2) <= end - start) items.push(extra); else break; }
      const gap = Math.max(0, (end - start - width(items)) / (items.length + 1)), out = []; let x = start + gap;
      for (const name of items) { const w = this._decorWidth(name); out.push({ name, x: x + w / 2 }); x += w + gap; }
      return out;
    }
    _workshopWallPlan(layout) {
      // 2026-11 (user layout): windows at the far left, the centre and the far right, a torch left of the right window;
      // then the boards in order (tools, blueprints, apron, bellows, ingot shelf) fill the free wall left to right,
      // skipping over the windows and the torch. Pieces that no longer fit are left out.
      const top = layout.workshop.y * TILE - BACK_WALL_HEIGHT, width = layout.workshop.w * TILE, win = this._decorWidth('sootyWindow');
      const fixed = [
        { name: 'sootyWindow', x: 6 + win / 2 }, { name: 'sootyWindow', x: width / 2 }, { name: 'sootyWindow', x: width - 6 - win / 2 },
        { name: 'torch', x: width - 6 - win - 4 - this._decorWidth('torch') / 2 }
      ].sort((a, b) => a.x - b.x);
      const plan = fixed.map(p => ({ ...p, y: p.name === 'torch' ? top + 50 : top + 42 }));
      const queue = ['toolBoard', 'blueprints', 'apron', 'bellows', 'ingotShelf'], minGap = 3;
      for (let i = 0; i < fixed.length - 1 && queue.length; i++) {
        const start = fixed[i].x + this._decorWidth(fixed[i].name) / 2, end = fixed[i + 1].x - this._decorWidth(fixed[i + 1].name) / 2, take = [];
        while (queue.length && [...take, queue[0]].reduce((t, n) => t + this._decorWidth(n), 0) + minGap * (take.length + 2) <= end - start) take.push(queue.shift());
        const used = take.reduce((t, n) => t + this._decorWidth(n), 0), gap = (end - start - used) / (take.length + 1);
        let x = start + gap;
        for (const name of take) { const w = this._decorWidth(name); plan.push({ name, x: x + w / 2, y: name === 'ingotShelf' ? top + 48 : top + 44 }); x += w + gap; }
      }
      return plan;
    }
    _decorWidth(name) { const c = SHOP_DECOR_CROPS[name === 'torch' ? 'torchBase' : name]; return c ? c.w * WALL_DECOR_SCALE : 0; }
    _paintWallPlan(ctx, plan) {
      for (const p of plan) if (p.name === 'torch') this._torchBase(ctx, p.x, p.y); else this._hang(ctx, p.name, p.x, p.y, p.anchor);
    }
    _drawWallFlames(ctx, plan) { plan.forEach((p, i) => { if (p.name === 'torch') this._drawTorchFlame(ctx, p.x, p.y, i * 1.7); }); }
    _workshopWallDecor(ctx, layout) { this._paintWallPlan(ctx, this._workshopWallPlan(layout)); }
    _shopWallDecor(ctx, layout) {
      const plan = this._shopWallPlan(layout);
      this._paintWallPlan(ctx, plan); this._drawWallFlames(ctx, plan);
    }
    // Floor pieces stand by the side walls and under the back wall, clear of the counter, displays and the centre aisle.
    _shopFloorProps(layout) {
      return this._mannequinRow(layout).map(({ name, x, y }) => ({ name, x, y }));
    }
    // Every shop sprite uses the same scale (SHOP_ART_SCALE, also used by the floor/wall tiles) so outlines keep one
    // thickness across objects; maxWidth/maxHeight are only fallbacks for the old art.
    _drawShopSprite(ctx, name, x, y) {
      if (SHOP_DECOR_CROPS[name]) {
        // Floor decoration from the 2026-11 decor sheet (same scale as every floor sprite).
        const c = SHOP_DECOR_CROPS[name]; if (!this.shopDecorLoaded) return null;
        const w = c.w * SHOP_ART_SCALE, h = c.h * SHOP_ART_SCALE;
        ctx.drawImage(this.shopDecor, c.x, c.y, c.w, c.h, x - w / 2, y - h, w, h);
        return { x: x - w / 2, y: y - h, w, h, scale: SHOP_ART_SCALE, shopArt: name };
      }
      const crop = SHOP_OBJECT_CROPS[name];
      if (!crop || !this.shopObjectsLoaded) return null;
      const scale = SHOP_ART_SCALE, w = crop.w * scale, h = crop.h * scale;
      ctx.drawImage(this.shopObjects, crop.x, crop.y, crop.w, crop.h, x - w / 2, y - h, w, h);
      return { x: x - w / 2, y: y - h, w, h, scale, shopArt: name };
    }

    // 2026-11 wall face: wood beam on top, a plain body (plaster for the shop, brick for the workshop, no vertical
    // posts) and a wood baseboard. Patterns are anchored to world x so split segments line up. Returns false without art.
    _paintWallFace(ctx, x0, x1, top, body) {
      const art = this._shopPattern(ctx, body === 'brick' ? 'wallBrick' : 'wallPlaster');
      const beam = this._shopPattern(ctx, 'wallBeam'), base = this._shopPattern(ctx, 'wallBase');
      if (!art || !beam || !base) return false;
      const H = BACK_WALL_HEIGHT, bh = beam.h, sh = base.h;
      const band = (pattern, y, h) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, top + y, x1 - x0, h); ctx.clip(); ctx.translate(0, top + y); ctx.fillStyle = pattern; ctx.fillRect(x0, 0, x1 - x0, h); ctx.restore(); };
      band(art.pattern, bh - 1, H - bh - sh + 2);
      band(beam.pattern, 0, bh);
      band(base.pattern, H - sh, sh);
      return true;
    }

    // Floor / wall patterns cut from the concept panels, scaled to the tile grid once.
    _shopPattern(ctx, name) {
      if (!this.shopTilesLoaded || typeof document === 'undefined') return null;
      if (!this.shopPatterns) this.shopPatterns = {};
      if (!(name in this.shopPatterns)) {
        const crop = SHOP_TILE_CROPS[name], size = { w: Math.round(crop.w * SHOP_ART_SCALE), h: Math.round(crop.h * SHOP_ART_SCALE) };
        // Wall bodies repeat mirrored left-right so the cut edges always meet their own reflection (no seam).
        const mirror = false, mirrorX = name === 'wallPlaster' || name === 'wallBrick', tile = document.createElement('canvas');
        tile.width = size.w * (mirror || mirrorX ? 2 : 1); tile.height = size.h * (mirror ? 2 : 1);
        const tctx = tile.getContext('2d'); tctx.imageSmoothingQuality = 'high';
        // The shop floor (F1) is toned down (lighter, less saturated) so furniture reads clearly on it.
        const quads = mirror ? [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]] : mirrorX ? [[0, 0, 1, 1], [1, 0, -1, 1]] : [[0, 0, 1, 1]];
        for (const [qx, qy, sx, sy] of quads) {
          tctx.save(); tctx.translate((qx + (sx < 0 ? 1 : 0)) * size.w, (qy + (sy < 0 ? 1 : 0)) * size.h); tctx.scale(sx, sy);
          // Drawn 1px larger than the tile: scaling exactly to the edge left the last column/row partly transparent
          // (a faint dark seam line on the floor); the extra pixel is clipped by the tile canvas.
          // Floors (F1/F2) are packed seamless and fully opaque edge to edge (rebuilt 2026-11 with wrap sampling), so the
          // whole crop tiles exactly: the plank/stone rhythm continues across tile edges (no thin horizontal seam).
          // Copied 1:1 to its own canvas first: scaling straight from the atlas let the filter read the transparent gap
          // next to the crop, which left the edge rows half transparent.
          if (name === 'wood' || name === 'stone') {
            const solo = document.createElement('canvas'); solo.width = crop.w; solo.height = crop.h;
            solo.getContext('2d').drawImage(this.shopTiles, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
            tctx.drawImage(solo, 0, 0, size.w, size.h);
          }
          else tctx.drawImage(this.shopTiles, crop.x + 1, crop.y + 1, crop.w - 2, crop.h - 2, 0, 0, size.w + 1, size.h + 1);
          tctx.restore();
        }
        // The filter is applied to a 3x3 repeat and only the middle copy is kept: filtering the tile alone left its
        // 1px border semi-transparent, which showed as a thin dark vertical line wherever two floor tiles met.
        if (name === 'wood' && 'filter' in tctx) {
          const pad = document.createElement('canvas'); pad.width = tile.width * 3; pad.height = tile.height * 3;
          const pctx = pad.getContext('2d');
          for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) pctx.drawImage(tile, gx * tile.width, gy * tile.height);
          tctx.clearRect(0, 0, tile.width, tile.height); tctx.filter = 'saturate(.62) brightness(1.13)';
          tctx.drawImage(pad, -tile.width, -tile.height);
        }
        tctx.filter = 'none';
        if (name === 'wood') { tctx.globalCompositeOperation = 'source-atop'; tctx.fillStyle = 'rgba(255,238,212,.18)'; tctx.fillRect(0, 0, tile.width, tile.height); }
        this.shopPatterns[name] = { tile, w: tile.width, h: tile.height };
      }
      const entry = this.shopPatterns[name];
      return entry ? { pattern: ctx.createPattern(entry.tile, name.startsWith('wall') ? 'repeat-x' : 'repeat'), w: entry.w, h: entry.h } : null;
    }

    _drawArt(ctx, type, x, y, maxWidth, maxHeight) {
      if (SHOP_ART_FOR[type]) { const rect = this._drawShopSprite(ctx, SHOP_ART_FOR[type], x, y); if (rect) return rect; }
      const crop = FACILITY_CROPS[type];
      if (this.facilitiesLoaded && crop) {
        const sw = crop.w || this.facilityImage.naturalWidth / 3, sh = crop.h || this.facilityImage.naturalHeight / 3;
        const sx = crop.x === undefined ? crop.col * sw : crop.x, sy = crop.y === undefined ? crop.row * sh : crop.y;
        const scale = Math.min(maxWidth / sw, maxHeight / sh), w = sw * scale, h = sh * scale;
        ctx.drawImage(this.facilityImage, sx, sy, sw, sh, x - w / 2, y - h, w, h);
        return { x: x - w / 2, y: y - h, w, h, scale, generated: true };
      }
      const rect = { x: x - maxWidth / 2, y: y - maxHeight, w: maxWidth, h: maxHeight, generated: false };
      this._drawFallbackFacility(ctx, type, x, y, maxWidth, maxHeight); return rect;
    }

    _drawFallbackFacility(ctx, type, x, y, w, h) {
      ctx.save(); ctx.translate(x, y);
      if (type === 'furnace') {
        box(ctx, -15, -h, 30, 43, 5, '#b4a28c', '#766b5f', 2);
        ellipse(ctx, 0, -h + 2, 15, 5, '#d0bda5', '#766b5f', 2); ellipse(ctx, 0, -h + 2, 10, 3, '#554b42');
        box(ctx, -w / 2 + 5, -h * .69, w - 10, h * .65, 15, '#b5a38c', '#7a6a58', 2.3);
        for (let row = 0; row < 3; row++) line(ctx, [[-w / 2 + 10, -h * .61 + row * 18], [w / 2 - 10, -h * .61 + row * 18]], '#d1bfa3', 2);
        ctx.beginPath(); ctx.moveTo(-18, -13); ctx.lineTo(-18, -31); ctx.quadraticCurveTo(0, -55, 18, -31); ctx.lineTo(18, -13); ctx.closePath(); ctx.fillStyle = '#4b4039'; ctx.fill(); ctx.strokeStyle = '#7d6854'; ctx.lineWidth = 5; ctx.stroke();
        box(ctx, -w / 2, -12, w, 13, 4, '#b8a48b', '#7a6a58', 2);
      } else if (type === 'enhance') {
        ellipse(ctx, 0, -8, 27, 10, '#8c6b48', '#6d523b', 2); box(ctx, -27, -31, 54, 24, 4, '#b68b58', '#76583b', 2); ellipse(ctx, 0, -31, 27, 11, '#d2ac75', '#8e6b45', 2);
        box(ctx, -12, -47, 24, 21, 3, '#8c9290', '#62686a', 2); box(ctx, -25, -57, 50, 13, 3, '#bdc1b9', '#62686a', 2);
        line(ctx, [[-25, -54], [-35, -50], [-25, -46]], '#9ba6a1', 7); icon(ctx, 'hammer', 9, -64, 22, '#8c6d51');
      } else if (type === 'display') {
        box(ctx, -w / 2, -h, w, h - 14, 5, '#a77b4c', '#795636', 2);
        box(ctx, -w / 2 + 6, -h + 6, w - 12, h - 28, 3, '#bd945e', '#916d42', 1);
        for (let i = 0; i < 3; i++) ellipse(ctx, (i - 1) * 27, -h + 25, 3, 4, '#cbc8ab', '#736754', 1);
        box(ctx, -w / 2 - 3, -22, w + 6, 13, 3, '#c39961', '#795636', 2);
        box(ctx, -w / 2 + 4, -10, 8, 10, 1, '#8d673f'); box(ctx, w / 2 - 12, -10, 8, 10, 1, '#8d673f');
      } else if (type === 'bed') {
        box(ctx, -w / 2, -h, w, h, 5, '#b18a60', '#806044', 2); box(ctx, -w / 2 + 4, -h + 8, w - 8, h - 16, 6, '#efe7cd', '#b89d7b', 1);
        box(ctx, -w / 2 + 7, -h + 11, w - 14, 15, 5, '#fff4d9', '#c9b38d', 1); box(ctx, -w / 2 + 4, -h + 30, w - 8, h - 40, 4, '#9eae85', '#788e67', 1);
        box(ctx, -w / 2 - 2, -12, w + 4, 12, 3, '#b78d60', '#806044', 1.5);
      } else if (type === 'crate') {
        box(ctx, -w / 2, -h, w, h, 3, '#bd9461', '#7c5a3b', 2);
        line(ctx, [[-w / 2 + 4, -h + 4], [w / 2 - 4, -4]], '#d6b17d', 5); line(ctx, [[w / 2 - 4, -h + 4], [-w / 2 + 4, -4]], '#d6b17d', 5);
      } else if (type === 'barrel') {
        box(ctx, -w / 2, -h + 5, w, h - 5, 12, '#ad8254', '#765438', 2); ellipse(ctx, 0, -h + 6, w / 2, 6, '#c7a275', '#765438', 2);
        for (const dy of [-h + 14, -12]) box(ctx, -w / 2 - 1, dy, w + 2, 5, 2, '#8f8b75', '#676a5d', 1);
      }
      ctx.restore();
    }

    // An idle furnace keeps a small, low banked fire (slower, dimmer) so the workshop never looks dead.
    _drawFurnaceEmbers(ctx, rect, now, id) {
      if (rect.shopArt !== 'furnace' || !this.shopObjectsLoaded || !this.furnaceFlameLoaded) return;
      const mx = rect.x + rect.w * .503, base = rect.y + rect.h * .885, openW = rect.w * .36, img = this.furnaceFlame, cw = img.width / 3;
      const f = Math.floor(now * 2.5 + String(id || '').length) % 3, fw = openW * .78, fh = fw * img.height / cw * .72;
      ctx.save(); ctx.globalAlpha = .62 + Math.sin(now * 2 + String(id || '').length) * .06;
      ctx.drawImage(img, f * cw, 0, cw, img.height, mx - fw / 2, base - fh + openW * .03, fw, fh);
      ctx.restore();
    }
    _drawFurnaceFire(ctx, rect, now, id) {
      if (rect.shopArt === 'furnace' && this.shopObjectsLoaded) {
        // Opening of the brick kiln sprite: x 110..235, y 295..395 of the 342x444 crop.
        const mx = rect.x + rect.w * .503, base = rect.y + rect.h * .885, openW = rect.w * .36, phase = now * 7 + String(id || '').length;
        const glow = ctx.createRadialGradient(mx, base - openW * .35, 0, mx, base - openW * .35, openW * 1.6);
        glow.addColorStop(0, `rgba(255,167,66,${.28 + Math.sin(phase) * .04})`); glow.addColorStop(1, 'rgba(255,161,60,0)');
        ctx.fillStyle = glow; ctx.fillRect(mx - openW * 1.6, base - openW * 1.9, openW * 3.2, openW * 2.6);
        // 2026-11: the furnace's own flame-and-coals sprite (3 frames, 5 a second) sits in the opening.
        if (this.furnaceFlameLoaded) {
          const img = this.furnaceFlame, cw = img.width / 3, f = Math.floor(now * 5 + String(id || '').length) % 3;
          const fw = openW * 1.18, fh = fw * img.height / cw;
          ctx.drawImage(img, f * cw, 0, cw, img.height, mx - fw / 2, base - fh + openW * .04, fw, fh);
          return;
        }
        if (this.shopDecorLoaded) {
          const frame = SHOP_DECOR_CROPS['flame' + (1 + Math.floor(now * 4 + String(id || '').length) % 3)];
          const fw = openW * 1.05, fh = fw * frame.h / frame.w;
          ctx.drawImage(this.shopDecor, frame.x, frame.y, frame.w, frame.h, mx - fw / 2, base - fh, fw, fh);
          return;
        }
        const crop = SHOP_OBJECT_CROPS.fire, fw = crop.w * SHOP_ART_SCALE * .85, fh = crop.h * SHOP_ART_SCALE * .85 * (1 + Math.sin(phase) * .06);
        ctx.drawImage(this.shopObjects, crop.x, crop.y, crop.w, crop.h, mx - fw / 2, base - fh, fw, fh);
        return;
      }
      const s = rect.generated ? rect.scale : rect.w / 84;
      const mx = rect.generated ? rect.x + (280 - 137) * s : rect.x + rect.w / 2;
      const base = rect.generated ? rect.y + (279 - 16) * s : rect.y + rect.h - 13;
      const width = rect.generated ? 118 * s : 34 * s, height = rect.generated ? 74 * s : 33 * s;
      const phase = now * 7 + String(id || '').length;
      const glow = ctx.createRadialGradient(mx, base - height / 3, 0, mx, base - height / 3, width * 1.7);
      glow.addColorStop(0, `rgba(255,167,66,${.23 + Math.sin(phase) * .035})`); glow.addColorStop(1, 'rgba(255,161,60,0)');
      ctx.fillStyle = glow; ctx.fillRect(mx - width * 1.7, base - height * 2, width * 3.4, height * 3.5);
      ctx.save(); ctx.beginPath(); ctx.moveTo(mx - width / 2, base); ctx.lineTo(mx - width / 2, base - height * .42);
      ctx.quadraticCurveTo(mx, base - height * 1.33, mx + width / 2, base - height * .42); ctx.lineTo(mx + width / 2, base); ctx.closePath(); ctx.clip();
      const ember = ctx.createLinearGradient(0, base - height, 0, base);
      ember.addColorStop(0, 'rgba(214,87,35,.10)'); ember.addColorStop(1, 'rgba(245,144,49,.82)'); ctx.fillStyle = ember; ctx.fillRect(mx - width / 2, base - height, width, height);
      for (let i = 0; i < 3; i++) {
        const cx = mx + (i - 1) * width * .22, flameH = height * (.55 + .2 * Math.sin(phase + i * 1.8));
        ctx.beginPath(); ctx.moveTo(cx - width * .22, base + 1);
        ctx.bezierCurveTo(cx - width * .29, base - flameH * .4, cx + width * .14, base - flameH * .7, cx + Math.sin(phase + i) * width * .12, base - flameH);
        ctx.bezierCurveTo(cx + width * .3, base - flameH * .55, cx + width * .24, base - flameH * .12, cx + width * .17, base + 1); ctx.closePath();
        ctx.fillStyle = i === 1 ? '#ffe9a2' : '#ffb557'; ctx.fill();
      }
      for (let i = 0; i < 4; i++) ellipse(ctx, mx - width * .32 + i * width * .2, base - 1, 2 * s + .7, .9, '#ffe5a3');
      ctx.restore();
    }

    _drawInnExterior(ctx, inn, state) {
      const x = inn.x * TILE, y = inn.y * TILE, w = inn.w * TILE;
      const entrance = inn.entrance || { x: inn.x + inn.w / 2, y: inn.y + inn.h + .5 };
      const cx = entrance.x * TILE, base = entrance.y * TILE, wallTop = base - 108;
      const roofBack = y - 18, roofFront = wallTop + 10;
      const locals = (state.adventurers || []).filter(a => a.townId === this._town.id && a.resident);
      const resting = locals.filter(a => this._insideInn(a, false)).length;
      const injured = locals.filter(a => a.injuryUntil > (state.time || 0)).length;

      // Upright plaster-and-timber frontage, with a dark open doorway.
      box(ctx, x - 3, wallTop, w + 6, base - wallTop + 1, 5, '#e9d9b7', '#876d53', 2.5);
      box(ctx, x - 8, base - 18, w + 16, 23, 5, '#b4b4a4', '#8d9181', 1.8);
      for (let sx = x + 17; sx < x + w; sx += 39) line(ctx, [[sx, base - 16], [sx - 4, base + 3]], '#929a87', 1);
      for (const px of [x + 5, x + w - 14]) {
        box(ctx, px, wallTop + 5, 9, base - wallTop - 20, 2, '#99754f', '#77593f', 1.5);
        line(ctx, [[px + 3, wallTop + 14], [px + 3, base - 24]], '#c19a6c', 1.4);
      }
      box(ctx, x - 7, wallTop + 5, w + 14, 10, 2, '#957451', '#74583e', 1.6);
      box(ctx, cx - 28, base - 66, 56, 67, 8, '#8d6d4e', '#71523b', 2);
      box(ctx, cx - 21, base - 58, 42, 59, 5, '#4d463e', '#c2a176', 1.8);
      box(ctx, cx - 17, base - 53, 7, 49, 1, '#786044');
      line(ctx, [[cx - 13, base - 49], [cx - 13, base - 8]], '#a08057', 1.4);
      box(ctx, cx - 32, base - 2, 64, 9, 3, '#e0d6b8', '#9d9d85', 1.2);
      for (const wx of [x + 25, x + w - 62]) {
        box(ctx, wx - 4, base - 74, 45, 45, 5, '#947b59', '#765f46', 1.7);
        box(ctx, wx, base - 70, 37, 35, 4, '#e9d79c', '#b89e6c', 1.3);
        line(ctx, [[wx + 18.5, base - 69], [wx + 18.5, base - 35]], '#f9edc9', 2.6);
        line(ctx, [[wx + 1, base - 53], [wx + 36, base - 53]], '#f9edc9', 2.6);
        box(ctx, wx - 7, base - 33, 51, 7, 2, '#917454', '#705c42', 1.1);
        for (let i = 0; i < 4; i++) ellipse(ctx, wx + 1 + i * 10, base - 29, 5, 3.2, i % 2 ? '#8da575' : '#b8bf88');
      }

      // The complete shingled roof conceals the interior; its front wall stays
      // visible so it follows the same front-facing depth as the shop objects.
      ctx.save(); ctx.beginPath();
      ctx.moveTo(x + 15, roofBack); ctx.lineTo(x + w - 15, roofBack);
      ctx.lineTo(x + w + 17, roofFront); ctx.lineTo(x - 17, roofFront); ctx.closePath();
      ctx.fillStyle = '#7b8992'; ctx.fill(); ctx.strokeStyle = '#5b6a73'; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
      for (let row = 0, ry = roofBack + 7; ry < roofFront; row++, ry += 19) {
        ctx.fillStyle = ['#7f8e99', '#8997a0', '#788a95'][row % 3]; ctx.fillRect(x - 20, ry, w + 40, 18);
        line(ctx, [[x - 20, ry + 17], [x + w + 20, ry + 17]], '#5d737f', 1.2);
        for (let rx = x - 23 + (row % 2) * 16; rx < x + w + 20; rx += 32) {
          line(ctx, [[rx, ry], [rx + 2, ry + 15]], '#647985', 1.1);
          line(ctx, [[rx + 5, ry + 4], [rx + 24, ry + 4]], 'rgba(218,229,224,.20)', 1.1);
        }
      }
      ctx.restore();
      line(ctx, [[x + 15, roofBack], [x - 17, roofFront]], '#a2adb0', 3);
      line(ctx, [[x + w - 15, roofBack], [x + w + 17, roofFront]], '#576d79', 3);
      box(ctx, x - 20, roofFront - 2, w + 40, 10, 3, '#6b7a81', '#53636c', 1.7);
      line(ctx, [[x - 15, roofFront], [x + w + 15, roofFront]], '#aeb7b4', 1.8);
      box(ctx, x + 11, roofBack - 7, w - 22, 10, 4, '#9da9aa', '#687b83', 1.5);

      const dormerY = roofBack + (roofFront - roofBack) * .53;
      for (const dx of [-51, 51]) {
        const dc = cx + dx;
        box(ctx, dc - 21, dormerY - 4, 42, 36, 3, '#decfae', '#8c785c', 1.8);
        box(ctx, dc - 13, dormerY + 4, 26, 22, 5, '#b1c4c0', '#8c785c', 1.5);
        line(ctx, [[dc, dormerY + 5], [dc, dormerY + 24]], '#f7ebc9', 2.1);
        ctx.beginPath(); ctx.moveTo(dc - 28, dormerY - 2); ctx.lineTo(dc, dormerY - 24); ctx.lineTo(dc + 28, dormerY - 2); ctx.closePath();
        ctx.fillStyle = '#9aabaf'; ctx.fill(); ctx.strokeStyle = '#607680'; ctx.lineWidth = 2.2; ctx.stroke();
        line(ctx, [[dc - 21, dormerY - 3], [dc, dormerY - 18], [dc + 20, dormerY - 3]], '#c1c9bf', 1.4);
      }
      const chimneyX = x + w - 48, chimneyY = roofBack + 19;
      box(ctx, chimneyX, chimneyY - 33, 23, 43, 2, '#b3a48e', '#8b816f', 1.7);
      line(ctx, [[chimneyX + 1, chimneyY - 14], [chimneyX + 22, chimneyY - 14]], '#928876', 1);
      box(ctx, chimneyX - 4, chimneyY - 38, 31, 8, 2, '#c8bda4', '#8b816f', 1.5);

      box(ctx, cx - 80, wallTop + 20, 160, 29, 5, '#f3e6c3', '#a38a62', 1.8);
      icon(ctx, 'bed', cx - 60, wallTop + 34.5, 16, '#879077');
      text(ctx, '작은 쉼표 여관', cx + 8, wallTop + 34.5, 11.5, '#6c6651', 800);
      if (resting) {
        const badgeY = roofBack - 25;
        pill(ctx, `휴식 ${resting}명`, cx, badgeY, { size: 10.5, height: 24, fill: '#f7ecd4', stroke: '#b8ae91', icon: 'bed', color: '#7d7a68' });
      }
      this._hitWorld('station', 'inn', x - 20, roofBack - 10, w + 40, base - roofBack + 19, {
        title: '작은 쉼표 여관', detail: `정착 ${locals.length}/${inn.capacity}명 · 휴식 ${resting}명 · 부상 ${injured}명`
      });
    }

    _actorMotion(key, actor, dt) {
      const x = Number(actor.x || 0) * TILE, y = Number(actor.y || 0) * TILE, previous = this.motion.get(key);
      if (previous && dt <= 0 && previous.x === x && previous.y === y) return previous;
      const dx = previous ? x - previous.x : 0, dy = previous ? y - previous.y : 0;
      const teleport = !previous || Math.hypot(dx, dy) > TILE * 3;
      const animation = global.ForgeNPC ? global.ForgeNPC.advanceMotion(previous && previous.animation, { dx, dy, dt, teleport }) : { moving: !teleport && dt > 0 && Math.hypot(dx, dy) > .01, dx, dy, walkTime: (previous && previous.animation.walkTime || 0) + dt };
      const motion = { x, y, moving: animation.moving, animation }; this.motion.set(key, motion); return motion;
    }

    _drawActor(ctx, renderable, state, now) {
      const r = renderable, a = r.actor, m = r.motion;
      const point = this._worldToScreen(m); if (point.x < -100 || point.x > W + 100 || point.y < -30 || point.y > H + 110) return;
      const staff = r.kind === 'staff', height = staff ? STAFF_HEIGHT : HERO_HEIGHT;
      const hover = this.hover && this.hover.kind === r.kind && this.hover.id === a.id;
      if (hover) ellipse(ctx, m.x, m.y + 1, 21, 7, 'rgba(255,245,195,.3)', '#fff3bd', 1.8);
      const resting = a.status === 'resting', atRest = resting && !a.moving && !(a.path && a.path.length), drawHeight = !staff && atRest ? height * .82 : height;
      const bob = m.moving ? Math.sin(now * 11 + r.order) * 1.15 : 0;
      this._drawSprite(ctx, r.index, m.x, m.y, drawHeight, bob, m.moving, a.status === 'leaving' ? .83 : 1, atRest ? { moving: false } : m.animation);
      const bounds = global.ForgeNPC && global.ForgeNPC.hitBounds(r.index, drawHeight);
      const staffRole = STAFF_ROLE_NAMES[a.role] || '직원';
      const staffSkill = a.role === 'smith' ? '제작 Lv.' + (a.craftLevel || 1) : ['sales','buyer'].includes(a.role) ? '언변 ' + Math.round(a.eloquence ?? a.salesSkill ?? 0) : '손놀림 ' + Math.round(a.dexterity ?? a.craftSkill ?? 0);
      const detail = staff ? `${staffRole} · ${staffSkill} · 체력 ${Math.round(a.stamina || 0)}/${a.maxStamina || 100}` : `Lv.${a.level || 1} · ${STATUS_NAMES[a.status] || '마을에 머무는 중'}`;
      // Staff hover card: what the job is and what it does for the forge, then skill and stamina.
      const card = staff ? { title: (a.name || '직원') + ' · ' + staffRole, lines: (STAFF_ROLE_HELP[a.role] || []).concat([staffSkill + ' · 체력 ' + Math.round(a.stamina || 0) + '/' + (a.maxStamina || 100), STATUS_NAMES[a.status] || '대기 중', '끌어서 다른 자리에 놓으면 담당이 바뀌어요']) } : { title: a.name || '모험가', detail };
      this._hitWorld(r.kind, a.id, m.x + (bounds ? bounds.x : -drawHeight * .35), m.y + (bounds ? bounds.y : -drawHeight), bounds ? bounds.w : drawHeight * .7, bounds ? bounds.h : drawHeight + 7, card);
      let bubble = a.bubble && (a.bubble.until === undefined || a.bubble.until >= (state.time || 0)) ? a.bubble : null;
      if (a.injuryUntil > (state.time || 0)) bubble = { type: 'incapacitated' };
      else if (a.invasionId && ['recalling','defending'].includes(a.status)) bubble = { type: 'combat' };
      else if (staff && a.status === 'training') bubble = { type: 'book' };
      else if (staff && ['working','selling'].includes(a.status)) bubble = bubble || { type: STAFF_WORK_BUBBLES[a.role] || 'hammer' };
      else if (staff && a.status === 'walking' && ['buyer','logistics','enhancer','innkeeper'].includes(a.role)) bubble = bubble || { type: STAFF_WORK_BUBBLES[a.role] };
      else if (a.status === 'enhancing' && a.enhancement && a.enhancement.paid && !a.moving && (this._town.facilities||[]).some(f=>f.id===a.enhancement.facilityId&&f.active)) bubble = { type: 'hammer' };
      else if (resting) bubble = { type: 'bed' };
      if (bubble) this._bubble(ctx, bubble.type, m.x, m.y - drawHeight - 15, now, bubble.material, staff);
      if (hover && staff) {
        box(ctx, m.x - 21, m.y + 6, 42, 5, 2.5, '#e2d4b6');
        box(ctx, m.x - 21, m.y + 6, Math.max(2, 42 * clamp((a.stamina || 0) / (a.maxStamina || 100), 0, 1)), 5, 2.5, '#91a477');
      }
    }

    _itemIcon(id) {
      const src = this.itemIcons && global.ForgeItemIcons && global.ForgeItemIcons.source(id);
      return src ? { image: this.itemIcons, src } : null;
    }

    _bubble(ctx, kind, x, y, now, material, employee) {
      const yy = y + Math.sin(now * 2 + x * .03) * .7;
      const art=global.ForgeArt,definition=!['combat','angry','incapacitated','material'].includes(kind)&&art&&art.bubbles&&art.bubbles[kind],entry=definition&&this.artSheets.get(definition.sheet);
      if(entry&&entry.loaded){const src=definition.source,scale=Math.min(34/src.w,36/src.h),w=src.w*scale,h=src.h*scale;ctx.save();ctx.translate(x,yy);if(kind==='hammer')ctx.rotate(Math.sin(now*8)*.07);ctx.drawImage(entry.image,src.x,src.y,src.w,src.h,-w/2,-h*.58,w,h);ctx.restore();return;}

      ctx.save(); ctx.shadowColor = 'rgba(77,59,41,.10)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      box(ctx, x - 14, yy - 13, 28, 25, 9, '#fffbee', employee ? '#bca783' : '#c6b493', 1.1); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.moveTo(x - 3, yy + 11); ctx.lineTo(x, yy + 16); ctx.lineTo(x + 4, yy + 11); ctx.fillStyle = '#fffbee'; ctx.fill();
      const color = kind === 'bed' ? '#8b8098' : kind === 'material' ? (global.ForgeSim && global.ForgeSim.DATA.materials[material] && global.ForgeSim.DATA.materials[material].color || '#7e9c98') : kind === 'hammer' ? '#ac7b53' : '#a5894c';
      if (kind === 'hammer') { ctx.save(); ctx.translate(x, yy); ctx.rotate(Math.sin(now * 8) * .18); icon(ctx, 'hammer', 0, 0, 16, color); ctx.restore(); }
      else icon(ctx, kind === 'order' ? 'scroll' : kind === 'material' && /wood|timber|wooden|ancient_heart/.test(material || '') ? 'leaf' : kind, x, yy, 17, color);
      ctx.restore();
    }

    _drawSprite(ctx, index, x, y, height, bob, moving, alpha, animation) {
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      shadow(ctx, x, y, height * .25, height * .07, .2);
      if (this._drawStaffSprite(ctx,index,x,y,height,bob,moving,animation)) {ctx.restore();return;}
      const pack = global.ForgeNPC, entry = this.npcSheets.get(index);
      if (pack && entry && entry.loaded) {
        const frame = pack.selectFrame(animation || { moving: !!moving, walkTime: 0, dx: 0, dy: 1 });
        const geometry = pack.frameGeometry({ index, pose: frame.pose, height });
        const s = geometry.source, d = geometry.destination;
        ctx.translate(x, y);
        if (frame.flipX) ctx.scale(-1, 1);
        if (!moving) { const breath = Math.sin(this._time * 2.5 + index * .71); ctx.scale(1 - breath * .006, 1 + breath * .012); }
        // Supplied poses already contain the step. Keep the shared foot pivot fixed;
        // adding the old bob/rotation here would introduce artificial frame jitter.
        ctx.drawImage(entry.image, s.x, s.y, s.w, s.h, d.x, d.y, d.w, d.h);
        ctx.restore(); return;
      }
      const legacyIndex = LEGACY_SPRITES[index] === undefined ? index : LEGACY_SPRITES[index];
      const crop = this.spriteCrops[legacyIndex % 10];
      if (this.charactersLoaded && crop) {
        const width = height * crop.w / crop.h;
        ctx.save(); ctx.translate(x, y + (bob || 0));
        if (!moving) { const breath = Math.sin(this._time * 2.5 + index * .71); ctx.scale(1 - breath * .006, 1 + breath * .012); }
        if (moving) ctx.rotate(Math.sin(this._time * 10 + index) * .018);
        ctx.drawImage(this.characters, crop.x, crop.y, crop.w, crop.h, -width / 2, -height, width, height);
        ctx.restore();
      } else {
        ctx.translate(x, y + (bob || 0));
        if (!moving) { const breath = Math.sin(this._time * 2.5 + index * .71); ctx.scale(1 - breath * .006, 1 + breath * .012); }
        this._fallbackChibi(ctx, legacyIndex, 0, 0, height);
      }
      ctx.restore();
    }

    _fallbackChibi(ctx, index, x, y, height) {
      const hair = ['#719dca', '#775a51', '#e9c78a', '#4e465a', '#b76056', '#b8b4c5', '#94ac91', '#57505d', '#c7869a', '#d3ad70'][index % 10];
      const clothes = ['#e5e6db', '#8b6852', '#62647a', '#6b5779', '#9e7356', '#a3947f', '#8c9b83', '#5d647d', '#66526e', '#a5adb0'][index % 10];
      ctx.save(); ctx.translate(x, y); ctx.scale(height / 96, height / 96);
      ellipse(ctx, -9, -5, 6, 6, '#564740', '#554338', 1.5); ellipse(ctx, 9, -5, 6, 6, '#564740', '#554338', 1.5);
      box(ctx, -18, -38, 36, 31, 10, clothes, '#665146', 2.3);
      ellipse(ctx, -21, -24, 6.5, 11, '#efd0ad', '#665146', 2); ellipse(ctx, 21, -24, 6.5, 11, '#efd0ad', '#665146', 2);
      ellipse(ctx, 0, -62, 31, 31, hair, '#665146', 2.7);
      ellipse(ctx, 0, -54, 26, 22, '#f1d1ad', '#665146', 1.8);
      ctx.beginPath(); ctx.moveTo(-29, -69); ctx.bezierCurveTo(-20, -98, 19, -96, 29, -67); ctx.lineTo(23, -54); ctx.lineTo(12, -65); ctx.lineTo(7, -54); ctx.lineTo(-3, -66); ctx.lineTo(-12, -55); ctx.lineTo(-19, -62); ctx.lineTo(-25, -53); ctx.closePath();
      ctx.fillStyle = hair; ctx.fill(); ctx.strokeStyle = '#665146'; ctx.lineWidth = 2; ctx.stroke();
      ellipse(ctx, -10, -53, 3.4, 4.4, '#443d36'); ellipse(ctx, 10, -53, 3.4, 4.4, '#443d36');
      ellipse(ctx, -17, -46, 4, 2, 'rgba(211,128,115,.28)'); ellipse(ctx, 17, -46, 4, 2, 'rgba(211,128,115,.28)');
      ellipse(ctx, -12, -78, 6, 3.7, 'rgba(255,255,255,.20)'); ellipse(ctx, -1, -81, 4.7, 3.1, 'rgba(255,255,255,.17)');
      if (index === 1) { box(ctx, -13, -35, 26, 25, 3, '#80634f', '#665146', 1.5); box(ctx, -7, -23, 14, 9, 2, '#8d7059', '#665146', 1); }
      if (index === 8) { ctx.beginPath(); ctx.moveTo(-30, -80); ctx.lineTo(-3, -113); ctx.lineTo(23, -77); ctx.closePath(); ctx.fillStyle = '#62506d'; ctx.fill(); ctx.strokeStyle = '#665146'; ctx.lineWidth = 2; ctx.stroke(); ellipse(ctx, 0, -77, 37, 7, '#62506d', '#665146', 2); }
      ctx.restore();
    }



    _placementAtPointer() {
      if (!this.pointer || !this.placement || !this._state || !this._town) return null;
      const p = this._screenToWorld(this.pointer), x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE);
      const sim = global.ForgeSim, defs = sim && sim.DATA && sim.DATA.facilityTypes;
      const def = defs && defs[this.placement.type] || { w: this.placement.type === 'display' ? 3 : 2, h: this.placement.type === 'display' ? 1 : 2 };
      const key = [this._town.id, this._town.width, this._town.height, this.placement.type, this.placement.moveId, x, y, ...(this._town.facilities || []).map(f => `${f.id}:${f.x},${f.y}`)].join('|');
      if (this._placementCheckKey !== key) {
        let result;
        if (sim && sim.canPlaceFacility) result = sim.canPlaceFacility(this._state, this.placement.type, x, y, this.placement.moveId);
        else result = { ok: x >= 0 && y >= 0 && x + def.w <= this._layout.shop.w && y + def.h + 1 < this._layout.shop.h, message: '대장간 바닥 안에 놓아주세요' };
        this._placementCheckKey = key; this._placementCheck = result;
      }
      return { x, y, w: def.w, h: def.h, valid: this._placementCheck === true || this._placementCheck && this._placementCheck.ok, message: this._placementCheck && this._placementCheck.message };
    }
    _drawPlacementGrid(ctx) {
      const s = this.placement.type === 'furnace' && this._layout.workshop ? this._layout.workshop : this._layout.shop;
      const left = s.x * TILE, top = s.y * TILE, w = s.w * TILE, h = s.h * TILE;
      ctx.save(); ctx.beginPath(); ctx.rect(left, top, w, h); ctx.clip();
      ctx.fillStyle = 'rgba(255,250,224,.12)'; ctx.fillRect(left, top, w, h);
      for (let x = 0; x <= s.w; x++) line(ctx, [[left + x * TILE, top], [left + x * TILE, top + h]], 'rgba(82,106,75,.32)', .75);
      for (let y = 0; y <= s.h; y++) line(ctx, [[left, top + y * TILE], [left + w, top + y * TILE]], 'rgba(82,106,75,.32)', .75);
      if (this.placement.type !== 'furnace' && this._layout.counter) {
        const counter = this._layout.counter;
        box(ctx, (counter.x - .05) * TILE, TILE, (counter.w + 1.1) * TILE, TILE * 4, 3, 'rgba(127,102,78,.18)', 'rgba(132,104,70,.34)', 1);
      }
      for (const f of this._town.facilities || []) if (f.id !== this.placement.moveId) {
        box(ctx, f.x * TILE + 1, f.y * TILE + 1, f.w * TILE - 2, f.h * TILE - 2, 3, 'rgba(170,105,78,.12)', 'rgba(154,92,69,.27)', 1);
      }
      ctx.restore();
    }
    _drawPlacementGhost(ctx) {
      const p = this._placementAtPointer(); if (!p) return;
      const color = p.valid ? '#6f9761' : '#be715d';
      box(ctx, p.x * TILE + 1, p.y * TILE + 1, p.w * TILE - 2, p.h * TILE - 2, 4, p.valid ? 'rgba(133,173,105,.22)' : 'rgba(206,112,83,.24)', color, 2);
      const x = (p.x + p.w / 2) * TILE, y = (p.y + p.h) * TILE;
      ctx.save(); ctx.globalAlpha = .63;
      this._drawArt(ctx, this.placement.type, x, y, this.placement.type === 'display' ? 64 : this.placement.type === 'furnace' ? 86 : 78, this.placement.type === 'furnace' ? 111 : this.placement.type === 'display' ? 137 : 76);
      ctx.restore();
      const spot = global.ForgeSim && global.ForgeSim.getFacilityWorkSpot ? global.ForgeSim.getFacilityWorkSpot({ ...p, type: this.placement.type }) : { x: p.x + p.w / 2, y: p.y + p.h + .5 };
      ellipse(ctx, spot.x * TILE, spot.y * TILE, 11, 6, 'rgba(255,251,230,.8)', color, 1.3);
      ellipse(ctx, spot.x * TILE - 3, spot.y * TILE, 2, 3, color); ellipse(ctx, spot.x * TILE + 3, spot.y * TILE, 2, 3, color);
    }

    _worldPath(ctx, points, closed) {
      if(!points.length)return;
      ctx.beginPath();
      if(closed){
        const last=points[points.length-1],first=points[0];ctx.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
        for(let i=0;i<points.length;i++){const p=points[i],next=points[(i+1)%points.length];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);}ctx.closePath();
      }else{
        ctx.moveTo(points[0][0],points[0][1]);
        for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);}const end=points[points.length-1];ctx.lineTo(end[0],end[1]);
      }
    }
    _worldBlob(ctx,x,y,rx,ry,fill,seed) {
      const points=[];for(let i=0;i<14;i++){const a=i*Math.PI*2/14,k=.86+noise(i+(seed||0))*.22;points.push([x+Math.cos(a)*rx*k,y+Math.sin(a)*ry*k]);}
      this._worldPath(ctx,points,true);ctx.fillStyle=fill;ctx.fill();
    }
    _paintMountain(ctx,x,y,size,snowy) {
      ctx.save();ctx.translate(x,y);ctx.scale(size,size);shadow(ctx,0,15,41,12,.055);
      ctx.beginPath();ctx.moveTo(-44,18);ctx.lineTo(-5,-53);ctx.quadraticCurveTo(0,-62,8,-50);ctx.lineTo(49,18);ctx.closePath();ctx.fillStyle=snowy?'#9caaa2':'#aaa58b';ctx.fill();ctx.strokeStyle=snowy?'#84978d':'#8c927b';ctx.lineWidth=1.6;ctx.stroke();
      ctx.beginPath();ctx.moveTo(3,-54);ctx.lineTo(1,17);ctx.lineTo(49,18);ctx.closePath();ctx.fillStyle=snowy?'#b6c3b8':'#c2bca0';ctx.fill();
      if(snowy){ctx.beginPath();ctx.moveTo(3,-54);ctx.lineTo(21,-24);ctx.lineTo(9,-29);ctx.lineTo(1,-18);ctx.lineTo(-9,-28);ctx.lineTo(-20,-17);ctx.closePath();ctx.fillStyle='#e9eee0';ctx.fill();}
      line(ctx,[[-14,-20],[-25,1],[-20,9]],'rgba(242,236,204,.25)',1.8);ctx.restore();
    }
    _createWorldBackdrop(world) {
      const canvas=document.createElement('canvas');canvas.width=world.width;canvas.height=world.height;const ctx=canvas.getContext('2d');
      // The viewport and cached geography share one sea color, so zooming out
      // never reveals a rectangular edge around the overland canvas.
      ctx.fillStyle='#9fc7c8';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let i=0;i<440;i++){
        const x=noise(i*3+61)*world.width,y=noise(i*7+22)*world.height;
        line(ctx,[[x-7,y],[x,y+1.8],[x+8,y]],i%3?'rgba(237,245,222,.17)':'rgba(83,144,157,.12)',1.5);
      }
      // A single coast encloses the connected landmass. Lower sand/rock strokes
      // give its southern edge the gentle cutaway depth of the reference layout.
      ctx.save();ctx.translate(0,16);this._worldPath(ctx,world.coastline,true);ctx.fillStyle='#a2b0a0';ctx.fill();ctx.strokeStyle='#8eb8b4';ctx.lineWidth=26;ctx.stroke();ctx.restore();
      this._worldPath(ctx,world.coastline,true);ctx.strokeStyle='#d5d9b5';ctx.lineWidth=24;ctx.stroke();ctx.fillStyle='#c3d0a0';ctx.fill();ctx.strokeStyle='#c7bd91';ctx.lineWidth=5;ctx.stroke();
      ctx.save();this._worldPath(ctx,world.coastline,true);ctx.clip();
      this._worldBlob(ctx,500,1270,520,400,'#aac58c',14);
      this._worldBlob(ctx,805,905,455,370,'#c4cd9f',29);
      this._worldBlob(ctx,1435,685,440,390,'#d0b994',33);
      this._worldBlob(ctx,1650,750,310,360,'#d8c39c',37);
      this._worldBlob(ctx,1520,195,530,320,'#dce4d5',54);
      this._worldBlob(ctx,1210,340,300,215,'#c8d4bc',62);
      this._worldBlob(ctx,1430,1290,410,280,'#b8c99c',68);
      this._worldBlob(ctx,1840,750,150,165,'#bda794',79);
      for(let i=0;i<1000;i++){
        const x=noise(i*3+18)*world.width,y=noise(i*7+155)*world.height;
        const clear=[...world.towns,...world.locations].some(p=>Math.hypot(p.x-x,p.y-y)<60);if(clear)continue;
        if(i%7===0)ellipse(ctx,x,y,10+noise(i)*21,3+noise(i+2)*6,'rgba(129,156,105,.09)');
        else line(ctx,[[x-2,y+2],[x,y-3],[x+2,y+1],[x+5,y-3]],y<420?'rgba(145,165,144,.13)':x>1260&&y<940?'rgba(165,137,97,.14)':'rgba(128,162,99,.21)',1.1);
      }
      for(const [i,river]of world.rivers.entries()){
        this._worldPath(ctx,river,false);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#a8b99b';ctx.lineWidth=i?28:40;ctx.stroke();ctx.strokeStyle='#bdd8c7';ctx.lineWidth=i?22:32;ctx.stroke();ctx.strokeStyle='#95bfc0';ctx.lineWidth=i?15:24;ctx.stroke();
        ctx.strokeStyle='rgba(235,246,223,.48)';ctx.lineWidth=1.7;ctx.setLineDash([15,22]);ctx.stroke();ctx.setLineDash([]);
      }
      for(const path of world.paths){
        this._worldPath(ctx,path.points,false);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=path.kind==='road'?'#b7a982':'rgba(162,148,112,.48)';ctx.lineWidth=path.kind==='road'?18:10;ctx.stroke();ctx.strokeStyle=path.kind==='road'?'#e3d4ac':'#d3c79f';ctx.lineWidth=path.kind==='road'?13:6;ctx.stroke();
      }
      for(const spine of world.mountainSpines){
        for(let j=0;j<spine.length-1;j++)for(let k=0;k<3;k++){
          const t=k/3,a=spine[j],b=spine[j+1],x=a[0]+(b[0]-a[0])*t+(noise(j*7+k)-.5)*26,y=a[1]+(b[1]-a[1])*t;
          if([...world.towns,...world.locations].some(p=>Math.hypot(p.x-x,p.y-y)<72))continue;
          this._paintMountain(ctx,x,y,.8+noise(j*5+k)*.4,y<460);
        }
      }
      const forestCenters=[[290,1190,150,140],[480,1360,170,110],[715,1300,120,100],[420,690,105,110],[1130,1430,130,90],[1410,300,110,95]];
      for(const [fi,patch]of forestCenters.entries())for(let j=0;j<30;j++){
        const angle=noise(j*7+fi*11)*Math.PI*2,r=Math.sqrt(noise(j*9+fi*15)),x=patch[0]+Math.cos(angle)*patch[2]*r,y=patch[1]+Math.sin(angle)*patch[3]*r;
        if([...world.towns,...world.locations].some(p=>Math.hypot(p.x-x,p.y-y)<64))continue;
        if(fi===5)pine(ctx,x,y,.42+noise(j)*.24,true);else tree(ctx,x,y,.38+noise(j+fi)*.26,fi%2?'#94ad7e':'#88a676');
      }
      for(const bridge of world.bridges){ctx.save();ctx.translate(bridge.x,bridge.y);ctx.rotate(bridge.angle);box(ctx,-30,-13,60,26,3,'#bfa77e','#927b55',1.3);for(let i=0;i<6;i++)line(ctx,[[-25+i*10,-11],[-25+i*10,11]],'#997f57',1);line(ctx,[[-30,-14],[30,-14]],'#cbb78f',4);line(ctx,[[-30,14],[30,14]],'#cbb78f',4);ctx.restore();}
      ctx.restore();
      for(const isle of world.islands||[]){ellipse(ctx,isle.x,isle.y+8,isle.rx+8,isle.ry+5,'#9fb6a4');ellipse(ctx,isle.x,isle.y,isle.rx+8,isle.ry+3,'#ded3ac');ellipse(ctx,isle.x,isle.y-3,isle.rx,isle.ry,'#b5c897','#98b181',1.2);}
      // The island path is a light ferry route; it does not create another map.
      line(ctx,[[1650,1270],[1715,1306],[1780,1350]],'rgba(239,239,208,.65)',3);
      ctx.save();ctx.translate(154,1518);ellipse(ctx,0,0,31,31,null,'rgba(240,238,202,.5)',1.5);line(ctx,[[0,-38],[0,37]],'rgba(240,238,202,.65)',1.6);line(ctx,[[-36,0],[36,0]],'rgba(240,238,202,.65)',1.6);ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(8,4);ctx.lineTo(0,-2);ctx.lineTo(-8,4);ctx.closePath();ctx.fillStyle='#f0edce';ctx.fill();text(ctx,'N',0,-48,13,'#eef0d6',700);ctx.restore();
      return canvas;
    }

    _drawWorldTownLandmark(ctx,town,index,state,now) {
      const x=town.mapX,y=town.mapY,owned=!!state.towns[town.id],focused=this.worldFocusedTownId===town.id;
      ctx.save();ctx.translate(x,y);if(!owned)ctx.globalAlpha=.72;
      if(focused)ellipse(ctx,0,20,75,27,'rgba(255,243,180,.13)','#c6ac6b',1.7);
      const roof=['#ba8466','#8d9caa','#a693ad','#c3a173','#92abb4'][index%5];
      if(town.id==='moonhaven'){
        ellipse(ctx,0,33,74,26,'rgba(151,190,186,.6)');box(ctx,-57,24,112,12,2,'#bea17a','#967a55',1.2);for(let i=0;i<10;i++)line(ctx,[[-52+i*11,25],[-52+i*11,35]],'#a68a62',1);
        ctx.beginPath();ctx.moveTo(48,41);ctx.quadraticCurveTo(67,65,84,40);ctx.closePath();ctx.fillStyle='#ac8962';ctx.fill();ctx.strokeStyle='#876d4f';ctx.lineWidth=1.3;ctx.stroke();line(ctx,[[66,38],[66,7]],'#9a835e',2);ctx.beginPath();ctx.moveTo(67,7);ctx.lineTo(83,31);ctx.lineTo(67,31);ctx.closePath();ctx.fillStyle='#ede2c4';ctx.fill();
      }
      if(town.id==='sunspire'){
        box(ctx,-65,-8,130,42,3,'#c6af86','#a28b66',1.5);
        for(const xx of[-55,55]){box(ctx,xx-12,-36,24,71,3,'#d5c09b','#a28b66',1.5);for(let j=0;j<3;j++)box(ctx,xx-15+j*11,-43,9,13,1,'#dfcba6','#aa916b',1);}
      }
      const smallHouse=(hx,hy,color)=>{box(ctx,hx-20,hy-26,40,35,3,'#d9c6a3','#9a815f',1.2);ctx.beginPath();ctx.moveTo(hx-26,hy-25);ctx.lineTo(hx,hy-49);ctx.lineTo(hx+26,hy-25);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#92795f';ctx.lineWidth=1.3;ctx.stroke();box(ctx,hx-5,hy-8,10,17,2,'#a88a5f','#92795f',.8);};
      if(town.id!=='sunspire'){smallHouse(-45,14,roof);smallHouse(44,9,town.id==='greenwood'?'#a5af8a':roof);}
      shadow(ctx,0,28,43,11,.12);box(ctx,-35,-24,70,56,4,'#e0c99f','#987a56',1.7);box(ctx,-10,6,20,26,3,'#9e7d52','#7e613e',1.3);
      for(const wx of[-27,18]){box(ctx,wx,-9,12,15,2,'#b7c8b3','#9b7e57',1);line(ctx,[[wx+6,-8],[wx+6,5]],'#f0dfb7',1.2);}
      ctx.beginPath();ctx.moveTo(-46,-23);ctx.lineTo(0,-62);ctx.lineTo(46,-23);ctx.closePath();ctx.fillStyle=roof;ctx.fill();ctx.strokeStyle='#8c745c';ctx.lineWidth=1.8;ctx.stroke();
      line(ctx,[[-26,-31],[27,-31]],'rgba(243,216,170,.35)',2);line(ctx,[[-17,-39],[18,-39]],'rgba(243,216,170,.3)',1.6);
      if(town.id==='frostgate'){ctx.beginPath();ctx.moveTo(0,-61);ctx.lineTo(-34,-31);ctx.lineTo(-16,-35);ctx.lineTo(-6,-28);ctx.lineTo(8,-38);ctx.lineTo(21,-29);ctx.lineTo(35,-31);ctx.closePath();ctx.fillStyle='#e5eadd';ctx.fill();pine(ctx,-70,30,.53,true);pine(ctx,71,23,.49,true);}
      if(town.id==='greenwood'){tree(ctx,-76,23,.51);plant(ctx,55,27,.4);}
      if(town.id==='stonebridge'){box(ctx,-60,-62,22,80,2,'#c5c7b2','#989f89',1.2);box(ctx,-65,-68,32,9,1,'#d5d5be','#989f89',1.2);}
      if(owned){icon(ctx,'hammer',0,-23,16,'#ecd4a7');const actual=state.towns[town.id];if((actual.facilities||[]).some(f=>f.type==='furnace'&&f.active))for(let i=0;i<3;i++){const age=(now*12+i*13)%42;ellipse(ctx,22+Math.sin(age/11)*4,-54-age,3+age*.08,3+age*.06,`rgba(249,248,227,${.42*(1-age/42)})`);}}
      ctx.restore();
      this._hitWorld('town',town.id,x-86,y-79,172,126,{title:town.name,detail:worldLevelText(town.recommendedLevel,town.levelRange)+(owned?' · 운영 중인 마을':' · 찾아갈 수 있는 새 마을')});
    }

    // Road centerlines traced in the supplied 1024×678 illustration. Nodes
    // under tree canopies remain connected: foliage is not a collision wall.
    // 2026-11: roads read from the world map picture itself. The illustration is sampled at half size; beige road
    // pixels are cheap to walk, fields cost more, rivers far more (so walkers use the bridges), the sea is closed, and
    // the sandy shore ring is not treated as road. Returns null where canvas pixels are unavailable.
    _worldRoadGrid(){
      if(this.worldRoadGrid!==undefined)return this.worldRoadGrid;
      this.worldRoadGrid=null;
      try{
        if(typeof document==='undefined'||!this.worldMapImage||!this.worldMapLoaded)return null;
        const W2=512,H2=339,c=document.createElement('canvas');c.width=1024;c.height=678;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(this.worldMapImage,0,0,1024,678);
        const d=x.getImageData(0,0,1024,678).data,road=new Uint8Array(W2*H2),water=new Uint8Array(W2*H2);
        const isRoad=(r,g,b)=>r>205&&g>180&&b>120&&b<200&&r-b>35&&r-b<110&&r-g<45&&g-b>15,isWater=(r,g,b)=>b>r+40&&b>g&&r<160;
        for(let y=0;y<H2;y++)for(let X=0;X<W2;X++){let rd=0,wt=0;for(const [ox,oy] of [[0,0],[1,0],[0,1],[1,1]]){const i=((y*2+oy)*1024+X*2+ox)*4,r=d[i],g=d[i+1],b=d[i+2];if(isRoad(r,g,b))rd++;if(isWater(r,g,b))wt++;}const k=y*W2+X;road[k]=rd>0?1:0;water[k]=wt>=3?1:0;}
        // Sea = water connected to the picture edge; anything within 7 cells of it is shore, never road.
        const sea=new Uint8Array(W2*H2),dist=new Int16Array(W2*H2).fill(-1),queue=[];
        for(let X=0;X<W2;X++)for(const y of [0,H2-1]){const k=y*W2+X;if(water[k]&&!sea[k]){sea[k]=1;queue.push(k);}}
        for(let y=0;y<H2;y++)for(const X of [0,W2-1]){const k=y*W2+X;if(water[k]&&!sea[k]){sea[k]=1;queue.push(k);}}
        for(let q=0;q<queue.length;q++){const k=queue[q],X=k%W2,y=(k/W2)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=X+dx,ny=y+dy;if(nx<0||ny<0||nx>=W2||ny>=H2)continue;const n=ny*W2+nx;if(water[n]&&!sea[n]){sea[n]=1;queue.push(n);}}}
        const ring=[];for(let k=0;k<W2*H2;k++)if(sea[k]){dist[k]=0;ring.push(k);}
        for(let q=0;q<ring.length;q++){const k=ring[q];if(dist[k]>=7)continue;const X=k%W2,y=(k/W2)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=X+dx,ny=y+dy;if(nx<0||ny<0||nx>=W2||ny>=H2)continue;const n=ny*W2+nx;if(dist[n]<0){dist[n]=dist[k]+1;ring.push(n);}}}
        const cost=new Float32Array(W2*H2);for(let k=0;k<W2*H2;k++)cost[k]=sea[k]?Infinity:water[k]?60:(road[k]&&dist[k]<0)?1:7;
        this.worldRoadGrid={W:W2,H:H2,cost};
      }catch(_){this.worldRoadGrid=null;}
      return this.worldRoadGrid;
    }
    _pictureRoadRoute(start,end){
      const grid=this._worldRoadGrid();if(!grid)return null;
      const {W:GW,H:GH,cost}=grid,toCell=p=>{const gx=clamp(Math.round((p.x+90)*1024/2300/2),0,GW-1),gy=clamp(Math.round((p.y-30)*678/1660/2),0,GH-1);return gy*GW+gx;},toWorld=k=>({x:(k%GW)*2*2300/1024-90,y:((k/GW)|0)*2*1660/678+30});
      const s=toCell(start),t=toCell(end),best=new Float32Array(GW*GH).fill(Infinity),prev=new Int32Array(GW*GH).fill(-1);
      // Binary-heap Dijkstra over 8 neighbours.
      const heap=[],push=(k,v)=>{heap.push([v,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}},pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
      best[s]=0;push(s,0);const steps=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
      while(heap.length){const [v,k]=pop();if(v>best[k])continue;if(k===t)break;const X=k%GW,y=(k/GW)|0;
        for(const [dx,dy,m] of steps){const nx=X+dx,ny=y+dy;if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const n=ny*GW+nx,c=cost[n];if(c===Infinity)continue;const nv=v+c*m;if(nv<best[n]){best[n]=nv;prev[n]=k;push(n,nv);}}}
      if(!Number.isFinite(best[t]))return null;
      const cells=[];for(let k=t;k!==-1;k=prev[k])cells.unshift(k);
      // Keep every 3rd cell (plus the ends) — smooth enough at map scale.
      const route=[start];for(let i=3;i<cells.length-1;i+=3)route.push(toWorld(cells[i]));route.push(end);
      return route;
    }
    _illustratedRoadRoute(start,end){
      const paths=[
        [[233,500],[270,502],[310,500],[345,494],[370,505],[395,525],[420,538],[455,545],[490,544],[520,541],[548,533],[580,530]],
        [[310,500],[318,485],[326,469],[335,455],[340,440],[337,420],[337,400],[346,383],[365,373]],
        [[365,373],[390,372],[415,376],[438,369],[455,350]],
        [[455,350],[465,367],[468,390],[477,411],[495,424],[520,435],[545,449],[570,465],[580,475],[580,530]],
        [[455,350],[472,330],[486,308],[505,294],[525,284],[548,275],[570,262],[584,246]],
        [[584,246],[610,253],[630,270],[640,294],[640,318],[637,345],[627,370],[612,392],[600,416],[580,440],[570,465]],
        [[584,246],[582,224],[592,207],[615,193],[640,184],[660,182],[678,182]],
        [[678,182],[691,163],[704,143],[716,130],[735,120]],
        [[735,120],[756,118],[778,124],[797,139],[815,145],[835,143],[850,128],[850,98]],
        [[850,98],[865,116],[875,137],[870,157],[872,175]],
        [[872,175],[868,196],[850,207],[830,212],[810,210],[787,205],[765,202],[745,199],[725,197]],
        [[725,197],[710,218],[690,231],[672,245],[653,259],[640,280],[640,294]],
        [[640,318],[657,325],[674,329],[690,327],[708,320],[727,315],[748,315],[770,318],[790,325],[810,325],[835,310],[855,290]],
        [[855,290],[870,304],[879,320],[878,337],[867,352],[853,366],[848,385],[844,405],[835,425],[824,445],[810,457],[792,465],[770,469],[750,469]],
        [[750,469],[730,464],[710,460],[690,460],[675,467],[660,476],[645,481],[625,480],[605,475],[580,475]],
        [[750,469],[746,486],[740,503],[728,518],[710,526],[690,530],[670,533],[650,537],[630,540],[610,538],[580,530]],
        [[750,469],[768,473],[788,480],[808,486],[824,492],[835,505],[835,524],[827,540],[810,545],[790,545]],
        [[790,545],[775,550],[757,554],[740,554],[722,551],[705,547],[690,548],[675,554],[660,558]],
        [[660,558],[646,556],[630,551],[612,548],[595,547],[580,550],[580,530]],
        [[233,500],[220,516],[215,535],[205,548],[186,553],[165,552],[145,548],[125,544]],
        [[233,500],[218,487],[204,476],[190,465],[178,454],[169,445]],
        [[205,548],[220,562],[240,569],[260,568],[280,561],[300,553],[320,551],[340,552],[360,549],[380,542],[395,525]],
        [[365,373],[345,378],[324,380],[304,380],[285,374],[270,370],[255,367]],
        [[255,367],[244,350],[240,334],[246,320],[260,310],[270,294],[270,278],[260,262],[245,252]],
        [[245,252],[264,250],[282,250],[300,250],[320,250],[340,251],[360,250],[380,248],[400,245],[420,243],[440,242],[460,243],[480,242],[500,245],[520,247],[540,250],[560,250],[584,246]],
        [[500,245],[500,226],[497,210],[490,197],[490,183],[502,174],[520,174],[540,176],[560,176],[580,178],[600,180],[620,182],[640,184]],
        [[365,373],[365,350],[374,333],[389,322],[405,313],[420,300],[435,285],[450,271],[470,260],[485,252],[500,245]],
        [[735,120],[724,104],[708,94],[690,88],[673,87],[655,91],[638,99],[620,102],[602,100],[584,94],[568,86],[550,77],[535,68],[520,67],[505,69]],
        [[505,69],[493,79],[483,92],[470,105],[455,115],[438,125],[423,137],[410,152],[400,170],[390,190],[385,210],[380,228],[380,248]]
      ];
      const nodes=[],links=[],index=new Map(),key=p=>p[0]+','+p[1];
      const node=p=>{const k=key(p);if(index.has(k))return index.get(k);const i=nodes.length;nodes.push(p);links.push([]);index.set(k,i);return i;};
      const edge=(a,b,cost)=>{links[a].push([b,cost]);links[b].push([a,cost]);};
      for(const path of paths)for(let i=1;i<path.length;i++){const a=node(path[i-1]),b=node(path[i]);edge(a,b,Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]));}
      const pixel=p=>[(p.x+90)*1024/2300,(p.y-30)*678/1660];
      const attach=p=>{let best=null;const q=pixel(p);for(let a=0;a<nodes.length;a++)for(const [b] of links[a]){if(b<=a)continue;const A=nodes[a],B=nodes[b],dx=B[0]-A[0],dy=B[1]-A[1],t=clamp(((q[0]-A[0])*dx+(q[1]-A[1])*dy)/(dx*dx+dy*dy||1),0,1),v=[A[0]+dx*t,A[1]+dy*t],d=Math.hypot(q[0]-v[0],q[1]-v[1]);if(!best||d<best.d)best={a,b,v,d};}return best;};
      const first=attach(start),last=attach(end);if(!first||!last)return null;
      const source=nodes.length;nodes.push(first.v);links.push([]);edge(source,first.a,Math.hypot(first.v[0]-nodes[first.a][0],first.v[1]-nodes[first.a][1]));edge(source,first.b,Math.hypot(first.v[0]-nodes[first.b][0],first.v[1]-nodes[first.b][1]));
      const target=nodes.length;nodes.push(last.v);links.push([]);edge(target,last.a,Math.hypot(last.v[0]-nodes[last.a][0],last.v[1]-nodes[last.a][1]));edge(target,last.b,Math.hypot(last.v[0]-nodes[last.b][0],last.v[1]-nodes[last.b][1]));
      if(first.a===last.a&&first.b===last.b)edge(source,target,Math.hypot(first.v[0]-last.v[0],first.v[1]-last.v[1]));
      const distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),pending=new Set(nodes.map((_,i)=>i));distance[source]=0;
      while(pending.size){let u=-1;for(const i of pending)if(u<0||distance[i]<distance[u])u=i;if(u===target||!Number.isFinite(distance[u]))break;pending.delete(u);for(const [v,d] of links[u])if(distance[u]+d<distance[v]){distance[v]=distance[u]+d;prev[v]=u;}}
      if(!Number.isFinite(distance[target]))return null;const selected=[];for(let i=target;i!==-1;i=prev[i])selected.unshift(nodes[i]);
      return [start,...selected.map(p=>({x:-90+p[0]*2300/1024,y:30+p[1]*1660/678})),end];
    }
    _worldRoute(townId,regionId,towns,regions){
      const world=global.ForgeWorld&&global.ForgeWorld.WORLD;if(!world)return null;
      const cache=this.worldRouteCache||(this.worldRouteCache=new Map()),cacheKey=(this.worldMapLoaded?'illustrated:':'fallback:')+townId+':'+regionId;if(cache.has(cacheKey))return cache.get(cacheKey);
      const start='region:'+regionId,end='town:'+townId,byKey=new Map([...towns.map(t=>['town:'+t.id,{x:t.mapX,y:t.mapY}]),...regions.map(r=>['region:'+r.id,{x:r.mapX,y:r.mapY}])]);
      // Precomputed road-following routes (dist/world-routes.js) for the illustrated map; the hand-traced network is the fallback.
      {const pre=this.worldMapLoaded&&global.ForgeWorldRoutes&&global.ForgeWorldRoutes[townId+'|'+regionId];if(pre&&byKey.has(start)&&byKey.has(end)){const route=[byKey.get(start),...pre.slice(1,-1).map(([x,y])=>({x,y})),byKey.get(end)];cache.set(cacheKey,route);return route;}}
      if(this.worldMapLoaded&&byKey.has(start)&&byKey.has(end)){const route=this._illustratedRoadRoute(byKey.get(start),byKey.get(end));cache.set(cacheKey,route);return route;}
      const queue=[start],previous=new Map([[start,null]]);
      while(queue.length&&!previous.has(end)){const key=queue.shift();for(const edge of world.paths){const next=edge.from===key?edge.to:edge.to===key?edge.from:null;if(next&&!previous.has(next)&&byKey.has(next)){previous.set(next,{key,edge,reverse:edge.to===key});queue.push(next);}}}
      if(!previous.has(end)){cache.set(cacheKey,null);return null;}const steps=[];for(let at=end;at!==start;){const step=previous.get(at);steps.unshift({from:step.key,to:at,edge:step.edge,reverse:step.reverse});at=step.key;}
      const result=[];for(const step of steps){const raw=step.reverse?[...step.edge.points].reverse():step.edge.points,a=raw[0],b=raw.at(-1),A=byKey.get(step.from),B=byKey.get(step.to),dx=b[0]-a[0],dy=b[1]-a[1],norm=dx*dx+dy*dy||1,X=B.x-A.x,Y=B.y-A.y;
        raw.forEach((p,i)=>{const px=p[0]-a[0],py=p[1]-a[1],along=(px*dx+py*dy)/norm,side=(py*dx-px*dy)/norm;const v={x:A.x+along*X-side*Y,y:A.y+along*Y+side*X};if(!result.length||i>0)result.push(v);});}
      const route=result.length>1?result:null;cache.set(cacheKey,route);return route;
    }
    static pointOnWorldRoute(points,progress){
      if(!points||points.length<2)return null;const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y)),total=lengths.reduce((a,b)=>a+b,0);let distance=clamp(progress,0,1)*total;
      for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const t=lengths[i]?distance/lengths[i]:0;return {x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}distance-=lengths[i];}return points.at(-1);
    }

    // A puffy cartoon cloud, drawn once to an offscreen canvas (white top, soft blue-grey underside, thin outline).
    _cloudSprite(variant) {
      if(!this._cloudSprites)this._cloudSprites=[];
      if(this._cloudSprites[variant])return this._cloudSprites[variant];
      if(typeof document==='undefined')return null;
      const c=document.createElement('canvas');c.width=420;c.height=260;const g=c.getContext('2d');
      const shapes=[
        [[110,170,70],[175,130,85],[255,120,80],[320,160,64],[215,180,78],[150,190,58],[290,192,55]],
        [[95,175,58],[150,135,72],[225,110,86],[300,140,70],[345,182,48],[250,188,70],[170,195,60]],
        [[120,160,66],[190,118,74],[265,135,78],[330,175,52],[220,190,70],[140,195,52]]
      ][variant%3];
      const blob=(dx,dy,grow)=>{g.beginPath();for(const [x,y,r] of shapes){g.moveTo(x+dx+r+grow,y+dy);g.arc(x+dx,y+dy,r+grow,0,Math.PI*2);}};
      g.fillStyle='rgba(122,132,150,.45)';blob(0,0,4);g.fill();          // outline halo
      g.fillStyle='#cfd8e6';blob(0,6,0);g.fill();                       // shaded underside
      g.fillStyle='#fbfcff';blob(0,-4,-4);g.fill();                      // bright top
      g.fillStyle='rgba(255,255,255,.75)';for(const [x,y,r] of shapes.slice(0,3)){g.beginPath();g.arc(x-r*.25,y-r*.35,r*.35,0,Math.PI*2);g.fill();}
      this._cloudSprites[variant]=c;return c;
    }
    // Dark silhouettes of the six painted clouds (their shadows on the map), made once.
    _paintedCloudShadow(cell) {
      if(!this._cloudShadows){
        if(typeof document==='undefined')return null;
        const c=document.createElement('canvas');c.width=1536;c.height=512;const g=c.getContext('2d');
        g.drawImage(this.worldCloudArt,0,0,1536,512);g.globalCompositeOperation='source-in';g.fillStyle='rgb(36,52,76)';g.fillRect(0,0,1536,512);
        this._cloudShadows=c;
      }
      return this._cloudShadows;
    }
    // Painted fog of war: the towns beyond the next one sit under piles of drifting clouds (with soft shadows and a pale
    // fog filling the gaps); the next town and its hunting grounds get a thin mist the map shows through.
    // Clouds stay inside the map picture (drawn at -90, 30, 2300 x 1660 in map coordinates); nothing spills onto the margin.
    _drawPaintedClouds(ctx,towns,regions,nextTownId,hiddenTowns,now) {
      ctx.save();if(this.worldMapLoaded){ctx.beginPath();ctx.rect(-90,30,2300,1660);ctx.clip();}
      try{this._drawPaintedCloudLayers(ctx,towns,regions,nextTownId,hiddenTowns,now);}finally{ctx.restore();}
    }
    _drawPaintedCloudLayers(ctx,towns,regions,nextTownId,hiddenTowns,now) {
      // keep: open towns and their hunting grounds — fully clear. The next town is NOT clear: it sits under a pale fog
      // you can see through (its town picture a little clearer), so it reads as "not yet yours, but the next goal".
      // A town opened a moment ago is "revealing": the clouds that covered it slide outward and fade over REVEAL seconds.
      const REVEAL=2.4,revealT=id=>{const at=this._revealAt&&this._revealAt[id];if(at==null)return 1;return Math.max(0,(now-at)/REVEAL);};
      const spots=[],keep=[],nextSpots=[],revealSpots=[];
      for(const town of towns){
        const hidden=hiddenTowns.has(town.id),next=town.id===nextTownId,t=revealT(town.id);
        const own=[{x:town.mapX,y:town.mapY,town:true},...regions.filter(r=>r.townId===town.id).map(r=>({x:r.mapX,y:r.mapY,town:false}))];
        if(hidden)for(const s of own)spots.push({...s,hidden:true});
        else if(next)for(const s of own){spots.push({...s,hidden:false});nextSpots.push(s);}
        else if(t<1)for(const s of own)revealSpots.push({...s,t,cx:town.mapX,cy:town.mapY});
        else for(const s of own)keep.push({x:s.x,y:s.y,r:s.town?180:115});
      }
      const hiddenSpots=spots.filter(s=>s.hidden);
      const ease=t=>{const c=Math.max(0,Math.min(1,t));return c*c*(3-2*c);};
      // 1) Fog base on its own layer: thick over hidden towns, pale over the next town; soft holes around open towns.
      if((hiddenSpots.length||nextSpots.length||revealSpots.length)&&typeof document!=='undefined'&&ctx.getTransform){
        const canvas=ctx.canvas;
        if(!this._cloudLayer||this._cloudLayer.width!==canvas.width||this._cloudLayer.height!==canvas.height){this._cloudLayer=document.createElement('canvas');this._cloudLayer.width=canvas.width;this._cloudLayer.height=canvas.height;}
        const layer=this._cloudLayer,lc=layer.getContext('2d'),m=ctx.getTransform();
        lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,layer.width,layer.height);lc.setTransform(m);
        for(const s of hiddenSpots){const base=lc.createRadialGradient(s.x,s.y,60,s.x,s.y,250);base.addColorStop(0,'rgba(224,233,246,.96)');base.addColorStop(.7,'rgba(224,233,246,.88)');base.addColorStop(1,'rgba(224,233,246,0)');lc.fillStyle=base;lc.fillRect(s.x-250,s.y-250,500,500);}
        // Pale fog over the next town: patches are merged on their own layer first (overlaps saturate instead of
        // getting denser), then laid down at one even strength.
        if(nextSpots.length){
          if(!this._veilLayer||this._veilLayer.width!==canvas.width||this._veilLayer.height!==canvas.height){this._veilLayer=document.createElement('canvas');this._veilLayer.width=canvas.width;this._veilLayer.height=canvas.height;}
          const vc=this._veilLayer.getContext('2d');vc.setTransform(1,0,0,1,0,0);vc.clearRect(0,0,canvas.width,canvas.height);vc.setTransform(m);
          for(const s of nextSpots){const r=s.town?260:250,g=vc.createRadialGradient(s.x,s.y,r*.6,s.x,s.y,r);g.addColorStop(0,'rgba(232,238,248,1)');g.addColorStop(1,'rgba(232,238,248,0)');vc.fillStyle=g;vc.fillRect(s.x-r,s.y-r,r*2,r*2);}
          lc.save();lc.setTransform(1,0,0,1,0,0);lc.globalAlpha=.7;lc.drawImage(this._veilLayer,0,0);lc.restore();
        }
        // The pale fog over a just-opened town fades away with its clouds.
        if(revealSpots.length){
          if(!this._veilLayer||this._veilLayer.width!==canvas.width||this._veilLayer.height!==canvas.height){this._veilLayer=document.createElement('canvas');this._veilLayer.width=canvas.width;this._veilLayer.height=canvas.height;}
          const vc=this._veilLayer.getContext('2d');vc.setTransform(1,0,0,1,0,0);vc.clearRect(0,0,canvas.width,canvas.height);vc.setTransform(m);
          for(const s of revealSpots){const r=s.town?260:250,g=vc.createRadialGradient(s.x,s.y,r*.6,s.x,s.y,r);g.addColorStop(0,'rgba(232,238,248,1)');g.addColorStop(1,'rgba(232,238,248,0)');vc.fillStyle=g;vc.fillRect(s.x-r,s.y-r,r*2,r*2);}
          lc.save();lc.setTransform(1,0,0,1,0,0);lc.globalAlpha=.7*(1-ease(revealSpots[0].t));lc.drawImage(this._veilLayer,0,0);lc.restore();
        }
        lc.globalCompositeOperation='destination-out';
        for(const k of keep){const hole=lc.createRadialGradient(k.x,k.y,k.r*.45,k.x,k.y,k.r);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(1,'rgba(0,0,0,0)');lc.fillStyle=hole;lc.fillRect(k.x-k.r,k.y-k.r,k.r*2,k.r*2);}
        // The next town's own picture shows a little clearer through its fog (so it can be spotted and clicked).
        for(const s of nextSpots)if(s.town){const hole=lc.createRadialGradient(s.x,s.y,20,s.x,s.y,95);hole.addColorStop(0,'rgba(0,0,0,.55)');hole.addColorStop(1,'rgba(0,0,0,0)');lc.fillStyle=hole;lc.fillRect(s.x-95,s.y-95,190,190);}
        lc.globalCompositeOperation='source-over';
        ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);ctx.restore();
      }
      // 2) The next town's mist goes on first, so the clouds sit on top of it (never mist in front of a cloud).
      const mist=this.worldMistArtLoaded?this.worldMistArt:null;
      if(mist)nextSpots.forEach((s,i)=>{if(s.town)return;const drift=Math.sin(now*.07+i*1.9)*12;ctx.save();ctx.globalAlpha=.45;ctx.drawImage(mist,s.x-170+drift,s.y-105,340,210);ctx.restore();});
      if(mist)revealSpots.forEach((s,i)=>{if(s.town)return;const e=ease(s.t);ctx.save();ctx.globalAlpha=.45*(1-e);ctx.drawImage(mist,s.x-170,s.y-105,340,210);ctx.restore();});
      // 3) Clouds laid out on an even staggered grid over the area to hide, so there are no empty patches in the middle.
      //    Thick and full over towns beyond the next one; thinner and sparser over the next town's hunting grounds,
      //    with a gap over the next town itself. Never over an open town.
      const near=(x,y,extra)=>keep.some(k=>Math.hypot(k.x-x,k.y-y)<k.r+extra);
      const nextTown=nextSpots.find(s=>s.town);
      const distTo=(list,x,y)=>list.reduce((m,s)=>Math.min(m,Math.hypot(s.x-x,s.y-y)),Infinity);
      const area=[...hiddenSpots,...nextSpots,...revealSpots];
      const puffs=[];
      if(area.length){
        const minX=Math.min(...area.map(s=>s.x))-200,maxX=Math.max(...area.map(s=>s.x))+200,minY=Math.min(...area.map(s=>s.y))-160,maxY=Math.max(...area.map(s=>s.y))+160;
        const stepX=190,stepY=115;let row=0;
        for(let gy=minY;gy<=maxY;gy+=stepY,row++){for(let gx=minX+(row%2?stepX/2:0);gx<=maxX;gx+=stepX){
          const seed=Math.sin(gx*.0137+gy*.0291)*43758.5453,rnd=seed-Math.floor(seed),rnd2=(seed*7.13)-Math.floor(seed*7.13),rnd3=(seed*3.97)-Math.floor(seed*3.97);
          const x=gx+(rnd-.5)*70,y=gy+(rnd2-.5)*50;
          const dHidden=distTo(hiddenSpots,x,y),dNext=distTo(nextSpots,x,y),dReveal=distTo(revealSpots,x,y);
          // Clouds of a just-opened town: the same thin layout it had as the next town, now sliding outward and fading.
          if(dReveal<200&&dReveal<dHidden&&dReveal<=dNext){
            if(rnd3<.35)continue;
            const s=revealSpots.reduce((b,r)=>Math.hypot(r.x-x,r.y-y)<Math.hypot(b.x-x,b.y-y)?r:b,revealSpots[0]);
            if(Math.hypot(s.cx-x,s.cy-y)<150)continue;
            const e=ease(s.t),dx=x-s.cx,dy=y-s.cy,len=Math.hypot(dx,dy)||1,push=e*560;
            puffs.push({x:x+dx/len*push,y:y+dy/len*push*.8,cell:Math.floor(rnd3*5)%5,scale:(.68+rnd2*.22)*(1+e*.25),drift:0,bob:0,flip:rnd>.5,alpha:.88*(1-e)});
            continue;
          }
          const thick=dHidden<230&&dHidden<=dNext,thin=!thick&&dNext<200;
          if(!thick&&!thin)continue;
          if(near(x,y,thick?70:45))continue;
          if(nextTown&&Math.hypot(nextTown.x-x,nextTown.y-y)<(thick?120:150))continue;
          if(thin&&rnd3<.35)continue; // sparser over the next town
          puffs.push({x,y,cell:Math.floor(rnd3*5)%5,scale:thick?.9+rnd2*.35:.68+rnd2*.22,drift:Math.sin(now*.06+gx*.01+gy*.02)*16,bob:Math.cos(now*.05+gx*.013)*4,flip:rnd>.5,alpha:thick?1:.88});
        }}
      }
      puffs.sort((a,b)=>a.y-b.y);
      const shadow=this._paintedCloudShadow();
      for(const p of puffs){
        if(p.alpha<=.01)continue;
        const w=512*p.scale,h=256*p.scale,sx=(p.cell%3)*512,sy=Math.floor(p.cell/3)*256,x=p.x+p.drift-w/2,y=p.y+p.bob-h/2;
        if(shadow){ctx.save();ctx.globalAlpha=.16*p.alpha;ctx.drawImage(shadow,sx,sy,512,256,x+22,y+34,w,h);ctx.restore();}
        ctx.save();ctx.globalAlpha=p.alpha;if(p.flip){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(this.worldCloudArt,sx,sy,512,256,0,0,w,h);}else ctx.drawImage(this.worldCloudArt,sx,sy,512,256,x,y,w,h);ctx.restore();
      }
      // 4) Thin wisps at the edge of the next town's gap (on top, they are clouds too).
      for(const s of revealSpots)if(s.town){const e=ease(s.t),gap=e*300;ctx.save();ctx.globalAlpha=.75*(1-e);ctx.drawImage(this.worldCloudArt,1024,256,512,256,s.x-230-gap,s.y+30+gap*.3,250,125);ctx.drawImage(this.worldCloudArt,1024,256,512,256,s.x+40+gap,s.y-150-gap*.3,220,110);ctx.restore();}
      if(nextTown){const drift=Math.sin(now*.07)*12;ctx.save();ctx.globalAlpha=.75;ctx.drawImage(this.worldCloudArt,1024,256,512,256,nextTown.x-230+drift,nextTown.y+30,250,125);ctx.drawImage(this.worldCloudArt,1024,256,512,256,nextTown.x+40-drift,nextTown.y-150,220,110);ctx.restore();}
    }
    _drawWorldClouds(ctx,towns,regions,nextTownId,hiddenTowns,now) {
      if(this.worldCloudArtLoaded){this._drawPaintedClouds(ctx,towns,regions,nextTownId,hiddenTowns,now);return;}
      const spots=[];
      for(const town of towns){
        const hidden=hiddenTowns.has(town.id),next=town.id===nextTownId;if(!hidden&&!next)continue;
        spots.push({x:town.mapX,y:town.mapY,hidden,town:true});
        for(const r of regions)if(r.townId===town.id)spots.push({x:r.mapX,y:r.mapY,hidden,town:false});
      }
      // Thick cover goes on its own layer: a soft white base so nothing shows between the puffs, drifting clouds on top,
      // then soft holes cut around every open town and the next town (with their hunting grounds) so they stay visible.
      const canvas=ctx.canvas,hiddenSpots=spots.filter(s=>s.hidden);
      if(hiddenSpots.length&&typeof document!=='undefined'&&ctx.getTransform){
        if(!this._cloudLayer||this._cloudLayer.width!==canvas.width||this._cloudLayer.height!==canvas.height){this._cloudLayer=document.createElement('canvas');this._cloudLayer.width=canvas.width;this._cloudLayer.height=canvas.height;}
        const layer=this._cloudLayer,lc=layer.getContext('2d'),m=ctx.getTransform();
        lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,layer.width,layer.height);lc.setTransform(m);
        for(const s of hiddenSpots){const base=lc.createRadialGradient(s.x,s.y,40,s.x,s.y,260);base.addColorStop(0,'rgba(236,241,248,.97)');base.addColorStop(.7,'rgba(236,241,248,.9)');base.addColorStop(1,'rgba(236,241,248,0)');lc.fillStyle=base;lc.fillRect(s.x-260,s.y-260,520,520);}
        spots.forEach((s,i)=>{if(!s.hidden)return;const sprite=this._cloudSprite(i);if(!sprite)return;const drift=Math.sin(now*.12+i*1.7)*14,bob=Math.cos(now*.09+i)*5;
          for(const [ox,oy,scale] of [[-60,-30,.95],[70,10,.85],[-10,60,.8]])lc.drawImage(sprite,s.x+ox+drift-210*scale,s.y+oy+bob-130*scale,420*scale,260*scale);});
        lc.globalCompositeOperation='destination-out';
        const keep=[];for(const t of towns)if(!hiddenTowns.has(t.id)){keep.push({x:t.mapX,y:t.mapY,r:190});for(const r of regions)if(r.townId===t.id)keep.push({x:r.mapX,y:r.mapY,r:120});}
        for(const k of keep){const hole=lc.createRadialGradient(k.x,k.y,k.r*.45,k.x,k.y,k.r);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(1,'rgba(0,0,0,0)');lc.fillStyle=hole;lc.fillRect(k.x-k.r,k.y-k.r,k.r*2,k.r*2);}
        lc.globalCompositeOperation='source-over';
        ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);ctx.restore();
      }
      spots.forEach((s,i)=>{
        const sprite=this._cloudSprite(i);if(!sprite)return;
        const drift=Math.sin(now*.12+i*1.7)*14,bob=Math.cos(now*.09+i)*5;
        if(s.hidden){
          return;
        }else if(!s.town){
          // The next town's hunting grounds: a thin veil, the picture still shows through.
          ctx.globalAlpha=.42;ctx.drawImage(sprite,s.x+drift-130,s.y+bob-80,260,160);
        }else{
          // Around the next town itself: wisps at the edges only, the town stays clear.
          ctx.globalAlpha=.55;ctx.drawImage(sprite,s.x-170+drift,s.y+20+bob,200,124);ctx.drawImage(sprite,s.x+10-drift,s.y-120+bob,180,111);
        }
        ctx.globalAlpha=1;
      });
    }
    _drawWorld(ctx,state,now,dt) {
      const world=global.ForgeWorld&&global.ForgeWorld.WORLD,sim=global.ForgeSim,data=sim&&sim.DATA;
      if(!world||!data){text(ctx,'세계 지도를 준비하고 있어요',W/2,H/2,16,C.ink,700);return;}
      if(!this.worldCameraInitialized)this.focusTown(state.activeTownId);
      if(!this.worldBackdrop)this.worldBackdrop=this._createWorldBackdrop(world);
      const camera=this.worldCamera;ctx.fillStyle='#9fc7c8';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(W/2-camera.x*camera.zoom,H/2-camera.y*camera.zoom);ctx.scale(camera.zoom,camera.zoom);if(this.worldMapLoaded)ctx.drawImage(this.worldMapImage,-90,30,2300,1660);else ctx.drawImage(this.worldBackdrop,0,0);
      const towns=data.towns.map(t=>{const p=this._illustratedPoint(t.id,t.mapX,t.mapY);return {...t,mapX:p.x,mapY:p.y};});
      const regions=data.regions.map(r=>{const p=this._illustratedPoint(r.townId,r.mapX,r.mapY,r.id);return {...r,mapX:p.x,mapY:p.y};});
      const heroes=state.adventurers||[],labels=[];
      // 2026-11 fog of war: the next town to open stays visible under a thin mist (so it can be clicked and aimed for);
      // towns beyond it, with their hunting grounds, are hidden under thick clouds (no labels, no clicks).
      const nextTownId=(data.towns.find(t=>!state.towns[t.id])||{}).id||null;
      const hiddenTowns=new Set(data.towns.filter(t=>!state.towns[t.id]&&t.id!==nextTownId).map(t=>t.id));
      // The next town shows only itself (its hunting grounds and bosses stay under the clouds until it is opened).
      const isHidden=node=>node.kind==='town'?hiddenTowns.has(node.record.id):(hiddenTowns.has(node.record.townId)||node.record.townId===nextTownId);
      // A town that has just been opened: its clouds part over a couple of seconds (see _drawPaintedCloudLayers).
      if(!this._knownTowns){this._knownTowns=new Set(Object.keys(state.towns||{}));this._revealAt={};}
      for(const id of Object.keys(state.towns||{}))if(!this._knownTowns.has(id)){this._knownTowns.add(id);this._revealAt[id]=now;}
      const sceneNodes=[...regions.map(r=>({kind:'region',record:r,y:r.mapY})),...towns.map(t=>({kind:'town',record:t,y:t.mapY}))].sort((a,b)=>a.y-b.y).filter(node=>!isHidden(node));
      for(const node of sceneNodes){
        const location=node.record,x=location.mapX,y=location.mapY,point=this._worldToScreen({x,y}),visible=point.x>-130&&point.x<W+130&&point.y>-110&&point.y<H+130;
        if(node.kind==='town'){
          if(visible&&!this.worldMapLoaded)this._drawWorldTownLandmark(ctx,location,towns.indexOf(location),state,now);
          else { this._hitWorld('town',location.id,x-(this.worldMapLoaded?50:86),y-(this.worldMapLoaded?60:79),this.worldMapLoaded?100:172,this.worldMapLoaded?95:126,{title:location.name,detail:worldLevelText(location.recommendedLevel,location.levelRange)}); }
        }else{
          if(visible&&!this.worldMapLoaded){ctx.save();ctx.translate(x,y);ctx.scale(.69,.69);this._regionArt(ctx,this._biomeArt(location.biome),0,0,true,now);ctx.restore();}
          this._hitWorld('region',location.id,x-(this.worldMapLoaded?28:66),y-(this.worldMapLoaded?28:57),this.worldMapLoaded?56:132,this.worldMapLoaded?56:111,{title:location.name,detail:`권장 Lv.${location.recommendedLevel||1}`});
        }
        labels.push({kind:node.kind,id:location.id,name:location.name,level:location.recommendedLevel||1,levelRange:node.kind==='town'?location.levelRange:null,x,y:y+(this.worldMapLoaded?(node.kind==='town'?35:16):(node.kind==='town'?62:54)),focused:node.kind==='town'&&this.worldFocusedTownId===location.id,owned:!!state.towns[node.kind==='town'?location.id:location.townId]});
      }
      // Combat stays an overland symbol: no separate battle scene is created.
      // During the first part of an actual hunt, animate its departure along
      // the location graph. This is labeled as an illustration of hunting,
      // and does not delay or change the simulation's hunt timer.
      // 2026-11: the trip out is shown while the hero walks the road from the forge door to the town exit (the same
      // ~4.5 s stretch the village picture shows), exactly like the trip back; once out, they stand at the region.
      const travelingHunts=new Set();
      if(camera.zoom>=.48)for(const [i,a] of heroes.filter(h=>h.status==='departing'&&!h.invasionId&&!h.raidId&&h.regionId).entries()){
        const town=towns.find(t=>t.id===a.townId),region=regions.find(r=>r.id===a.regionId);if(!town||!region)continue;
        const layout=sim.getTownLayout(state,town.id);if(!layout)continue;
        const road=layout.entrance.y+1,progress=clamp((a.y-road)/Math.max(1,layout.exit.y-road),0,1);if(progress<=0)continue;
        const route=this._worldRoute(town.id,region.id,towns,regions),pos=ForgeScene.pointOnWorldRoute(route,1-progress);if(!pos)continue;
        travelingHunts.add(a.id);const p=this._worldToScreen(pos);if(p.x>-50&&p.x<W+50&&p.y>-50&&p.y<H+50)this._drawMapHero(ctx,a,pos.x,pos.y+(this.worldMapLoaded?0:25),27,now,dt,i,'사냥터로 이동 중');
      }
      if(camera.zoom>=.48)for(const region of regions){
        const group=heroes.filter(a=>a.status==='hunting'&&a.regionId===region.id&&!a.invasionId&&!travelingHunts.has(a.id));if(!group.length)continue;
        const point=this._worldToScreen({x:region.mapX,y:region.mapY});if(point.x<-80||point.x>W+80||point.y<-80||point.y>H+80)continue;
        const displayed=group.slice(0,3);displayed.forEach((a,i)=>this._drawMapHero(ctx,a,region.mapX+(i-(displayed.length-1)/2)*27,region.mapY+34,31,now,dt,i));
      }
      if(camera.zoom>=.48)for(const [i,a]of heroes.filter(a=>a.status==='returning'&&!a.invasionId).slice(0,25).entries()){
        const region=regions.find(r=>r.id===a.regionId),town=towns.find(t=>t.id===a.townId);if(!region||!town)continue;
        const layout=sim.getTownLayout(state,town.id);if(!layout)continue;
        const road=layout.entrance.y+1,progress=clamp((layout.exit.y-a.y)/Math.max(1,layout.exit.y-road),0,1),route=this._worldRoute(town.id,region.id,towns,regions),position=ForgeScene.pointOnWorldRoute(route,progress)||{x:town.mapX,y:town.mapY};
        const x=position.x,y=position.y+(this.worldMapLoaded?0:25);
        const p=this._worldToScreen({x,y});if(p.x>-50&&p.x<W+50&&p.y>-50&&p.y<H+50)this._drawMapHero(ctx,a,x,y,27,now,dt,i);
      }
      if(sim.getInvasion)for(const town of towns){const event=sim.getInvasion(state,town.id);if(event&&['recalling','battle','recovery'].includes(event.status))this._drawEncounter(ctx,event,town.mapX+64,town.mapY+30,state,now,1);}
      this._drawWorldClouds(ctx,towns,regions,nextTownId,hiddenTowns,now);
      for(const boss of ForgeScene.getWorldBosses(state)){if(hiddenTowns.has(boss.townId)||boss.townId===nextTownId)continue;const point=this._illustratedPoint(boss.townId,boss.mapX,boss.mapY,boss.regionId);labels.push({kind:'boss',id:boss.id,name:(boss.worldBoss?'월드 보스 · ':'보스 · ')+boss.name,detail:boss.statusText,x:point.x,y:point.y-85,anchorX:point.x,anchorY:point.y,boss,owned:boss.worldTownOpened});}
      ctx.restore();this._drawWorldLabels(ctx,labels);
    }
    _biomeArt(biome) {
      return ({forest:0,meadow:9,road:10,quarry:1,mine:1,mountain:3,snowmountain:3,wetland:11,ruins:2,labyrinth:12,fortress:8,coast:5,canyon:13,desert:6,wasteland:14,oasis:15,snow:16,icefortress:8,astral:17,volcano:7,snowforest:18,icelabyrinth:12,cave:4})[biome]||0;
    }
    _drawWorldLabels(ctx,labels) {
      const used=this.hitTargets.filter(h=>h.kind==='incident').map(h=>({x:h.x,y:h.y,w:h.w,h:h.h})),placed=[],bossHits=[],zoom=this.worldCamera.zoom;
      const priority=label=>label.kind==='boss'?(label.boss.worldBoss?7:6):label.focused?4:label.kind==='town'?3:1;
      for(const label of [...labels].sort((a,b)=>priority(b)-priority(a))){
        const isBoss=label.kind==='boss',p=this._worldToScreen(label),anchor=isBoss?this._worldToScreen({x:label.anchorX,y:label.anchorY}):p;
        if(anchor.x<-100||anchor.x>W+100||anchor.y<-55||anchor.y>H+55)continue;
        if(label.kind==='region'){
          const detail=worldLevelText(label.level,label.levelRange);
          const hit={kind:'region',id:label.id,x:p.x-13,y:p.y-13,w:26,h:26,title:label.name,detail};
          this.hitTargets.push(hit);placed.push(hit);
          ellipse(ctx,p.x,p.y,11,11,'rgba(255,247,225,.88)');
          ellipse(ctx,p.x,p.y-2,6.5,6,'#514b3d');
          box(ctx,p.x-4,p.y+1,8,5,1,'#514b3d');
          ellipse(ctx,p.x-2.7,p.y-2,1.2,1.5,'#fff7e1');
          ellipse(ctx,p.x+2.7,p.y-2,1.2,1.5,'#fff7e1');
          line(ctx,[[p.x-2,p.y+3],[p.x-2,p.y+5]],'#fff7e1',.8);
          line(ctx,[[p.x+1,p.y+3],[p.x+1,p.y+5]],'#fff7e1',.8);
          if(this.hover&&this.hover.kind==='region'&&this.hover.id===label.id){
            ctx.font=`700 11px ${FONT}`;const width=Math.max(72,ctx.measureText(label.name).width+18),x=clamp(p.x-width/2,4,W-width-4),y=clamp(p.y-49,4,H-35);
            box(ctx,x,y,width,32,5,'rgba(250,247,225,.97)','#938666',1);
            text(ctx,label.name,x+width/2,y+10,11,'#464a38',700);
            text(ctx,detail,x+width/2,y+24,9,'#625944',600);
          }
          continue;
        }
        const font=isBoss?(zoom<.5?10:11):label.kind==='town'?(zoom<.5?10.5:11.5):(zoom<.5?9:10.5);
        const detail=isBoss?label.detail:worldLevelText(label.level,label.levelRange),detailFont=isBoss?(zoom<.5?9:9.5):(zoom<.5?8:8.8),iconSpace=isBoss?34:0;
        ctx.font=`700 ${font}px ${FONT}`;const nameWidth=ctx.measureText(label.name).width;
        ctx.font=`600 ${detailFont}px ${FONT}`;const detailWidth=ctx.measureText(detail).width;
        const width=Math.max(54,Math.ceil(Math.max(nameWidth,detailWidth)+16+iconSpace)),height=isBoss?36:zoom<.5?27:30;
        const candidates=isBoss?
          [{x:p.x-width/2,y:p.y-height},{x:p.x+18,y:p.y-height/2},{x:p.x-width-18,y:p.y-height/2},{x:p.x-width/2,y:p.y+16}]:
          [{x:p.x-width/2,y:p.y-5},{x:p.x-width/2,y:p.y-9-height-61*zoom},{x:p.x+24*zoom,y:p.y-12},{x:p.x-width-24*zoom,y:p.y-12}];
        if(isBoss||label.kind==='town')for(const dy of[-42,42,-84,84,-126,126])for(const dx of[0,-48,48,-96,96])candidates.push({x:p.x-width/2+dx,y:p.y-height+dy});
        const fits=r=>r.x>=4&&r.x+width<=W-4&&r.y>=4&&r.y+height<=H-4&&!used.some(u=>r.x<u.x+u.w+3&&r.x+width+3>u.x&&r.y<u.y+u.h+2&&r.y+height+2>u.y);
        let boxRect=candidates.find(fits);
        if(!boxRect){if(!isBoss&&label.kind!=='town')continue;boxRect={x:clamp(candidates[0].x,4,W-width-4),y:clamp(candidates[0].y,4,H-height-4)};}
        const rect={kind:label.kind,id:label.id,x:boxRect.x,y:boxRect.y,w:width,h:height,title:label.name,detail};used.push(rect);placed.push(rect);
        if(isBoss){
          const boss=label.boss,color=boss.phase==='cooldown'?'#968f82':boss.phase==='fighting'?'#b65f48':boss.worldBoss?'#866093':'#927449';
          const edgeY=anchor.y<boxRect.y?boxRect.y:boxRect.y+height;
          line(ctx,[[anchor.x,anchor.y-5*zoom],[clamp(anchor.x,boxRect.x+8,boxRect.x+width-8),edgeY]],'rgba(118,93,76,.50)',1.2);
          box(ctx,boxRect.x,boxRect.y,width,height,7,boss.worldBoss?'rgba(246,236,250,.97)':'rgba(255,247,226,.97)',color,boss.worldBoss?1.6:1.1);
          ellipse(ctx,boxRect.x+19,boxRect.y+height/2,12,12,boss.phase==='cooldown'?'#e9e4d7':boss.worldBoss?'#ead9ef':'#ead6b2');
          icon(ctx,boss.worldBoss?'worldBoss':'boss',boxRect.x+19,boxRect.y+height/2,21,color);
          const textX=boxRect.x+iconSpace+(width-iconSpace)/2;
          text(ctx,label.name,textX,boxRect.y+height*.32,font,color,700);
          text(ctx,detail,textX,boxRect.y+height*.76,detailFont,boss.phase==='fighting'?'#a34f3b':'#7e735e',600);
          bossHits.push({kind:'boss',id:boss.id,x:boxRect.x,y:boxRect.y,w:width,h:height,title:label.name,detail:boss.regionName+' · '+detail+' · 필요 전투력 '+boss.minPower,townId:boss.townId,regionId:boss.regionId,phase:boss.phase,timerSeconds:boss.timerSeconds});
        }else{
          const hit=this.hitTargets.find(h=>h.kind===label.kind&&h.id===label.id);if(hit){if(this.worldMapLoaded)this.hitTargets.push({...hit,x:boxRect.x,y:boxRect.y,w:width,h:height});else{const left=Math.min(hit.x,boxRect.x),top=Math.min(hit.y,boxRect.y),right=Math.max(hit.x+hit.w,boxRect.x+width),bottom=Math.max(hit.y+hit.h,boxRect.y+height);Object.assign(hit,{x:left,y:top,w:right-left,h:bottom-top});}}
          const hovered=label.kind==='region'&&((this.hover&&this.hover.kind==='region'&&this.hover.id===label.id)||(this.pointer&&this.pointer.x>=boxRect.x&&this.pointer.x<=boxRect.x+width&&this.pointer.y>=boxRect.y&&this.pointer.y<=boxRect.y+height));
          box(ctx,boxRect.x,boxRect.y,width,height,4,label.kind==='town'?'rgba(255,246,220,.96)':hovered?'rgba(250,247,225,.96)':'rgba(250,247,225,.62)',label.focused?'#b69b62':label.kind==='town'?'rgba(159,139,101,.45)':hovered?'rgba(112,103,75,.7)':'rgba(162,157,119,.14)',label.focused?1.4:.7);
          text(ctx,label.name,boxRect.x+width/2,boxRect.y+height*.32,font,label.kind==='region'?'#464a38':label.owned?'#655e43':'#797a64',700);
          text(ctx,detail,boxRect.x+width/2,boxRect.y+height*.76,detailFont,label.kind==='region'?'#625944':'#96846b',600);
        }
      }
      // Boss cards remain clickable above the larger landmark hit rectangles.
      this.hitTargets.push(...bossHits);this.worldLabelRects=placed;return placed;
    }

    _drawMapHero(ctx, hero, x, y, size, now, dt, i, visualLabel) {
      const index = ForgeScene.getSpriteIndex(hero, i), entry = this.npcSheets.get(index), pack = global.ForgeNPC, definition = pack && pack.getByIndex(index);
      const movement=this._worldAnimationFor(hero, x, y, dt);
      if(visualLabel||hero.status==='returning'){
        this._drawSprite(ctx,index,x,y,43,0,!!movement.moving,1,movement);
        this._hitWorld('adventurer',hero.id,x-18,y-44,36,48,{title:hero.name,detail:visualLabel||'귀환 중'});return;
      }
      const radius = size / 2, cy = y - radius, accent = definition && definition.accent || '#9a9c77';
      shadow(ctx, x, y + 3, radius * .72, 3, .10);
      ctx.save(); ctx.beginPath(); ctx.arc(x, cy, radius, 0, Math.PI * 2); ctx.fillStyle = '#fff6e2'; ctx.fill(); ctx.clip();
      if (entry && entry.loaded && definition) {
        const b = definition.bounds.front_idle, sw = b[2] - b[0], sh = Math.min(b[3] - b[1], sw * .96);
        const scale = (size + 4) / Math.max(sw, sh);
        ctx.drawImage(entry.image, b[0], b[1], sw, sh, x - sw * scale / 2, cy - sh * scale / 2 + 2, sw * scale, sh * scale);
      } else this._drawSprite(ctx, index, x, y + size * .65, size * 1.6, 0, false, 1, { moving: false });
      ctx.restore(); ellipse(ctx, x, cy, radius, radius, null, hero.raidId ? '#b89055' : accent, hero.raidId ? 2 : 1.5);
      if (hero.status === 'hunting' || hero.bubble) {
        const bx = x + radius - 1, by = y - 3;
        ellipse(ctx, bx, by, 7.5, 7.5, hero.raidId ? '#f6e5bd' : '#fff9e6', '#c1ac80', 1);
        icon(ctx, hero.raidId ? 'boss' : hero.status === 'hunting' ? 'sword' : hero.bubble.type === 'material' ? 'material' : hero.bubble.type === 'bed' ? 'bed' : 'spark', bx, by, 10, hero.raidId ? '#a57543' : '#8b8f72');
      }
      this._hitWorld('adventurer',hero.id,x-radius-3,y-size-3,size+7,size+7,{title:hero.name,detail:`Lv.${hero.level||1} · ${visualLabel||(hero.raidId?'보스 토벌 중':STATUS_NAMES[hero.status]||'마을에 머무는 중')}`});
    }
    _worldAnimationFor(adventurer, x, y, dt) {
      const previous = this.worldMotion.get(adventurer.id);
      if (previous && dt <= 0 && previous.x === x && previous.y === y) return previous.animation;
      const teleport = !previous || previous.status !== adventurer.status || previous.regionId !== adventurer.regionId || previous.townId !== adventurer.townId || !['returning','hunting'].includes(adventurer.status);
      const dx = previous ? x - previous.x : 0, dy = previous ? y - previous.y : 0;
      const animation = global.ForgeNPC ? global.ForgeNPC.advanceMotion(previous && previous.animation, { dx, dy, dt, teleport }) : { moving: !teleport && dt > 0 && Math.hypot(dx, dy) > .01 };
      this.worldMotion.set(adventurer.id, { x, y, status: adventurer.status, regionId: adventurer.regionId, townId: adventurer.townId, animation }); return animation;
    }

    _regionArt(ctx, index, x, y, unlocked, now) {
      ctx.save(); ctx.translate(x, y); if (!unlocked) ctx.globalAlpha = .62;
      ellipse(ctx, 0, 28, 80, 34, index === 3 ? '#d5e1d3' : index === 4 ? '#d1c7b2' : '#c1d3a4');
      if (index >= 5) {
        if (index === 11) {
          ellipse(ctx,0,27,79,33,'#b5c5a0');ellipse(ctx,2,23,60,23,'#9fc3b4','#8dab9d',1.3);
          for(const [x,y]of[[-43,16],[-28,35],[32,31],[48,12]]){for(let j=0;j<3;j++)line(ctx,[[x+j*4,y+6],[x+j*4-2,y-15-j%2*7]],'#859c70',1.8);ellipse(ctx,x+1,y-14,2.2,5,'#b69a71');}
          tree(ctx,-45,1,.60,'#94af80');rock(ctx,47,37,.30,'#bec4a8');line(ctx,[[-15,23],[3,24],[16,21]],'#dce8cf',1.6);
        } else if (index === 12) {
          box(ctx,-59,-9,118,49,3,'#c1bca4','#939b83',1.3);
          const maze=[[-48,-18,-48,29],[-48,-18,-17,-18],[-17,-18,-17,7],[-17,7,10,7],[10,-20,10,28],[10,-20,45,-20],[45,-20,45,30],[-43,19,-28,19],[-28,0,-28,30],[22,-6,44,-6],[23,8,23,28]];
          for(const wall of maze){line(ctx,[[wall[0]+2,wall[1]+5],[wall[2]+2,wall[3]+5]],'#a8a58f',8);line(ctx,[[wall[0],wall[1]],[wall[2],wall[3]]],'#d2d0b9',7);line(ctx,[[wall[0]-1,wall[1]-2],[wall[2]-1,wall[3]-2]],'#e2dfc5',1.4);}
          icon(ctx,'spark',-3,-27,15,'#b6a5cb');
        } else if (index === 13) {
          ellipse(ctx,0,27,80,34,'#cbb28d');
          for(const[x,y,k]of[[-43,9,1],[42,12,.95],[-8,-19,.85]]){ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.beginPath();ctx.moveTo(-25,29);ctx.lineTo(-24,-23);ctx.lineTo(-10,-37);ctx.lineTo(18,-29);ctx.lineTo(28,30);ctx.closePath();ctx.fillStyle='#ba8e70';ctx.fill();ctx.strokeStyle='#957359';ctx.lineWidth=1.4;ctx.stroke();line(ctx,[[-22,-9],[22,-9]],'#d2a882',3);line(ctx,[[-22,10],[24,10]],'#c39a76',3);ctx.restore();}
          line(ctx,[[-12,34],[9,5],[13,-10]],'#e2c69a',8);
        } else if (index === 14) {
          ellipse(ctx,0,28,80,34,'#ccb994');rock(ctx,-38,25,.85,'#aaa28c');rock(ctx,29,13,1.05,'#b4a58c');
          for(const x of[-51,50]){line(ctx,[[x,30],[x-3,-10],[x+4,-26]],'#99896b',5);line(ctx,[[x-2,7],[x-17,-6]],'#99896b',3);}
          for(let i=0;i<4;i++)ellipse(ctx,-15+i*10,35,4,2,'#ded3b6');
        } else if (index === 15) {
          ellipse(ctx,0,28,79,33,'#d8c596');ellipse(ctx,4,27,42,18,'#9fc5b3','#8fb4a2',1.2);
          for(const x of[-43,38]){line(ctx,[[x,22],[x+3,-15]],'#b89b69',6);for(const dx of[-20,-10,10,22]){ctx.beginPath();ctx.moveTo(x+3,-15);ctx.quadraticCurveTo(x+dx,-37,x+dx*1.4,-14);ctx.strokeStyle='#93ab76';ctx.lineWidth=5;ctx.stroke();}}
          rock(ctx,-17,39,.27,'#c6b184');
        } else if (index === 16) {
          ellipse(ctx,0,28,80,34,'#d3dfd0');for(const[x,y,k]of[[-43,28,.65],[25,15,.82],[53,36,.36]]){rock(ctx,x,y,k,'#b3c2b6');ellipse(ctx,x-3,y-11*k,20*k,5*k,'#edf1e2');}pine(ctx,-22,2,.67,true);line(ctx,[[-16,33],[11,35]],'#eef1e5',2);
        } else if (index === 17) {
          ellipse(ctx,0,28,80,34,'#c9c3ce');ellipse(ctx,0,22,49,22,'#aaa2b2','#928a9e',1.3);ellipse(ctx,0,22,35,14,'#b9acc5');
          for(const[x,y,k]of[[-20,17,.7],[11,2,1],[29,28,.54]]){ctx.beginPath();ctx.moveTo(x,y-38*k);ctx.lineTo(x+13*k,y-14*k);ctx.lineTo(x+6*k,y+12*k);ctx.lineTo(x-9*k,y+10*k);ctx.lineTo(x-13*k,y-15*k);ctx.closePath();ctx.fillStyle='#beb1cf';ctx.fill();ctx.strokeStyle='#958ca6';ctx.lineWidth=1.3;ctx.stroke();line(ctx,[[x,y-33*k],[x+2*k,y+7*k]],'#e6ddeb',1.5);}
          icon(ctx,'spark',-43,-1,13,'#e6d6ae');icon(ctx,'spark',39,-11,9,'#f2e4bc');
        } else if (index === 18) {
          ellipse(ctx,0,28,80,34,'#d4dfcf');pine(ctx,-38,28,.98,true);pine(ctx,37,17,1.1,true);pine(ctx,-2,-1,1.24,true);rock(ctx,51,38,.3,'#bdc9ba');
        } else if (index === 9) {
          ellipse(ctx, 0, 26, 78, 31, '#b6ca91');
          ctx.beginPath(); ctx.moveTo(-66, 25); ctx.quadraticCurveTo(-31, -30, 7, 21); ctx.quadraticCurveTo(42, -13, 70, 30); ctx.closePath(); ctx.fillStyle = '#cad7a2'; ctx.fill();
          for (let i = 0; i < 15; i++) {
            const fx = -56 + noise(i + 83) * 112, fy = 6 + noise(i + 38) * 30;
            line(ctx, [[fx, fy], [fx, fy - 8]], '#86a271', 1.3);
            for (let j = 0; j < 4; j++) ellipse(ctx, fx + Math.cos(j * 1.57) * 2.7, fy - 9 + Math.sin(j * 1.57) * 2.7, 2.6, 2.1, i % 3 ? '#f4ebc4' : '#e4baa9');
            ellipse(ctx, fx, fy - 9, 1.5, 1.5, '#cba866');
          }
          tree(ctx, 54, 3, .53, '#9eaf7e');
        } else if (index === 10) {
          line(ctx, [[-70, 30], [10, -3], [68, 25]], '#b7ab83', 26);
          line(ctx, [[-70, 30], [10, -3], [68, 25]], '#e0d2ae', 21);
          for (const x of [-24, 24]) box(ctx, x - 5, -32, 10, 55, 2, '#b5a388', '#8f806c', 1.4);
          box(ctx, -34, -39, 68, 12, 3, '#c5b59b', '#95856c', 1.4);
          box(ctx, -14, -30, 28, 19, 3, '#c3a16a', '#927349', 1.2); icon(ctx, 'scroll', 0, -21, 12, '#f1dfb6');
          tree(ctx, -58, 12, .47); rock(ctx, 54, 33, .4, '#c7bda0');
        } else if (index === 5) {
          ellipse(ctx, 0, 30, 78, 31, '#b8d4c9', '#93b6ab', 1);
          for (let i = 0; i < 4; i++) line(ctx, [[-48 + i * 22, 29 + i % 2 * 10], [-34 + i * 22, 29 + i % 2 * 10]], '#e8eee0', 2);
          box(ctx, -13, -18, 26, 47, 3, '#d7c69e', '#ab9a73', 1.5);
          box(ctx, -19, -24, 38, 10, 3, '#a88864', '#846d52', 1.4);
          ctx.beginPath(); ctx.moveTo(-23, -25); ctx.lineTo(0, -45); ctx.lineTo(24, -25); ctx.closePath(); ctx.fillStyle = '#a7876a'; ctx.fill();
          box(ctx, -6, -11, 12, 16, 3, '#e9dbaa', '#ab9a73', 1); rock(ctx, -47, 23, .52, '#d6ccb1');
        } else if (index === 6) {
          ellipse(ctx, 0, 28, 80, 34, '#d9c598');
          ctx.beginPath(); ctx.moveTo(-67, 32); ctx.quadraticCurveTo(-34, -42, 13, 28); ctx.fillStyle = '#c9b17e'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(-8, 35); ctx.quadraticCurveTo(36, -64, 72, 31); ctx.fillStyle = '#dec58e'; ctx.fill();
          for (const x of [-43, 43]) { line(ctx, [[x, 22], [x, -10]], '#90a178', 8); line(ctx, [[x, 7], [x - 12, 2], [x - 12, -8]], '#90a178', 6); }
          rock(ctx, 13, 32, .35, '#be9f72');
        } else if (index === 7) {
          ellipse(ctx, 0, 28, 80, 34, '#c6b6a0');
          ctx.beginPath(); ctx.moveTo(-69, 32); ctx.lineTo(-25, -43); ctx.lineTo(20, -43); ctx.lineTo(73, 32); ctx.closePath(); ctx.fillStyle = '#9b9285'; ctx.fill(); ctx.strokeStyle = '#80796e'; ctx.lineWidth = 1.8; ctx.stroke();
          ellipse(ctx, -2, -42, 23, 8, '#bd8964', '#80796e', 1.4); ellipse(ctx, -2, -43, 15, 4, '#edb078');
          line(ctx, [[1, -35], [-13, -4], [8, 24]], '#d59c70', 7); line(ctx, [[-2, -31], [-10, -5], [7, 20]], '#efbf83', 3);
        } else {
          box(ctx, -47, -17, 94, 49, 3, '#b8bfad', '#909c8d', 1.8);
          for (const x of [-39, 39]) { box(ctx, x - 13, -46, 26, 76, 3, '#c9cfbd', '#909c8d', 1.5); for (let j = 0; j < 3; j++) box(ctx, x - 15 + j * 12, -54, 9, 14, 1, '#c9cfbd', '#909c8d', 1); }
          box(ctx, -12, 1, 24, 31, 7, '#7d897b', '#909c8d', 1.2); box(ctx, -5, -22, 10, 15, 3, '#96a994', '#909c8d', 1);
          pine(ctx, -63, 37, .47, true); pine(ctx, 62, 38, .5, true);
        }
        ctx.restore(); return;
      }
      if (index === 0) {
        tree(ctx, -35, 22, .91); tree(ctx, 34, 12, 1.02); tree(ctx, 0, -10, 1.15);
        rock(ctx, -50, 36, .45); ellipse(ctx, 39, 35, 8, 5, '#d5bd8b');
        for (let i = 0; i < 4; i++) ellipse(ctx, -20 + i * 15, 33 + Math.sin(i * 2) * 10, 2, 2, i % 2 ? '#edc0a1' : '#f6e6ba');
      } else if (index === 1) {
        ctx.beginPath(); ctx.moveTo(-64, 25); ctx.lineTo(-45, -22); ctx.lineTo(-10, -48); ctx.lineTo(28, -40); ctx.lineTo(60, -10); ctx.lineTo(68, 26); ctx.closePath(); ctx.fillStyle = '#aaa991'; ctx.fill(); ctx.strokeStyle = '#868c79'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-25, 28); ctx.lineTo(-23, -6); ctx.quadraticCurveTo(0, -29, 23, -6); ctx.lineTo(25, 28); ctx.closePath(); ctx.fillStyle = '#666d5d'; ctx.fill();
        box(ctx, -30, -9, 9, 39, 2, '#ad8a58', '#876d4d', 1.5); box(ctx, 21, -9, 9, 39, 2, '#ad8a58', '#876d4d', 1.5); box(ctx, -35, -16, 70, 10, 2, '#b99664', '#876d4d', 1.5);
        line(ctx, [[-14, 13], [-22, 47]], '#9c8866', 2); line(ctx, [[13, 13], [22, 47]], '#9c8866', 2);
        for (let i = 0; i < 4; i++) line(ctx, [[-16 - i * 2, 21 + i * 7], [16 + i * 2, 21 + i * 7]], '#b1a07b', 3);
        rock(ctx, -49, 34, .55); rock(ctx, 48, 34, .45, '#a9b3a4');
      } else if (index === 2) {
        box(ctx, -54, 26, 109, 10, 4, '#bbc1a5', '#929d84', 1.6);
        for (const v of [-35, 35]) { box(ctx, v - 9, -39, 18, 65, 3, '#ced0b7', '#9ca58a', 1.8); box(ctx, v - 14, -44, 28, 10, 2, '#dddcc3', '#9ca58a', 1.6); box(ctx, v - 14, 20, 28, 9, 2, '#d9d9bc', '#9ca58a', 1.6); line(ctx, [[v - 3, -29], [v - 3, 17]], '#f1edd3', 2); }
        box(ctx, -53, -57, 99, 13, 3, '#cccdb1', '#9ca58a', 1.5);
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(12, -11); ctx.lineTo(0, 15); ctx.lineTo(-12, -11); ctx.closePath(); ctx.fillStyle = '#b2a8cd'; ctx.fill(); ctx.strokeStyle = '#8b8da9'; ctx.lineWidth = 1.6; ctx.stroke();
        ellipse(ctx, 0, 25, 20, 5, 'rgba(175,163,205,.22)');
        line(ctx, [[-42, -40], [-33, -14], [-42, 6]], '#90a27c', 4); ellipse(ctx, -35, -21, 6, 3.5, '#97af83');
      } else if (index === 3) {
        ctx.beginPath(); ctx.moveTo(-73, 32); ctx.lineTo(-24, -54); ctx.lineTo(20, 33); ctx.closePath(); ctx.fillStyle = '#9eafaa'; ctx.fill(); ctx.strokeStyle = '#81968e'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, 34); ctx.lineTo(32, -72); ctx.lineTo(83, 32); ctx.closePath(); ctx.fillStyle = '#b1c0b9'; ctx.fill(); ctx.strokeStyle = '#8fa198'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(32, -72); ctx.lineTo(52, -31); ctx.lineTo(37, -36); ctx.lineTo(27, -21); ctx.lineTo(16, -30); ctx.closePath(); ctx.fillStyle = '#edf2e2'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-24, -54); ctx.lineTo(-8, -24); ctx.lineTo(-23, -29); ctx.lineTo(-34, -19); ctx.lineTo(-39, -28); ctx.closePath(); ctx.fillStyle = '#edf2e2'; ctx.fill();
        pine(ctx, -52, 38, .56, true); pine(ctx, 62, 40, .50, true);
        const glint = Math.sin(now * 1.3) * .2 + .7; ctx.globalAlpha *= glint; icon(ctx, 'spark', 26, 16, 18, '#fff8d4');
      } else {
        ctx.beginPath(); ctx.moveTo(-73, 30); ctx.lineTo(-57, -1); ctx.lineTo(-38, -16); ctx.lineTo(-13, -33); ctx.lineTo(14, -38); ctx.lineTo(46, -19); ctx.lineTo(67, 3); ctx.lineTo(76, 31); ctx.closePath(); ctx.fillStyle = '#a39788'; ctx.fill(); ctx.strokeStyle = '#897e71'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-33, 31); ctx.lineTo(-26, -3); ctx.quadraticCurveTo(0, -23, 29, 0); ctx.lineTo(35, 31); ctx.closePath(); ctx.fillStyle = '#675f57'; ctx.fill();
        ellipse(ctx, -8, 6, 3, 2, '#dfa96a'); ellipse(ctx, 8, 6, 3, 2, '#dfa96a');
        for (const v of [-49, 44]) { ctx.beginPath(); ctx.moveTo(v, 9); ctx.lineTo(v + 4, -15); ctx.lineTo(v + 12, -20); ctx.lineTo(v + 13, 9); ctx.closePath(); ctx.fillStyle = '#d9ceae'; ctx.fill(); ctx.strokeStyle = '#b1a58b'; ctx.lineWidth = 1; ctx.stroke(); }
        rock(ctx, -49, 35, .5, '#b7a58d'); rock(ctx, 52, 32, .48, '#b7a58d');
      }
      ctx.restore();
    }



    _drawHoverCard(ctx) {
      const h = this.hover, p = this.pointer; if (!h || !p || !h.title || this.placement || this.drag && this.drag.moved) return;
      // Multi-line cards (facility info: furnace speed/crew, display slots, warehouse capacity).
      if (Array.isArray(h.lines) && h.lines.length) {
        ctx.save(); ctx.font = `500 10px ${FONT}`;
        const lineW = Math.max(...h.lines.map(l => ctx.measureText(l).width)); ctx.font = `700 12px ${FONT}`;
        const width = clamp(Math.max(ctx.measureText(h.title).width, lineW) + 28, 150, 300), height = 30 + h.lines.length * 15;
        const x = clamp(p.x + 15, 10, W - width - 10), y = clamp(p.y - height - 17, 10, H - height - 10);
        ctx.shadowColor = 'rgba(70,51,31,.13)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
        box(ctx, x, y, width, height, 9, '#fffbee', '#bda980', 1); ctx.shadowColor = 'transparent';
        text(ctx, h.title, x + 13, y + 16, 12, '#74563a', 800, 'left');
        h.lines.forEach((line, i) => text(ctx, line, x + 13, y + 34 + i * 15, 10, /비어 있음$/.test(line) ? '#b7aa92' : '#7d6a52', 500, 'left'));
        ctx.restore(); return;
      }
      ctx.save(); ctx.font = `700 12px ${FONT}`;
      // Title-only tooltips (e.g. the village signpost) stay compact.
      const width = clamp(Math.max(ctx.measureText(h.title).width + 30, (h.detail || '').length * 8.4 + 26), h.detail ? 156 : 56, 270), height = h.detail ? 55 : 33;
      const x = clamp(p.x + 15, 10, W - width - 10), y = clamp(p.y - height - 17, 10, H - height - 10);
      ctx.shadowColor = 'rgba(70,51,31,.13)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      box(ctx, x, y, width, height, 9, '#fffbee', '#bda980', 1); ctx.shadowColor = 'transparent';
      text(ctx, h.title, x + 13, y + 17, 12, '#74563a', 800, 'left');
      if (h.detail) {
        let detail = h.detail; ctx.font = `500 10px ${FONT}`;
        while (detail.length > 1 && ctx.measureText(detail).width > width - 27) detail = detail.slice(0, -2) + '…';
        text(ctx, detail, x + 13, y + 37, 10, '#93816a', 500, 'left');
      }
      ctx.restore();
    }

    destroy() {
      for (const [event, fn] of [['pointermove', this._onMove], ['pointerdown', this._onDown], ['pointerup', this._onUp], ['pointercancel', this._onUp], ['pointerleave', this._onLeave], ['click', this._onClick], ['keydown', this._onKey], ['wheel', this._onWheel]]) this.canvas.removeEventListener(event, fn);
      this.motion.clear(); this.worldMotion.clear(); this.backdrops.clear(); this.cameras.clear(); this.artSheets.clear(); this.worldBackdrop=null;
      if (ForgeScene._latest === this) ForgeScene._latest = null;
    }
  }

  ForgeScene.TILE_SIZE = TILE;
  ForgeScene.CHARACTER_HEIGHT = HERO_HEIGHT;
  global.ForgeScene = ForgeScene;
})(typeof window !== 'undefined' ? window : globalThis);
