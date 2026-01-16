# Быстрое изменение размера изображения

## Способ 1: Использовать скрипт (самый простой)

Если у вас есть изображение с "BASE MATCH-3", выполните:

```bash
./resize_image.sh путь/к/вашему/изображению.png
```

**Примеры:**
```bash
# Если изображение в Downloads
./resize_image.sh ~/Downloads/my-image.png

# Если изображение в текущей папке
./resize_image.sh my-image.png

# Если изображение в другой папке
./resize_image.sh /path/to/image.jpg
```

## Способ 2: Вручную через командную строку

```bash
sips -z 630 1200 путь/к/изображению.png --out og-image.png
```

## Способ 3: Перетащите файл в терминал

1. Откройте терминал в папке проекта
2. Напишите: `./resize_image.sh ` (с пробелом в конце)
3. Перетащите файл изображения в терминал
4. Нажмите Enter

## После изменения размера

Автоматически закоммитить и задеплоить:

```bash
git add og-image.png
git commit -m "Update og-image with custom design (1200x630px)"
git push
```

Через 1-2 минуты изображение будет доступно по адресу:
https://base-match-3.vercel.app/og-image.png

## Проверка

```bash
# Проверить размер
file og-image.png
# Должно показать: PNG image data, 1200 x 630

# Или
sips -g pixelWidth -g pixelHeight og-image.png
# Должно показать: pixelWidth: 1200, pixelHeight: 630
```
