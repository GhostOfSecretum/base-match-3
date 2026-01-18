// НЕМЕДЛЕННОЕ ЛОГИРОВАНИЕ - должно выполниться первым
console.log('=== SCRIPT.JS STARTING ===');
console.log('Timestamp:', new Date().toISOString());

// КРИТИЧНО для Farcaster: Если SDK ready() еще не был вызван в index.html, пробуем здесь
(async function retryFarcasterSDK() {
    // Если уже вызван в index.html, пропускаем
    if (window.__farcasterSDKReady) {
        console.log('Farcaster SDK already ready (from index.html)');
        return;
    }

    // Ждем небольшую задержку для загрузки SDK
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        // Способ 1: Официальный CDN - frame.sdk (документация Farcaster)
        if (typeof frame !== 'undefined' && frame.sdk && frame.sdk.actions) {
            await frame.sdk.actions.ready();
            window.__farcasterSDKReady = true;
            window.__farcasterSDK = frame.sdk;
            console.log('Farcaster SDK ready() called via frame.sdk (retry)');
            return;
        }

        // Способ 2: window.farcaster.miniapp (Farcaster native)
        if (window.farcaster && window.farcaster.miniapp && window.farcaster.miniapp.actions) {
            await window.farcaster.miniapp.actions.ready();
            window.__farcasterSDKReady = true;
            window.__farcasterSDK = window.farcaster.miniapp;
            console.log('Farcaster SDK ready() called via window.farcaster (retry)');
            return;
        }

        // Способ 3: Уже сохраненный SDK
        if (window.__farcasterSDK && window.__farcasterSDK.actions) {
            await window.__farcasterSDK.actions.ready();
            window.__farcasterSDKReady = true;
            console.log('Farcaster SDK ready() called via cached SDK (retry)');
        }
    } catch (e) {
        console.log('Farcaster SDK retry (non-critical):', e.message);
    }
})();

// MiniApp SDK будет загружен динамически
let sdk = null;

// Base Network Configuration
const BASE_NETWORK = {
    chainId: '0x2105', // 8453 в hex
    chainName: 'Base',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org']
};

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.chainId = null;
        this.username = null;
        this.avatar = null;
        this.userContext = null;

        // Пытаемся автоматически подключиться через Base Account SDK
        this.initializeBaseAccount();

        // Проверяем, есть ли сохраненное подключение
        this.checkSavedConnection();

        // Подписываемся на события изменения аккаунта и сети
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                    if (window.game) {
                        window.game.updateWalletDisplay();
                    }
                } else {
                    this.account = accounts[0];
                    this.updateWalletUI();
                    if (window.game) {
                        window.game.updateWalletDisplay();
                    }
                }
            });

            window.ethereum.on('chainChanged', (chainId) => {
                this.chainId = chainId;
                this.updateWalletUI();
                this.checkNetwork();
                if (window.game) {
                    window.game.updateWalletDisplay();
                }
            });
        }
    }

    async initializeBaseAccount() {
        // Пытаемся получить данные пользователя из Base Account SDK
        try {
            let sdkInstance = null;

            // Ищем SDK в различных местах
            try {
                if (window.farcaster && window.farcaster.miniapp) {
                    sdkInstance = window.farcaster.miniapp;
                }
            } catch (e) {
                console.log('Cannot access window.farcaster:', e.message);
            }

            if (!sdkInstance) {
                try {
                    if (window.miniappSdk) {
                        sdkInstance = window.miniappSdk.sdk || window.miniappSdk;
                    }
                } catch (e) {
                    console.log('Cannot access window.miniappSdk:', e.message);
                }
            }

            if (!sdkInstance && window.parent && window.parent !== window) {
                try {
                    if (window.parent.farcaster && window.parent.farcaster.miniapp) {
                        sdkInstance = window.parent.farcaster.miniapp;
                    }
                } catch (e) {
                    // Cross-origin
                }
            }

            if (sdkInstance && sdkInstance.context) {
                // Ждем немного для загрузки контекста
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const context = await sdkInstance.context.get();
                    this.userContext = context;

                    // Получаем username и avatar из контекста
                    if (context.user) {
                        this.username = context.user.username || context.user.displayName || null;
                        this.avatar = context.user.pfpUrl || context.user.avatarUrl || null;

                        // Если есть account в контексте, используем его для автоматического подключения
                        if (context.user.custodyAddress || context.user.account) {
                            const address = context.user.custodyAddress || context.user.account;
                            if (address && !this.account) {
                                // Автоматически подключаемся через Base Account
                                await this.connectViaBaseAccount(address);
                            }
                        }

                        // Обновляем UI с username и avatar
                        if (window.game) {
                            window.game.updateWalletDisplay();
                        }
                    }
                } catch (e) {
                    console.log('Could not get context from SDK:', e.message);
                }
            }
        } catch (error) {
            console.log('Base Account initialization failed (non-critical):', error.message);
        }
    }

    async connectViaBaseAccount(address) {
        try {
            // Используем ethers provider для Base Account
            if (typeof ethers !== 'undefined') {
                // В Base app wallet подключен автоматически
                this.account = address.toLowerCase();

                // Получаем provider через window.ethereum или Base Account
                if (window.ethereum) {
                    this.provider = new ethers.providers.Web3Provider(window.ethereum);
                    this.signer = this.provider.getSigner();

                    // Проверяем сеть
                    await this.checkNetwork();

                    // Обновляем UI
                    this.updateWalletUI();
                }
            }
        } catch (error) {
            console.log('Base Account connection failed:', error.message);
        }
    }

    getUsername() {
        return this.username;
    }

    getAvatar() {
        return this.avatar;
    }

    async loadEthersLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof ethers !== 'undefined') {
                resolve();
                return;
            }

            // Пробуем загрузить с основного CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
            script.async = true;

            script.onload = () => {
                console.log('ethers.js loaded successfully');
                if (typeof ethers !== 'undefined') {
                    resolve();
                } else {
                    this.tryFallbackCDN(resolve, reject);
                }
            };

            script.onerror = () => {
                console.warn('Primary ethers.js CDN failed, trying fallback...');
                this.tryFallbackCDN(resolve, reject);
            };

            // Устанавливаем таймаут
            setTimeout(() => {
                if (typeof ethers === 'undefined') {
                    console.warn('ethers.js loading timeout');
                    this.tryFallbackCDN(resolve, reject);
                }
            }, 3000);

            document.head.appendChild(script);
        });
    }

    tryFallbackCDN(resolve, reject) {
        // Пробуем альтернативный CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js';
        script.async = true;

        script.onload = () => {
            console.log('ethers.js loaded from fallback CDN');
            if (typeof ethers !== 'undefined') {
                resolve();
            } else {
                reject(new Error('ethers.js failed to load from all CDNs'));
            }
        };

        script.onerror = () => {
            console.error('All ethers.js CDNs failed');
            reject(new Error('ethers.js could not be loaded from any CDN'));
        };

        document.head.appendChild(script);
    }

    checkSavedConnection() {
        const saved = localStorage.getItem('walletConnected');
        if (saved === 'true' && window.ethereum) {
            this.connect();
        }
    }

    async connect() {
        try {
            // Проверяем наличие ethers.js
            if (typeof ethers === 'undefined') {
                // Пытаемся загрузить ethers.js динамически
                console.log('ethers.js not found, attempting to load...');
                await this.loadEthersLibrary();

                // Проверяем еще раз после попытки загрузки
                if (typeof ethers === 'undefined') {
                    throw new Error('Ethers.js library could not be loaded. Please check your internet connection and refresh the page.\n\nIf the problem persists, the CDN may be blocked. Wallet connection requires ethers.js library.');
                }
            }

            if (!window.ethereum) {
                throw new Error('Ethereum wallet not found. Please install MetaMask, Coinbase Wallet, or another compatible wallet.');
            }

            this.provider = new ethers.providers.Web3Provider(window.ethereum);

            // Запрашиваем доступ к аккаунтам
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            if (accounts.length === 0) {
                throw new Error('No accounts found. Please unlock your wallet.');
            }

            this.account = accounts[0];
            this.signer = this.provider.getSigner();

            // Получаем текущую сеть
            const network = await this.provider.getNetwork();
            this.chainId = `0x${network.chainId.toString(16)}`;

            // Проверяем и переключаем на Base, если нужно
            await this.checkNetwork();

            // Сохраняем состояние подключения
            localStorage.setItem('walletConnected', 'true');

            this.updateWalletUI();

            return {
                success: true,
                account: this.account,
                chainId: this.chainId
            };

        } catch (error) {
            console.error('Wallet connection error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkNetwork() {
        if (!this.provider) return;

        const network = await this.provider.getNetwork();
        const currentChainId = `0x${network.chainId.toString(16)}`;

        if (currentChainId !== BASE_NETWORK.chainId) {
            try {
                await this.switchToBase();
            } catch (error) {
                console.error('Failed to switch network:', error);
                this.showWalletModal(
                    `Please switch to Base network manually in your wallet.\n\n` +
                    `Network: ${BASE_NETWORK.chainName}\n` +
                    `Chain ID: ${BASE_NETWORK.chainId} (8453)`
                );
            }
        }
    }

    async switchToBase() {
        if (!window.ethereum) return;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_NETWORK.chainId }]
            });
        } catch (switchError) {
            // Если сеть не добавлена, пытаемся добавить её
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [BASE_NETWORK]
                    });
                } catch (addError) {
                    throw new Error('Failed to add Base network to wallet');
                }
            } else {
                throw switchError;
            }
        }
    }

    async disconnect() {
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.chainId = null;

        localStorage.removeItem('walletConnected');

        // Принудительно обновляем UI
        this.updateWalletUI();

        // Также обновляем display в игре, если он доступен
        if (window.game && typeof window.game.updateWalletDisplay === 'function') {
            window.game.updateWalletDisplay();
        }
    }

    updateWalletUI() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const walletNetwork = document.getElementById('walletNetwork');

        if (!connectBtn) return; // Защита от отсутствия элемента

        if (this.account) {
            connectBtn.innerHTML = '<span>Disconnect</span>';
            connectBtn.classList.add('connected');

            if (walletInfo) {
                walletInfo.style.display = 'flex';
            }
            if (walletAddress) {
                walletAddress.textContent = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
            }
            if (walletNetwork) {
                const networkName = this.chainId === BASE_NETWORK.chainId ? 'Base' : 'Unknown';
                walletNetwork.textContent = `Network: ${networkName}`;
                walletNetwork.className = 'wallet-network ' + (this.chainId === BASE_NETWORK.chainId ? 'base-network' : 'wrong-network');
            }
        } else {
            connectBtn.innerHTML = '<span>Connect Wallet</span>';
            connectBtn.classList.remove('connected');
            if (walletInfo) {
                walletInfo.style.display = 'none';
            }
        }
    }

    showWalletModal(message) {
        const modal = document.getElementById('walletModal');
        const messageEl = document.getElementById('walletModalMessage');
        messageEl.textContent = message;
        modal.classList.add('show');
    }

    isConnected() {
        return this.account !== null;
    }

    getAccount() {
        return this.account;
    }

    getProvider() {
        return this.provider;
    }

    getSigner() {
        return this.signer;
    }
}

class LeaderboardManager {
    constructor(walletManager) {
        this.storageKey = 'match3Leaderboard';
        this.walletManager = walletManager;
        this.leaderboard = []; // Кеш для локального использования
        this.apiUrl = '/api/leaderboard'; // API endpoint
        this.isLoading = false;
        this.lastFetchTime = 0;
        this.cacheTimeout = 5000; // Кеш на 5 секунд
    }

