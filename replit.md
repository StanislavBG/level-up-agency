# Work Skills OS

## Overview
AI-driven multi-agent practice and assessment platform for professional skill development. Users run practice sessions against AI personas in realistic business scenarios, receive multi-dimensional assessments, and build work artifacts.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui, routed with wouter
- **Backend**: Express.js with TypeScript (tsx runtime)
- **Database**: PostgreSQL via Drizzle ORM
- **Workflow Engine**: bilko-flow (deterministic workflow orchestration from GitHub: StanislavBG/bilko-flow)

## Key Data Model (shared/schema.ts)
- **Personas**: AI characters with distinct behavioral profiles (skeptical, analytical, cooperative, etc.)
- **Scenarios**: Multi-step business simulations with constraints, channels, and required artifacts
- **Sessions**: User practice/assessment runs through scenarios
- **Messages**: Conversation history within sessions (user, persona, system senders)
- **Artifacts**: Work products created during sessions (one-pagers, email recaps, risk registers, etc.)
- **Assessments**: 7-dimension scoring with HITL (human-in-the-loop) review
- **Templates**: Content templates for artifact generation
- **UserConfig**: User preferences (role, seniority, channels, constraint toggles)

## Workflow Engine (server/workflow-engine.ts)
Uses bilko-flow with three custom step handlers:
1. `custom.persona-response` — Generates persona responses based on type + stage
2. `custom.assessment` — Scores sessions across 7 dimensions
3. `custom.channel-transition` — Manages channel switches between steps

## Important: bilko-flow Build
bilko-flow is installed from GitHub source and requires building. After `npm install`, run:
```bash
bash scripts/postinstall-bilko.sh
```
This builds the TypeScript, creates a `dist/lib.js` entry point (without server startup side effects), and patches the package.json.

## Frontend Pages
- `/` — Home: scenario browser, user config, session history
- `/session/:id` — Practice session: multi-channel chat, artifact creation, step progression
- `/assessment/:sessionId` — Assessment results: scores, friction points, HITL review

## API Routes (shared/routes.ts)
- `GET/POST /api/scenarios`, `/api/personas`, `/api/templates`
- `GET/POST /api/sessions`, `PATCH /api/sessions/:id`
- `GET/POST /api/sessions/:sessionId/messages`
- `GET/POST /api/sessions/:sessionId/artifacts`
- `GET/POST /api/sessions/:sessionId/assessment`
- `PATCH /api/assessments/:id/hitl`
- `GET/PATCH /api/user-config`
- `POST /api/seed`

## Recent Changes
- 2026-02-10: Restored full project from git history after accidental simplification. Re-installed bilko-flow, restored all backend files (routes, storage, workflow-engine, seed), frontend pages (Home, PracticeSession, Assessment), and schema.
