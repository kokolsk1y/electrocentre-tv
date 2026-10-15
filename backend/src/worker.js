import { INITIAL_PLAYLIST } from './seed.js';
import { dateMs, moveSlot, project, referencedAssets, replaceVersion, validatePlaylist } from './model.js';

const HOUR = 3600000;
const RETAIN_MS = 48 * HOUR;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
const clone = value => structuredClone(value);
const apiBase = request => new URL(request.url).origin;
const previewLink = (env, state, request) => {
  const url = new URL('/demo', apiBase(request));
  url.searchParams.set('preview', state.preview_token);
  url.searchParams.set('api', apiBase(request));
  return url.href;
};
const cors = (response) => {
  // Только публичные GET и одноразовый read-only preview; локальные TV имеют разные Origin.
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};

async function load(env) {
  let row = await env.DB.prepare('SELECT * FROM app_state WHERE id=1').first();
  if (!row) {
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT OR IGNORE INTO app_state (id,draft_json,published_json,draft_revision,published_revision,preview_token,updated_at) VALUES (1,?,?,?,?,?,?)')
      .bind(JSON.stringify(INITIAL_PLAYLIST), JSON.stringify(INITIAL_PLAYLIST), 1, 1, token(), now).run();
    row = await env.DB.prepare('SELECT * FROM app_state WHERE id=1').first();
  }
  return { ...row, draft: JSON.parse(row.draft_json), published: JSON.parse(row.published_json) };
}

async function saveDraft(env, state, draft) {
  validatePlaylist(draft);
  const result = await env.DB.prepare('UPDATE app_state SET draft_json=?,draft_revision=draft_revision+1,updated_at=? WHERE id=1 AND draft_revision=?')
    .bind(JSON.stringify(draft), new Date().toISOString(), state.draft_revision).run();
  if (result.meta.changes !== 1) throw new Error('Черновик изменился одновременно. Повторите действие.');
  const kept = referencedAssets(draft, state.published);
  for (const key of referencedAssets(state.draft)) if (!kept.has(key)) {
    try { await queueCleanup(env, key); } catch { console.error('Could not queue draft asset cleanup'); }
  }
}

async function publish(env, state) {
  validatePlaylist(state.draft);
  if (!project(state.draft).items.length) throw new Error('Нельзя опубликовать пустой на текущий момент эфир.');
  // Одна SQL-запись переключает весь набор. Токен отзывается при каждой публикации.
  const result = await env.DB.prepare('UPDATE app_state SET published_json=?,published_revision=published_revision+1,preview_token=?,updated_at=? WHERE id=1 AND draft_revision=? AND published_revision=?')
    .bind(JSON.stringify(state.draft), token(), new Date().toISOString(), state.draft_revision, state.published_revision).run();
  if (result.meta.changes !== 1) throw new Error('Набор изменился. Проверьте список и повторите публикацию.');
  const kept = referencedAssets(state.draft);
  for (const key of referencedAssets(state.published)) if (!kept.has(key)) {
    try { await queueCleanup(env, key); } catch { console.error('Could not queue published asset cleanup'); }
  }
}

export async function queueCleanup(env, key, delayMs = RETAIN_MS) {
  await env.DB.prepare('INSERT INTO asset_cleanup(asset_key,not_before) VALUES (?,?) ON CONFLICT(asset_key) DO UPDATE SET not_before=MAX(asset_cleanup.not_before,excluded.not_before)')
    .bind(key, new Date(Date.now() + delayMs).toISOString()).run();
}

