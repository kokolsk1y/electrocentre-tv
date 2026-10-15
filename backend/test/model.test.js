import test from 'node:test';
import assert from 'node:assert/strict';
import { moveSlot, project, replaceVersion, validatePlaylist } from '../src/model.js';
import { INITIAL_PLAYLIST } from '../src/seed.js';

const image = (id, startAt, endAt) => ({ id, kind: 'image', name: id, src: `${id}.webp`, durationSeconds: 10, startAt, endAt });

test('исходная очередь сохраняет порядок 5 сцен, 7 роликов и 6 баннеров', () => {
  const result = project(INITIAL_PLAYLIST, '2026-10-15T10:00:00+03:00');
  assert.equal(result.items.length, 18);
  assert.deepEqual(result.items.map(i => i.kind), ['builtin', 'video', 'builtin', 'image', 'video', 'builtin', 'builtin', 'image', 'video', 'builtin', 'image', 'video', 'image', 'video', 'image', 'video', 'image', 'video']);
});

test('плановый конец помечает просрочку и не скрывает баннер', () => {
  const slots = [{ id: 'slot-a', versions: [image('oct', '2026-10-01T00:00:00+03:00', '2026-11-01T00:00:00+03:00')] }];
  const result = project(slots, '2026-11-03T12:00:00+03:00');
  assert.equal(result.items[0].id, 'oct');
  assert.equal(result.items[0].overdue, true);
});

test('будущая замена занимает тот же слот только с начала периода', () => {
  const slots = [{ id: 'slot-a', versions: [image('oct', '2026-10-01T00:00:00+03:00', '2026-11-01T00:00:00+03:00'), image('nov', '2026-11-01T00:00:00+03:00', '2026-12-01T00:00:00+03:00')] }];
  const before = project(slots, '2026-10-31T23:59:59+03:00');
  assert.equal(before.items[0].id, 'oct');
  assert.equal(before.nextChangeAt, '2026-10-31T21:00:00.000Z');
  assert.equal(project(slots, '2026-11-01T00:00:00+03:00').items[0].id, 'nov');
  assert.equal(project(slots, '2026-12-03T00:00:00+03:00').items[0].id, 'nov');
});

test('ручной порядок разрешает два ролика подряд и не создаёт повторы', () => {
  const slots = moveSlot(INITIAL_PLAYLIST, 5, 3);
  const items = project(slots, '2026-10-15T10:00:00+03:00').items;
  assert.equal(items.length, 18);
  assert.deepEqual(items.slice(1, 3).map(i => i.kind), ['video', 'video']);
});

test('немедленное исправление сохраняет период текущего баннера', () => {
  const slot = { id: 'slot-a', versions: [image('oct', '2026-10-01T00:00:00+03:00', '2026-11-01T00:00:00+03:00')] };
  const replacement = image('fixed', null, null);
  delete replacement.startAt;
  delete replacement.endAt;
  const corrected = replaceVersion([slot], 'slot-a', replacement);
  assert.equal(corrected[0].versions.length, 1);
  assert.equal(corrected[0].versions[0].startAt, slot.versions[0].startAt);
  assert.equal(corrected[0].versions[0].endAt, slot.versions[0].endAt);
});

test('будущий объект не показывается раньше срока', () => {
  const slots = [{ id: 'slot-a', versions: [image('future', '2026-11-01T00:00:00+03:00', null)] }];
  assert.equal(project(slots, '2026-10-15T10:00:00+03:00').items.length, 0);
});

test('некорректная очередь отвергается', () => {
  assert.throws(() => validatePlaylist([{ id: 'x', versions: [image('a')] }, { id: 'x', versions: [image('b')] }]));
  assert.throws(() => validatePlaylist([{ id: 'x', versions: [image('a', '2026-12-01T00:00:00+03:00', '2026-11-01T00:00:00+03:00')] }]));
});
