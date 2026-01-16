# Интеграция логотипа в превью поста

## Что сделано

Добавлены Open Graph meta-теги в `index.html` для отображения превью с логотипом в постах Base app.

## Необходимые изображения

Для работы превью нужно создать и загрузить изображение:

### og-image.png (1200x630px)
- **Размер:** 1200x630 пикселей
- **Формат:** PNG
- **Использование:** Превью изображение в постах Base app
- **URL:** `https://base-match-3.vercel.app/og-image.png`

## Как создать изображение

### Вариант 1: Использовать ваш дизайн
Если у вас уже есть изображение с "BASE MATCH-3" на синем фоне:
1. Убедитесь, что размер 1200x630px
2. Сохраните как `og-image.png`
3. Разместите в корне проекта (рядом с `index.html`)

### Вариант 2: Создать из Base брендинга
1. Используйте Base logo из `assets/Logotype/Base_lockup_white.svg`
2. Добавьте текст "MATCH-3"
3. Используйте синий фон Base (#0052FF)
4. Сохраните как 1200x630px PNG

### Вариант 3: Использовать онлайн-редактор
1. Откройте [Canva](https://www.canva.com) или [Figma](https://www.figma.com)
2. Создайте дизайн 1200x630px
3. Используйте Base брендинг
4. Экспортируйте как PNG

## Размещение файла

1. Сохраните изображение как `og-image.png` в корне проекта:
```
/Users/rustamahatov/Downloads/Base Game 1.1/
├── og-image.png  ← здесь
├── index.html
└── ...
```

2. Закоммитьте и запушьте:
```bash
git add og-image.png
git commit -m "Add og-image for post preview"
git push
```

3. Vercel автоматически задеплоит файл

4. Проверьте доступность:
   - Откройте: https://base-match-3.vercel.app/og-image.png
   - Должно отображаться ваше изображение

## Проверка превью

После загрузки изображения:

1. **В Base app:**
   - Создайте новый пост с URL приложения
   - Должно появиться превью с вашим изображением

2. **Проверка Open Graph:**
   - Используйте [Open Graph Preview](https://www.opengraph.xyz/) или [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - Введите URL: `https://base-match-3.vercel.app`
   - Проверьте, что изображение отображается правильно

## Дополнительные изображения

Для полной интеграции также нужны:
- `embed-image.png` - для rich embeds (используется в `fc:miniapp` meta-теге)
- `hero.png` - главное изображение (используется в manifest)

Можно использовать тот же дизайн для всех трех изображений.

## Текущие настройки

В `index.html` уже настроены:
- ✅ `og:image` → `og-image.png`
- ✅ `og:title` → "Base Match-3"
- ✅ `og:description` → описание игры
- ✅ `twitter:image` → `og-image.png`

В `.well-known/farcaster.json`:
- ✅ `ogImageUrl` → `og-image.png`
- ✅ `heroImageUrl` → `hero.png`
- ✅ `imageUrl` (в `fc:miniapp`) → `embed-image.png`

После загрузки изображений превью будет работать автоматически!
