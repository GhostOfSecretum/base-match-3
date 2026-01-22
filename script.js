// НЕМЕДЛЕННОЕ ЛОГИРОВАНИЕ - должно выполниться первым
console.log('=== SCRIPT.JS STARTING ===');
console.log('Timestamp:', new Date().toISOString());

// ==================== SPLASH SCREEN MANAGER ====================
const SplashScreenManager = {
    splashScreen: null,
    progressBar: null,
    progress: 0,
    minDisplayTime: 2500, // Минимум 2.5 секунды показа
    startTime: Date.now(),
    progressInterval: null,
    
    init() {
        this.splashScreen = document.getElementById('splashScreen');
        this.progressBar = document.getElementById('loaderProgress');
        
        if (!this.splashScreen) {
            console.log('Splash screen not found');
            return;
        }
        
        // Запускаем анимацию прогресса
        this.startProgressAnimation();
        console.log('Splash screen initialized');
    },
    
    startProgressAnimation() {
        // Плавная анимация прогресса до 90%
        this.progressInterval = setInterval(() => {
            if (this.progress < 90) {
                this.progress += Math.random() * 8 + 2; // +2-10% каждые 100мс
                if (this.progress > 90) this.progress = 90;
                this.updateProgress(this.progress);
            }
        }, 100);
    },
    
    updateProgress(value) {
        const percent = Math.min(100, Math.round(value));
        if (this.progressBar) {
            this.progressBar.style.width = percent + '%';
        }
    },
    
    hide() {
        if (!this.splashScreen) {
            this.splashScreen = document.getElementById('splashScreen');
        }
        
        if (!this.splashScreen) return;
        
        // Останавливаем интервал
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        // Быстро доводим до 100%
        this.updateProgress(100);
        
        const elapsed = Date.now() - this.startTime;
        const remainingTime = Math.max(300, this.minDisplayTime - elapsed);
        
        // Ждем минимальное время отображения для плавности
        setTimeout(() => {
            this.splashScreen.classList.add('hidden');
            console.log('Splash screen hidden');
            
            // После скрытия splash screen показываем onboarding (если нужно)
            setTimeout(() => {
                console.log('SplashScreenManager: showing next screen');
                
                // Проверяем, не запущена ли уже игра (пользователь мог нажать New Game)
                const gameContainer = document.getElementById('gameContainer');
                const startMenu = document.getElementById('startMenu');
                
                // Скрываем gameContainer ТОЛЬКО если игра еще не запущена (меню видно)
                // Это предотвращает баг, когда splash screen скрывает уже запущенную игру
                if (gameContainer && startMenu && startMenu.style.display !== 'none') {
                    gameContainer.style.display = 'none';
                    console.log('gameContainer hidden (game not started yet)');
                } else {
                    console.log('gameContainer NOT hidden (game already running or menu hidden)');
                }
                
                // Показываем onboarding если нужно (он перекроет меню своим z-index)
                if (typeof OnboardingManager !== 'undefined' && OnboardingManager.shouldShow()) {
                    console.log('Showing onboarding');
                    OnboardingManager.show();
                } else {
                    // Меню уже видно по умолчанию
                    console.log('Menu already visible');
                }
            }, 100);
            
            // Удаляем элемент после анимации
            setTimeout(() => {
                if (this.splashScreen && this.splashScreen.parentNode) {
                    this.splashScreen.parentNode.removeChild(this.splashScreen);
                    console.log('Splash screen removed from DOM');
                }
            }, 600);
        }, remainingTime);
    }
};

// Инициализируем splash screen manager
SplashScreenManager.init();

// Fallback: гарантированно скрыть splash через 6 секунд
setTimeout(() => {
    SplashScreenManager.hide();
}, 6000);
// ==================== END SPLASH SCREEN MANAGER ====================

// ==================== ONBOARDING SCREEN MANAGER ====================
const OnboardingManager = {
    screen: null,
    slides: null,
    dots: null,
    nextBtn: null,
    skipBtn: null,
    currentSlide: 0,
    totalSlides: 2,
    storageKey: 'onboarding_completed',
    
    init() {
        this.screen = document.getElementById('onboardingScreen');
        this.slides = document.querySelectorAll('.onboarding-slide');
        this.dots = document.querySelectorAll('.onboarding-dot');
        this.nextBtn = document.getElementById('onboardingNextBtn');
        this.skipBtn = document.getElementById('onboardingSkipBtn');
        
        if (!this.screen) {
            console.log('Onboarding screen not found');
            return;
        }
        
        this.totalSlides = this.slides.length;
        this.setupEventListeners();
        console.log('Onboarding manager initialized');
    },
    
    setupEventListeners() {
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.handleNext());
        }
        
        if (this.skipBtn) {
            this.skipBtn.addEventListener('click', () => this.complete());
        }
        
        // Dots navigation
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToSlide(index));
        });
        
        // Swipe support for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        if (this.screen) {
            this.screen.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            
            this.screen.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe(touchStartX, touchEndX);
            }, { passive: true });
        }
    },
    
    handleSwipe(startX, endX) {
        const threshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe left - next
                this.handleNext();
            } else {
                // Swipe right - previous
                this.goToSlide(Math.max(0, this.currentSlide - 1));
            }
        }
    },
    
    handleNext() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.goToSlide(this.currentSlide + 1);
        } else {
            this.complete();
        }
    },
    
    goToSlide(index) {
        if (index < 0 || index >= this.totalSlides) return;
        
        // Update slides
        this.slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (i === index) {
                slide.classList.add('active');
            }
        });
        
        // Update dots
        this.dots.forEach((dot, i) => {
            dot.classList.remove('active');
            if (i === index) {
                dot.classList.add('active');
            }
        });
        
        // Update button text on last slide
        if (this.nextBtn) {
            if (index === this.totalSlides - 1) {
                this.nextBtn.textContent = 'Get Started';
            } else {
                this.nextBtn.textContent = 'Next';
            }
        }
        
        this.currentSlide = index;
    },
    
    shouldShow() {
        // Показываем onboarding при каждом запуске
        return true;
    },
    
    show() {
        if (!this.screen) {
            this.init();
        }
        
        if (this.screen && this.shouldShow()) {
            this.screen.style.display = 'flex';
            this.currentSlide = 0;
            this.goToSlide(0);
            console.log('Onboarding screen shown');
            return true;
        }
        
        return false;
    },
    
    complete() {
        // Просто скрываем onboarding (показывается при каждом запуске)
        this.hide();
    },
    
    hide() {
        console.log('OnboardingManager.hide() called');
        if (this.screen) {
            // Скрываем onboarding - меню уже видно под ним
            this.screen.classList.add('hidden');
            this.screen.style.display = 'none';
            console.log('Onboarding screen hidden, menu should be visible now');
            
            // Скрываем gameContainer ТОЛЬКО если игра еще не запущена
            const gameContainer = document.getElementById('gameContainer');
            const startMenu = document.getElementById('startMenu');
            if (gameContainer && startMenu && startMenu.style.display !== 'none') {
                gameContainer.style.display = 'none';
                console.log('gameContainer hidden from onboarding (game not started)');
            }
        }
    }
};

// Initialize onboarding manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OnboardingManager.init());
} else {
    OnboardingManager.init();
}
// ==================== END ONBOARDING SCREEN MANAGER ====================

// Debug функция для отображения на телефоне
function debugLog(msg) {
    const time = new Date().toLocaleTimeString();
    if (!window.__debugLogs) window.__debugLogs = [];
    window.__debugLogs.push(`[${time}] ${msg}`);
    console.log(msg);
}

// Ранняя инициализация темы для предотвращения мерцания
(function initThemeEarly() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light' && document.body) {
            document.body.classList.add('light-theme');
        }
    } catch (e) {
        console.log('Theme initialization error (non-critical):', e.message);
    }
})();

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

