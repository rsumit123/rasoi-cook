# Rasoi - Deployment Guide

## Architecture

```
                    ┌─────────────────────┐
                    │   rasoi.skdev.one    │
                    │   (Vercel - Frontend)│
                    └─────────┬───────────┘
                              │ HTTPS
                              ▼
                    ┌─────────────────────┐
                    │rasoi-api.skdev.one  │
                    │  (GCP VM - Backend) │
                    │                     │
                    │  nginx (SSL/proxy)  │
                    │       ↓ :8015       │
                    │  Docker container   │
                    │  (FastAPI + SQLite) │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Sarvam AI APIs    │
                    │  (STT / TTS / LLM)  │
                    └─────────────────────┘
```

## Prerequisites

- SSH access to GCP VM via `ssh ssh-social`
- Vercel CLI (`npx vercel`)
- Docker on the VM
- Namecheap DNS with A record `rasoi-api` → `34.23.158.39`

## Environment Variables

Backend requires these env vars (passed via Docker `-e` flags):

| Variable | Description | Where to get |
|---|---|---|
| `SARVAM_API_KEY` | Sarvam AI API key | https://dashboard.sarvam.ai |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision key | Google Cloud Console |
| `DATABASE_URL` | SQLite path (default works) | Auto |

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

# SSL certificate
sudo certbot --nginx -d rasoi-api.skdev.one --non-interactive --agree-tos -m admin@skdev.one
```

### Redeployment (updates)

```bash
# From local machine
cd /Users/rsumit123/work/recipe-app

# 1. Sync files
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.db' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='frontend/dist' \
  . ssh-social:~/rasoi-app/

# 2. Rebuild and restart
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
```

### Useful commands

```bash
# View logs
ssh ssh-social "docker logs rasoi-backend --tail 50"
ssh ssh-social "docker logs rasoi-backend -f"  # follow

# Restart container
ssh ssh-social "docker restart rasoi-backend"

# Check resource usage
ssh ssh-social "docker stats rasoi-backend --no-stream"

# Shell into container
ssh ssh-social "docker exec -it rasoi-backend bash"
```

## Frontend Deployment (Vercel)

### Deploy

```bash
cd /Users/rsumit123/work/recipe-app/frontend
npx vercel --yes --prod
```

### Custom domain

Domain `rasoi.skdev.one` is configured as a CNAME → `cname.vercel-dns.com` in Namecheap.
Vercel project has the domain added. SSL is automatic via Vercel.

### SPA routing

`frontend/vercel.json` handles SPA rewrites so deep links like `/recipes/1` don't 404:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Local Development

```bash
cd /Users/rsumit123/work/recipe-app

# Backend (needs .env with API keys at project root)
python3 -m backend.seed          # seed DB (first time)
python3 -m uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev       # http://localhost:5173
```

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
