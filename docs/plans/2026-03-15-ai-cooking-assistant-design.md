# AI Cooking Assistant - Technical Design

## Problem

Young Indians cooking alone lack the patient, context-aware guidance that a family member would provide. Indian cooking is complex (tempering, spice combinations, timing), and existing recipe apps offer static instructions without real-time, conversational help. No existing solution combines voice interaction, ingredient recognition, and multi-language support in a cooking-focused AI assistant.

## Solution

A **voice-first conversational AI cooking assistant** delivered as a Progressive Web App (PWA). Users speak naturally (in Hindi, English, Hinglish, or one regional language), and the assistant guides them step-by-step through Indian recipes with a warm, "mom-like" personality. Users can also photograph ingredients for identification and ask contextual questions mid-cooking.

## Design Parameters

| Parameter | Decision |
|---|---|
| Platform | Web app (PWA) |
| Interaction model | Voice-first with text fallback |
| Data layer | Structured recipe DB + LLM for conversation |
| Scale | Prototype (< 100 users) |
| Voice input | Backend Whisper API (audio recorded in browser, sent to server) |
| Voice output | ElevenLabs TTS |
| Languages (MVP) | Hindi + English + 1 regional language |
| Deployment | Single server (Railway/Render) |

## Architecture

**Modular monolith** — single FastAPI application with 4 clean module boundaries.

```
recipe-app/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, WebSocket setup
│   ├── config.py                  # API keys, DB URL, settings
│   ├── models/                    # SQLAlchemy models
│   │   ├── recipe.py              # Recipe, Ingredient, Step
│   │   └── session.py             # CookingSession, Message history
│   ├── modules/
│   │   ├── voice/
│   │   │   ├── stt.py             # Whisper API call (audio -> text)
│   │   │   ├── tts.py             # ElevenLabs API (text -> audio)
│   │   │   └── language.py        # Language detection + routing
│   │   ├── recipes/
│   │   │   ├── crud.py            # Recipe CRUD operations
│   │   │   ├── search.py          # Recipe search/matching
│   │   │   └── schemas.py         # Pydantic models for recipes
│   │   ├── conversation/
│   │   │   ├── engine.py          # LLM orchestration (LangChain)
│   │   │   ├── prompts.py         # System prompts, persona
│   │   │   └── context.py         # Session state, recipe context
│   │   └── vision/
│   │       ├── identify.py        # Ingredient image recognition
│   │       └── processor.py       # Image preprocessing
│   ├── routes/
│   │   ├── voice_ws.py            # WebSocket endpoint for voice
│   │   ├── recipes.py             # REST endpoints for recipes
│   │   ├── chat.py                # Chat/conversation endpoints
│   │   └── vision.py              # Image upload endpoint
│   └── db.py                      # Database connection, migrations
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── VoiceButton.tsx     # Push-to-talk button
│   │   │   ├── RecipeDisplay.tsx   # Current step, ingredients
│   │   │   ├── ChatPanel.tsx       # Text fallback
│   │   │   └── CameraCapture.tsx   # Ingredient photo
│   │   ├── hooks/
│   │   │   ├── useVoice.ts        # MediaRecorder + WebSocket
│   │   │   └── useRecipe.ts       # Recipe state management
│   │   └── services/
│   │       └── api.ts             # Backend API client
│   └── public/
│       └── manifest.json          # PWA manifest
├── data/
│   └── seed_recipes.json          # Initial 50-100 Indian recipes
├── requirements.txt
└── docker-compose.yml             # App + Postgres
```

Key design decisions:
- **WebSocket** for voice streaming (lower latency than REST for audio)
- **Session-based conversation** with stored message history
- **Recipe context injection** into LLM system prompt when user picks a recipe
- **Language auto-detection** via Whisper, then routing TTS to matching voice

## Data Flow

### Voice Cooking Session

```
User speaks: "How do I make paneer butter masala?"
        |
        v
1. VOICE INPUT
   Browser MediaRecorder captures audio chunks
   -> WebSocket sends chunks to backend
   -> voice/stt.py sends to Whisper API
   -> Returns: "How do I make paneer butter masala?"
   -> language.py detects: Hindi/English
        |
        v
2. INTENT + RECIPE LOOKUP
   conversation/engine.py classifies intent:
     -> "recipe_request" for "paneer butter masala"
   recipes/search.py queries PostgreSQL:
     -> Fuzzy match on recipe name + aliases
     -> Returns full recipe (ingredients + steps)
        |
        v
3. LLM CONVERSATION
   conversation/context.py builds prompt:
     System: "You are a warm Indian cooking guide..."
     + Recipe JSON (ingredients, steps, tips)
     + Conversation history
     + User preferences (spice level, diet)
   -> LLM generates: friendly response + first steps
        |
        v
4. VOICE OUTPUT
   voice/tts.py sends LLM response to ElevenLabs
     -> Hindi voice if user spoke Hindi
     -> English voice if user spoke English
   -> Audio streamed back via WebSocket
   -> Frontend plays audio + shows recipe card
```

