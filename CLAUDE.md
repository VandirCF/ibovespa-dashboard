# CLAUDE.md — IBovespa Dashboard

> Este arquivo é lido automaticamente pelo Claude Code ao iniciar uma sessão.
> Contém as convenções, comandos, restrições e contexto do projeto.

---

## Visão geral do projeto

**IBovespa Dashboard** é uma aplicação web que centraliza dados dos principais ativos
do índice Bovespa com busca, gráficos interativos, fatos relevantes da B3 e
recomendações geradas pela Claude API.

- **PRD:** `PRD.md` — requisitos, funcionalidades e métricas de sucesso
- **Tarefas:** `TASKS.md` — todas as tarefas com critérios de conclusão e prompts prontos
- **Status atual:** Fase 1 — Scaffold e dados em tempo real

---

## Estrutura do repositório

```
/
├── frontend/                   # Next.js 14 (App Router) — package.json próprio
│   ├── app/                    # layout.tsx, page.tsx (home), ativo/[ticker]/, loading.tsx
│   ├── components/             # BuscaAtivo, ListaAtivos, Cabecalho, PainelAtivos
│   ├── hooks/                  # useAtivos (SWR)
│   ├── lib/                    # formatters.ts, mercado.ts, constants.ts
│   ├── services/               # ativosService.ts (chamadas à API)
│   └── types/                  # tipos compartilhados do frontend (espelham backend/types)
├── backend/                    # Fastify 4 — package.json próprio
│   ├── index.ts                # entry point
│   ├── routes/                 # ativos.ts, graficos.ts, fatos.ts, recomendacoes.ts
│   ├── services/               # brapiService.ts, yahooService.ts (fatos/análise nas fases seguintes)
│   ├── lib/                    # cache.ts, db.ts, env.ts, logger.ts, tickers.ts, ativos-ibovespa.ts
│   ├── jobs/                   # workers BullMQ (T-011)
│   ├── types/                  # tipos compartilhados do backend (espelham frontend/types)
│   └── prisma/                 # schema.prisma, migrations/, seed.ts
├── .github/workflows/ci.yml    # lint, typecheck e build (frontend e backend)
├── docker-compose.yml          # PostgreSQL + TimescaleDB e Redis
├── PRD.md · TASKS.md · CLAUDE.md · README.md
```

Tipos são duplicados em `frontend/types` e `backend/types` para manter cada app independente. Ao mudar um, espelhe no outro.

---

## Comandos essenciais

```bash
# Infraestrutura local (PostgreSQL + Redis)
docker compose up -d

# Backend (porta 3001) — dentro de backend/
npm run dev
npm run db:migrate        # após alterar prisma/schema.prisma
npm run db:deploy         # aplica migrations existentes
npm run db:seed           # popula os 50 ativos
npm run db:studio

# Frontend (porta 3000) — dentro de frontend/
npm run dev
npm run build
npm run lint
npm run typecheck
```

---

## Stack e versões

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 14.x (App Router) | Frontend |
| TypeScript | 5.x strict | Toda a base de código |
| TailwindCSS | 3.x | Estilização |
| Fastify | 4.x | Backend API |
| Prisma | 5.x | ORM |
| PostgreSQL | 15.x + TimescaleDB | Banco de dados |
| Redis | 7.x | Cache |
| BullMQ | 4.x | Fila de jobs |
| ioredis | 5.x | Cliente Redis |
| lightweight-charts | 4.x | Gráficos candlestick |
| yahoo-finance2 | 2.x | Histórico OHLCV |
| axios + cheerio | latest | HTTP + scraping |
| Playwright | 1.x | Testes E2E |
| Zod | 3.x | Validação de schemas |

---

## Convenções de código

### TypeScript

```typescript
// SEMPRE use tipos explícitos em funções públicas
async function getPrecoAtivo(ticker: string): Promise<AtivoPreco> { ... }

// NUNCA use `any` — prefira `unknown` e faça type narrowing
const data: unknown = await response.json()

// Use Zod para validar dados externos (APIs, scraping)
const AtivoPrecoSchema = z.object({
  ticker: z.string(),
  preco: z.number().positive(),
  variacao: z.number(),
})

// Prefira interfaces para objetos de domínio, types para unions
interface AtivoPreco { ticker: string; preco: number }
type Sinal = 'Comprar' | 'Manter' | 'Vender'
```