// ==================== GM CONTRACT CONFIGURATION ====================
// Smart contract for gasless GM transactions on Base
const GM_CONTRACT = {
    address: '0x56Fa8D9d0Ba5C17350163D8F632f734996F4944A',
    chainId: '0x2105', // Base mainnet
    // Function selector for sayGM() = keccak256("sayGM()")[:4] = 0x41cf91d1
    sayGMSelector: '0x41cf91d1',
    // ABI for the contract
    abi: [
        {
            "inputs": [],
            "name": "sayGM",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"name": "user", "type": "address"}],
            "name": "getGMData",
            "outputs": [
                {"name": "lastTimestamp", "type": "uint256"},
                {"name": "streak", "type": "uint256"}
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

// ==================== SPONSORED TRANSACTIONS MANAGER ====================
// Handles gasless transactions via Coinbase CDP Paymaster and Farcaster Frame SDK

const SponsoredTransactions = {
    // Configuration
    paymasterApiUrl: '/api/paymaster',
    isEnabled: true,
    lastCheckTime: 0,
    checkInterval: 60000, // Check eligibility every 60 seconds
    isEligible: null,
    lastError: null,
    
    /**
     * Get Farcaster SDK instance
     */
    getFarcasterSDK() {
        // Check all possible locations for Farcaster SDK
        if (typeof window !== 'undefined') {
            // Farcaster Frame SDK v2 (new)
            if (window.sdk) return window.sdk;
            // Frame SDK via frame global
            if (typeof frame !== 'undefined' && frame.sdk) return frame.sdk;
            // Legacy locations
            if (window.__farcasterSDK) return window.__farcasterSDK;
            if (window.farcaster && window.farcaster.miniapp) return window.farcaster.miniapp;
        }
        return null;
    },
    
    /**
     * Check if we're running inside Farcaster Frame
     */
    isInFarcasterFrame() {
        if (typeof window === 'undefined') return false;
        
        // Check various indicators of Farcaster Frame environment
        const indicators = [
            window.sdk,
            typeof frame !== 'undefined' && frame.sdk,
            window.__farcasterSDK,
            window.farcaster,
            // Check if loaded in iframe (common for frames)
            window.parent !== window,
            // Check URL params that Farcaster adds
            new URLSearchParams(window.location.search).has('fid'),
            // Check for Farcaster-specific context
            document.referrer.includes('warpcast.com'),
            document.referrer.includes('farcaster')
        ];
        
        return indicators.some(indicator => !!indicator);
    },
    
    /**
     * Check if sponsorship is available
     */
    async checkSponsorshipAvailable() {
        // Cache the result for performance
        const now = Date.now();
        if (this.isEligible !== null && (now - this.lastCheckTime) < this.checkInterval) {
            return this.isEligible;
        }
        
        try {
            // First check if we're in Farcaster Frame - Farcaster sponsors transactions automatically
            if (this.isInFarcasterFrame()) {
                console.log('Running in Farcaster Frame - transactions are sponsored by Farcaster');
                this.isEligible = true;
                this.lastCheckTime = now;
                this.sponsorType = 'farcaster';
                return true;
            }
            
            // Check if Farcaster SDK is available
            const farcasterSDK = this.getFarcasterSDK();
            if (farcasterSDK) {
                console.log('Farcaster SDK detected - sponsorship available via Frame');
                this.isEligible = true;
                this.lastCheckTime = now;
                this.sponsorType = 'farcaster-sdk';
                return true;
            }
            
            // For non-Farcaster environments, check CDP Paymaster (optional)
            try {
                const response = await fetch(this.paymasterApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'checkSponsorshipEligibility' })
                });
                
                const data = await response.json();
                if (data.success && data.eligible && data.sponsored) {
                    this.isEligible = true;
                    this.lastCheckTime = now;
                    this.sponsorType = 'cdp-paymaster';
                    console.log('CDP Paymaster sponsorship available');
                    return true;
                }
                this.lastError = data.error || data.reason || null;
            } catch (e) {
                console.log('CDP Paymaster check failed:', e.message);
            }
            
            // No sponsorship available
            this.isEligible = false;
            this.lastCheckTime = now;
            this.sponsorType = null;
            console.log('No sponsorship available, will use regular transactions');
            return false;
            
        } catch (error) {
            console.log('Sponsorship check failed:', error.message);
            this.isEligible = false;
            this.lastCheckTime = now;
            this.lastError = error.message;
            return false;
        }
    },
    
    /**
     * Check if wallet supports EIP-5792 (wallet_sendCalls)
     */
    async checkWalletCapabilities(provider) {
        try {
            if (!provider) return { sponsored: false };
            
            // Try to get wallet capabilities
            const capabilities = await provider.request({
                method: 'wallet_getCapabilities',
                params: []
            });
            
            console.log('Wallet capabilities:', capabilities);
            
            // Check if paymaster is supported for Base (chainId 8453 or 0x2105)
            const baseCapabilities = capabilities?.['8453'] || capabilities?.['0x2105'] || capabilities?.['eip155:8453'];
            
            if (baseCapabilities?.paymasterService?.supported) {
                return {
                    sponsored: true,
                    paymasterService: true,
                    atomicBatch: baseCapabilities?.atomicBatch?.supported || false
                };
            }
            
            return { sponsored: false };
            
        } catch (error) {
            // wallet_getCapabilities not supported - fallback to regular transactions
            console.log('Wallet capabilities not available:', error.message);
            return { sponsored: false };
        }
    },
    
    /**
     * Send a sponsored transaction using wallet_sendCalls (EIP-5792)
     * This is the preferred method for modern Smart Wallets on Base
     */
    async sendSponsoredCalls(provider, calls, userAddress) {
        try {
            // Build calls array in EIP-5792 format
            const formattedCalls = calls.map(call => ({
                to: call.to || undefined, // undefined for contract deployment
                value: call.value || '0x0',
                data: call.data || '0x'
            }));
            
            console.log('sendSponsoredCalls: Using wallet built-in paymaster');
            console.log('Calls:', JSON.stringify(formattedCalls));
            
            let result;
            let lastError = null;
            
            // Try multiple formats for wallet_sendCalls
            // Format 1: Request sponsorship via paymasterService: true
            try {
                console.log('Trying: wallet_sendCalls with paymasterService: true');
                result = await provider.request({
                    method: 'wallet_sendCalls',
                    params: [{
                        version: '1.0',
                        chainId: '0x2105',
                        from: userAddress,
                        calls: formattedCalls,
                        capabilities: {
                            paymasterService: true
                        }
                    }]
                });
                console.log('Success with paymasterService: true');
            } catch (err1) {
                console.log('paymasterService: true failed:', err1.message);
                lastError = err1;
                
                // Format 2: Without capabilities (wallet decides)
                try {
                    console.log('Trying: wallet_sendCalls without capabilities');
                    result = await provider.request({
                        method: 'wallet_sendCalls',
                        params: [{
                            version: '1.0',
                            chainId: '0x2105',
                            from: userAddress,
                            calls: formattedCalls
                        }]
                    });
                    console.log('Success without capabilities');
                } catch (err2) {
                    console.log('Without capabilities failed:', err2.message);
                    throw lastError;
                }
            }
            
            console.log('wallet_sendCalls result:', result);
            
            // Result format varies by wallet:
            // - Smart Wallets may return a bundle ID that needs to be polled
            // - Some wallets return transaction hash directly
            let txHash = null;
            
            if (typeof result === 'string') {
                // Could be bundle ID or tx hash
                if (result.startsWith('0x') && result.length === 66) {
                    txHash = result; // Transaction hash
                } else {
                    // Bundle ID - need to poll for status
                    txHash = await this.waitForBundleReceipt(provider, result);
                }
            } else if (result?.receipts?.[0]?.transactionHash) {
                txHash = result.receipts[0].transactionHash;
            } else if (result?.hash) {
                txHash = result.hash;
            }
            
            return {
                success: true,
                sponsored: true,
                result: result,
                txHash: txHash
            };
            
        } catch (error) {
            console.error('Sponsored calls failed:', error);
            throw error;
        }
    },
    
    /**
     * Wait for bundle receipt (for Smart Wallet transactions)
     */
    async waitForBundleReceipt(provider, bundleId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const status = await provider.request({
                    method: 'wallet_getCallsStatus',
                    params: [bundleId]
                });
                
                console.log(`Bundle status (attempt ${i + 1}):`, status);
                
                if (status?.status === 'CONFIRMED' || status?.status === 'confirmed') {
                    return status.receipts?.[0]?.transactionHash || status.hash;
                }
                
                if (status?.status === 'FAILED' || status?.status === 'failed') {
                    throw new Error('Transaction bundle failed');
                }
                
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                if (i === maxAttempts - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error('Timeout waiting for bundle receipt');
    },
    
    /**
     * Send transaction via Base Mini App - user pays gas (no sponsorship)
     */
    async sendViaFarcasterSDK(txParams, statusCallback) {
        const log = (msg) => {
            console.log('[TX]', msg);
            if (window.DebugLogger) {
                window.DebugLogger.logGM(msg);
                window.DebugLogger.logDeploy(msg);
            }
        };
        
        log('=== sendTransaction (user pays gas) ===');
        if (statusCallback) statusCallback('Connecting to wallet...');
        
        // Get Ethereum provider
        let ethProvider = null;
        const farcasterSDK = this.getFarcasterSDK();
        
        if (farcasterSDK?.wallet?.ethProvider) {
            ethProvider = farcasterSDK.wallet.ethProvider;
            log('Using sdk.wallet.ethProvider');
        } else if (farcasterSDK?.wallet?.getEthereumProvider) {
            ethProvider = await farcasterSDK.wallet.getEthereumProvider();
            log('Using sdk.wallet.getEthereumProvider()');
        } else if (window.ethereum) {
            ethProvider = window.ethereum;
            log('Using window.ethereum');
        }
        
        if (!ethProvider) {
            log('ERROR: No Ethereum provider available');
            throw new Error('No wallet found. Please connect your wallet.');
        }
        
        // Get accounts
        let fromAddress = txParams.from;
        if (!fromAddress) {
            try {
                const accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
                fromAddress = accounts?.[0];
                log(`Got account: ${fromAddress}`);
            } catch (e) {
                log(`eth_requestAccounts error: ${e.message}`);
                throw new Error('Please connect your wallet first.');
            }
        }
        
        if (!fromAddress) {
            throw new Error('No wallet address available.');
        }
        
        // Send transaction - user pays gas
        if (statusCallback) statusCallback('Please confirm transaction...');
        
        const txRequest = {
            from: fromAddress,
            to: txParams.to,
            value: txParams.value || '0x0',
            data: txParams.data || '0x'
        };
        
        log(`TX Request: ${JSON.stringify(txRequest)}`);
        
        try {
            const txHash = await ethProvider.request({
                method: 'eth_sendTransaction',
                params: [txRequest]
            });
            
            log(`SUCCESS! TX Hash: ${txHash}`);
            
            return {
                success: true,
                sponsored: false, // User paid gas
                txHash: txHash
            };
        } catch (txError) {
            log(`eth_sendTransaction ERROR: ${txError.message}`);
            
            // User-friendly error messages
            if (txError.message?.includes('reject') || txError.message?.includes('denied')) {
                throw new Error('Transaction cancelled.');
            } else if (txError.message?.includes('insufficient')) {
                throw new Error('Insufficient ETH for gas. Please add ETH to your wallet.');
            } else {
                throw new Error('Transaction failed: ' + txError.message);
            }
        }
    },
    
    /**
     * Send a sponsored transaction using UserOperation (ERC-4337)
     * Fallback for wallets that don't support EIP-5792
     */
    async sendSponsoredUserOp(provider, txParams, userAddress) {
        try {
            // Build basic UserOperation structure
            const userOp = {
                sender: userAddress,
                nonce: '0x0', // Will be filled by bundler
                initCode: '0x',
                callData: this.encodeCallData(txParams),
                callGasLimit: '0x0',
                verificationGasLimit: '0x0',
                preVerificationGas: '0x0',
                maxFeePerGas: '0x0',
                maxPriorityFeePerGas: '0x0',
                paymasterAndData: '0x',
                signature: '0x'
            };
            
            // Get paymaster data from our API
            const paymasterResponse = await fetch(this.paymasterApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sponsorUserOperation',
                    userOp: userOp
                })
            });
            
            const paymasterData = await paymasterResponse.json();
            
            if (!paymasterData.success || !paymasterData.sponsored) {
                throw new Error('Paymaster sponsorship unavailable');
            }
            
            // Update userOp with paymaster data
            userOp.paymasterAndData = paymasterData.paymasterAndData;
            
            // For this simplified version, we'll use eth_sendTransaction with the paymaster handling gas
            // In a full implementation, you'd use a bundler to submit the UserOperation
            
            return {
                success: true,
                sponsored: true,
                userOp: userOp
            };
            
        } catch (error) {
            console.error('Sponsored UserOp failed:', error);
            throw error;
        }
    },
    
    /**
     * Encode call data for UserOperation
     */
    encodeCallData(txParams) {
        // For simple ETH transfers, callData is empty
        if (!txParams.data || txParams.data === '0x') {
            return '0x';
        }
        return txParams.data;
    },
    
    /**
     * Main function to send a transaction (user pays gas)
     */
    async sendTransaction(provider, txParams, userAddress, statusCallback) {
        console.log('=== sendTransaction (user pays gas) ===');
        console.log('txParams:', txParams);
        console.log('userAddress:', userAddress);
        
        // Use sendViaFarcasterSDK which now does simple eth_sendTransaction
        return await this.sendViaFarcasterSDK({
            ...txParams,
            from: userAddress
        }, statusCallback);
    },
    
    /**
     * Get UI badge for transactions
     */
    getSponsoredBadge() {
        return '<span class="sponsored-badge" title="User pays gas fees">Paid</span>';
    },
    
    /**
     * Update UI indicators - transactions are now paid by user
     */
    updateUIIndicators() {
        const gmIndicator = document.getElementById('gmGaslessIndicator');
        const deployIndicator = document.getElementById('deployGaslessIndicator');
        const gmButton = document.getElementById('gmButton');
        const deployBtn = document.getElementById('deployContractBtn');
        
        // Hide gasless indicators since transactions are now paid
        if (gmIndicator) {
            gmIndicator.style.display = 'none';
        }
        if (deployIndicator) {
            deployIndicator.style.display = 'none';
        }
        
        // Update button titles
        if (gmButton) {
            gmButton.title = 'Send GM transaction on Base (requires ETH for gas)';
        }
        if (deployBtn) {
            deployBtn.title = 'Deploy contract on Base (requires ETH for gas)';
        }
    },
    
    /**
     * Debug function to check status
     */
    async debugStatus() {
        console.log('=== SponsoredTransactions Debug ===');
        console.log('isEnabled:', this.isEnabled);
        console.log('isEligible:', this.isEligible);
        console.log('sponsorType:', this.sponsorType);
        console.log('lastError:', this.lastError);
        console.log('isInFarcasterFrame:', this.isInFarcasterFrame());
        console.log('Farcaster SDK:', this.getFarcasterSDK() ? 'Available' : 'Not found');
        console.log('window.parent !== window:', typeof window !== 'undefined' && window.parent !== window);
        console.log('document.referrer:', typeof document !== 'undefined' ? document.referrer : 'N/A');
        
        // Check API health
        try {
            const healthResponse = await fetch(this.paymasterApiUrl);
            const health = await healthResponse.json();
            console.log('Paymaster API health:', health);
        } catch (e) {
            console.log('Paymaster API health check failed:', e.message);
        }
        
        // Check eligibility
        const eligible = await this.checkSponsorshipAvailable();
        console.log('Sponsorship available:', eligible);
        console.log('Sponsor type:', this.sponsorType);
        
        const result = {
            isEnabled: this.isEnabled,
            isEligible: this.isEligible,
            sponsorType: this.sponsorType,
            lastError: this.lastError,
            isInFarcasterFrame: this.isInFarcasterFrame(),
            farcasterSDK: !!this.getFarcasterSDK()
        };
        
        console.log('Debug result:', result);
        return result;
    }
};

// Initialize sponsorship check on load
(async function initSponsorshipCheck() {
    // First immediate check for Farcaster environment
    setTimeout(() => {
        SponsoredTransactions.updateUIIndicators();
    }, 500);
    
    // Delay deeper check to not block initial load
    setTimeout(async () => {
        const isAvailable = await SponsoredTransactions.checkSponsorshipAvailable();
        SponsoredTransactions.updateUIIndicators();
        
        if (isAvailable) {
            console.log('✅ Gasless transactions available - Type:', SponsoredTransactions.sponsorType);
        } else {
            console.log('⚠️ Gasless transactions NOT available:', SponsoredTransactions.lastError || 'Regular transactions will be used');
        }
    }, 2000);
    
    // Also check when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => SponsoredTransactions.updateUIIndicators(), 1000);
            setTimeout(async () => {
                await SponsoredTransactions.checkSponsorshipAvailable();
                SponsoredTransactions.updateUIIndicators();
            }, 3000);
        });
    }
    
    // Re-check periodically in case SDK loads late
    setTimeout(async () => {
        await SponsoredTransactions.checkSponsorshipAvailable();
        SponsoredTransactions.updateUIIndicators();
    }, 5000);
})();

// Expose debug function globally
if (typeof window !== 'undefined') {
    window.debugSponsorship = () => SponsoredTransactions.debugStatus();
}