### Image Flow (Ingredient Identification)

```
User taps camera -> captures photo -> POST /api/vision/identify
  -> vision/processor.py resizes + normalizes
  -> vision/identify.py sends to Google Vision API
  -> Returns: "This looks like fresh coriander (dhania)"
  -> Optionally: "Recipes you can make with this: ..."
```

## Database Schema

```sql
recipes
  id            SERIAL PRIMARY KEY
  name          VARCHAR(255) NOT NULL
  name_hi       VARCHAR(255)          -- Hindi name
  cuisine       VARCHAR(100)
  region        VARCHAR(100)
  difficulty    VARCHAR(20)           -- easy, medium, hard
  prep_time     INTEGER               -- minutes
  cook_time     INTEGER               -- minutes

ingredients
  id            SERIAL PRIMARY KEY
  recipe_id     INTEGER REFERENCES recipes(id)
  name          VARCHAR(255) NOT NULL
  name_hi       VARCHAR(255)
  quantity      VARCHAR(50)
  unit          VARCHAR(50)
  is_optional   BOOLEAN DEFAULT FALSE

steps
  id            SERIAL PRIMARY KEY
  recipe_id     INTEGER REFERENCES recipes(id)
  step_number   INTEGER NOT NULL
  instruction   TEXT NOT NULL
  instruction_hi TEXT
  duration_mins INTEGER               -- optional timer
  tips          TEXT

cooking_sessions
  id            SERIAL PRIMARY KEY
  user_id       VARCHAR(255)          -- anonymous or authenticated
  recipe_id     INTEGER REFERENCES recipes(id)
  started_at    TIMESTAMP DEFAULT NOW()
  current_step  INTEGER DEFAULT 1
  language      VARCHAR(10) DEFAULT 'en'

messages
  id            SERIAL PRIMARY KEY
  session_id    INTEGER REFERENCES cooking_sessions(id)
  role          VARCHAR(20)           -- user, assistant
  content       TEXT NOT NULL
  timestamp     TIMESTAMP DEFAULT NOW()
```

## API Design

### WebSocket

```
ws://api/voice/stream    # Bidirectional audio streaming
                          Client sends: audio chunks (binary)
                          Server sends: transcription + TTS audio + recipe updates
```

### WebSocket Protocol

```json
// Client -> Server (start session)
{ "type": "session_start", "recipe_id": 42, "language": "hi" }

// Client -> Server (audio chunk)
Binary frame: raw PCM/opus audio bytes

// Server -> Client (transcription)
{ "type": "transcript", "text": "paneer ko kitna fry karu?", "language": "hi" }

// Server -> Client (AI response)
{ "type": "response",
  "text": "Paneer ko medium flame pe 2-3 minute golden hone tak fry karo",
  "audio_url": "/audio/resp_123.mp3",
  "recipe_update": { "current_step": 3, "timer_seconds": 180 } }

// Server -> Client (step update)
{ "type": "step_change", "step": 4, "instruction": "Now add the tomato puree..." }
```

### REST Endpoints

```
POST   /api/chat               # Text-based chat fallback
       Body: { session_id, message, language }
       Returns: { reply, recipe_context, audio_url? }

GET    /api/recipes             # List/search recipes
       Query: ?q=paneer&region=punjabi&difficulty=easy
GET    /api/recipes/{id}        # Full recipe with steps

POST   /api/vision/identify     # Upload ingredient photo
       Body: multipart/form-data (image)
       Returns: { ingredient, confidence, name_hi, recipes[] }

POST   /api/sessions            # Start cooking session
       Body: { recipe_id, language }
GET    /api/sessions/{id}       # Get session state + history
PATCH  /api/sessions/{id}       # Update current step
```

## Frontend UI