    getPlayerIdentifier() {
        // Используем адрес кошелька, если подключен
        if (this.walletManager && this.walletManager.isConnected()) {
            return this.walletManager.getAccount().toLowerCase();
        }
        return null; // Возвращаем null, если кошелек не подключен
    }

    formatAddress(address) {
        if (!address) return 'Guest';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    // Получить лидерборд с сервера
    async fetchLeaderboard(filter = 'all', limit = 20) {
        // Используем кеш, если данные свежие
        const now = Date.now();
        if (this.lastFetchTime && (now - this.lastFetchTime) < this.cacheTimeout && this.leaderboard.length > 0) {
            return this.getTopResults(limit, filter);
        }

        if (this.isLoading) {
            // Если уже загружаем, возвращаем кешированные данные
            return this.getTopResults(limit, filter);
        }

        this.isLoading = true;

        try {
            const response = await fetch(`${this.apiUrl}?filter=${filter}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.results) {
                this.leaderboard = data.results;
                this.lastFetchTime = now;
                this.totalPlayers = data.totalPlayers || 0;
                this.totalGames = data.totalGames || 0;
                return data.results;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            // В случае ошибки возвращаем кешированные данные или пустой массив
            return this.leaderboard.length > 0 ? this.getTopResults(limit, filter) : [];
        } finally {
            this.isLoading = false;
        }
    }

    // Добавить результат на сервер
    async addResult(score, maxCombo, won) {
        const walletAddress = this.getPlayerIdentifier();

        if (!walletAddress) {
            // Если кошелек не подключен, не сохраняем результат
            return null;
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    score: score,
                    maxCombo: maxCombo || 1,
                    won: won || false
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.result) {
                // Добавляем результат в локальный кеш
                this.leaderboard.push(data.result);
                // Сбрасываем время кеша, чтобы обновить данные при следующем запросе
                this.lastFetchTime = 0;
                return data.result;
            } else {
                throw new Error(data.error || 'Failed to save result');
            }
        } catch (error) {
            console.error('Error adding result to leaderboard:', error);
            // В случае ошибки создаем локальный результат для обратной совместимости
            const result = {
                id: Date.now() + Math.random(),
                walletAddress: walletAddress,
                playerName: this.formatAddress(walletAddress),
                score: score,
                maxCombo: maxCombo,
                won: won,
                date: new Date().toISOString(),
                timestamp: Date.now()
            };
            this.leaderboard.push(result);
            return result;
        }
    }

    getTopResults(limit = 10, filter = 'all') {
        // Если данные в кеше, используем их
        let filtered = [...this.leaderboard];
        const now = new Date();

        if (filter === 'today') {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            filtered = filtered.filter(r => new Date(r.date) >= today);
        } else if (filter === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(r => new Date(r.date) >= weekAgo);
        }

        return filtered
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.maxCombo !== a.maxCombo) return b.maxCombo - a.maxCombo;
                return new Date(b.date) - new Date(a.date);
            })
            .slice(0, limit);
    }

    getPlayerStats(walletAddress = null) {
        const address = walletAddress || this.getPlayerIdentifier();
        if (!address) {
            return {
                totalGames: 0,
                bestScore: 0,
                wins: 0,
                averageScore: 0
            };
        }

        const playerResults = this.leaderboard.filter(r => {
            // Поддерживаем как старый формат (playerName), так и новый (walletAddress)
            const resultAddress = (r.walletAddress || r.playerName || '').toLowerCase();
            return resultAddress === address.toLowerCase();
        });

        if (playerResults.length === 0) {
            return {
                totalGames: 0,
                bestScore: 0,
                wins: 0,
                averageScore: 0
            };
        }

        const scores = playerResults.map(r => r.score);
        const wins = playerResults.filter(r => r.won).length;

        return {
            totalGames: playerResults.length,
            bestScore: Math.max(...scores),
            wins: wins,
            averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        };
    }

    clearLeaderboard() {
        // Очистка лидерборда теперь не поддерживается через API
        // (для безопасности, чтобы игроки не могли удалять чужие результаты)
        this.leaderboard = [];
        this.lastFetchTime = 0;
    }

    getTotalPlayers() {
        // Используем сохраненное значение или вычисляем из кеша
        if (this.totalPlayers !== undefined) {
            return this.totalPlayers;
        }
        // Уникальные адреса кошельков (поддерживаем оба формата)
        const uniqueAddresses = new Set(this.leaderboard.map(r => {
            return (r.walletAddress || r.playerName || '').toLowerCase();
        }).filter(addr => addr && addr !== 'guest'));
        return uniqueAddresses.size;
    }

    // Миграция старых данных больше не нужна, так как используем API
    migrateOldData() {
        // Метод оставлен для обратной совместимости, но ничего не делает
    }
}

// Sound Manager для управления звуками игры
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initialized = false;
        this.initAttempts = 0;
        this.maxInitAttempts = 10;

        // НЕ инициализируем AudioContext сразу - только при первом взаимодействии
    }

    initAudioContext() {
        // Создаем AudioContext только после взаимодействия пользователя
        if (this.initialized || this.initAttempts >= this.maxInitAttempts) {
            return;
        }

        this.initAttempts++;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('AudioContext initialized successfully');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.enabled = false;
        }
    }

    async ensureAudioContext() {
        if (!this.initialized && this.enabled) {
            this.initAudioContext();
        }

        // Если контекст приостановлен, возобновляем его
        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    console.log('AudioContext resumed');
                } catch (e) {
                    console.warn('Failed to resume AudioContext:', e);
                }
            }
        }
    }

    // Принудительная активация звуков (вызывается при первом взаимодействии)
    async activate() {
        if (!this.initialized) {
            this.initAudioContext();
        }
        await this.ensureAudioContext();

        // Пробуем воспроизвести тестовый звук для активации
        if (this.audioContext && this.enabled) {
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);

                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.05);
            } catch (e) {
                console.warn('Failed to activate audio:', e);
            }
        }
    }

    // Генерирует звук монетки (короткий высокий звук)
    async playCoinSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Звук монетки: быстрый подъем частоты
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    // Звук комбо (более длинный и эффектный)
    async playComboSound(comboLevel) {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Звук комбо: более низкий и мощный
        oscillator.type = 'sine';
        const baseFreq = 400 + (comboLevel * 50); // Частота зависит от уровня комбо
        oscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.audioContext.currentTime + 0.2);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.7, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    // Звук бомбы (низкий взрыв)
    async playBombSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.8, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    // Звук ракеты (свистящий звук)
    async playRocketSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1000, this.audioContext.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    // Звук падения фигур
    async playDropSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.05);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
    }

    // Звук свапа (короткий клик)
    async playSwapSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
    }

    // Звук победы
    async playWinSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        // Играем последовательность нот
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (мажорное трезвучие)
        notes.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);

                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.05);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }, index * 100);
        });
    }

    // Звук проигрыша
    async playLoseSound() {
        if (!this.enabled) return;

        await this.ensureAudioContext();
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
}

class MatchThreePro {
    constructor() {
        this.boardSize = 7;
        this.numTypes = 6;
        this.board = [];
        this.selectedCell = null;
        this.score = 0;
        this.moves = 30;
        this.combo = 1;
        this.maxCombo = 1;
        this.isProcessing = false;
        this.targetScore = 5000;
        this.particles = [];
        this.walletManager = new WalletManager();
        this.leaderboard = new LeaderboardManager(this.walletManager);
        this.soundManager = new SoundManager();

        // Мигрируем старые данные при инициализации
        this.leaderboard.migrateOldData();

        // Типы специальных фигур
        this.SPECIAL_TYPES = {
            BOMB: 'bomb',
            ROCKET_H: 'rocket-h',
            ROCKET_V: 'rocket-v'
        };

        // Пути к изображениям логотипов криптовалют
        this.cryptoImages = [
            'assets/crypto/aave.png',
            'assets/crypto/aero.jpg',
            'assets/crypto/avnt.webp',
            'assets/crypto/base.png',
            'assets/crypto/degen.png',
            'assets/crypto/usdc.png'
        ];

        // Переменные для свайпов
        this.dragStartCell = null;
        this.isDragging = false;
        this.dragStartPos = null;
        this.lastTouchMoveTime = 0;

        // Кеш DOM элементов для производительности
        this.domCache = {
            gameBoard: null,
            cells: new Map() // Кеш ячеек для быстрого доступа
        };
    }

    async init() {
        try {
            console.log('Initializing game...');
            console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
            console.log('Document dimensions:', document.documentElement.clientWidth, 'x', document.documentElement.clientHeight);

            this.createBoard();
            console.log('Board created');
            this.render();
            console.log('Board rendered');
            this.setupEventListeners();
            console.log('Event listeners set up');
            this.setupGlobalDragHandlers();
            console.log('Global drag handlers set up');
            this.setupSoundActivation();
            console.log('Sound activation handlers set up');
            this.removeInitialMatches();
            console.log('Initial matches removed');
            this.createParticles();
            console.log('Particles created');
            this.updateUI();
            console.log('UI updated');

            // Обновляем отображение кошелька, если элементы существуют
            if (typeof this.updateWalletDisplay === 'function') {
                try {
                    this.updateWalletDisplay();
                } catch (e) {
                    console.log('Wallet display update skipped:', e.message);
                }
            }

            // Загружаем и инициализируем MiniApp SDK (не блокируем запуск игры)
            // Вызываем ready() асинхронно, чтобы не блокировать игру
            this.initializeSDK();

            console.log('Game initialized successfully');

            // Проверяем видимость элементов
            const gameBoard = document.getElementById('gameBoard');
            if (gameBoard) {
                const rect = gameBoard.getBoundingClientRect();
                const styles = window.getComputedStyle(gameBoard);
                console.log('Game board position:', rect);
                console.log('Game board visible:', rect.width > 0 && rect.height > 0);
                console.log('Game board display:', styles.display);
                console.log('Game board visibility:', styles.visibility);
                console.log('Game board opacity:', styles.opacity);

                // Если элемент не виден, пытаемся исправить
                if (rect.width === 0 || rect.height === 0) {
                    console.warn('Game board has zero dimensions, checking parent elements...');
                    const wrapper = document.querySelector('.game-wrapper');
                    if (wrapper) {
                        const wrapperRect = wrapper.getBoundingClientRect();
                        console.log('Game wrapper dimensions:', wrapperRect);
                    }
                }
            } else {
                console.error('Game board element not found after initialization!');
            }

            // Проверяем видимость game-container
            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                const containerRect = gameContainer.getBoundingClientRect();
                const containerStyles = window.getComputedStyle(gameContainer);
                console.log('Game container visible:', containerRect.width > 0 && containerRect.height > 0);
                console.log('Game container display:', containerStyles.display);
            }
        } catch (error) {
            console.error('Error in init():', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    updateWalletDisplay() {
        const playerNameDisplay = document.getElementById('currentPlayerName');
        const playerAvatarDisplay = document.getElementById('currentPlayerAvatar');

        if (playerNameDisplay) {
            if (this.walletManager.isConnected()) {
                // Получаем username из Base Account SDK, если доступен
                const username = this.walletManager.getUsername();
                const avatar = this.walletManager.getAvatar();

                // Используем username вместо адреса кошелька (рекомендация Base)
                if (username) {
                    playerNameDisplay.textContent = username;
                    playerNameDisplay.classList.remove('wallet-address');
                } else {
                    // Fallback на адрес, если username недоступен
                    const address = this.walletManager.getAccount();
                    playerNameDisplay.textContent = this.leaderboard.formatAddress(address);
                    playerNameDisplay.classList.add('wallet-address');
                }

                // Показываем avatar, если доступен
                if (playerAvatarDisplay && avatar) {
                    playerAvatarDisplay.src = avatar;
                    playerAvatarDisplay.style.display = 'block';
                } else if (playerAvatarDisplay) {
                    playerAvatarDisplay.style.display = 'none';
                }
            } else {
                playerNameDisplay.textContent = 'Connect Wallet';
                playerNameDisplay.classList.remove('wallet-address');
                if (playerAvatarDisplay) {
                    playerAvatarDisplay.style.display = 'none';
                }
            }
        }
    }

    createBoard() {
        this.board = [];
        for (let row = 0; row < this.boardSize; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.boardSize; col++) {
                // Выбираем тип, который не создаст совпадение
                this.board[row][col] = { type: this.getSafeType(row, col), special: null };
            }
        }
    }

    getRandomType() {
        return Math.floor(Math.random() * this.numTypes);
    }

    // Проверяет, создаст ли размещение типа type в позиции (row, col) совпадение
    wouldCreateMatch(row, col, type) {
        // Проверяем горизонтальное совпадение (две ячейки слева)
        if (col >= 2) {
            const left1 = this.getCellType(row, col - 1);
            const left2 = this.getCellType(row, col - 2);
            // Проверяем, что обе ячейки существуют и совпадают с типом
            if (left1 !== null && left2 !== null && left1 === type && left2 === type) {
                return true;
            }
        }

        // Проверяем вертикальное совпадение (две ячейки сверху)
        if (row >= 2) {
            const top1 = this.getCellType(row - 1, col);
            const top2 = this.getCellType(row - 2, col);
            // Проверяем, что обе ячейки существуют и совпадают с типом
            if (top1 !== null && top2 !== null && top1 === type && top2 === type) {
                return true;
            }
        }

        return false;
    }

    // Возвращает безопасный тип для позиции (row, col), который не создаст совпадение
    getSafeType(row, col) {
        // Собираем все типы, которые не создадут совпадение
        const safeTypes = [];
        for (let type = 0; type < this.numTypes; type++) {
            if (!this.wouldCreateMatch(row, col, type)) {
                safeTypes.push(type);
            }
        }

        // Если есть безопасные типы, выбираем случайный из них
        if (safeTypes.length > 0) {
            return safeTypes[Math.floor(Math.random() * safeTypes.length)];
        }

        // Если все типы создадут совпадение (маловероятно, но на всякий случай),
        // выбираем случайный тип
        return this.getRandomType();
    }

    getCellType(row, col) {
        if (!this.board[row] || !this.board[row][col]) return null;
        return this.board[row][col].type;
    }

    getCellSpecial(row, col) {
        if (!this.board[row] || !this.board[row][col]) return null;
        return this.board[row][col].special;
    }

    removeInitialMatches() {
        let hasMatches = true;
        let attempts = 0;
        const maxAttempts = 200; // Увеличиваем лимит попыток

        while (hasMatches && attempts < maxAttempts) {
            const matches = this.findAllMatches();
            if (matches.length === 0) {
                hasMatches = false;
            } else {
                // Используем Set для отслеживания всех ячеек, которые нужно заменить
                const cellsToReplace = new Set();
                matches.forEach(match => {
                    match.forEach(({ row, col }) => {
                        cellsToReplace.add(`${row}-${col}`);
                    });
                });

                // Заменяем ячейки безопасными типами
                cellsToReplace.forEach(key => {
                    const [row, col] = key.split('-').map(Number);
                    this.board[row][col] = { type: this.getSafeType(row, col), special: null };
                });
            }
            attempts++;
        }

        // Финальная проверка - если все еще есть совпадения, заменяем их принудительно
        const finalMatches = this.findAllMatches();
        if (finalMatches.length > 0) {
            console.warn('Initial matches still present after removal attempts, forcing replacement');
            const cellsToReplace = new Set();
            finalMatches.forEach(match => {
                match.forEach(({ row, col }) => {
                    cellsToReplace.add(`${row}-${col}`);
                });
            });

            cellsToReplace.forEach(key => {
                const [row, col] = key.split('-').map(Number);
                // Пробуем разные типы, пока не найдем безопасный
                let safeType = this.getSafeType(row, col);
                let attempts = 0;
                while (this.wouldCreateMatch(row, col, safeType) && attempts < 10) {
                    safeType = this.getRandomType();
                    attempts++;
                }
                this.board[row][col] = { type: safeType, special: null };
            });
        }
    }

    render() {
        // Кешируем gameBoard элемент
        if (!this.domCache.gameBoard) {
            this.domCache.gameBoard = document.getElementById('gameBoard');
        }
        const gameBoard = this.domCache.gameBoard;
        const fragment = document.createDocumentFragment();

        // Сохраняем существующие ячейки для переиспользования обработчиков
        const existingCells = new Map();
        gameBoard.querySelectorAll('.cell').forEach(cell => {
            const key = `${cell.dataset.row}-${cell.dataset.col}`;
            existingCells.set(key, cell);
        });

        // Очищаем кеш ячеек
        this.domCache.cells.clear();

        // Очищаем доску
        gameBoard.innerHTML = '';

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cellKey = `${row}-${col}`;
                let cell = existingCells.get(cellKey);
                const cellData = this.board[row][col];

                // Переиспользуем существующую ячейку если возможно, иначе создаем новую
                if (!cell) {
                    cell = document.createElement('div');
                }

                let className = `cell type-${cellData.type}`;

                if (cellData.special) {
                    className += ` type-${cellData.special}`;
                }

                cell.className = className;
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Очищаем содержимое для переиспользования
                cell.innerHTML = '';

                // Добавляем изображение логотипа, если это обычная ячейка (не специальная)
                if (cellData.type >= 0 && cellData.type < this.numTypes && !cellData.special) {
                    const logoContainer = document.createElement('div');
                    logoContainer.className = 'cell-logo-container';
                    const img = document.createElement('img');
                    img.src = this.cryptoImages[cellData.type];
                    img.className = 'cell-logo';
                    img.alt = '';
                    logoContainer.appendChild(img);
                    cell.appendChild(logoContainer);
                }

                // Добавляем обработчики только если их еще нет
                if (!cell.hasAttribute('data-handlers-attached')) {
                    this.setupDragHandlers(cell, row, col);
                    cell.setAttribute('data-handlers-attached', 'true');
                }

                // Кешируем ячейку
                this.domCache.cells.set(cellKey, cell);

                fragment.appendChild(cell);
            }
        }

        gameBoard.appendChild(fragment);
        this.updateUI();
    }

    // Получает ячейку из кеша или DOM
    getCellElement(row, col) {
        const cellKey = `${row}-${col}`;
        let cell = this.domCache.cells.get(cellKey);
        if (!cell) {
            cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                this.domCache.cells.set(cellKey, cell);
            }
        }
        return cell;
    }

    // Обновляет только одну ячейку вместо полной перерисовки
    updateCell(row, col) {
        const cell = this.getCellElement(row, col);
        if (!cell) {
            // Если ячейка не существует, перерисовываем всю доску
            this.render();
            return;
        }

        const cellData = this.board[row][col];
        let className = `cell type-${cellData.type}`;

        if (cellData.special) {
            className += ` type-${cellData.special}`;
        }

        cell.className = className;
        cell.innerHTML = '';

        // Добавляем изображение логотипа, если это обычная ячейка (не специальная)
        if (cellData.type >= 0 && cellData.type < this.numTypes && !cellData.special) {
            const logoContainer = document.createElement('div');
            logoContainer.className = 'cell-logo-container';
            const img = document.createElement('img');
            img.src = this.cryptoImages[cellData.type];
            img.className = 'cell-logo';
            img.alt = '';
            logoContainer.appendChild(img);
            cell.appendChild(logoContainer);
        }
    }

    setupDragHandlers(cell, row, col) {
        // Touch события - упрощенная обработка для лучшей производительности
        cell.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) { // Только одно касание
                this.handleDragStart(e, row, col);
            }
        }, { passive: false });

        // Throttled touchmove для лучшей производительности
        let lastTouchMove = 0;
        cell.addEventListener('touchmove', (e) => {
            const now = Date.now();
            if (now - lastTouchMove > 16) { // ~60fps
                this.handleDragMove(e);
                lastTouchMove = now;
            }
        }, { passive: false });

        cell.addEventListener('touchend', (e) => {
            if (!this.dragStartCell) return;

            const { row: startRow, col: startCol } = this.dragStartCell;

            // Используем сохраненную позицию для определения направления свайпа
            const touch = e.changedTouches[0];
            const finalX = touch.clientX;
            const finalY = touch.clientY;

            // Находим ячейку под точкой касания
            const target = document.elementFromPoint(finalX, finalY);
            let targetRow = row;
            let targetCol = col;

            if (target && target.classList.contains('cell')) {
                targetRow = parseInt(target.dataset.row);
                targetCol = parseInt(target.dataset.col);
            } else if (this.isDragging) {
                // Если свайп был, но не попали на ячейку, определяем направление
                const deltaX = finalX - this.dragStartPos.x;
                const deltaY = finalY - this.dragStartPos.y;
                const minSwipeDistance = 30; // Минимальное расстояние для свайпа

                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                    // Горизонтальный свайп
                    targetCol = startCol + (deltaX > 0 ? 1 : -1);
                    targetRow = startRow;
                } else if (Math.abs(deltaY) > minSwipeDistance) {
                    // Вертикальный свайп
                    targetRow = startRow + (deltaY > 0 ? 1 : -1);
                    targetCol = startCol;
                }

                // Ограничиваем границами доски
                targetRow = Math.max(0, Math.min(this.boardSize - 1, targetRow));
                targetCol = Math.max(0, Math.min(this.boardSize - 1, targetCol));
            }

            this.handleDragEnd(e, targetRow, targetCol);
        }, { passive: false });

        cell.addEventListener('touchcancel', () => this.handleDragCancel(), { passive: false });

        // Mouse события - только mousedown на ячейке
        cell.addEventListener('mousedown', (e) => this.handleDragStart(e, row, col));

        // Предотвращаем контекстное меню при долгом нажатии
        cell.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupSoundActivation() {
        // Глобальная активация звуков при первом взаимодействии пользователя
        const activateOnce = () => {
            if (!this.soundManager.initialized) {
                this.soundManager.activate();
                // Удаляем обработчики после активации
                document.removeEventListener('click', activateOnce, true);
                document.removeEventListener('touchstart', activateOnce, true);
                document.removeEventListener('mousedown', activateOnce, true);
            }
        };

        // Добавляем обработчики для различных типов взаимодействий
        document.addEventListener('click', activateOnce, true);
        document.addEventListener('touchstart', activateOnce, true);
        document.addEventListener('mousedown', activateOnce, true);
    }

    setupGlobalDragHandlers() {
        // Глобальные обработчики для мыши (чтобы перетаскивание работало даже вне ячейки)
        document.addEventListener('mousemove', (e) => {
            if (this.dragStartCell && !this.isProcessing) {
                // Проверяем, что курсор не на кнопке
                const target = e.target;
                if (target && (target.closest('.btn-wallet') || target.closest('button'))) {
                    return; // Игнорируем события на кнопках
                }
                this.handleDragMove(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.dragStartCell && !this.isProcessing) {
                // Проверяем, что клик не на кнопке
                const target = e.target;
                if (target && (target.closest('.btn-wallet') || target.closest('button'))) {
                    this.handleDragCancel();
                    return; // Не обрабатываем drag для кнопок
                }

                // Находим ячейку под курсором
                const elementUnderPoint = document.elementFromPoint(e.clientX, e.clientY);
                if (elementUnderPoint && elementUnderPoint.classList.contains('cell')) {
                    const row = parseInt(elementUnderPoint.dataset.row);
                    const col = parseInt(elementUnderPoint.dataset.col);
                    this.handleDragEnd(e, row, col);
                } else {
                    // Если отпустили вне ячейки, отменяем перетаскивание
                    this.handleDragCancel();
                }
            }
        });
    }

    getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    handleDragStart(e, row, col) {
        if (this.isProcessing) {
            e.preventDefault();
            return;
        }

        // Активируем звуки при первом взаимодействии
        if (!this.soundManager.initialized) {
            this.soundManager.activate();
        }

        // Сбрасываем предыдущее состояние
        this.resetDrag();

        this.dragStartCell = { row, col };
        this.isDragging = false;
        this.dragStartPos = this.getEventPos(e);
        this.selectedCell = { row, col };
        this.highlightCell(row, col, true);

        // Добавляем класс для визуальной обратной связи
        const cell = this.getCellElement(row, col);
        if (cell) {
            cell.classList.add('dragging');
        }

        e.preventDefault();
        e.stopPropagation();
    }

    handleDragMove(e) {
        if (!this.dragStartCell || this.isProcessing) return;

        const currentPos = this.getEventPos(e);
        const deltaX = Math.abs(currentPos.x - this.dragStartPos.x);
        const deltaY = Math.abs(currentPos.y - this.dragStartPos.y);
        const threshold = 5; // Уменьшили порог для более чувствительных свайпов

        if (deltaX > threshold || deltaY > threshold) {
            if (!this.isDragging) {
                this.isDragging = true;
            }
            e.preventDefault();
        }

        // Для touch событий всегда предотвращаем стандартное поведение
        if (e.type === 'touchmove') {
            e.preventDefault();
        }
    }

    handleDragEnd(e, row, col) {
        if (!this.dragStartCell || this.isProcessing) {
            this.resetDrag();
            return;
        }

        const { row: startRow, col: startCol } = this.dragStartCell;

        // Убираем класс dragging
        const startCell = this.getCellElement(startRow, startCol);
        if (startCell) {
            startCell.classList.remove('dragging');
        }

        // Если не было перетаскивания, просто снимаем выделение
        if (!this.isDragging) {
            if (startRow === row && startCol === col) {
                // Клик по той же ячейке - снимаем выделение
                this.selectedCell = null;
                this.highlightCell(row, col, false);
            }
            this.resetDrag();
            return;
        }

        // Проверяем, является ли целевая ячейка соседней
        const isAdjacent = Math.abs(startRow - row) + Math.abs(startCol - col) === 1;

        if (isAdjacent) {
            this.swapCells(startRow, startCol, row, col);
        } else {
            // Если перетащили не на соседнюю ячейку, просто меняем выделение
            this.highlightCell(startRow, startCol, false);
            this.selectedCell = { row, col };
            this.highlightCell(row, col, true);
        }

        this.resetDrag();
        e.preventDefault();
    }

    handleDragCancel() {
        if (this.dragStartCell) {
            const cell = this.getCellElement(this.dragStartCell.row, this.dragStartCell.col);
            if (cell) {
                cell.classList.remove('dragging');
            }
            this.highlightCell(this.dragStartCell.row, this.dragStartCell.col, false);
        }
        this.resetDrag();
    }

    resetDrag() {
        // Убираем класс dragging со всех ячеек на всякий случай
        const draggingCells = document.querySelectorAll('.cell.dragging');
        if (draggingCells.length > 0) {
            draggingCells.forEach(cell => {
                cell.classList.remove('dragging');
            });
        }
        this.dragStartCell = null;
        this.isDragging = false;
        this.dragStartPos = null;
        this.lastTouchMoveTime = 0;
    }

    handleCellClick(row, col) {
        if (this.isProcessing) return;

        if (this.selectedCell === null) {
            this.selectedCell = { row, col };
            this.highlightCell(row, col, true);
        } else {
            const { row: prevRow, col: prevCol } = this.selectedCell;

            if (prevRow === row && prevCol === col) {
                this.selectedCell = null;
                this.highlightCell(row, col, false);
                return;
            }

            const isAdjacent = Math.abs(prevRow - row) + Math.abs(prevCol - col) === 1;

            if (isAdjacent) {
                this.swapCells(prevRow, prevCol, row, col);
            } else {
                this.highlightCell(prevRow, prevCol, false);
                this.selectedCell = { row, col };
                this.highlightCell(row, col, true);
            }
        }
    }

    highlightCell(row, col, highlight) {
        const cell = this.getCellElement(row, col);
        if (cell) {
            cell.classList.toggle('selected', highlight);
        }
    }

    async swapCells(row1, col1, row2, col2) {
        // Воспроизводим звук свапа
        this.soundManager.playSwapSound();

        // Меняем местами сразу
        [this.board[row1][col1], this.board[row2][col2]] =
            [this.board[row2][col2], this.board[row1][col1]];

        // Обновляем только две ячейки вместо полной перерисовки
        this.updateCell(row1, col1);
        this.updateCell(row2, col2);

        const matches = this.findAllMatches();

        if (matches.length > 0) {
            this.moves--;
            this.selectedCell = null;
            this.combo = 1;
            await this.processMatches(matches);
        } else {
            // Возвращаем обратно
            await this.sleep(30); // Минимальная задержка для визуальной обратной связи
            [this.board[row1][col1], this.board[row2][col2]] =
                [this.board[row2][col2], this.board[row1][col1]];
            this.updateCell(row1, col1);
            this.updateCell(row2, col2);
        }

        // Сбрасываем состояние перетаскивания
        this.resetDrag();
    }

    // Находит максимальную горизонтальную линию определенного типа, начиная с позиции
    findHorizontalLine(row, col, type) {
        if (this.getCellType(row, col) !== type) return null;

        const line = [{ row, col }];

        // Ищем влево
        let leftCol = col - 1;
        while (leftCol >= 0 && this.getCellType(row, leftCol) === type) {
            line.unshift({ row, col: leftCol });
            leftCol--;
        }

        // Ищем вправо
        let rightCol = col + 1;
        while (rightCol < this.boardSize && this.getCellType(row, rightCol) === type) {
            line.push({ row, col: rightCol });
            rightCol++;
        }

        return line.length >= 3 ? line : null;
    }

    // Находит максимальную вертикальную линию определенного типа, начиная с позиции
    findVerticalLine(row, col, type) {
        if (this.getCellType(row, col) !== type) return null;

        const line = [{ row, col }];

        // Ищем вверх
        let upRow = row - 1;
        while (upRow >= 0 && this.getCellType(upRow, col) === type) {
            line.unshift({ row: upRow, col });
            upRow--;
        }

        // Ищем вниз
        let downRow = row + 1;
        while (downRow < this.boardSize && this.getCellType(downRow, col) === type) {
            line.push({ row: downRow, col });
            downRow++;
        }

        return line.length >= 3 ? line : null;
    }

    // Проверяет горизонтальную линию определенного типа (для обратной совместимости)
    getHorizontalLine(row, startCol, endCol, type) {
        const line = [];
        for (let col = startCol; col <= endCol; col++) {
            if (this.getCellType(row, col) === type) {
                line.push({ row, col });
            } else {
                return null; // Линия прервана
            }
        }
        return line.length >= 3 ? line : null;
    }

    // Проверяет вертикальную линию определенного типа (для обратной совместимости)
    getVerticalLine(startRow, endRow, col, type) {
        const line = [];
        for (let row = startRow; row <= endRow; row++) {
            if (this.getCellType(row, col) === type) {
                line.push({ row, col });
            } else {
                return null; // Линия прервана
            }
        }
        return line.length >= 3 ? line : null;
    }

    // Находит T-образные совпадения (более гибкий алгоритм)
    findTShapedMatches(visited) {
        const matches = [];
        const processed = new Set();

        // Проходим по всем ячейкам и ищем T-образные фигуры
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cellType = this.getCellType(row, col);
                if (cellType === null) continue;

                const cellKey = `${row}-${col}`;
                // Не пропускаем ячейки, которые уже в visited - они могут быть частью T-образной фигуры
                // но мы проверим это позже при создании match
                if (processed.has(cellKey)) continue;

                // Находим максимальные линии, проходящие через эту ячейку
                const horizontalLine = this.findHorizontalLine(row, col, cellType);
                const verticalLine = this.findVerticalLine(row, col, cellType);

                // Если обе линии существуют и пересекаются в этой ячейке - это T-образная фигура
                if (horizontalLine && verticalLine && horizontalLine.length >= 3 && verticalLine.length >= 3) {
                    // Проверяем, что линии действительно пересекаются в этой точке
                    const isInHorizontal = horizontalLine.some(c => c.row === row && c.col === col);
                    const isInVertical = verticalLine.some(c => c.row === row && c.col === col);

                    if (isInHorizontal && isInVertical) {
                        // Проверяем, что пересечение не на краю обеих линий (это было бы L, а не T)
                        const hIndex = horizontalLine.findIndex(c => c.row === row && c.col === col);
                        const vIndex = verticalLine.findIndex(c => c.row === row && c.col === col);
                        const isHorizontalEnd = hIndex === 0 || hIndex === horizontalLine.length - 1;
                        const isVerticalEnd = vIndex === 0 || vIndex === verticalLine.length - 1;

                        // T-образная фигура: пересечение НЕ на краю хотя бы одной линии
                        // (если на краю обеих - это L)
                        const isTShape = !isHorizontalEnd || !isVerticalEnd;

                        if (isTShape) {
                            // Создаем уникальное совпадение
                            const match = [];
                            const seen = new Set();

                            [...horizontalLine, ...verticalLine].forEach(cell => {
                                const key = `${cell.row}-${cell.col}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    // Добавляем ячейку, даже если она уже в visited (она будет удалена)
                                    match.push(cell);
                                }
                            });

                            // T-образная фигура должна иметь минимум 5 ячеек (3+3-1)
                            if (match.length >= 5) {
                                matches.push(match);
                                match.forEach(cell => {
                                    visited.add(`${cell.row}-${cell.col}`);
                                    processed.add(`${cell.row}-${cell.col}`);
                                });
                            }
                        }
                    }
                }
            }
        }

        return matches;
    }

    // Находит L-образные совпадения (упрощенный и более надежный алгоритм)
    findLShapedMatches(visited) {
        const matches = [];
        const processed = new Set();

        // Проходим по всем ячейкам и ищем L-образные фигуры
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cellType = this.getCellType(row, col);
                if (cellType === null) continue;

                const cellKey = `${row}-${col}`;
                if (processed.has(cellKey)) continue;

                // Находим максимальные линии, проходящие через эту ячейку
                const horizontalLine = this.findHorizontalLine(row, col, cellType);
                const verticalLine = this.findVerticalLine(row, col, cellType);

                // Проверяем, что обе линии существуют и имеют минимум 3 ячейки
                if (!horizontalLine || !verticalLine ||
                    horizontalLine.length < 3 || verticalLine.length < 3) {
                    continue;
                }

                // Проверяем, что ячейка является частью обеих линий
                const isInHorizontal = horizontalLine.some(c => c.row === row && c.col === col);
                const isInVertical = verticalLine.some(c => c.row === row && c.col === col);

                if (!isInHorizontal || !isInVertical) continue;

                // Определяем позицию ячейки в линиях
                const hIndex = horizontalLine.findIndex(c => c.row === row && c.col === col);
                const vIndex = verticalLine.findIndex(c => c.row === row && c.col === col);

                const isHorizontalStart = hIndex === 0;
                const isHorizontalEnd = hIndex === horizontalLine.length - 1;
                const isVerticalStart = vIndex === 0;
                const isVerticalEnd = vIndex === verticalLine.length - 1;

                // L-образная фигура: ячейка должна быть углом
                // Угол = ячейка на начале ИЛИ конце хотя бы одной линии
                // Это включает случаи, когда ячейка на краю обеих линий (угол 3x3)
                const isLCorner = isHorizontalStart || isHorizontalEnd ||
                    isVerticalStart || isVerticalEnd;

                // T-образная фигура: пересечение в центре обеих линий (не на краю ни одной)
                // Если ячейка не на краю обеих линий - это T, а не L
                const isTCenter = !isHorizontalStart && !isHorizontalEnd &&
                    !isVerticalStart && !isVerticalEnd;

                // Если это угол и не центр T-образной фигуры - это L-образная фигура
                if (isLCorner && !isTCenter) {
                    // Создаем уникальное совпадение
                    const match = [];
                    const seen = new Set();

                    [...horizontalLine, ...verticalLine].forEach(cell => {
                        const key = `${cell.row}-${cell.col}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            match.push(cell);
                        }
                    });

                    // L-образная фигура должна иметь минимум 5 ячеек (3+3-1)
                    if (match.length >= 5) {
                        matches.push(match);
                        match.forEach(cell => {
                            visited.add(`${cell.row}-${cell.col}`);
                            processed.add(`${cell.row}-${cell.col}`);
                        });
                    }
                }
            }
        }

        return matches;
    }

    findAllMatches() {
        const matches = [];
        const visited = new Set();

        // Горизонтальные совпадения
        for (let row = 0; row < this.boardSize; row++) {
            let count = 1;
            let currentType = this.getCellType(row, 0);

            for (let col = 1; col < this.boardSize; col++) {
                if (this.getCellType(row, col) === currentType && currentType !== null) {
                    count++;
                } else {
                    if (count >= 3) {
                        const match = [];
                        for (let c = col - count; c < col; c++) {
                            const key = `${row}-${c}`;
                            if (!visited.has(key)) {
                                match.push({ row, col: c });
                                visited.add(key);
                            }
                        }
                        if (match.length >= 3) {
                            matches.push(match);
                        }
                    }
                    count = 1;
                    currentType = this.getCellType(row, col);
                }
            }

            if (count >= 3) {
                const match = [];
                for (let c = this.boardSize - count; c < this.boardSize; c++) {
                    const key = `${row}-${c}`;
                    if (!visited.has(key)) {
                        match.push({ row, col: c });
                        visited.add(key);
                    }
                }
                if (match.length >= 3) {
                    matches.push(match);
                }
            }
        }

        // Вертикальные совпадения
        for (let col = 0; col < this.boardSize; col++) {
            let count = 1;
            let currentType = this.getCellType(0, col);

            for (let row = 1; row < this.boardSize; row++) {
                if (this.getCellType(row, col) === currentType && currentType !== null) {
                    count++;
                } else {
                    if (count >= 3) {
                        const match = [];
                        for (let r = row - count; r < row; r++) {
                            const key = `${r}-${col}`;
                            if (!visited.has(key)) {
                                match.push({ row: r, col });
                                visited.add(key);
                            }
                        }
                        if (match.length >= 3) {
                            matches.push(match);
                        }
                    }
                    count = 1;
                    currentType = this.getCellType(row, col);
                }
            }

            if (count >= 3) {
                const match = [];
                for (let r = this.boardSize - count; r < this.boardSize; r++) {
                    const key = `${r}-${col}`;
                    if (!visited.has(key)) {
                        match.push({ row: r, col });
                        visited.add(key);
                    }
                }
                if (match.length >= 3) {
                    matches.push(match);
                }
            }
        }

        // T-образные совпадения
        const tMatches = this.findTShapedMatches(visited);
        matches.push(...tMatches);
        // Обновляем visited после добавления T-образных
        tMatches.forEach(match => {
            match.forEach(cell => visited.add(`${cell.row}-${cell.col}`));
        });

        // L-образные совпадения (ищем после T, но до финальной проверки visited)
        // Создаем копию visited для L-образных, чтобы не пропустить фигуры
        const lVisited = new Set(visited);
        const lMatches = this.findLShapedMatches(lVisited);
        matches.push(...lMatches);
        // Обновляем основной visited после добавления L-образных
        lMatches.forEach(match => {
            match.forEach(cell => visited.add(`${cell.row}-${cell.col}`));
        });

        return matches;
    }

    async processMatches(matches) {
        this.isProcessing = true;

        // Сбрасываем выделение и убираем фокус с ячеек перед обработкой совпадений
        if (this.selectedCell) {
            this.highlightCell(this.selectedCell.row, this.selectedCell.col, false);
            this.selectedCell = null;
        }
        // Убираем класс selected и фокус со всех ячеек
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            cell.classList.remove('selected');
            cell.blur();
            if (document.activeElement === cell) {
                cell.blur();
            }
        });

        // Определяем специальные фигуры ПЕРЕД удалением
        const specialCells = [];
        matches.forEach(match => {
            if (match.length === 4) {
                const { row, col } = match[Math.floor(match.length / 2)];
                const isHorizontal = match.every(c => c.row === row);
                specialCells.push({
                    row,
                    col,
                    special: isHorizontal ? this.SPECIAL_TYPES.ROCKET_H : this.SPECIAL_TYPES.ROCKET_V
                });
            } else if (match.length >= 5) {
                const { row, col } = match[Math.floor(match.length / 2)];
                specialCells.push({ row, col, special: this.SPECIAL_TYPES.BOMB });
            }
        });

        // Создаем специальные фигуры на доске и показываем их
        if (specialCells.length > 0) {
            specialCells.forEach(({ row, col, special }) => {
                this.board[row][col].special = special;
                this.updateCell(row, col); // Обновляем только измененные ячейки
            });
            await this.sleep(50); // Минимальная задержка для показа специальных фигур
        }

        // Подсчитываем очки с учетом комбо и бонусов за T/L-образные фигуры
        let totalMatched = 0;
        let tShapeBonus = 0;
        let lShapeBonus = 0;

        matches.forEach(match => {
            totalMatched += match.length;

            // Проверяем, является ли совпадение T-образным или L-образным
            if (this.isTShapedMatch(match)) {
                tShapeBonus += match.length;
            } else if (this.isLShapedMatch(match)) {
                lShapeBonus += match.length;
            }
        });

        const baseScore = totalMatched * 10;
        const comboMultiplier = Math.min(this.combo, 5);

        // Бонусы: T-образные фигуры дают +50% очков, L-образные +30%
        const tShapeBonusScore = tShapeBonus * 10 * 0.5;
        const lShapeBonusScore = lShapeBonus * 10 * 0.3;

        const scoreGain = (baseScore + tShapeBonusScore + lShapeBonusScore) * comboMultiplier;
        this.score += scoreGain;

        // Показываем специальные сообщения для T/L-образных фигур
        if (tShapeBonus > 0) {
            this.showSpecialPopup('T-SHAPE BONUS!', tShapeBonusScore * comboMultiplier);
        }
        if (lShapeBonus > 0) {
            this.showSpecialPopup('L-SHAPE BONUS!', lShapeBonusScore * comboMultiplier);
        }

        // Показываем комбо
        if (this.combo > 1) {
            this.showCombo(this.combo);
        }

        // Показываем очки
        this.showScorePopup(scoreGain);

        // Воспроизводим звук монетки один раз при исчезновении ячеек
        this.soundManager.playCoinSound();

        // Анимация удаления
        matches.forEach(match => {
            match.forEach(({ row, col }) => {
                const cell = this.getCellElement(row, col);
                if (cell) {
                    // Убираем все возможные классы, которые могут вызывать красное подсвечивание
                    cell.classList.remove('selected', 'dragging');
                    cell.blur();
                    // Добавляем класс matched
                    cell.classList.add('matched');
                    this.createExplosionParticles(row, col);
                }
            });
        });

        await this.sleep(100); // Минимальная задержка анимации

        // Обрабатываем специальные фигуры
        const cellsToRemove = new Set();
        matches.forEach(match => {
            match.forEach(({ row, col }) => {
                cellsToRemove.add(`${row}-${col}`);
            });
        });

        // Добавляем эффекты специальных фигур
        specialCells.forEach(({ row, col, special }) => {
            const key = `${row}-${col}`;
            cellsToRemove.add(key);

            if (special === this.SPECIAL_TYPES.BOMB) {
                // Бомба взрывает область 3x3
                this.soundManager.playBombSound();
                for (let r = Math.max(0, row - 1); r <= Math.min(this.boardSize - 1, row + 1); r++) {
                    for (let c = Math.max(0, col - 1); c <= Math.min(this.boardSize - 1, col + 1); c++) {
                        cellsToRemove.add(`${r}-${c}`);
                        if (r !== row || c !== col) {
                            setTimeout(() => this.createExplosionParticles(r, c), 100);
                        }
                    }
                }
            } else if (special === this.SPECIAL_TYPES.ROCKET_H) {
                // Горизонтальная ракета удаляет всю строку
                this.soundManager.playRocketSound();
                for (let c = 0; c < this.boardSize; c++) {
                    cellsToRemove.add(`${row}-${c}`);
                    if (c !== col) {
                        setTimeout(() => this.createExplosionParticles(row, c), 50 * Math.abs(c - col));
                    }
                }
            } else if (special === this.SPECIAL_TYPES.ROCKET_V) {
                // Вертикальная ракета удаляет весь столбец
                this.soundManager.playRocketSound();
                for (let r = 0; r < this.boardSize; r++) {
                    cellsToRemove.add(`${r}-${col}`);
                    if (r !== row) {
                        setTimeout(() => this.createExplosionParticles(r, col), 50 * Math.abs(r - row));
                    }
                }
            }
        });

        // Удаляем ячейки
        cellsToRemove.forEach(key => {
            const [row, col] = key.split('-').map(Number);
            this.board[row][col] = { type: -1, special: null };
        });

        // Падение фигур
        await this.dropTiles();

        // Заполнение пустых мест
        this.fillEmptySpaces();

        // Используем requestAnimationFrame для более плавного рендеринга
        requestAnimationFrame(() => {
            this.render();
        });

        // Проверяем новые совпадения (каскад)
        const newMatches = this.findAllMatches();
        if (newMatches.length > 0) {
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            await this.processMatches(newMatches);
        } else {
            this.combo = 1;
            this.isProcessing = false;
            this.checkGameOver();
        }
    }

    async dropTiles() {
        const cellsToUpdate = [];

        for (let col = 0; col < this.boardSize; col++) {
            let writeIndex = this.boardSize - 1;

            for (let row = this.boardSize - 1; row >= 0; row--) {
                if (this.board[row][col].type !== -1) {
                    if (writeIndex !== row) {
                        this.board[writeIndex][col] = { ...this.board[row][col] };
                        this.board[row][col] = { type: -1, special: null };
                        cellsToUpdate.push({ row: writeIndex, col, oldRow: row });
                    }
                    writeIndex--;
                }
            }
        }

        // Воспроизводим звук падения один раз, если есть падающие ячейки
        if (cellsToUpdate.length > 0) {
            this.soundManager.playDropSound();
        }

        // Анимация падения для измененных ячеек
        cellsToUpdate.forEach(({ row, col }) => {
            const cell = this.getCellElement(row, col);
            if (cell) {
                cell.classList.add('falling');
            }
        });

        await this.sleep(80); // Быстрая анимация падения
    }

    fillEmptySpaces() {
        const cellsToUpdate = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col].type === -1) {
                    this.board[row][col] = { type: this.getSafeType(row, col), special: null };
                    cellsToUpdate.push({ row, col });
                }
            }
        }

        // Обновляем только измененные ячейки
        cellsToUpdate.forEach(({ row, col }) => {
            this.updateCell(row, col);
        });
    }

    showCombo(combo) {
        const comboDisplay = document.getElementById('comboDisplay');
        comboDisplay.textContent = `COMBO x${combo}!`;
        comboDisplay.classList.add('show');

        // Воспроизводим звук комбо
        this.soundManager.playComboSound(combo);

        setTimeout(() => {
            comboDisplay.classList.remove('show');
        }, 1000);
    }

    showScorePopup(score) {
        const popup = document.getElementById('scorePopup');
        popup.textContent = `+${score}`;
        popup.style.left = '50%';
        popup.style.top = '40%';
        popup.classList.add('show');

        setTimeout(() => {
            popup.classList.remove('show');
        }, 1000);
    }

    showSpecialPopup(text, score) {
        const popup = document.getElementById('scorePopup');
        popup.textContent = `${text} +${Math.round(score)}`;
        popup.style.left = '50%';
        popup.style.top = '35%';
        popup.style.fontSize = '1.2em';
        popup.style.color = '#ffd700';
        popup.classList.add('show');

        setTimeout(() => {
            popup.classList.remove('show');
            popup.style.fontSize = '';
            popup.style.color = '';
        }, 1500);
    }

    // Проверяет, является ли совпадение T-образным
    isTShapedMatch(match) {
        if (match.length < 5) return false; // T-образная фигура минимум 5 ячеек

        // Группируем ячейки по строкам и столбцам
        const rows = new Set(match.map(c => c.row));
        const cols = new Set(match.map(c => c.col));

        // T-образная фигура имеет одну строку с 3+ ячейками и один столбец с 3+ ячейками
        // которые пересекаются в одной точке
        let hasHorizontalLine = false;
        let hasVerticalLine = false;
        let intersectionPoint = null;

        // Проверяем горизонтальные линии
        rows.forEach(row => {
            const cellsInRow = match.filter(c => c.row === row);
            if (cellsInRow.length >= 3) {
                hasHorizontalLine = true;
                // Проверяем вертикальные линии, пересекающиеся с этой строкой
                cols.forEach(col => {
                    const cellsInCol = match.filter(c => c.col === col);
                    if (cellsInCol.length >= 3 && cellsInRow.some(c => c.col === col)) {
                        hasVerticalLine = true;
                        intersectionPoint = { row, col };
                    }
                });
            }
        });

        return hasHorizontalLine && hasVerticalLine && intersectionPoint !== null;
    }

    // Проверяет, является ли совпадение L-образным
    isLShapedMatch(match) {
        if (match.length < 5) return false; // L-образная фигура минимум 5 ячеек

        // Группируем ячейки по строкам и столбцам
        const rows = new Set(match.map(c => c.row));
        const cols = new Set(match.map(c => c.col));

        // L-образная фигура имеет одну строку с 3+ ячейками и один столбец с 3+ ячейками
        // которые соединены в углу (не пересекаются в центре)
        let hasHorizontalLine = false;
        let hasVerticalLine = false;
        let cornerPoint = null;

        // Проверяем горизонтальные линии
        rows.forEach(row => {
            const cellsInRow = match.filter(c => c.row === row);
            if (cellsInRow.length >= 3) {
                hasHorizontalLine = true;
                // Проверяем вертикальные линии, соединенные в углу
                cols.forEach(col => {
                    const cellsInCol = match.filter(c => c.col === col);
                    if (cellsInCol.length >= 3) {
                        // Угол: ячейка должна быть в конце одной линии и началом другой
                        const cornerCell = match.find(c => c.row === row && c.col === col);
                        if (cornerCell) {
                            // Проверяем, что это действительно угол (конец одной линии, начало другой)
                            const isCorner = (cellsInRow.some(c => c.col === col) &&
                                cellsInCol.some(c => c.row === row));
                            if (isCorner) {
                                hasVerticalLine = true;
                                cornerPoint = { row, col };
                            }
                        }
                    }
                });
            }
        });

        return hasHorizontalLine && hasVerticalLine && cornerPoint !== null && !this.isTShapedMatch(match);
    }

    createExplosionParticles(row, col) {
        const cell = this.getCellElement(row, col);
        if (!cell) return;

        // Определяем, является ли устройство мобильным
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

        // На мобильных отключаем частицы для лучшей производительности
        if (isMobile) {
            return;
        }

        const rect = cell.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // На десктопе используем меньше частиц
        const particleCount = 8;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle explosion';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';

            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 40 + Math.random() * 40;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            particle.style.setProperty('--x', x + 'px');
            particle.style.setProperty('--y', y + 'px');

            document.getElementById('particlesContainer').appendChild(particle);

            setTimeout(() => {
                if (particle.parentNode) {
                    particle.remove();
                }
            }, 800);
        }
    }

    createParticles() {
        const container = document.getElementById('particlesContainer');
        // Определяем, является ли устройство мобильным
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        // На мобильных создаем меньше частиц для лучшей производительности
        const particleCount = isMobile ? 5 : 20;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 3 + 's';
            particle.style.animationDuration = (2 + Math.random() * 2) + 's';
            container.appendChild(particle);
        }
    }

    findHint() {
        // Простой алгоритм поиска возможных ходов
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                // Проверяем обмен вправо
                if (col < this.boardSize - 1) {
                    [this.board[row][col], this.board[row][col + 1]] =
                        [this.board[row][col + 1], this.board[row][col]];

                    const matches = this.findAllMatches();
                    if (matches.length > 0) {
                        [this.board[row][col], this.board[row][col + 1]] =
                            [this.board[row][col + 1], this.board[row][col]];

                        this.highlightCell(row, col, true);
                        this.highlightCell(row, col + 1, true);
                        setTimeout(() => {
                            this.highlightCell(row, col, false);
                            this.highlightCell(row, col + 1, false);
                        }, 2000);
                        return;
                    }

                    [this.board[row][col], this.board[row][col + 1]] =
                        [this.board[row][col + 1], this.board[row][col]];
                }

                // Проверяем обмен вниз
                if (row < this.boardSize - 1) {
                    [this.board[row][col], this.board[row + 1][col]] =
                        [this.board[row + 1][col], this.board[row][col]];

                    const matches = this.findAllMatches();
                    if (matches.length > 0) {
                        [this.board[row][col], this.board[row + 1][col]] =
                            [this.board[row + 1][col], this.board[row][col]];

                        this.highlightCell(row, col, true);
                        this.highlightCell(row + 1, col, true);
                        setTimeout(() => {
                            this.highlightCell(row, col, false);
                            this.highlightCell(row + 1, col, false);
                        }, 2000);
                        return;
                    }

                    [this.board[row][col], this.board[row + 1][col]] =
                        [this.board[row + 1][col], this.board[row][col]];
                }
            }
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('moves').textContent = this.moves;
        document.getElementById('combo').textContent = `x${this.combo}`;

        // Обновляем прогресс цели
        const progress = Math.min((this.score / this.targetScore) * 100, 100);
        document.getElementById('scoreProgress').style.width = progress + '%';
    }

    checkGameOver() {
        const won = this.score >= this.targetScore;
        const lost = this.moves <= 0 && this.score < this.targetScore;

        if (won || lost) {
            this.endGame(won);
        }
    }

    async endGame(won) {
        // Обновляем day streak после игры
        if (typeof updateDayStreakAfterGame === 'function') {
            updateDayStreakAfterGame();
        }

        // Проверяем, подключен ли кошелек перед сохранением
        if (!this.walletManager.isConnected()) {
            const modal = document.getElementById('gameOverModal');
            const title = document.getElementById('gameOverTitle');
            const message = document.getElementById('gameOverMessage');
            const finalScore = document.getElementById('finalScore');
            const finalCombo = document.getElementById('finalCombo');

            finalScore.textContent = this.score.toLocaleString();
            finalCombo.textContent = this.maxCombo;

            title.textContent = 'Game Over!';
            message.textContent = won
                ? 'You won! Connect your wallet to save your score to the leaderboard. 🎮'
                : `Game Over! Connect your wallet to save your score to the leaderboard.`;

            // Воспроизводим звуки даже если кошелек не подключен
            if (won) {
                this.soundManager.playWinSound();
            } else {
                this.soundManager.playLoseSound();
            }

            modal.classList.add('show');
            return;
        }

        // Сохраняем результат в лидерборд (асинхронно)
        const savedResult = await this.leaderboard.addResult(this.score, this.maxCombo, won);

        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const finalScore = document.getElementById('finalScore');
        const finalCombo = document.getElementById('finalCombo');

        finalScore.textContent = this.score.toLocaleString();
        finalCombo.textContent = this.maxCombo;

        // Проверяем, попал ли результат в топ (обновляем данные с сервера)
        const currentAddress = this.walletManager.getAccount().toLowerCase();
        const topResults = await this.leaderboard.fetchLeaderboard('all', 10);
        const isTopResult = savedResult && topResults.some(r => {
            const resultAddress = (r.walletAddress || r.playerName || '').toLowerCase();
            return r.score === this.score &&
                resultAddress === currentAddress &&
                Math.abs(new Date(r.date).getTime() - Date.now()) < 5000; // 5 секунд окно
        });

        if (won) {
            title.textContent = 'Congratulations!';
            message.textContent = isTopResult
                ? 'You reached the level goal and set a new high score! 🏆'
                : 'You reached the level goal! Great game!';
            // Воспроизводим звук победы
            this.soundManager.playWinSound();
        } else {
            title.textContent = 'Game Over!';
            message.textContent = `You needed ${(this.targetScore - this.score).toLocaleString()} more points. Try again!`;
            if (isTopResult) {
                message.textContent += ' Great score! 🎯';
            }
            // Воспроизводим звук проигрыша
            this.soundManager.playLoseSound();
        }

        modal.classList.add('show');
    }

    async showLeaderboard(filter = 'all') {
        const modal = document.getElementById('leaderboardModal');
        const list = document.getElementById('leaderboardList');
        const totalPlayers = document.getElementById('totalPlayers');
        const totalGames = document.getElementById('totalGames');

        // Показываем модалку сразу
        modal.classList.add('show');

        // Показываем индикатор загрузки
        list.innerHTML = '<div class="leaderboard-empty">Loading leaderboard...</div>';

        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === filter);
        });

        try {
            // Получаем топ результаты с сервера
            const topResults = await this.leaderboard.fetchLeaderboard(filter, 20);

            // Отображаем статистику
            totalPlayers.textContent = this.leaderboard.getTotalPlayers();
            totalGames.textContent = this.leaderboard.totalGames || this.leaderboard.leaderboard.length;

            // Отображаем лидерборд
            if (topResults.length === 0) {
                list.innerHTML = '<div class="leaderboard-empty">No results yet. Be the first to play!</div>';
                return;
            }

            const currentAddress = this.walletManager.isConnected()
                ? this.walletManager.getAccount().toLowerCase()
                : null;

            list.innerHTML = topResults.map((result, index) => {
                const date = new Date(result.date);
                const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

                // Используем walletAddress, если есть, иначе playerName для обратной совместимости
                const resultAddress = (result.walletAddress || result.playerName || '').toLowerCase();
                const displayAddress = result.walletAddress
                    ? this.leaderboard.formatAddress(result.walletAddress)
                    : (result.playerName || 'Unknown');

                const isCurrentPlayer = currentAddress && resultAddress === currentAddress;

                return `
                    <div class="leaderboard-item ${isCurrentPlayer ? 'current-player' : ''}">
                        <div class="leaderboard-rank">
                            ${medal || `<span class="rank-number">${index + 1}</span>`}
                        </div>
                        <div class="leaderboard-player">
                            <div class="player-name-row">
                                <span class="player-name wallet-address">${this.escapeHtml(displayAddress)}</span>
                                ${isCurrentPlayer ? '<span class="you-badge">You</span>' : ''}
                                ${result.won ? '<span class="win-badge">✓</span>' : ''}
                            </div>
                            <div class="player-date">${dateStr}</div>
                        </div>
                        <div class="leaderboard-score">
                            <div class="score-value">${result.score.toLocaleString()}</div>
                            <div class="combo-value">Combo: ${result.maxCombo}x</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            list.innerHTML = '<div class="leaderboard-empty">Error loading leaderboard. Please try again later.</div>';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async newGame() {
        this.score = 0;
        this.moves = 30;
        this.combo = 1;
        this.maxCombo = 1;
        this.selectedCell = null;
        this.isProcessing = false;
        document.getElementById('gameOverModal').classList.remove('show');
        await this.init();
    }

    setupEventListeners() {
        // Функция для активации звуков при первом взаимодействии
        const activateSoundsOnce = () => {
            if (!this.soundManager.initialized) {
                this.soundManager.activate();
            }
        };

        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                activateSoundsOnce();
                this.newGame();
            });
        }

        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                activateSoundsOnce();
                this.newGame();
            });
        }

        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                activateSoundsOnce();
                this.findHint();
            });
        }

        // Лидерборд (если элементы существуют)
        const leaderboardBtn = document.getElementById('leaderboardBtn');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => {
                this.showLeaderboard('all');
            });
        }

        const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
        if (closeLeaderboardBtn) {
            closeLeaderboardBtn.addEventListener('click', () => {
                const modal = document.getElementById('leaderboardModal');
                if (modal) modal.classList.remove('show');
            });
        }

        // Onboarding modal (показываем только при первом посещении)
        const closeOnboardingBtn = document.getElementById('closeOnboardingBtn');
        if (closeOnboardingBtn) {
            closeOnboardingBtn.addEventListener('click', () => {
                const modal = document.getElementById('onboardingModal');
                if (modal) modal.classList.remove('show');
                // Сохраняем, что пользователь видел onboarding
                localStorage.setItem('onboardingSeen', 'true');
            });
        }

        // Проверяем, нужно ли показать onboarding
        this.checkOnboarding();

        // Вкладки лидерборда
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.tab;
                if (typeof this.showLeaderboard === 'function') {
                    this.showLeaderboard(filter);
                }
            });
        });

        // Закрытие модалок по клику на backdrop
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    const modal = backdrop.closest('.modal');
                    if (modal) modal.classList.remove('show');
                }
            });
        });

        // Подключение кошелька (если элемент существует)
        const connectWalletBtn = document.getElementById('connectWalletBtn');
        if (connectWalletBtn && this.walletManager) {
            // Определяем, является ли устройство мобильным
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

            // Флаг для предотвращения двойного срабатывания
            let isProcessing = false;

            // Функция обработки нажатия на кнопку
            const handleWalletButton = async (e) => {
                // Активируем звуки при первом взаимодействии
                if (!this.soundManager.initialized) {
                    this.soundManager.activate();
                }

                // Предотвращаем всплытие, чтобы не конфликтовать с drag-обработчиками
                e.preventDefault();
                e.stopPropagation();

                // Предотвращаем двойное срабатывание
                if (isProcessing) return;
                isProcessing = true;

                try {
                    if (this.walletManager.isConnected()) {
                        // На мобильных отключаем без confirm, на десктопе показываем confirm
                        let shouldDisconnect = true;
                        if (!isMobile) {
                            shouldDisconnect = confirm('Disconnect wallet?');
                        }

                        if (shouldDisconnect) {
                            this.walletManager.disconnect();
                            // Принудительно обновляем UI
                            if (typeof this.updateWalletDisplay === 'function') {
                                this.updateWalletDisplay();
                            }
                            // Также вызываем обновление UI кошелька напрямую
                            if (this.walletManager.updateWalletUI) {
                                this.walletManager.updateWalletUI();
                            }
                        }
                    } else {
                        const result = await this.walletManager.connect();
                        if (result.success) {
                            if (typeof this.updateWalletDisplay === 'function') {
                                this.updateWalletDisplay();
                            }
                        } else {
                            if (this.walletManager.showWalletModal) {
                                this.walletManager.showWalletModal(result.error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error handling wallet button:', error);
                } finally {
                    // Сбрасываем флаг через небольшую задержку
                    setTimeout(() => {
                        isProcessing = false;
                    }, 300);
                }
            };

            // Обработчики для клика и touch (для мобильных устройств)
            connectWalletBtn.addEventListener('click', handleWalletButton);

            // Для touch событий используем более надежную обработку
            let touchStartTime = 0;
            connectWalletBtn.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                e.stopPropagation(); // Предотвращаем всплытие к drag-обработчикам
            }, { passive: true });

            connectWalletBtn.addEventListener('touchend', (e) => {
                // Проверяем, что это был тап (не свайп)
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 300) { // Короткий тап (< 300ms)
                    e.preventDefault();
                    e.stopPropagation();
                    handleWalletButton(e);
                }
            }, { passive: false });
        }

        // Закрытие модалки кошелька
        const closeWalletModalBtn = document.getElementById('closeWalletModalBtn');
        if (closeWalletModalBtn) {
            closeWalletModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('walletModal');
                if (modal) modal.classList.remove('show');
            });
        }

        // Обновляем UI кошелька при инициализации (если методы существуют)
        if (this.walletManager && typeof this.walletManager.updateWalletUI === 'function') {
            try {
                this.walletManager.updateWalletUI();
            } catch (e) {
                console.log('Wallet UI update failed:', e);
            }
        }

        if (typeof this.updateWalletDisplay === 'function') {
            try {
                this.updateWalletDisplay();
            } catch (e) {
                console.log('Wallet display update failed:', e);
            }
        }
    }

    initializeSDK() {
        // SDK уже должен быть инициализирован в index.html или в начале script.js
        // Здесь просто проверяем и сохраняем ссылку для использования в игре
        (async () => {
            try {
                // Если SDK уже ready - используем его
                if (window.__farcasterSDKReady && window.__farcasterSDK) {
                    sdk = window.__farcasterSDK;
                    console.log('Using pre-initialized Farcaster SDK');
                    return;
                }

                // Ждем немного на случай если SDK еще инициализируется
                await new Promise(resolve => setTimeout(resolve, 300));

                // Проверяем еще раз
                if (window.__farcasterSDKReady && window.__farcasterSDK) {
                    sdk = window.__farcasterSDK;
                    console.log('Using pre-initialized Farcaster SDK (after delay)');
                    return;
                }

                // Если SDK так и не найден, пробуем найти вручную
                // Способ 1: Официальный CDN - frame.sdk
                if (typeof frame !== 'undefined' && frame.sdk) {
                    sdk = frame.sdk;
                    console.log('SDK found via frame.sdk');
                    return;
                }

                // Способ 2: window.farcaster.miniapp
                if (window.farcaster && window.farcaster.miniapp) {
                    sdk = window.farcaster.miniapp;
                    console.log('SDK found via window.farcaster.miniapp');
                    return;
                }

                console.log('MiniApp SDK not found - game works without it');
            } catch (error) {
                console.log('initializeSDK error (non-critical):', error.message);
            }
        })();
    }

    checkOnboarding() {
        // Показываем onboarding только при первом посещении
        const onboardingSeen = localStorage.getItem('onboardingSeen');
        if (!onboardingSeen) {
            // Ждем немного для загрузки игры, затем показываем onboarding
            setTimeout(() => {
                const modal = document.getElementById('onboardingModal');
                if (modal) {
                    modal.classList.add('show');
                }
            }, 1000);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запускаем игру
let game;

// Добавляем немедленное логирование для проверки загрузки скрипта
console.log('Script.js loaded');
console.log('Script.js module type:', typeof window !== 'undefined' ? 'browser' : 'node');
console.log('Document ready state:', typeof document !== 'undefined' ? document.readyState : 'N/A');

// Управление стартовым меню
let startMenuInitialized = false;
function initStartMenu() {
    // Защита от повторной инициализации
    if (startMenuInitialized) {
        console.log('Start menu already initialized, skipping...');
        return;
    }
    
    const startMenu = document.getElementById('startMenu');
    const gameContainer = document.getElementById('gameContainer');
    const menuNewGameBtn = document.getElementById('menuNewGameBtn');
    const menuRulesBtn = document.getElementById('menuRulesBtn');
    const menuSettingsBtn = document.getElementById('menuSettingsBtn');
    const menuLeaderboardBtn = document.getElementById('menuLeaderboardBtn');
    const menuDayStreakBtn = document.getElementById('menuDayStreakBtn');
    const settingsModal = document.getElementById('settingsModal');
    const dayStreakModal = document.getElementById('dayStreakModal');
    const rulesModal = document.getElementById('rulesModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const closeDayStreakBtn = document.getElementById('closeDayStreakBtn');
    const closeRulesBtn = document.getElementById('closeRulesBtn');
    
    // Проверяем наличие необходимых элементов
    if (!startMenu || !gameContainer) {
        console.warn('Start menu elements not found, retrying...');
        setTimeout(initStartMenu, 100);
        return;
    }
    
    startMenuInitialized = true;

    // Показываем меню по умолчанию
    if (startMenu) {
        startMenu.style.display = 'flex';
    }

    // Функция для скрытия меню и показа игры
    function showGame() {
        if (startMenu) {
            startMenu.classList.add('hidden');
        }
        if (gameContainer) {
            gameContainer.style.display = 'block';
        }
    }

    // Функция для показа меню и скрытия игры
    function showMenu() {
        if (startMenu) {
            startMenu.classList.remove('hidden');
            startMenu.style.display = 'flex';
        }
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }
    }

    // New Game - начинаем новую игру
    if (menuNewGameBtn) {
        menuNewGameBtn.addEventListener('click', () => {
            showGame();
            if (window.game && typeof window.game.newGame === 'function') {
                window.game.newGame();
            }
        });
    }

    // Rules - открываем правила игры
    if (menuRulesBtn && rulesModal) {
        menuRulesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Rules button clicked');
            rulesModal.classList.add('show');
        });
        console.log('Rules button handler attached');
    } else {
        console.warn('Rules button or modal not found', { menuRulesBtn, rulesModal });
    }

    if (closeRulesBtn && rulesModal) {
        closeRulesBtn.addEventListener('click', () => {
            rulesModal.classList.remove('show');
        });
    }

    // Settings - открываем настройки
    if (menuSettingsBtn && settingsModal) {
        menuSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Settings button clicked');
            settingsModal.classList.add('show');
        });
        console.log('Settings button handler attached');
    } else {
        console.warn('Settings button or modal not found', { menuSettingsBtn, settingsModal });
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
    }

    // Leaderboard - открываем лидерборд
    if (menuLeaderboardBtn) {
        menuLeaderboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Leaderboard button clicked');
            if (window.game && typeof window.game.showLeaderboard === 'function') {
                window.game.showLeaderboard();
            } else {
                // Альтернативный способ открытия лидерборда
                const leaderboardModal = document.getElementById('leaderboardModal');
                const leaderboardBtn = document.getElementById('leaderboardBtn');
                if (leaderboardModal && leaderboardBtn) {
                    leaderboardBtn.click();
                } else if (leaderboardModal) {
                    // Если модальное окно есть, но кнопки нет, открываем напрямую
                    leaderboardModal.classList.add('show');
                }
            }
        });
        console.log('Leaderboard button handler attached');
    } else {
        console.warn('Leaderboard button not found');
    }

    // GM Streak - открываем информацию о серии дней
    if (menuDayStreakBtn && dayStreakModal) {
        menuDayStreakBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('GM Streak button clicked');
            updateDayStreakDisplay();
            dayStreakModal.classList.add('show');
        });
        console.log('GM Streak button handler attached');
    } else {
        console.warn('GM Streak button or modal not found', { menuDayStreakBtn, dayStreakModal });
    }

    if (closeDayStreakBtn && dayStreakModal) {
        closeDayStreakBtn.addEventListener('click', () => {
            dayStreakModal.classList.remove('show');
        });
    }

    // Закрытие модальных окон при клике на backdrop
    if (settingsModal) {
        const backdrop = settingsModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });
        }
    }

    if (dayStreakModal) {
        const backdrop = dayStreakModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                dayStreakModal.classList.remove('show');
            });
        }
    }

    if (rulesModal) {
        const backdrop = rulesModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                rulesModal.classList.remove('show');
            });
        }
    }

    // Обновляем отображение GM Streak на главном экране
    updateDayStreakDisplay();

    // Сохраняем функции для использования из других мест
    window.showGameMenu = showMenu;
    window.hideGameMenu = showGame;
}

