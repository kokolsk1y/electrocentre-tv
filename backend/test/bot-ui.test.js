import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.js';
import { INITIAL_PLAYLIST } from '../src/seed.js';

function fixture(slots = INITIAL_PLAYLIST) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE app_state(id INTEGER PRIMARY KEY,draft_json TEXT,published_json TEXT,draft_revision INTEGER,published_revision INTEGER,preview_token TEXT,updated_at TEXT);
    CREATE TABLE sessions(user_id TEXT PRIMARY KEY,state_json TEXT,updated_at TEXT);
    CREATE TABLE telegram_updates(update_id INTEGER PRIMARY KEY,received_at TEXT);
    CREATE TABLE assets(asset_key TEXT PRIMARY KEY,created_at TEXT,orphaned_at TEXT);
    CREATE TABLE asset_cleanup(asset_key TEXT PRIMARY KEY,not_before TEXT,attempts INTEGER DEFAULT 0);`);
  db.prepare('INSERT INTO app_state VALUES (1,?,?,?,?,?,?)').run(JSON.stringify(slots), JSON.stringify(slots), 1, 1, 'preview-token', new Date().toISOString());
  const messages = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target.startsWith('https://api.telegram.org/file/')) return new Response(new Uint8Array([1, 2, 3]));
    if (target.startsWith('https://api.telegram.org/bot')) {
      const method = target.slice(target.lastIndexOf('/') + 1);
      const body = JSON.parse(options.body);
      if (method === 'sendMessage') assert.ok(body.text.length <= 4096, 'Telegram message must fit 4096 characters');
      for (const button of body.reply_markup?.inline_keyboard?.flat() || []) if (button.callback_data) assert.ok(Buffer.byteLength(button.callback_data, 'utf8') <= 64);
      messages.push({ method, body });
      return Response.json({ ok: true, result: method === 'getFile' ? { file_path: 'photos/a.jpg', file_size: 3 } : {} });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  const env = {
    DB: { prepare(sql) { return { bind(...values) { return {
      async first() { return db.prepare(sql).get(...values) ?? null; },
      async run() { const r = db.prepare(sql).run(...values); return { meta: { changes: r.changes } }; },
      async all() { return { results: db.prepare(sql).all(...values) }; }
    }; }, async first() { return db.prepare(sql).get() ?? null; } }; } },
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret', TELEGRAM_BOT_TOKEN: 'bot-secret', ALLOWED_TELEGRAM_IDS: '42',
    TV_PAGE_URL: 'https://kokolsk1y.github.io/electrocentre-tv/electrocentre-tv-v2.1.html',
    IMAGES: { async info() { return { width: 2000, height: 1000 }; }, input() { return { transform() { return { async output() { return { response() { return new Response(new Uint8Array([82, 73, 70, 70])); } }; } }; } }; } },
    BANNERS: { async put() {}, async delete() {} }
  };
  let nextId = 1;
  async function sendUpdate(payload) {
    const update = { update_id: nextId++, ...payload };
    const response = await worker.fetch(new Request('https://worker.example/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret' }, body: JSON.stringify(update) }), env);
    assert.equal(response.status, 200);
    return messages.filter(x => x.method === 'sendMessage' || x.method === 'sendPhoto').at(-1);
  }
  const chat = { id: 42, type: 'private' };
  return {
    env, db, messages,
    command: text => sendUpdate({ message: { chat, from: { id: 42 }, text } }),
    photo: () => sendUpdate({ message: { chat, from: { id: 42 }, photo: [{ file_id: 'photo-id' }] } }),
    callback: data => sendUpdate({ callback_query: { id: `callback-${nextId}`, from: { id: 42 }, data, message: { chat, message_id: nextId } } }),
    state: () => db.prepare('SELECT * FROM app_state').get(),
    close() { globalThis.fetch = originalFetch; db.close(); }
  };
}

test('короткий список → выбор страницы → карточка без массовых фото', async () => {
  const f = fixture();
  try {
    const list = await f.command('/draft');
    assert.equal(list.method, 'sendMessage');
    assert.equal(f.messages.filter(m => m.method === 'sendPhoto').length, 0);
    assert.equal(list.body.reply_markup.inline_keyboard[0][0].callback_data, 'pick:0:1');
    assert.ok(list.body.reply_markup.inline_keyboard.length < 8);
    const picker = await f.callback('pick:0:1');
    assert.equal(picker.body.reply_markup.inline_keyboard.filter(row => row[0].callback_data?.startsWith('obj:')).length, 6);
    const card = await f.callback('obj:4:1');
    assert.equal(card.method, 'sendPhoto');
    assert.match(card.body.caption, /Место 4\/18/);
    assert.ok(card.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'movep:4:0:1'));
    assert.ok(f.messages.some(m => m.method === 'editMessageReplyMarkup'));
  } finally { f.close(); }
});

test('карточка меняет название и позицию; устаревшая кнопка не действует', async () => {
  const f = fixture();
  try {
    await f.callback('renv:4:0:1');
    await f.command('Исправленная акция');
    let draft = JSON.parse(f.state().draft_json);
    assert.equal(draft[3].versions[0].name, 'Исправленная акция');
    assert.equal(JSON.parse(f.state().published_json)[3].versions[0].name, INITIAL_PLAYLIST[3].versions[0].name);
    const stale = await f.callback('movep:4:0:1');
    assert.match(stale.body.text, /Список|Очередь изменилась/);
    const positions = await f.callback('movep:4:0:2');
    assert.ok(positions.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'dst:4:2:2'));
    await f.callback('dst:4:2:2');
    draft = JSON.parse(f.state().draft_json);
    assert.equal(draft[1].versions[0].name, 'Исправленная акция');
    assert.equal(draft.length, 18);
  } finally { f.close(); }
});

test('удаление будущей версии требует подтверждения и сохраняет текущую', async () => {
  const slot = structuredClone(INITIAL_PLAYLIST[3]);
  slot.versions.push({ id: 'november', kind: 'image', name: 'Ноябрь', src: 'slides/nov.webp', durationSeconds: 10, startAt: '2026-11-01T00:00:00+03:00' });
  const f = fixture([slot]);
  try {
    const card = await f.callback('ver:1:1:1');
    assert.match(card.body.caption, /Запланировано/);
    const confirm = await f.callback('delv:1:1:1');
    assert.match(confirm.body.text, /только выбранную версию/);
    assert.equal(JSON.parse(f.state().draft_json)[0].versions.length, 2);
    await f.callback('rmv:1:1:1');
    assert.equal(JSON.parse(f.state().draft_json)[0].versions.length, 1);
    assert.equal(JSON.parse(f.state().published_json)[0].versions.length, 2);
  } finally { f.close(); }
});

test('новый баннер получает выбранное место и остаётся только в черновике', async () => {
  const f = fixture(INITIAL_PLAYLIST.slice(0, 3));
  try {
    await f.command('/add');
    await f.photo();
    await f.command('Новая акция');
    const positions = await f.callback('month:next');
    assert.ok(positions.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'ins:2:1'));
    await f.callback('ins:2:1');
    await f.callback('saveimage');
    const draft = JSON.parse(f.state().draft_json);
    assert.equal(draft.length, 4);
    assert.equal(draft[1].versions[0].name, 'Новая акция');
    assert.match(draft[1].versions[0].src, /^https:\/\/worker\.example\/media\/banners\//);
    assert.equal(JSON.parse(f.state().published_json).length, 3);
  } finally { f.close(); }
});

test('будущую замену можно исправить отдельно без третьей версии', async () => {
  const slot = structuredClone(INITIAL_PLAYLIST[3]);
  slot.versions.push({ id: 'november', kind: 'image', name: 'Ноябрь', src: 'slides/nov.webp', durationSeconds: 10, startAt: '2026-11-01T00:00:00+03:00', endAt: '2026-12-01T00:00:00+03:00' });
  const f = fixture([slot]);
  try {
    await f.callback('repv:1:1:1');
    await f.photo();
    await f.command('Ноябрь исправлен');
    await f.command('сохранить');
    await f.command('сохранить');
    await f.callback('saveimage');
    const versions = JSON.parse(f.state().draft_json)[0].versions;
    assert.equal(versions.length, 2);
    assert.equal(versions[0].id, slot.versions[0].id);
    assert.equal(versions[1].name, 'Ноябрь исправлен');
    assert.equal(versions[1].startAt, '2026-11-01T00:00:00+03:00');
  } finally { f.close(); }
});

test('предпросмотр выбирает дату кнопкой и публикация не повторяется старой кнопкой', async () => {
  const f = fixture(INITIAL_PLAYLIST.slice(0, 3));
  try {
    const choice = await f.command('/preview');
    assert.ok(choice.body.reply_markup.inline_keyboard.flat().some(b => b.callback_data === 'pv:next'));
    const link = await f.callback('pv:next');
    assert.match(link.body.text, /[?&]at=/);
    await f.command('/rename 1 Новое название');
    const confirm = await f.command('/publish');
    assert.match(confirm.body.text, /Предпросмотр:/);
    await f.callback('pub:2');
    assert.equal(f.state().published_revision, 2);
    const repeated = await f.callback('pub:2');
    assert.match(repeated.body.text, /нет новых изменений/);
    assert.equal(f.state().published_revision, 2);
  } finally { f.close(); }
});

test('действующий баннер не исчезает при ошибочном переносе начала в будущее', async () => {
  const f = fixture([INITIAL_PLAYLIST[3]]);
  try {
    await f.callback('perv:1:0:1');
    const response = await f.callback('month:next');
    assert.match(response.body.text, /нельзя переносить в будущее/);
    assert.equal(f.state().draft_revision, 1);
    assert.equal(JSON.parse(f.state().draft_json)[0].versions[0].startAt, '2026-10-01T00:00:00+03:00');
  } finally { f.close(); }
});

test('устаревший мастер загрузки не меняет соседний слот после перестановки', async () => {
  const f = fixture(INITIAL_PLAYLIST.slice(0, 5));
  try {
    await f.command('/replace 4');
    await f.photo();
    await f.command('Исправленная акция');
    await f.callback('month:current');
    await f.command('/move 4 2');
    const response = await f.callback('saveimage');
    assert.match(response.body.text, /Черновик изменился/);
    const draft = JSON.parse(f.state().draft_json);
    assert.equal(draft[1].versions[0].name, INITIAL_PLAYLIST[3].versions[0].name);
  } finally { f.close(); }
});

test('список и подтверждение публикации помещаются в Telegram при 100 объектах', async () => {
  const slots = Array.from({ length: 100 }, (_, index) => ({
    id: `slot-${index}`, versions: [{ id: `video-${index}`, kind: 'video', name: `Ролик ${index} ${'А'.repeat(90)}`, src: 'videos/seriya-1.mp4' }]
  }));
  const f = fixture(slots);
  try {
    await f.command('/draft');
    const confirmation = await f.command('/publish');
    assert.ok(confirmation.body.text.length <= 4096);
    assert.match(confirmation.body.text, /ещё 80/);
  } finally { f.close(); }
});

test('кнопка старой карточки переименования безопасно работает с ревизией', async () => {
  const f = fixture(INITIAL_PLAYLIST.slice(0, 4));
  try {
    await f.callback('rename:4:1');
    await f.command('Проверка старой кнопки');
    assert.equal(JSON.parse(f.state().draft_json)[3].versions[0].name, 'Проверка старой кнопки');
  } finally { f.close(); }
});
