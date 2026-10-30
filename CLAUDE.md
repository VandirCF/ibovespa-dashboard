# CLAUDE.md — IBovespa Dashboard

> Este arquivo é lido automaticamente pelo Claude Code ao iniciar uma sessão.
> Contém as convenções, comandos, restrições e contexto do projeto.

---

## Visão geral do projeto

**IBovespa Dashboard** é uma aplicação web que centraliza dados dos principais ativos
do índice Bovespa com busca, gráficos interativos, fatos relevantes da B3 e
indicadores fundamentalistas.

> A recomendação por IA (Claude API) foi **removida** do escopo: cada análise consome tokens.
> Não reintroduza chamadas à Claude API sem nova decisão explícita do responsável pelo projeto.

- **PRD:** `PRD.md` — requisitos, funcionalidades e métricas de sucesso
- **Tarefas:** `TASKS.md` — todas as tarefas com critérios de conclusão e prompts prontos
- **Status atual:** Fases 1, 2 e 3 concluídas. Fase 4 (IA) removida. Fase 5 em andamento:
  testes E2E, CI, configuração de deploy (Vercel e Railway) e Sentry prontos no código.
  Pendente: criar as contas e cadastrar os segredos (ver seção de variáveis de ambiente).

---

## Estrutura do repositório

```
/
├── frontend/                   # Next.js 14 (App Router) — package.json próprio
│   ├── app/                    # layout.tsx, page.tsx (home), ativo/[ticker]/, loading.tsx, global-error.tsx
│   ├── components/             # BuscaAtivo, ListaAtivos, FatosRelevantes, Indicadores, IndicadoresFii,
│   │                           # PainelAtivos (seletor Ações | Fundos imobiliários), GraficoCandlestick,
│   │                           # AbasAtivo, CarregadorSentry, ProvedorTema, ...
│   ├── hooks/                  # useAtivos (SWR)
│   ├── lib/                    # formatters.ts, mercado.ts, constants.ts, sentry.ts, sentryCliente.ts
│   ├── services/               # ativosService, historicoService, fatosService, indicadoresService
│   ├── tests/e2e/              # testes Playwright: home, busca, detalhe
│   ├── types/                  # tipos compartilhados do frontend (espelham backend/types)
│   ├── instrumentation.ts      # carrega o Sentry do servidor Next
│   ├── next.config.mjs         # withSentryConfig + instrumentationHook
│   ├── playwright.config.ts    # testes E2E (sobe backend e frontend se não estiverem rodando)
│   └── vercel.json             # deploy na Vercel (rewrite da API: ver seção de deploy)
├── backend/                    # Fastify 4 — package.json próprio
│   ├── index.ts                # entry point (CORS, rate limit, error handler, rotas)
│   ├── routes/                 # ativos.ts, graficos.ts, fatos.ts, indicadores.ts, admin.ts
│   ├── services/               # brapiService, yahooService, statusInvestService, fundamentusService,
│   │                           # historicoService, fatosService, indicadoresService, fiisService
│   ├── lib/                    # cache.ts, db.ts, env.ts, logger.ts, tickers.ts, ativos-ibovespa.ts, sentry.ts,
│   │                           # throttle.ts (intervalo de 1s entre requisições de scraping),
│   │                           # pregao.ts (horário de pregão e encerramento do último pregão)
│   ├── jobs/                   # coletaHistorico.ts (coleta diária), atualizaCotacoes.ts (cotações a cada 5 min)
│   ├── scripts/                # triggerColeta.ts
│   ├── types/                  # tipos compartilhados do backend (espelham frontend/types)
│   ├── prisma/                 # schema.prisma, migrations/, seed.ts
│   ├── Dockerfile              # imagem do backend (deploy na Railway)
│   └── railway.toml            # configuração de build e start na Railway
├── .github/workflows/
│   ├── ci.yml                  # lint, typecheck, build (frontend e backend) e testes E2E
│   └── deploy.yml              # deploy após o CI passar na main
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
npm run test:e2e          # Playwright; usa E2E_BASE_URL se o frontend estiver em outra porta
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
| @playwright/test | 1.x | Testes E2E |
| @sentry/nextjs, @sentry/node | 8.x | Monitoramento de erros |
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
type CategoriaFato = 'Resultado' | 'Fato Relevante' | 'Aviso' | 'Assembleia' | 'Outros'
```

