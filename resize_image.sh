#!/bin/bash

# Скрипт для изменения размера изображения до 1200x630px для og-image.png
# Использование: ./resize_image.sh <input_image>

if [ -z "$1" ]; then
    echo "Использование: $0 <путь_к_изображению>"
    echo "Пример: $0 my-image.png"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="og-image.png"
TARGET_WIDTH=1200
TARGET_HEIGHT=630

if [ ! -f "$INPUT_FILE" ]; then
    echo "Ошибка: Файл '$INPUT_FILE' не найден"
    exit 1
fi

echo "Изменение размера изображения..."
echo "Входной файл: $INPUT_FILE"
echo "Выходной файл: $OUTPUT_FILE"
echo "Целевой размер: ${TARGET_WIDTH}x${TARGET_HEIGHT}px"

# Используем sips (встроенная утилита macOS)
sips -z $TARGET_HEIGHT $TARGET_WIDTH "$INPUT_FILE" --out "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Изображение успешно изменено!"
    echo "Размер файла: $(ls -lh "$OUTPUT_FILE" | awk '{print $5}')"
    echo ""
    echo "Теперь закоммитьте изменения:"
    echo "  git add og-image.png"
    echo "  git commit -m 'Update og-image with custom design'"
    echo "  git push"
else
    echo "❌ Ошибка при изменении размера"
    exit 1
fi
