#!/usr/bin/env node

/**
 * Скрипт для автоматического обновления версии приложения
 * Увеличивает patch версию (1.0.12 -> 1.0.13) при каждом запуске
 */

const fs = require('fs');
const path = require('path');

// Функция для увеличения patch версии
function incrementVersion(version) {
    const parts = version.split('.');
    if (parts.length === 3) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);
        const patch = parseInt(parts[2]) + 1;
        return `${major}.${minor}.${patch}`;
    }
    return version;
}

// Функция для обновления версии в файле
function updateVersionInFile(filePath, pattern, replacement) {
    try {
        const fullPath = path.join(__dirname, filePath);
        let content = fs.readFileSync(fullPath, 'utf8');
        const originalContent = content;
        
        // Заменяем версию
        content = content.replace(pattern, replacement);
        
        if (content !== originalContent) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ Updated version in ${filePath}`);
            return true;
        } else {
            console.log(`⚠️  Version pattern not found in ${filePath}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
        return false;
    }
}

// Читаем текущую версию из script.js
function getCurrentVersion() {
    try {
        const scriptPath = path.join(__dirname, 'script.js');
        const content = fs.readFileSync(scriptPath, 'utf8');
        const match = content.match(/const APP_VERSION = ['"]([\d.]+)['"]/);
        if (match) {
            return match[1];
        }
    } catch (error) {
        console.error('Error reading current version:', error.message);
    }
    return '1.0.0';
}

// Главная функция
function main() {
    console.log('🔄 Updating application version...');
    
    const currentVersion = getCurrentVersion();
    const newVersion = incrementVersion(currentVersion);
    
    console.log(`📦 Current version: ${currentVersion}`);
    console.log(`🚀 New version: ${newVersion}`);
    
    let updated = false;
    
    // Обновляем версию в script.js
    if (updateVersionInFile(
        'script.js',
        /const APP_VERSION = ['"][\d.]+['"]/,
        `const APP_VERSION = '${newVersion}'`
    )) {
        updated = true;
    }
    
    // Обновляем версию в package.json
    if (updateVersionInFile(
        'package.json',
        /"version":\s*["'][\d.]+["']/,
        `"version": "${newVersion}"`
    )) {
        updated = true;
    }
    
    // Обновляем версию в api/leaderboard.js (синхронизируем с основной версией)
    if (updateVersionInFile(
        'api/leaderboard.js',
        /const API_VERSION = ['"][\d.]+['"]/,
        `const API_VERSION = '${newVersion}'`
    )) {
        updated = true;
    }
    
    // Обновляем версию в index.html (элемент версии)
    // Паттерн должен учитывать возможные пробелы и кавычки перед версией
    if (updateVersionInFile(
        'index.html',
        />v[\d.]+<\/div>/,
        `>v${newVersion}</div>`
    )) {
        updated = true;
    }
    
    if (updated) {
        console.log(`\n✨ Version updated successfully to ${newVersion}!`);
        console.log('📝 Don\'t forget to commit the version changes.');
        return 0;
    } else {
        console.log('\n⚠️  No files were updated.');
        return 1;
    }
}

// Запускаем скрипт
if (require.main === module) {
    process.exit(main());
}

module.exports = { incrementVersion, getCurrentVersion };
