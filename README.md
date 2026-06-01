# Snug Chat App 💬

A real-time chat application with video/voice calls, avatar uploads, and private messaging.

## Features
- 💬 Real-time group & private messaging
- 📹 Video & voice calls (WebRTC)
- 🎤 Voice messages
- 🖼️ Image sharing with drag & drop
- 👤 Avatar upload & profile management
- 🌐 Message translation
- 😀 Emoji picker

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Express + Socket.IO
- **Database:** LowDB (JSON file)

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm start

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

---

## Deployment (Render - Free Tier)

### Option 1: Separate Services (Recommended)

#### Backend (Web Service)
1. Create a **Web Service** on [Render](https://render.com)
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Environment Variables:
   - `PORT` = `3001`
   - `CORS_ORIGIN` = `https://your-frontend.onrender.com`

#### Frontend (Static Site)
1. Create a **Static Site** on Render
2. Connect the same GitHub repo
3. Settings:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Environment Variables:
   - `VITE_API_URL` = `https://your-backend.onrender.com`

### Option 2: Single Service (Backend serves Frontend)

1. Create a **Web Service** on Render
2. Settings:
   - **Root Directory:** (leave empty / repo root)
   - **Build Command:** `cd frontend && npm install && npm run build && cd ../backend && npm install`
   - **Start Command:** `cd backend && node server.js`
3. Environment Variables:
   - `PORT` = `3001`
   - `CORS_ORIGIN` = `https://your-app.onrender.com`

> The backend auto-serves the frontend build from `frontend/dist/` in production.

---

## First-Time Setup After Deploy

The app will auto-create `db.json` on first run. Just register a new account and start chatting!

## Notes
- Video/voice calls require **HTTPS** (Render provides this automatically)
- Uploaded images and avatars are stored in the `uploads/` folder on the server
- On Render's free tier, the server sleeps after 15 min of inactivity (first request takes ~30s to wake up)