// ==================== END SPONSORED TRANSACTIONS MANAGER ====================

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
        // Пытаемся получить данные пользователя из Base/Farcaster Mini App SDK
        // Согласно документации: https://docs.base.org/mini-apps/features/context
        try {
            // Сначала проверяем, есть ли ранний контекст (из index.html)
            if (window.__farcasterContext && window.__farcasterContext.user) {
                console.log('Using early context from index.html');
                await this.processUserContext(window.__farcasterContext);
                return;
            }

            // Ждем немного для загрузки SDK
            await new Promise(resolve => setTimeout(resolve, 500));

            // Проверяем еще раз ранний контекст
            if (window.__farcasterContext && window.__farcasterContext.user) {
                console.log('Using early context from index.html (after delay)');
                await this.processUserContext(window.__farcasterContext);
                return;
            }

            let sdkInstance = null;
            let isInMiniApp = false;

            // Способ 1: frame.sdk (CDN версия @farcaster/frame-sdk)
            if (typeof frame !== 'undefined' && frame.sdk) {
                sdkInstance = frame.sdk;
                console.log('Found frame.sdk');
            }

            // Способ 2: window.__farcasterSDK (сохраненный при инициализации)
            if (!sdkInstance && window.__farcasterSDK) {
                sdkInstance = window.__farcasterSDK;
                console.log('Found window.__farcasterSDK');
            }

            // Способ 3: window.farcaster.miniapp
            if (!sdkInstance && window.farcaster && window.farcaster.miniapp) {
                sdkInstance = window.farcaster.miniapp;
                console.log('Found window.farcaster.miniapp');
            }

            // Способ 4: window.miniappSdk
            if (!sdkInstance && window.miniappSdk) {
                sdkInstance = window.miniappSdk.sdk || window.miniappSdk;
                console.log('Found window.miniappSdk');
            }

            if (!sdkInstance) {
                console.log('No Mini App SDK found');
                return;
            }

            // Проверяем, находимся ли мы в Mini App
            try {
                if (typeof sdkInstance.isInMiniApp === 'function') {
                    isInMiniApp = await sdkInstance.isInMiniApp();
                } else {
                    // Если метода нет, проверяем по наличию context
                    isInMiniApp = !!(sdkInstance.context);
                }
                console.log('isInMiniApp:', isInMiniApp);
            } catch (e) {
                console.log('Could not check isInMiniApp:', e.message);
                isInMiniApp = true; // Предполагаем, что да
            }

            if (!isInMiniApp) {
                console.log('Not running in Mini App');
                return;
            }

            // Получаем контекст пользователя
            try {
                let context = null;

                // Пробуем разные способы получения контекста
                if (typeof sdkInstance.context === 'function') {
                    context = await sdkInstance.context();
                } else if (sdkInstance.context && typeof sdkInstance.context.get === 'function') {
                    context = await sdkInstance.context.get();
                } else if (sdkInstance.context && typeof sdkInstance.context.then === 'function') {
                    context = await sdkInstance.context;
                } else if (sdkInstance.context) {
                    context = sdkInstance.context;
                }

                if (context) {
                    await this.processUserContext(context);
                } else {
                    console.log('Could not get context from SDK');
                }
            } catch (e) {
                console.log('Could not get context from SDK:', e.message, e);
            }
        } catch (error) {
            console.log('Base Account initialization failed (non-critical):', error.message, error);
        }
    }

    async processUserContext(context) {
        // Обрабатываем контекст пользователя
        this.userContext = context;
        debugLog('🎮 Processing user context...');

        // Получаем данные пользователя из контекста
        // Согласно Product Guidelines: используем displayName, username, и pfpUrl
        if (context.user) {
            // Приоритет: displayName > username
            this.username = context.user.displayName || context.user.username || null;
            // Получаем аватар из pfpUrl
            this.avatar = context.user.pfpUrl || context.user.avatarUrl || null;

            debugLog(`👤 User found!`);
            debugLog(`  displayName: ${context.user.displayName || 'null'}`);
            debugLog(`  username: ${context.user.username || 'null'}`);
            debugLog(`  FINAL name: ${this.username || 'null'}`);
            debugLog(`  avatar: ${this.avatar ? 'YES' : 'NO'}`);
            debugLog(`  fid: ${context.user.fid || 'null'}`);

            // Если есть адрес в контексте, используем его
            const address = context.user.custodyAddress || 
                           context.user.verifiedAddresses?.ethAddresses?.[0] ||
                           context.user.account ||
                           context.connectedAddress;
            
            if (address) {
                debugLog(`  address: ${address.slice(0,10)}...`);
                if (!this.account) {
                    await this.connectViaBaseAccount(address);
                }
            } else {
                debugLog('  address: NOT FOUND');
            }

            // Обновляем UI
            if (window.game && typeof window.game.updateWalletDisplay === 'function') {
                setTimeout(() => window.game.updateWalletDisplay(), 100);
            }
        } else {
            debugLog('❌ No user in context');
        }
    }

    // Получить имя пользователя по адресу через Neynar API
    async fetchUsernameByAddress(address) {
        if (!address) return null;
        
        try {
            debugLog(`🔍 Fetching username for ${address.slice(0,10)}...`);
            
            // Пробуем Neynar API (публичный endpoint для lookup по адресу)
            const response = await fetch(`https://api.neynar.com/v2/farcaster/user/by_verification?address=${address}`, {
                headers: {
                    'accept': 'application/json',
                    'api_key': 'NEYNAR_API_DOCS' // Публичный ключ для документации
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                debugLog(`  Neynar response: ${JSON.stringify(data).slice(0,100)}`);
                
                if (data.user) {
                    const user = data.user;
                    this.username = user.display_name || user.username || null;
                    this.avatar = user.pfp_url || user.pfp?.url || null;
                    
                    debugLog(`  ✅ Got from Neynar: ${this.username}`);
                    debugLog(`  avatar: ${this.avatar ? 'YES' : 'NO'}`);
                    
                    return this.username;
                }
            } else {
                debugLog(`  Neynar error: ${response.status}`);
            }
        } catch (e) {
            debugLog(`  Neynar fetch error: ${e.message}`);
        }
        
        return null;
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

                    // Пытаемся получить username из SDK
                    await this.getUsernameFromSDK();
                    
                    // Если username не получен из SDK, пробуем через Neynar API
                    if (!this.username && address) {
                        await this.fetchUsernameByAddress(address);
                    }

                    // Обновляем UI
                    this.updateWalletUI();
                    
                    // Обновляем display в игре
                    if (window.game && typeof window.game.updateWalletDisplay === 'function') {
                        await window.game.updateWalletDisplay();
                    }
                }
            }
        } catch (error) {
            console.log('Base Account connection failed:', error.message);
        }
    }

    async getUsernameFromSDK() {
        // Возвращаем уже загруженный username, если есть
        if (this.username) {
            return this.username;
        }

        // Проверяем ранний контекст из index.html
        if (window.__farcasterContext && window.__farcasterContext.user) {
            const user = window.__farcasterContext.user;
            const displayName = user.displayName || user.username || null;
            if (displayName) {
                this.username = displayName;
                this.userContext = window.__farcasterContext;
                if (user.pfpUrl || user.avatarUrl) {
                    this.avatar = user.pfpUrl || user.avatarUrl;
                }
                console.log('Got username from early context:', displayName);
                return displayName;
            }
        }
        
        try {
            let sdkInstance = null;

            // Ищем SDK в различных местах
            if (typeof frame !== 'undefined' && frame.sdk) {
                sdkInstance = frame.sdk;
            } else if (window.__farcasterSDK) {
                sdkInstance = window.__farcasterSDK;
            } else if (window.farcaster && window.farcaster.miniapp) {
                sdkInstance = window.farcaster.miniapp;
            } else if (window.miniappSdk) {
                sdkInstance = window.miniappSdk.sdk || window.miniappSdk;
            }

            if (!sdkInstance) {
                return this.username;
            }

            // Получаем контекст (разные способы в зависимости от версии SDK)
            let context = null;
            try {
                if (typeof sdkInstance.context === 'function') {
                    context = await sdkInstance.context();
                } else if (sdkInstance.context && typeof sdkInstance.context.get === 'function') {
                    context = await sdkInstance.context.get();
                } else if (sdkInstance.context && typeof sdkInstance.context.then === 'function') {
                    context = await sdkInstance.context;
                } else if (sdkInstance.context) {
                    context = sdkInstance.context;
                }
            } catch (e) {
                console.log('Error getting context:', e.message);
            }

            if (context && context.user) {
                // Приоритет: displayName > username
                const displayName = context.user.displayName || context.user.username || null;
                if (displayName) {
                    this.username = displayName;
                    this.userContext = context;
                    // Также обновляем avatar если доступен
                    if (context.user.pfpUrl || context.user.avatarUrl) {
                        this.avatar = context.user.pfpUrl || context.user.avatarUrl;
                    }
                    console.log('Got username from SDK:', displayName);
                    return displayName;
                }
            }
        } catch (error) {
            console.log('Failed to get username from SDK:', error.message);
        }
        
        return this.username;
    }

    getUsername() {
        return this.username;
    }

    getAvatar() {
        // Если avatar еще не загружен, пытаемся получить из контекста
        if (!this.avatar && this.userContext && this.userContext.user) {
            this.avatar = this.userContext.user.pfpUrl || this.userContext.user.avatarUrl || null;
        }
        return this.avatar;
    }

    // Получить полный контекст пользователя из SDK
    async getUserContext() {
        // Если контекст уже загружен, возвращаем его
        if (this.userContext) {
            return this.userContext;
        }

        // Иначе пытаемся получить из SDK
        try {
            let sdkInstance = null;

            if (typeof frame !== 'undefined' && frame.sdk) {
                sdkInstance = frame.sdk;
            } else if (window.__farcasterSDK) {
                sdkInstance = window.__farcasterSDK;
            } else if (window.farcaster && window.farcaster.miniapp) {
                sdkInstance = window.farcaster.miniapp;
            } else if (window.miniappSdk) {
                sdkInstance = window.miniappSdk.sdk || window.miniappSdk;
            }

            if (!sdkInstance) {
                return this.userContext;
            }

            // Получаем контекст (разные способы)
            let context = null;
            if (typeof sdkInstance.context === 'function') {
                context = await sdkInstance.context();
            } else if (sdkInstance.context && typeof sdkInstance.context.get === 'function') {
                context = await sdkInstance.context.get();
            } else if (sdkInstance.context && typeof sdkInstance.context.then === 'function') {
                context = await sdkInstance.context;
            } else if (sdkInstance.context) {
                context = sdkInstance.context;
            }

            if (context) {
                this.userContext = context;
                // Обновляем username и avatar из контекста
                if (context.user) {
                    this.username = context.user.displayName || context.user.username || null;
                    this.avatar = context.user.pfpUrl || context.user.avatarUrl || null;
                }
                return context;
            }
        } catch (error) {
            console.log('Failed to get user context:', error.message);
        }

        return this.userContext;
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

            // Пытаемся получить username из Base app SDK, если доступен
            await this.getUsernameFromSDK();

            // Сохраняем состояние подключения
            localStorage.setItem('walletConnected', 'true');

            this.updateWalletUI();
            
            // Обновляем display в игре
            if (window.game && typeof window.game.updateWalletDisplay === 'function') {
                await window.game.updateWalletDisplay();
            }

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
        // Очищаем username и avatar при отключении
        this.username = null;
        this.avatar = null;
        this.userContext = null;

        localStorage.removeItem('walletConnected');

        // Принудительно обновляем UI
        this.updateWalletUI();

        // Также обновляем display в игре, если он доступен
        if (window.game && typeof window.game.updateWalletDisplay === 'function') {
            await window.game.updateWalletDisplay();
        }
    }

    updateWalletUI() {
        // Кнопка подключения удалена - подключение автоматическое
        // Этот метод оставлен для совместимости, но ничего не делает
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
        console.log('getPlayerIdentifier called');
        console.log('  walletManager exists:', !!this.walletManager);
        console.log('  isConnected:', this.walletManager?.isConnected());
        console.log('  account:', this.walletManager?.account);
        
        if (this.walletManager && this.walletManager.isConnected()) {
            const account = this.walletManager.getAccount().toLowerCase();
            console.log('  returning:', account);
            return account;
        }
        
        // Fallback: проверяем Farcaster контекст
        const farcasterAddress = window.__farcasterContext?.user?.verifiedAddresses?.ethAddresses?.[0] ||
                                 window.__farcasterContext?.user?.custodyAddress;
        if (farcasterAddress) {
            console.log('  using Farcaster fallback:', farcasterAddress);
            return farcasterAddress.toLowerCase();
        }
        
        console.log('  returning null - wallet not connected');
        return null; // Возвращаем null, если кошелек не подключен
    }

    formatAddress(address) {
        // Никогда не показываем адрес - только "Player"
        return 'Player';
    }

    // Форматирование имени в формат .base.eth
    formatBasename(name) {
        if (!name) return 'Player';
        
        // Если уже содержит .base.eth - оставляем как есть
        if (name.includes('.base.eth')) return name;
        
        // Если это .eth имя (ENS) - конвертируем в .base.eth формат
        if (name.endsWith('.eth')) {
            const baseName = name.replace('.eth', '');
            return `${baseName}.base.eth`;
        }
        
        // Если это просто имя без домена и не адрес - добавляем .base.eth
        if (!name.includes('.') && !name.startsWith('0x')) {
            return `${name}.base.eth`;
        }
        
        // Если это адрес - возвращаем "Player"
        if (name.startsWith('0x') || name.includes('...')) {
            return 'Player';
        }
        
        return name;
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
        this.lastError = null;

        try {
            const response = await fetch(`${this.apiUrl}?filter=${filter}&limit=${limit}`);
            const data = await response.json();
            
            // Проверяем специфичные ошибки от сервера
            if (!response.ok) {
                if (response.status === 503 && data.setup_instructions) {
                    // KV не настроен
                    this.lastError = 'storage_not_configured';
                    console.error('Leaderboard storage not configured. Please set up Vercel KV.');
                    console.error('Instructions:', data.setup_instructions);
                }
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            if (data.success && data.results) {
                this.leaderboard = data.results;
                this.lastFetchTime = now;
                this.totalPlayers = data.totalPlayers || 0;
                this.totalGames = data.totalGames || 0;
                this.lastError = null;
                return data.results;
            } else {
                throw new Error(data.error || 'Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            // В случае ошибки возвращаем кешированные данные или пустой массив
            return this.leaderboard.length > 0 ? this.getTopResults(limit, filter) : [];
        } finally {
            this.isLoading = false;
        }
    }
    
    // Получить последнюю ошибку
    getLastError() {
        return this.lastError;
    }

    // Добавить результат на сервер
    async addResult(score, maxCombo, won) {
        console.log('=== addResult called ===');
        console.log('  score:', score, 'maxCombo:', maxCombo, 'won:', won);
        
        const walletAddress = this.getPlayerIdentifier();
        console.log('  walletAddress:', walletAddress);

        if (!walletAddress) {
            // Если кошелек не подключен, не сохраняем результат
            console.log('  ABORT: no wallet address');
            return null;
        }
        
        // Получаем имя игрока из разных источников (приоритет)
        let playerName = null;
        
        // 1. Сначала проверяем localStorage (сохранённое имя)
        try {
            playerName = localStorage.getItem('playerDisplayName');
        } catch (e) {}
        
        // 2. Проверяем window.__userName (установлен из API)
        if (!playerName && window.__userName) {
            playerName = this.formatBasename(window.__userName);
        }
        
        // 3. Пытаемся получить из WalletManager
        if (!playerName && this.walletManager) {
            playerName = this.walletManager.getUsername();
            if (playerName) {
                playerName = this.formatBasename(playerName);
            }
        }
        
        // 4. Пытаемся получить из SDK
        if (!playerName && this.walletManager && this.walletManager.getUsernameFromSDK) {
            try {
                const sdkName = await this.walletManager.getUsernameFromSDK();
                if (sdkName) {
                    playerName = this.formatBasename(sdkName);
                }
            } catch (e) {}
        }
        
        // Никогда не отправляем адрес - только имя или "Player"
        const displayName = playerName || 'Player';
        
        // Получаем аватар из разных источников
        let avatar = null;
        
        // 1. Из WalletManager
        if (this.walletManager && this.walletManager.avatar) {
            avatar = this.walletManager.avatar;
        }
        
        // 2. Из Farcaster контекста
        if (!avatar && window.__farcasterContext?.user) {
            avatar = window.__farcasterContext.user.pfpUrl || 
                     window.__farcasterContext.user.avatarUrl;
        }
        
        // 3. Из window.__userAvatar
        if (!avatar && window.__userAvatar) {
            avatar = window.__userAvatar;
        }
        
        console.log('Sending result to leaderboard:', { walletAddress, playerName: displayName, avatar, score, maxCombo, won });

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    playerName: displayName,
                    avatar: avatar,
                    score: score,
                    maxCombo: maxCombo || 1,
                    won: won || false
                })
            });

            const data = await response.json();
            
            // Проверяем ошибку конфигурации хранилища
            if (!response.ok) {
                if (response.status === 503 && data.setup_instructions) {
                    this.lastError = 'storage_not_configured';
                    console.error('Leaderboard storage not configured:', data.error);
                }
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            if (data.success && data.result) {
                // Добавляем результат в локальный кеш
                this.leaderboard.push(data.result);
                // Сбрасываем время кеша, чтобы обновить данные при следующем запросе
                this.lastFetchTime = 0;
                this.lastError = null;
                console.log('Result saved to leaderboard successfully');
                return data.result;
            } else {
                throw new Error(data.error || 'Failed to save result');
            }
        } catch (error) {
            console.error('Error adding result to leaderboard:', error);
            // В случае ошибки создаем локальный результат (только для текущей сессии)
            const result = {
                id: Date.now() + Math.random(),
                walletAddress: walletAddress,
                playerName: displayName,
                avatar: avatar,
                score: score,
                maxCombo: maxCombo,
                won: won,
                date: new Date().toISOString(),
                timestamp: Date.now(),
                _local: true // Помечаем как локальный результат
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
        // Используем адрес кошелька для идентификации
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
            // Используем walletAddress для идентификации
            const resultAddress = (r.walletAddress || '').toLowerCase();
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
        // Считаем уникальных игроков по адресам кошельков
        const uniquePlayers = new Set(this.leaderboard.map(r => {
            return (r.walletAddress || r.playerName || '').toLowerCase();
        }).filter(addr => addr && addr !== 'guest'));
        return uniquePlayers.size;
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
        this.moves = 15;
        this.combo = 1;
        this.maxCombo = 1;
        this.isProcessing = false;
        this.targetScore = 5000;
        this.particles = [];
        this.walletManager = new WalletManager();
        this.leaderboard = new LeaderboardManager(this.walletManager);
        this.soundManager = new SoundManager();
        
        // Генерируем или получаем имя игрока из localStorage
        this.playerName = this.getPlayerName();
        if (!this.playerName) {
            // Генерируем случайное имя, если его нет
            this.playerName = this.generateRandomPlayerName();
            this.setPlayerName(this.playerName);
        }

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
        
        // Флаг для предотвращения повторной установки обработчиков событий
        this.eventListenersInitialized = false;
    }

    // Методы для работы с именем игрока
    getPlayerName() {
        return localStorage.getItem('match3PlayerName') || null;
    }

    setPlayerName(name) {
        if (name && name.trim() !== '') {
            const trimmedName = name.trim().substring(0, 20); // Ограничиваем длину
            localStorage.setItem('match3PlayerName', trimmedName);
            this.playerName = trimmedName;
            return true;
        }
        return false;
    }

    generateRandomPlayerName() {
        // Генерируем случайное имя вида "Player1234"
        const randomNum = Math.floor(Math.random() * 10000);
        return `Player${randomNum}`;
    }

    async init() {
        try {
            // Убеждаемся, что у игрока есть имя
            if (!this.playerName) {
                this.playerName = this.getPlayerName();
                if (!this.playerName) {
                    // Генерируем случайное имя, если его нет
                    this.playerName = this.generateRandomPlayerName();
                    this.setPlayerName(this.playerName);
                }
            }

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
                
                // ВАЖНО: убеждаемся что game container скрыт после инициализации
                // Игра должна показываться только когда пользователь нажмет "New Game"
                gameContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error in init():', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    async updateWalletDisplay() {
        const playerNameDisplay = document.getElementById('currentPlayerName');
        const playerAvatarDisplay = document.getElementById('currentPlayerAvatar');

        if (playerNameDisplay) {
            if (this.walletManager.isConnected()) {
                let displayName = null;
                
                // 1. Проверяем сохраненное имя в localStorage
                try {
                    const savedName = localStorage.getItem('playerDisplayName');
                    if (savedName) {
                        displayName = savedName;
                        debugLog(`Using saved name: ${displayName}`);
                    }
                } catch (e) {}
                
                // 2. Проверяем window.__userName (установлен из index.html)
                if (!displayName && window.__userName) {
                    displayName = this.formatBasename(window.__userName);
                    debugLog(`Using window.__userName: ${displayName}`);
                }
                
                // 3. Пробуем получить из WalletManager
                if (!displayName && this.walletManager.getUsername) {
                    const username = this.walletManager.getUsername();
                    if (username) {
                        displayName = this.formatBasename(username);
                    }
                }
                
                // 4. Пробуем получить из SDK
                if (!displayName && this.walletManager.getUsernameFromSDK) {
                    try {
                        const sdkName = await this.walletManager.getUsernameFromSDK();
                        if (sdkName) {
                            displayName = this.formatBasename(sdkName);
                        }
                    } catch (e) {}
                }
                
                // 5. НИКОГДА не показываем адрес кошелька - только "Player"
                if (!displayName) {
                    displayName = 'Player';
                }
                
                playerNameDisplay.textContent = displayName;
                playerNameDisplay.classList.remove('wallet-address');

                // Показываем avatar - только реальный из профиля с fallback
                if (playerAvatarDisplay) {
                    // Собираем все возможные источники аватара
                    let sources = window.__avatarSources || [];
                    
                    // Добавляем другие источники если есть
                    const sdkAvatar = this.walletManager.getAvatar();
                    if (sdkAvatar && !sources.includes(sdkAvatar)) sources.unshift(sdkAvatar);
                    if (window.__userAvatar && !sources.includes(window.__userAvatar)) sources.push(window.__userAvatar);
                    
                    // Из localStorage
                    try {
                        const savedAvatar = localStorage.getItem('playerAvatar');
                        if (savedAvatar && !sources.includes(savedAvatar)) sources.push(savedAvatar);
                    } catch (e) {}
                    
                    // Показываем только реальный аватар с fallback
                    if (sources.length > 0) {
                        let currentIndex = 0;
                        
                        const tryNextAvatar = () => {
                            if (currentIndex >= sources.length) {
                                playerAvatarDisplay.style.display = 'none';
                                return;
                            }
                            playerAvatarDisplay.src = sources[currentIndex];
                            playerAvatarDisplay.style.display = 'block';
                            currentIndex++;
                        };
                        
                        playerAvatarDisplay.onerror = tryNextAvatar;
                        playerAvatarDisplay.onload = () => {
                            // Сохраняем работающий URL
                            try { localStorage.setItem('playerAvatar', playerAvatarDisplay.src); } catch (e) {}
                        };
                        
                        tryNextAvatar();
                    } else {
                        playerAvatarDisplay.style.display = 'none';
                    }
                }
            } else {
                // Даже если кошелек не подключен, проверяем сохраненное имя
                let displayName = 'Player';
                
                try {
                    const savedName = localStorage.getItem('playerDisplayName');
                    if (savedName) {
                        displayName = savedName;
                    }
                } catch (e) {}
                
                if (!displayName || displayName === 'Player') {
                    if (window.__userName) {
                        displayName = this.formatBasename(window.__userName);
                    }
                }
                
                playerNameDisplay.textContent = displayName;
                playerNameDisplay.classList.remove('wallet-address');
                
                // Показываем аватар если есть сохраненный
                if (playerAvatarDisplay) {
                    let avatarUrl = window.__userAvatar;
                    try {
                        const savedAvatar = localStorage.getItem('playerAvatar');
                        if (savedAvatar) avatarUrl = savedAvatar;
                    } catch (e) {}
                    
                    if (avatarUrl) {
                        playerAvatarDisplay.src = avatarUrl;
                        playerAvatarDisplay.style.display = 'block';
                        playerAvatarDisplay.onerror = function() {
                            this.style.display = 'none';
                        };
                    } else {
                        playerAvatarDisplay.style.display = 'none';
                    }
                }
            }
        }
    }

    // Форматирование имени в формат .base.eth
    formatBasename(name) {
        if (!name) return 'Player';
        
        // Если уже содержит .base.eth - оставляем как есть
        if (name.includes('.base.eth')) return name;
        
        // Если это .eth имя (ENS) - конвертируем в .base.eth формат
        if (name.endsWith('.eth')) {
            const baseName = name.replace('.eth', '');
            return `${baseName}.base.eth`;
        }
        
        // Если это просто имя без домена и не адрес - добавляем .base.eth
        if (!name.includes('.') && !name.startsWith('0x')) {
            return `${name}.base.eth`;
        }
        
        // Если это адрес - возвращаем "Player"
        if (name.startsWith('0x') || name.includes('...')) {
            return 'Player';
        }
        
        return name;
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
            // Обновляем отображение комбо через updateUI для синхронизации
            this.updateUI();
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
        // Элемент комбо удален из UI, поэтому не обновляем его

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

        // Сохраняем статистику игр для профиля
        try {
            // Увеличиваем счетчик игр
            const gamesPlayed = parseInt(localStorage.getItem('gamesPlayed') || '0') + 1;
            localStorage.setItem('gamesPlayed', gamesPlayed.toString());

            // Обновляем лучший комбо
            const currentBestCombo = parseInt(localStorage.getItem('bestCombo') || '0');
            if (this.maxCombo > currentBestCombo) {
                localStorage.setItem('bestCombo', this.maxCombo.toString());
            }
        } catch (e) {
            console.log('Error saving game stats:', e.message);
        }

        // Логируем статус подключения для диагностики
        console.log('=== END GAME DEBUG ===');
        console.log('walletManager.isConnected():', this.walletManager.isConnected());
        console.log('walletManager.account:', this.walletManager.account);
        console.log('window.__farcasterContext:', window.__farcasterContext);
        console.log('Score:', this.score, 'MaxCombo:', this.maxCombo, 'Won:', won);
        
        // Проверяем, подключен ли кошелек перед сохранением
        // Также проверяем контекст Farcaster как запасной вариант
        const farcasterAddress = window.__farcasterContext?.user?.verifiedAddresses?.ethAddresses?.[0] ||
                                 window.__farcasterContext?.user?.custodyAddress;
        
        if (!this.walletManager.isConnected() && farcasterAddress) {
            // Есть адрес из Farcaster контекста - подключаем
            console.log('Connecting via Farcaster context address:', farcasterAddress);
            await this.walletManager.connectViaBaseAccount(farcasterAddress);
        }
        
        if (!this.walletManager.isConnected()) {
            console.log('Wallet NOT connected - result will NOT be saved');
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
        console.log('Wallet IS connected - saving result...');
        console.log('Account:', this.walletManager.account);
        
        let savedResult = null;
        try {
            savedResult = await this.leaderboard.addResult(this.score, this.maxCombo, won);
            console.log('Saved result:', savedResult);
            
            if (!savedResult) {
                console.error('ERROR: savedResult is null/undefined');
            } else if (savedResult._local) {
                console.warn('WARNING: Result saved locally only (API error)');
            } else {
                console.log('SUCCESS: Result saved to server');
            }
        } catch (saveError) {
            console.error('ERROR saving result:', saveError);
        }

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
            
            // Проверяем ошибку конфигурации
            const lastError = this.leaderboard.getLastError();
            if (lastError === 'storage_not_configured') {
                list.innerHTML = `
                    <div class="leaderboard-empty">
                        <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                        <div style="font-weight: 600; margin-bottom: 8px;">Leaderboard Storage Not Configured</div>
                        <div style="font-size: 12px; opacity: 0.7; line-height: 1.5;">
                            To enable the global leaderboard, connect Upstash Redis via Vercel Marketplace.
                            <br><br>
                            See LEADERBOARD_SETUP.md for instructions.
                        </div>
                    </div>
                `;
                totalPlayers.textContent = '0';
                totalGames.textContent = '0';
                return;
            }

            // Отображаем статистику
            totalPlayers.textContent = this.leaderboard.getTotalPlayers();
            totalGames.textContent = this.leaderboard.totalGames || this.leaderboard.leaderboard.length;

            // Отображаем лидерборд
            if (topResults.length === 0) {
                list.innerHTML = '<div class="leaderboard-empty">No results yet. Be the first to play!</div>';
                return;
            }

            // Используем адрес кошелька текущего игрока для проверки
            const currentAddress = this.walletManager.isConnected()
                ? this.walletManager.getAccount().toLowerCase()
                : null;

            // Получаем имя текущего игрока из разных источников
            let currentPlayerName = null;
            try {
                currentPlayerName = localStorage.getItem('playerDisplayName');
            } catch (e) {}
            
            if (!currentPlayerName && window.__userName) {
                currentPlayerName = this.formatBasename(window.__userName);
            }
            
            if (!currentPlayerName && this.walletManager) {
                currentPlayerName = this.walletManager.getUsername();
                if (currentPlayerName) {
                    currentPlayerName = this.formatBasename(currentPlayerName);
                }
            }

            list.innerHTML = topResults.map((result, index) => {
                const date = new Date(result.date);
                const dateStr = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

                const resultAddress = (result.walletAddress || '').toLowerCase();
                
                // Получаем имя для отображения
                let displayName = result.playerName;
                
                // Форматируем имя в .base.eth формат
                if (displayName && !displayName.includes('.base.eth') && displayName !== 'Player') {
                    displayName = this.formatBasename(displayName);
                }
                
                // Если это текущий игрок и у нас есть имя, используем его
                if (currentAddress && resultAddress === currentAddress && currentPlayerName) {
                    displayName = currentPlayerName;
                }
                
                // Никогда не показываем адреса - только имя или "Player"
                if (!displayName || displayName.startsWith('0x') || displayName.includes('...')) {
                    displayName = 'Player';
                }
                
                // Проверяем, является ли это текущий игрок по адресу кошелька
                const isCurrentPlayer = currentAddress && resultAddress === currentAddress;
                
                // Получаем аватар - либо из результата, либо текущего игрока
                let avatarUrl = result.avatar;
                if (isCurrentPlayer && !avatarUrl) {
                    avatarUrl = this.walletManager?.avatar || 
                                window.__farcasterContext?.user?.pfpUrl ||
                                window.__userAvatar;
                }
                
                // Генерируем HTML для аватара
                const avatarHtml = avatarUrl 
                    ? `<img src="${this.escapeHtml(avatarUrl)}" alt="" class="player-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="player-avatar-placeholder" style="display:none;">👤</div>`
                    : `<div class="player-avatar-placeholder">👤</div>`;

                return `
                    <div class="leaderboard-item ${isCurrentPlayer ? 'current-player' : ''}">
                        <div class="leaderboard-rank">
                            ${medal || `<span class="rank-number">${index + 1}</span>`}
                        </div>
                        <div class="leaderboard-avatar">
                            ${avatarHtml}
                        </div>
                        <div class="leaderboard-player">
                            <div class="player-name-row">
                                <span class="player-name">${this.escapeHtml(displayName)}</span>
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
            
            // Проверяем тип ошибки
            const lastError = this.leaderboard.getLastError();
            if (lastError === 'storage_not_configured') {
                list.innerHTML = `
                    <div class="leaderboard-empty">
                        <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                        <div style="font-weight: 600; margin-bottom: 8px;">Leaderboard Storage Not Configured</div>
                        <div style="font-size: 12px; opacity: 0.7; line-height: 1.5;">
                            Connect Upstash Redis via Vercel Marketplace to enable the global leaderboard.
                        </div>
                    </div>
                `;
            } else {
                list.innerHTML = '<div class="leaderboard-empty">Error loading leaderboard. Please try again later.</div>';
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async newGame() {
        this.score = 0;
        this.moves = 15;
        this.combo = 1;
        this.maxCombo = 1;
        this.selectedCell = null;
        this.isProcessing = false;
        document.getElementById('gameOverModal').classList.remove('show');
        
        // Не вызываем полный init() чтобы избежать дублирования обработчиков событий
        // Просто создаем новую доску и обновляем UI
        this.createBoard();
        this.removeInitialMatches();
        // Рендерим доску ПОСЛЕ удаления начальных совпадений,
        // чтобы визуальное представление соответствовало данным
        this.render();
        this.updateUI();
    }

    setupEventListeners() {
        // Защита от повторной установки обработчиков событий
        if (this.eventListenersInitialized) {
            console.log('Event listeners already initialized, skipping...');
            return;
        }
        this.eventListenersInitialized = true;
        
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

        // Back button - возврат в главное меню
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                console.log('Back button clicked');
                if (window.showGameMenu) {
                    window.showGameMenu();
                } else {
                    // Fallback: напрямую показываем меню и скрываем игру
                    console.log('showGameMenu not found, using fallback');
                    const startMenu = document.getElementById('startMenu');
                    const gameContainer = document.getElementById('gameContainer');
                    if (startMenu) {
                        startMenu.style.display = 'flex';
                    }
                    if (gameContainer) {
                        gameContainer.style.display = 'none';
                    }
                }
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

        // Rules button in game controls
        const rulesBtn = document.getElementById('rulesBtn');
        const rulesModal = document.getElementById('rulesModal');
        if (rulesBtn && rulesModal) {
            rulesBtn.addEventListener('click', () => {
                rulesModal.classList.add('show');
            });
        }

        // Settings button in game controls
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('show');
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

        // Кнопка подключения кошелька удалена - подключение автоматическое при открытии приложения

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
    const menuGMBtn = document.getElementById('menuGMBtn');
    const menuDeployBtn = document.getElementById('menuDeployBtn');
    const menuProfileBtn = document.getElementById('menuProfileBtn');
    const settingsModal = document.getElementById('settingsModal');
    const gmModal = document.getElementById('gmModal');
    const rulesModal = document.getElementById('rulesModal');
    const deployModal = document.getElementById('deployModal');
    const profileModal = document.getElementById('profileModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const closeGMBtn = document.getElementById('closeGMBtn');
    const closeRulesBtn = document.getElementById('closeRulesBtn');
    const closeDeployBtn = document.getElementById('closeDeployBtn');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    
    // Проверяем наличие необходимых элементов
    if (!startMenu || !gameContainer) {
        console.warn('Start menu elements not found, retrying...');
        setTimeout(initStartMenu, 100);
        return;
    }
    
    startMenuInitialized = true;

    // Показываем меню только если onboarding уже завершен или не активен
    // Если onboarding активен, меню будет показано после его завершения
    const onboardingScreen = document.getElementById('onboardingScreen');
    const onboardingVisible = onboardingScreen && 
                              onboardingScreen.style.display !== 'none' && 
                              !onboardingScreen.classList.contains('hidden');
    
    // Меню будет показано после завершения onboarding
    // Не показываем его здесь, если onboarding активен или splash еще виден
    if (startMenu && !onboardingVisible) {
        const splashScreen = document.getElementById('splashScreen');
        // Если splash уже скрыт и onboarding не виден, показываем меню
        if (!splashScreen) {
            // Меню показывается через OnboardingManager.hide() или SplashScreenManager.hide()
        }
    }

    // Функция для скрытия меню и показа игры
    function showGame() {
        console.log('showGame() called');
        if (startMenu) {
            startMenu.style.display = 'none';
        }
        if (gameContainer) {
            gameContainer.style.display = 'block';
        }
    }

    // Функция для показа меню и скрытия игры
    function showMenu() {
        console.log('showMenu() called');
        if (startMenu) {
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

    // Theme toggle handlers
    const themeDarkBtn = document.getElementById('themeDarkBtn');
    const themeLightBtn = document.getElementById('themeLightBtn');
    
    function setTheme(theme) {
        const body = document.body;
        if (theme === 'light') {
            body.classList.add('light-theme');
            if (themeDarkBtn) themeDarkBtn.classList.remove('active');
            if (themeLightBtn) themeLightBtn.classList.add('active');
        } else {
            body.classList.remove('light-theme');
            if (themeDarkBtn) themeDarkBtn.classList.add('active');
            if (themeLightBtn) themeLightBtn.classList.remove('active');
        }
        localStorage.setItem('theme', theme);
    }
    
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);
    }
    
    if (themeDarkBtn) {
        themeDarkBtn.addEventListener('click', () => {
            setTheme('dark');
        });
    }
    
    if (themeLightBtn) {
        themeLightBtn.addEventListener('click', () => {
            setTheme('light');
        });
    }
    
    // Initialize theme on page load
    initTheme();

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

    // Say GM - открываем модалку GM
    if (menuGMBtn && gmModal) {
        menuGMBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Say GM button clicked');
            updateGMUI(); // Update streak display before showing
            gmModal.classList.add('show');
        });
        console.log('Say GM button handler attached');
    }

    if (closeGMBtn && gmModal) {
        closeGMBtn.addEventListener('click', () => {
            gmModal.classList.remove('show');
        });
    }
    
    // GM Send button
    const gmSendBtn = document.getElementById('gmSendBtn');
    if (gmSendBtn) {
        gmSendBtn.addEventListener('click', () => {
            sendSimpleGM();
        });
    }

    // Deploy Contract - открываем модальное окно для деплоя
    if (menuDeployBtn && deployModal) {
        menuDeployBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Deploy Contract button clicked');
            // Reset status and button
            const deployStatus = document.getElementById('deployStatus');
            const deployBtn = document.getElementById('deployBtn');
            if (deployStatus) {
                deployStatus.textContent = '';
                deployStatus.style.color = '';
            }
            if (deployBtn) {
                deployBtn.disabled = false;
                deployBtn.textContent = 'Deploy Contract';
            }
            updateDeployUI(); // Update contracts list before showing
            deployModal.classList.add('show');
        });
        console.log('Deploy Contract button handler attached');
    }
    
    // Deploy button
    const deployBtn = document.getElementById('deployBtn');
    if (deployBtn) {
        deployBtn.addEventListener('click', () => {
            sendSimpleDeploy();
        });
    }

    // Profile - открываем профиль игрока
    if (menuProfileBtn && profileModal) {
        menuProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Profile button clicked');
            updateProfileDisplay();
            profileModal.classList.add('show');
        });
        console.log('Profile button handler attached');
    } else {
        console.warn('Profile button or modal not found', { menuProfileBtn, profileModal });
    }

    if (closeProfileBtn && profileModal) {
        closeProfileBtn.addEventListener('click', () => {
            profileModal.classList.remove('show');
        });
    }

    // Функция обновления данных профиля
    function updateProfileDisplay() {
        const profileName = document.getElementById('profileName');
        const profileAddress = document.getElementById('profileAddress');
        const profileHighScore = document.getElementById('profileHighScore');
        const profileGamesPlayed = document.getElementById('profileGamesPlayed');
        const profileBestCombo = document.getElementById('profileBestCombo');
        const profileGMStreak = document.getElementById('profileGMStreak');
        const profileAvatar = document.getElementById('profileAvatar');
        const profileAvatarPlaceholder = document.getElementById('profileAvatarPlaceholder');

        // Имя игрока
        if (profileName) {
            const name = window.__userName || 
                         localStorage.getItem('playerDisplayName') || 
                         (window.walletManager && window.walletManager.username) ||
                         'Player';
            profileName.textContent = name;
        }

        // Адрес кошелька
        if (profileAddress) {
            const address = window.__userAddress || 
                           (window.walletManager && window.walletManager.account) ||
                           localStorage.getItem('walletAddress');
            if (address) {
                // Сокращаем адрес для отображения
                const shortAddress = address.slice(0, 6) + '...' + address.slice(-4);
                profileAddress.textContent = shortAddress;
                profileAddress.title = address; // Полный адрес в tooltip
            } else {
                profileAddress.textContent = 'Not connected';
            }
        }

        // High Score из localStorage
        if (profileHighScore) {
            try {
                const scores = JSON.parse(localStorage.getItem('leaderboard') || '[]');
                const playerName = window.__userName || localStorage.getItem('playerDisplayName') || 'Player';
                const playerAddress = window.__userAddress || (window.walletManager && window.walletManager.account);
                
                let highScore = 0;
                scores.forEach(entry => {
                    if ((entry.name === playerName || entry.address === playerAddress) && entry.score > highScore) {
                        highScore = entry.score;
                    }
                });
                
                // Также проверяем текущий рекорд из игры
                if (window.game && window.game.highScore > highScore) {
                    highScore = window.game.highScore;
                }
                
                profileHighScore.textContent = highScore.toLocaleString();
            } catch (e) {
                profileHighScore.textContent = '0';
            }
        }

        // Количество игр
        if (profileGamesPlayed) {
            try {
                const gamesPlayed = parseInt(localStorage.getItem('gamesPlayed') || '0');
                profileGamesPlayed.textContent = gamesPlayed.toString();
            } catch (e) {
                profileGamesPlayed.textContent = '0';
            }
        }

        // Лучший комбо
        if (profileBestCombo) {
            try {
                const bestCombo = parseInt(localStorage.getItem('bestCombo') || '0');
                profileBestCombo.textContent = bestCombo + 'x';
            } catch (e) {
                profileBestCombo.textContent = '0x';
            }
        }

        // GM Streak
        if (profileGMStreak) {
            try {
                const gmStreak = parseInt(localStorage.getItem('gmStreak') || '0');
                profileGMStreak.textContent = gmStreak + ' days';
            } catch (e) {
                profileGMStreak.textContent = '0 days';
            }
        }

        // Аватар
        if (profileAvatar && profileAvatarPlaceholder) {
            const avatarUrl = window.__userAvatar || localStorage.getItem('playerAvatar');
            if (avatarUrl) {
                profileAvatar.src = avatarUrl;
                profileAvatar.style.display = 'block';
                profileAvatarPlaceholder.style.display = 'none';
                profileAvatar.onerror = function() {
                    profileAvatar.style.display = 'none';
                    profileAvatarPlaceholder.style.display = 'flex';
                };
            } else {
                profileAvatar.style.display = 'none';
                profileAvatarPlaceholder.style.display = 'flex';
            }
        }
    }

    if (closeDeployBtn && deployModal) {
        closeDeployBtn.addEventListener('click', () => {
            deployModal.classList.remove('show');
        });
    }

    // Инициализируем функционал деплоя контракта
    initDeployContract();

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

    if (deployModal) {
        const backdrop = deployModal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                deployModal.classList.remove('show');
            });
        }
    }

    // Обновляем отображение GM Streak на главном экране
    updateDayStreakDisplay();
    
    // Инициализируем GM кнопку
    initGMButton();

    // Сохраняем функции для использования из других мест
    window.showGameMenu = showMenu;
    window.hideGameMenu = showGame;
}

// Функция для обновления отображения GM Streak
function updateDayStreakDisplay() {
    // Получаем streak из localStorage (приоритет GM данным)
    const gmData = localStorage.getItem('gmData');
    const dayStreakData = localStorage.getItem('dayStreak');
    let streak = 0;
    let lastActivityDate = null;

    // Сначала проверяем GM данные (если пользователь отправлял GM транзакции)
    if (gmData) {
        try {
            const data = JSON.parse(gmData);
            streak = data.streak || 0;
            lastActivityDate = data.lastGMDate || null;
        } catch (e) {
            console.error('Error parsing GM data:', e);
        }
    }
    
    // Также проверяем dayStreak данные и берем максимальный streak
    if (dayStreakData) {
        try {
            const data = JSON.parse(dayStreakData);
            const dayStreak = data.streak || 0;
            const lastPlayDate = data.lastPlayDate || null;
            
            // Берем максимальный streak
            if (dayStreak > streak) {
                streak = dayStreak;
                lastActivityDate = lastPlayDate;
            }
        } catch (e) {
            console.error('Error parsing day streak data:', e);
        }
    }

    // Проверяем, была ли активность сегодня или вчера
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastActivityDate && lastActivityDate !== today && lastActivityDate !== yesterday.toDateString()) {
        // Streak сброшен (последняя активность была больше дня назад)
        streak = 0;
    }

    // Обновляем отображение в меню
    const dayStreakDisplay = document.getElementById('dayStreakDisplay');
    const dayStreakValue = document.getElementById('dayStreakValue');
    const streakValueLarge = document.getElementById('streakValueLarge');

    if (streak > 0 && dayStreakDisplay) {
        dayStreakDisplay.style.display = 'block';
    } else if (dayStreakDisplay) {
        dayStreakDisplay.style.display = 'none';
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

// GM Transaction functionality
const GM_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // Null address for GM message
const GM_MESSAGE = '0x474d'; // "GM" in hex

// Check if GM was already said today
function hasGMToday() {
    const gmData = localStorage.getItem('gmData');
    if (gmData) {
        try {
            const data = JSON.parse(gmData);
            const today = new Date().toDateString();
            return data.lastGMDate === today;
        } catch (e) {
            return false;
        }
    }
    return false;
}

// Get GM data from localStorage
function getGMData() {
    const gmData = localStorage.getItem('gmData');
    if (gmData) {
        try {
            return JSON.parse(gmData);
        } catch (e) {
            return { gmCount: 0, lastGMDate: null, lastTxHash: null };
        }
    }
    return { gmCount: 0, lastGMDate: null, lastTxHash: null };
}

// Save GM data to localStorage
function saveGMData(data) {
    localStorage.setItem('gmData', JSON.stringify(data));
}

// Update GM button state
function updateGMButtonState() {
    const gmButton = document.getElementById('gmButton');
    const gmStatus = document.getElementById('gmStatus');
    const gmLastSaid = document.getElementById('gmLastSaid');
    
    if (!gmButton) return;
    
    const alreadySaidToday = hasGMToday();
    const gmData = getGMData();
    
    if (alreadySaidToday) {
        gmButton.disabled = true;
        gmButton.innerHTML = '<span class="gm-icon">✓</span><span>GM Sent!</span>';
        gmButton.classList.add('success');
        if (gmStatus) {
            gmStatus.textContent = 'You already said GM today!';
            gmStatus.className = 'gm-status success';
        }
        if (gmLastSaid && gmData.lastTxHash) {
            gmLastSaid.innerHTML = `<a href="https://basescan.org/tx/${gmData.lastTxHash}" target="_blank" class="gm-tx-link">View transaction ↗</a>`;
        }
    } else {
        gmButton.disabled = false;
        gmButton.innerHTML = '<span class="gm-icon">☀️</span><span>Say GM</span>';
        gmButton.classList.remove('success', 'loading');
        if (gmStatus) {
            gmStatus.textContent = '';
            gmStatus.className = 'gm-status';
        }
        if (gmLastSaid) {
            if (gmData.gmCount > 0) {
                gmLastSaid.textContent = `Total GMs: ${gmData.gmCount}`;
            } else {
                gmLastSaid.textContent = '';
            }
        }
    }
}

// Send GM transaction using GM Contract for sponsorship
async function sendGMTransaction() {
    const gmButton = document.getElementById('gmButton');
    const gmStatus = document.getElementById('gmStatus');
    
    if (!gmButton) return;
    
    // Check if already said GM today
    if (hasGMToday()) {
        if (gmStatus) {
            gmStatus.textContent = 'You already said GM today!';
            gmStatus.className = 'gm-status';
        }
        return;
    }
    
    // Set loading state
    gmButton.disabled = true;
    gmButton.classList.add('loading');
    gmButton.innerHTML = '<span class="gm-icon">⏳</span><span>Sending...</span>';
    if (gmStatus) {
        gmStatus.textContent = 'Preparing transaction...';
        gmStatus.className = 'gm-status';
    }
    
    try {
        // GM Contract transaction params - call sayGM() on contract
        const contractTxParams = {
            to: GM_CONTRACT.address,
            value: '0x0',
            data: GM_CONTRACT.sayGMSelector // sayGM() function selector = 0x41cf91d1
        };
        
        console.log('GM Contract:', GM_CONTRACT.address);
        console.log('sayGM() selector:', GM_CONTRACT.sayGMSelector);
        
        // ===== SEND TRANSACTION =====
        if (gmStatus) gmStatus.textContent = 'Sending GM on Base...';
        
        const result = await SponsoredTransactions.sendViaFarcasterSDK(
            contractTxParams,
            (status) => { if (gmStatus) gmStatus.textContent = status; }
        );
        
        const txHash = result.txHash;
        
        if (txHash) {
            console.log('GM transaction sent:', txHash);
            
            // Update GM data
            const gmData = getGMData();
            const today = new Date().toDateString();
            
            // Update streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            let newStreak = 1;
            if (gmData.lastGMDate === yesterday.toDateString()) {
                // Continue streak
                newStreak = (gmData.streak || 0) + 1;
            } else if (gmData.lastGMDate === today) {
                // Already said GM today (shouldn't happen, but just in case)
                newStreak = gmData.streak || 1;
            }
            
            saveGMData({
                gmCount: (gmData.gmCount || 0) + 1,
                lastGMDate: today,
                lastTxHash: txHash,
                streak: newStreak
            });
            
            // Also update the game's day streak
            localStorage.setItem('dayStreak', JSON.stringify({
                streak: newStreak,
                lastPlayDate: today
            }));
            
            // Update UI
            gmButton.innerHTML = '<span class="gm-icon">✓</span><span>GM Sent!</span>';
            gmButton.classList.remove('loading');
            gmButton.classList.add('success');
            
            if (gmStatus) {
                gmStatus.innerHTML = `GM sent successfully! <a href="https://basescan.org/tx/${txHash}" target="_blank" class="gm-tx-link">View ↗</a>`;
                gmStatus.className = 'gm-status success';
            }
            
            // Update streak displays
            updateDayStreakDisplay();
            updateGMButtonState();
        }
        
    } catch (error) {
        console.error('GM transaction error:', error);
        
        gmButton.disabled = false;
        gmButton.classList.remove('loading');
        gmButton.innerHTML = '<span class="gm-icon">☀️</span><span>Say GM</span>';
        
        if (gmStatus) {
            let errorMsg = 'Transaction failed';
            if (error.message) {
                if (error.message.includes('rejected') || error.message.includes('denied')) {
                    errorMsg = 'Transaction cancelled';
                } else if (error.message.includes('network') || error.message.includes('Base')) {
                    errorMsg = 'Please switch to Base network';
                } else if (error.message.includes('wallet') || error.message.includes('connect')) {
                    errorMsg = 'Please connect your wallet';
                } else {
                    errorMsg = error.message.slice(0, 50);
                }
            }
            gmStatus.textContent = errorMsg;
            gmStatus.className = 'gm-status error';
        }
    }
}

// Debug logging for GM and Deploy panels
const DebugLogger = {
    gmLogs: [],
    deployLogs: [],
    
    logGM(msg) {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${time}] ${msg}`;
        this.gmLogs.push(logEntry);
        console.log('[GM]', msg);
        this.updateGMPanel();
    },
    
    logDeploy(msg) {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${time}] ${msg}`;
        this.deployLogs.push(logEntry);
        console.log('[Deploy]', msg);
        this.updateDeployPanel();
    },
    
    updateGMPanel() {
        const content = document.getElementById('gmDebugContent');
        if (content) {
            content.textContent = this.gmLogs.slice(-20).join('\n');
            content.scrollTop = content.scrollHeight;
        }
    },
    
    updateDeployPanel() {
        const content = document.getElementById('deployDebugContent');
        if (content) {
            content.textContent = this.deployLogs.slice(-20).join('\n');
            content.scrollTop = content.scrollHeight;
        }
    },
    
    clearGM() {
        this.gmLogs = [];
        this.updateGMPanel();
    },
    
    clearDeploy() {
        this.deployLogs = [];
        this.updateDeployPanel();
    }
};

// Make it globally accessible
window.DebugLogger = DebugLogger;

// Initialize GM button
function initGMButton() {
    const gmButton = document.getElementById('gmButton');
    if (gmButton) {
        gmButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            DebugLogger.clearGM();
            DebugLogger.logGM('GM button clicked');
            sendGMTransaction();
        });
        
        // Update button state on init
        updateGMButtonState();
        console.log('GM button initialized');
    }
}

// Run debug check for GM
async function runGMDebugCheck() {
    DebugLogger.logGM('=== Debug Check Started ===');
    
    // Check Farcaster SDK
    const sdk = SponsoredTransactions.getFarcasterSDK();
    DebugLogger.logGM(`Farcaster SDK: ${sdk ? 'Found' : 'Not found'}`);
    
    if (sdk) {
        DebugLogger.logGM(`SDK keys: ${Object.keys(sdk).join(', ')}`);
        if (sdk.wallet) {
            DebugLogger.logGM(`wallet keys: ${Object.keys(sdk.wallet).join(', ')}`);
        }
        if (sdk.experimental) {
            DebugLogger.logGM(`experimental keys: ${Object.keys(sdk.experimental).join(', ')}`);
        }
    }
    
    // Check window.ethereum
    DebugLogger.logGM(`window.ethereum: ${window.ethereum ? 'Found' : 'Not found'}`);
    
    // Check isInMiniApp
    DebugLogger.logGM(`isInFarcasterFrame: ${SponsoredTransactions.isInFarcasterFrame()}`);
    
    // Log GM Contract info
    DebugLogger.logGM(`GM Contract: ${GM_CONTRACT.address}`);
    DebugLogger.logGM(`sayGM() selector: ${GM_CONTRACT.sayGMSelector}`);
    
    // Try to get provider and capabilities
    let userAddress = null;
    let provider = null;
    try {
        provider = sdk?.wallet?.ethProvider || window.ethereum;
        if (provider) {
            DebugLogger.logGM('Checking wallet capabilities...');
            
            try {
                const accounts = await provider.request({ method: 'eth_accounts' });
                DebugLogger.logGM(`Accounts: ${accounts?.length > 0 ? accounts[0].slice(0,10) + '...' : 'None'}`);
                userAddress = accounts?.[0];
                
                if (accounts?.[0]) {
                    const caps = await provider.request({
                        method: 'wallet_getCapabilities',
                        params: [accounts[0]]
                    });
                    DebugLogger.logGM(`Capabilities: ${JSON.stringify(caps, null, 2)}`);
                }
            } catch (e) {
                DebugLogger.logGM(`Capabilities error: ${e.message}`);
            }
            
            // Check if GM contract exists
            DebugLogger.logGM('=== Checking GM Contract ===');
            try {
                const code = await provider.request({
                    method: 'eth_getCode',
                    params: [GM_CONTRACT.address, 'latest']
                });
                const hasCode = code && code !== '0x' && code !== '0x0' && code.length > 10;
                DebugLogger.logGM(`Contract code: ${hasCode ? 'EXISTS (' + code.length + ' bytes)' : 'NOT DEPLOYED'}`);
                if (!hasCode) {
                    DebugLogger.logGM('WARNING: GM Contract not found! Need to deploy it first.');
                }
            } catch (codeErr) {
                DebugLogger.logGM(`Contract check error: ${codeErr.message}`);
            }
        }
    } catch (e) {
        DebugLogger.logGM(`Provider error: ${e.message}`);
    }
    
    // Check sponsorship
    const sponsorAvailable = await SponsoredTransactions.checkSponsorshipAvailable();
    DebugLogger.logGM(`Sponsorship available: ${sponsorAvailable}`);
    DebugLogger.logGM(`Sponsor type: ${SponsoredTransactions.sponsorType || 'none'}`);
    
    // Test Paymaster directly
    DebugLogger.logGM('=== Testing Paymaster API ===');
    try {
        const testResponse = await fetch('/api/paymaster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'checkSponsorshipEligibility'
            })
        });
        const testData = await testResponse.json();
        DebugLogger.logGM(`Paymaster eligibility: ${JSON.stringify(testData)}`);
        
        // If we have user address, test actual sponsorship
        if (userAddress) {
            DebugLogger.logGM('Testing pm_getPaymasterStubData...');
            const paymasterResponse = await fetch('/api/paymaster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getPaymasterData',
                    userOp: {
                        sender: userAddress,
                        nonce: '0x0',
                        initCode: '0x',
                        callData: '0x41cf91d1', // sayGM()
                        callGasLimit: '0x5208',
                        verificationGasLimit: '0x5208',
                        preVerificationGas: '0x5208',
                        maxFeePerGas: '0x0',
                        maxPriorityFeePerGas: '0x0',
                        paymasterAndData: '0x',
                        signature: '0x'
                    }
                })
            });
            const paymasterData = await paymasterResponse.json();
            DebugLogger.logGM(`Paymaster response: ${JSON.stringify(paymasterData)}`);
        }
    } catch (e) {
        DebugLogger.logGM(`Paymaster test error: ${e.message}`);
    }
    
    DebugLogger.logGM('=== Debug Check Complete ===');
}

// ==================== DEPLOY CONTRACT FUNCTIONS ====================

// SimpleStorage contract bytecode (compiled Solidity)
// This is a minimal storage contract that stores and retrieves a uint256 value
const SIMPLE_STORAGE_BYTECODE = '0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550600060018190555061024f806100686000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c806320965255146100575780633fa4f2451461007557806355241077146100935780638da5cb5b146100af578063b0f7b3e2146100cd575b600080fd5b61005f6100eb565b60405161006c9190610175565b60405180910390f35b61007d6100f4565b60405161008a9190610175565b60405180910390f35b6100ad60048036038101906100a891906101c1565b6100fa565b005b6100b7610138565b6040516100c491906101ee565b60405180910390f35b6100d561015c565b6040516100e29190610175565b60405180910390f35b60006001549050919050565b60015481565b806001819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c596001546040516101359190610175565b60405180910390a150565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60006001549050919050565b6000819050919050565b61018381610170565b82525050565b600060208201905061019e600083018461017a565b92915050565b6000813590506101b381610202565b92915050565b6000602082840312156101cf576101ce6101fd565b5b60006101dd848285016101a4565b91505092915050565b6101ef81610170565b82525050565b600060208201905061020a600083018461017a565b92915050565b600080fd5b61021881610170565b811461022357600080fd5b5056fea26469706673582212209c7e7e9d0e3b8b5d5e4c3a1f8b5c7e9d0e3b8b5d5e4c3a1f8b5c7e9d0e3b8b5d64736f6c63430008110033';

// ABI for SimpleStorage contract
const SIMPLE_STORAGE_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newValue",
                "type": "uint256"
            }
        ],
        "name": "ValueChanged",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "getValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "setValue",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "storedValue",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Store deployed contract address
let deployedContractAddress = null;

// Get deployment history from localStorage
function getDeploymentHistory() {
    try {
        const history = localStorage.getItem('deploymentHistory');
        return history ? JSON.parse(history) : [];
    } catch (e) {
        return [];
    }
}

// Save deployment to history
function saveDeploymentToHistory(address, wasSponsored = false) {
    const history = getDeploymentHistory();
    history.unshift({
        address: address,
        date: new Date().toISOString(),
        sponsored: wasSponsored
    });
    // Keep only last 10 deployments
    if (history.length > 10) {
        history.pop();
    }
    localStorage.setItem('deploymentHistory', JSON.stringify(history));
}

// Show deployment history
function showDeploymentHistory() {
    const historyContainer = document.getElementById('deployHistory');
    const historyList = document.getElementById('historyList');
    const history = getDeploymentHistory();
    
    if (historyContainer && historyList && history.length > 0) {
        historyList.innerHTML = history.map(item => {
            const date = new Date(item.date);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const shortAddress = item.address.slice(0, 8) + '...' + item.address.slice(-6);
            const sponsoredBadge = item.sponsored ? '<span class="sponsored-badge-small">Gasless</span>' : '';
            return `
                <div class="history-item">
                    <a href="https://basescan.org/address/${item.address}" target="_blank">${shortAddress}</a>
                    ${sponsoredBadge}
                    <span class="history-date">${dateStr}</span>
                </div>
            `;
        }).join('');
        historyContainer.style.display = 'block';
    }
}

// Reset deploy modal state
function resetDeployModal() {
    const deployStatus = document.getElementById('deployStatus');
    const deployResult = document.getElementById('deployResult');
    const deployBtn = document.getElementById('deployContractBtn');
    
    if (deployStatus) {
        deployStatus.textContent = '';
        deployStatus.className = 'deploy-status';
    }
    
    if (deployResult) {
        deployResult.style.display = 'none';
    }
    
    if (deployBtn) {
        deployBtn.disabled = false;
        deployBtn.classList.remove('loading');
        deployBtn.innerHTML = '<span>Deploy to Base</span>';
    }
    
    // Show deployment history
    showDeploymentHistory();
}

// Show deploy result
function showDeployResult(contractAddress, wasSponsored = false) {
    const deployResult = document.getElementById('deployResult');
    const addressLink = document.getElementById('contractAddressLink');
    const viewOnBasescanBtn = document.getElementById('viewOnBasescanBtn');
    const deployAnotherBtn = document.getElementById('deployAnotherBtn');
    const deployBtn = document.getElementById('deployContractBtn');
    const resultHeader = deployResult?.querySelector('.result-header');
    
    if (deployResult && addressLink) {
        addressLink.textContent = contractAddress;
        addressLink.href = `https://basescan.org/address/${contractAddress}`;
        deployResult.style.display = 'block';
        
        // Update header with sponsored badge if applicable
        if (resultHeader) {
            if (wasSponsored) {
                resultHeader.innerHTML = '<span class="sponsored-badge">Gasless</span> Contract Deployed!';
            } else {
                resultHeader.textContent = 'Contract Deployed!';
            }
        }
    }
    
    // Ensure buttons are visible
    if (viewOnBasescanBtn) {
        viewOnBasescanBtn.href = `https://basescan.org/address/${contractAddress}`;
        viewOnBasescanBtn.style.display = 'inline-flex';
    }
    
    if (deployAnotherBtn) {
        deployAnotherBtn.style.display = 'inline-flex';
    }
    
    if (deployBtn) {
        deployBtn.style.display = 'none';
    }
    
    // Update history display
    showDeploymentHistory();
}

// Reset for new deployment
function resetForNewDeploy() {
    const deployStatus = document.getElementById('deployStatus');
    const deployResult = document.getElementById('deployResult');
    const deployBtn = document.getElementById('deployContractBtn');
    const deployGaslessIndicator = document.getElementById('deployGaslessIndicator');
    const resultHeader = deployResult?.querySelector('.result-header');
    
    if (deployStatus) {
        deployStatus.textContent = '';
        deployStatus.className = 'deploy-status';
    }
    
    if (deployResult) {
        deployResult.style.display = 'none';
    }
    
    // Reset result header to default text
    if (resultHeader) {
        resultHeader.textContent = 'Contract Deployed!';
    }
    
    if (deployBtn) {
        deployBtn.style.display = 'flex';
        deployBtn.disabled = false;
        deployBtn.classList.remove('loading');
        
        // Restore button with gasless indicator if sponsorship is available
        if (SponsoredTransactions.isEligible && deployGaslessIndicator) {
            deployBtn.innerHTML = '<span>Deploy to Base</span><span id="deployGaslessIndicator" class="btn-gasless-indicator">Gasless</span>';
        } else {
            deployBtn.innerHTML = '<span>Deploy to Base</span>';
        }
    }
}

// Initialize deploy contract functionality
function initDeployContract() {
    const deployBtn = document.getElementById('deployContractBtn');
    const deployAnotherBtn = document.getElementById('deployAnotherBtn');
    
    if (deployBtn) {
        deployBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            DebugLogger.clearDeploy();
            DebugLogger.logDeploy('Deploy button clicked');
            await deployContract();
        });
        console.log('Deploy contract button initialized');
    }
    
    if (deployAnotherBtn) {
        deployAnotherBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetForNewDeploy();
        });
        console.log('Deploy another button initialized');
    }
}

