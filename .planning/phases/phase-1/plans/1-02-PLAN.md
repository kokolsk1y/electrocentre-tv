---
phase: "1"
plan: "1-02"
name: "crossfade-transition"
wave: 2
depends_on: ["1-01"]
autonomous: true
requirements:
  - SLIDE-03
  - SLIDE-04
must_haves:
  truths:
    - "В HTML нет div#fl и CSS .fl"
    - "CSS .slide использует opacity:0 и transition:opacity 0.4s, а не display:none"
    - "CSS .slide.on задаёт opacity:1"
    - "Функция goTo() не содержит fl.classList и не использует setTimeout 120мс"
    - "CSS .stage имеет position:relative"
    - "CSS .slide имеет position:absolute с top/left/right/bottom:0"
    - "animateItems() по-прежнему вызывается через setTimeout(..., 50) после смены слайда"
  artifacts:
    - "electrocentre-tv-v2.1.html"
---

## Цель

Заменить механизм белой вспышки (`.fl` overlay + display:none/flex) на плавный CSS cross-fade
через opacity 0/1 с transition 400мс. После выполнения смена слайдов не производит вспышку,
переход визуально плавный. Анимация элементов `.ap` на HTML-слайдах продолжает работать.

## Контекст

- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\CONTEXT.md`
- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md`
- Рабочий файл: `c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html`

Текущий код в файле (для ориентира):
- Строка 7 и далее: `<style>` — CSS `.fl`, `.slide`
- Строка ~41: `.fl { position:absolute; ... background:#fff; ... }`
- Строка ~75–82: `.slide { position:absolute; inset:0; display:none; ... }` и `.slide.on { display:flex; }`
- Строка ~363: `<div id="fl" class="fl"></div>`
- Строка ~566–580: функция `goTo(idx)` — использует `const fl = document.getElementById('fl')`

## Задачи

<task type="edit" id="1-02-01">
  <name>Переписать CSS: убрать .fl, заменить .slide display на opacity</name>
  <files>c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
    c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md
  </read_first>
  <action>
    Внести три изменения в блок `<style>`:

    **Изменение A — удалить блок `.fl`:**
    Найти и удалить весь блок (примерно строки 40–42):
    ```css
    /* ══ FLASH ══ */
    .fl { position:absolute; top:74px; bottom:68px; left:0; right:0; background:#fff; opacity:0; pointer-events:none; z-index:100; transition:opacity 0.2s; }
    .fl.on { opacity:1; }
    ```
    Удалить обе строки CSS и комментарий.

    **Изменение B — добавить position:relative к .stage:**
    Найти блок `.stage`:
    ```css
    .stage { position:absolute; top:70px; bottom:68px; left:0; right:0; }
    ```
    Добавить `position:relative;` — итоговый вид:
    ```css
    .stage { position:absolute; top:70px; bottom:68px; left:0; right:0; position:relative; }
    ```
    (Обе директивы position уживаются — последняя побеждает. Либо заменить `position:absolute` на `position:relative` если .stage нет нужды в absolute — уточнить по верстке. БЕЗОПАСНЕЕ: оставить `position:absolute` для расположения относительно `#wrap`, добавить отдельный контекст позиционирования через `overflow:hidden` или просто убедиться что дочерние `position:absolute` слайды позиционируются внутри `.stage`. `.stage` уже `position:absolute` — этого достаточно как containing block для дочерних absolute. Убедиться что `.stage` НЕ имеет `position:static`. Если уже `position:absolute` — дочерние absolute позиционируются относительно него. Дополнительный `position:relative` не нужен.)

    ИТОГО для .stage: оставить как есть (`position:absolute` — уже создаёт containing block).

    **Изменение C — заменить механизм .slide:**
    Найти блок (примерно строки 74–82):
    ```css
    /* ══ SLIDE BASE ══ */
    .slide {
      position:absolute; inset:0;
      display:none; flex-direction:column;
      align-items:center; justify-content:center;
      text-align:center; padding:40px 80px;
      pointer-events:none; overflow:hidden;
    }
    .slide.on { display:flex; pointer-events:auto; }
    ```

    Заменить на:
    ```css
    /* ══ SLIDE BASE ══ */
    .slide {
      position:absolute;
      top:0; left:0; right:0; bottom:0;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      text-align:center; padding:40px 80px;
      opacity:0;
      transition:opacity 0.4s ease;
      pointer-events:none; overflow:hidden;
    }
    .slide.on { opacity:1; pointer-events:auto; }
    ```

    Замечание: `inset:0` заменяется на `top:0; left:0; right:0; bottom:0;` — Android TV
    (Chromium 60+) может не поддерживать сокращение `inset`.
  </action>
  <verify>grep -c "display:none" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - grep по "display:none" в HTML возвращает 0 (строк с display:none для .slide не осталось)
    - grep по "transition:opacity 0.4s" возвращает 1 (новый CSS присутствует)
    - grep по "\.fl {" в HTML возвращает 0 (CSS .fl удалён)
    - grep по "\.fl\.on" в HTML возвращает 0 (CSS .fl.on удалён)
    - grep по "inset:0" в блоке .slide возвращает 0
  </acceptance_criteria>
