// Paymaster API endpoint for Coinbase CDP sponsored transactions
// This endpoint proxies requests to Coinbase Developer Platform Paymaster
// to keep the API key secure on the server side

// Base mainnet chain ID
const BASE_CHAIN_ID = '0x2105'; // 8453

// EntryPoint v0.6 address (standard for ERC-4337)
const ENTRYPOINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

/**
 * Get the CDP Paymaster URL with API key embedded
 * CDP requires the API key in the URL path, not in headers
 */
function getCdpPaymasterUrl(apiKey) {
    return `https://api.developer.coinbase.com/rpc/v1/base/${apiKey}`;
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Health check endpoint
    if (req.method === 'GET') {
        const apiKey = process.env.CDP_API_KEY;
        return res.status(200).json({
            success: true,
            message: 'Paymaster API is active',
            sponsoredTransactions: true,
            network: 'Base Mainnet',
            chainId: BASE_CHAIN_ID,
            configured: !!apiKey,
            keyLength: apiKey ? apiKey.length : 0
        });
    }

    // Handle POST requests for paymaster operations
    if (req.method === 'POST') {
        try {
            const { action, userOp, calls } = req.body;

            // Check if CDP API key is configured
            const apiKey = process.env.CDP_API_KEY;
            if (!apiKey) {
                console.error('CDP_API_KEY not configured in environment variables');
                return res.status(500).json({
                    success: false,
                    error: 'Paymaster not configured - CDP_API_KEY missing',
                    sponsored: false,
                    debug: {
                        hasKey: false,
                        message: 'Please add CDP_API_KEY to Vercel environment variables'
                    }
                });
            }

            console.log(`Paymaster request: action=${action}, keyLength=${apiKey.length}`);

            // Route to appropriate handler based on action
            switch (action) {
                case 'getPaymasterData':
                    return await handleGetPaymasterData(req, res, apiKey, userOp);
                
                case 'sponsorUserOperation':
                    return await handleSponsorUserOperation(req, res, apiKey, userOp);
                
                case 'sendSponsoredTransaction':
                    return await handleSendSponsoredTransaction(req, res, apiKey, calls);
                
                case 'checkSponsorshipEligibility':
                    return await handleCheckEligibility(req, res, apiKey);
                
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Unknown action. Supported: getPaymasterData, sponsorUserOperation, sendSponsoredTransaction, checkSponsorshipEligibility'
                    });
            }

        } catch (error) {
            console.error('Paymaster API error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Internal server error',
                sponsored: false
            });
        }
    }

    return res.status(405).json({
        success: false,
        error: 'Method not allowed'
    });
}

/**
 * Get paymaster stub data for a UserOperation
 * This is used to estimate gas with paymaster
 */
async function handleGetPaymasterData(req, res, apiKey, userOp) {
    try {
        const cdpUrl = getCdpPaymasterUrl(apiKey);
        console.log('Calling CDP pm_getPaymasterStubData...');
        
        const response = await fetch(cdpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_getPaymasterStubData',
                params: [
                    userOp,
                    ENTRYPOINT_ADDRESS,
                    BASE_CHAIN_ID
                ]
            })
        });

        const data = await response.json();
        console.log('CDP pm_getPaymasterStubData response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            console.error('CDP Paymaster error:', data.error);
            return res.status(400).json({
                success: false,
                error: data.error.message || 'Paymaster request failed',
                sponsored: false,
                cdpError: data.error
            });
        }

        return res.status(200).json({
            success: true,
            sponsored: true,
            paymasterAndData: data.result?.paymasterAndData || data.result,
            ...data.result
        });

    } catch (error) {
        console.error('getPaymasterData error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            sponsored: false
        });
    }
}

/**
 * Sponsor a complete UserOperation
 * This signs the UserOperation with paymaster data
 */
