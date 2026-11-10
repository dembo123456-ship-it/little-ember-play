(function (global) {
  'use strict';

  // The supplied sheets retain their original 512 px cells and common foot pivot.
  // No frame is trimmed or individually rescaled: walking poses share one geometry.
  const FRAME_SIZE = 512;
  const SHEET_SIZE = Object.freeze({ width: 1536, height: 1024 });
  const PIVOT = Object.freeze({ x: 256, y: 409.6 });
  const CONTENT_HEIGHT = 304;
  const FPS = 4;
  const POSES = Object.freeze(['front_idle', 'front_diag_idle', 'front_diag_walk', 'back_diag_idle', 'back_diag_walk']);
  const characters = [
  {
    "id": "npc_001",
    "adventurerId": "raon",
    "index": 10,
    "name": "로언",
    "jobId": "swordsman",
    "job": "검사",
    "accent": "#bc6147",
    "description": "갈색 삐죽머리 · 붉은 스카프 · 가죽 경갑 · 한손검",
    "sheet": "assets/npcs/npc_001/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        144,
        105,
        355,
        408
      ],
      "front_diag_idle": [
        135,
        111,
        337,
        408
      ],
      "front_diag_walk": [
        130,
        112,
        338,
        407
      ],
      "back_diag_idle": [
        159,
        110,
        367,
        408
      ],
      "back_diag_walk": [
        154,
        110,
        362,
        408
      ]
    }
  },
  {
    "id": "npc_002",
    "adventurerId": "luna",
    "index": 11,
    "name": "루미",
    "jobId": "mage",
    "job": "마법사",
    "accent": "#8964a2",
    "description": "분홍 양 갈래 머리 · 보라색 모자 · 짧은 로브 · 지팡이",
    "sheet": "assets/npcs/npc_002/sheet.png",
    "maxContentHeight": 304,
    "bounds": {
      "front_idle": [
        132,
        108,
        369,
        408
      ],
      "front_diag_idle": [
        114,
        106,
        343,
        407
      ],
      "front_diag_walk": [
        121,
        104,
        343,
        408
      ],
      "back_diag_idle": [
        147,
        113,
        360,
        408
      ],
      "back_diag_walk": [
        147,
        114,
        360,
        408
      ]
    }
  },
  {
    "id": "npc_003",
    "adventurerId": "rin",
    "index": 12,
    "name": "실바",
    "jobId": "archer",
    "job": "궁수",
    "accent": "#5c8870",
    "description": "민트색 땋은 머리 · 베레모 · 초록 경장 · 활",
    "sheet": "assets/npcs/npc_003/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        153,
        105,
        358,
        408
      ],
      "front_diag_idle": [
        136,
        108,
        338,
        408
      ],
      "front_diag_walk": [
        136,
        110,
        335,
        408
      ],
      "back_diag_idle": [
        155,
        104,
        359,
        407
      ],
      "back_diag_walk": [
        157,
        108,
        362,
        407
      ]
    }
  },
  {
    "id": "npc_004",
    "adventurerId": "sera",
    "index": 13,
    "name": "노아",
    "jobId": "rogue",
    "job": "도적",
    "accent": "#657c9a",
    "description": "은발 · 짧은 남색 망토 · 쌍단검",
    "sheet": "assets/npcs/npc_004/sheet.png",
    "maxContentHeight": 304,
    "bounds": {
      "front_idle": [
        151,
        104,
        354,
        408
      ],
      "front_diag_idle": [
        136,
        106,
        338,
        407
      ],
      "front_diag_walk": [
        131,
        105,
        333,
        408
      ],
      "back_diag_idle": [
        157,
        106,
        358,
        407
      ],
      "back_diag_walk": [
        151,
        107,
        355,
        408
      ]
    }
  },
  {
    "id": "npc_005",
    "index": 14,
    "name": "세린",
    "jobId": "swordsman",
    "job": "검사",
    "accent": "#3f7f89",
    "description": "짙은 청색 포니테일 · 짧은 붉은 망토 · 청록 경갑 · 검",
    "sheet": "assets/npcs/npc_005/sheet.png",
    "maxContentHeight": 304,
    "bounds": {
      "front_idle": [
        144,
        105,
        338,
        407
      ],
      "front_diag_idle": [
        112,
        105,
        329,
        406
      ],
      "front_diag_walk": [
        112,
        104,
        328,
        408
      ],
      "back_diag_idle": [
        145,
        109,
        366,
        406
      ],
      "back_diag_walk": [
        146,
        108,
        370,
        406
      ]
    }
  },
  {
    "id": "npc_006",
    "index": 15,
    "name": "테오",
    "jobId": "mage",
    "job": "마법사",
    "accent": "#4c8e99",
    "description": "푸른 단발 · 뒤로 넘긴 후드 · 크림색 로브 · 마법책",
    "sheet": "assets/npcs/npc_006/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        150,
        110,
        357,
        407
      ],
      "front_diag_idle": [
        131,
        109,
        336,
        405
      ],
      "front_diag_walk": [
        123,
        108,
        330,
        408
      ],
      "back_diag_idle": [
        154,
        103,
        362,
        405
      ],
      "back_diag_walk": [
        158,
        105,
        362,
        408
      ]
    }
  },
  {
    "id": "npc_007",
    "index": 16,
    "name": "아이린",
    "jobId": "archer",
    "job": "궁수",
    "accent": "#657a47",
    "description": "적갈색 포니테일 · 열린 후드 · 초록 튜닉 · 활",
    "sheet": "assets/npcs/npc_007/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        163,
        105,
        344,
        408
      ],
      "front_diag_idle": [
        125,
        109,
        325,
        408
      ],
      "front_diag_walk": [
        120,
        110,
        326,
        407
      ],
      "back_diag_idle": [
        156,
        107,
        347,
        407
      ],
      "back_diag_walk": [
        153,
        104,
        350,
        407
      ]
    }
  },
  {
    "id": "npc_008",
    "index": 17,
    "name": "카이",
    "jobId": "rogue",
    "job": "도적",
    "accent": "#a04d49",
    "description": "검은 올림머리 · 붉은 두건 · 짧은 가죽 재킷 · 단검",
    "sheet": "assets/npcs/npc_008/sheet.png",
    "maxContentHeight": 302,
    "bounds": {
      "front_idle": [
        151,
        110,
        344,
        407
      ],
      "front_diag_idle": [
        139,
        103,
        329,
        404
      ],
      "front_diag_walk": [
        138,
        106,
        327,
        408
      ],
      "back_diag_idle": [
        168,
        109,
        359,
        407
      ],
      "back_diag_walk": [
        163,
        111,
        354,
        407
      ]
    }
  },
  {
    "id": "npc_009",
    "adventurerId": "bram",
    "index": 18,
    "name": "레온",
    "jobId": "knight",
    "job": "기사",
    "accent": "#6f8da1",
    "description": "금발 가르마 · 은빛 판금 갑옷 · 파란 타바드 · 검과 방패",
    "sheet": "assets/npcs/npc_009/sheet.png",
    "maxContentHeight": 304,
    "bounds": {
      "front_idle": [
        145,
        104,
        351,
        408
      ],
      "front_diag_idle": [
        134,
        106,
        332,
        407
      ],
      "front_diag_walk": [
        135,
        104,
        330,
        408
      ],
      "back_diag_idle": [
        155,
        108,
        368,
        408
      ],
      "back_diag_walk": [
        154,
        108,
        368,
        408
      ]
    }
  },
  {
    "id": "npc_010",
    "index": 19,
    "name": "엘라",
    "jobId": "knight",
    "job": "기사",
    "accent": "#84729a",
    "description": "연보라 웨이브 · 긴 남색 망토 · 금속 갑옷 · 넓은 검",
    "sheet": "assets/npcs/npc_010/sheet.png",
    "maxContentHeight": 301,
    "bounds": {
      "front_idle": [
        130,
        106,
        357,
        406
      ],
      "front_diag_idle": [
        136,
        105,
        340,
        404
      ],
      "front_diag_walk": [
        128,
        108,
        338,
        409
      ],
      "back_diag_idle": [
        155,
        108,
        378,
        403
      ],
      "back_diag_walk": [
        165,
        107,
        381,
        408
      ]
    }
  },
  {
    "id": "npc_011",
    "index": 20,
    "name": "브란",
    "jobId": "warrior",
    "job": "전사",
    "accent": "#876744",
    "description": "짧은 머리와 작은 수염 · 두꺼운 가죽 장비 · 도끼",
    "sheet": "assets/npcs/npc_011/sheet.png",
    "maxContentHeight": 302,
    "bounds": {
      "front_idle": [
        130,
        107,
        347,
        409
      ],
      "front_diag_idle": [
        126,
        109,
        325,
        408
      ],
      "front_diag_walk": [
        118,
        110,
        324,
        407
      ],
      "back_diag_idle": [
        161,
        106,
        373,
        406
      ],
      "back_diag_walk": [
        165,
        108,
        377,
        406
      ]
    }
  },
  {
    "id": "npc_012",
    "index": 21,
    "name": "프레야",
    "jobId": "warrior",
    "job": "전사",
    "accent": "#ab7860",
    "description": "은금색 양 갈래 머리 · 털 어깨 장식 · 전투 망치",
    "sheet": "assets/npcs/npc_012/sheet.png",
    "maxContentHeight": 301,
    "bounds": {
      "front_idle": [
        131,
        105,
        350,
        406
      ],
      "front_diag_idle": [
        125,
        106,
        335,
        405
      ],
      "front_diag_walk": [
        120,
        112,
        331,
        409
      ],
      "back_diag_idle": [
        158,
        112,
        371,
        407
      ],
      "back_diag_walk": [
        156,
        113,
        367,
        407
      ]
    }
  },
  {
    "id": "npc_013",
    "index": 22,
    "name": "진",
    "jobId": "spearman",
    "job": "창병",
    "accent": "#b5704e",
    "description": "갈색 상투 · 붉은 스카프 · 가벼운 갑옷 · 창",
    "sheet": "assets/npcs/npc_013/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        146,
        104,
        343,
        403
      ],
      "front_diag_idle": [
        122,
        106,
        326,
        402
      ],
      "front_diag_walk": [
        124,
        106,
        323,
        407
      ],
      "back_diag_idle": [
        165,
        109,
        369,
        401
      ],
      "back_diag_walk": [
        165,
        105,
        370,
        408
      ]
    }
  },
  {
    "id": "npc_014",
    "index": 23,
    "name": "린",
    "jobId": "spearman",
    "job": "창병",
    "accent": "#528e8b",
    "description": "은색 단발 · 청록 어깨 갑옷 · 짧은 케이프 · 창",
    "sheet": "assets/npcs/npc_014/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        146,
        104,
        358,
        404
      ],
      "front_diag_idle": [
        132,
        104,
        332,
        404
      ],
      "front_diag_walk": [
        133,
        105,
        338,
        408
      ],
      "back_diag_idle": [
        155,
        108,
        364,
        405
      ],
      "back_diag_walk": [
        155,
        106,
        362,
        408
      ]
    }
  },
  {
    "id": "npc_015",
    "index": 24,
    "name": "가렌",
    "jobId": "crossbow",
    "job": "석궁 사수",
    "accent": "#718351",
    "description": "짧은 적갈색 곱슬머리 · 올리브색 조끼 · 석궁",
    "sheet": "assets/npcs/npc_015/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        152,
        107,
        360,
        408
      ],
      "front_diag_idle": [
        140,
        110,
        339,
        408
      ],
      "front_diag_walk": [
        142,
        115,
        339,
        407
      ],
      "back_diag_idle": [
        162,
        106,
        355,
        404
      ],
      "back_diag_walk": [
        161,
        106,
        357,
        409
      ]
    }
  },
  {
    "id": "npc_016",
    "index": 25,
    "name": "미라",
    "jobId": "crossbow",
    "job": "석궁 사수",
    "accent": "#a67c4e",
    "description": "애쉬 금발 · 고글 · 카라멜색 짧은 코트 · 석궁",
    "sheet": "assets/npcs/npc_016/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        154,
        107,
        348,
        407
      ],
      "front_diag_idle": [
        141,
        103,
        348,
        403
      ],
      "front_diag_walk": [
        141,
        104,
        348,
        407
      ],
      "back_diag_idle": [
        155,
        116,
        352,
        404
      ],
      "back_diag_walk": [
        158,
        115,
        352,
        407
      ]
    }
  },
  {
    "id": "npc_017",
    "adventurerId": "tobi",
    "index": 26,
    "name": "에밀",
    "jobId": "cleric",
    "job": "성직자",
    "accent": "#7c97aa",
    "description": "둥근 분홍 단발 · 크림색과 파란 성직복 · 해 문양 지팡이",
    "sheet": "assets/npcs/npc_017/sheet.png",
    "maxContentHeight": 302,
    "bounds": {
      "front_idle": [
        144,
        105,
        354,
        405
      ],
      "front_diag_idle": [
        140,
        106,
        336,
        406
      ],
      "front_diag_walk": [
        139,
        106,
        337,
        406
      ],
      "back_diag_idle": [
        153,
        104,
        368,
        406
      ],
      "back_diag_walk": [
        156,
        105,
        371,
        404
      ]
    }
  },
  {
    "id": "npc_018",
    "index": 27,
    "name": "셀레네",
    "jobId": "cleric",
    "job": "성직자",
    "accent": "#9f6076",
    "description": "긴 백색 웨이브 · 어깨 덮개 · 자주색 성직복 · 기도서",
    "sheet": "assets/npcs/npc_018/sheet.png",
    "maxContentHeight": 301,
    "bounds": {
      "front_idle": [
        141,
        113,
        360,
        406
      ],
      "front_diag_idle": [
        122,
        104,
        334,
        397
      ],
      "front_diag_walk": [
        120,
        105,
        332,
        406
      ],
      "back_diag_idle": [
        141,
        113,
        345,
        403
      ],
      "back_diag_walk": [
        139,
        113,
        345,
        406
      ]
    }
  },
  {
    "id": "npc_019",
    "index": 28,
    "name": "건",
    "jobId": "fighter",
    "job": "격투가",
    "accent": "#b99a49",
    "description": "검은 삐죽머리 · 노란 머리띠 · 흰 도복 · 손 붕대",
    "sheet": "assets/npcs/npc_019/sheet.png",
    "maxContentHeight": 303,
    "bounds": {
      "front_idle": [
        157,
        105,
        356,
        406
      ],
      "front_diag_idle": [
        139,
        105,
        335,
        405
      ],
      "front_diag_walk": [
        135,
        106,
        333,
        405
      ],
      "back_diag_idle": [
        160,
        103,
        349,
        404
      ],
      "back_diag_walk": [
        163,
        103,
        356,
        406
      ]
    }
  },
  {
    "id": "npc_020",
    "index": 29,
    "name": "유나",
    "jobId": "fighter",
    "job": "격투가",
    "accent": "#4c858b",
    "description": "짙은 민트 올림머리 · 짧은 남색 재킷 · 금속 건틀릿",
    "sheet": "assets/npcs/npc_020/sheet.png",
    "maxContentHeight": 301,
    "bounds": {
      "front_idle": [
        167,
        103,
        341,
        404
      ],
      "front_diag_idle": [
        168,
        108,
        332,
        405
      ],
      "front_diag_walk": [
        170,
        108,
        332,
        404
      ],
      "back_diag_idle": [
        174,
        117,
        338,
        406
      ],
      "back_diag_walk": [
        176,
        116,
        343,
        406
      ]
    }
  }
];
  for (const character of characters) {
    for (const bound of Object.values(character.bounds)) Object.freeze(bound);
    Object.freeze(character.bounds); Object.freeze(character);
  }
  Object.freeze(characters);

  function finite(value, fallback) { return Number.isFinite(value) ? value : fallback; }
  const byIndex = new Map(characters.map(character => [character.index, character]));
  const byVisualId = new Map(characters.map(character => [character.id, character]));
  const byHeroId = new Map(characters.filter(character => character.adventurerId).map(character => [character.adventurerId, character]));
  function getByIndex(index) { return byIndex.get(index) || null; }
  function getByVisualId(id) { return byVisualId.get(id) || null; }
  function getForAdventurer(adventurer) {
    if (!adventurer) return null;
    if (typeof adventurer === 'object') {
      const visual = getByVisualId(adventurer.visualId || adventurer.spriteId) || getByIndex(adventurer.sprite);
      if (visual) return visual;
    }
    const id = typeof adventurer === 'string' ? adventurer : adventurer.id;
    const known = byHeroId.get(id) || byVisualId.get(id);
    if (known) return known;
    const template = global.ForgeRoster && global.ForgeRoster.getById(id);
    return template ? getByVisualId(template.visualId) : null;
  }

  function updateFacing(previous, dx, dy) {
    const prior = previous || { dx: 0, dy: 1, back: false, flipX: false };
    const x = finite(dx, 0), y = finite(dy, 0), distance = Math.hypot(x, y);
    if (distance < .001) return { dx: finite(prior.dx, 0), dy: finite(prior.dy, 1), back: !!prior.back, flipX: !!prior.flipX };
    const nx = x / distance, ny = y / distance;
    // Preserve the last side when walking almost vertically instead of flickering
    // between mirrored sheets because of subpixel destination rounding.
    // The back (up-diagonal) pose is only for clearly upward steps: a sideways walk
    // uses the front-diagonal pose so the walker faces where it goes, even right
    // after walking up.
    return {
      dx: nx, dy: ny,
      flipX: nx < -.04 ? true : nx > .04 ? false : !!prior.flipX,
      back: ny < -.35
    };
  }

  function advanceMotion(previous, options) {
    const prior = previous || {}, o = options || {};
    const dx = finite(o.dx, 0), dy = finite(o.dy, 0), dt = Math.max(0, finite(o.dt, 0));
    const moving = !o.teleport && dt > 0 && Math.hypot(dx, dy) > .01;
    const facing = moving ? updateFacing(prior.facing, dx, dy) : updateFacing(prior.facing, 0, 0);
    return {
      moving, dx: moving ? dx : 0, dy: moving ? dy : 0, facing,
      walkTime: Math.max(0, finite(prior.walkTime, 0)) + (moving ? dt : 0)
    };
  }

  function selectFrame(options) {
    const o = options || {};
    if (!o.moving) return { pose: 'front_idle', cell: 0, flipX: false, facing: updateFacing(o.facing, 0, 0) };
    const facing = updateFacing(o.facing, o.dx, o.dy);
    const phase = Math.floor(Math.max(0, finite(o.walkTime, 0)) * FPS + 1e-9) % 2;
    const cell = (facing.back ? 3 : 1) + phase;
    return { pose: POSES[cell], cell, flipX: facing.flipX, facing };
  }

  function frameGeometry(options) {
    const o = options || {}, character = getByIndex(o.index);
    if (!character) throw new RangeError('Unknown NPC sprite index.');
    const pose = o.pose || 'front_idle', cell = POSES.indexOf(pose);
    if (cell < 0) throw new RangeError('Unknown NPC pose.');
    const height = Math.max(.001, finite(o.height, 80)), scale = height / CONTENT_HEIGHT;
    const bound = character.bounds[pose];
    return {
      source: { x: cell % 3 * FRAME_SIZE, y: Math.floor(cell / 3) * FRAME_SIZE, w: FRAME_SIZE, h: FRAME_SIZE },
      destination: { x: -PIVOT.x * scale, y: -PIVOT.y * scale, w: FRAME_SIZE * scale, h: FRAME_SIZE * scale },
      scale, pivot: { x: 0, y: 0 },
      contentBounds: { x: (bound[0] - PIVOT.x) * scale, y: (bound[1] - PIVOT.y) * scale, w: (bound[2] - bound[0]) * scale, h: (bound[3] - bound[1]) * scale }
    };
  }

  function portraitGeometry(options) {
    const o = options || {}, width = Math.max(1, finite(o.width, 96)), height = Math.max(1, finite(o.height, 96));
    const padding = Math.max(0, Math.min(finite(o.padding, 4), Math.min(width, height) / 4));
    const contentHeight = Math.max(1, Math.min(width, height) - padding * 2);
    const geometry = frameGeometry({ index: o.index, pose: 'front_idle', height: contentHeight });
    const anchor = { x: width / 2, y: height / 2 + contentHeight / 2 };
    return {
      ...geometry, anchor,
      destination: { ...geometry.destination, x: geometry.destination.x + anchor.x, y: geometry.destination.y + anchor.y },
      contentBounds: { ...geometry.contentBounds, x: geometry.contentBounds.x + anchor.x, y: geometry.contentBounds.y + anchor.y }
    };
  }

  function hitBounds(index, height) {
    const character = getByIndex(index);
    if (!character) return null;
    const scale = Math.max(.001, finite(height, 80)) / CONTENT_HEIGHT;
    let maxX = 0, top = PIVOT.y;
    for (const bounds of Object.values(character.bounds)) {
      maxX = Math.max(maxX, Math.abs(bounds[0] - PIVOT.x), Math.abs(bounds[2] - PIVOT.x));
      top = Math.min(top, bounds[1]);
    }
    const x = -maxX * scale - 4, y = (top - PIVOT.y) * scale - 2;
    // The lower margin includes the clickable nameplate. Bounds are symmetric
    // and stable across all poses, including a horizontally mirrored pose.
    return { x, y, w: -x * 2, h: -y + 14 };
  }

  const api = Object.freeze({ FRAME_SIZE, SHEET_SIZE, PIVOT, CONTENT_HEIGHT, FPS, POSES, characters,
    getByIndex, getByVisualId, getForAdventurer, updateFacing, advanceMotion, selectFrame, frameGeometry, portraitGeometry, hitBounds });
  global.ForgeNPC = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
