// API endpoint для общего лидерборда
// Использует Upstash Redis для персистентного хранения данных
// 
// НАСТРОЙКА:
// 1. Перейдите на https://vercel.com/marketplace/category/storage
// 2. Найдите "Upstash" и нажмите "Add Integration"
// 3. Подключите к вашему проекту
// 4. Переменные окружения добавятся автоматически
// 5. Переразверните проект

import { Redis } from '@upstash/redis';

const LEADERBOARD_KEY = 'leaderboard:results';
const MAX_RESULTS = 1000;
const API_VERSION = '1.0.50';

function formatAddress(address) {
  if (!address) return 'Guest';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Проверяем, настроен ли Redis
function isRedisConfigured() {
  // Поддерживаем разные форматы переменных окружения от Upstash
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || 
              process.env.UPSTASH_REDIS_REST_URL || 
              process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || 
                process.env.UPSTASH_REDIS_REST_TOKEN || 
                process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}

// Создаем клиент Redis
function getRedisClient() {
  // Поддерживаем разные форматы переменных окружения от Upstash
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || 
              process.env.UPSTASH_REDIS_REST_URL || 
              process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || 
                process.env.UPSTASH_REDIS_REST_TOKEN || 
                process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({
    url: url,
    token: token,
  });
}

export default async function handler(req, res) {
  // Устанавливаем CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Проверяем конфигурацию Redis
  if (!isRedisConfigured()) {
    console.error('Redis не настроен! Отсутствуют переменные окружения');
    console.error('Инструкции по настройке:');
    console.error('1. Перейдите на https://vercel.com/marketplace');
    console.error('2. Найдите Upstash и добавьте интеграцию');
    console.error('3. Подключите к проекту');
    console.error('4. Переразверните проект');
    
    return res.status(503).json({
      success: false,
      error: 'Leaderboard storage is not configured. Please set up Upstash Redis.',
      setup_instructions: {
        step1: 'Go to https://vercel.com/marketplace',
        step2: 'Search for "Upstash" and click "Add Integration"',
        step3: 'Connect it to your Vercel project',
        step4: 'Redeploy your project'
      }
    });
  }
  
  const redis = getRedisClient();
  if (!redis) {
    return res.status(503).json({
      success: false,
      error: 'Failed to initialize Redis client'
    });
  }

  try {
    // GET - получить лидерборд
    if (req.method === 'GET') {
      const { filter = 'all', limit = 20 } = req.query;
      
      // Получаем данные из Redis
      let leaderboardData;
      try {
        leaderboardData = await redis.get(LEADERBOARD_KEY) || [];
      } catch (redisError) {
        console.error('Redis read error:', redisError);
        leaderboardData = [];
      }
      
      // Убеждаемся, что это массив
      if (!Array.isArray(leaderboardData)) {
        console.warn('Leaderboard data is not an array, resetting');
        leaderboardData = [];
      }
      
      let filtered = [...leaderboardData];
      const now = new Date();
      
      if (filter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(r => new Date(r.date) >= today);
      } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => new Date(r.date) >= weekAgo);
      }
      
      const sorted = filtered
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.maxCombo !== a.maxCombo) return b.maxCombo - a.maxCombo;
          return new Date(b.date) - new Date(a.date);
        })
        .slice(0, parseInt(limit));
      
      // Подсчитываем статистику
      const uniqueAddresses = new Set(
        leaderboardData.map(r => (r.walletAddress || r.playerName || '').toLowerCase())
          .filter(addr => addr && addr !== 'guest')
      );
      
      return res.status(200).json({
        success: true,
        version: API_VERSION,
        results: sorted,
        totalPlayers: uniqueAddresses.size,
        totalGames: leaderboardData.length
      });
    }
    
    // POST - добавить результат
    if (req.method === 'POST') {
      const { walletAddress, playerName, avatar, score, maxCombo, won } = req.body;
      
      // Адрес кошелька обязателен
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is required'
        });
      }
      
      if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid score is required'
        });
      }
      
      // Используем переданный playerName для отображения, или форматируем адрес
      const displayName = playerName && playerName.trim() !== '' ? playerName.trim() : formatAddress(walletAddress);
      
      console.log('Leaderboard API: Saving result', { walletAddress, playerName: displayName, avatar: avatar ? 'yes' : 'no', score });
      
      const result = {
        id: Date.now() + Math.random(),
        walletAddress: walletAddress.toLowerCase(),
        playerName: displayName,
        avatar: avatar || null,
        score: score,
        maxCombo: maxCombo || 1,
        won: won || false,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };
      
      // Получаем текущие данные из Redis
      let leaderboardData;
      try {
        leaderboardData = await redis.get(LEADERBOARD_KEY) || [];
      } catch (redisError) {
        console.error('Redis read error:', redisError);
        leaderboardData = [];
      }
      
      // Убеждаемся, что это массив
      if (!Array.isArray(leaderboardData)) {
        leaderboardData = [];
      }
      
      leaderboardData.push(result);
      
      // Ограничиваем размер массива (храним последние MAX_RESULTS результатов)
      if (leaderboardData.length > MAX_RESULTS) {
        leaderboardData.sort((a, b) => b.timestamp - a.timestamp);
        leaderboardData = leaderboardData.slice(0, MAX_RESULTS);
      }
      
      // Сохраняем обратно в Redis
      try {
        await redis.set(LEADERBOARD_KEY, leaderboardData);
        console.log('Leaderboard saved successfully, total records:', leaderboardData.length);
      } catch (redisError) {
        console.error('Redis write error:', redisError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save to leaderboard storage'
        });
      }
      
      return res.status(200).json({
        success: true,
        result: result
      });
    }
    
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
