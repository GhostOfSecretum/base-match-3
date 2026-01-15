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
    
    checkSavedConnection() {
        const saved = localStorage.getItem('walletConnected');
        if (saved === 'true' && window.ethereum) {
            this.connect();
        }
    }
    
    async connect() {
        try {
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
            connectBtn.innerHTML = '<span class="btn-icon">🔌</span><span>Disconnect</span>';
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
        this.boardSize = 8;
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
    }
    
    async init() {
        this.createBoard();
        this.render();
        this.setupEventListeners();
        this.removeInitialMatches();
        this.createParticles();
        this.updateUI();
        
        // Обновляем отображение кошелька, если элементы существуют
        if (typeof this.updateWalletDisplay === 'function') {
            try {
                this.updateWalletDisplay();
            } catch (e) {
                // Игнорируем ошибки, если элементы не найдены
            }
        }
        
        // Загружаем и инициализируем MiniApp SDK (не блокируем запуск игры)
        try {
            const sdkModule = await import('@farcaster/miniapp-sdk');
            sdk = sdkModule.sdk;
            // Уведомляем Base app, что приложение готово
            await sdk.actions.ready();
        } catch (error) {
            // SDK недоступен (приложение запущено вне Base app)
            console.log('MiniApp SDK not available (running outside Base app):', error.message);
            // Игра должна работать и без SDK
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
                this.board[row][col] = { type: this.getRandomType(), special: null };
            }
        }
    }
    
    getRandomType() {
        return Math.floor(Math.random() * this.numTypes);
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
        while (hasMatches && attempts < 100) {
            const matches = this.findAllMatches();
            if (matches.length === 0) {
                hasMatches = false;
            } else {
                matches.forEach(match => {
                    match.forEach(({row, col}) => {
                        this.board[row][col] = { type: this.getRandomType(), special: null };
                    });
                });
            }
            attempts++;
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
                cell.addEventListener('click', () => this.handleCellClick(row, col));
                gameBoard.appendChild(cell);
            }
        }
        
        this.updateUI();
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
        
        // Подсчитываем очки с учетом комбо
        let totalMatched = 0;
        matches.forEach(match => {
            totalMatched += match.length;
        });
        
        const baseScore = totalMatched * 10;
        const comboMultiplier = Math.min(this.combo, 5);
        const scoreGain = baseScore * comboMultiplier;
        this.score += scoreGain;
        
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
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запускаем игру
let game;

window.addEventListener('DOMContentLoaded', async () => {
    game = new MatchThreePro();
    window.game = game; // Сохраняем в window для доступа из WalletManager
    await game.init();
});
