# Генерация Account Association

## Шаг 1: Проверьте доступность manifest

✅ Manifest уже доступен по адресу:
**https://base-match-3.vercel.app/.well-known/farcaster.json**

## Шаг 2: Генерация Account Association

1. **Откройте Base Build Account Association Tool:**
   - https://build.base.org/account-association

2. **Введите ваш URL:**
   - URL: `https://base-match-3.vercel.app`
   - Нажмите "Submit"

3. **Проверьте manifest:**
   - Нажмите "Verify"
   - Убедитесь, что manifest загружается корректно

4. **Сгенерируйте credentials:**
   - Следуйте инструкциям на странице
   - Вам нужно будет войти в Base app аккаунт
   - Подтвердите генерацию credentials

5. **Скопируйте credentials:**
   После генерации вы получите три поля:
   - `header` - строка
   - `payload` - строка  
   - `signature` - длинная строка

## Шаг 3: Обновите manifest

После получения credentials, обновите `.well-known/farcaster.json`:

```json
{
  "accountAssociation": {
    "header": "ваш-header-здесь",
    "payload": "ваш-payload-здесь",
    "signature": "ваш-signature-здесь"
  },
  "miniapp": {
    ...
  }
}
```

## Шаг 4: Закоммитьте и запушьте

```bash
git add .well-known/farcaster.json
git commit -m "Add account association credentials"
git push
```

Vercel автоматически задеплоит обновления.

## Шаг 5: Проверьте через Base Build Preview

1. Откройте: https://build.base.org/preview
2. Введите: `https://base-match-3.vercel.app`
3. Перейдите на вкладку "Account association"
4. Убедитесь, что статус: ✅ Verified

## Готово!

После этого можно переходить к тестированию и публикации в Base app!
