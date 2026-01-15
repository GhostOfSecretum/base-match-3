// MiniApp SDK будет загружен динамически
let sdk = null;

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
        
        // Загружаем и инициализируем MiniApp SDK
        try {
            const sdkModule = await import('@farcaster/miniapp-sdk');
            sdk = sdkModule.sdk;
            // Уведомляем Base app, что приложение готово
            await sdk.actions.ready();
        } catch (error) {
            // SDK недоступен (приложение запущено вне Base app)
            console.log('MiniApp SDK not available (running outside Base app)');
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
        const modal = document.getElementById('gameOverModal');
        const title = document.getElementById('gameOverTitle');
        const message = document.getElementById('gameOverMessage');
        const finalScore = document.getElementById('finalScore');
        const finalCombo = document.getElementById('finalCombo');
        
        finalScore.textContent = this.score.toLocaleString();
        finalCombo.textContent = this.maxCombo;
        
        if (won) {
            title.textContent = 'Congratulations!';
            message.textContent = 'You reached the level goal! Great game!';
        } else {
            title.textContent = 'Game Over!';
            message.textContent = `You needed ${(this.targetScore - this.score).toLocaleString()} more points. Try again!`;
        }
        
        modal.classList.add('show');
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
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.newGame());
        document.getElementById('hintBtn').addEventListener('click', () => this.findHint());
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запускаем игру
let game;

window.addEventListener('DOMContentLoaded', async () => {
    game = new MatchThreePro();
    await game.init();
});