```
+-------------------------------------------+
|  +---------------------------------------+  |
|  |      Recipe Card (collapsible)        |  |
|  |  Paneer Butter Masala                 |  |
|  |  Step 3 of 8: Fry the paneer         |  |
|  |  Timer: 2:45                          |  |
|  |  <- Prev Step    Next Step ->         |  |
|  +---------------------------------------+  |
|                                             |
|  +---------------------------------------+  |
|  |      Conversation Area                |  |
|  |  Bot: "Paneer ko medium flame pe      |  |
|  |       2-3 min fry karo..."            |  |
|  |  You: "cream nahi hai"                |  |
|  |  Bot: "Koi baat nahi! Cashew paste    |  |
|  |       use kar sakte ho..."            |  |
|  +---------------------------------------+  |
|                                             |
|  [Mic Talk]  [Camera Scan]  [Type...]       |
+-------------------------------------------+
```

Key UX decisions:
- **Push-to-talk** (not always-on) to save API costs and avoid kitchen noise
- **Visual recipe card** stays visible during voice conversation
- **Auto-timer** triggered when LLM mentions cooking times
- **Text input** always available as fallback for noisy kitchens

## Error Handling

| Scenario | Detection | Recovery |
|---|---|---|
| Kitchen noise | Low-confidence Whisper transcript | "I didn't catch that" + highlight text input |
| Code-switching (Hindi/English mix) | Whisper handles natively | LLM prompt: "User may mix languages freely" |
| Regional accent issues | Low confidence score | Log for fine-tuning; suggest text input |
| Network drop mid-cooking | WebSocket disconnect | Service Worker caches recipe offline; auto-reconnect |
| Whisper API timeout | >5s response | Retry once, then fall back to text input |

### LLM Guardrails
- Only reference steps/ingredients from the structured recipe DB
- Include cooking safety rules (oil temp warnings, pressure cooker safety, allergens)
- Redirect non-cooking questions politely
- Summarize conversation history after 20 messages to manage token limits

## Cost Estimate (Prototype: 100 users, ~500 sessions/month)

| Service | Monthly Cost |
|---|---|
| Whisper API | ~$5-10 |
| LLM (GPT-4o) | ~$15-30 |
| ElevenLabs TTS | ~$5-11 |
| Google Vision API | ~$2-5 |
| PostgreSQL (Render) | Free tier |
| Hosting (Render/Railway) | Free-$7 |
| **Total** | **~$30-60** |

## Testing Strategy

### Unit Tests (pytest)
- Recipe CRUD operations (search, fuzzy matching, aliases)
- Prompt construction (correct recipe context injection, language handling)
- WebSocket message serialization/deserialization
- Language detection routing logic

### Integration Tests (pytest + httpx)
- Full voice pipeline: mock audio -> Whisper -> LLM -> TTS
- Recipe search -> conversation context -> correct LLM response
- Image upload -> Vision API -> ingredient identification
- Session management: start -> multiple turns -> step progression

### API Mocking
- Use `respx` to mock external APIs (Whisper, LLM, ElevenLabs, Vision)
- Record real API responses as test fixtures
- Separate test config with cheaper model (GPT-4o-mini) for CI

### Manual Testing Checklist
- [ ] Voice input works on Chrome mobile (Android + iOS Safari)
- [ ] Push-to-talk captures clean audio in noisy kitchen
- [ ] Hindi voice -> Hindi text response -> Hindi audio output
- [ ] English voice -> English response flow
- [ ] Recipe step navigation via voice ("next step", "go back")
- [ ] Ingredient substitution questions answered correctly
- [ ] Offline mode shows cached recipe on network drop
- [ ] Image capture identifies common Indian ingredients
- [ ] Conversation history maintained across turns

### Quality Metrics
- Whisper transcription accuracy (% correct utterances)
- LLM response relevance (manual review of 50 sample conversations)
- End-to-end latency: voice input -> audio response (target: <3 seconds)
- Session completion rate (% users who finish cooking a recipe)

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (PWA) |
| Backend | Python + FastAPI |
| Database | PostgreSQL (SQLAlchemy ORM) |
| Voice STT | OpenAI Whisper API |
| Voice TTS | ElevenLabs |
| LLM | GPT-4o via LangChain |
| Vision | Google Cloud Vision API |
| Deployment | Railway or Render |
| Realtime | WebSocket (native FastAPI) |

## Implementation Plan

### Phase 1: Project Scaffolding & Database (Week 1)

**1.1 Backend setup**
- Initialize Python project with FastAPI, SQLAlchemy, Alembic, Pydantic
- `requirements.txt` with pinned dependencies
- `config.py` with environment variable loading (API keys, DB URL)
- `docker-compose.yml` with PostgreSQL + app containers

