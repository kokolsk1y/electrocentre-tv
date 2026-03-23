---
phase: "1"
plan: "1-01"
name: "fonts-and-banners"
wave: 1
depends_on: []
autonomous: true
requirements:
  - TECH-01
  - TECH-02
  - CONTENT-05
must_haves:
  truths:
    - "В HTML отсутствует <link> на fonts.googleapis.com"
    - "В HTML присутствуют @font-face блоки для весов 300,400,500,600,700,800,900"
    - "В папке fonts/ лежат woff2-файлы для кириллицы и латиницы каждого веса"
    - "В папке slides/ нет файлов с кириллическими именами"
    - "В HTML все src баннеров указывают на slides/banner-0X.png"
  artifacts:
    - "electrocentre-tv-v2.1.html"
    - "fonts/montserrat-300-cyrillic.woff2"
    - "fonts/montserrat-300-latin.woff2"
    - "fonts/montserrat-400-cyrillic.woff2"
    - "fonts/montserrat-400-latin.woff2"
    - "fonts/montserrat-500-cyrillic.woff2"
    - "fonts/montserrat-500-latin.woff2"
    - "fonts/montserrat-600-cyrillic.woff2"
    - "fonts/montserrat-600-latin.woff2"
    - "fonts/montserrat-700-cyrillic.woff2"
    - "fonts/montserrat-700-latin.woff2"
    - "fonts/montserrat-800-cyrillic.woff2"
    - "fonts/montserrat-800-latin.woff2"
    - "fonts/montserrat-900-cyrillic.woff2"
    - "fonts/montserrat-900-latin.woff2"
    - "slides/banner-01.png"
    - "slides/banner-02.png"
    - "slides/banner-03.png"
    - "slides/banner-04.png"
    - "slides/banner-05.png"
---

## Цель

Убрать зависимость от Google Fonts CDN и перевести баннеры на ASCII-имена.
После выполнения этого плана файл не будет обращаться к внешним шрифтовым сервисам,
а баннерные изображения получат простые имена, безопасные в URL на любом хостинге.

## Контекст

- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\CONTEXT.md`
- Прочитать: `c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md`
- Рабочий файл: `c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html`

## Задачи

<task type="run" id="1-01-01">
  <name>Скачать woff2-файлы Montserrat в папку fonts/</name>
  <files>fonts/ (новая папка)</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md
  </read_first>
  <action>
    1. Создать папку `c:\Users\ikoko\Projects\radio-smartTV\fonts\` если не существует.

    2. Скачать 14 woff2-файлов для весов 300, 400, 500, 600, 700, 800, 900 (кириллица + латиница) с npm-пакета fontsource. Использовать следующую команду для каждого нужного файла через npx или curl от google-webfonts-helper (https://gwfh.mranftl.com/api/fonts/montserrat):

       Источник: https://gwfh.mranftl.com/api/fonts/montserrat?download=zip&subsets=cyrillic,latin&variants=300,regular,500,600,700,800,900&formats=woff2

       Либо установить @fontsource/montserrat и скопировать файлы:
       ```
       cd c:\Users\ikoko\Projects\radio-smartTV
       npm install @fontsource/montserrat --prefix ./tmp_fonts
       ```
       После установки скопировать из `tmp_fonts/node_modules/@fontsource/montserrat/files/` файлы по шаблону:
       - montserrat-cyrillic-300-normal.woff2  → fonts/montserrat-300-cyrillic.woff2
       - montserrat-latin-300-normal.woff2     → fonts/montserrat-300-latin.woff2
       - montserrat-cyrillic-400-normal.woff2  → fonts/montserrat-400-cyrillic.woff2
       - montserrat-latin-400-normal.woff2     → fonts/montserrat-400-latin.woff2
       - montserrat-cyrillic-500-normal.woff2  → fonts/montserrat-500-cyrillic.woff2
       - montserrat-latin-500-normal.woff2     → fonts/montserrat-500-latin.woff2
       - montserrat-cyrillic-600-normal.woff2  → fonts/montserrat-600-cyrillic.woff2
       - montserrat-latin-600-normal.woff2     → fonts/montserrat-600-latin.woff2
       - montserrat-cyrillic-700-normal.woff2  → fonts/montserrat-700-cyrillic.woff2
       - montserrat-latin-700-normal.woff2     → fonts/montserrat-700-latin.woff2
       - montserrat-cyrillic-800-normal.woff2  → fonts/montserrat-800-cyrillic.woff2
       - montserrat-latin-800-normal.woff2     → fonts/montserrat-800-latin.woff2
       - montserrat-cyrillic-900-normal.woff2  → fonts/montserrat-900-cyrillic.woff2
       - montserrat-latin-900-normal.woff2     → fonts/montserrat-900-latin.woff2

       После копирования удалить tmp_fonts/.

    3. Проверить что все 14 файлов присутствуют в `c:\Users\ikoko\Projects\radio-smartTV\fonts\` и каждый имеет ненулевой размер (больше 5KB).
  </action>
  <verify>ls c:/Users/ikoko/Projects/radio-smartTV/fonts/*.woff2 | wc -l</verify>
  <acceptance_criteria>
    - В папке fonts/ ровно 14 .woff2-файлов с именами montserrat-{weight}-{subset}.woff2
    - Каждый файл больше 5KB (не пустой и не битый)
  </acceptance_criteria>
</task>

<task type="run" id="1-01-02">
  <name>Переименовать 5 баннерных файлов через git mv</name>
  <files>
    slides/2слайд_upscayl_2x_remacri-4x.png → slides/banner-01.png
    slides/4слайд_upscayl_2x_remacri-4x.png → slides/banner-02.png
    slides/6слайд_upscayl_2x_remacri-4x.png → slides/banner-03.png
    slides/8слайд_upscayl_2x_remacri-4x.png → slides/banner-04.png
    slides/9слайд_upscayl_2x_remacri-4x.png → slides/banner-05.png
  </files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md
  </read_first>
  <action>
    Выполнить в директории `c:\Users\ikoko\Projects\radio-smartTV\`:

    ```bash
    git mv "slides/2слайд_upscayl_2x_remacri-4x.png" "slides/banner-01.png"
    git mv "slides/4слайд_upscayl_2x_remacri-4x.png" "slides/banner-02.png"
    git mv "slides/6слайд_upscayl_2x_remacri-4x.png" "slides/banner-03.png"
    git mv "slides/8слайд_upscayl_2x_remacri-4x.png" "slides/banner-04.png"
    git mv "slides/9слайд_upscayl_2x_remacri-4x.png" "slides/banner-05.png"
    ```

    Порядок соответствия (из RESEARCH.md):
    - 2слайд → banner-01 (слайд s1)
    - 4слайд → banner-02 (слайд s3)
    - 6слайд → banner-03 (слайд s5)
    - 8слайд → banner-04 (слайд s7)
    - 9слайд → banner-05 (слайд s8)

    Расширение остаётся .png — НЕ переименовывать в .webp, файлы не конвертируются.
    Задача 1-01-03 (обновление src в HTML) выполняется только ПОСЛЕ этого шага.
  </action>
  <verify>ls c:/Users/ikoko/Projects/radio-smartTV/slides/banner-*.png | wc -l</verify>
  <acceptance_criteria>
    - В папке slides/ присутствуют файлы banner-01.png, banner-02.png, banner-03.png, banner-04.png, banner-05.png
    - Файлов с кириллическими именами в slides/ больше нет
  </acceptance_criteria>
</task>

<task type="edit" id="1-01-03">
  <name>Заменить Google Fonts link и src баннеров в HTML</name>
  <files>c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html</files>
  <read_first>
    c:\Users\ikoko\Projects\radio-smartTV\electrocentre-tv-v2.1.html
    c:\Users\ikoko\Projects\radio-smartTV\.planning\phases\phase-1\RESEARCH.md
  </read_first>
  <action>
    Выполнить три независимых изменения в `electrocentre-tv-v2.1.html`:

    **Изменение A — убрать CDN и добавить @font-face:**

    Строка 7: удалить тег:
    ```html
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,800;1,900&display=swap" rel="stylesheet">
    ```

    Вместо него, в начале блока `<style>` (до строки `* { margin:0; ... }`), добавить 14 блоков @font-face:

    ```css
    /* Montserrat — self-hosted, кириллица */
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:300; font-display:swap; src:url('fonts/montserrat-300-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:400; font-display:swap; src:url('fonts/montserrat-400-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:500; font-display:swap; src:url('fonts/montserrat-500-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:600; font-display:swap; src:url('fonts/montserrat-600-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:700; font-display:swap; src:url('fonts/montserrat-700-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:800; font-display:swap; src:url('fonts/montserrat-800-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:900; font-display:swap; src:url('fonts/montserrat-900-cyrillic.woff2') format('woff2'); unicode-range:U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116; }
    /* Montserrat — self-hosted, латиница */
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:300; font-display:swap; src:url('fonts/montserrat-300-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:400; font-display:swap; src:url('fonts/montserrat-400-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:500; font-display:swap; src:url('fonts/montserrat-500-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:600; font-display:swap; src:url('fonts/montserrat-600-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:700; font-display:swap; src:url('fonts/montserrat-700-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:800; font-display:swap; src:url('fonts/montserrat-800-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    @font-face { font-family:'Montserrat'; font-style:normal; font-weight:900; font-display:swap; src:url('fonts/montserrat-900-latin.woff2') format('woff2'); unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+FEFF; }
    ```

    **Изменение B — обновить src баннеров:**

    Найти в HTML 5 тегов `<img` с src содержащими кириллические имена файлов (шаблон `*слайд_upscayl*`).
    Заменить их src атрибуты по таблице:
    - `src="slides/2слайд_upscayl_2x_remacri-4x.png"` → `src="slides/banner-01.png"`
    - `src="slides/4слайд_upscayl_2x_remacri-4x.png"` → `src="slides/banner-02.png"`
    - `src="slides/6слайд_upscayl_2x_remacri-4x.png"` → `src="slides/banner-03.png"`
    - `src="slides/8слайд_upscayl_2x_remacri-4x.png"` → `src="slides/banner-04.png"`
    - `src="slides/9слайд_upscayl_2x_remacri-4x.png"` → `src="slides/banner-05.png"`

    Других изменений в HTML не делать.
  </action>
  <verify>grep -c "fonts.googleapis.com" "c:/Users/ikoko/Projects/radio-smartTV/electrocentre-tv-v2.1.html"</verify>
  <acceptance_criteria>
    - grep по "fonts.googleapis.com" в HTML возвращает 0 совпадений
    - grep по "font-display:swap" возвращает не менее 14 совпадений
    - grep по "montserrat-300-cyrillic" возвращает 1 совпадение (есть @font-face)
    - grep по "banner-01.png" возвращает 1 совпадение (есть src)
    - grep по "слайд_upscayl" возвращает 0 совпадений (кириллики нет в src)
  </acceptance_criteria>
</task>

## Волны

**Волна 1:** задачи 1-01-01 и 1-01-02 выполняются параллельно (не затрагивают общие файлы).
**Волна 2:** задача 1-01-03 выполняется после 1-01-01 и 1-01-02 (пишет в HTML, использует результаты обоих).

## Риски

- Если npm недоступен — использовать curl для скачивания zip с google-webfonts-helper, распаковать вручную.
- Расширение файлов остаётся .png. НЕ переименовывать в .webp — файлы не конвертируются.
- Задача 1-01-03 выполняется только ПОСЛЕ 1-01-02: если обновить src до переименования файлов, баннеры исчезнут.
