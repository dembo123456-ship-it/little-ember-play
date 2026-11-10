(function (global) {
  'use strict';

  // Geography and the Lv.1–300 hunt progression share stable location IDs.
  // Hunt rewards remain unchanged; the original power also anchors arrival gold
  // and boss rewards independently of the expanded difficulty curve.
  const TOWNS = [
    { id: 'greenwood', x: 420, y: 1280, biome: 'forest', recommendedLevel: 1, levelRange: [1,30], arrivalGoldBonus: 0 },
    { id: 'stonebridge', x: 760, y: 930, biome: 'highland', recommendedLevel: 40, levelRange: [40,90], arrivalGoldBonus: 228 },
    { id: 'moonhaven', x: 1280, y: 1240, biome: 'coast', recommendedLevel: 100, levelRange: [100,160], arrivalGoldBonus: 480 },
    { id: 'sunspire', x: 1350, y: 630, biome: 'wasteland', recommendedLevel: 175, levelRange: [175,230], arrivalGoldBonus: 720 },
    { id: 'frostgate', x: 1630, y: 260, biome: 'snow', recommendedLevel: 245, levelRange: [245,300], arrivalGoldBonus: 1230 }
  ];
  // Explicit levels follow the previous combat-power order within each town.
  // Keeping that order also keeps the existing index-based hunt stone rewards.
  const REGION_LEVELS = {
    greenwood: 1, fern_hollow: 3, brook_glen: 5, meadow: 8, moss_cavern: 11,
    oldroad: 14, boar_thicket: 18, sunny_orchard: 22, quarry: 26, ancient_grove: 30,
    riverbank: 40, granite_pass: 45, willow_marsh: 50, ironwood_crossing: 55, ruins: 60,
    shattered_bridge: 66, echo_tunnel: 72, abandoned_mine: 78, sunken_archive: 84, fortress: 90,
    ridge: 100, pearl_delta: 106, coast: 112, saltwind_cliffs: 118, lunar_mangrove: 124,
    coral_labyrinth: 130, siren_cove: 136, catacombs: 144, tideglass_isle: 152, forgotten_lighthouse: 160,
    abyss: 175, ember_mesa: 181, desert: 187, ochre_dunes: 193, windscar_waste: 199,
    scorpion_oasis: 205, canyon: 211, sunken_maze: 217, dragonbone_basin: 224, amber_watch: 230,
    tundra: 245, frostpine: 251, whitechasm: 257, silent_steppe: 263, icekeep: 269,
    glacier_maze: 275, astral: 281, starfall_crater: 287, obsidian_peak: 294, lava: 300
  };
  const powerForLevel = level => Math.round(8 + (level - 1) * 4.2);
  // id, town, x, y, biome, optional new name, donor, original minimum power.
  const rows = [
    ['greenwood','greenwood',340,1120,'forest'],
    ['meadow','greenwood',520,1130,'meadow'],
    ['oldroad','greenwood',610,1290,'road'],
    ['quarry','greenwood',690,1120,'quarry'],
    ['fern_hollow','greenwood',230,1250,'forest','고사리 골짜기','greenwood',10],
    ['brook_glen','greenwood',350,1420,'wetland','개울빛 숲','greenwood',12],
    ['moss_cavern','greenwood',180,1400,'cave','이끼 동굴','oldroad',18],
    ['boar_thicket','greenwood',535,1450,'forest','멧돼지 덤불숲','meadow',22],
    ['sunny_orchard','greenwood',740,1430,'meadow','해바람 과수원','meadow',24],
    ['ancient_grove','greenwood',780,1270,'forest','오래된 정령림','quarry',30],

    ['riverbank','stonebridge',550,950,'wetland'],
    ['ruins','stonebridge',930,970,'ruins'],
    ['abandoned_mine','stonebridge',800,760,'mine'],
    ['fortress','stonebridge',1000,800,'fortress'],
    ['granite_pass','stonebridge',605,770,'mountain','화강암 고갯길','riverbank',42],
    ['willow_marsh','stonebridge',450,790,'wetland','버드나무 늪','riverbank',44],
    ['shattered_bridge','stonebridge',1050,1100,'road','끊어진 다리길','ruins',52],
    ['echo_tunnel','stonebridge',650,590,'mine','메아리 굴길','abandoned_mine',56],
    ['sunken_archive','stonebridge',835,575,'labyrinth','잠겨버린 서고','abandoned_mine',65],
    ['ironwood_crossing','stonebridge',430,620,'forest','철나무 삼거리','riverbank',46],

    ['ridge','moonhaven',1135,960,'snowmountain'],
    ['coast','moonhaven',1470,1360,'coast'],
    ['catacombs','moonhaven',1340,1020,'labyrinth'],
    ['pearl_delta','moonhaven',1000,1370,'wetland','진주빛 삼각주','ridge',82],
    ['saltwind_cliffs','moonhaven',1650,1270,'coast','소금바람 절벽','coast',96],
    ['lunar_mangrove','moonhaven',1160,1450,'forest','달그림자 수림','coast',100],
    ['coral_labyrinth','moonhaven',1640,1435,'labyrinth','산호의 미궁','catacombs',104],
    ['siren_cove','moonhaven',1480,1150,'coast','노랫소리 만','coast',106],
    ['tideglass_isle','moonhaven',1780,1350,'coast','물결유리 섬','catacombs',114],
    ['forgotten_lighthouse','moonhaven',1710,1090,'coast','잊힌 등대','catacombs',118],

    ['abyss','sunspire',1450,810,'cave'],
    ['desert','sunspire',1580,650,'desert'],
    ['canyon','sunspire',1180,770,'canyon'],
    ['ember_mesa','sunspire',1770,790,'wasteland','불씨 메마른 대지','abyss',130],
    ['ochre_dunes','sunspire',1770,570,'desert','황토빛 모래언덕','desert',150],
    ['windscar_waste','sunspire',1460,460,'wasteland','바람흉터 황무지','desert',158],
    ['scorpion_oasis','sunspire',1640,430,'oasis','전갈의 오아시스','canyon',165],
    ['sunken_maze','sunspire',1170,580,'labyrinth','가라앉은 미로','canyon',180],
    ['dragonbone_basin','sunspire',1320,400,'wasteland','용뼈 분지','canyon',190],
    ['amber_watch','sunspire',1040,420,'fortress','호박빛 감시탑','canyon',195],

    ['tundra','frostgate',1830,360,'snow'],
    ['icekeep','frostgate',1500,100,'icefortress'],
    ['astral','frostgate',1890,180,'astral'],
    ['lava','frostgate',1940,700,'volcano'],
    ['frostpine','frostgate',1390,250,'snowforest','서리소나무 숲','tundra',212],
    ['whitechasm','frostgate',1200,180,'snowmountain','하얀 균열','tundra',225],
    ['silent_steppe','frostgate',1120,330,'snow','고요한 설원','tundra',235],
    ['glacier_maze','frostgate',1700,100,'icelabyrinth','빙하의 미궁','icekeep',265],
    ['starfall_crater','frostgate',1950,380,'astral','별무리 충돌지','astral',320],
    ['obsidian_peak','frostgate',1020,150,'mountain','흑요석 봉우리','astral',335]
  ];
  const LOCATIONS = rows.map(([id,townId,x,y,biome,name,donorId,baseMinPower]) => ({ id, townId, x, y, biome, recommendedLevel: REGION_LEVELS[id], minPower: powerForLevel(REGION_LEVELS[id]), ...(name ? {name,donorId,baseMinPower} : {}) }));
  const COASTLINE = [[140,1440],[110,1250],[230,1070],[180,890],[300,700],[460,600],[520,400],[690,260],[900,230],[1000,120],[1220,100],[1390,40],[1630,60],[1780,120],[1930,260],[1990,450],[1920,680],[1980,900],[1840,1090],[1790,1290],[1610,1450],[1390,1510],[1130,1490],[910,1570],[640,1550],[410,1600],[240,1550]];
  const RIVERS = [
    [[1580,250],[1470,440],[1310,520],[1240,690],[1030,800],[995,1020],[1100,1180],[1130,1370],[1190,1495]],
    [[650,520],[570,700],[590,850],[660,1030],[600,1230],[420,1380],[300,1530]]
  ];
  const MAIN_PATHS = [
    ['greenwood','stonebridge',[[420,1280],[540,1190],[620,1070],[760,930]]],
    ['stonebridge','moonhaven',[[760,930],[900,1040],[1050,1100],[1180,1190],[1280,1240]]],
    ['stonebridge','sunspire',[[760,930],[890,810],[1060,730],[1210,660],[1350,630]]],
    ['sunspire','frostgate',[[1350,630],[1430,490],[1510,370],[1630,260]]],
    ['moonhaven','sunspire',[[1280,1240],[1430,1100],[1540,930],[1450,810],[1350,630]]]
  ];
  const CHAINS = [
    ['@greenwood','greenwood','meadow','quarry'],
    ['@greenwood','fern_hollow','moss_cavern','brook_glen','boar_thicket','sunny_orchard','ancient_grove','oldroad','@greenwood'],
    ['@stonebridge','riverbank','willow_marsh','ironwood_crossing','echo_tunnel','sunken_archive','abandoned_mine','@stonebridge'],
    ['@stonebridge','ruins','fortress'],['ruins','shattered_bridge'],['@stonebridge','granite_pass','echo_tunnel'],
    ['@moonhaven','ridge','catacombs','siren_cove','forgotten_lighthouse'],
    ['@moonhaven','pearl_delta','lunar_mangrove','coast','coral_labyrinth','tideglass_isle','saltwind_cliffs','siren_cove'],
    ['@sunspire','sunken_maze','amber_watch','dragonbone_basin','windscar_waste','@sunspire'],
    ['@sunspire','desert','scorpion_oasis','ochre_dunes','ember_mesa','abyss','canyon','sunken_maze'],
    ['@frostgate','frostpine','whitechasm','obsidian_peak','silent_steppe','frostpine'],
    ['@frostgate','icekeep','glacier_maze','astral','tundra','starfall_crater','lava']
  ];
  const key = value => value.startsWith('@') ? 'town:' + value.slice(1) : 'region:' + value;
  const lookup = Object.fromEntries([...TOWNS.map(t => ['town:'+t.id,t]),...LOCATIONS.map(r=>['region:'+r.id,r])]);
  const PATHS = MAIN_PATHS.map(([from,to,points])=>({from:'town:'+from,to:'town:'+to,kind:'road',points}));
  for (const chain of CHAINS) for (let i=1;i<chain.length;i++) {
    const from=key(chain[i-1]),to=key(chain[i]),a=lookup[from],b=lookup[to];
    const bend=((a.x+b.y)%3-1)*16;
    PATHS.push({from,to,kind:'trail',points:[[a.x,a.y],[(a.x+b.x)/2+bend,(a.y+b.y)/2-bend],[b.x,b.y]]});
  }
  const WORLD = {
    width:2080,height:1640,levelRange:[1,300],towns:TOWNS,locations:LOCATIONS,paths:PATHS,coastline:COASTLINE,rivers:RIVERS,
    islands:[{x:1780,y:1350,rx:90,ry:83},{x:1940,y:1130,rx:42,ry:28},{x:1810,y:1500,rx:36,ry:23},{x:90,y:980,rx:40,ry:56}],
    bridges:[{x:1038,y:1092,angle:-.45},{x:1107,y:744,angle:.60},{x:1474,y:433,angle:-.58},{x:633,y:1110,angle:-.40}],
    mountainSpines:[[[930,280],[870,370],[790,450],[710,520]],[[1200,240],[1150,340],[1100,450],[1060,535]],[[1550,330],[1620,365],[1730,440]],[[1750,850],[1790,940],[1780,1020]]]
  };

  function extendData(DATA) {
    const existing=new Map(DATA.regions.map(r=>[r.id,r]));
    for (const place of LOCATIONS) {
      let region=existing.get(place.id);
      if (!region) {
        const donor=existing.get(place.donorId);
        if (!donor) throw new Error('Missing world region donor: '+place.donorId);
        // A donor may already have its new difficulty. Preserve this location's
        // own original threshold, rather than inheriting the donor's baseline.
        region={...donor,id:place.id,name:place.name,minPower:place.minPower,baseMinPower:place.baseMinPower,loot:Object.fromEntries(Object.entries(donor.loot).map(([m,v])=>[m,[...v]])),description:place.name+' 일대를 탐험하며 '+donor.name+'에서 얻을 수 있는 재료를 찾습니다.'};
        DATA.regions.push(region);existing.set(region.id,region);
      }
      if (region.baseMinPower == null) region.baseMinPower=region.minPower;
      Object.assign(region,{townId:place.townId,mapX:place.x,mapY:place.y,biome:place.biome,recommendedLevel:place.recommendedLevel,minPower:place.minPower});
    }
    for (const town of DATA.towns) {
      const position=TOWNS.find(t=>t.id===town.id);if (!position) continue;
      Object.assign(town,{mapX:position.x,mapY:position.y,biome:position.biome,recommendedLevel:position.recommendedLevel,levelRange:[...position.levelRange],arrivalGoldBonus:position.arrivalGoldBonus,regionIds:LOCATIONS.filter(r=>r.townId===town.id).map(r=>r.id)});
    }
    for (const boss of DATA.bosses || []) {
      const region=existing.get(boss.regionId);if (!region) continue;
      if (boss.baseMinPower == null) boss.baseMinPower=boss.minPower;
      boss.minPower=boss.baseMinPower+region.minPower-region.baseMinPower;
      boss.enhancementStoneBonus=Math.floor(boss.baseMinPower/65);
    }
    DATA.regions.sort((a,b)=>a.minPower-b.minPower||a.id.localeCompare(b.id));
    return DATA;
  }
  function getTown(id) { return TOWNS.find(t=>t.id===id)||null; }
  function getLocation(id) { return LOCATIONS.find(r=>r.id===id)||null; }
  const api={WORLD,extendData,getTown,getLocation};
  global.ForgeWorld=api;
  if (typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