// Run debug check for Deploy
async function runDeployDebugCheck() {
    DebugLogger.logDeploy('=== Debug Check Started ===');
    
    // Check ethers.js
    DebugLogger.logDeploy(`ethers.js: ${typeof ethers !== 'undefined' ? 'Loaded' : 'Not loaded'}`);
    
    // Check Farcaster SDK
    const sdk = SponsoredTransactions.getFarcasterSDK();
    DebugLogger.logDeploy(`Farcaster SDK: ${sdk ? 'Found' : 'Not found'}`);
    
    if (sdk) {
        DebugLogger.logDeploy(`SDK keys: ${Object.keys(sdk).join(', ')}`);
    }
    
    // Check window.ethereum
    DebugLogger.logDeploy(`window.ethereum: ${window.ethereum ? 'Found' : 'Not found'}`);
    
    // Try to get provider and capabilities
    try {
        let provider = sdk?.wallet?.ethProvider || window.ethereum;
        if (provider) {
            DebugLogger.logDeploy('Checking wallet...');
            
            try {
                const accounts = await provider.request({ method: 'eth_accounts' });
                DebugLogger.logDeploy(`Accounts: ${accounts?.length > 0 ? accounts[0].slice(0,10) + '...' : 'None'}`);
                
                if (accounts?.[0]) {
                    try {
                        const chainId = await provider.request({ method: 'eth_chainId' });
                        DebugLogger.logDeploy(`Chain ID: ${chainId} (${parseInt(chainId, 16)})`);
                    } catch (e) {
                        DebugLogger.logDeploy(`Chain error: ${e.message}`);
                    }
                    
                    try {
                        const caps = await provider.request({
                            method: 'wallet_getCapabilities',
                            params: [accounts[0]]
                        });
                        DebugLogger.logDeploy(`Capabilities: ${JSON.stringify(caps, null, 2)}`);
                    } catch (e) {
                        DebugLogger.logDeploy(`Capabilities error: ${e.message}`);
                    }
                }
            } catch (e) {
                DebugLogger.logDeploy(`Accounts error: ${e.message}`);
            }
        }
    } catch (e) {
        DebugLogger.logDeploy(`Provider error: ${e.message}`);
    }
    
    // Check sponsorship
    const sponsorAvailable = await SponsoredTransactions.checkSponsorshipAvailable();
    DebugLogger.logDeploy(`Sponsorship available: ${sponsorAvailable}`);
    DebugLogger.logDeploy(`Sponsor type: ${SponsoredTransactions.sponsorType || 'none'}`);
    
    DebugLogger.logDeploy('=== Debug Check Complete ===');
}