### Nomenclatura

```
Arquivos:          camelCase.ts, PascalCase.tsx (componentes)
Componentes React: PascalCase          → GraficoCandlestick.tsx
Funções:           camelCase           → getPrecoAtivo()
Constantes:        SCREAMING_SNAKE     → PRECO_TTL
Interfaces:        PascalCase          → interface AtivoPreco
Rotas de API:      kebab-case          → /api/ativos/:ticker/fatos
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

### Abreviaturas nos indicadores

Ao exibir uma abreviatura, escreva-a com o significado por extenso, ex.: `P/L (Preço/Lucro)`,
`ROE (Retorno sobre o Patrimônio)`, `EV/EBITDA (Valor da Firma/EBITDA)`.

---

## Regras de cache (não altere sem atualizar aqui)

| Dado | Chave Redis | TTL | Motivo |
|---|---|---|---|
| Preço atual (brapi) | `preco:{ticker}` | 300s | Mercado atualiza a cada 1 min |
| Cotações em segundo plano (Status Invest) | `cotacao-bg:{ticker}` | 600s | Job a cada 5 min (dias úteis, 10h–18h); traz variação do dia |
| Último fechamento lido pelo job | `fechamento:{ticker}` | 604800s | Exibido fora do pregão, com a data da leitura (`atualizadoEm`) |
| Série diária do Fundamentus | `fundamentus:historico:{ticker}` | 3600s | Fallback do gráfico quando Yahoo e brapi falham |
| Lista IBovespa | `lista:ibovespa` | 300s | Composição muda raramente |
| Lista de FIIs | `lista:fiis` | 300s | Mesmo ciclo da lista de ações |
| Tabela de FIIs do Fundamentus | `fundamentus:fiis` | 3600s | Uma requisição cobre todos os fundos |
| Histórico 1D/1S | `hist:{ticker}:1d` | 300s | Intraday muda com frequência |
| Histórico 1M/3M | `hist:{ticker}:1m` | 1800s | Muda menos durante o dia |
| Histórico 1A/5A | `hist:{ticker}:1y` | 3600s | Dados históricos são estáveis |
| Fatos relevantes | `fatos:{ticker}` | 3600s | B3 publica algumas vezes ao dia |
| Indicadores fundamentalistas | `fund:{ticker}` | 86400s | Dados trimestrais |
| Tabela do Fundamentus (todos os papéis) | `fundamentus:tabela` | 3600s | Atualizada ao longo do dia; uma requisição cobre todos os papéis |
| Detalhe do papel no Fundamentus | `fundamentus:detalhe:{ticker}` | 86400s | Valor de mercado e nº de ações mudam pouco |
| Último valor bom | `ultimo:{ticker}` | 86400s | Exibido quando todas as fontes de cotação falham |
| Brapi sem acesso | `brapi-sem-acesso:{ticker}` | 21600s | Plano sem o ativo: pula a brapi e segue a cadeia de cotação |

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em `backend/.env.example` e `frontend/.env.example`.
**Nunca commite valores reais — apenas o `.env.example`.**

```bash
# APIs externas
BRAPI_TOKEN=           # Token da brapi.dev (obrigatório: cotações, histórico e indicadores)
ADMIN_API_KEY=         # Chave do painel /admin/jobs/status (header x-api-key)

# Banco e cache
DATABASE_URL=          # postgresql://user:pass@localhost:5432/ibovespa
REDIS_URL=             # redis://localhost:6379

# Monitoramento (opcionais: sem DSN o Sentry fica desligado)
SENTRY_DSN=            # DSN do Sentry para o backend e o servidor Next
SENTRY_RELEASE=        # identificador do release (ex.: SHA do commit)
NEXT_PUBLIC_SENTRY_DSN=  # DSN pública do Sentry para o navegador (vai ao cliente)
SENTRY_AUTH_TOKEN=     # somente no CI: envia source maps (não vai ao cliente)