// Функция для обновления отображения GM Streak
function updateDayStreakDisplay() {
    // Получаем streak из localStorage
    const streakData = localStorage.getItem('dayStreak');
    let streak = 0;
    let lastPlayDate = null;

    if (streakData) {
        try {
            const data = JSON.parse(streakData);
            streak = data.streak || 0;
            lastPlayDate = data.lastPlayDate || null;

            // Проверяем, играл ли пользователь сегодня
            const today = new Date().toDateString();
            if (lastPlayDate !== today) {
                // Проверяем, был ли это вчера (для продолжения streak)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (lastPlayDate === yesterday.toDateString()) {
                    // Продолжаем streak
                    streak += 1;
                    localStorage.setItem('dayStreak', JSON.stringify({
                        streak: streak,
                        lastPlayDate: today
                    }));
                } else if (lastPlayDate !== today) {
                    // Streak сброшен
                    streak = 0;
                    localStorage.setItem('dayStreak', JSON.stringify({
                        streak: 0,
                        lastPlayDate: null
                    }));
                }
            }
        } catch (e) {
            console.error('Error parsing day streak data:', e);
        }
    }

    // Обновляем отображение в меню
    const dayStreakDisplay = document.getElementById('dayStreakDisplay');
    const dayStreakValue = document.getElementById('dayStreakValue');
    const streakValueLarge = document.getElementById('streakValueLarge');

    if (streak > 0 && dayStreakDisplay) {
        dayStreakDisplay.style.display = 'block';
    }

    if (dayStreakValue) {
        dayStreakValue.textContent = streak;
    }

    if (streakValueLarge) {
        streakValueLarge.textContent = streak;
    }
}

