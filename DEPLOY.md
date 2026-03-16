# Rasoi - Deployment Guide

## Architecture

```
┌─────────────────────┐
│   rasoi.skdev.one    │
│  (Vercel - Frontend) │
│   React + Vite PWA   │
└─────────┬───────────┘
          │ HTTPS
          ▼
┌─────────────────────┐
│ rasoi-api.skdev.one  │
│  (GCP VM - Backend)  │
│                      │
│  nginx (SSL/proxy)   │
│       ↓ :8015        │
│  Docker container    │
│  (FastAPI + SQLite)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌──────────────────┐
│   Sarvam AI APIs     │     │ Google Vision API │
│  STT / TTS / LLM    │     │  (image analysis) │
└─────────────────────┘     └──────────────────┘
```

## URLs

| Component | URL |
|---|---|
| Frontend | https://rasoi.skdev.one |
| Backend API | https://rasoi-api.skdev.one |
| GitHub | https://github.com/rsumit123/rasoi-cook |

## Prerequisites

- SSH access to GCP VM via `ssh ssh-social`
- Vercel CLI (`npx vercel`) — linked in `frontend/` directory
- Docker on the VM
- Namecheap DNS: A record `rasoi-api` → `34.23.158.39`, CNAME `rasoi` → `cname.vercel-dns.com`

## Environment Variables

Backend requires these env vars (passed via Docker `-e` flags):

| Variable | Description | Where to get |
|---|---|---|
| `SARVAM_API_KEY` | Sarvam AI API key (STT, TTS, LLM) | https://dashboard.sarvam.ai |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision key (photo analysis) | Google Cloud Console |
| `DATABASE_URL` | SQLite path (default works) | Auto |

For local dev, create a `.env` file at the project root with these values.

## Backend Deployment (GCP VM)

### First-time setup

```bash
# 1. Copy project to VM
cd /Users/rsumit123/work/recipe-app
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.db' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='frontend/dist' \
  --exclude='frontend/.vercel' \
  . ssh-social:~/rasoi-app/

# 2. SSH into VM and build
ssh ssh-social
cd ~/rasoi-app
docker build -t rasoi-backend .

# 3. Run container
docker run -d \
  --name rasoi-backend \
  --restart unless-stopped \
  -p 8015:8015 \
  -e SARVAM_API_KEY='your-key' \
  -e GOOGLE_VISION_API_KEY='your-key' \
  -e DATABASE_URL='sqlite+aiosqlite:///./recipe_app.db' \
  rasoi-backend

# 4. Seed the database
docker exec rasoi-backend python -m backend.seed

# 5. Verify
curl http://localhost:8015/health
curl http://localhost:8015/api/recipes | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin))} recipes')"
```

### Nginx setup (one-time)

```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/rasoi-api.skdev.one > /dev/null << 'EOF'
server {
    listen 80;
    server_name rasoi-api.skdev.one;

    location / {
        proxy_pass http://localhost:8015;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/rasoi-api.skdev.one /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL certificate (auto-renews via certbot timer)
sudo certbot --nginx -d rasoi-api.skdev.one --non-interactive --agree-tos -m admin@skdev.one
```

### Redeployment (updates)

```bash
# From local machine — run from project root
cd /Users/rsumit123/work/recipe-app

# 1. Sync files to VM
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.db' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='frontend/dist' \
  --exclude='frontend/.vercel' \
  . ssh-social:~/rasoi-app/

# 2. Rebuild and restart container
ssh ssh-social "cd ~/rasoi-app && \
  docker build -t rasoi-backend . && \
  docker rm -f rasoi-backend && \
  docker run -d \
    --name rasoi-backend \
    --restart unless-stopped \
    -p 8015:8015 \
    -e SARVAM_API_KEY='your-key' \
    -e GOOGLE_VISION_API_KEY='your-key' \
    -e DATABASE_URL='sqlite+aiosqlite:///./recipe_app.db' \
    rasoi-backend && \
  docker exec rasoi-backend python -m backend.seed"

# 3. Verify
curl -s https://rasoi-api.skdev.one/health
```

### Useful commands

