#!/bin/bash
# Скрипт для обновления URLs в проекте
# Использование: ./update_urls.sh https://your-app.vercel.app

if [ -z "$1" ]; then
    echo "Использование: ./update_urls.sh https://your-app.vercel.app"
    exit 1
fi

APP_URL="$1"

# Обновляем .well-known/farcaster.json
sed -i '' "s|https://your-app.com|${APP_URL}|g" .well-known/farcaster.json

# Обновляем index.html
sed -i '' "s|https://your-app.com|${APP_URL}|g" index.html

echo "✅ URLs обновлены на: ${APP_URL}"
echo "Проверьте файлы и закоммитьте изменения:"
echo "  git add .well-known/farcaster.json index.html"
echo "  git commit -m 'Update URLs for Vercel deployment'"
echo "  git push"
