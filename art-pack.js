(function (root, factory) {
  'use strict';
  const api = factory();
  root.ForgeArt = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STAFF_SHEET = 'assets/staff-v04.png';
  const BUBBLE_SHEET = 'assets/status-bubbles-v04.png';
  const MONSTER_SHEET = 'assets/invader-v04.png';
  // Original PNGs remain intact. Source rectangles are renderer metadata only.
  const legacyStaff = [
  {
    "id": "smith",
    "name": "한스",
    "index": 100,
    "source": {
      "x": 125,
      "y": 14,
      "w": 307,
      "h": 479
    },
    "pivot": {
      "x": 163.06,
      "y": 473
    },
    "contentHeight": 467
  },
  {
    "id": "artisan",
    "name": "에다",
    "index": 101,
    "source": {
      "x": 615,
      "y": 18,
      "w": 311,
      "h": 474
    },
    "pivot": {
      "x": 149.45,
      "y": 468
    },
    "contentHeight": 462
  },
  {
    "id": "seller",
    "name": "벨",
    "index": 102,
    "source": {
      "x": 1095,
      "y": 31,
      "w": 314,
      "h": 461
    },
    "pivot": {
      "x": 163.0,
      "y": 455
    },
    "contentHeight": 449
  },
  {
    "id": "helper",
    "name": "유리",
    "index": 103,
    "source": {
      "x": 125,
      "y": 534,
      "w": 313,
      "h": 468
    },
    "pivot": {
      "x": 148.3,
      "y": 462
    },
    "contentHeight": 456
  },
  {
    "id": "master",
    "name": "명장 도란",
    "index": 104,
    "source": {
      "x": 556,
      "y": 516,
      "w": 369,
      "h": 486
    },
    "pivot": {
      "x": 216.32,
      "y": 480
    },
    "contentHeight": 474
  },
  {
    "id": "apprentice",
    "name": "방문 견습생",
    "index": 105,
    "source": {
      "x": 1096,
      "y": 515,
      "w": 308,
      "h": 487
    },
    "pivot": {
      "x": 162.09,
      "y": 481
    },
    "contentHeight": 475
  }
].map(entry => Object.freeze({...entry, sheet:STAFF_SHEET}));
  // 2026-11 staff motion sheets (scripts/build-staff-art.ps1): 768 x 512, cells of 256 in the adventurer order
  // (front idle, front-diagonal idle/walk, back-diagonal idle/walk, breath). The figure's feet sit at (128, 204.8) of each
  // cell and the front-idle figure is 152 px tall. `source` frames the figure inside a cell; the renderer offsets it
  // to the cell of the pose being shown. Innkeepers keep the earlier single picture (index 123).
  const MOTION = [
    ['smith','hans','한스',100,'smith'],['artisan','eda','에다',101,'smith'],['seller','bel','벨',102,'sales'],['helper','yuri','유리',103,'logistics'],
    ['master','doran','명장 도란',104,'master'],['apprentice','apprentice','방문 견습생',105,'apprentice'],
    ['born','born','보른',106,'smith'],['mika','mika','미카',107,'smith'],['greta','greta','그레타',108,'smith'],['toby','toby','토비',109,'smith'],['koko','koko','코코',110,'smith'],['ivan','ivan','이반',111,'smith'],
    ['laura','laura','로라',112,'sales'],['felix','felix','펠릭스',113,'sales'],['hana','hana','하나',114,'sales'],
    ['oscar','oscar','오스카',115,'buyer'],['nina','nina','니나',116,'buyer'],['basil','basil','바실',117,'buyer'],
    ['dex','dex','덱스',118,'logistics'],['pio','pio','피오',119,'logistics'],['marta','marta','마르타',120,'logistics'],
    ['zeros','zeros','제로스',121,'enhancer'],['eve','eve','이브',122,'enhancer']
  ];
  const MOTION_CELL = 256, MOTION_FRAME = Object.freeze({ x: 38, y: 46, w: 180, h: 166 });
  const sheetPaths = {hans:'assets/staff/hans.png',eda:'assets/staff/eda.png',bel:'assets/staff/bel.png',yuri:'assets/staff/yuri.png',doran:'assets/staff/doran.png',apprentice:'assets/staff/apprentice.png',
    born:'assets/staff/born.png',mika:'assets/staff/mika.png',greta:'assets/staff/greta.png',toby:'assets/staff/toby.png',koko:'assets/staff/koko.png',ivan:'assets/staff/ivan.png',
    laura:'assets/staff/laura.png',felix:'assets/staff/felix.png',hana:'assets/staff/hana.png',oscar:'assets/staff/oscar.png',nina:'assets/staff/nina.png',basil:'assets/staff/basil.png',
    dex:'assets/staff/dex.png',pio:'assets/staff/pio.png',marta:'assets/staff/marta.png',zeros:'assets/staff/zeros.png',eve:'assets/staff/eve.png'};
  const staff = MOTION.map(([id,file,name,index,role]) => Object.freeze({ id, name, index, role, motion: true, cell: MOTION_CELL, sheet: sheetPaths[file],
    source: MOTION_FRAME, pivot: Object.freeze({ x: 128 - MOTION_FRAME.x, y: 204.8 - MOTION_FRAME.y }), contentHeight: 152 }));
  staff.push(Object.freeze({...legacyStaff.find(entry => entry.id === 'helper'), id: 'innkeeper', name: '여관 직원', index: 123, role: 'innkeeper'}));
  // Looks handed to new applicants, by role (the master and the visiting apprentice are special characters).
  const looks = Object.freeze({ smith: [100,101,106,107,108,109,110,111], sales: [102,112,113,114], buyer: [115,116,117], logistics: [103,118,119,120], enhancer: [121,122], innkeeper: [123] });
  const bubbles = Object.fromEntries(Object.entries({
  "hammer": {
    "source": {
      "x": 5,
      "y": 27,
      "w": 434,
      "h": 409
    }
  },
  "bed": {
    "source": {
      "x": 448,
      "y": 28,
      "w": 435,
      "h": 408
    }
  },
  "incapacitated": {
    "source": {
      "x": 892,
      "y": 27,
      "w": 435,
      "h": 409
    }
  },
  "combat": {
    "source": {
      "x": 1335,
      "y": 27,
      "w": 434,
      "h": 409
    }
  },
  "material": {
    "source": {
      "x": 5,
      "y": 471,
      "w": 434,
      "h": 409
    }
  },
  "heart": {
    "source": {
      "x": 449,
      "y": 471,
      "w": 434,
      "h": 409
    }
  },
  "angry": {
    "source": {
      "x": 892,
      "y": 471,
      "w": 435,
      "h": 409
    }
  }
}).map(([key,entry])=>[key,Object.freeze({...entry,sheet:BUBBLE_SHEET})]));
  const monster = Object.freeze({...{"source": {"x": 253, "y": 380, "w": 751, "h": 586}, "pivot": {"x": 295.29, "y": 580}, "contentHeight": 574},sheet:MONSTER_SHEET});
  function getStaffByIndex(index) { return staff.find(entry=>entry.index===index)||null; }
  function getStaffFor(worker) {
    if(!worker)return staff[0];
    if(worker.role==='innkeeper')return getStaffByIndex(123);
    return getStaffByIndex(worker.spriteIndex)||staff.find(entry=>entry.id===worker.candidateId)||staff[worker.role==='sales'?2:0];
  }
  return Object.freeze({version:2,staff:Object.freeze(staff),looks,bubbles:Object.freeze(bubbles),monster,
    assets:Object.freeze({staff:STAFF_SHEET,bubbles:BUBBLE_SHEET,monster:MONSTER_SHEET}),getStaffByIndex,getStaffFor});
});