// Deploy smart contract
async function deployContract() {
    const deployBtn = document.getElementById('deployContractBtn');
    const deployStatus = document.getElementById('deployStatus');
    
    if (!deployBtn) return;
    
    // Set loading state
    deployBtn.disabled = true;
    deployBtn.classList.add('loading');
    deployBtn.innerHTML = '<span>Deploying...</span>';
    
    if (deployStatus) {
        deployStatus.textContent = 'Preparing gasless deployment...';
        deployStatus.className = 'deploy-status';
    }
    
    let wasSponsored = false;
    
    try {
        // Check for ethers.js with retry
        if (typeof ethers === 'undefined') {
            if (deployStatus) deployStatus.textContent = 'Loading ethers.js...';
            
            // Try to load ethers.js dynamically
            await new Promise((resolve, reject) => {
                const cdns = [
                    'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js',
                    'https://unpkg.com/ethers@5.7.2/dist/ethers.umd.min.js',
                    'https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js'
                ];
                
                let cdnIndex = 0;
                
                function tryNextCDN() {
                    if (typeof ethers !== 'undefined') {
                        resolve();
                        return;
                    }
                    
                    if (cdnIndex >= cdns.length) {
                        reject(new Error('Could not load ethers.js. Please check your internet connection and try again.'));
                        return;
                    }
                    
                    const script = document.createElement('script');
                    script.src = cdns[cdnIndex];
                    script.onload = () => {
                        if (typeof ethers !== 'undefined') {
                            resolve();
                        } else {
                            cdnIndex++;
                            tryNextCDN();
                        }
                    };
                    script.onerror = () => {
                        cdnIndex++;
                        tryNextCDN();
                    };
                    document.head.appendChild(script);
                }
                
                tryNextCDN();
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (typeof ethers === 'undefined') {
                        reject(new Error('ethers.js loading timeout. Please refresh the page.'));
                    }
                }, 10000);
            });
        }
        
        // Try Farcaster SDK first (for Base Mini App)
        const farcasterSDK = SponsoredTransactions.getFarcasterSDK();
        console.log('Deploy: Farcaster SDK detected:', !!farcasterSDK);
        
        let provider;
        let signer;
        let rawProvider; // For sponsored transactions
        let userAddress;
        
        if (farcasterSDK && farcasterSDK.wallet && farcasterSDK.wallet.ethProvider) {
            // Use Farcaster SDK's ethProvider (Base Mini App)
            console.log('Deploying via Farcaster SDK ethProvider');
            if (deployStatus) deployStatus.textContent = 'Connecting wallet...';
            
            const ethProvider = farcasterSDK.wallet.ethProvider;
            rawProvider = ethProvider;
            provider = new ethers.providers.Web3Provider(ethProvider);
            
            // Request accounts
            try {
                const accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
                userAddress = accounts[0];
                console.log('Got address from Farcaster:', userAddress);
            } catch (e) {
                console.log('eth_requestAccounts via Farcaster failed:', e.message);
            }
            
            if (!userAddress && farcasterSDK.context) {
                try {
                    const ctx = typeof farcasterSDK.context === 'function' 
                        ? await farcasterSDK.context() 
                        : await farcasterSDK.context;
                    userAddress = ctx?.user?.custodyAddress || ctx?.connectedAddress || ctx?.user?.verifiedAddresses?.ethAddresses?.[0];
                } catch (e) {
                    console.log('Could not get context:', e);
                }
            }
            
            if (userAddress) {
                signer = provider.getSigner();
            }
            
        }
        
        // Fallback to window.ethereum
        if (!userAddress && window.ethereum) {
            console.log('Deploying via window.ethereum');
            if (deployStatus) deployStatus.textContent = 'Connecting wallet...';
            
            rawProvider = window.ethereum;
            provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            userAddress = accounts[0];
            signer = provider.getSigner();
        }
        
        // Also check stored address
        if (!userAddress) {
            userAddress = window.__userAddress;
            console.log('Using stored address:', userAddress);
        }
        
        if (!userAddress || !signer) {
            throw new Error('No wallet found. Please use a Web3 browser or connect a wallet.');
        }
        
        // Check network - must be Base (chainId 8453)
        // Note: In Farcaster Mini Apps, network is usually already set to Base
        let network;
        try {
            network = await provider.getNetwork();
            console.log('Current network:', network);
        } catch (e) {
            console.log('Could not get network, assuming Base:', e.message);
            network = { chainId: 8453 };
        }
        
        if (network.chainId !== 8453 && rawProvider === window.ethereum) {
            if (deployStatus) deployStatus.textContent = 'Switching to Base network...';
            
            try {
                await rawProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x2105' }]
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await rawProvider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x2105',
                            chainName: 'Base',
                            nativeCurrency: {
                                name: 'Ethereum',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org']
                        }]
                    });
                } else {
                    throw new Error('Please switch to Base network in your wallet');
                }
            }
            
            // Refresh provider after network switch
            provider = new ethers.providers.Web3Provider(rawProvider);
            signer = provider.getSigner();
        }
        
        // ===== TRY SPONSORED DEPLOYMENT =====
        if (deployStatus) deployStatus.textContent = 'Preparing gasless deployment on Base...';
        console.log('Attempting sponsored contract deployment...');
        
        let contractAddress = null;
        
        // Build the deployment transaction data
        const factory = new ethers.ContractFactory(SIMPLE_STORAGE_ABI, SIMPLE_STORAGE_BYTECODE, signer);
        const deployTx = factory.getDeployTransaction();
        console.log('Deployment data prepared, length:', deployTx.data.length);
        
        // Try sponsored deployment via SponsoredTransactions
        try {
            const sponsorshipAvailable = await SponsoredTransactions.checkSponsorshipAvailable();
            console.log('Sponsorship available:', sponsorshipAvailable, 'Type:', SponsoredTransactions.sponsorType);
            
            if (sponsorshipAvailable && rawProvider) {
                if (deployStatus) deployStatus.textContent = 'Sending gasless deployment...';
                
                // For contract deployment: to = null/undefined, data = contract bytecode
                const deployTxParams = {
                    from: userAddress,
                    to: undefined, // undefined/null for contract creation
                    value: '0x0',
                    data: deployTx.data
                };
                
                // Try via SponsoredTransactions
                const sponsorResult = await SponsoredTransactions.sendTransaction(
                    rawProvider,
                    deployTxParams,
                    userAddress,
                    (status) => { if (deployStatus) deployStatus.textContent = status; }
                );
                
                if (sponsorResult.success && sponsorResult.txHash) {
                    wasSponsored = sponsorResult.sponsored || false;
                    console.log('Deployment transaction sent:', sponsorResult.txHash, wasSponsored ? '(sponsored)' : '(regular)');
                    
                    if (deployStatus) deployStatus.textContent = 'Waiting for confirmation...';
                    
                    // Wait for transaction receipt to get contract address
                    const receipt = await provider.waitForTransaction(sponsorResult.txHash);
                    contractAddress = receipt.contractAddress;
                    
                    console.log('Contract deployed at:', contractAddress);
                }
            }
        } catch (sponsorError) {
            console.log('Sponsored deployment failed, falling back:', sponsorError.message);
        }
        
        // ===== FALLBACK TO REGULAR DEPLOYMENT =====
        if (!contractAddress) {
            console.log('Using regular (non-sponsored) deployment');
            if (deployStatus) deployStatus.textContent = 'Confirm deployment in wallet...';
            
            // Create contract factory
            const factory = new ethers.ContractFactory(SIMPLE_STORAGE_ABI, SIMPLE_STORAGE_BYTECODE, signer);
            
            // Deploy contract
            console.log('Deploying contract...');
            const contract = await factory.deploy();
            
            console.log('Deploy transaction hash:', contract.deployTransaction.hash);
            if (deployStatus) deployStatus.textContent = 'Waiting for confirmation...';
            
            // Wait for deployment with timeout
            const deployedContract = await contract.deployed();
            
            // Verify the contract was actually deployed
            const deployTxHash = contract.deployTransaction.hash;
            console.log('Transaction hash:', deployTxHash);
            
            // Get transaction receipt to verify
            const receipt = await provider.getTransactionReceipt(deployTxHash);
            console.log('Transaction receipt:', receipt);
            
            if (!receipt) {
                throw new Error('Transaction not found. Please check your wallet.');
            }
            
            if (receipt.status === 0) {
                throw new Error('Transaction failed on-chain. Check BaseScan for details.');
            }
            
            // Use address from receipt (more reliable)
            contractAddress = receipt.contractAddress || deployedContract.address;
            console.log('Contract deployed at:', contractAddress);
            console.log('Block number:', receipt.blockNumber);
            console.log('Gas used:', receipt.gasUsed.toString());
            
            // Verify contract code exists
            const code = await provider.getCode(contractAddress);
            if (code === '0x' || code === '0x0') {
                console.warn('Warning: No code at contract address. Contract may not be deployed.');
            } else {
                console.log('Contract code verified, length:', code.length);
            }
        }
        
        if (!contractAddress) {
            throw new Error('Failed to get contract address');
        }
        
        deployedContractAddress = contractAddress;
        
        // Save to deployment history with sponsorship info
        saveDeploymentToHistory(contractAddress, wasSponsored);
        
        // Show success with sponsorship badge
        if (deployStatus) {
            const sponsoredBadge = wasSponsored ? '<span class="sponsored-badge">Gasless</span> ' : '';
            deployStatus.innerHTML = `${sponsoredBadge}Contract deployed successfully!`;
            deployStatus.className = 'deploy-status success';
        }
        
        showDeployResult(contractAddress, wasSponsored);
        
    } catch (error) {
        console.error('Deploy error:', error);
        
        // Reset button
        deployBtn.disabled = false;
        deployBtn.classList.remove('loading');
        deployBtn.innerHTML = '<span>Deploy to Base</span>';
        
        if (deployStatus) {
            let errorMessage = error.message || 'Deployment failed';
            if (error.code === 4001) {
                errorMessage = 'Transaction rejected by user';
            } else if (error.code === -32603) {
                errorMessage = 'Insufficient funds for gas';
            }
            deployStatus.textContent = 'Error: ' + errorMessage;
            deployStatus.className = 'deploy-status error';
        }
    }
}