// Функция для обновления streak после игры
function updateDayStreakAfterGame() {
    const today = new Date().toDateString();
    const streakData = localStorage.getItem('dayStreak');
    let streak = 0;

    if (streakData) {
        try {
            const data = JSON.parse(streakData);
            streak = data.streak || 0;
            const lastPlayDate = data.lastPlayDate || null;

            if (lastPlayDate === today) {
                // Уже играли сегодня, ничего не меняем
                return;
            } else {
                // Проверяем, был ли это вчера (для продолжения streak)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (lastPlayDate === yesterday.toDateString()) {
                    // Продолжаем streak
                    streak += 1;
                } else {
                    // Начинаем новый streak
                    streak = 1;
                }
            }
        } catch (e) {
            streak = 1;
        }
    } else {
        streak = 1;
    }

    localStorage.setItem('dayStreak', JSON.stringify({
        streak: streak,
        lastPlayDate: today
    }));

    updateDayStreakDisplay();
}

// Скрываем индикатор загрузки после инициализации
function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.classList.add('hidden');
        // Дополнительно скрываем через стили для гарантии
        indicator.style.display = 'none';
        indicator.style.visibility = 'hidden';
        indicator.style.opacity = '0';
        indicator.style.pointerEvents = 'none';
        console.log('Loading indicator hidden');
    } else {
        console.warn('Loading indicator element not found');
    }
}

