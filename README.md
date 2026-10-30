# IBovespa Dashboard

Aplicação web que centraliza cotações, gráficos, fatos relevantes e análises com IA (Claude API)
dos principais ativos do índice IBovespa.

Documentação: [`PRD.md`](./PRD.md) · Tarefas: [`TASKS.md`](./TASKS.md) · Convenções: [`CLAUDE.md`](./CLAUDE.md)

## Estrutura

```
.
├── frontend/          Next.js 14 (App Router), TypeScript, TailwindCSS, SWR
├── backend/           Fastify 4, Prisma, ioredis, yahoo-finance2
├── .github/workflows/ CI: lint, typecheck e build
├── docker-compose.yml PostgreSQL 15 + TimescaleDB e Redis 7
└── PRD.md · TASKS.md · CLAUDE.md
```

Cada pasta (`frontend/` e `backend/`) tem seu próprio `package.json`, `tsconfig.json` e `node_modules`.

## Pré-requisitos

- Node.js 20+ e npm
- Docker Desktop (para PostgreSQL e Redis)
- Token da [brapi.dev](https://brapi.dev) (sem ele, a brapi atende só alguns tickers)

## Setup

```bash
# 1. Infraestrutura (PostgreSQL + Redis)
docker compose up -d

# 2. Backend (porta 3001)
cd backend
npm install
cp .env.example .env          # preencha BRAPI_TOKEN
npx prisma migrate deploy     # aplica a migration (cria a hypertable)
npm run db:seed               # cadastra os 50 ativos
npm run dev

# 3. Frontend (porta 3000), em outro terminal
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Se a porta 3000 estiver ocupada, use `npm run dev -- -p 3100` no frontend e defina
`FRONTEND_ORIGIN=http://localhost:3100` no `backend/.env`.

## Scripts

| Pasta | Comando | Descrição |
|---|---|---|
| frontend | `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| frontend | `npm run build` | Build de produção |
| frontend | `npm run lint` / `npm run lint:fix` | ESLint |
| frontend | `npm run typecheck` | `tsc --noEmit` |
| backend | `npm run dev` | Servidor com hot reload (porta 3001) |
| backend | `npm run build` / `npm start` | Compila e roda a versão de produção |
| backend | `npm run db:migrate` | Cria nova migration após alterar `prisma/schema.prisma` |
| backend | `npm run db:seed` | Popula os 50 ativos do IBovespa |
| backend | `npm run db:studio` | Abre o Prisma Studio |

## Variáveis de ambiente

Cada app lê o próprio arquivo. Os modelos `.env.example` estão versionados; os arquivos reais
(`.env`, `.env.local`) são ignorados pelo git.

- `backend/.env`: `DATABASE_URL`, `REDIS_URL`, `BRAPI_TOKEN`, `ANTHROPIC_API_KEY` etc.
- `frontend/.env.local`: apenas variáveis públicas (`NEXT_PUBLIC_API_URL`).

Nunca coloque chaves secretas em `frontend/`.

## Aviso

As análises geradas por IA não constituem recomendação de investimento. Consulte um profissional certificado.
