# Phase Research: Стабилизация и полировка

**Phase:** 1 — Стабилизация и полировка
**Date:** 2026-03-23

## Scope

Исследование охватывает три задачи: (1) замена flash-механизма на CSS cross-fade через opacity, (2) self-hosted Montserrat без Google Fonts CDN, (3) переименование 5 баннерных файлов. Все задачи в файле electrocentre-tv-v2.1.html.

---

## Codebase Audit Findings

### Существующие паттерны

| Паттерн | Пример | Правило |
|---------|--------|---------|
| classList.add/remove | slides[cur].classList.remove('on') | Не использовать .className= |
| Анимация через .show к .ap | .ap { opacity:0; transform:translateY(22px) } | Тот же паттерн для слайдов |
| _animTimers для отмены таймеров | строки 550-564 | Аналогично для других таймеров |
| data-duration на слайде | data-duration="10000" | Менять атрибут, не JS-константу |
| Шрифт через link Google Fonts | строка 7 | Заменить на @font-face в style |
| Относительные пути src | src="slides/..." | Сохранить после переименования |

### Файлы которые затронет фаза

| Файл | Состояние | Изменение |
|------|-----------|-----------|
| electrocentre-tv-v2.1.html | Рабочий, flash-переход, Google Fonts | Заменить .slide CSS, удалить .fl, переписать goTo(), @font-face, новые src |
| slides/2слайд_upscayl_2x_remacri-4x.png | Существует | banner-01.png |
| slides/4слайд_upscayl_2x_remacri-4x.png | Существует | banner-02.png |
| slides/6слайд_upscayl_2x_remacri-4x.png | Существует | banner-03.png |
| slides/8слайд_upscayl_2x_remacri-4x.png | Существует | banner-04.png |
| slides/9слайд_upscayl_2x_remacri-4x.png | Существует | banner-05.png |
| fonts/ | Не существует | Создать, поместить woff2 |

### Потенциальные конфликты

- Строка 363: div.fl — удалить div и getElementById("fl") в JS.
- Строки 74-82: .slide { display:none } — заменить на opacity:0.
- Строка 597: slides[0].classList.add("on") — работает и с opacity (CSS добавит видимость).

---

## Recommended Approach

### Решение 1: Cross-fade

**Выбранный подход:** position:absolute на всех слайдах, opacity + CSS transition.
**Причина:** CSS transition не анимирует display:none -> display:flex.

#### Вариант A: opacity + position:absolute (РЕКОМЕНДОВАН)
- **Плюсы:** Чистый CSS без JS-таймеров. Работает на Android TV.
- **Минусы:** Все слайды в DOM (9 слайдов — незначительно).

#### Вариант B: JS fade через requestAnimationFrame
- **Плюсы:** Полный контроль над анимацией.
- **Минусы:** Сложнее, риск конфликта с _animTimers.
- **Почему отклонён:** CSS transition справляется без JS.

### Решение 2: Self-hosted Montserrat

**Выбранный подход:** woff2-файлы в папке fonts/ рядом с HTML.
**Причина:** GitHub Pages отдаёт статику с правильными MIME-типами. woff2 работает на Android TV (Chromium 60+).

#### Вариант A: woff2 в fonts/ (РЕКОМЕНДОВАН)
- **Плюсы:** HTML лёгкий. Шрифты кешируются отдельно.
- **Минусы:** Нужна папка fonts/ рядом с HTML на хостинге.

#### Вариант B: base64 inline
- **Плюсы:** Один файл.
- **Минусы:** +300-400KB, медленный рендер.
- **Почему отклонён:** Только если woff2 не грузится на TV.

### Решение 3: Переименование баннеров

**Выбранный подход:** git mv + обновление src в HTML.
**Причина:** Кириллические имена проблематичны в URL. banner-01.png надёжнее.

---

## Technology Notes

### CSS opacity transition

**Ключевые API:**
```css
.stage { position: relative; }
.slide {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.slide.on { opacity: 1; pointer-events: auto; }
```

**Важно:** position:absolute требует position:relative на .stage.
**Android TV:** Не использовать inset:0 — заменить на top/left/right/bottom:0.

### Self-hosted woff2

**Начертания из строки 7:** weights 300/400/500/600/700/800/900, subsets latin+cyrillic.
**Источники:** fontsource.org/fonts/montserrat или google-webfonts-helper.herokuapp.com

