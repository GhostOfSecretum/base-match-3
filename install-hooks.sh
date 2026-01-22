#!/bin/bash

# Скрипт для установки git hooks
# Запустите этот скрипт после клонирования репозитория

echo "🔧 Installing git hooks..."

# Переходим в корень репозитория
cd "$(git rev-parse --show-toplevel)" || exit 1

# Копируем hooks из git-hooks в .git/hooks
if [ -d "git-hooks" ]; then
    for hook in git-hooks/*; do
        if [ -f "$hook" ]; then
            hook_name=$(basename "$hook")
            cp "$hook" ".git/hooks/$hook_name"
            chmod +x ".git/hooks/$hook_name"
            echo "✅ Installed $hook_name"
        fi
    done
    echo "✨ Git hooks installed successfully!"
else
    echo "⚠️  git-hooks directory not found"
    exit 1
fi
