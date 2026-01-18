// API endpoint для общего лидерборда
// Использует Vercel KV для персистентного хранения данных

import { kv } from '@vercel/kv';

const LEADERBOARD_KEY = 'leaderboard:results';
const MAX_RESULTS = 1000;

function formatAddress(address) {
  if (!address) return 'Guest';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  try {
    // GET - получить лидерборд
    if (req.method === 'GET') {
      const { filter = 'all', limit = 20 } = req.query;
      
      // Получаем данные из KV
      let leaderboardData = await kv.get(LEADERBOARD_KEY) || [];
      
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
        results: sorted,
        totalPlayers: uniqueAddresses.size,
        totalGames: leaderboardData.length
      });
    }
    
    // POST - добавить результат
    if (req.method === 'POST') {
      const { walletAddress, playerName, score, maxCombo, won } = req.body;
      
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
      
      console.log('Leaderboard API: Saving result', { walletAddress, playerName: displayName, score });
      
      const result = {
        id: Date.now() + Math.random(),
        walletAddress: walletAddress.toLowerCase(),
        playerName: displayName,
        score: score,
        maxCombo: maxCombo || 1,
        won: won || false,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };
      
      // Получаем текущие данные из KV
      let leaderboardData = await kv.get(LEADERBOARD_KEY) || [];
      
      leaderboardData.push(result);
      
      // Ограничиваем размер массива (храним последние MAX_RESULTS результатов)
      if (leaderboardData.length > MAX_RESULTS) {
        leaderboardData.sort((a, b) => b.timestamp - a.timestamp);
        leaderboardData = leaderboardData.slice(0, MAX_RESULTS);
      }
      
      // Сохраняем обратно в KV
      await kv.set(LEADERBOARD_KEY, leaderboardData);
      
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
      error: 'Internal server error'
    });
  }
}
