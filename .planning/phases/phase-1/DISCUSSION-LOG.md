# Discussion Log — Phase 1

**Date:** 2026-03-23

## Questions Raised and Answered

### Q: Как реализовать плавный переход между слайдами?
**A:** Вариант A — переписать слайдер на opacity, убрать display:none/flex и белый flash-оверлей.
**Decision:** Оба слайда `display:flex`, переключение через `opacity` с `transition 400мс`.

### Q: Как подключить шрифт Montserrat без Google CDN?
**A:** Вариант A — отдельные woff2-файлы в папке fonts/ на GitHub Pages.
**Decision:** Self-hosted woff2, `@font-face` в `<style>`. Base64 — запасной вариант если будут проблемы на TV.

### Q: В какой формат переименовать файлы баннеров?
**A:** Вариант 1 — `banner-01.webp`.
**Decision:** `banner-01.webp` ... `banner-05.webp`. Простой формат для передачи нетехническому менеджеру в будущем.

## Questions Raised but Deferred

### Q: Нужен ли скринсейвер уже в фазе 1?
**Reason deferred:** Функция важная но не блокирует одобрение руководством. Добавлена в Фазу 3.
**Owner:** Revisit in Phase 3.