**1.2 Database models & migrations**
- SQLAlchemy models: `Recipe`, `Ingredient`, `Step`, `CookingSession`, `Message`
- Alembic migration for initial schema
- `db.py` with async session management

**1.3 Seed data**
- Create `data/seed_recipes.json` with 20-30 popular Indian recipes
- Seed script to populate DB
- Include Hindi names, step-by-step instructions, regional tags

**1.4 Frontend setup**
- Initialize React + TypeScript project (Vite)
- PWA manifest + Service Worker skeleton
- Basic routing: Home -> Recipe List -> Cooking Session

### Phase 2: Recipe Module (Week 2)

**2.1 Recipe CRUD endpoints**
- `GET /api/recipes` with search, region filter, difficulty filter
- `GET /api/recipes/{id}` with full steps + ingredients
- Fuzzy search on name + `name_hi` + aliases

**2.2 Recipe UI**
- `RecipeDisplay.tsx` — browsable recipe list with search
- Recipe detail view with ingredients + step cards
- Responsive layout for mobile-first use

### Phase 3: Conversation Module (Week 3)

**3.1 LLM integration**
- `conversation/engine.py` — LangChain setup with GPT-4o
- `conversation/prompts.py` — system prompt with "mom-like" persona, safety rules, scope guardrails
- `conversation/context.py` — inject recipe JSON + conversation history into prompt

**3.2 Chat endpoint**
- `POST /api/chat` — text-based conversation
- Session creation (`POST /api/sessions`) + message storage
- Step tracking (auto-advance `current_step` when LLM discusses next step)

**3.3 Chat UI**
- `ChatPanel.tsx` — message bubbles, auto-scroll, typing indicator
- Session state management (`useRecipe.ts` hook)
- Text input with send button

### Phase 4: Voice Module (Week 4-5)

**4.1 Speech-to-text**
- `voice/stt.py` — Whisper API integration
- `voice/language.py` — language detection routing

**4.2 Text-to-speech**
- `voice/tts.py` — ElevenLabs API integration
- Voice selection per language (Hindi, English, regional)

**4.3 WebSocket endpoint**
- `routes/voice_ws.py` — bidirectional WebSocket
- Protocol: session_start -> audio chunks -> transcript -> LLM -> TTS -> audio response
- Error handling: timeout, reconnect, fallback to text

**4.4 Voice UI**
- `VoiceButton.tsx` — push-to-talk with visual feedback
- `useVoice.ts` — MediaRecorder + WebSocket hook
- Audio playback + auto-timer extraction

### Phase 5: Vision Module (Week 5)

**5.1 Image recognition**
- `vision/processor.py` — resize/normalize uploaded images
- `vision/identify.py` — Google Vision API -> ingredient identification

**5.2 Camera UI**
- `CameraCapture.tsx` — camera capture or file upload
- Display identified ingredient + suggested recipes

### Phase 6: Polish & Offline (Week 6)

**6.1 Offline support**
- Service Worker caches current recipe on session start
- Offline recipe card (steps visible, no voice/chat)
- Auto-reconnect WebSocket on network restore

**6.2 Multi-language polish**
- Verify Hindi + English + regional language flows end-to-end
- Test code-switching (Hinglish) scenarios

**6.3 Testing**
- Unit + integration tests with mocked APIs
- Manual testing checklist pass

### Build Order

```
Phase 1 (Scaffolding) --> Phase 2 (Recipes) --> Phase 3 (Chat)
                                                      |
                                                      +--> Phase 4 (Voice)
                                                      |
                                                      +--> Phase 5 (Vision)
                                                               |
                                                        Phase 6 (Polish)
```

Phases 4 and 5 can be worked on in parallel (independent modules that plug into Phase 3's conversation engine).

## Research Sources

- [Remy Cooking Voice Assistant](https://github.com/SimonIyamu/Remy-Your-cooking-voice-assistant) - React + Web Speech API + ElevenLabs reference implementation
- [ChefMate AI](https://github.com/ThakkarVidhi/chefmate-ai) - FastAPI + RAG recipe assistant
- [Fine-tuning Whisper for Hindi](https://www.collabora.com/news-and-blog/news-and-events/breaking-language-barriers-fine-tuning-whisper-for-hindi.html) - Hindi-specific Whisper improvements
- [Testing Whisper with Indian Languages](https://qxf2.com/blog/testing-openai-whisper-support-for-indian-languages/) - Accuracy benchmarks for regional languages
- [AI Cooking Assistant Architecture](https://indatalabs.com/resources/ai-cooking-assistant) - Industry patterns
