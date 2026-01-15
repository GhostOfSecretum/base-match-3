# Deployment Checklist

## Before Publishing to Base App

### 1. Deploy Your App
- Deploy to hosting service (Vercel, Netlify, etc.)
- Ensure your app is accessible via HTTPS
- Note your app URL (e.g., `https://your-app.vercel.app`)

### 2. Update URLs in Files

#### Update `.well-known/farcaster.json`:
- Replace all `https://your-app.com` with your actual domain
- Add your icon, splash, and screenshot URLs
- Update `homeUrl`, `iconUrl`, `splashImageUrl`, `screenshotUrls`, etc.

#### Update `index.html`:
- Update `fc:miniapp` meta tag with your actual URLs
- Replace `https://your-app.com` with your domain

### 3. Generate Account Association

1. Ensure your manifest is live at `https://your-domain.com/.well-known/farcaster.json`
2. Go to [Base Build Account Association Tool](https://build.base.org/account-association)
3. Enter your app URL
4. Click "Submit" then "Verify"
5. Follow instructions to generate credentials
6. Copy the `accountAssociation` fields:
   - `header`
   - `payload`
   - `signature`
7. Paste them into `.well-known/farcaster.json`

### 4. Create Required Images

You'll need to create and host these images:
- **Icon**: 512x512px PNG (for app icon)
- **Splash Image**: 1200x630px PNG (loading screen)
- **Screenshots**: 3+ screenshots of your game (1200x630px each)
- **Hero Image**: 1200x630px PNG (for social sharing)
- **OG Image**: 1200x630px PNG (Open Graph image)
- **Embed Image**: 1200x630px PNG (for rich embeds)

### 5. Test Your App

1. Use [Base Build Preview Tool](https://build.base.org/preview)
2. Enter your app URL
3. Check:
   - ✅ Manifest loads correctly
   - ✅ Account association is valid
   - ✅ Metadata displays properly
   - ✅ App launches correctly

### 6. Publish

1. Create a post in Base app
2. Include your app URL
3. Your app will appear in Base app's mini apps section

## Current Status

- ✅ MiniApp SDK integrated
- ✅ Manifest file created (needs URLs and account association)
- ✅ Embed metadata added (needs URLs)
- ✅ Game fully functional
- ⏳ Waiting for deployment and account association
