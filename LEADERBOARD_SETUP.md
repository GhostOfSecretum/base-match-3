# Настройка общего лидерборда

Лидерборд использует **Upstash Redis** (через Vercel Marketplace) для хранения результатов всех игроков.

> **Важно:** Vercel KV больше недоступен напрямую. Теперь нужно использовать интеграции из [Vercel Marketplace](https://vercel.com/marketplace).

## Пошаговая инструкция

### 1. Откройте Vercel Marketplace

Перейдите на [vercel.com/marketplace](https://vercel.com/marketplace)

### 2. Найдите Upstash

1. В поиске введите **"Upstash"**
2. Или перейдите напрямую: [Upstash Redis](https://vercel.com/marketplace/upstash)
3. Нажмите на **"Upstash"**

### 3. Добавьте интеграцию

1. Нажмите **"Add Integration"**
2. Выберите ваш аккаунт Vercel
3. Выберите проект с игрой
4. Нажмите **"Continue"**
5. Вы будете перенаправлены на Upstash для создания базы данных

### 4. Создайте Redis базу данных в Upstash

1. Войдите или создайте аккаунт Upstash
2. Нажмите **"Create Database"**
3. Введите имя: `game-leaderboard`
4. Выберите регион (рекомендуется ближайший к пользователям)
5. Нажмите **"Create"**

### 5. Подключите к Vercel проекту

После создания базы данных:

1. Вернитесь в Vercel Dashboard
2. Откройте ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Убедитесь, что добавлены переменные:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Если переменные не добавились автоматически:
1. Откройте [console.upstash.com](https://console.upstash.com)
2. Выберите вашу базу данных
3. Скопируйте `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`
4. Добавьте их в Environment Variables вашего Vercel проекта

### 6. Переразверните проект

**Важно!** После добавления переменных нужно переразвернуть проект:

1. Перейдите на вкладку **"Deployments"**
2. Найдите последний деплой
3. Нажмите на три точки справа → **"Redeploy"**
4. Подтвердите переразвертывание

## Проверка работы

После настройки лидерборд должен:

- ✅ Сохранять результаты после каждой игры
- ✅ Показывать результаты всех игроков
- ✅ Сохранять данные между перезапусками приложения
- ✅ Фильтровать по периодам (сегодня, неделя, все время)

## Устранение неполадок

### Ошибка "Leaderboard storage is not configured"

Это означает, что Redis не подключен. Проверьте:

1. Создана ли база данных в Upstash
2. Добавлены ли переменные окружения в Vercel:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Был ли проект переразвернут после добавления переменных

### Как проверить переменные окружения

1. Откройте Vercel Dashboard → ваш проект
2. Перейдите в **Settings** → **Environment Variables**
3. Убедитесь, что переменные `UPSTASH_REDIS_*` присутствуют

### Ошибка "Failed to save to leaderboard storage"

Возможные причины:
1. Проблемы с сетью
2. Превышен лимит Upstash (бесплатный план: 10,000 команд/день)
3. Неверные credentials

## Бесплатный план Upstash

- 10,000 команд в день
- 256 MB данных
- 1 база данных

Этого достаточно для небольшого приложения.

## Альтернативы

Если Upstash не подходит, в Vercel Marketplace доступны:

- **Neon** - Serverless Postgres
- **PlanetScale** - MySQL
- **MongoDB Atlas** - документная база данных
- **Supabase** - PostgreSQL + API
