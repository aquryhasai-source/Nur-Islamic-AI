# NŪR — Islamic Knowledge Assistant PWA

## Project Structure
```
Nur-Islamic-AI/
│
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
│
├── public/
│   ├── manifest.json
│   ├── sw.js      
│   ├── icon-192.png   
│   └── icon-512.png    
│
└── src/
    ├── Main.jsx      
    ├── NurApp.jsx      
    ├── ChatTab.jsx    
    ├── QuranTab.jsx  
    ├── HadithTab.jsx  
    ├── Sidebar.jsx    
    └── utils.js      
```

## Before deploying — add these to Supabase

Go to your Supabase project → Settings → Edge Functions → Secrets and add:
- `GROQ_API_KEY` → your Groq API key (get it at console.groq.com)

## Deploy to Vercel (free, ~5 minutes)

1. Push this folder to a GitHub repo
2. Go to vercel.com → "Add New Project"
3. Import your GitHub repo
4. Vercel auto-detects Vite → click Deploy
5. Done! You get a URL like `nur-islamic-assistant.vercel.app`

## Add app icons

Create two PNG icons with a dark green background and the NŪR crescent:
- `public/icon-192.png` (192×192px)
- `public/icon-512.png` (512×512px)

You can use any free icon generator (e.g. realfavicongenerator.net).

## Share the app

Once deployed, share your Vercel URL anywhere:
- WhatsApp, Telegram, Instagram bio
- Users on Android: tap browser menu → "Add to Home Screen"
- Users on iPhone: tap Share → "Add to Home Screen"

## Add payment later

When ready, update two things in `src/NurApp.jsx`:
1. `STRIPE_PORTAL` → your payment portal URL
2. The "Unlock Lifetime Access" button href → your payment link

Then redeploy. That's it.
