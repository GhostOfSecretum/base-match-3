# GitHub Setup Instructions

## Создание репозитория на GitHub

1. **Перейдите на GitHub:**
   - Откройте https://github.com
   - Войдите в свой аккаунт

2. **Создайте новый репозиторий:**
   - Нажмите кнопку "+" в правом верхнем углу
   - Выберите "New repository"
   - Название: `base-match-3` (или любое другое)
   - Описание: "Match-3 puzzle game with crypto tokens for Base Mini Apps"
   - Выберите **Public** или **Private** (на ваше усмотрение)
   - **НЕ** добавляйте README, .gitignore или лицензию (они уже есть)
   - Нажмите "Create repository"

3. **Подключите локальный репозиторий к GitHub:**

   После создания репозитория GitHub покажет инструкции. Выполните команды:

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/base-match-3.git
   git branch -M main
   git push -u origin main
   ```

   Замените `YOUR_USERNAME` на ваш GitHub username.

## Альтернативный способ (через SSH):

Если у вас настроен SSH ключ:

```bash
git remote add origin git@github.com:YOUR_USERNAME/base-match-3.git
git branch -M main
git push -u origin main
```

## Проверка

После успешного push:
- Откройте ваш репозиторий на GitHub
- Убедитесь, что все файлы загружены
- Проверьте, что README.md отображается корректно

## Продолжение разработки позже

Когда будете готовы продолжить:

```bash
# Клонировать репозиторий
git clone https://github.com/YOUR_USERNAME/base-match-3.git
cd base-match-3

# Установить зависимости
npm install

# Запустить локально
npm start
```

## Текущее состояние проекта

✅ Git репозиторий инициализирован
✅ Все файлы закоммичены
✅ README.md создан
✅ DEPLOYMENT.md с инструкциями по публикации
⏳ Ожидает создания репозитория на GitHub и push
