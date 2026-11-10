(function (global) {
  'use strict';

  // Forge research (2026-11, docs/research-achievements-v1.0.md). A per-save gold sink for the mid game:
  // opens with the second branch, each node has 10 levels, higher levels need more branches.
  // Effects apply to every branch. Numbers are provisional (tuned later with every other system).
  const VERSION = 1;
  const MAX_LEVEL = 10;
  const OPEN_TOWNS = 2;
  // Branches needed for a target level: 1-5 → 2, 6-8 → 3, 9-10 → 4.
  const townsFor = level => level <= 5 ? 2 : level <= 8 ? 3 : 4;
  // 2026-11-10 balance pass 3 (2배속 10시간 기준): growth 1.8/1.75 → 1.65/1.6. Lv.8 of every node cost ~3.6M G and was
  // still out of reach at 30h; now ~2M (Lv.8 of 풀무 개량 153k → 83k).
  const NODES = Object.freeze([
    { id: 'forge_bellows', name: '풀무 개량', icon: 'flame', effect: 'craftSpeed', per: .04, base: 2500, growth: 1.65, unit: 'percent', description: '화덕에 바람을 더 보내 제작 속도를 높여요.' },
    { id: 'quench_secret', name: '담금질 비법', icon: 'gem', effect: 'masterworkChance', per: .003, base: 4000, growth: 1.65, unit: 'point', description: '명품 이상 품질이 나올 확률을 높여요. 상한 40%는 그대로예요.' },
    { id: 'craft_manual', name: '제작 교본', icon: 'book', effect: 'craftXp', per: .05, base: 3000, growth: 1.65, unit: 'percent', description: '제조 직원이 제작할 때 얻는 경험치가 늘어요.' },
    { id: 'anvil_precision', name: '정밀 모루', icon: 'hammer', effect: 'enhanceChance', per: .006, base: 3500, growth: 1.65, unit: 'point', description: '강화 성공률을 높여요. 최대 98%까지예요.' },
    { id: 'shop_sign', name: '간판 단장', icon: 'shop', effect: 'salePrice', per: .015, base: 5000, growth: 1.65, unit: 'percent', description: '대장간의 이름값으로 장비 판매가가 올라요.' },
    { id: 'workshop_air', name: '작업장 환기', icon: 'leaf', effect: 'staffFatigue', per: .04, base: 2000, growth: 1.6, unit: 'percent-down', description: '직원이 일할 때 체력이 덜 줄어요.' },
    { id: 'inn_bedding', name: '여관 침구', icon: 'bed', effect: 'restSpeed', per: .06, base: 2000, growth: 1.6, unit: 'percent', description: '모험가가 여관에서 더 빨리 회복해요.' },
    { id: 'hunting_maps', name: '사냥 지도', icon: 'map', effect: 'huntXp', per: .03, base: 4000, growth: 1.65, unit: 'percent', description: '모험가가 사냥에서 얻는 경험치가 늘어요.' }
  ].map(Object.freeze));
  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const cost = (node, level) => Math.ceil(node.base * Math.pow(node.growth, level - 1) / 100) * 100;
  function format(node, level) {
    const v = node.per * level;
    if (node.unit === 'point') return '+' + (Math.round(v * 1000) / 10) + '%p';
    if (node.unit === 'percent-down') return '−' + Math.round(v * 100) + '%';
    return '+' + Math.round(v * 1000) / 10 + '%';
  }

  function create(ctx) {
    const { getOwnedTowns, log, result } = ctx;
    function blank() { return { version: VERSION, levels: {}, spent: 0 }; }
    function init(s) { if (!object(s.research)) s.research = blank(); return s; }
    function normalize(s) { return init(s); }
    function levelOf(s, id) { const r = s && s.research; return r && object(r.levels) && integer(r.levels[id], 0, MAX_LEVEL) ? r.levels[id] : 0; }

    // Total bonus for one effect key (0 when nothing is researched).
    function effect(s, key) {
      if (!s || !object(s.research)) return 0;
      let total = 0;
      for (const n of NODES) if (n.effect === key) total += n.per * levelOf(s, n.id);
      return total;
    }

    function quote(s, id) {
      const node = nodeMap[id]; if (!node) return null;
      const level = levelOf(s, id), towns = getOwnedTowns(s).length, next = level + 1;
      if (level >= MAX_LEVEL) return { id, level, next: null, cost: null, ok: false, maxed: true, reason: '최고 단계에 도달했어요.' };
      const price = cost(node, next), needTowns = townsFor(next);
      let reason = '';
      if (towns < OPEN_TOWNS) reason = '2호점을 열면 연구를 시작할 수 있어요.';
      else if (towns < needTowns) reason = next + '단계는 지점 ' + needTowns + '곳이 있어야 연구할 수 있어요.';
      else if (s.gold < price) reason = price.toLocaleString('ko-KR') + ' G가 필요해요.';
      return { id, level, next, cost: price, needTowns, ok: !reason, maxed: false, reason };
    }

    function getResearch(s) {
      init(s);
      const towns = getOwnedTowns(s).length;
      const nodes = NODES.map(n => {
        const level = levelOf(s, n.id), q = quote(s, n.id);
        return { ...n, level, maxLevel: MAX_LEVEL, current: format(n, level), nextEffect: level < MAX_LEVEL ? format(n, level + 1) : null, quote: q };
      });
      const totalLevels = nodes.reduce((sum, n) => sum + n.level, 0);
      return { open: towns >= OPEN_TOWNS, towns, openTowns: OPEN_TOWNS, nodes, spent: s.research.spent, totalLevels, maxTotal: NODES.length * MAX_LEVEL, maxedCount: nodes.filter(n => n.level >= MAX_LEVEL).length };
    }

    function buy(s, id) {
      init(s);
      const node = nodeMap[id];
      if (!node) return result(false, '그 연구를 찾을 수 없어요.');
      const q = quote(s, id);
      if (!q.ok) return result(false, q.reason);
      s.gold -= q.cost; s.research.levels[id] = q.next; s.research.spent += q.cost;
      log(s, 'research', node.name + ' ' + q.next + '단계 연구 완료 · ' + format(node, q.next) + ' · −' + q.cost.toLocaleString('ko-KR') + ' G', { researchId: id, gold: -q.cost });
      return result(true, node.name + ' ' + q.next + '단계를 연구했어요. 지금 효과 ' + format(node, q.next) + '.', { cost: q.cost, level: q.next });
    }

    function validate(s) {
      try {
        const r = s.research;
        if (r === undefined) return true;
        if (!object(r) || r.version !== VERSION || !integer(r.spent, 0, 1e13) || !object(r.levels)) return false;
        return Object.keys(r.levels).every(k => nodeMap[k] && integer(r.levels[k], 0, MAX_LEVEL));
      } catch (_) { return false; }
    }

    return { init, normalize, validate, effect, getResearch, quote, buy };
  }

  const api = { VERSION, MAX_LEVEL, OPEN_TOWNS, NODES, townsFor, cost, format, create };
  global.ForgeResearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
