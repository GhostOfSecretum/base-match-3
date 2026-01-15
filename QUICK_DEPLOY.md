# Быстрый деплой на Vercel

## Вариант 1: Через Vercel CLI (быстрее всего)

```bash
# 1. Войдите в Vercel (если еще не вошли)
vercel login

# 2. Задеплойте проект
vercel

# Следуйте инструкциям:
# - Set up and deploy? → Y
# - Which scope? → выберите ваш аккаунт
# - Link to existing project? → N
# - Project name? → base-match-3
# - Directory? → ./
# - Override settings? → N

# 3. После деплоя вы получите URL
# Сохраните его! Он понадобится для следующих шагов
```

## Вариант 2: Через GitHub + Vercel Dashboard

1. Откройте https://vercel.com
2. Войдите через GitHub
3. Нажмите "Add New Project"
4. Выберите репозиторий `GhostOfSecretum/base-match-3`
5. Нажмите "Import"
6. Настройки:
   - Framework: **Other**
   - Build Command: оставьте пустым
   - Output Directory: оставьте пустым
7. Нажмите "Deploy"

## После деплоя

1. **Скопируйте ваш Vercel URL** (например: `https://base-match-3-xxx.vercel.app`)

2. **Проверьте, что manifest доступен:**
   - Откройте: `https://ваш-url.vercel.app/.well-known/farcaster.json`
   - Должен отображаться JSON

3. **Следуйте инструкциям в PUBLISH_STEPS.md** для:
   - Обновления URLs
   - Создания изображений
   - Генерации account association
   - Тестирования и публикации