// ==================== END DEPLOY CONTRACT FUNCTIONS ====================

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

        // Скрываем splash screen после успешной инициализации
        SplashScreenManager.hide();

    } catch (error) {
        console.error('Error initializing game:', error);
        console.error('Error stack:', error.stack);

        // Скрываем индикатор загрузки даже при ошибке
        hideLoadingIndicator();
        
        // Скрываем splash screen даже при ошибке
        SplashScreenManager.hide();

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

// ==================== SIMPLE GM FUNCTION ====================
// ==================== GM STREAK SYSTEM ====================

const GM_STORAGE_KEY = 'gm_streak_data';

function getGMStreakData() {
    try {
        const data = localStorage.getItem(GM_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading GM streak data:', e);
    }
    return { streak: 0, lastGMDate: null };
}

function saveGMStreakData(data) {
    try {
        localStorage.setItem(GM_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving GM streak data:', e);
    }
}

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

function canSendGMToday() {
    const data = getGMStreakData();
    const today = getTodayDateString();
    return data.lastGMDate !== today;
}

function updateGMStreak() {
    const data = getGMStreakData();
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    
    if (data.lastGMDate === yesterday) {
        // Continue streak
        data.streak += 1;
    } else if (data.lastGMDate !== today) {
        // Streak broken or first GM
        data.streak = 1;
    }
    
    data.lastGMDate = today;
    saveGMStreakData(data);
    return data.streak;
}

function updateGMUI() {
    const data = getGMStreakData();
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    
    const streakCountEl = document.getElementById('gmStreakCount');
    const gmSendBtn = document.getElementById('gmSendBtn');
    const gmNextAvailable = document.getElementById('gmNextAvailable');
    const gmStatus = document.getElementById('gmStatus');
    
    // Check if streak should be reset (missed a day)
    let displayStreak = data.streak;
    if (data.lastGMDate && data.lastGMDate !== today && data.lastGMDate !== yesterday) {
        // Streak is broken
        displayStreak = 0;
    }
    
    if (streakCountEl) {
        streakCountEl.textContent = displayStreak;
    }
    
    const canSend = canSendGMToday();
    
    if (gmSendBtn) {
        if (canSend) {
            gmSendBtn.disabled = false;
            gmSendBtn.textContent = 'Say GM';
            gmSendBtn.style.background = '';
        } else {
            gmSendBtn.disabled = true;
            gmSendBtn.textContent = 'GM Sent Today';
            gmSendBtn.style.background = '#4ade80';
        }
    }
    
    if (gmNextAvailable) {
        if (!canSend) {
            // Calculate time until midnight
            const now = new Date();
            const midnight = new Date(now);
            midnight.setDate(midnight.getDate() + 1);
            midnight.setHours(0, 0, 0, 0);
            const hoursLeft = Math.floor((midnight - now) / (1000 * 60 * 60));
            const minutesLeft = Math.floor(((midnight - now) % (1000 * 60 * 60)) / (1000 * 60));
            gmNextAvailable.textContent = `Next GM available in ${hoursLeft}h ${minutesLeft}m`;
        } else {
            gmNextAvailable.textContent = '';
        }
    }
    
    if (gmStatus && canSend) {
        gmStatus.textContent = '';
        gmStatus.style.color = '';
    }
}

async function sendSimpleGM() {
    const gmStatus = document.getElementById('gmStatus');
    const gmSendBtn = document.getElementById('gmSendBtn');
    
    // Check if already sent today
    if (!canSendGMToday()) {
        if (gmStatus) {
            gmStatus.textContent = 'You already said GM today!';
            gmStatus.style.color = '#f59e0b';
        }
        return;
    }
    
    if (gmSendBtn) {
        gmSendBtn.disabled = true;
        gmSendBtn.textContent = 'Sending...';
    }
    if (gmStatus) gmStatus.textContent = 'Connecting to wallet...';
    
    try {
        // Get provider
        let provider = null;
        const sdk = window.sdk || (typeof frame !== 'undefined' && frame.sdk) || window.__farcasterSDK;
        
        if (sdk?.wallet?.ethProvider) {
            provider = sdk.wallet.ethProvider;
        } else if (window.ethereum) {
            provider = window.ethereum;
        }
        
        if (!provider) {
            throw new Error('No wallet found');
        }
        
        // Get account
        if (gmStatus) gmStatus.textContent = 'Getting account...';
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];
        
        if (!from) {
            throw new Error('No account connected');
        }
        
        // Send minimal transaction (same format as working Deploy)
        if (gmStatus) gmStatus.textContent = 'Please confirm transaction...';
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: from,
                to: from,
                data: '0x'
            }]
        });
        
        console.log('GM TX sent:', txHash);
        
        // Update streak
        const newStreak = updateGMStreak();
        
        if (gmStatus) {
            gmStatus.innerHTML = `GM sent! Streak: ${newStreak} <a href="https://basescan.org/tx/${txHash}" target="_blank" style="color: #0052ff;">View TX</a>`;
            gmStatus.style.color = '#4ade80';
        }
        
        // Update UI
        updateGMUI();
        
    } catch (error) {
        console.error('GM error:', error);
        if (gmStatus) {
            gmStatus.textContent = error.message || 'Transaction failed';
            gmStatus.style.color = '#ef4444';
        }
        if (gmSendBtn) {
            gmSendBtn.disabled = false;
            gmSendBtn.textContent = 'Say GM';
        }
    }
}