### Nomenclatura

```
Arquivos:          camelCase.ts, PascalCase.tsx (componentes)
Componentes React: PascalCase          → GraficoCandlestick.tsx
Funções:           camelCase           → getPrecoAtivo()
Constantes:        SCREAMING_SNAKE     → PRECO_TTL
Interfaces:        PascalCase          → interface AtivoPreco
Rotas de API:      kebab-case          → /api/ativos/:ticker/fatos-relevantes
Variáveis de env:  SCREAMING_SNAKE     → BRAPI_TOKEN
```

### Tratamento de erros

```typescript
// SEMPRE trate erros em chamadas de rede — nunca deixe Promise rejeitada sem catch
try {
  const data = await brapiService.getPreco(ticker)
  return data
} catch (error) {
  logger.error({ error, ticker }, 'Falha ao buscar preço na brapi')
  // Tente o fallback antes de lançar para cima
  return yahooService.getPreco(ticker)
}

// Use Result type para erros esperados (não use exceções para fluxo normal)
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
```

### Formatação (pt-BR obrigatório)

```typescript
// Use sempre as funções de /lib/formatters.ts — NUNCA formate inline
import { formatarMoeda, formatarVariacao, formatarData } from '@/lib/formatters'

formatarMoeda(45.23)        // → "R$ 45,23"
formatarVariacao(2.45)      // → "+2,45%"
formatarVariacao(-1.30)     // → "-1,30%"
formatarData('2026-04-09')  // → "09/04/2026"
```

---

## Regras de cache (não altere sem atualizar aqui)

| Dado | Chave Redis | TTL | Motivo |
|---|---|---|---|
| Preço atual (brapi) | `preco:{ticker}` | 300s | Mercado atualiza a cada 1 min |
| Lista IBovespa | `lista:ibovespa` | 300s | Composição muda raramente |
| Histórico 1D/1S | `hist:{ticker}:1d` | 300s | Intraday muda com frequência |
| Histórico 1M/3M | `hist:{ticker}:1m` | 1800s | Muda menos durante o dia |
| Histórico 1A/5A | `hist:{ticker}:1y` | 3600s | Dados históricos são estáveis |
| Fatos relevantes | `fatos:{ticker}` | 3600s | B3 publica algumas vezes ao dia |
| Indicadores fundamentalistas | `fund:{ticker}` | 86400s | Dados trimestrais |
| Recomendação IA | `analise:{ticker}` | 3600s | Custo de geração + estabilidade |
| Último valor bom | `ultimo:{ticker}` | 86400s | Exibido quando brapi e Yahoo falham |
| Brapi sem acesso | `brapi-sem-acesso:{ticker}` | 21600s | Plano sem o ativo: pula a brapi e usa Yahoo |

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em `backend/.env.example` e `frontend/.env.example`.
**Nunca commite valores reais — apenas o `.env.example`.**

```bash
# APIs externas
BRAPI_TOKEN=           # Token da brapi.dev (obrigatório)
ALPHA_VANTAGE_KEY=     # Chave Alpha Vantage (opcional, tem fallback)
ANTHROPIC_API_KEY=     # Chave Claude API (obrigatório para recomendações)

# Banco e cache
DATABASE_URL=          # postgresql://user:pass@localhost:5432/ibovespa
REDIS_URL=             # redis://localhost:6379

# App
NEXT_PUBLIC_API_URL=   # URL do backend (ex: http://localhost:3001)
NODE_ENV=              # development | production
```

---

## Integrações externas

### brapi.dev (fonte primária de preços)

```typescript
// Base URL: https://brapi.dev/api
// Autenticação: query param ?token=BRAPI_TOKEN
// Endpoints usados:
GET /quote/{ticker}?token=X           // Preço de um ativo
GET /quote/list?sortBy=market_cap_basic&limit=50&token=X  // Lista IBovespa
```

### Yahoo Finance (histórico OHLCV)

