// Простой тестовый скрипт для проверки загрузки
console.log('Test script loaded successfully!');
console.log('Document ready state:', document.readyState);
console.log('Game board element:', document.getElementById('gameBoard'));

// Пытаемся показать что-то на экране
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded in test script');
    const gameBoard = document.getElementById('gameBoard');
    if (gameBoard) {
        gameBoard.innerHTML = '<div style="color: white; padding: 20px; text-align: center;"><h2>Test Script Works!</h2><p>If you see this, JavaScript is working.</p></div>';
    }
});
