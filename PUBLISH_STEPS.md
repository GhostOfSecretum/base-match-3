# Пошаговая инструкция по публикации в Base App

## Шаг 1: Деплой на Vercel (самый простой способ)

### Вариант A: Через GitHub (рекомендуется)

1. **Подключите GitHub к Vercel:**
   - Откройте https://vercel.com
   - Войдите через GitHub
   - Нажмите "Add New Project"
   - Выберите репозиторий `base-match-3`
   - Нажмите "Import"

2. **Настройки проекта:**
   - Framework Preset: **Other**
   - Root Directory: `.` (оставьте как есть)
   - Build Command: оставьте пустым
   - Output Directory: оставьте пустым
   - Нажмите "Deploy"

3. **Дождитесь деплоя:**
   - Vercel автоматически задеплоит ваш проект
   - Вы получите URL вида: `https://base-match-3-xxx.vercel.app`
   - **Сохраните этот URL!**

### Вариант B: Через Vercel CLI

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Войдите в Vercel
vercel login

# Задеплойте проект
vercel

# Следуйте инструкциям
# Выберите:
# - Set up and deploy? Y
# - Which scope? (ваш аккаунт)
# - Link to existing project? N
# - Project name? base-match-3
# - Directory? ./
```

## Шаг 2: Обновите URLs в проекте

После деплоя у вас будет URL вида `https://base-match-3-xxx.vercel.app`

### 2.1 Обновите manifest файл

Откройте `.well-known/farcaster.json` и замените все `https://your-app.com` на ваш Vercel URL.

**Пример:**
```json
{
  "miniapp": {
    "homeUrl": "https://base-match-3-xxx.vercel.app",
    "iconUrl": "https://base-match-3-xxx.vercel.app/icon.png",
    ...
  }
}
```

### 2.2 Обновите HTML

Откройте `index.html` и обновите meta-тег `fc:miniapp`:

```html
<meta name="fc:miniapp" content='{
  "version":"next",
  "imageUrl":"https://base-match-3-xxx.vercel.app/embed-image.png",
  "button":{
    "title":"Play Now",
    "action":{
      "type":"launch_miniapp",
      "name":"Base Match-3",
      "url":"https://base-match-3-xxx.vercel.app",
      "splashImageUrl":"https://base-match-3-xxx.vercel.app/splash.png",
      "splashBackgroundColor":"#000000"
    }
  }
}' />
```

### 2.3 Закоммитьте и запушьте изменения

```bash
git add .
git commit -m "Update URLs for deployment"
git push
```

Vercel автоматически задеплоит обновления.

## Шаг 3: Создайте необходимые изображения

Вам нужно создать и загрузить следующие изображения:

1. **icon.png** (512x512px) - иконка приложения
2. **splash.png** (1200x630px) - экран загрузки
3. **embed-image.png** (1200x630px) - для rich embeds
4. **hero.png** (1200x630px) - главное изображение
5. **og-image.png** (1200x630px) - для социальных сетей
6. **screenshot1.png, screenshot2.png, screenshot3.png** (1200x630px) - скриншоты игры

**Где разместить:**
- Загрузите все изображения в корень проекта (рядом с index.html)
- Или создайте папку `public/` и разместите там

**Быстрый способ:**
- Сделайте скриншоты игры
- Используйте онлайн-редактор (Canva, Figma) для создания изображений
- Сохраните в нужных размерах

## Шаг 4: Генерация Account Association

1. **Убедитесь, что manifest доступен:**
   - Откройте в браузере: `https://ваш-url.vercel.app/.well-known/farcaster.json`
   - Должен отображаться JSON файл

2. **Сгенерируйте credentials:**
   - Откройте https://build.base.org/account-association
   - Введите ваш Vercel URL
   - Нажмите "Submit"
   - Нажмите "Verify"
   - Следуйте инструкциям для генерации

3. **Обновите manifest:**
   - Скопируйте `header`, `payload`, `signature`
   - Вставьте в `.well-known/farcaster.json`
   - Закоммитьте и запушьте

## Шаг 5: Тестирование

1. **Используйте Base Build Preview:**
   - Откройте https://build.base.org/preview
   - Введите ваш Vercel URL
   - Проверьте:
     - ✅ Manifest загружается
     - ✅ Account association валиден
     - ✅ Metadata отображается
     - ✅ Приложение запускается

## Шаг 6: Публикация

1. **Создайте пост в Base app:**
   - Откройте Base app
   - Создайте новый пост
   - Включите URL вашего приложения
   - Добавьте описание

2. **Готово!**
   - Ваше приложение появится в разделе Mini Apps
   - Пользователи смогут его найти и запустить

## Полезные ссылки

- [Base Build Preview](https://build.base.org/preview)
- [Base Build Account Association](https://build.base.org/account-association)
- [Base Mini Apps Docs](https://docs.base.org/mini-apps/quickstart/migrate-existing-apps)
- [Vercel Dashboard](https://vercel.com/dashboard)

## Текущий статус

- ✅ Проект готов к деплою
- ✅ MiniApp SDK интегрирован
- ✅ Manifest файл создан
- ⏳ Нужно: деплой, обновление URLs, создание изображений, account association
