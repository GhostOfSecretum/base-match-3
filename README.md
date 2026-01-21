# Base Match-3 - Mini App

A fast-paced match-3 puzzle game featuring crypto tokens, built for Base Mini Apps.

## Features

- 🎮 Classic match-3 gameplay with crypto token themes
- 🚀 Special tokens: Rockets and Bombs
- 🔥 Combo system for bonus points
- 💎 6 different crypto tokens (AAVE, AERO, AVNT, BASE, DEGEN, USDC)
- ⚡ Optimized performance for Base app

## Setup for Base Mini App

### Prerequisites

- Node.js installed
- Base app account
- Hosted domain for your app

### Installation

1. Install dependencies:
```bash
npm install
```

2. Update manifest file:
   - Edit `.well-known/farcaster.json`
   - Replace `https://your-app.com` with your actual domain
   - Add your icon, splash, and screenshot URLs

3. Generate Account Association:
   - Deploy your app so the manifest is accessible
   - Go to [Base Build Account Association Tool](https://build.base.org/account-association)
   - Enter your app URL and generate credentials
   - Copy the `accountAssociation` fields into `.well-known/farcaster.json`

4. Update embed metadata:
   - Edit `index.html` and update the `fc:miniapp` meta tag with your actual URLs

5. Deploy:
   - Deploy to your hosting service (Vercel, Netlify, etc.)
   - Ensure `.well-known/farcaster.json` is accessible at `https://your-domain.com/.well-known/farcaster.json`

6. Preview:
   - Use [Base Build Preview Tool](https://build.base.org/preview) to test your app

7. Publish:
   - Create a post in Base app with your app URL

## Development

Run local server:
```bash
npm start
# or
python3 -m http.server 8000
```

## File Structure

```
.
├── index.html              # Main HTML file with embed metadata
├── style.css               # Game styles
├── script.js               # Game logic with MiniApp SDK integration
├── .well-known/
│   └── farcaster.json     # Mini app manifest
├── assets/
│   ├── crypto/            # Crypto token logos
│   └── Logotype/          # Base brand assets
└── package.json           # Dependencies
```

## Mini App Requirements

- ✅ MiniApp SDK integrated
- ✅ `sdk.actions.ready()` called on load
- ✅ Manifest file at `/.well-known/farcaster.json`
- ✅ Embed metadata in HTML
- ✅ Account association credentials

## Sponsored Transactions (Gasless)

This app supports gasless transactions via Coinbase CDP Paymaster. Users can perform GM Streak transactions and deploy contracts without paying gas fees.

### Setup Sponsored Transactions

1. **Get Coinbase CDP API Key:**
   - Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
   - Create a new project or select existing one
   - Navigate to API Keys section
   - Create a new API key with Paymaster permissions
   - Copy the API key

2. **Configure Environment Variable:**
   
   For Vercel deployment:
   ```bash
   # In Vercel Dashboard -> Settings -> Environment Variables
   # Add the following:
   CDP_API_KEY=your_coinbase_cdp_api_key_here
   ```
   
   For local development:
   ```bash
   # Create .env.local file
   echo "CDP_API_KEY=your_coinbase_cdp_api_key_here" > .env.local
   ```

3. **Test Sponsorship:**
   - Deploy your app
   - Open the app in Farcaster/Base
   - Try the "Say GM" or "Deploy to Base" features
   - If configured correctly, you'll see a "Gasless" badge

### How It Works

```
User Action → Frontend → /api/paymaster → Coinbase CDP Paymaster → Base Network
                                    ↓
                          Gas fees paid by sponsor
```

The Paymaster API (`/api/paymaster.js`) proxies requests to Coinbase CDP, keeping your API key secure on the server side. Transactions are automatically upgraded to gasless when:

1. CDP_API_KEY is configured
2. User's wallet supports EIP-5792 (wallet_sendCalls)
3. Transaction is eligible for sponsorship

If sponsorship fails, the app falls back to regular transactions where the user pays gas.

### Supported Transactions

| Transaction | Sponsored | Fallback |
|-------------|-----------|----------|
| GM Streak | ✅ Yes | User pays gas |
| Contract Deploy | ✅ Yes | User pays gas |

## Resources

- [Base Mini Apps Documentation](https://docs.base.org/mini-apps/quickstart/migrate-existing-apps)
- [Base Build](https://build.base.org)
- [Coinbase CDP Paymaster](https://docs.cdp.coinbase.com/paymaster/docs/welcome)
- [EIP-5792 Wallet Capabilities](https://eips.ethereum.org/EIPS/eip-5792)
