// Zora Trade Quote API endpoint
// Uses @zoralabs/coins-sdk to compute proper trade calldata
// for buying a Zora Coin with ETH on Base

import { createTradeCall } from '@zoralabs/coins-sdk';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        return res.status(200).json({ success: true, message: 'Zora Quote API active' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { coinAddress, sender, amountIn, slippage = 0.05, recipient } = req.body;

        if (!coinAddress || !sender || !amountIn) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: coinAddress, sender, amountIn'
            });
        }

        console.log(`Zora quote: coin=${coinAddress}, sender=${sender}, amount=${amountIn}, slippage=${slippage}`);

        const tradeParameters = {
            sell: { type: 'eth' },
            buy: { type: 'erc20', address: coinAddress },
            amountIn: BigInt(amountIn),
            slippage: slippage,
            sender: sender,
            recipient: recipient || sender,
        };

        const quote = await createTradeCall(tradeParameters);

        console.log('Zora quote result:', JSON.stringify({
            target: quote.call?.target,
            dataPrefix: quote.call?.data?.substring(0, 66),
            value: quote.call?.value?.toString()
        }));

        return res.status(200).json({
            success: true,
            call: {
                target: quote.call.target,
                data: quote.call.data,
                value: quote.call.value.toString()
            }
        });

    } catch (error) {
        console.error('Zora quote error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get trade quote'
        });
    }
}
