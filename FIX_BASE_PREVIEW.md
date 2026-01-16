# Исправление превью в Base app

## Проблема
Open Graph Preview работает правильно, но в Base app превью не показывает изображение.

## Что сделано

1. ✅ Создан `embed-image.png` (для `fc:miniapp` meta-тега)
2. ✅ Создан `hero.png` (для manifest)
3. ✅ Обновлен `fc:miniapp` meta-тег - теперь использует `og-image.png`
4. ✅ Все изображения имеют размер 1200x630px

## Возможные причины проблемы

### 1. Кэширование Base app
Base app может кэшировать метаданные. Попробуйте:
- Удалить старый пост и создать новый
- Подождать 5-10 минут для обновления кэша
- Использовать другой аккаунт для проверки

### 2. Base app использует manifest
Base app может использовать данные из `.well-known/farcaster.json` вместо HTML meta-тегов.

**Проверьте:**
- `ogImageUrl` в manifest указывает на правильный URL
- `heroImageUrl` в manifest указывает на правильный URL
- Все URL доступны и возвращают изображения

### 3. Проверка доступности изображений

Убедитесь, что все изображения доступны:
```bash
# Проверьте в браузере:
https://base-match-3.vercel.app/og-image.png
https://base-match-3.vercel.app/embed-image.png
https://base-match-3.vercel.app/hero.png
```

Все должны возвращать изображение, а не 404.

## Решение

### Шаг 1: Проверьте доступность изображений

Через 1-2 минуты после деплоя проверьте:
- https://base-match-3.vercel.app/og-image.png ✅
- https://base-match-3.vercel.app/embed-image.png ✅
- https://base-match-3.vercel.app/hero.png ✅

### Шаг 2: Очистите кэш Base app

1. **Удалите старый пост** (если есть)
2. **Подождите 5-10 минут**
3. **Создайте новый пост** с URL приложения

### Шаг 3: Проверьте manifest

Убедитесь, что в `.well-known/farcaster.json`:
```json
{
  "ogImageUrl": "https://base-match-3.vercel.app/og-image.png",
  "heroImageUrl": "https://base-match-3.vercel.app/hero.png"
}
```

### Шаг 4: Используйте Base Build Preview

1. Откройте https://build.base.org/preview
2. Введите URL: `https://base-match-3.vercel.app`
3. Проверьте вкладку "Metadata"
4. Убедитесь, что изображения отображаются

## Альтернативное решение

Если проблема сохраняется, попробуйте:

1. **Использовать абсолютные URL** (уже сделано ✅)
2. **Проверить CORS заголовки** (Vercel должен обрабатывать автоматически)
3. **Использовать CDN** (опционально, Vercel уже использует CDN)

## Текущие настройки

### HTML (index.html):
- ✅ `og:image` → `og-image.png`
- ✅ `fc:miniapp.imageUrl` → `og-image.png`
- ✅ `twitter:image` → `og-image.png`

### Manifest (.well-known/farcaster.json):
- ✅ `ogImageUrl` → `og-image.png`
- ✅ `heroImageUrl` → `hero.png`

### Файлы:
- ✅ `og-image.png` (1200x630px)
- ✅ `embed-image.png` (1200x630px)
- ✅ `hero.png` (1200x630px)

## Если проблема сохраняется

1. Проверьте консоль браузера в Base app (если доступна)
2. Проверьте Network tab - загружаются ли изображения
3. Попробуйте использовать другой браузер/устройство
4. Свяжитесь с поддержкой Base app

## Важно

Base app может кэшировать метаданные до 24 часов. Если вы только что обновили изображения, подождите некоторое время или создайте новый пост.
