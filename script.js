// НЕМЕДЛЕННОЕ ЛОГИРОВАНИЕ - должно выполниться первым
console.log('=== SCRIPT.JS STARTING ===');
console.log('Timestamp:', new Date().toISOString());

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
        this.updateWalletUI();
    }
    
    updateWalletUI() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const walletNetwork = document.getElementById('walletNetwork');
        
        if (this.account) {
            connectBtn.innerHTML = '<span>Disconnect</span>';
            connectBtn.classList.add('connected');
            
            walletInfo.style.display = 'flex';
            walletAddress.textContent = `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
            
            const networkName = this.chainId === BASE_NETWORK.chainId ? 'Base' : 'Unknown';
            walletNetwork.textContent = `Network: ${networkName}`;
            walletNetwork.className = 'wallet-network ' + (this.chainId === BASE_NETWORK.chainId ? 'base-network' : 'wrong-network');
        } else {
            connectBtn.innerHTML = '<span class="btn-icon">🔗</span><span>Connect Wallet</span>';
            connectBtn.classList.remove('connected');
            walletInfo.style.display = 'none';
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
        this.loadLeaderboard();
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
    
    loadLeaderboard() {
        const saved = localStorage.getItem(this.storageKey);
        this.leaderboard = saved ? JSON.parse(saved) : [];
    }
    
    saveLeaderboard() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.leaderboard));
    }
    
    addResult(score, maxCombo, won) {
        const walletAddress = this.getPlayerIdentifier();
        
        if (!walletAddress) {
            // Если кошелек не подключен, не сохраняем результат
            return null;
        }
        
        const result = {
            id: Date.now() + Math.random(),
            walletAddress: walletAddress, // Используем адрес кошелька
            playerName: this.formatAddress(walletAddress), // Для обратной совместимости
            score: score,
            maxCombo: maxCombo,
            won: won,
            date: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        this.leaderboard.push(result);
        this.saveLeaderboard();
        
        return result;
    }
    
    getTopResults(limit = 10, filter = 'all') {
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
        this.leaderboard = [];
        this.saveLeaderboard();
    }
    
    getTotalPlayers() {
        // Уникальные адреса кошельков (поддерживаем оба формата)
        const uniqueAddresses = new Set(this.leaderboard.map(r => {
            return (r.walletAddress || r.playerName || '').toLowerCase();
        }).filter(addr => addr && addr !== 'guest'));
        return uniqueAddresses.size;
    }
    
    // Миграция старых данных: конвертируем playerName в walletAddress, если это валидный адрес
    migrateOldData() {
        let updated = false;
        this.leaderboard.forEach(result => {
            if (!result.walletAddress && result.playerName) {
                // Проверяем, является ли playerName валидным адресом Ethereum
                if (/^0x[a-fA-F0-9]{40}$/.test(result.playerName)) {
                    result.walletAddress = result.playerName.toLowerCase();
                    updated = true;
                }
            }
        });
        if (updated) {
            this.saveLeaderboard();
        }
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
    }
    
    async init() {
        try {
            console.log('Initializing game...');
            this.createBoard();
            console.log('Board created');
            this.render();
            console.log('Board rendered');
            this.setupEventListeners();
            console.log('Event listeners set up');
            this.setupGlobalDragHandlers();
            console.log('Global drag handlers set up');
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
        } catch (error) {
            console.error('Error in init():', error);
            throw error;
        }
    }
    
    updateWalletDisplay() {
        const playerNameDisplay = document.getElementById('currentPlayerName');
        if (playerNameDisplay) {
            if (this.walletManager.isConnected()) {
                const address = this.walletManager.getAccount();
                playerNameDisplay.textContent = this.leaderboard.formatAddress(address);
                playerNameDisplay.classList.add('wallet-address');
            } else {
                playerNameDisplay.textContent = 'Connect Wallet';
                playerNameDisplay.classList.remove('wallet-address');
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
                    match.forEach(({row, col}) => {
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
                match.forEach(({row, col}) => {
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
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = document.createElement('div');
                const cellData = this.board[row][col];
                let className = `cell type-${cellData.type}`;
                
                if (cellData.special) {
                    className += ` type-${cellData.special}`;
                }
                
                cell.className = className;
                cell.dataset.row = row;
                cell.dataset.col = col;
                
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
                
                // Добавляем обработчики для свайпов (touch и mouse)
                this.setupDragHandlers(cell, row, col);
                
                gameBoard.appendChild(cell);
            }
        }
        
        this.updateUI();
    }
    
    setupDragHandlers(cell, row, col) {
        // Touch события
        cell.addEventListener('touchstart', (e) => this.handleDragStart(e, row, col), { passive: false });
        cell.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
        cell.addEventListener('touchend', (e) => {
            // Находим ячейку под точкой касания
            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('cell')) {
                const targetRow = parseInt(target.dataset.row);
                const targetCol = parseInt(target.dataset.col);
                this.handleDragEnd(e, targetRow, targetCol);
            } else {
                this.handleDragCancel();
            }
        }, { passive: false });
        cell.addEventListener('touchcancel', () => this.handleDragCancel(), { passive: false });
        
        // Mouse события - только mousedown на ячейке
        cell.addEventListener('mousedown', (e) => this.handleDragStart(e, row, col));
        
        // Предотвращаем контекстное меню при долгом нажатии
        cell.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    setupGlobalDragHandlers() {
        // Глобальные обработчики для мыши (чтобы перетаскивание работало даже вне ячейки)
        document.addEventListener('mousemove', (e) => {
            if (this.dragStartCell && !this.isProcessing) {
                this.handleDragMove(e);
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (this.dragStartCell && !this.isProcessing) {
                // Находим ячейку под курсором
                const target = document.elementFromPoint(e.clientX, e.clientY);
                if (target && target.classList.contains('cell')) {
                    const row = parseInt(target.dataset.row);
                    const col = parseInt(target.dataset.col);
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
        
        this.dragStartCell = { row, col };
        this.isDragging = false;
        this.dragStartPos = this.getEventPos(e);
        this.selectedCell = { row, col };
        this.highlightCell(row, col, true);
        
        // Добавляем класс для визуальной обратной связи
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('dragging');
        }
        
        e.preventDefault();
    }
    
    handleDragMove(e) {
        if (!this.dragStartCell || this.isProcessing) return;
        
        const currentPos = this.getEventPos(e);
        const deltaX = Math.abs(currentPos.x - this.dragStartPos.x);
        const deltaY = Math.abs(currentPos.y - this.dragStartPos.y);
        const threshold = 10; // Минимальное расстояние для начала перетаскивания
        
        if (deltaX > threshold || deltaY > threshold) {
            if (!this.isDragging) {
                this.isDragging = true;
            }
            e.preventDefault();
        }
        
        // Для touch событий обрабатываем здесь
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
        const startCell = document.querySelector(`[data-row="${startRow}"][data-col="${startCol}"]`);
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
            const cell = document.querySelector(`[data-row="${this.dragStartCell.row}"][data-col="${this.dragStartCell.col}"]`);
            if (cell) {
                cell.classList.remove('dragging');
            }
            this.highlightCell(this.dragStartCell.row, this.dragStartCell.col, false);
        }
        this.resetDrag();
    }
    
    resetDrag() {
        // Убираем класс dragging со всех ячеек на всякий случай
        document.querySelectorAll('.cell.dragging').forEach(cell => {
            cell.classList.remove('dragging');
        });
        this.dragStartCell = null;
        this.isDragging = false;
        this.dragStartPos = null;
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
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.toggle('selected', highlight);
        }
    }
    
    async swapCells(row1, col1, row2, col2) {
        // Меняем местами сразу
        [this.board[row1][col1], this.board[row2][col2]] = 
        [this.board[row2][col2], this.board[row1][col1]];
        
        // Обновляем отображение
        this.render();
        
        const matches = this.findAllMatches();
        
        if (matches.length > 0) {
            this.moves--;
            this.selectedCell = null;
            this.combo = 1;
            await this.processMatches(matches);
        } else {
            // Возвращаем обратно
            await this.sleep(100);
            [this.board[row1][col1], this.board[row2][col2]] = 
            [this.board[row2][col2], this.board[row1][col1]];
            this.render();
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
        
        // Определяем специальные фигуры ПЕРЕД удалением
        const specialCells = [];
        matches.forEach(match => {
            if (match.length === 4) {
                const {row, col} = match[Math.floor(match.length / 2)];
                const isHorizontal = match.every(c => c.row === row);
                specialCells.push({ 
                    row, 
                    col, 
                    special: isHorizontal ? this.SPECIAL_TYPES.ROCKET_H : this.SPECIAL_TYPES.ROCKET_V 
                });
            } else if (match.length >= 5) {
                const {row, col} = match[Math.floor(match.length / 2)];
                specialCells.push({ row, col, special: this.SPECIAL_TYPES.BOMB });
            }
        });
        
        // Создаем специальные фигуры на доске и показываем их
        if (specialCells.length > 0) {
            specialCells.forEach(({row, col, special}) => {
                this.board[row][col].special = special;
            });
            this.render(); // Обновляем отображение для показа специальных фигур
            await this.sleep(150);
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
        
        // Анимация удаления
        matches.forEach(match => {
            match.forEach(({row, col}) => {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('matched');
                    this.createExplosionParticles(row, col);
                }
            });
        });
        
        await this.sleep(300);
        
        // Обрабатываем специальные фигуры
        const cellsToRemove = new Set();
        matches.forEach(match => {
            match.forEach(({row, col}) => {
                cellsToRemove.add(`${row}-${col}`);
            });
        });
        
        // Добавляем эффекты специальных фигур
        specialCells.forEach(({row, col, special}) => {
            const key = `${row}-${col}`;
            cellsToRemove.add(key);
            
            if (special === this.SPECIAL_TYPES.BOMB) {
                // Бомба взрывает область 3x3
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
                for (let c = 0; c < this.boardSize; c++) {
                    cellsToRemove.add(`${row}-${c}`);
                    if (c !== col) {
                        setTimeout(() => this.createExplosionParticles(row, c), 50 * Math.abs(c - col));
                    }
                }
            } else if (special === this.SPECIAL_TYPES.ROCKET_V) {
                // Вертикальная ракета удаляет весь столбец
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
        
        this.render();
        
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
        for (let col = 0; col < this.boardSize; col++) {
            let writeIndex = this.boardSize - 1;
            
            for (let row = this.boardSize - 1; row >= 0; row--) {
                if (this.board[row][col].type !== -1) {
                    if (writeIndex !== row) {
                        this.board[writeIndex][col] = { ...this.board[row][col] };
                        this.board[row][col] = { type: -1, special: null };
                        
                        // Анимация падения
                        const cell = document.querySelector(`[data-row="${writeIndex}"][data-col="${col}"]`);
                        if (cell) {
                            cell.classList.add('falling');
                        }
                    }
                    writeIndex--;
                }
            }
        }
        
        await this.sleep(200);
    }
    
    fillEmptySpaces() {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col].type === -1) {
                    this.board[row][col] = { type: this.getRandomType(), special: null };
                }
            }
        }
    }
    
    showCombo(combo) {
        const comboDisplay = document.getElementById('comboDisplay');
        comboDisplay.textContent = `COMBO x${combo}!`;
        comboDisplay.classList.add('show');
        
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
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return;
        
        const rect = cell.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle explosion';
            particle.style.left = centerX + 'px';
            particle.style.top = centerY + 'px';
            
            const angle = (Math.PI * 2 * i) / 12;
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
        for (let i = 0; i < 20; i++) {
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
    
    endGame(won) {
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
            
            modal.classList.add('show');
            return;
        }
        
        // Сохраняем результат в лидерборд
        const savedResult = this.leaderboard.addResult(this.score, this.maxCombo, won);
        
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const finalScore = document.getElementById('finalScore');
        const finalCombo = document.getElementById('finalCombo');
        
        finalScore.textContent = this.score.toLocaleString();
        finalCombo.textContent = this.maxCombo;
        
        // Проверяем, попал ли результат в топ
        const currentAddress = this.walletManager.getAccount().toLowerCase();
        const topResults = this.leaderboard.getTopResults(10);
        const isTopResult = savedResult && topResults.some(r => {
            const resultAddress = (r.walletAddress || r.playerName || '').toLowerCase();
            return r.score === this.score && 
                   resultAddress === currentAddress &&
                   Math.abs(new Date(r.date) - new Date()) < 1000;
        });
        
        if (won) {
            title.textContent = 'Congratulations!';
            message.textContent = isTopResult 
                ? 'You reached the level goal and set a new high score! 🏆' 
                : 'You reached the level goal! Great game!';
        } else {
            title.textContent = 'Game Over!';
            message.textContent = `You needed ${(this.targetScore - this.score).toLocaleString()} more points. Try again!`;
            if (isTopResult) {
                message.textContent += ' Great score! 🎯';
            }
        }
        
        modal.classList.add('show');
    }
    
    showLeaderboard(filter = 'all') {
        const modal = document.getElementById('leaderboardModal');
        const list = document.getElementById('leaderboardList');
        const totalPlayers = document.getElementById('totalPlayers');
        const totalGames = document.getElementById('totalGames');
        
        // Обновляем активную вкладку
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === filter);
        });
        
        // Получаем топ результаты
        const topResults = this.leaderboard.getTopResults(20, filter);
        
        // Отображаем статистику
        totalPlayers.textContent = this.leaderboard.getTotalPlayers();
        totalGames.textContent = this.leaderboard.leaderboard.length;
        
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
        
        modal.classList.add('show');
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
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.newGame());
        }
        
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.newGame());
        }
        
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => this.findHint());
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
        
        // Вкладки лидерборда
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.tab;
                if (typeof this.showLeaderboard === 'function') {
                    this.showLeaderboard(filter);
                }
            });
        });
        
        // Очистка лидерборда
        const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');
        if (clearLeaderboardBtn) {
            clearLeaderboardBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all leaderboard data? This cannot be undone.')) {
                    if (this.leaderboard && typeof this.leaderboard.clearLeaderboard === 'function') {
                        this.leaderboard.clearLeaderboard();
                        this.showLeaderboard('all');
                    }
                }
            });
        }
        
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
            connectWalletBtn.addEventListener('click', async () => {
                if (this.walletManager.isConnected()) {
                    if (confirm('Disconnect wallet?')) {
                        this.walletManager.disconnect();
                        if (typeof this.updateWalletDisplay === 'function') {
                            this.updateWalletDisplay();
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
            });
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
        // Пытаемся загрузить SDK асинхронно (не блокируем игру)
        (async () => {
            try {
                // В Base app SDK должен быть доступен автоматически через глобальные объекты
                // Проверяем различные способы доступа
                let sdkInstance = null;
                
                // Способ 1: через window.farcaster (если доступен)
                if (window.farcaster && window.farcaster.miniapp) {
                    sdkInstance = window.farcaster.miniapp;
                }
                // Способ 2: через window.miniappSdk
                else if (window.miniappSdk) {
                    sdkInstance = window.miniappSdk.sdk || window.miniappSdk;
                }
                // Способ 3: через window.farcaster.miniapp (альтернативный путь)
                else if (window.farcaster && window.farcaster.miniapp) {
                    sdkInstance = window.farcaster.miniapp;
                }
                
                if (sdkInstance && sdkInstance.actions && sdkInstance.actions.ready) {
                    sdk = sdkInstance;
                    await sdk.actions.ready();
                    console.log('MiniApp SDK ready');
                } else {
                    console.log('MiniApp SDK not found - game will work without it');
                    // В Base app SDK должен быть доступен автоматически, но если его нет - игра все равно работает
                }
            } catch (error) {
                // SDK недоступен (приложение запущено вне Base app)
                console.log('MiniApp SDK initialization failed:', error.message);
                // Игра должна работать и без SDK
            }
        })();
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

// Скрываем индикатор загрузки после инициализации
function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

// Функция инициализации игры
async function initializeGame() {
    console.log('initializeGame() called');
    
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
    console.log('ethers available:', typeof ethers !== 'undefined');
    
    try {
        // Проверяем наличие необходимых элементов
        const gameBoard = document.getElementById('gameBoard');
        if (!gameBoard) {
            throw new Error('gameBoard element not found');
        }
        console.log('gameBoard element found');
        
        game = new MatchThreePro();
        console.log('MatchThreePro instance created');
        
        window.game = game; // Сохраняем в window для доступа из WalletManager
        await game.init();
        console.log('Game initialized successfully');
        
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
    } catch (error) {
        console.error('Error initializing game:', error);
        console.error('Error stack:', error.stack);
        
        // Показываем ошибку пользователю
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.innerHTML = `<div style="color: white; padding: 20px; text-align: center; background: rgba(255,0,0,0.2); border-radius: 10px;">
                <h3>Error loading game</h3>
                <p>Please refresh the page.</p>
                <p style="font-size: 0.8em; color: #999; margin-top: 10px;">${error.message}</p>
                <pre style="font-size: 0.7em; color: #666; text-align: left; margin-top: 10px; overflow: auto;">${error.stack}</pre>
            </div>`;
        }
        
        // Пытаемся вызвать ready() для SDK через глобальные объекты
        try {
            if (window.farcaster && window.farcaster.miniapp && window.farcaster.miniapp.actions) {
                await window.farcaster.miniapp.actions.ready();
            } else if (window.miniappSdk && window.miniappSdk.actions) {
                await window.miniappSdk.actions.ready();
            }
        } catch (sdkError) {
            console.log('SDK ready call failed:', sdkError);
        }
    }
}

// Запускаем игру при загрузке DOM
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOM уже загружен
    initializeGame();
}
