# Phase 1 Context

**Phase:** 1 — Стабилизация и полировка
**Discussion date:** 2026-03-23
**Status:** ready-to-plan

## Decisions

### Cross-fade переход между слайдами
**Decision:** Вариант A — оба слайда всегда `display:flex`, переключаем только `opacity` (0↔1) с `transition 400мс`. Механика `display:none/flex` убирается.
**Rationale:** Правильное решение без технического долга. Вариант B (чёрный оверлей) — заплатка.
**Implications:** Нужно переписать логику `goTo()` и CSS `.slide`. Проверить что анимация `.ap` не ломается после переключения через opacity.

### Self-hosted шрифт Montserrat
**Decision:** Вариант A — отдельные woff2-файлы в папке `fonts/` на GitHub Pages рядом с HTML.
**Rationale:** Wi-Fi стабильный, Android TV — внешний CDN не критичный риск. Раздувать HTML-файл на 300-400KB нецелесообразно.
**Implications:** Создать папку `fonts/`, скачать woff2 для начертаний 300/400/600/700/800/900 (только кириллица + латиница), прописать `@font-face` в `<style>`. Убрать `<link>` на Google Fonts. Если на реальном TV будут проблемы — переключиться на base64 (вариант B).

### Имена файлов баннеров
**Decision:** Формат `banner-01.webp`, `banner-02.webp` ... `banner-05.webp`.
**Rationale:** Максимально просто — легко объяснить нетехническому менеджеру в будущем.
**Implications:** Переименовать 5 файлов в `slides/`, обновить `src` в HTML. Делать синхронно — сначала переименовать файлы, потом обновить HTML, потом проверить что баннеры отображаются.

## Canonical References

| Reference | File path | Notes |
|-----------|-----------|-------|
| Основной рабочий файл | electrocentre-tv-v2.1.html | Только его редактируем |
| Баннеры | slides/banner-01.webp ... banner-05.webp | После переименования |
| Шрифты | fonts/montserrat-*.woff2 | Создать в этой фазе |

## Code Insights

- Текущий механизм перехода: `.fl { background:#fff }` + `fl.classList.add('on')` в `goTo()` с `setTimeout(120ms)`. Убрать полностью.
- `.slide { display:none }` / `.slide.on { display:flex }` — заменить на `opacity:0/1` с `transition`.
- Анимация `.ap` (появление элементов) завязана на `animateItems()` который вызывается через `setTimeout(50ms)` после смены слайда. После перехода на opacity важно сохранить этот порядок.
- `_animTimers` — массив для отмены pending setTimeout анимаций — уже добавлен в предыдущей сессии, использовать.
- Баннерные слайды: `class="slide banner"`, `id="s1,s3,s5,s7,s8"`. Длительность `data-duration="10000"` — поднять до `13000` для баннеров.
- Google Fonts `<link>` — строка 7 файла. Убрать и заменить на `@font-face`.

## Deferred Ideas

- Base64 шрифт (вариант B) — отложено, применить только если на TV будут проблемы с загрузкой woff2
- Скринсейвер — отложено в Фазу 3
- Дата в шапке — отложено в Фазу 3
- Таймер акции на баннерах — отложено в V2
