(function (global) {
  'use strict';

  // Presentation only: the simulation keeps the complete event history. A boss
  // burst has one visible line and one counter, never an ever-growing UI queue.
  const CRAFT_SECONDS = 6.5;
  const BOSS_SECONDS = 6;
  const CRAFT_QUEUE_LIMIT = 3;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const validYear = value => Number.isSafeInteger(value) && value > 0;

  function normalizePreferences(value) {
    const source = value && typeof value === 'object' ? value : {};
    return { centralNotifications: source.centralNotifications !== false, festivalSeenYear: validYear(source.festivalSeenYear) ? source.festivalSeenYear : 0 };
  }

  function create(options) {
    options = options || {};
    const preferences = normalizePreferences(options.preferences);
    const craftRoot = options.craftRoot || null;
    const bossRoot = options.bossRoot || null;
    const festivalRoot = options.festivalRoot || null;
    const doc = options.document || (typeof document !== 'undefined' ? document : null);
    const renderIcon = typeof options.renderIcon === 'function' ? options.renderIcon : () => '';
    const craftQueue = [];
    const cleanup = [];
    const returnFocus = new Map();
    let activeCraft = null, craftRemaining = 0, craftHovered = false;
    let activeBoss = null, bossRemaining = 0, bossHovered = false;
    let currentFestival = null, activeFestival = null;
    let busy = false, hidden = false, destroyed = false;
    let craftHTMLKey = null, bossHTMLKey = null, festivalHTMLKey = null;
    let sequence = 0;

    function persist(patch) {
      Object.assign(preferences, patch);
      if (typeof options.onPreferencesChange === 'function') options.onPreferencesChange({ ...patch });
    }

    function isBusy() {
      return busy || (typeof options.isBusy === 'function' && !!options.isBusy());
    }

    function isOpenFestival(festival) {
      return !!festival && festival.status === 'open' && validYear(festival.year);
    }

    function rootFocused(root) {
      return !!(root && doc && doc.activeElement && root.contains && root.contains(doc.activeElement));
    }

    function focusCandidate(element) {
      if (!element || element === doc?.body || typeof element.focus !== 'function' || element.isConnected === false || element.disabled) return false;
      if (element.closest && element.closest('[hidden]')) return false;
      if (element.getClientRects && !element.getClientRects().length) return false;
      return ![craftRoot, bossRoot, festivalRoot].some(root => root && root.contains && root.contains(element));
    }

    function rememberFocus(root, element) {
      if (focusCandidate(element)) returnFocus.set(root, element);
    }

    function restoreFocus(root) {
      // Never move focus just because a notification appeared/disappeared. Only
      // restore it if it is currently inside the card being hidden. In
      // particular, joining the festival restores a visible external control
      // BEFORE the app opens its modal and records its return-focus target.
      if (!rootFocused(root)) return;
      for (const element of [returnFocus.get(root), options.focusFallback]) {
        if (!focusCandidate(element)) continue;
        element.focus({ preventScroll: true });
        break;
      }
    }

    function setHidden(root, value) {
      if (!root || root.hidden === value) return;
      if (value) restoreFocus(root);
      else if (doc) rememberFocus(root, doc.activeElement);
      root.hidden = value;
    }

    function closeButton(action, label) {
      return '<button type="button" class="notification-close" data-notification-action="' + action + '" aria-label="' + escape(label) + '" title="' + escape(label) + '">' + (renderIcon('close') || '<span aria-hidden="true">×</span>') + '</button>';
    }

    function renderCraftContent(event) {
      if (typeof options.renderCraft === 'function') return options.renderCraft(event);
      return '<span class="moment-kicker">A PIECE TO REMEMBER</span><div class="moment-heading"><div><h2>' + escape(event.itemName || '멋진 장비가 완성됐어요') + '</h2><p>' + escape(event.text || '') + '</p></div></div>';
    }

    function bossText() {
      if (!activeBoss) return '';
      const event = activeBoss.event;
      const main = event.text || (event.bossName || '보스') + ' 토벌 성공' + (Number.isFinite(event.delta) ? ' · 명성 +' + event.delta : '');
      return main + (activeBoss.count > 1 ? ' · 외 ' + (activeBoss.count - 1).toLocaleString('ko-KR') + '건' : '');
    }

    function render() {
      const blocked = hidden || isBusy();
      const showFestival = !!activeFestival && !blocked;
      const showCraft = !!activeCraft && preferences.centralNotifications && !blocked && !showFestival;

      if (craftRoot) {
        if (activeCraft && craftHTMLKey !== activeCraft.key) {
          craftRoot.innerHTML = '<article class="fame-moment crafted-moment notification-craft" role="dialog" aria-modal="false" aria-label="장비 제작 알림">' + closeButton('dismiss-craft', '제작 알림 닫기') + renderCraftContent(activeCraft.event) + '<div class="moment-controls"><button type="button" class="moment-disable" data-notification-action="disable-central">중앙 알림 끄기</button><span>설정에서 다시 켤 수 있어요</span></div><div class="moment-timer" aria-hidden="true"><i></i></div></article>';
          craftHTMLKey = activeCraft.key;
        }
        setHidden(craftRoot, !showCraft);
        const timer = activeCraft && craftRoot.querySelector ? craftRoot.querySelector('.moment-timer i') : null;
        if (timer) timer.style.width = Math.max(0, Math.min(100, craftRemaining / CRAFT_SECONDS * 100)) + '%';
      }

      if (bossRoot) {
        const text = bossText();
        if (text && bossHTMLKey !== text && !rootFocused(bossRoot)) {
          // Both title and aria-label keep the full line when the visual text is
          // ellipsized. Text is escaped; NPC/boss names are never interpreted.
          bossRoot.innerHTML = '<div class="boss-notification-line" title="' + escape(text) + '" aria-label="' + escape(text) + '"><span class="boss-notification-icon" aria-hidden="true">' + renderIcon('shield') + '</span><span class="boss-notification-text">' + escape(text) + '</span>' + closeButton('dismiss-boss', '토벌 알림 닫기') + '</div>';
          bossHTMLKey = text;
        }
        setHidden(bossRoot, !activeBoss || hidden);
      }

      if (festivalRoot) {
        if (activeFestival && festivalHTMLKey !== activeFestival.year) {
          festivalRoot.innerHTML = '<article class="festival-reminder" role="dialog" aria-modal="false" aria-labelledby="festival-reminder-title">' + closeButton('dismiss-festival', '장비 축제 안내 닫기') + '<span class="festival-reminder-art" aria-hidden="true">' + renderIcon('trophy') + '</span><span class="moment-kicker">YEAR ' + activeFestival.year + ' · THE EQUIPMENT FESTIVAL</span><h2 id="festival-reminder-title">장비 축제 출품이 열렸어요</h2><p>올해 가장 자랑스러운 장비를 출품해 보세요.<br>최대 ' + Math.max(1, Math.floor(Number(activeFestival.maxEntries) || 3)) + '점까지 접수할 수 있어요.</p><div class="festival-reminder-date">매년 봄 10–14일 접수 · 15일 시상</div><small>출품한 장비는 시상 후 창고로 돌아옵니다.</small><div class="festival-reminder-actions"><button type="button" class="festival-reminder-dismiss" data-notification-action="dismiss-festival">닫기</button><button type="button" class="primary-button" data-notification-action="join-festival">' + renderIcon('trophy') + ' 참가하기</button></div></article>';
          festivalHTMLKey = activeFestival.year;
        }
        setHidden(festivalRoot, !showFestival);
      }
    }

    function enqueue(event) {
      if (destroyed || !event || typeof event !== 'object') return false;
      if (event.type === 'fame-boss') {
        activeBoss = { event: clone(event), count: Math.min(Number.MAX_SAFE_INTEGER, (activeBoss ? activeBoss.count : 0) + 1) };
        bossRemaining = BOSS_SECONDS;
        render();
        return true;
      }
      if (event.type !== 'fame-craft' || !preferences.centralNotifications) return false;
      craftQueue.push({ event: clone(event), key: ++sequence });
      // Preserve the currently visible craft, then keep only the three newest
      // waiting highlights. The complete crafting history remains in the log.
      if (craftQueue.length > CRAFT_QUEUE_LIMIT) craftQueue.shift();
      return true;
    }

    function update(elapsed, context) {
      if (destroyed) return;
      context = context || {};
      hidden = !!context.hidden;
      busy = !!context.busy;
      const dt = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
      if (Object.prototype.hasOwnProperty.call(context, 'festival')) currentFestival = isOpenFestival(context.festival) ? { year: context.festival.year, maxEntries: context.festival.maxEntries } : null;

      if (!currentFestival || (activeFestival && currentFestival.year !== activeFestival.year)) activeFestival = null;
      const blocked = hidden || isBusy();
      // Detect the period itself, not only its opening event: opening an older
      // save/reloading during submission still produces this year's reminder.
      // Mark it seen only when actually presented, never while a form is open.
      if (currentFestival && currentFestival.year !== preferences.festivalSeenYear && !blocked) {
        activeFestival = { ...currentFestival };
        persist({ festivalSeenYear: activeFestival.year });
      }

      if (!hidden && activeBoss && !bossHovered && !rootFocused(bossRoot)) {
        bossRemaining -= dt;
        if (bossRemaining <= 0) activeBoss = null;
      }
      if (!blocked && !activeFestival) {
        if (activeCraft && !craftHovered && !rootFocused(craftRoot)) {
          craftRemaining -= dt;
          if (craftRemaining <= 0) activeCraft = null;
        }
        if (!activeCraft && craftQueue.length && preferences.centralNotifications) {
          activeCraft = craftQueue.shift();
          craftRemaining = CRAFT_SECONDS;
          if (typeof options.onCraftShown === 'function') options.onCraftShown(clone(activeCraft.event));
        }
      }
      render();
    }

    function dismissCraft() {
      if (destroyed) return;
      activeCraft = null;
      craftRemaining = 0;
      craftHovered = false;
      render();
    }

    function dismissBoss() {
      if (destroyed) return;
      activeBoss = null;
      bossRemaining = 0;
      bossHovered = false;
      render();
    }

    function dismissFestival() {
      if (destroyed) return;
      activeFestival = null;
      render();
    }

    function joinFestival() {
      if (destroyed || hidden || isBusy() || !activeFestival || !currentFestival || currentFestival.year !== activeFestival.year) return false;
      const year = activeFestival.year;
      dismissFestival();
      if (typeof options.onFestivalJoin === 'function') options.onFestivalJoin(year);
      return true;
    }

    function setCentralEnabled(enabled) {
      if (destroyed) return;
      const next = !!enabled;
      if (preferences.centralNotifications !== next) persist({ centralNotifications: next });
      if (!next) {
        craftQueue.length = 0;
        activeCraft = null;
        craftRemaining = 0;
        craftHovered = false;
      }
      render();
    }

    function clear() {
      craftQueue.length = 0;
      activeCraft = null; activeBoss = null; activeFestival = null; currentFestival = null;
      craftRemaining = 0; bossRemaining = 0; craftHovered = false; bossHovered = false;
      craftHTMLKey = null; bossHTMLKey = null; festivalHTMLKey = null;
      for (const root of [craftRoot, bossRoot, festivalRoot]) if (root) { setHidden(root, true); root.innerHTML = ''; }
      // A routine visual reset is NOT a new campaign. Seen-year and the user's
      // central-alert preference deliberately survive clear().
    }

    function resetFestivalReminder() {
      if (destroyed) return;
      activeFestival = null;
      currentFestival = null;
      festivalHTMLKey = null;
      if (preferences.festivalSeenYear) persist({ festivalSeenYear: 0 });
      render();
    }

    const actions = {
      'dismiss-craft': dismissCraft,
      'disable-central': () => setCentralEnabled(false),
      'dismiss-boss': dismissBoss,
      'dismiss-festival': dismissFestival,
      'join-festival': joinFestival
    };

    function listen(root, type, handler) {
      if (!root || !root.addEventListener) return;
      root.addEventListener(type, handler);
      cleanup.push(() => root.removeEventListener && root.removeEventListener(type, handler));
    }

    for (const root of [craftRoot, bossRoot, festivalRoot]) {
      if (!root) continue;
      listen(root, 'pointerdown', () => { if (doc) rememberFocus(root, doc.activeElement); });
      listen(root, 'focusin', event => rememberFocus(root, event.relatedTarget));
      listen(root, 'click', event => {
        const button = event.target && event.target.closest ? event.target.closest('[data-notification-action]') : null;
        if (!button || (root.contains && !root.contains(button)) || !actions[button.dataset.notificationAction]) return;
        event.preventDefault();
        event.stopPropagation();
        actions[button.dataset.notificationAction]();
      });
      // Native buttons already support Enter/Space. Escape is local to a
      // notification, so it cannot discard an unrelated editor's draft.
      listen(root, 'keydown', event => {
        if (event.key !== 'Escape' || root.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        if (root === festivalRoot) dismissFestival();
        else if (root === craftRoot) dismissCraft();
        else dismissBoss();
      });
    }
    listen(craftRoot, 'pointerenter', () => { craftHovered = true; });
    listen(craftRoot, 'pointerleave', () => { craftHovered = false; });
    listen(bossRoot, 'pointerenter', () => { bossHovered = true; });
    listen(bossRoot, 'pointerleave', () => { bossHovered = false; });
    clear();

    function snapshot() {
      return {
        preferences: { ...preferences },
        craft: activeCraft ? clone(activeCraft.event) : null,
        craftRemaining,
        craftQueue: craftQueue.map(entry => clone(entry.event)),
        boss: activeBoss ? { ...clone(activeBoss), text: bossText(), remaining: bossRemaining } : null,
        festival: activeFestival ? { ...activeFestival } : null,
        festivalPending: !!currentFestival && currentFestival.year !== preferences.festivalSeenYear,
        busy: !!isBusy(), hidden
      };
    }

    function destroy() {
      if (destroyed) return;
      clear();
      destroyed = true;
      cleanup.forEach(remove => remove());
    }

    return Object.freeze({ enqueue, update, clear, dismissCraft, dismissBoss, dismissFestival, joinFestival, setCentralEnabled, resetFestivalReminder, snapshot, destroy });
  }

  const api = Object.freeze({ create, normalizePreferences, CRAFT_SECONDS, BOSS_SECONDS, CRAFT_QUEUE_LIMIT });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ForgeNotifications = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