```bash
# View logs
ssh ssh-social "docker logs rasoi-backend --tail 50"
ssh ssh-social "docker logs rasoi-backend -f"  # follow live

# Restart container
ssh ssh-social "docker restart rasoi-backend"

# Check resource usage
ssh ssh-social "docker stats rasoi-backend --no-stream"

# Shell into container
ssh ssh-social "docker exec -it rasoi-backend bash"

# Check what's running on the VM
ssh ssh-social "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

## Frontend Deployment (Vercel)

### Important: Deploy from `frontend/` directory

The Vercel project is linked inside `frontend/.vercel/`. Always deploy from there:

```bash
cd /Users/rsumit123/work/recipe-app/frontend
npx vercel --yes --prod
```

**Do NOT deploy from the project root** — there was a stale `.vercel` config at root that deployed the wrong project. It has been removed, but always `cd frontend` first.

### Verify deployment

After deploying, verify the new bundle is live:

```bash
# Check which JS bundle is served
curl -s https://rasoi.skdev.one/ | grep -o 'index-[^"]*\.js'

# Verify key features are in the bundle
NEW_JS=$(curl -s https://rasoi.skdev.one/ | grep -o 'index-[^"]*\.js')
curl -s "https://rasoi.skdev.one/assets/$NEW_JS" | grep -c "voice/transcribe"  # should be 1
curl -s "https://rasoi.skdev.one/assets/$NEW_JS" | grep -c "vision/ask"        # should be 1
```

If the bundle doesn't contain expected code, try:
```bash
cd frontend
rm -rf dist .vercel
npx vercel --yes --prod
```

### Custom domain

- `rasoi.skdev.one` → CNAME `cname.vercel-dns.com` (Namecheap DNS)
- SSL is automatic via Vercel

### SPA routing

`frontend/vercel.json` handles SPA rewrites so deep links like `/recipes/1` don't 404:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Full Redeploy (both backend + frontend)

```bash
cd /Users/rsumit123/work/recipe-app

# Backend
rsync -avz \
  --exclude='node_modules' --exclude='.env' --exclude='*.db' \
  --exclude='__pycache__' --exclude='.git' --exclude='frontend/dist' \
  --exclude='frontend/.vercel' \
  . ssh-social:~/rasoi-app/

ssh ssh-social "cd ~/rasoi-app && \
  docker build -t rasoi-backend . && \
  docker rm -f rasoi-backend && \
  docker run -d --name rasoi-backend --restart unless-stopped -p 8015:8015 \
    -e SARVAM_API_KEY='your-key' \
    -e GOOGLE_VISION_API_KEY='your-key' \
    -e DATABASE_URL='sqlite+aiosqlite:///./recipe_app.db' \
    rasoi-backend && \
  docker exec rasoi-backend python -m backend.seed"

# Frontend (MUST be from frontend/ directory)
cd frontend && npx vercel --yes --prod
```

## Local Development

```bash
cd /Users/rsumit123/work/recipe-app

# Create .env at project root (copy from template)
cp backend/.env.example .env
# Edit .env with your API keys

# Backend
pip3 install -r backend/requirements.txt
python3 -m backend.seed          # seed DB (first time only)
python3 -m uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Vite proxy forwards `/api` requests to `http://localhost:8000` automatically.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/recipes` | List/search recipes (?q=, ?region=, ?difficulty=) |
| GET | `/api/recipes/{id}` | Recipe detail with ingredients & steps |
| POST | `/api/sessions` | Create cooking session |
| POST | `/api/chat` | Text chat — send message, get AI response |
| POST | `/api/voice/transcribe` | Voice — send audio file, get transcript + AI response |
| POST | `/api/vision/ask` | Photo Q&A — send image + question, get AI response |
| POST | `/api/vision/identify` | Ingredient identification (legacy) |

## Ports on GCP VM

| Port | Service |
|---|---|
| 8000 | willow / recursing_booth |
| 8001 | chillbill |
| 8005 | charade |
| 8010 | pmc-tycoon |
| 8015 | **rasoi (this app)** |
| 8080 | socialflow |

## SSL Certificate Renewal

Certbot auto-renews via systemd timer. To manually renew:
```bash
ssh ssh-social "sudo certbot renew"
```

## Troubleshooting

**Backend not responding:**
```bash
ssh ssh-social "docker ps | grep rasoi"          # is it running?
ssh ssh-social "docker logs rasoi-backend --tail 20"  # check errors
ssh ssh-social "curl localhost:8015/health"       # test directly
```

**Frontend showing stale code:**
```bash
cd frontend
rm -rf dist .vercel
npx vercel --yes --prod
# Then verify: curl -s https://rasoi.skdev.one/ | grep -o 'index-[^"]*\.js'
```

**Voice not working:**
```bash
# Check backend logs for STT errors
ssh ssh-social "docker logs rasoi-backend --tail 30 2>&1 | grep -i error"
```

**CORS errors:**
Backend allows origins: `http://localhost:5173`, `https://rasoi.skdev.one`, `https://rasoi-api.skdev.one`. If you add a new domain, update `backend/main.py` CORS settings and redeploy.