**Минимальный набор:**
```
fonts/montserrat-300-cyrillic.woff2  fonts/montserrat-300-latin.woff2
fonts/montserrat-400-cyrillic.woff2  fonts/montserrat-400-latin.woff2
fonts/montserrat-500-cyrillic.woff2  fonts/montserrat-500-latin.woff2
fonts/montserrat-600-cyrillic.woff2  fonts/montserrat-600-latin.woff2
fonts/montserrat-700-cyrillic.woff2  fonts/montserrat-700-latin.woff2
fonts/montserrat-800-cyrillic.woff2  fonts/montserrat-800-latin.woff2
fonts/montserrat-900-cyrillic.woff2  fonts/montserrat-900-latin.woff2
```
14 файлов. С italic 800/900 — ещё 4.

**Шаблон @font-face:**
```css
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('fonts/montserrat-700-cyrillic.woff2') format('woff2');
  unicode-range: U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('fonts/montserrat-700-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+FEFF;
}
```
Повторить для каждого weight (300, 400, 500, 600, 700, 800, 900).

### PNG vs webp

**Обнаружено:** CONTEXT.md говорит banner-01.webp, но реальные файлы .png.
**Рекомендация:** banner-0X.png. webp-конвертация — отдельная задача.

---

## Integration Points

### Inputs

- electrocentre-tv-v2.1.html строки 1-607
- slides/Nслайд_upscayl_2x_remacri-4x.png x5 — переименовать
- Переменных окружения нет

### Outputs

- electrocentre-tv-v2.1.html с cross-fade, self-hosted шрифтами, banner-0X.png
- fonts/montserrat-*.woff2 — 14 файлов
- slides/banner-01.png ... banner-05.png

---

## Pitfalls to Avoid

1. **.webp для .png файлов** — переименование без конвертации сломает картинки. Использовать banner-01.png.

2. **display:none блокирует transition** — убрать из .slide, заменить на opacity:0.

3. **div.fl удалить полностью** — CSS строки 40-42, div строка 363, вызовы в goTo().

4. **resetItems() до remove("on")** — текущий порядок строк 570-571 правильный. Не менять.

5. **opacity:0 родителя скрывает детей** — animateItems() после classList.add("on"). Текущий setTimeout(..., 50) сохранить.

6. **font-display: swap обязателен** — FOIT на Android TV без него. В каждый @font-face.

7. **Порядок при переименовании** — сначала git mv, потом src в HTML, потом коммит.

8. **.stage position:relative** — без этого слайды позиционируются относительно body.

---

## Code Examples

### Новый CSS .slide (строки 74-82)

```css
.stage { position: relative; }
.slide {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.slide.on { opacity: 1; pointer-events: auto; }
```

### Новая функция goTo() (строки 566-580)

```javascript
function goTo(idx) {
  resetItems(slides[cur]);
  slides[cur].classList.remove('on');
  cur = ((idx % slides.length) + slides.length) % slides.length;
  slides[cur].classList.add('on');
  updateDots(cur);
  setTimeout(() => animateItems(slides[cur]), 50);
  startProg();
}
```
Убрать: const fl, fl.classList.add("on"), setTimeout(..., 120), fl.classList.remove("on").

### Таблица переименования

| Старое имя | Новое имя | Слайд |
|------------|-----------|-------|
| 2слайд_upscayl_2x_remacri-4x.png | banner-01.png | s1 |
| 4слайд_upscayl_2x_remacri-4x.png | banner-02.png | s3 |
| 6слайд_upscayl_2x_remacri-4x.png | banner-03.png | s5 |
| 8слайд_upscayl_2x_remacri-4x.png | banner-04.png | s7 |
| 9слайд_upscayl_2x_remacri-4x.png | banner-05.png | s8 |

Команды:
```bash
git mv "slides/2слайд_upscayl_2x_remacri-4x.png" "slides/banner-01.png"
git mv "slides/4слайд_upscayl_2x_remacri-4x.png" "slides/banner-02.png"
git mv "slides/6слайд_upscayl_2x_remacri-4x.png" "slides/banner-03.png"
git mv "slides/8слайд_upscayl_2x_remacri-4x.png" "slides/banner-04.png"
git mv "slides/9слайд_upscayl_2x_remacri-4x.png" "slides/banner-05.png"
```

---

## Open Questions for Planner

1. **Расширение** — реальные файлы .png. Переименовывать в banner-0X.png (не .webp).

2. **Weight 500** — присутствует в Google Fonts строки 7. Рекомендация: включить montserrat-500-*.woff2.

3. **Italic (800i, 900i)** — grep по font-style в CSS; если нет — не скачивать.