# App
NEXT_PUBLIC_API_URL=   # URL do backend (ex: http://localhost:3001)
NODE_ENV=              # development | production
```

---

## Integrações externas

### brapi.dev (fonte primária de preços e de indicadores)

```typescript
// Base URL: https://brapi.dev/api
// Autenticação: query param ?token=BRAPI_TOKEN
// Endpoints usados:
GET /quote/{ticker}?token=X           // Preço de um ativo
GET /quote/list?sortBy=market_cap_basic&limit=50&token=X  // Lista IBovespa
GET /quote/{ticker}?modules=defaultKeyStatistics,financialData,balanceSheetHistory&token=X
// Módulos acima: indicadores fundamentalistas (cache de 24h em fund:{ticker})
// Módulos disponíveis dependem do plano: summaryDetail não é liberado no plano atual.
```

### Ordem das fontes de cotação

```typescript
// Cotação individual (getPrecoAtivo) e lista IBovespa (getListaIbovespa):
// 1. brapi (cotação atual, com variação do dia)
// 2. Status Invest (cotação atual e variação do dia). A lista usa o cache do job de segundo plano
//    (cotacao-bg:{ticker}); o detalhe consulta a página do ativo quando o job ainda não tem o dado.
// 3. Yahoo Finance (lote; sujeito a limite de requisições)
// 4. Fechamento guardado pelo job (fechamento:{ticker}), com a data da leitura
// 5. Fundamentus (fechamento do último pregão: sem variação nem volume)
// 6. Último valor bom (ultimo:{ticker})
// Fora do pregão (lib/pregao.ts: seg–sex, 10h–18h de Brasília) a consulta ao vivo ao Status Invest
// é pulada e o fechamento guardado vem antes do Yahoo: a página mostraria o último fechamento sem data.
// O campo atualizadoEm indica quando a cotação foi lida; a tela mostra "Fechamento de …" se não for de hoje.
// Campos sem fonte viram null e são exibidos como "—". Nunca inventar valores.
```

### Fundamentus (indicadores e fallback de cotação)

```typescript
// Tabela: https://www.fundamentus.com.br/resultado.php (todos os papéis, uma requisição)
// Detalhe: https://www.fundamentus.com.br/detalhes.php?papel={ticker} (valor de mercado, nº de ações)
// Página em ISO-8859-1: decodificar antes de ler. Números no formato pt-BR.
// Zero em múltiplos e margens significa "não se aplica" (ex.: bancos): vira null.
// Dividend yield e crescimento aceitam zero como valor real.
// É a fonte principal dos indicadores (inclusive P/L); a brapi só completa o que falta.
// Histórico: https://www.fundamentus.com.br/amline/cot_hist.php?papel={ticker}
//   Exige o header Referer da página cotacoes.php?papel={ticker}; sem ele responde vazio.
//   Retorna [[timestamp_ms, fechamento], ...] desde 1999: só fechamento, sem OHLC nem volume.
//   No gráfico, cada candle usa o fechamento nos quatro preços e volume zero. Não há intradiário (1D).
```

### Status Invest (cotação com variação do dia)

```typescript
// Página: https://statusinvest.com.br/acoes/{ticker}
// Preço: div[title="Valor atual do ativo"] strong.value
// Variação: span[title="Variação do valor do ativo com base no dia anterior"] b
// O sinal vem do ícone: arrow_downward = queda. Respeitar o intervalo de 1s (lib/throttle.ts).
// Ações: /acoes/{ticker}. Fundos imobiliários: /fundos-imobiliarios/{ticker} (mesmos seletores).
// NÃO usar o bloco "VOLUME (dia)": comparado com a brapi, não corresponde a reais nem a
// quantidade de ações. A coluna da lista é a liquidez média diária (R$, 2 meses) do Fundamentus,
// para ações e FIIs: uma única métrica, bem definida, para todos os ativos.
```

### Fundos imobiliários (FIIs)

```typescript
// Lista: GET /api/ativos?tipo=fii — os 50 FIIs mais líquidos da tabela do Fundamentus
//   (https://www.fundamentus.com.br/fii_resultado.php, cache fundamentus:fiis).
// Ações: GET /api/ativos (ou ?tipo=acao). A home alterna pelo seletor e guarda a escolha em ?tipo=fii.
// Um ticker é FII se estiver na tabela de FIIs (ehFii). O sufixo 11 não basta: units de ações
// (TAEE11, KLBN11, SANB11) também terminam em 11.
// Indicadores: GET /api/fiis/:ticker/indicadores (DY, P/VP, FFO yield, cap rate, vacância, imóveis).
// Comunicados: Investidor10 em /fiis/{ticker}/ (ações em /acoes/{ticker}/), mesma marcação.
// Cotação e variação: Status Invest /fundos-imobiliarios/{ticker}, coberto pelo job de cotações.
// Gráfico: mesma cadeia das ações (Yahoo → brapi → histórico do Fundamentus).
// Zero na tabela de FIIs = "não se aplica", exceto dividend yield, vacância e nº de imóveis
// (fundo de papel tem zero imóveis).
```

### Yahoo Finance (histórico OHLCV)

```typescript
// Biblioteca: yahoo-finance2 (npm)
// Tickers brasileiros precisam do sufixo .SA
import yahooFinance from 'yahoo-finance2'
const result = await yahooFinance.historical('PETR4.SA', { period1: '2025-01-01' })
```

### Investidor10 (fatos relevantes — scraping)

```typescript
// URL: https://investidor10.com.br/acoes/{ticker}/
// Seletores: #communications-section .communication-card (data, título e link do documento)
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
❌ Nunca formate valores monetários ou datas inline — use /lib/formatters.ts
❌ Nunca faça scraping sem o delay de 1s entre requisições
❌ Nunca exponha API keys no frontend (NEXT_PUBLIC_*), exceto a DSN pública do Sentry
❌ Nunca use WidthType.PERCENTAGE no Prisma/SQL — use valores absolutos
❌ Nunca altere TTLs de cache sem atualizar a tabela neste arquivo
❌ Nunca use `console.log` em produção — use o logger do Fastify (server) ou noop (client)
❌ Nunca reintroduza chamadas a LLMs pagas (ex.: Claude API) sem decisão explícita: consomem tokens
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
✅ Marque tarefas como [x] no TASKS.md somente depois de verificar o critério de conclusão
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
- Abreviaturas dos indicadores escritas por extenso
```

---

## Deploy

- **Frontend (Vercel):** `frontend/vercel.json` faz o rewrite de `/api/*` para o backend. A URL de destino
  é um placeholder (`SUBSTITUA-PELO-DOMINIO-DO-BACKEND`) que precisa ser trocada pelo domínio real da Railway.
- **Backend (Railway):** `backend/railway.toml` + `backend/Dockerfile`. Root Directory = `backend`.
  PostgreSQL e Redis são serviços separados na Railway.
- **Workflow `deploy.yml`:** roda quando o `ci.yml` termina com sucesso na `main`. Usa os segredos
  `VERCEL_TOKEN` e `RAILWAY_TOKEN`; sem eles, a etapa correspondente é pulada.

---

## Contatos e referências

| Recurso | URL |
|---|---|
| Documentação brapi.dev | https://brapi.dev/docs |
| Lightweight Charts | https://tradingview.github.io/lightweight-charts/ |
| Composição IBovespa (B3) | https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm |
| Prisma Docs | https://www.prisma.io/docs |
| Fastify Docs | https://fastify.dev/docs/latest/ |
| BullMQ Docs | https://docs.bullmq.io |
| Playwright Docs | https://playwright.dev/docs/intro |
| Sentry (Next.js) | https://docs.sentry.io/platforms/javascript/guides/nextjs/ |

---

*Mantenha este arquivo atualizado sempre que houver mudança de stack, convenção ou decisão técnica relevante.*