async function handleSponsorUserOperation(req, res, apiKey, userOp) {
    try {
        const cdpUrl = getCdpPaymasterUrl(apiKey);
        console.log('Sponsoring UserOperation...');
        
        // First get paymaster stub data
        const stubResponse = await fetch(cdpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_getPaymasterStubData',
                params: [
                    userOp,
                    ENTRYPOINT_ADDRESS,
                    BASE_CHAIN_ID
                ]
            })
        });

        const stubData = await stubResponse.json();
        console.log('CDP stub response:', JSON.stringify(stubData).substring(0, 500));

        if (stubData.error) {
            throw new Error(stubData.error.message || 'Failed to get paymaster stub data');
        }

        // Update userOp with stub data for gas estimation
        const userOpWithStub = {
            ...userOp,
            paymasterAndData: stubData.result?.paymasterAndData || stubData.result
        };

        // Now get the final paymaster data
        const finalResponse = await fetch(cdpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'pm_getPaymasterData',
                params: [
                    userOpWithStub,
                    ENTRYPOINT_ADDRESS,
                    BASE_CHAIN_ID
                ]
            })
        });

        const finalData = await finalResponse.json();
        console.log('CDP final response:', JSON.stringify(finalData).substring(0, 500));

        if (finalData.error) {
            throw new Error(finalData.error.message || 'Failed to get final paymaster data');
        }

        return res.status(200).json({
            success: true,
            sponsored: true,
            paymasterAndData: finalData.result?.paymasterAndData || finalData.result,
            sponsorMetadata: {
                name: 'Base Match-3',
                description: 'Gasless transaction sponsored by Base Match-3 game'
            }
        });

    } catch (error) {
        console.error('sponsorUserOperation error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            sponsored: false
        });
    }
}

/**
 * Send a sponsored transaction using wallet_sendCalls
 * This is the simplified approach for EIP-5792 compatible wallets
 * Returns the paymaster service URL for client-side wallet_sendCalls
 */
async function handleSendSponsoredTransaction(req, res, apiKey, calls) {
    try {
        // CDP Paymaster URL format: https://api.developer.coinbase.com/rpc/v1/base/{API_KEY}
        const paymasterServiceUrl = getCdpPaymasterUrl(apiKey);

        console.log('Returning paymaster service config for wallet_sendCalls');
        console.log('Paymaster URL (masked):', paymasterServiceUrl.replace(apiKey, '***'));

        // Return the configuration for client-side wallet_sendCalls (EIP-5792)
        // The paymasterServiceUrl is used in the capabilities.paymasterService.url field
        return res.status(200).json({
            success: true,
            sponsored: true,
            // Primary URL field for the client
            paymasterServiceUrl: paymasterServiceUrl,
            // Also include in capabilities for compatibility
            capabilities: {
                paymasterService: {
                    url: paymasterServiceUrl,
                    supported: true
                }
            },
            chainId: BASE_CHAIN_ID,
            entryPoint: ENTRYPOINT_ADDRESS,
            sponsorMetadata: {
                name: 'Base Match-3',
                description: 'Gasless transaction sponsored by Base Match-3 game'
            }
        });

    } catch (error) {
        console.error('sendSponsoredTransaction error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            sponsored: false
        });
    }
}

/**
 * Check if sponsorship is available and wallet is eligible
 */
async function handleCheckEligibility(req, res, apiKey) {
    try {
        const cdpUrl = getCdpPaymasterUrl(apiKey);
        console.log('Checking sponsorship eligibility...');
        
        // Make a simple request to check if the API key is valid
        // Using pm_supportedEntryPoints to validate the connection
        const response = await fetch(cdpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_supportedEntryPoints',
                params: []
            })
        });

        const data = await response.json();
        console.log('CDP eligibility check response:', JSON.stringify(data));

        if (data.error) {
            console.error('CDP eligibility error:', data.error);
            return res.status(200).json({
                success: true,
                eligible: false,
                sponsored: false,
                reason: data.error.message || 'Paymaster service unavailable',
                cdpError: data.error
            });
        }

        return res.status(200).json({
            success: true,
            eligible: true,
            sponsored: true,
            entryPoints: data.result,
            network: 'Base Mainnet',
            chainId: BASE_CHAIN_ID
        });

    } catch (error) {
        console.error('checkEligibility error:', error);
        return res.status(200).json({
            success: true,
            eligible: false,
            sponsored: false,
            reason: error.message
        });
    }
}
