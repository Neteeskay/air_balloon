# Четыре готовых образа

В интерфейсе доступны два головных убора (Авиатор, Соломенная шляпа) и два аксессуара на шею (Красная бабочка, Облачный шарфик). Одежда заблокирована: «Скоро появится». Снятие аксессуаров отключено: всегда выбирается одна из четырёх пар.

`catalog.ts` содержит исчерпывающий манифест `renderAssets`. `PetPreview` выводит ровно один PNG через `img` с `object-fit: contain`; никаких наклеек, спрайт-листов или запасного послойного режима нет. При ошибке картинки доступна повторная загрузка.

Старые сохранения валидируются: убранные головные уборы и украшения заменяются на Авиатор/бабочку, одежда снимается. Имя питомца сохраняется. Хранение локальное, раздельное по пользователю.

## Файлы (от корня frontend/public)

- `assets/avatar/rendered-aviator-bow-v2.png`
- `assets/avatar/rendered-aviator-cloud-scarf-v3.png`
- `assets/avatar/rendered-sunhat-bow.png`
- `assets/avatar/rendered-sunhat-cloud-scarf-v2.png`

Все четыре: 1254 × 1254, RGBA. Альфа-канал проверен, все пары визуально проверены в приложении. Для каждого головного убора вариант с шарфиком сделан на основе соответствующего эталона с бабочкой: направление, масштаб и положение головного убора сохранены. Предыдущие экспериментальные картинки не подключаются.

## Генерация

Встроенный imagegen, не CLI/API. Исходники пользователя использованы как референсы. Финальные версии со шарфиком получены редактированием соответствующей прозрачной версии с бабочкой — это фиксирует положение головного убора внутри каждой пары.

Промпт для шляпы: «Replace only the red bow tie with a soft blue scarf with white cloud motifs and fringed ends hanging on the viewer's right. Keep the straw hat exactly unchanged: flower on left, brim on right. Same chinchilla, unchanged head, eyes, pose, body and framing. Transparent PNG game sprite.»

Промпт для авиатора: «Replace only the red bow tie with a soft blue scarf with white cloud motifs and fringed ends hanging on the viewer's right. Keep the aviator goggles exactly unchanged: same dark lenses and reflections, same gold rims, same brown strap and buckle. Same chinchilla, unchanged head, eyes, pose, body and framing. Transparent PNG game sprite.»

## Запуск

Из frontend: `npm run dev -- --host 127.0.0.1 --port 5186 --strictPort`.
Тестовый вход → «Мой профиль и образ» → «Настроить образ».