// ==================== DEPLOY CONTRACT SYSTEM ====================
// Uses SIMPLE_STORAGE_BYTECODE defined earlier in the file

const DEPLOY_STORAGE_KEY = 'deployed_contracts';

function getDeployedContracts() {
    try {
        const data = localStorage.getItem(DEPLOY_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading deployed contracts:', e);
    }
    return [];
}

function saveDeployedContract(txHash) {
    try {
        const contracts = getDeployedContracts();
        contracts.unshift({
            txHash: txHash,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        });
        localStorage.setItem(DEPLOY_STORAGE_KEY, JSON.stringify(contracts));
    } catch (e) {
        console.error('Error saving deployed contract:', e);
    }
}

function updateDeployUI() {
    const contracts = getDeployedContracts();
    const deployCountEl = document.getElementById('deployCount');
    const contractsListEl = document.getElementById('deployedContractsList');
    
    if (deployCountEl) {
        deployCountEl.textContent = contracts.length;
    }
    
    if (contractsListEl) {
        if (contracts.length === 0) {
            contractsListEl.innerHTML = '<p style="color: #666; text-align: center; font-size: 14px;">No contracts deployed yet</p>';
        } else {
            contractsListEl.innerHTML = contracts.map((contract, index) => `
                <div style="padding: 10px; margin-bottom: 8px; background: rgba(0,82,255,0.1); border-radius: 8px; border-left: 3px solid #0052ff;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">#${contracts.length - index} - ${contract.date}</div>
                    <a href="https://basescan.org/tx/${contract.txHash}" target="_blank" style="color: #0052ff; font-size: 13px; word-break: break-all;">
                        ${contract.txHash.slice(0, 16)}...${contract.txHash.slice(-8)}
                    </a>
                </div>
            `).join('');
        }
    }
}

async function sendSimpleDeploy() {
    const deployStatus = document.getElementById('deployStatus');
    const deployBtn = document.getElementById('deployBtn');
    
    if (deployBtn) {
        deployBtn.disabled = true;
        deployBtn.textContent = 'Deploying...';
    }
    if (deployStatus) {
        deployStatus.textContent = 'Connecting to wallet...';
        deployStatus.style.color = '';
    }
    
    try {
        // Get provider
        let provider = null;
        const sdk = window.sdk || (typeof frame !== 'undefined' && frame.sdk) || window.__farcasterSDK;
        
        if (sdk?.wallet?.ethProvider) {
            provider = sdk.wallet.ethProvider;
        } else if (window.ethereum) {
            provider = window.ethereum;
        }
        
        if (!provider) {
            throw new Error('No wallet found');
        }
        
        // Get account
        if (deployStatus) deployStatus.textContent = 'Getting account...';
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];
        
        if (!from) {
            throw new Error('No account connected');
        }
        
        // Deploy contract
        if (deployStatus) deployStatus.textContent = 'Please confirm transaction...';
        
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: from,
                data: SIMPLE_STORAGE_BYTECODE
            }]
        });
        
        console.log('Deploy TX sent:', txHash);
        
        // Save to list
        saveDeployedContract(txHash);
        
        if (deployStatus) {
            deployStatus.innerHTML = `Contract deployed! <a href="https://basescan.org/tx/${txHash}" target="_blank" style="color: #0052ff;">View TX</a>`;
            deployStatus.style.color = '#4ade80';
        }
        
        // Update UI and re-enable button for next deploy
        updateDeployUI();
        
        if (deployBtn) {
            deployBtn.disabled = false;
            deployBtn.textContent = 'Deploy Another';
        }
        
    } catch (error) {
        console.error('Deploy error:', error);
        if (deployStatus) {
            deployStatus.textContent = error.message || 'Deploy failed';
            deployStatus.style.color = '#ef4444';
        }
        if (deployBtn) {
            deployBtn.disabled = false;
            deployBtn.textContent = 'Deploy Contract';
        }
    }
}

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

            // Скрываем игровой контейнер при ошибке
            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                gameContainer.style.display = 'none';
            }
            
            // Показываем меню при ошибке
            const startMenu = document.getElementById('startMenu');
            if (startMenu) {
                startMenu.style.display = 'flex';
            }

            console.error('Game initialization failed, showing menu');
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
