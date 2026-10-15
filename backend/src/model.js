export function dateMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || !/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))$/.test(value)) throw new Error('Укажите дату и время в формате ISO 8601 с часовым поясом.');
  return ms;
}

export function validatePlaylist(slots) {
  if (!Array.isArray(slots) || slots.length > 100) throw new Error('Некорректная очередь.');
  const ids = new Set();
  for (const slot of slots) {
    if (!slot.id || ids.has(slot.id) || !Array.isArray(slot.versions) || !slot.versions.length) throw new Error('У места должен быть уникальный ID и хотя бы один объект.');
    ids.add(slot.id);
    for (const version of slot.versions) {
      if (!['image', 'video', 'builtin'].includes(version.kind) || !version.name?.trim()) throw new Error('У объекта должны быть тип и название.');
      if (version.kind === 'builtin' && !version.templateId) throw new Error('Нет ID встроенного слайда.');
      if (version.kind !== 'builtin' && !version.src) throw new Error('Нет адреса файла.');
      if (version.kind === 'image' && (!Number.isFinite(version.durationSeconds) || version.durationSeconds < 1 || version.durationSeconds > 300)) throw new Error('Время баннера: 1–300 секунд.');
      dateMs(version.startAt);
      dateMs(version.endAt);
      if (version.startAt && version.endAt && dateMs(version.endAt) <= dateMs(version.startAt)) throw new Error('Конец должен быть позже начала.');
    }
  }
  return slots;
}

// Конец периода — напоминание, а не команда убрать объект из эфира.
export function project(slots, at = new Date(), revision = 1, draft = false) {
  const now = at instanceof Date ? at.getTime() : dateMs(at);
  if (!Number.isFinite(now)) throw new Error('Некорректная дата предпросмотра.');
  validatePlaylist(slots);
  const items = [];
  let nextChangeMs = Infinity;
  for (const [index, slot] of slots.entries()) {
    for (const version of slot.versions) {
      const starts = dateMs(version.startAt);
      if (starts != null && starts > now && starts < nextChangeMs) nextChangeMs = starts;
    }
    const candidates = slot.versions.filter(v => !v.startAt || dateMs(v.startAt) <= now);
    if (!candidates.length) continue;
    const active = candidates.map((v, i) => ({ v, i })).sort((a, b) => (dateMs(a.v.startAt) ?? -Infinity) - (dateMs(b.v.startAt) ?? -Infinity) || a.i - b.i).at(-1).v;
    items.push({
      id: active.id, slot: slot.id, position: index + 1,
      kind: active.kind, name: active.name, src: active.src,
      templateId: active.templateId, durationSeconds: active.durationSeconds,
      validFrom: active.startAt ?? null, validUntil: active.endAt ?? null,
      overdue: Boolean(active.endAt && dateMs(active.endAt) < now)
    });
  }
  return { revision, draft, generatedAt: new Date(now).toISOString(), nextChangeAt: Number.isFinite(nextChangeMs) ? new Date(nextChangeMs).toISOString() : null, items };
}

export function replaceVersion(slots, slotId, next, startAt = null) {
  const updated = structuredClone(slots);
  const slot = updated.find(s => s.id === slotId);
  if (!slot) throw new Error('Место не найдено.');
  if (startAt) {
    next.startAt = startAt;
    slot.versions.push(next);
  } else {
    const now = Date.now();
    const active = slot.versions.map((v, i) => ({v, i})).filter(x => !x.v.startAt || dateMs(x.v.startAt) <= now).sort((a,b) => (dateMs(a.v.startAt) ?? -Infinity) - (dateMs(b.v.startAt) ?? -Infinity) || a.i - b.i).at(-1);
    if (active) {
      if (!Object.hasOwn(next, 'startAt')) next.startAt = active.v.startAt ?? null;
      if (!Object.hasOwn(next, 'endAt')) next.endAt = active.v.endAt ?? null;
      slot.versions[active.i] = next;
    }
    else slot.versions.push(next);
  }
  return validatePlaylist(updated);
}

export function moveSlot(slots, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1 || from > slots.length || to > slots.length) throw new Error('Номера вне очереди.');
  const updated = structuredClone(slots);
  updated.splice(to - 1, 0, updated.splice(from - 1, 1)[0]);
  return updated;
}

export function referencedAssets(...playlists) {
  return new Set(playlists.flatMap(p => p.flatMap(s => s.versions.map(v => v.assetKey).filter(Boolean))));
}