// Показываем индикатор загрузки
function showLoadingIndicator(message = 'Loading game...') {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.textContent = message;
        indicator.classList.remove('hidden');
    }
}

// Функция инициализации игры
async function initializeGame() {
    console.log('initializeGame() called');

    try {
        // Проверяем, что DOM готов
        if (document.readyState === 'loading') {
            console.log('Waiting for DOM to load...');
            await new Promise(resolve => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', resolve);
                } else {
                    resolve();
                }
            });
        }

        console.log('DOM is ready, initializing game...');

        // Проверяем наличие необходимых элементов
        const gameBoard = document.getElementById('gameBoard');
        if (!gameBoard) {
            throw new Error('gameBoard element not found');
        }
        console.log('gameBoard element found');

        // Проверяем наличие ethers.js (но не блокируем игру, если его нет)
        if (typeof ethers === 'undefined') {
            console.warn('ethers.js not loaded - wallet connection will be unavailable');
            // Пытаемся подождать еще немного для загрузки ethers.js
            await new Promise(resolve => setTimeout(resolve, 500));
            if (typeof ethers === 'undefined') {
                console.warn('ethers.js still not loaded - wallet features disabled');
            }
        } else {
            console.log('ethers.js loaded successfully');
        }

        // Инициализируем игру
        game = new MatchThreePro();
        console.log('MatchThreePro instance created');

        window.game = game; // Сохраняем в window для доступа из WalletManager
        await game.init();
        console.log('Game initialized successfully');

        // Скрываем индикатор загрузки
        hideLoadingIndicator();

        // Убеждаемся что контент виден после инициализации
        const gameWrapper = document.querySelector('.game-wrapper');
        if (gameWrapper) {
            gameWrapper.style.display = 'block';
            gameWrapper.style.visibility = 'visible';
            gameWrapper.style.opacity = '1';
        }

        // По умолчанию скрываем игровой контейнер, показываем меню
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }

        // SDK ready() уже вызван в начале загрузки (index.html/script.js)
        // Дополнительный вызов не требуется
        console.log('Game initialized, SDK ready status:', window.__farcasterSDKReady ? 'READY' : 'not available');

    } catch (error) {
        console.error('Error initializing game:', error);
        console.error('Error stack:', error.stack);

        // Скрываем индикатор загрузки даже при ошибке
        hideLoadingIndicator();

        // Убеждаемся что контент виден даже при ошибке
        const gameWrapper = document.querySelector('.game-wrapper');
        if (gameWrapper) {
            gameWrapper.style.display = 'block';
            gameWrapper.style.visibility = 'visible';
            gameWrapper.style.opacity = '1';
        }

        // Скрываем игровой контейнер при ошибке, показываем меню
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }
        
        // Показываем меню при ошибке
        const startMenu = document.getElementById('startMenu');
        if (startMenu) {
            startMenu.style.display = 'flex';
        }

        // Показываем ошибку пользователю
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.innerHTML = `<div style="color: white; padding: 20px; text-align: center; background: rgba(255,0,0,0.2); border-radius: 10px;">
                <h3>Error loading game</h3>
                <p>Please refresh the page.</p>
                <p style="font-size: 0.8em; color: #999; margin-top: 10px;">${error.message}</p>
            </div>`;
        }
    }
}

