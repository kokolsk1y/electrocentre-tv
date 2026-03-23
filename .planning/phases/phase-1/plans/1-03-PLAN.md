---
phase: "1"
plan: "1-03"
name: "content-polish"
wave: 2
depends_on:
  - "1-01"
  - "1-02"
autonomous: true
requirements:
  - SLIDE-01
  - SLIDE-02
  - CONTENT-01
  - CONTENT-02
  - CONTENT-03
  - CONTENT-04
must_haves:
  truths:
    - "Все 5 баннерных слайдов имеют data-duration='13000'"
    - "Слайд 7 (доставка) содержит текст об обоих вариантах: заказ на сайте и из магазина"
    - "На слайде 7 сумма условий написана большим текстом — не менее font-size:52px для ключевых цифр"
    - "В HTML присутствуют ровно 9 слайдов (класс .slide)"
    - "Первый слайд — HTML (без класса .banner), второй — баннер (.banner)"
  artifacts:
    - "electrocentre-tv-v2.1.html"
---

## Цель

Доработать контентную сторону перед демонстрацией руководству: выставить правильную длительность
баннерных слайдов (13 секунд вместо 10), убедиться что слайд 7 (доставка) полностью читаем
с расстояния 2–3 метра, и зафиксировать что все 9 слайдов корректно присутствуют в разметке.

Этот план выполняется только после завершения планов 1-01 (шрифты и баннеры) и 1-02 (cross-fade).

## Контекст

- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\CONTEXT.md`
- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\REQUIREMENTS.md`
- Рабочий файл: `c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html`

Структура 9 слайдов (из REQUIREMENTS.md SLIDE-01):
- s0: HTML — слайд 1 (онлайн-магазин + QR, CONTENT-01)
- s1: баннер — слайд 2 (banner-01.png, CONTENT-05)
- s2: HTML — слайд 3 (скидки, CONTENT-02)
- s3: баннер — слайд 4 (banner-02.png, CONTENT-05)
- s4: HTML — слайд 5 (карта лояльности, CONTENT-03)
- s5: баннер — слайд 6 (banner-03.png, CONTENT-05)
- s6: HTML — слайд 7 (доставка, CONTENT-04)
- s7: баннер — слайд 8 (banner-04.png, CONTENT-05)
- s8: баннер — слайд 9 (banner-05.png, CONTENT-05)

Баннерные слайды определяются атрибутом `data-duration` и классом `.banner`.
По CONTEXT.md, RESEARCH.md: баннерные слайды имеют `class="slide banner"`.

## Задачи

<task type="edit" id="1-03-01">
  <name>Выставить data-duration="13000" на всех баннерных слайдах</name>
  <files>c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
  </read_first>
  <action>
    Найти в HTML все div с классом `.slide.banner` — их ровно 5 штук.
    По CONTEXT.md — это слайды с id s1, s3, s5, s7, s8.

    На каждом из этих div найти атрибут `data-duration="10000"` и заменить на `data-duration="13000"`.

    Пример замены:
    ```html
    <!-- было -->
    <div class="slide banner" id="s1" data-duration="10000">
    <!-- стало -->
    <div class="slide banner" id="s1" data-duration="13000">
    ```

    Выполнить для всех пяти: s1, s3, s5, s7, s8.

    HTML-слайды (s0, s2, s4, s6) оставить без изменений — они используют дефолтные 10000мс
    или собственный data-duration, не трогать.

    Проверить что изменения затронули ровно 5 атрибутов и ни одного лишнего.
  </action>
  <verify>grep -c "data-duration=\"13000\"" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - grep по 'data-duration="13000"' возвращает 5 (ровно 5 баннерных слайдов с 13000мс)
    - grep по 'data-duration="10000"' на баннерных слайдах возвращает 0 (10000мс убраны у баннеров)
    - HTML-слайды (s0, s2, s4, s6) не затронуты
  </acceptance_criteria>
</task>

