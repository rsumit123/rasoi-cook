# Rasoi - AI Cooking Assistant

A voice-first conversational AI cooking assistant for Indian recipes. Talk naturally in Hindi, English, or Hinglish, and get patient, step-by-step cooking guidance — like having a mom in the kitchen with you.

**Live:** [rasoi.skdev.one](https://rasoi.skdev.one)

## Features

- **Voice-first** — Hold the mic and speak naturally while cooking, hands stay clean
- **10 Indian languages** — Hindi, English, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi
- **Step-by-step guidance** — Navigate recipe steps with prev/next, get tips and durations
- **Ingredient recognition** — Snap a photo of any ingredient to identify it (with Hindi name)
- **Contextual AI chat** — Ask questions mid-cooking ("cream nahi hai, kya use karu?") and get recipe-aware answers
- **13 Indian recipes** — Paneer Butter Masala, Dal Tadka, Chole, Masala Dosa, Biryani, and more

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite PWA) |
| Backend | Python + FastAPI |
| Database | SQLite (SQLAlchemy async) |
| AI — Speech | Sarvam AI (Saaras v3 STT, Bulbul v3 TTS) |
| AI — Chat | Sarvam AI (sarvam-m LLM) |
| AI — Vision | Google Cloud Vision API |
| Hosting | Vercel (frontend) + GCP VM (backend) |

## Architecture

```
┌─────────────────────┐
│  rasoi.skdev.one     │
│  (Vercel - React)    │
└─────────┬───────────┘
          │ HTTPS
          v
┌─────────────────────┐
│ rasoi-api.skdev.one  │
│ (GCP VM - FastAPI)   │
│  nginx + SSL         │
│  Docker container    │
└─────────┬───────────┘
          │
          v
┌─────────────────────┐
│   Sarvam AI APIs     │
│  STT / TTS / LLM    │
└─────────────────────┘
```

## Local Development

### Prerequisites

- Python 3.13+
- Node.js 20+

### Setup

```bash
# Clone
git clone https://github.com/rsumit123/rasoi-cook.git
cd rasoi-cook

# Backend
pip3 install -r backend/requirements.txt

# Create .env at project root
cp backend/.env.example .env
# Edit .env and add your API keys:
# SARVAM_API_KEY=your-key (get from https://dashboard.sarvam.ai)
# GOOGLE_VISION_API_KEY=your-key (get from Google Cloud Console)

# Seed database
python3 -m backend.seed

# Start backend
python3 -m uvicorn backend.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recipes` | List/search recipes |
| GET | `/api/recipes/{id}` | Recipe detail with ingredients & steps |
| POST | `/api/sessions` | Create cooking session |
| POST | `/api/chat` | Send text message, get AI response |
| POST | `/api/voice/transcribe` | Send audio, get transcript + AI response |
| POST | `/api/vision/identify` | Upload image, identify ingredient |
| GET | `/health` | Health check |

## Project Structure

```
rasoi-cook/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── config.py               # Settings (env vars)
│   ├── db.py                   # SQLAlchemy async setup
│   ├── seed.py                 # Database seeder
│   ├── models/                 # SQLAlchemy models
│   ├── modules/
│   │   ├── voice/              # Sarvam STT/TTS
│   │   ├── recipes/            # CRUD + search
│   │   ├── conversation/       # LLM engine + prompts
│   │   └── vision/             # Google Vision
│   └── routes/                 # API endpoints
├── frontend/
│   ├── src/
│   │   ├── pages/              # Home, RecipeList, RecipeDetail, CookingSession
│   │   ├── components/         # VoiceButton, CameraCapture
│   │   ├── hooks/              # useVoice
│   │   └── services/           # API client
│   └── vercel.json             # SPA routing
├── data/
│   └── seed_recipes.json       # 13 Indian recipes with Hindi translations
├── Dockerfile                  # Backend container
├── DEPLOY.md                   # Deployment guide
└── docker-compose.yml          # Optional Postgres setup
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full deployment instructions.

**Quick redeploy:**

```bash
# Backend (GCP VM)
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='*.db' . ssh-social:~/rasoi-app/
ssh ssh-social "cd ~/rasoi-app && docker build -t rasoi-backend . && docker rm -f rasoi-backend && docker run -d --name rasoi-backend --restart unless-stopped -p 8015:8015 -e SARVAM_API_KEY='...' -e GOOGLE_VISION_API_KEY='...' rasoi-backend && docker exec rasoi-backend python -m backend.seed"

# Frontend (Vercel)
cd frontend && npx vercel --yes --prod
```

## License

MIT