// Инициализируем стартовое меню сразу при загрузке DOM
(function initMenuEarly() {
    let menuInitialized = false;
    
    function initMenuWhenReady() {
        if (menuInitialized) {
            return;
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMenuWhenReady);
            return;
        }
        
        // Проверяем наличие элементов меню
        const startMenu = document.getElementById('startMenu');
        if (!startMenu) {
            // Элементы еще не загружены, ждем немного
            setTimeout(initMenuWhenReady, 50);
            return;
        }
        
        // Инициализируем меню сразу, не дожидаясь инициализации игры
        if (typeof initStartMenu === 'function') {
            initStartMenu();
            menuInitialized = true;
            console.log('Start menu initialized early');
        } else {
            // Если функция еще не определена, ждем немного и пробуем снова
            setTimeout(initMenuWhenReady, 100);
        }
    }
    
    // Пробуем инициализировать сразу, если DOM уже готов
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMenuWhenReady);
    } else {
        // DOM уже готов, но даем небольшую задержку для гарантии
        setTimeout(initMenuWhenReady, 10);
    }
})();

// Запускаем игру при загрузке DOM
// Используем несколько способов для максимальной совместимости
(function () {
    let initializationAttempted = false;

    function attemptInitialization() {
        if (initializationAttempted) {
            console.log('Initialization already attempted, skipping...');
            return;
        }
        initializationAttempted = true;
        console.log('Attempting game initialization...');
        initializeGame().catch(error => {
            console.error('Failed to initialize game:', error);

            // Скрываем индикатор загрузки
            hideLoadingIndicator();

            // Убеждаемся что контент виден даже при ошибке
            const gameWrapper = document.querySelector('.game-wrapper');
            if (gameWrapper) {
                gameWrapper.style.display = 'block';
                gameWrapper.style.visibility = 'visible';
                gameWrapper.style.opacity = '1';
            }

            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                gameContainer.style.display = 'block';
                gameContainer.style.visibility = 'visible';
                gameContainer.style.opacity = '1';
            }

            // Показываем сообщение об ошибке пользователю
            const gameBoard = document.getElementById('gameBoard');
            if (gameBoard) {
                gameBoard.innerHTML = `
                    <div style="color: white; padding: 20px; text-align: center; background: rgba(255,0,0,0.2); border-radius: 10px;">
                        <h3>Error loading game</h3>
                        <p>Please refresh the page.</p>
                        <p style="font-size: 0.8em; color: #999; margin-top: 10px;">${error.message || 'Unknown error'}</p>
                    </div>
                `;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptInitialization);
        // Также слушаем load событие на всякий случай
        window.addEventListener('load', () => {
            if (!game && !initializationAttempted) {
                console.log('Game not initialized on DOMContentLoaded, trying on load event');
                attemptInitialization();
            }
        });
    } else if (document.readyState === 'interactive' || document.readyState === 'complete') {
        // DOM уже загружен
        attemptInitialization();
    } else {
        // Если состояние неизвестно, ждем DOMContentLoaded
        document.addEventListener('DOMContentLoaded', attemptInitialization);
    }

    // Fallback: если через 2 секунды игра не инициализирована, пытаемся еще раз
    setTimeout(() => {
        if (!game && !initializationAttempted) {
            console.warn('Game not initialized after 2 seconds, attempting initialization');
            attemptInitialization();
        }
    }, 2000);
})();
