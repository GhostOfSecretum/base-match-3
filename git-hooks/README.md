# Git Hooks

## Автоматическое обновление версии

Для автоматического обновления версии при каждом коммите, установите pre-commit hook:

```bash
chmod +x git-hooks/pre-commit
cp git-hooks/pre-commit .git/hooks/pre-commit
```

После этого версия будет автоматически обновляться перед каждым коммитом.

## Ручное обновление версии

Если hook не установлен, можно обновить версию вручную:

```bash
node update-version.cjs
```

Или использовать npm скрипт:

```bash
npm run push
```
