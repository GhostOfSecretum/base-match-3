// API endpoint для резолвинга имён по адресу кошелька
// Обходит CORS ограничения браузера

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { address } = req.query;
    
    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }
    
    const normalizedAddress = address.toLowerCase();
    
    try {
        let name = null;
        let basenamesDomain = null;
        let farcasterUsername = null;
        let avatar = null;
        let source = null;
        
        // 1. Пробуем Basenames ПЕРВЫМ - приоритет доменного имени из профиля Base App
        try {
            const basenameResponse = await fetch(
                `https://resolver-api.basename.app/v1/addresses/${normalizedAddress}`,
                { headers: { 'Accept': 'application/json' } }
            );
            
            if (basenameResponse.ok) {
                const data = await basenameResponse.json();
                if (data.name || data.basename) {
                    const rawBasename = data.name || data.basename;
                    // Сохраняем доменное имя как есть
                    if (rawBasename.endsWith('.base.eth')) {
                        basenamesDomain = rawBasename;
                    } else if (rawBasename.endsWith('.eth')) {
                        basenamesDomain = rawBasename;
                    } else {
                        basenamesDomain = `${rawBasename}.base.eth`;
                    }
                    name = basenamesDomain;
                    avatar = data.avatar || data.avatar_url || data.image;
                    source = 'basenames';
                    console.log(`Basenames resolved ${normalizedAddress} to ${basenamesDomain}`);
                }
            }
        } catch (e) {
            console.log('Basenames error:', e.message);
        }
        
        // 2. Пробуем ENS (если нет Basename)
        if (!name) {
            try {
                const ensResponse = await fetch(
                    `https://api.ensideas.com/ens/resolve/${normalizedAddress}`,
                    { headers: { 'Accept': 'application/json' } }
                );
                
                if (ensResponse.ok) {
                    const data = await ensResponse.json();
                    if (data.name) {
                        name = data.name; // ENS имя уже в формате name.eth
                        avatar = data.avatar;
                        source = 'ens';
                        console.log(`ENS resolved ${normalizedAddress} to ${name}`);
                    }
                }
            } catch (e) {
                console.log('ENS error:', e.message);
            }
        }
        
        // 3. Пробуем Warpcast (Farcaster) - для аватара и fallback имени
        try {
            const warpcastResponse = await fetch(
                `https://api.warpcast.com/v2/user-by-verification?address=${normalizedAddress}`,
                { headers: { 'Accept': 'application/json' } }
            );
            
            if (warpcastResponse.ok) {
                const data = await warpcastResponse.json();
                if (data.result?.user) {
                    farcasterUsername = data.result.user.username || null;
                    if (!name) {
                        // Farcaster username как fallback - форматируем как .base.eth
                        const username = farcasterUsername || data.result.user.displayName;
                        if (username) {
                            name = `${username}.base.eth`;
                        }
                    }
                    if (!avatar) avatar = data.result.user.pfp?.url;
                    if (!source) source = 'warpcast';
                    console.log(`Warpcast resolved ${normalizedAddress} to username: ${farcasterUsername}`);
                }
            }
        } catch (e) {
            console.log('Warpcast error:', e.message);
        }
        
        // 4. Пробуем Neynar (Farcaster) - для аватара и fallback имени
        if (!name) {
            try {
                const neynarResponse = await fetch(
                    `https://api.neynar.com/v2/farcaster/user/by_verification?address=${normalizedAddress}`,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'api_key': 'NEYNAR_API_DOCS'
                        }
                    }
                );
                
                if (neynarResponse.ok) {
                    const data = await neynarResponse.json();
                    if (data.user) {
                        farcasterUsername = data.user.username || null;
                        const username = farcasterUsername || data.user.display_name;
                        if (username) {
                            name = `${username}.base.eth`;
                        }
                        if (!avatar) avatar = data.user.pfp_url || data.user.pfp?.url;
                        source = 'neynar';
                        console.log(`Neynar resolved ${normalizedAddress} to username: ${farcasterUsername}`);
                    }
                }
            } catch (e) {
                console.log('Neynar error:', e.message);
            }
        }
        
        return res.status(200).json({
            success: true,
            address: normalizedAddress,
            name: name,
            basenamesDomain: basenamesDomain,
            farcasterUsername: farcasterUsername,
            avatar: avatar,
            source: source
        });
        
    } catch (error) {
        console.error('Name resolution error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve name'
        });
    }
}