<task type="edit" id="1-03-02">
  <name>Доработать слайд 7 (доставка): оба варианта + крупный текст условий</name>
  <files>c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
    c:\Users\ikoko\Projects\radio-smartTV\.planning\REQUIREMENTS.md
  </read_first>
  <action>
    Найти в HTML блок слайда 7 — div с id="s6" (шестой по счёту, нулевая индексация) или искать по
    тексту "Доставка" / "доставим" / "delivery" в районе четвёртого HTML-слайда.

    Требование CONTENT-04: слайд должен содержать ДВА варианта доставки:
    1. Бесплатная доставка при заказе на сайте от 20 000 ₽
    2. Бесплатная доставка из магазина от 50 000 ₽

    Проверить текущее содержимое слайда. Если оба варианта уже присутствуют — задача сводится к
    проверке читаемости и при необходимости увеличению font-size ключевых цифр.

    **Требования к читаемости (с 2–3 метров при экране 1920×1080):**
    - Заголовок слайда: font-size не менее 52px, font-weight 700 или 800
    - Суммы (20 000 ₽ и 50 000 ₽): font-size не менее 64px, font-weight 800 или 900
    - Описание варианта (подпись): font-size не менее 28px

    **Если один из вариантов отсутствует:**
    Добавить недостающий вариант в разметку слайда, сохранив структуру и CSS-классы аналогично
    существующему варианту. Структура обоих вариантов должна быть симметричной (два блока рядом
    или вертикально с разделителем).

    Текст для варианта "с сайта":
    - Метка: "Заказ на сайте STV39.RU"
    - Сумма: "от 20 000 ₽"

    Текст для варианта "из магазина":
    - Метка: "Самовывоз / из магазина"
    - Сумма: "от 50 000 ₽"

    Оба блока должны иметь класс `.ap` для анимации появления.
  </action>
  <verify>grep -c "50 000" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - grep по "50 000" в HTML возвращает не менее 1 (второй вариант доставки присутствует)
    - grep по "20 000" в HTML возвращает не менее 1 (первый вариант доставки присутствует)
    - Оба блока условий находятся внутри слайда с доставкой (не в других слайдах)
  </acceptance_criteria>
</task>

<task type="run" id="1-03-03">
  <name>Финальная проверка: 9 слайдов, структура цикла, консоль без ошибок</name>
  <files>— (только проверки, файл не редактируется)</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
  </read_first>
  <action>
    Выполнить серию проверок командами grep/bash для подтверждения полноты фазы 1:

    **Проверка 1 — 9 слайдов в HTML:**
    ```bash
    grep -c 'class="slide' "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"
    ```
    Ожидаемый результат: 9

    **Проверка 2 — нет кириллики в src изображений:**
    ```bash
    grep -E 'src="[^"]*[а-яА-ЯёЁ][^"]*"' "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"
    ```
    Ожидаемый результат: пустой вывод (0 совпадений)

    **Проверка 3 — нет Google Fonts:**
    ```bash
    grep "fonts.googleapis.com" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"
    ```
    Ожидаемый результат: пустой вывод

    **Проверка 4 — нет flash overlay в JS:**
    ```bash
    grep "getElementById('fl')" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"
    ```
    Ожидаемый результат: пустой вывод

    **Проверка 5 — баннеры имеют 13000:**
    ```bash
    grep -c 'data-duration="13000"' "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"
    ```
    Ожидаемый результат: 5

    **Проверка 6 — fonts/ папка с 14 файлами:**
    ```bash
    ls "c:/Users/ikoko/Projects/radio-smartTV/fonts/"*.woff2 | wc -l
    ```
    Ожидаемый результат: 14

    **Проверка 7 — slides/ содержит banner-01..05:**
    ```bash
    ls "c:/Users/ikoko/Projects/radio-smartTV/slides/banner-"*.png | wc -l
    ```
    Ожидаемый результат: 5

    Если любая проверка возвращает неожиданный результат — исправить соответствующую задачу
    из плана 1-01 или 1-02 до перехода к коммиту.
  </action>
  <verify>grep -c 'class="slide' "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - Все 7 проверок выше дают ожидаемые результаты
    - Файл electrocentre-tv-v2.1.html открывается в браузере без JavaScript-ошибок в консоли
    - Визуально: слайды переключаются с плавным fade, без вспышки (проверить в Chrome)
  </acceptance_criteria>
</task>

## Волны

**Волна 1:** задачи 1-03-01 и 1-03-02 редактируют один файл. Выполнять последовательно:
сначала 1-03-01 (data-duration), потом 1-03-02 (контент слайда 7).

**Волна 2:** задача 1-03-03 — только чтение и проверки, выполняется последней.

## Финальный шаг фазы 1

После прохождения всех проверок из задачи 1-03-03 выполнить коммит всех изменений фазы:

```bash
cd c:/Users/ikoko/Projects/radio-smartTV
git add electrocentre-tv-v2.1.html fonts/ slides/banner-*.png
git status  # убедиться что старые кириллические файлы помечены как renamed
git commit -m "phase-1: self-hosted fonts, banner renames, crossfade, content polish"
git push
```

GitHub Pages обновится автоматически в течение 1–2 минут.