```typescript
// Biblioteca: yahoo-finance2 (npm)
// Tickers brasileiros precisam do sufixo .SA
import yahooFinance from 'yahoo-finance2'
const result = await yahooFinance.historical('PETR4.SA', { period1: '2025-01-01' })
```

### Claude API (recomendações)

```typescript
// Modelo: claude-sonnet-4-6 (SEMPRE este modelo, não altere)
// max_tokens: 1000
// Resposta deve ser JSON válido — use system prompt para garantir
// Cache de 1 hora obrigatório para controlar custo
```

### Investidor10 (fatos relevantes — scraping)

```typescript
// URL: https://investidor10.com.br/acoes/{ticker}/#comunicados
// Use axios + cheerio
// Respeite um delay de 1s entre requisições
// User-agent: 'IBovespa-Dashboard/1.0'
// Em caso de bloqueio (status 403/429): retornar array vazio, logar erro
```

---

## O que NUNCA fazer

```
❌ Nunca commite .env com valores reais
❌ Nunca use `any` em TypeScript — use `unknown` + type guard
❌ Nunca chame a Claude API sem verificar o cache primeiro
❌ Nunca formate valores monetários ou datas inline — use /lib/formatters.ts
❌ Nunca remova o aviso regulatório do componente RecomendacaoIA
❌ Nunca faça scraping sem o delay de 1s entre requisições
❌ Nunca exponha API keys no frontend (NEXT_PUBLIC_*)
❌ Nunca use WidthType.PERCENTAGE no Prisma/SQL — use valores absolutos
❌ Nunca altere TTLs de cache sem atualizar a tabela neste arquivo
❌ Nunca use `console.log` em produção — use o logger do Fastify (server) ou noop (client)
❌ Nunca faça chamadas diretas à Claude API no frontend — sempre via /api/recomendacoes
```

---

## O que SEMPRE fazer

```
✅ Valide dados externos com Zod antes de usar
✅ Adicione tipos de retorno explícitos em todas as funções de serviço
✅ Use a camada de cache (getOrSet) em toda chamada a API externa
✅ Implemente fallback quando brapi falhar (→ yahoo-finance2)
✅ Formate todos os valores monetários e datas em pt-BR
✅ Adicione loading skeleton em todo componente que faz fetch
✅ Trate o estado de erro com mensagem amigável + botão de retry
✅ Marque tarefas como [x] no TASKS.md ao concluí-las
✅ Documente funções públicas com JSDoc (parâmetros + retorno)
✅ Siga Conventional Commits: feat:, fix:, chore:, docs:, test:
```

---

## Fluxo de trabalho com o Claude Code

### Iniciar uma nova tarefa

```
1. Informe o ID da tarefa: "Vamos executar a T-005"
2. Claude Code lê o contexto da tarefa no TASKS.md
3. Implementa seguindo as convenções deste arquivo
4. Verifica cada item do critério de conclusão
5. Atualiza o status no TASKS.md: [ ] → [x]
```

### Ao encontrar um bug

```
1. Descreva o comportamento esperado vs atual
2. Informe em qual tarefa o bug apareceu
3. Claude Code analisa, propõe fix e cria teste para cobrir o caso
```

### Ao fazer code review

```
Verifique sempre:
- Tipos TypeScript corretos (sem any)
- Cache sendo usado onde definido
- Tratamento de erro em chamadas de rede
- Nenhum secret no código
- Formatação em pt-BR usando formatters.ts
- Aviso regulatório visível em RecomendacaoIA
```

---

## Contatos e referências

| Recurso | URL |
|---|---|
| Documentação brapi.dev | https://brapi.dev/docs |
| Lightweight Charts | https://tradingview.github.io/lightweight-charts/ |
| Alpha Vantage API | https://www.alphavantage.co/documentation/ |
| Claude API (Anthropic) | https://docs.anthropic.com |
| Composição IBovespa (B3) | https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm |
| Prisma Docs | https://www.prisma.io/docs |
| Fastify Docs | https://fastify.dev/docs/latest/ |
| BullMQ Docs | https://docs.bullmq.io |

---

*Mantenha este arquivo atualizado sempre que houver mudança de stack, convenção ou decisão técnica relevante.*
