import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { queueCleanup } from '../src/worker.js';
import { INITIAL_PLAYLIST } from '../src/seed.js';
import { DatabaseSync } from 'node:sqlite';

function env() {
  const row = { id: 1, draft_json: JSON.stringify(INITIAL_PLAYLIST.slice(0, 2)), published_json: JSON.stringify(INITIAL_PLAYLIST), draft_revision: 4, published_revision: 2, preview_token: 'preview-secret' };
  return { TV_ORIGIN: 'https://kokolsk1y.github.io', DB: { prepare(sql) { assert.match(sql, /^SELECT \*/); return { async first() { return row; } }; } } };
}

test('эфир и черновик раздельны, предпросмотр требует токен', async () => {
  const bindings = env();
  const opts = { headers: { Origin: bindings.TV_ORIGIN } };
  const live = await worker.fetch(new Request('https://worker.example/api/published', opts), bindings);
  const published = await live.json();
  assert.equal(published.items.length, 18);
  assert.equal(published.draft, false);
  assert.equal(live.headers.get('Cache-Control'), 'no-store');
  assert.equal(live.headers.get('Access-Control-Allow-Origin'), '*');
  const preview = await worker.fetch(new Request('https://worker.example/api/preview/preview-secret', opts), bindings);
  const draft = await preview.json();
  assert.equal(draft.items.length, 2);
  assert.equal(draft.draft, true);
  assert.equal(draft.schedule.length, 2);
  const wrong = await worker.fetch(new Request('https://worker.example/api/preview/wrong', opts), bindings);
  assert.equal(wrong.status, 404);
});

test('webhook публикует весь черновик одной записью и отзывает старую ссылку', async () => {
  const state = {
    id: 1, draft_json: JSON.stringify(INITIAL_PLAYLIST.slice(0, 2)), published_json: JSON.stringify(INITIAL_PLAYLIST),
    draft_revision: 7, published_revision: 3, preview_token: 'old-preview', updated_at: ''
  };
  const updateIds = new Set();
  let publishWrites = 0;
  const db = { prepare(sql) {
    if (sql.startsWith('SELECT * FROM app_state')) return { first: async () => ({ ...state }) };
    return { bind(...args) { return { async run() {
      if (sql.startsWith('INSERT OR IGNORE INTO telegram_updates')) {
        if (updateIds.has(args[0])) return { meta: { changes: 0 } };
        updateIds.add(args[0]); return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE app_state SET published_json')) {
        assert.equal(args[3], state.draft_revision);
        assert.equal(args[4], state.published_revision);
        state.published_json = args[0]; state.preview_token = args[1]; state.published_revision++;
        publishWrites++; return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE FROM telegram_updates')) return { meta: { changes: 1 } };
      throw new Error(`Unexpected SQL: ${sql}`);
    } }; } };
  } };
  const bindings = { DB: db, TELEGRAM_WEBHOOK_SECRET: 'webhook-secret', TELEGRAM_BOT_TOKEN: 'bot-secret', ALLOWED_TELEGRAM_IDS: '42', TV_PAGE_URL: 'https://kokolsk1y.github.io/electrocentre-tv/electrocentre-tv-v2.1.html' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/api.telegram.org\/botbot-secret\//);
    return Response.json({ ok: true, result: {} });
  };
  try {
    const before = await worker.fetch(new Request('https://worker.example/api/published'), bindings);
    assert.equal((await before.json()).items.length, 18);
    const update = { update_id: 123, callback_query: { id: 'cb', from: { id: 42 }, data: 'pub:7', message: { chat: { id: 42, type: 'private' } } } };
    const wrong = await worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }, body: JSON.stringify(update) }), bindings);
    assert.equal(wrong.status, 403);
    const request = () => new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret' }, body: JSON.stringify(update) });
    assert.equal((await worker.fetch(request(), bindings)).status, 200);
    assert.equal((await worker.fetch(request(), bindings)).status, 200);
    assert.equal(publishWrites, 1);
    const after = await worker.fetch(new Request('https://worker.example/api/published'), bindings);
    assert.equal((await after.json()).items.length, 2);
    assert.equal((await worker.fetch(new Request('https://worker.example/api/preview/old-preview'), bindings)).status, 404);
  } finally { globalThis.fetch = originalFetch; }
});

test('предпросмотр будущей даты показывает запланированную замену', async () => {
  const bindings = env();
  const row = {
    draft_json: JSON.stringify([{ id: 's', versions: [
      { id: 'old', kind: 'image', name: 'Октябрь', src: 'old.webp', durationSeconds: 10, startAt: '2026-10-01T00:00:00+03:00' },
      { id: 'new', kind: 'image', name: 'Ноябрь', src: 'new.webp', durationSeconds: 10, startAt: '2026-11-01T00:00:00+03:00' }
    ] }]),
    published_json: JSON.stringify(INITIAL_PLAYLIST), draft_revision: 5, published_revision: 2, preview_token: 'preview-secret'
  };
  bindings.DB.prepare = () => ({ async first() { return row; } });
  const response = await worker.fetch(new Request('https://worker.example/api/preview/preview-secret?at=2026-11-02T00%3A00%3A00%2B03%3A00'), bindings);
  assert.equal((await response.json()).items[0].id, 'new');
});

test('повторная постановка очистки продлевает срок после публикации', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec('CREATE TABLE asset_cleanup(asset_key TEXT PRIMARY KEY,not_before TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)');
    const bindings = { DB: { prepare(sql) { return { bind(...values) { return { async run() { sqlite.prepare(sql).run(...values); return { meta: { changes: 1 } }; } }; } }; } } };
    await queueCleanup(bindings, 'banners/old.webp', -3600000);
    const old = sqlite.prepare('SELECT not_before FROM asset_cleanup WHERE asset_key=?').get('banners/old.webp').not_before;
    const publishedAt = Date.now();
    await queueCleanup(bindings, 'banners/old.webp', 48 * 3600000);
    const updated = sqlite.prepare('SELECT not_before FROM asset_cleanup WHERE asset_key=?').get('banners/old.webp').not_before;
    assert.ok(Date.parse(old) < publishedAt);
    assert.ok(Date.parse(updated) >= publishedAt + 48 * 3600000);
  } finally { sqlite.close(); }
});