</task>

<task type="edit" id="1-02-02">
  <name>Удалить div#fl из HTML и переписать функцию goTo()</name>
  <files>c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
  </read_first>
  <action>
    Это задача зависит от 1-02-01. Выполнять ПОСЛЕ 1-02-01.

    **Изменение A — удалить div#fl:**
    Найти в теле HTML строку (примерно строка 363):
    ```html
    <div id="fl" class="fl"></div>
    ```
    Удалить эту строку полностью.

    **Изменение B — переписать функцию goTo():**
    Найти функцию (примерно строки 566–580):
    ```javascript
    function goTo(idx){
      const fl = document.getElementById('fl');
      fl.classList.add('on');
      setTimeout(()=>{
        resetItems(slides[cur]);
        slides[cur].classList.remove('on');
        cur = ((idx % slides.length) + slides.length) % slides.length;
        slides[cur].classList.add('on');
        updateDots(cur);
        fl.classList.remove('on');
        const s = slides[cur];
        setTimeout(()=>animateItems(s), 50);
        startProg();
      }, 120);
    }
    ```

    Заменить на:
    ```javascript
    function goTo(idx){
      resetItems(slides[cur]);
      slides[cur].classList.remove('on');
      cur = ((idx % slides.length) + slides.length) % slides.length;
      slides[cur].classList.add('on');
      updateDots(cur);
      setTimeout(()=>animateItems(slides[cur]), 50);
      startProg();
    }
    ```

    Ключевые изменения:
    - Убраны: `const fl`, `fl.classList.add('on')`, `fl.classList.remove('on')`, внешний `setTimeout(..., 120)`
    - Сохранены: `resetItems()`, `classList.remove('on')`, `classList.add('on')`, `updateDots()`, `setTimeout(animateItems, 50)`, `startProg()`
    - Порядок строк внутри функции не меняется: сначала reset и remove('on') со старого слайда, потом add('on') на новый
  </action>
  <verify>grep -c "getElementById('fl')" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - grep по "getElementById('fl')" возвращает 0
    - grep по "fl.classList" возвращает 0
    - grep по "setTimeout.*animateItems" возвращает 1 (setTimeout 50мс сохранён)
    - grep по 'id="fl"' в HTML возвращает 0 (div удалён)
  </acceptance_criteria>
</task>

## Волны

**Волна 1:** задача 1-02-01 — изменения в CSS (независима).
**Волна 2:** задача 1-02-02 — изменения в HTML и JS (зависит от 1-02-01, оба меняют один файл — выполнять последовательно).

Обе задачи редактируют один и тот же файл `electrocentre-tv-v2.1.html`, поэтому их нельзя выполнять параллельно. Сначала 1-02-01, потом 1-02-02.

## Риски

- После замены display:none → opacity:0 все слайды технически присутствуют в DOM и рендерятся. На слабом TV это не критично (9 слайдов, статичный контент).
- Анимация `.ap` завязана на `animateItems()` который вызывается через `setTimeout(..., 50)` — этот вызов СОХРАНИТЬ. Без него элементы на HTML-слайдах появятся немедленно вместо последовательной анимации.
- После перехода на opacity, `slides[0].classList.add("on")` в строке инициализации (~строка 597) продолжает работать корректно.
