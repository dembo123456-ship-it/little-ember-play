(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ForgeSaveStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Keep the main value compatible with existing JSON save files. Metadata and
  // recovery copies are separate; this module never starts a new game itself.
  const MAX_SCAN_KEYS = 10000, MAX_RECOVERY_KEYS = 512;

  function create({ storage, key, normalize, now = Date.now } = {}) {
    if (!storage || typeof key !== 'string' || !key || typeof normalize !== 'function' || typeof now !== 'function') throw new TypeError('A storage adapter, key and normalizer are required.');
    const backupKey = key + '-backup', recoveryPrefix = key + '-recovery-';
    const knownRecoveryKeys = new Set();
    const listedRaw = new Map();
    let loaded = false, baselineKnown = false, expectedRaw = null, originalRaw = null;
    let blocked = false, reason = null, savedAt = null, recoveryKey = null, detail = null;

    const timestamp = () => { try { const value = now(); return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null; } catch (_) { return null; } };
    const isRecoveryKey = value => typeof value === 'string' && value.startsWith(recoveryPrefix) && /^\d+(?:-\d+)?$/.test(value.slice(recoveryPrefix.length));
    const numberOrNull = value => Number.isFinite(value) ? value : null;

    function readRaw(name) {
      const raw = storage.getItem(name);
      if (raw !== null && typeof raw !== 'string') throw new Error('Storage did not return a string or null.');
      return raw;
    }
    function decode(raw) {
      if (typeof raw !== 'string') throw new Error('Missing save.');
      const state = normalize(JSON.parse(raw));
      if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid save.');
      return state;
    }
    function metadata(name) {
      try {
        const value = JSON.parse(readRaw(name + '-meta'));
        return value && Number.isFinite(value.savedAt) && value.savedAt >= 0 ? value.savedAt : null;
      } catch (_) { return null; }
    }
    function writeMetadata(name, value) {
      try { storage.setItem(name + '-meta', JSON.stringify({ savedAt: value })); return true; }
      catch (_) { return false; }
    }
    function fail(code, protect = false, raw) {
      if (typeof raw === 'string' && originalRaw === null) originalRaw = raw;
      if (protect) { blocked = true; reason = code; }
      else if (!blocked) reason = code;
      return { ok: false, reason: code };
    }
    function readMain() {
      try { return { ok: true, raw: readRaw(key) }; }
      catch (_) { return fail('read', true, baselineKnown ? expectedRaw : undefined); }
    }
    function recoveryKeys() {
      const keys = new Set(knownRecoveryKeys);
      let readError = false;
      try {
        if (typeof storage.key === 'function') {
          const length = storage.length;
          if (!Number.isInteger(length) || length < 0) throw new Error('Invalid storage length.');
          for (let i = 0; i < Math.min(length, MAX_SCAN_KEYS); i++) {
            const candidate = storage.key(i);
            // Enumerate names only. Never read another application's values.
            if (isRecoveryKey(candidate)) keys.add(candidate);
          }
          if (length > MAX_SCAN_KEYS) readError = true;
        }
      } catch (_) { readError = true; }
      const selected = [...keys].sort((a, b) => Number(b.slice(recoveryPrefix.length).split('-')[0]) - Number(a.slice(recoveryPrefix.length).split('-')[0])).slice(0, MAX_RECOVERY_KEYS);
      return { keys: selected, readError };
    }
    function backupCandidates(capturePreview = false) {
      const found = recoveryKeys(), candidates = [];
      if (capturePreview) listedRaw.clear();
      let readError = found.readError;
      for (const name of [backupKey, ...found.keys]) {
        let raw;
        try { raw = readRaw(name); }
        catch (_) { readError = true; continue; }
        if (raw === null) continue;
        try {
          const state = decode(raw);
          if (capturePreview) listedRaw.set(name, raw);
          candidates.push({ key: name, savedAt: metadata(name), time: numberOrNull(state.time), day: numberOrNull(state.day), gold: numberOrNull(state.gold) });
        } catch (_) { /* Invalid originals remain untouched and exportable. */ }
      }
      candidates.sort((a, b) => (b.savedAt ?? -1) - (a.savedAt ?? -1) || (b.time ?? -1) - (a.time ?? -1));
      return { candidates, readError };
    }
    function archive(raw, sourceSavedAt) {
      if (raw === null) return { ok: true, key: null };
      // Repeated failed loads should not consume a new copy on every refresh.
      for (const name of recoveryKeys().keys) {
        try { if (readRaw(name) === raw) { recoveryKey = name; knownRecoveryKeys.add(name); return { ok: true, key: name }; } }
        catch (_) { /* A fresh unused key may still be writable. */ }
      }
      const base = recoveryPrefix + (timestamp() ?? 0);
      for (let collision = 0; collision < MAX_RECOVERY_KEYS; collision++) {
        const name = base + (collision ? '-' + collision : '');
        let existing;
        try { existing = readRaw(name); }
        catch (_) { return { ok: false }; }
        if (existing !== null && existing !== raw) continue;
        try {
          if (existing === null) storage.setItem(name, raw);
          writeMetadata(name, sourceSavedAt);
          recoveryKey = name; knownRecoveryKeys.add(name);
          return { ok: true, key: name };
        } catch (_) { return { ok: false }; }
      }
      return { ok: false };
    }

    function load() {
      loaded = true;
      const current = readMain();
      if (!current.ok) return current;
      expectedRaw = current.raw; baselineKnown = true; savedAt = metadata(key);
      if (current.raw === null) {
        savedAt = null;
        const backups = backupCandidates();
        if (backups.candidates.length) return fail('missing', true);
        if (backups.readError) return fail('read', true);
        blocked = false; reason = null;
        return { ok: true, state: null, savedAt: null };
      }
      try {
        const state = decode(current.raw);
        blocked = false; reason = null;
        return { ok: true, state, savedAt };
      } catch (_) {
        originalRaw = current.raw;
        fail('invalid', true, current.raw);
        archive(current.raw, savedAt);
        return { ok: false, reason: 'invalid', raw: current.raw };
      }
    }

    function writeMain(raw, priorRaw) {
      // A second comparison also catches changes that occur while preparing a
      // backup. localStorage has no compare-and-swap; keep this window short.
      const current = readMain();
      if (!current.ok) return current;
      if (current.raw !== priorRaw) return fail('conflict', true, current.raw);
      try { storage.setItem(key, raw); }
      catch (_) { return fail('write'); }
      expectedRaw = raw; baselineKnown = true; loaded = true;
      savedAt = timestamp(); blocked = false; reason = null;
      const metadataSaved = writeMetadata(key, savedAt);
      return { ok: true, savedAt, metadataSaved };
    }
    function save(state, { replace = false } = {}) {
      const current = readMain();
      if (!current.ok) return current;
      if (!replace) {
        if (!loaded || !baselineKnown) return fail('read', true);
        if (current.raw !== expectedRaw) return fail('conflict', true, current.raw);
        if (blocked) return { ok: false, reason };
      }
      let raw;
      try { raw = JSON.stringify(state); decode(raw); }
      catch (error) { detail = error && error.detail || String(error && error.message || error).slice(0, 80); return fail('snapshot'); }
      if (replace && current.raw !== null) {
        if (originalRaw === null) originalRaw = current.raw;
        if (!archive(current.raw, metadata(key)).ok) return fail('archive');
      } else if (!replace && current.raw !== null && current.raw !== raw) {
        // The unchanged baseline was validated by load() or a successful save.
        // If quota prevents the backup, leave the only good main save intact.
        try { storage.setItem(backupKey, current.raw); }
        catch (_) { return fail('archive'); }
        writeMetadata(backupKey, savedAt);
      }
      return writeMain(raw, current.raw);
    }
    function recover(name) {
      if (name !== backupKey && !isRecoveryKey(name)) return fail('invalid');
      let raw, state;
      try { raw = readRaw(name); }
      catch (_) { return fail('read', true); }
      // A rolling backup can change in another tab while its confirmation is
      // open. Only restore the exact snapshot the user was shown.
      if (listedRaw.has(name) && listedRaw.get(name) !== raw) return fail('conflict', true);
      try { state = decode(raw); }
      catch (_) { return fail('invalid'); }
      const current = readMain();
      if (!current.ok) return current;
      if (current.raw !== null) {
        if (originalRaw === null) originalRaw = current.raw;
        if (!archive(current.raw, metadata(key)).ok) return fail('archive');
      }
      const written = writeMain(raw, current.raw);
      return written.ok ? { ...written, state } : written;
    }
    function exportOriginal() {
      if (typeof originalRaw === 'string') return originalRaw;
      try { return readRaw(key); }
      catch (_) { return baselineKnown && typeof expectedRaw === 'string' ? expectedRaw : null; }
    }
    function info() {
      return { loaded, blocked, reason, detail: reason ? detail : null, savedAt, backupKey, recoveryKey, hasOriginal: typeof originalRaw === 'string' || baselineKnown && typeof expectedRaw === 'string' };
    }
    return Object.freeze({ load, save, recover, exportOriginal, listBackups: () => backupCandidates(true).candidates, info });
  }

  return Object.freeze({ create });
});
