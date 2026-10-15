// Порядок снят с electrocentre-tv-v2.1.html на 15.10.2026.
const image = (id, name, path) => ({ id, kind: 'image', name, src: path + '?v=oct2026', durationSeconds: 10, startAt: '2026-10-01T00:00:00+03:00', endAt: '2026-11-01T00:00:00+03:00' });
const video = n => ({ id: `video-${n}`, kind: 'video', name: `Ролик ${n}`, src: `videos/seriya-${n}.mp4` });
const builtin = (id, name, durationSeconds) => ({ id, kind: 'builtin', name, templateId: id, durationSeconds });
const one = version => ({ id: `slot-${version.id}`, versions: [version] });
export const INITIAL_PLAYLIST = [
  one(builtin('s0', 'Стартовый слайд', 10)),
  one(video(1)),
  one(builtin('s2', 'Постоянный слайд', 10)),
  one(image('oct1', 'Скидка 15% LED LINE', 'slides/01.10-31.10.26/942-skidka-led-line-1026.webp')),
  one(video(2)),
  one(builtin('s5', 'Карта', 52)),
  one(builtin('sB', 'Бонусная программа', 42)),
  one(image('oct2', 'Кронштейн в подарок', 'slides/01.10-31.10.26/942-kronshtein-dku-1026.webp')),
  one(video(3)),
  one(builtin('s7', 'Постоянный слайд', 10)),
  one(image('oct3', 'Термоусадки в подарок', 'slides/01.10-31.10.26/942-termousadki-konnektory-1026.webp')),
  one(video(4)),
  one(image('oct4', 'Диски в подарок', 'slides/01.10-31.10.26/942-diski-ushm-dck-1026.webp')),
  one(video(5)),
  one(image('oct5', 'Коробка бесплатно', 'slides/01.10-31.10.26/942-korobka-gofrotruba-1026.webp')),
  one(video(6)),
  one(image('oct6', 'Крепёж в подарок', 'slides/01.10-31.10.26/942-krepezh-shkaf-skat-1026.webp')),
  one(video(7))
];
