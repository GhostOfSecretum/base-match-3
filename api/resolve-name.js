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
        let farcasterUsername = null;
        let avatar = null;
        let source = null;
        
        // 1. Пробуем Warpcast (Farcaster) - главный источник для Base App
        // Приоритет: username (farcaster handle) для формата username.farcaster(base).eth
        try {
            const warpcastResponse = await fetch(
                `https://api.warpcast.com/v2/user-by-verification?address=${normalizedAddress}`,
                { headers: { 'Accept': 'application/json' } }
            );
            
            if (warpcastResponse.ok) {
                const data = await warpcastResponse.json();
                if (data.result?.user) {
                    // Используем username (farcaster handle) для лидерборда
                    farcasterUsername = data.result.user.username || null;
                    name = farcasterUsername || data.result.user.displayName;
                    avatar = data.result.user.pfp?.url;
                    source = 'warpcast';
                    console.log(`Warpcast resolved ${normalizedAddress} to username: ${farcasterUsername}, name: ${name}`);
                }
            }
        } catch (e) {
            console.log('Warpcast error:', e.message);
        }
        
        // 2. Пробуем Neynar (Farcaster)
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
                        // Используем username (farcaster handle) для лидерборда
                        farcasterUsername = data.user.username || null;
                        name = farcasterUsername || data.user.display_name;
                        avatar = data.user.pfp_url || data.user.pfp?.url;
                        source = 'neynar';
                        console.log(`Neynar resolved ${normalizedAddress} to username: ${farcasterUsername}, name: ${name}`);
                    }
                }
            } catch (e) {
                console.log('Neynar error:', e.message);
            }
        }
        
        // 3. Пробуем Basenames
        if (!name) {
            try {
                const basenameResponse = await fetch(
                    `https://resolver-api.basename.app/v1/addresses/${normalizedAddress}`,
                    { headers: { 'Accept': 'application/json' } }
                );
                
                if (basenameResponse.ok) {
                    const data = await basenameResponse.json();
                    if (data.name || data.basename) {
                        name = data.name || data.basename;
                        avatar = data.avatar || data.avatar_url || data.image;
                        source = 'basenames';
                        console.log(`Basenames resolved ${normalizedAddress} to ${name}`);
                    }
                }
            } catch (e) {
                console.log('Basenames error:', e.message);
            }
        }
        
        // 4. Пробуем ENS
        if (!name) {
            try {
                const ensResponse = await fetch(
                    `https://api.ensideas.com/ens/resolve/${normalizedAddress}`,
                    { headers: { 'Accept': 'application/json' } }
                );
                
                if (ensResponse.ok) {
                    const data = await ensResponse.json();
                    if (data.name) {
                        name = data.name;
                        avatar = data.avatar;
                        source = 'ens';
                        console.log(`ENS resolved ${normalizedAddress} to ${name}`);
                    }
                }
            } catch (e) {
                console.log('ENS error:', e.message);
            }
        }
        
        // Формируем имя в формате username.farcaster(base).eth
        let formattedName = name;
        if (farcasterUsername) {
            formattedName = `${farcasterUsername}.farcaster(base).eth`;
        } else if (name) {
            // Убираем суффиксы если есть
            let baseName = name;
            if (baseName.includes('.base.eth')) baseName = baseName.replace('.base.eth', '');
            else if (baseName.endsWith('.eth')) baseName = baseName.replace('.eth', '');
            if (baseName.startsWith('@')) baseName = baseName.substring(1);
            formattedName = `${baseName}.farcaster(base).eth`;
        }
        
        return res.status(200).json({
            success: true,
            address: normalizedAddress,
            name: formattedName,
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