async function telegram(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const payload = await res.json();
  if (!res.ok || !payload.ok) throw new Error(`Telegram ${method}: ${payload.description || res.status}`);
  return payload.result;
}
const send = (env, chatId, text, keyboard) => telegram(env, 'sendMessage', { chat_id: chatId, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
// Пустой список означает открытый доступ через личный чат с ботом.
const allowed = (env, id) => !String(env.ALLOWED_TELEGRAM_IDS || '').trim() ||
  String(env.ALLOWED_TELEGRAM_IDS).split(',').map(s => s.trim()).includes(String(id));
const menu = [[{ text: '📋 Черновик', callback_data: 'draft' }, { text: '📺 В эфире', callback_data: 'live' }], [{ text: '➕ Баннер', callback_data: 'add' }, { text: '🔗 Предпросмотр', callback_data: 'preview' }], [{ text: '✅ Опубликовать', callback_data: 'publish' }]];
const dateChoices = [[{ text: 'Этот месяц', callback_data: 'month:current' }, { text: 'Следующий месяц', callback_data: 'month:next' }], [{ text: 'Бессрочно', callback_data: 'month:forever' }, { text: 'Свои даты', callback_data: 'customdates' }]];
function monthRange(which) {
  if (which === 'forever') return { startAt: new Date().toISOString(), endAt: null };
  const moscow = new Date(Date.now() + 3 * HOUR);
  const year = moscow.getUTCFullYear(), month = moscow.getUTCMonth() + (which === 'next' ? 1 : 0);
  return { startAt: new Date(Date.UTC(year, month, 1, -3)).toISOString(), endAt: new Date(Date.UTC(year, month + 1, 1, -3)).toISOString() };
}
const fmt = (slots, now = new Date()) => {
  const current = project(slots, now).items;
  const bySlot = new Map(current.map(i => [i.slot, i]));
  return slots.map((s, i) => {
    const c = bySlot.get(s.id);
    const future = s.versions.filter(v => v.startAt && dateMs(v.startAt) > now.getTime()).map(v => ` → ${v.name} с ${v.startAt}`).join('');
    return `${i + 1}. ${c ? `${c.kind === 'video' ? '🎬' : c.kind === 'image' ? '🖼️' : '📺'} ${c.name}${c.overdue ? ' ⚠️ срок вышел' : ''}${c.validUntil ? ` до ${c.validUntil}` : ''}` : '⏳ ещё не начался'}${future}`;
  }).join('\n') || 'Список пуст.';
};
async function sendList(env, chatId, slots, title, revision, editable = false) {
  const controls = editable ? slots.map((slot, index) => {
    const n = index + 1;
    const buttons = [];
    if (project([slot]).items[0]?.kind === 'image') buttons.push({ text: `${n} ✏️`, callback_data: `replace:${n}:${revision}` });
    buttons.push({ text: '🏷', callback_data: `rename:${n}:${revision}` });
    buttons.push({ text: `${n} ⏱`, callback_data: `period:${n}:${revision}` });
    if (n > 1) buttons.push({ text: '↑', callback_data: `up:${n}:${revision}` });
    if (n < slots.length) buttons.push({ text: '↓', callback_data: `down:${n}:${revision}` });
    buttons.push({ text: '✕', callback_data: `remove:${n}:${revision}` });
    return buttons;
  }) : [];
  await send(env, chatId, `${title} #${revision}\n${fmt(slots)}\n\nКнопки: ✏️ заменить, ⏱ срок, ↑/↓ порядок, ✕ убрать.`, editable ? [...menu, ...controls] : menu);
  const pictures = project(slots).items.filter(i => i.kind === 'image');
  for (const item of pictures.slice(0, 20)) {
    const url = new URL(item.src, env.TV_PAGE_URL).href;
    try { await telegram(env, 'sendPhoto', { chat_id: chatId, photo: url, caption: `${item.position}. ${item.name}${item.overdue ? ' — срок вышел' : ''}` }); }
    catch { await send(env, chatId, `${item.position}. ${item.name}: ${url}`); }
  }
  if (pictures.length > 20) await send(env, chatId, 'Показаны первые 20 изображений. Все объекты перечислены выше.');
}

async function session(env, id) {
  const row = await env.DB.prepare('SELECT state_json FROM sessions WHERE user_id=?').bind(String(id)).first();
  return row ? JSON.parse(row.state_json) : null;
}
async function setSession(env, id, value) {
  if (!value) return env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(String(id)).run();
  return env.DB.prepare('INSERT INTO sessions(user_id,state_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at')
    .bind(String(id), JSON.stringify(value), new Date().toISOString()).run();
}

async function getImage(env, fileId) {
  const file = await telegram(env, 'getFile', { file_id: fileId });
  if (!file.file_path || (file.file_size && file.file_size > 20 * 1024 * 1024)) throw new Error('Изображение больше 20 МБ или недоступно.');
  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok || !response.body) throw new Error('Не удалось скачать изображение из Telegram.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('Изображение больше 20 МБ.');
  const info = await env.IMAGES.info(new Blob([bytes]).stream());
  if (!info.width || !info.height) throw new Error('Файл не является изображением.');
  const output = await env.IMAGES.input(new Blob([bytes]).stream()).transform({ width: Math.min(info.width, 1920), fit: 'scale-down' }).output({ format: 'image/webp', quality: 90, anim: false });
  const webp = await output.response().arrayBuffer();
  const key = `banners/${crypto.randomUUID()}.webp`;
  await env.DB.prepare('INSERT INTO assets(asset_key,created_at) VALUES (?,?)').bind(key, new Date().toISOString()).run();
  await env.BANNERS.put(key, webp, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
  return key;
}

async function finishImage(env, request, chatId, userId, flow) {
  const state = await load(env);
  let key;
  try {
    key = await getImage(env, flow.fileId);
    const entry = {
      id: crypto.randomUUID(), kind: 'image', name: flow.name,
      src: `${apiBase(request)}/media/${key}`, assetKey: key,
      durationSeconds: 10, startAt: flow.startAt, endAt: flow.endAt
    };
    const draft = clone(state.draft);
    if (flow.mode === 'replace') {
      const slot = draft[flow.slot - 1];
      if (!slot) throw new Error('Место больше не существует.');
      if (flow.startAt && dateMs(flow.startAt) > Date.now()) slot.versions.push(entry);
      else {
        const replacement = replaceVersion(draft, slot.id, entry);
        draft.splice(0, draft.length, ...replacement);
      }
    } else draft.push({ id: crypto.randomUUID(), versions: [entry] });
    await saveDraft(env, state, draft);
    await setSession(env, userId, null);
    await send(env, chatId, `Готово. Баннер «${flow.name}» добавлен в черновик. В эфире ничего не изменилось.\n\n${fmt(draft)}`, menu);
  } catch (error) {
    if (key) await queueCleanup(env, key);
    throw error;
  }
}

function parseTime(input, end = false) {
  const value = input.trim();
  if (/^(сейчас|now)$/i.test(value)) return new Date().toISOString();
  if (value === '-') return null;
  const local = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(value);
  if (local) {
    const [, dd, mm, yyyy, hh = '00', min = '00'] = local;
    const ms = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) - 3, Number(min));
    const check = new Date(ms + 3 * HOUR);
    if (check.getUTCFullYear() !== Number(yyyy) || check.getUTCMonth() !== Number(mm) - 1 || check.getUTCDate() !== Number(dd) || check.getUTCHours() !== Number(hh) || check.getUTCMinutes() !== Number(min)) throw new Error('Некорректная дата.');
    return new Date(ms + (end && !local[4] ? 24 * HOUR : 0)).toISOString();
  }
  dateMs(value);
  return value;
}

async function handleConversation(env, request, message, flow) {
  const { chat, from } = message;
  const text = (message.text || '').trim();
  if (flow.step === 'rename') {
    if (!text || text.length > 120) return send(env, chat.id, 'Напишите название до 120 символов. /cancel — отмена.');
    const state = await load(env);
    const draft = clone(state.draft);
    const version = draft[flow.slot - 1]?.versions.find(v => v.id === flow.versionId);
    if (!version) throw new Error('Объект изменился. Откройте список заново.');
    version.name = text;
    await saveDraft(env, state, draft);
    await setSession(env, from.id, null);
    return send(env, chat.id, `Название обновлено в черновике: ${text}`, menu);
  }
  if (flow.step === 'photo') {
    const image = message.photo?.at(-1);
    const document = message.document?.mime_type?.startsWith('image/') ? message.document : null;
    const fileId = image?.file_id || document?.file_id;
    if (!fileId) return send(env, chat.id, 'Пришлите изображение как фото или файл. /cancel — отмена.');
    flow.fileId = fileId; flow.step = 'name';
    await setSession(env, from.id, flow);
    return send(env, chat.id, 'Напишите название акции или баннера.');
  }
  if (!text) return send(env, chat.id, 'Ожидаю текст. /cancel — отмена.');
  if (flow.step === 'name') {
    if (text.length > 120) return send(env, chat.id, 'Название должно быть не длиннее 120 символов.');
    flow.name = text; flow.step = 'start';
    await setSession(env, from.id, flow);
    return send(env, chat.id, 'Выберите срок или напишите начало: «сейчас», 01.11.2026, 01.11.2026 09:00 (по Москве). Для исправления можно написать «сохранить».', dateChoices);
  }
  if (flow.step === 'start') {
    flow.startAt = /^сохранить$/i.test(text) && flow.mode === 'replace' ? flow.originalStart : parseTime(text); flow.step = 'end';
    await setSession(env, from.id, flow);
    return send(env, chat.id, 'Плановый конец: 31.10.2026 (до конца дня по Москве), дата и время или «-» для бессрочного показа. Для исправления можно написать «сохранить». По окончании объект останется в эфире до замены.');
  }
  if (flow.step === 'end') {
    flow.endAt = /^сохранить$/i.test(text) && flow.mode === 'replace' ? flow.originalEnd : parseTime(text, true);
    if (flow.startAt && flow.endAt && dateMs(flow.endAt) <= dateMs(flow.startAt)) throw new Error('Плановый конец должен быть позже начала.');
    flow.step = 'confirm';
    await setSession(env, from.id, flow);
    if (flow.mode === 'period') return send(env, chat.id, `Место ${flow.slot}\nНачало: ${flow.startAt || 'без даты'}\nПлановый конец: ${flow.endAt || 'бессрочно'}\nСохранить срок в черновик?`, [[{ text: 'Сохранить срок', callback_data: 'saveperiod' }, { text: 'Отмена', callback_data: 'cancel' }]]);
    return send(env, chat.id, `Проверьте: «${flow.name}»\nНачало: ${flow.startAt || 'сейчас'}\nПлановый конец: ${flow.endAt || 'бессрочно'}\nМесто: ${flow.mode === 'add' ? 'в конец очереди' : flow.slot}\nИзменится только черновик.`, [[{ text: 'Сохранить в черновик', callback_data: 'saveimage' }, { text: 'Отмена', callback_data: 'cancel' }]]);
  }
  return send(env, chat.id, 'Подтвердите сохранение кнопкой или /cancel.');
}

async function handleCommand(env, request, message, command) {
  const { chat, from } = message;
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const state = await load(env);
  if (cmd === '/cancel' || cmd === 'cancel') { await setSession(env, from.id, null); return send(env, chat.id, 'Действие отменено.', menu); }
  if (cmd === '/start' || cmd === '/help') return send(env, chat.id, 'Управление эфиром. Все правки сначала попадают в черновик.\n/add — добавить баннер\n/replace N — заменить баннер в месте N, можно назначить будущую дату\n/move ОТ КУДА — переместить любой объект\n/remove N — убрать место из черновика\n/rename N НАЗВАНИЕ — изменить название\n/period N — изменить сроки\n/addvideo имя.mp4 — добавить уже размещённый ролик\n/draft, /live, /preview, /publish\n/discard — отменить весь черновик\n/rotatepreview — отозвать ссылку предпросмотра', menu);
  if (cmd === '/draft' || cmd === 'draft') return sendList(env, chat.id, state.draft, 'ЧЕРНОВИК', state.draft_revision, true);
  if (cmd === '/live' || cmd === 'live') return sendList(env, chat.id, state.published, 'В ЭФИРЕ', state.published_revision);
  if (cmd === '/preview' || cmd === 'preview') return send(env, chat.id, `Предпросмотр черновика: ${previewLink(env, state, request)}\nЧтобы увидеть запланированный будущий набор, добавьте &at=2026-11-01T00%3A00%3A00%2B03%3A00. Ссылка доступна любому, у кого она есть; после публикации будет создана новая.`);
  if (cmd === '/rotatepreview') {
    const nextToken = token();
    const result = await env.DB.prepare('UPDATE app_state SET preview_token=? WHERE id=1 AND draft_revision=?').bind(nextToken, state.draft_revision).run();
    if (result.meta.changes !== 1) throw new Error('Черновик изменился. Повторите команду.');
    return send(env, chat.id, `Прежняя ссылка отозвана. Новая: ${previewLink(env, { preview_token: nextToken }, request)}`);
  }
  if (cmd === '/add' || cmd === 'add' || cmd === '/replace') {
    let slot;
    if (cmd === '/replace') {
      slot = Number(parts[1]);
      if (!Number.isInteger(slot) || !state.draft[slot - 1] || project([state.draft[slot - 1]]).items[0]?.kind !== 'image') throw new Error('Укажите номер места с баннером: /replace N');
    }
    const active = slot ? project([state.draft[slot - 1]]).items[0] : null;
    await setSession(env, from.id, { mode: slot ? 'replace' : 'add', slot, step: 'photo', originalStart: active?.validFrom || null, originalEnd: active?.validUntil || null });
    return send(env, chat.id, 'Пришлите изображение баннера (фото или файл). /cancel — отмена.');
  }
  if (cmd === '/move') {
    const draft = moveSlot(state.draft, Number(parts[1]), Number(parts[2]));
    await saveDraft(env, state, draft);
    return send(env, chat.id, `Порядок изменён только в черновике:\n${fmt(draft)}`, menu);
  }
  if (cmd === '/remove') {
    const n = Number(parts[1]);
    if (!Number.isInteger(n) || !state.draft[n - 1]) throw new Error('Укажите существующий номер: /remove N');
    return send(env, chat.id, `Убрать место ${n} «${project([state.draft[n - 1]]).items[0]?.name || 'запланированный объект'}» из черновика?`, [[{ text: 'Убрать', callback_data: `rm:${n}:${state.draft_revision}` }, { text: 'Отмена', callback_data: 'cancel' }]]);
  }
  if (cmd === '/rename') {
    const n = Number(parts[1]);
    const name = parts.slice(2).join(' ');
    if (!Number.isInteger(n) || !state.draft[n - 1] || !name || name.length > 120) throw new Error('Формат: /rename N НАЗВАНИЕ');
    const current = project([state.draft[n - 1]]).items[0];
    if (!current) throw new Error('Объект ещё не начал показ.');
    const draft = clone(state.draft);
    draft[n - 1].versions.find(v => v.id === current.id).name = name;
    await saveDraft(env, state, draft);
    return send(env, chat.id, 'Название в черновике обновлено.', menu);
  }
  if (cmd === '/period') {
    const n = Number(parts[1]);
    if (!Number.isInteger(n) || !state.draft[n - 1] || ![2, 4].includes(parts.length)) throw new Error('Формат: /period N; бот спросит даты. «-» означает без ограничения.');
    const current = project([state.draft[n - 1]]).items[0];
    if (!current) throw new Error('Объект ещё не начал показ. Используйте замену с новой датой.');
    if (parts.length === 2) {
      await setSession(env, from.id, { mode: 'period', slot: n, versionId: current.id, step: 'start' });
      return send(env, chat.id, `Место ${n}. Текущий срок: ${current.validFrom || 'без даты'} — ${current.validUntil || 'бессрочно'}. Выберите срок или укажите новое начало: дата 01.11.2026, «сейчас» или «-».`, dateChoices);
    }
    const draft = clone(state.draft);
    const version = draft[n - 1].versions.find(v => v.id === current.id);
    version.startAt = parseTime(parts[2]);
    version.endAt = parseTime(parts[3], true);
    await saveDraft(env, state, draft);
    return send(env, chat.id, `Сроки обновлены в черновике.\n${fmt(draft)}`, menu);
  }
  if (cmd === '/addvideo') {
    const name = parts[1];
    if (!/^[A-Za-z0-9_-]+\.mp4$/.test(name || '')) throw new Error('Формат: /addvideo имя-файла.mp4; файл должен быть уже в videos/.');
    const path = `videos/${name}`;
    const videoUrl = new URL(path, env.TV_PAGE_URL);
    const check = await fetch(videoUrl, { method: 'HEAD' });
    if (!check.ok) throw new Error('Файл ролика не найден на сайте. Сначала загрузите его в videos/.');
    const draft = clone(state.draft);
    draft.push({ id: crypto.randomUUID(), versions: [{ id: crypto.randomUUID(), kind: 'video', name: name.replace(/\.mp4$/, ''), src: path }] });
    await saveDraft(env, state, draft);
    return send(env, chat.id, `Ролик ${name} добавлен в конец черновика.`, menu);
  }
  if (cmd === '/publish' || cmd === 'publish') return send(env, chat.id, `Опубликовать весь черновик #${state.draft_revision}?\n${fmt(state.draft)}`, [[{ text: 'Опубликовать весь набор', callback_data: `pub:${state.draft_revision}` }, { text: 'Отмена', callback_data: 'cancel' }]]);
  if (cmd === '/discard') return send(env, chat.id, 'Отменить все изменения черновика и вернуть опубликованный набор?', [[{ text: 'Сбросить черновик', callback_data: `discard:${state.draft_revision}` }, { text: 'Отмена', callback_data: 'cancel' }]]);
  return send(env, chat.id, 'Неизвестная команда. /help — список действий.', menu);
}

async function handleUpdate(env, request, update) {
  const call = update.callback_query;
  const message = call?.message || update.message;
  const user = call?.from || message?.from;
  if (!message || !user || !allowed(env, user.id) || message.chat.type !== 'private') return;
  const text = (message.text || '').trim();
  try {
    if (call) await telegram(env, 'answerCallbackQuery', { callback_query_id: call.id });
    if (call?.data === 'cancel' || text === '/cancel') return handleCommand(env, request, { ...message, from: user }, '/cancel');
    if (call?.data === 'saveimage') {
      const flow = await session(env, user.id);
      if (!flow || flow.step !== 'confirm') throw new Error('Черновик загрузки не найден. Начните снова.');
      return finishImage(env, request, message.chat.id, user.id, flow);
    }
    if (call?.data === 'customdates') {
      const flow = await session(env, user.id);
      if (!flow || flow.step !== 'start') throw new Error('Сначала выберите баннер или объект.');
      return send(env, message.chat.id, 'Напишите дату начала: например 01.11.2026 или 01.11.2026 09:00 по Москве.');
    }
    if (call?.data?.startsWith('month:')) {
      const flow = await session(env, user.id);
      if (!flow || flow.step !== 'start') throw new Error('Сначала выберите баннер или объект.');
      Object.assign(flow, monthRange(call.data.slice(6)), { step: 'confirm' });
      await setSession(env, user.id, flow);
      const action = flow.mode === 'period' ? 'saveperiod' : 'saveimage';
      return send(env, message.chat.id, `${flow.mode === 'period' ? `Место ${flow.slot}` : `Баннер «${flow.name}»`}\nНачало: ${flow.startAt}\nПлановый конец: ${flow.endAt || 'бессрочно'}\nСохранить в черновик?`, [[{ text: 'Сохранить', callback_data: action }, { text: 'Отмена', callback_data: 'cancel' }]]);
    }
    if (call?.data === 'saveperiod') {
      const flow = await session(env, user.id);
      if (!flow || flow.mode !== 'period' || flow.step !== 'confirm') throw new Error('Изменение срока не найдено. Начните снова.');
      const state = await load(env);
      const draft = clone(state.draft);
      const version = draft[flow.slot - 1]?.versions.find(v => v.id === flow.versionId);
      if (!version) throw new Error('Объект изменился. Проверьте список.');
      version.startAt = flow.startAt;
      version.endAt = flow.endAt;
      await saveDraft(env, state, draft);
      await setSession(env, user.id, null);
      return send(env, message.chat.id, `Срок обновлён в черновике.\n${fmt(draft)}`, menu);
    }
    if (call?.data?.startsWith('discard:')) {
      const state = await load(env);
      if (state.draft_revision !== Number(call.data.slice(8))) throw new Error('Черновик изменился. Проверьте список перед сбросом.');
      await saveDraft(env, state, clone(state.published));
      return send(env, message.chat.id, 'Черновик возвращён к опубликованному набору. Эфир не менялся.', menu);
    }
    if (/^(replace|period|rename|up|down|remove):\d+:\d+$/.test(call?.data || '')) {
      const [action, nText, revisionText] = call.data.split(':');
      const state = await load(env);
      if (state.draft_revision !== Number(revisionText)) throw new Error('Черновик изменился. Откройте список заново.');
      const n = Number(nText);
      if (action === 'rename') {
        const current = project([state.draft[n - 1]]).items[0];
        if (!current) throw new Error('Объект ещё не начал показ.');
        await setSession(env, user.id, { mode: 'rename', step: 'rename', slot: n, versionId: current.id });
        return send(env, message.chat.id, `Новое название для места ${n} «${current.name}»: `);
      }
      if (action === 'replace' || action === 'period' || action === 'remove') return handleCommand(env, request, { ...message, from: user }, `/${action} ${n}`);
      const target = action === 'up' ? n - 1 : n + 1;
      const draft = moveSlot(state.draft, n, target);
      await saveDraft(env, state, draft);
      return sendList(env, message.chat.id, draft, 'ЧЕРНОВИК', state.draft_revision + 1, true);
    }
    if (call?.data?.startsWith('rm:')) {
      const [, nText, revisionText] = call.data.split(':');
      const state = await load(env);
      if (state.draft_revision !== Number(revisionText)) throw new Error('Черновик изменился. Проверьте список и повторите удаление.');
      const draft = clone(state.draft);
      draft.splice(Number(nText) - 1, 1);
      await saveDraft(env, state, draft);
      return send(env, message.chat.id, `Убрано из черновика. В эфире пока без изменений.\n${fmt(draft)}`, menu);
    }
    if (call?.data?.startsWith('pub:')) {
      const state = await load(env);
      if (state.draft_revision !== Number(call.data.slice(4))) throw new Error('Черновик изменился. Проверьте список перед публикацией.');
      await publish(env, state);
      const fresh = await load(env);
      return send(env, message.chat.id, `Опубликован весь набор #${fresh.published_revision}. Новая ссылка на черновик: ${previewLink(env, fresh, request)}`, menu);
    }
    if (call) return handleCommand(env, request, { ...message, from: user }, call.data);
    if (text.startsWith('/')) return handleCommand(env, request, message, text);
    const flow = await session(env, user.id);
    if (flow) return handleConversation(env, request, message, flow);
    return handleCommand(env, request, message, '/start');
  } catch (error) {
    await send(env, message.chat.id, `Ошибка: ${error.message}`);
  }
}

async function cronCleanup(env) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * HOUR).toISOString();
  await env.DB.prepare('DELETE FROM telegram_updates WHERE received_at < ?').bind(thirtyDaysAgo).run();
  await env.DB.prepare('DELETE FROM sessions WHERE updated_at < ?').bind(thirtyDaysAgo).run();
  let state = await load(env);
  // Старые версии после планового переключения остаются 48 часов для открытых телевизоров.
  const cutoff = Date.now() - RETAIN_MS;
  for (const column of ['draft', 'published']) {
    const old = state[column];
    const updated = clone(old);
    for (const slot of updated) {
      const started = slot.versions.filter(v => !v.startAt || dateMs(v.startAt) <= cutoff);
      if (started.length < 2) continue;
      const newest = started.map((v, i) => ({ v, i })).sort((a,b) => (dateMs(a.v.startAt) ?? -Infinity) - (dateMs(b.v.startAt) ?? -Infinity) || a.i - b.i).at(-1).v;
      slot.versions = slot.versions.filter(v => v === newest || !started.includes(v));
    }
    if (JSON.stringify(old) !== JSON.stringify(updated)) {
      if (column === 'draft') await saveDraft(env, state, updated);
      else {
        const res = await env.DB.prepare('UPDATE app_state SET published_json=? WHERE id=1 AND published_revision=?').bind(JSON.stringify(updated), state.published_revision).run();
        if (res.meta.changes !== 1) throw new Error('Конкурентная публикация; очистка повторится.');
      }
      state = await load(env);
      const kept = referencedAssets(state.draft, state.published);
      for (const key of referencedAssets(old)) if (!kept.has(key)) await queueCleanup(env, key, 0);
    }
  }
  const used = referencedAssets(state.draft, state.published);
  // Реестр всех загрузок закрывает случай сбоя между публикацией и постановкой очистки в очередь.
  const assetRows = await env.DB.prepare('SELECT asset_key,orphaned_at FROM assets LIMIT 1000').all();
  for (const row of assetRows.results || []) {
    if (used.has(row.asset_key)) {
      if (row.orphaned_at) await env.DB.prepare('UPDATE assets SET orphaned_at=NULL WHERE asset_key=?').bind(row.asset_key).run();
    } else if (!row.orphaned_at) {
      await env.DB.prepare('UPDATE assets SET orphaned_at=? WHERE asset_key=?').bind(new Date().toISOString(), row.asset_key).run();
    } else if (dateMs(row.orphaned_at) + RETAIN_MS <= Date.now()) {
      const fresh = await load(env);
      if (!referencedAssets(fresh.draft, fresh.published).has(row.asset_key)) {
        await env.BANNERS.delete(row.asset_key);
        await env.DB.prepare('DELETE FROM assets WHERE asset_key=?').bind(row.asset_key).run();
        await env.DB.prepare('DELETE FROM asset_cleanup WHERE asset_key=?').bind(row.asset_key).run();
      }
    }
  }
  const rows = await env.DB.prepare('SELECT asset_key FROM asset_cleanup WHERE not_before <= ? LIMIT 100').bind(new Date().toISOString()).all();
  for (const { asset_key: key } of rows.results || []) {
    const fresh = await load(env);
    if (referencedAssets(fresh.draft, fresh.published).has(key)) {
      await env.DB.prepare('DELETE FROM asset_cleanup WHERE asset_key=?').bind(key).run();
    } else {
      await env.BANNERS.delete(key);
      await env.DB.prepare('DELETE FROM assets WHERE asset_key=?').bind(key).run();
      await env.DB.prepare('DELETE FROM asset_cleanup WHERE asset_key=?').bind(key).run();
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }), env, request);
    try {
      if (request.method === 'GET' && url.pathname === '/demo') {
        const source = env.DEMO_HTML_URL;
        if (!source || !/^https:\/\/raw\.githubusercontent\.com\//.test(source)) return new Response('Demo source is not configured', { status: 503 });
        const upstream = await fetch(source, { headers: { Accept: 'text/html' } });
        if (!upstream.ok) return new Response('Demo source is unavailable', { status: 503 });
        const html = await upstream.text();
        if (!/<head>/i.test(html)) return new Response('Demo source is invalid', { status: 503 });
        const base = new URL('.', env.TV_PAGE_URL).href;
        return new Response(html.replace(/<head>/i, `<head><base href="${base}">`), { headers: {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'
        } });
      }
      if (request.method === 'GET' && url.pathname === '/api/published') {
        const state = await load(env);
        return cors(json(project(state.published, url.searchParams.get('at') || new Date(), state.published_revision, false)), env, request);
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/preview/')) {
        const state = await load(env);
        if (url.pathname.slice('/api/preview/'.length) !== state.preview_token) return cors(json({ error: 'Ссылка недействительна.' }, 404), env, request);
        const result = project(state.draft, url.searchParams.get('at') || new Date(), state.draft_revision, true);
        result.schedule = state.draft.map((slot, i) => ({ slot: slot.id, position: i + 1, versions: slot.versions.map(v => ({ id: v.id, name: v.name, kind: v.kind, startAt: v.startAt || null, endAt: v.endAt || null })) }));
        return cors(json(result), env, request);
      }
      if (request.method === 'GET' && /^\/media\/banners\/[a-f0-9-]+\.webp$/.test(url.pathname)) {
        const key = url.pathname.slice('/media/'.length);
        const object = await env.BANNERS.get(key);
        if (!object) return new Response('Not found', { status: 404 });
        return cors(new Response(object.body, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } }), env, request);
      }
      if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
        if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
        const update = await request.json();
        if (!Number.isInteger(update.update_id)) return new Response('Bad Request', { status: 400 });
        const claim = await env.DB.prepare('INSERT OR IGNORE INTO telegram_updates(update_id,received_at) VALUES (?,?)').bind(update.update_id, new Date().toISOString()).run();
        if (claim.meta.changes !== 1) return new Response('OK');
        try { await handleUpdate(env, request, update); }
        catch (error) {
          await env.DB.prepare('DELETE FROM telegram_updates WHERE update_id=?').bind(update.update_id).run();
          throw error;
        }
        return new Response('OK');
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      // Не логировать URL Telegram API: он содержит секретный токен бота.
      console.error('Worker request failed', error?.name || 'Error');
      return cors(json({ error: 'Внутренняя ошибка.' }, 500), env, request);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cronCleanup(env));
  }
};
