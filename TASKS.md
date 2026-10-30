# TASKS — IBovespa Dashboard

**Versão:** 1.0  
**Atualizado em:** Abril 2026  
**Referência:** PRD.md v1.0

> Use este arquivo como input direto para o Claude Code.  
> Cada tarefa tem contexto, critério de conclusão e o comando/prompt sugerido.

---

## Como usar com Claude Code

```bash
# Abra o projeto e inicie o Claude Code
claude

# Referencie este arquivo no início da sessão
> Leia o arquivo TASKS.md e o PRD.md. Vamos executar as tarefas da Fase 1.
```

---

## Status das tarefas

| Símbolo | Significado |
|---|---|
| `[ ]` | Pendente |
| `[~]` | Em progresso |
| `[x]` | Concluída |
| `[!]` | Bloqueada |

---

## FASE 1 — Scaffold e dados em tempo real

### T-001 — Inicializar projeto Next.js

**Prioridade:** Alta  
**Estimativa:** 30 min  
**Dependências:** Nenhuma

**Contexto:** Criar a base do projeto frontend com Next.js 14 App Router, TypeScript e TailwindCSS. Incluir ESLint, Prettier e estrutura de pastas padrão.

**Tarefa para o Claude Code:**
```
Crie um projeto Next.js 14 com App Router e TypeScript. Configure:
- TailwindCSS com tema customizado (cores: verde #16A34A para alta, vermelho #DC2626 para baixa, fundo escuro #0F172A)
- ESLint + Prettier com regras padrão
- Estrutura de pastas: /app, /components, /lib, /hooks, /types, /services
- Arquivo .env.local com as variáveis: BRAPI_TOKEN, ALPHA_VANTAGE_KEY, ANTHROPIC_API_KEY, REDIS_URL, DATABASE_URL
- README.md com instruções de setup
```

**Critério de conclusão:**
- [x] `npm run dev` sobe sem erros
- [x] TailwindCSS funcionando com tema customizado
- [x] Estrutura de pastas criada
- [x] `.env.example` com todas as variáveis (sem valores reais)

---

### T-002 — Inicializar backend Fastify

**Prioridade:** Alta  
**Estimativa:** 45 min  
**Dependências:** T-001

**Contexto:** API backend em Node.js com Fastify. Deve ter CORS configurado para o frontend, rate limiting, e estrutura de rotas modular.

**Tarefa para o Claude Code:**
```
Crie uma API REST com Fastify e TypeScript na pasta /server. Configure:
- Fastify com @fastify/cors (origin: localhost:3000 em dev)
- @fastify/rate-limit: 60 req/min por IP
- Estrutura de rotas em /server/routes com arquivos separados por domínio: ativos.ts, graficos.ts, fatos.ts, recomendacoes.ts
- Health check em GET /health retornando { status: "ok", timestamp }
- Variáveis de ambiente com dotenv
- Script de start com ts-node-dev para hot reload
```

**Critério de conclusão:**
- [x] `npm run dev` no /server sobe na porta 3001
- [x] GET /health retorna 200
- [x] Rate limiting ativo (teste com wrk ou curl em loop)
- [x] CORS aceita origem do frontend

---

### T-003 — Configurar PostgreSQL + TimescaleDB + Prisma

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-002

**Contexto:** Banco de dados principal para armazenar metadados dos ativos e histórico OHLCV. TimescaleDB estende o PostgreSQL com suporte eficiente a séries temporais.

**Tarefa para o Claude Code:**
```
Configure o banco de dados do projeto:
1. Crie o docker-compose.yml com serviços: postgres (com extensão timescaledb), redis
2. Configure Prisma com schema incluindo os models:
   - Ativo: id, ticker, nome, setor, subsector, createdAt
   - PrecoHistorico: id, ativoId, timestamp, open, high, low, close, volume (hypertable TimescaleDB)
   - FatoRelevante: id, ativoId, titulo, categoria, dataPublicacao, resumo, urlDocumento
3. Crie migration inicial
4. Crie seed com os 50 principais ativos do IBovespa (ticker + nome + setor)
```

**Critério de conclusão:**
- [x] `docker-compose up` sobe postgres e redis sem erros
- [x] `npx prisma migrate dev` roda sem erros
- [x] `npx prisma db seed` popula os 50 ativos
- [ ] TimescaleDB hypertable criada para PrecoHistorico (requer SQL manual após migration)

---

### T-004 — Configurar Redis e camada de cache

**Prioridade:** Alta  
**Estimativa:** 30 min  
**Dependências:** T-003

**Contexto:** Redis para cache de preços (TTL 5min), recomendações IA (TTL 60min) e dados fundamentalistas (TTL 24h).

**Tarefa para o Claude Code:**
```
Crie o módulo de cache em /server/lib/cache.ts usando ioredis:
- Função get(key): retorna valor ou null
- Função set(key, value, ttlSeconds): armazena com TTL
- Função del(key): remove chave
- Função getOrSet(key, ttlSeconds, fetchFn): retorna cache ou executa fetchFn e armazena
- Constantes de TTL: PRECO_TTL = 300, RECOMENDACAO_TTL = 3600, FUNDAMENTUS_TTL = 86400
- Logs de cache hit/miss em modo debug
```

**Critério de conclusão:**
- [x] Conexão com Redis funciona via docker-compose
- [x] Função `getOrSet` testada manualmente
- [x] Logs de hit/miss aparecem em dev

---

### T-005 — Integração com brapi.dev (preços em tempo real)

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-004

**Contexto:** brapi.dev é a fonte primária de preços em tempo real dos ativos brasileiros. Retorna preço atual, variação, volume e dados básicos.

**Tarefa para o Claude Code:**
```
Crie o serviço /server/services/brapiService.ts:
- Função getPrecoAtivo(ticker): busca preço atual de um ativo via GET https://brapi.dev/api/quote/{ticker}
- Função getListaIbovespa(): busca todos os ativos do IBovespa via GET https://brapi.dev/api/quote/list?search=&sortBy=market_cap_basic&limit=50
- Ambas as funções usam a camada de cache (T-004) com PRECO_TTL
- Em caso de erro da brapi, loga o erro e faz fallback para yahoo-finance2
- Retorno tipado com interface AtivoPreco: { ticker, nome, preco, variacao, variacaoPercent, volume, marketCap }

Crie a rota GET /api/ativos que retorna a lista completa.
Crie a rota GET /api/ativos/:ticker que retorna dados de um ativo específico.
```

**Critério de conclusão:**
- [ ] GET /api/ativos retorna array com 50+ ativos
- [x] GET /api/ativos/PETR4 retorna preço atual da Petrobras
- [ ] Cache Redis funciona (segunda chamada é mais rápida)
- [ ] Fallback para Yahoo Finance funciona se brapi falhar

---

### T-006 — Integração com yahoo-finance2 (histórico OHLCV)

**Prioridade:** Alta  
**Estimativa:** 45 min  
**Dependências:** T-004

**Contexto:** Dados históricos de candlestick (Open, High, Low, Close, Volume) para os gráficos. Yahoo Finance fornece histórico gratuito sem autenticação.

**Tarefa para o Claude Code:**
```
Crie o serviço /server/services/yahooService.ts usando a biblioteca yahoo-finance2:
- Função getHistorico(ticker, periodo): retorna array OHLCV
  - Períodos suportados: '1d' | '1w' | '1m' | '3m' | '1y' | '5y'
  - Tickers brasileiros precisam do sufixo .SA (ex: PETR4.SA)
  - Retorno tipado: Array<{ timestamp, open, high, low, close, volume }>
- Usa cache com TTL variável por período:
  - 1d e 1w: TTL 300s
  - 1m e 3m: TTL 1800s
  - 1y e 5y: TTL 3600s

Crie a rota GET /api/ativos/:ticker/historico?periodo=1m
```

**Critério de conclusão:**
- [ ] GET /api/ativos/PETR4/historico?periodo=1m retorna array OHLCV com 20+ candles
- [ ] GET /api/ativos/VALE3/historico?periodo=1y retorna ~252 candles
- [ ] Ticker sem .SA é tratado automaticamente pelo serviço

---

### T-007 — Página inicial: lista de ativos

**Prioridade:** Alta  
**Estimativa:** 90 min  
**Dependências:** T-005

**Contexto:** Tela principal do app. Mostra todos os ativos do IBovespa em uma tabela/grid com dados de preço, variação e volume. Deve atualizar a cada 5 minutos.

**Tarefa para o Claude Code:**
```
Crie a página /app/page.tsx com:
- Tabela de ativos com colunas: Ticker, Nome, Preço (R$), Variação (%), Volume, Setor
- Variação positiva em verde (#16A34A), negativa em vermelho (#DC2626)
- Ordenação clicável por coluna (padrão: maior variação)
- Revalidação automática a cada 300 segundos (Next.js revalidate)
- Loading skeleton enquanto dados carregam
- Cada linha é clicável e navega para /ativo/[ticker]
- Header com: logo "IBovespa Dashboard", horário da última atualização, indicador de mercado aberto/fechado

Use SWR para fetch client-side com revalidação por intervalo.
```

**Critério de conclusão:**
- [ ] Página carrega com lista de 50+ ativos
- [x] Cores de variação corretas (verde/vermelho)
- [ ] Ordenação por coluna funciona
- [ ] Clique na linha navega para detalhe do ativo
- [ ] Skeleton aparece no primeiro load

---

### T-008 — Busca com autocomplete

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-007

**Contexto:** Campo de busca no header que filtra ativos por ticker ou nome da empresa com resultado em tempo real.

**Tarefa para o Claude Code:**
```
Crie o componente /components/BuscaAtivo.tsx:
- Input com debounce de 200ms
- Dropdown com até 8 resultados mostrando: ticker (negrito), nome da empresa, setor
- Busca local primeiro (contra a lista já carregada em memória) — sem chamada extra à API
- Histórico das últimas 5 buscas salvo em localStorage, exibido quando o input está vazio
- Navega para /ativo/[ticker] ao selecionar resultado
- Fecha o dropdown ao pressionar Escape ou clicar fora
- Acessível: suporte a navegação por teclado (↑↓ Enter)
```

**Critério de conclusão:**
- [ ] Resultados aparecem em menos de 300ms
- [ ] Busca por "petro" retorna PETR3 e PETR4
- [ ] Busca por "VALE" retorna VALE3
- [ ] Histórico de buscas persiste após reload da página
- [ ] Navegação por teclado funciona corretamente

---

## FASE 2 — Tela de detalhe e gráficos

### T-009 — Página de detalhe do ativo

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-007, T-006

**Contexto:** Tela exibida ao clicar em um ativo. Contém: dados do ativo, gráfico, fatos relevantes e recomendação IA. Layout em duas colunas em desktop.

**Tarefa para o Claude Code:**
```
Crie a página /app/ativo/[ticker]/page.tsx com:
- Header da página: ticker, nome da empresa, setor, preço atual, variação do dia
- Badge "Mercado aberto" / "Mercado fechado" baseado no horário de Brasília
- Abas: Gráfico | Fatos relevantes | Recomendação IA
- Breadcrumb: Home > [ticker]
- Botão "Voltar para a lista"
- Metadados para SEO: title="PETR4 - Petrobras | IBovespa Dashboard", description com preço atual

Busque os dados via fetch no servidor (Server Component) com revalidate de 300s.
```

**Critério de conclusão:**
- [ ] Página /ativo/PETR4 carrega com dados corretos
- [ ] Badge de mercado aberto/fechado exibido corretamente
- [ ] As 3 abas funcionam e trocam conteúdo sem reload
- [ ] Metadados SEO presentes no HTML

---

### T-010 — Gráfico de candlestick (Lightweight Charts)

**Prioridade:** Alta  
**Estimativa:** 90 min  
**Dependências:** T-009, T-006

**Contexto:** Gráfico interativo de candlestick usando a biblioteca TradingView Lightweight Charts. Deve ser responsivo e suportar múltiplos períodos.

**Tarefa para o Claude Code:**
```
Crie o componente /components/GraficoCandlestick.tsx usando lightweight-charts:
- Gráfico de candlestick com cores: alta #16A34A, baixa #DC2626
- Subgráfico de volume abaixo (altura 20% do total)
- Seletor de período: 1D | 1S | 1M | 3M | 1A | 5A
- Ao trocar período, busca novos dados da rota /api/ativos/:ticker/historico?periodo=X
- Tooltip customizado ao passar o mouse: data, O, H, L, C, Volume
- Botão para ativar/desativar médias móveis (MA20 e MA50) como séries de linha
- Responsivo: ocupa 100% da largura, altura fixa de 400px em desktop, 280px em mobile
- Tema escuro alinhado com a paleta do projeto
```

**Critério de conclusão:**
- [ ] Candlestick renderiza corretamente para PETR4 período 1M
- [ ] Trocar período recarrega os dados sem piscar a tela
- [ ] Volume aparece no subgráfico
- [ ] Tooltip aparece ao passar o mouse
- [ ] Médias móveis funcionam como toggle
- [ ] Responsivo em mobile (375px)

---

### T-011 — Job de coleta de histórico (BullMQ)

**Prioridade:** Média  
**Estimativa:** 60 min  
**Dependências:** T-003, T-006

**Contexto:** Job agendado para coletar e persistir o histórico OHLCV diário de todos os ativos no banco de dados. Roda após o fechamento do mercado (19h, dias úteis).

**Tarefa para o Claude Code:**
```
Crie o worker de coleta em /server/jobs/coletaHistorico.ts usando BullMQ:
- Job "coleta-diaria" agendado via cron para 19:30 todos os dias úteis (America/Sao_Paulo)
- Para cada ativo na tabela Ativo do banco, busca os últimos 5 dias de histórico via yahooService
- Salva no banco usando upsert em PrecoHistorico (evita duplicatas)
- Log de progresso: "Coletando PETR4... ok (245ms)"
- Em caso de erro por ativo, loga e continua para o próximo (não falha o job inteiro)
- Painel de monitoramento: expor rota GET /admin/jobs/status (protegida por API key simples)
```

**Critério de conclusão:**
- [ ] Job roda manualmente sem erros (`queue.add('coleta-diaria', {})`)
- [ ] Dados são inseridos na tabela PrecoHistorico
- [ ] Falha em um ativo não interrompe os demais
- [ ] Rota /admin/jobs/status retorna status da fila

---

## FASE 3 — Fatos relevantes

### T-012 — Serviço de fatos relevantes

**Prioridade:** Alta  
**Estimativa:** 90 min  
**Dependências:** T-004

**Contexto:** Buscar comunicados oficiais publicados pelas empresas na B3. A fonte primária é o Investidor10 (scraping controlado). Fallback para a API pública da B3.

**Tarefa para o Claude Code:**
```
Crie o serviço /server/services/fatosService.ts:
- Função getFatos(ticker, limite=10): retorna os comunicados mais recentes do ativo
- Use axios + cheerio para scraping do Investidor10 (URL: https://investidor10.com.br/acoes/{ticker}/#comunicados)
- Retorno tipado: Array<{ id, titulo, categoria, dataPublicacao, resumo, urlOriginal }>
- Categorias mapeadas: 'Resultado' | 'Fato Relevante' | 'Aviso' | 'Assembleia' | 'Outros'
- Cache com TTL de 3600s (1 hora)
- Em caso de falha no scraping, retornar array vazio com log de erro (não travar a página)

Crie a rota GET /api/ativos/:ticker/fatos?limite=10&categoria=all&dias=90
```

**Critério de conclusão:**
- [ ] GET /api/ativos/PETR4/fatos retorna ao menos 5 comunicados
- [ ] Cada comunicado tem titulo, categoria, data e URL do documento
- [ ] Filtro por categoria funciona
- [ ] Cache evita scraping repetido dentro de 1 hora

---

### T-013 — Componente de fatos relevantes

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-012, T-009

**Contexto:** Seção da tela de detalhe que lista os comunicados do ativo com filtros e link para o documento original.

**Tarefa para o Claude Code:**
```
Crie o componente /components/FatosRelevantes.tsx:
- Lista de cards, um por comunicado
- Cada card: badge de categoria (cor por tipo), data formatada em pt-BR, título em negrito, resumo em 2 linhas com "ver mais", link externo para o documento original
- Filtros no topo: dropdown de categoria, seletor de período (30d / 90d / 180d)
- Estado vazio: mensagem "Nenhum comunicado encontrado no período selecionado"
- Estado de loading: skeleton de 3 cards
- Estado de erro: mensagem amigável + botão de tentar novamente
- Paginação simples: botão "Carregar mais" se houver mais de 10 resultados
```

**Critério de conclusão:**
- [ ] Cards renderizam com dados reais de PETR4
- [ ] Filtro de categoria funciona sem reload
- [ ] Link do documento abre em nova aba
- [ ] Skeleton aparece durante o carregamento
- [ ] Estado vazio e erro exibidos corretamente

---

## FASE 4 — Recomendações com IA

### T-014 — Serviço de análise com Claude API

**Prioridade:** Alta  
**Estimativa:** 90 min  
**Dependências:** T-005, T-012

**Contexto:** Integração com a Claude API para gerar análise fundamentada de cada ativo. O prompt inclui dados de preço, indicadores e fatos recentes.

**Tarefa para o Claude Code:**
```
Crie o serviço /server/services/analisaService.ts:
- Função gerarAnalise(ticker): monta o contexto e chama a Claude API
- Contexto enviado ao Claude:
  - Preço atual, variação 30d, variação 1a
  - P/L e dividend yield (buscar do Alpha Vantage com fallback para brapi)
  - Os 3 fatos relevantes mais recentes (título + data)
- System prompt: "Você é um analista de ações brasileiro. Analise o ativo com base nos dados fornecidos. Seja objetivo, use português formal. Não invente dados que não foram fornecidos."
- User prompt estruturado com os dados acima
- Resposta esperada em JSON: { sinal: 'Comprar'|'Manter'|'Vender', justificativa: string (max 200 palavras), positivos: string[], negativos: string[] }
- Use claude-sonnet-4-6, max_tokens: 1000
- Cache da resposta por 3600s (TTL 1 hora)

Crie a rota POST /api/ativos/:ticker/analise
Crie a rota DELETE /api/ativos/:ticker/analise/cache (para forçar regeneração)
```

**Critério de conclusão:**
- [ ] POST /api/ativos/PETR4/analise retorna JSON com sinal, justificativa, positivos e negativos
- [ ] Resposta em menos de 10 segundos
- [ ] Segunda chamada usa cache (retorna em menos de 100ms)
- [ ] DELETE /cache invalida e força nova geração

---

### T-015 — Componente de recomendação IA

**Prioridade:** Alta  
**Estimativa:** 60 min  
**Dependências:** T-014, T-009

**Contexto:** Seção da tela de detalhe que exibe a recomendação gerada pela IA com sinal visual claro e aviso regulatório obrigatório.

**Tarefa para o Claude Code:**
```
Crie o componente /components/RecomendacaoIA.tsx:
- Estado inicial: botão "Gerar análise com IA" centralizado
- Loading: spinner com mensagem "Analisando {ticker} com IA..."
- Resultado:
  - Badge grande com sinal: COMPRAR (verde) | MANTER (amarelo) | VENDER (vermelho)
  - Seção "Justificativa" com o texto da análise
  - Duas colunas: "Pontos positivos" (ícone ✓ verde) e "Pontos de atenção" (ícone ⚠ amarelo)
  - Rodapé: data/hora da análise + botão "Regenerar análise"
- Aviso regulatório OBRIGATÓRIO e sempre visível:
  "⚠️ Esta análise é gerada por inteligência artificial e não constitui recomendação de investimento. Consulte um profissional certificado antes de tomar decisões financeiras."
  (fundo amarelo claro, borda amarela, texto escuro)
- Em caso de erro: mensagem amigável + botão de tentar novamente
```

**Critério de conclusão:**
- [ ] Fluxo completo funciona: botão → loading → resultado
- [ ] Badge de sinal com cor correta
- [ ] Aviso regulatório SEMPRE visível (não pode ser dispensado)
- [ ] Botão "Regenerar" chama DELETE /cache e depois POST /analise
- [ ] Estado de erro exibido corretamente

---

## FASE 5 — Qualidade e deploy

### T-016 — Indicadores fundamentalistas

**Prioridade:** Média  
**Estimativa:** 60 min  
**Dependências:** T-009

**Contexto:** Painel de indicadores na tela de detalhe com os principais múltiplos do ativo. Dados vindos do Alpha Vantage ou scraping do Fundamentus.

**Tarefa para o Claude Code:**
```
Crie o componente /components/Indicadores.tsx com os dados:
- P/L (Preço/Lucro)
- P/VP (Preço/Valor Patrimonial)
- Dividend Yield (%)
- ROE (%)
- Margem Líquida (%)
- Dívida Líquida / EBITDA
- Market Cap (R$ bi)

Exiba como grid de cards 2x4. Cada card: nome do indicador (muted), valor em destaque, tooltip explicando o que é o indicador.
Fonte: Alpha Vantage OVERVIEW endpoint. Cache TTL: 86400s (24h).
Crie a rota GET /api/ativos/:ticker/indicadores
```

**Critério de conclusão:**
- [ ] Grid de indicadores aparece na tela de detalhe
- [ ] Tooltips explicativos funcionam
- [ ] Dados atualizados a cada 24 horas
- [ ] Valores formatados em pt-BR (ex.: R$ 4,5 bi, 12,3%)

---

### T-017 — Testes E2E com Playwright

**Prioridade:** Média  
**Estimativa:** 90 min  
**Dependências:** T-007, T-010, T-013, T-015

**Contexto:** Testes automatizados dos fluxos críticos para garantir que o produto funciona após mudanças.

**Tarefa para o Claude Code:**
```
Configure Playwright e crie os testes em /tests/e2e/:

1. home.spec.ts
   - Página carrega com lista de ativos
   - Tabela tem ao menos 10 linhas
   - Ordenação por coluna funciona

2. busca.spec.ts
   - Digitar "PETR" no campo de busca mostra dropdown com PETR4
   - Clicar em PETR4 navega para /ativo/PETR4
   - Histórico de buscas persiste após reload

3. detalhe.spec.ts
   - Página /ativo/PETR4 carrega com nome "Petrobras"
   - Trocar período do gráfico não quebra a página
   - Aba de fatos relevantes mostra ao menos 1 comunicado

4. recomendacao.spec.ts
   - Clicar em "Gerar análise" mostra loading
   - Aviso regulatório está visível antes e depois da análise
   - Badge de sinal (Comprar/Manter/Vender) aparece no resultado
```

**Critério de conclusão:**
- [ ] Todos os 4 arquivos de teste criados
- [ ] `npx playwright test` roda sem erros críticos (pode ter flaky em dados ao vivo)
- [ ] CI configurado para rodar os testes

---

### T-018 — Otimização de performance

**Prioridade:** Média  
**Estimativa:** 60 min  
**Dependências:** T-017

**Contexto:** Garantir que o app atinja as metas de Core Web Vitals definidas no PRD.

**Tarefa para o Claude Code:**
```
Analise e otimize a performance do app:
1. Rode next build e analise o bundle com @next/bundle-analyzer
2. Identifique e corrija os 3 maiores problemas de performance
3. Configure next/image em todas as imagens (logos das empresas)
4. Adicione loading.tsx em /app e /app/ativo/[ticker] para streaming
5. Configure headers de cache no Next.js para assets estáticos
6. Adicione Suspense boundaries nos componentes pesados (gráfico, fatos, IA)
7. Verifique e corrija qualquer layout shift (CLS) nos skeletons

Meta: LCP < 2,5s medido no PageSpeed Insights em mobile.
```

**Critério de conclusão:**
- [ ] Bundle principal < 200KB gzipped
- [ ] LCP < 2,5s no PageSpeed (mobile)
- [ ] CLS < 0,1
- [ ] Suspense boundaries em todos os componentes assíncronos

---

### T-019 — Deploy em produção

**Prioridade:** Alta  
**Estimativa:** 90 min  
**Dependências:** T-018

**Contexto:** Deploy do frontend na Vercel e do backend + banco na Railway. Configurar variáveis de ambiente e domínio.

**Tarefa para o Claude Code:**
```
Configure o deploy do projeto:

Frontend (Vercel):
- Crie vercel.json com configurações de rewrite para proxying da API
- Configure as variáveis de ambiente no painel da Vercel
- Adicione domínio customizado (se disponível)

Backend (Railway):
- Crie railway.toml com configurações de build e start
- Configure Dockerfile para o servidor Fastify
- Configure as variáveis de ambiente no painel da Railway
- Configure PostgreSQL + Redis como serviços do Railway

CI/CD:
- Crie .github/workflows/deploy.yml com:
  - Lint e type check no PR
  - Testes E2E no merge para main
  - Deploy automático após testes passarem
```

**Critério de conclusão:**
- [ ] Frontend acessível em URL da Vercel
- [ ] Backend acessível em URL da Railway
- [ ] Variáveis de ambiente configuradas (sem secrets no código)
- [ ] CI/CD rodando no GitHub Actions

---

### T-020 — Monitoramento com Sentry

**Prioridade:** Baixa  
**Estimativa:** 30 min  
**Dependências:** T-019

**Contexto:** Captura de erros em produção para identificar problemas rapidamente.

**Tarefa para o Claude Code:**
```
Configure Sentry no projeto:
- Instale @sentry/nextjs no frontend e @sentry/node no backend
- Configure sentry.client.config.ts e sentry.server.config.ts
- Adicione SENTRY_DSN nas variáveis de ambiente
- Configure alertas para: erros JavaScript no frontend, erros 500 no backend, falhas nos jobs BullMQ
- Ignore erros de rate limit (429) e cancelamentos de requisição
- Adicione o Sentry ao CI: sentry-cli releases para rastrear deploys
```

**Critério de conclusão:**
- [ ] Erros aparecem no painel do Sentry
- [ ] Deploys são rastreados como releases
- [ ] Alertas configurados para erros críticos

---

## Tarefas de backlog (pós-MVP)

| ID | Descrição | Prioridade |
|---|---|---|
| B-001 | Autenticação com Clerk ou Auth.js | Baixa |
| B-002 | Carteira personalizada (ativos favoritos) | Baixa |
| B-003 | Alertas de preço por e-mail (Resend) | Baixa |
| B-004 | Comparação entre dois ativos no mesmo gráfico | Baixa |
| B-005 | Filtro por setor na lista principal | Média |
| B-006 | Modo claro / escuro toggle | Baixa |
| B-007 | Exportar análise como PDF | Baixa |
| B-008 | Widget embeddable de preço por ticker | Baixa |
| B-009 | Suporte a FIIs e BDRs | Baixa |

---

## Prompts de contexto para o Claude Code

Use estes prompts no início de cada sessão para dar contexto ao Claude Code:

**Início de sessão padrão:**
```
Você está trabalhando no projeto IBovespa Dashboard. Leia o PRD.md e TASKS.md.
Stack: Next.js 14 + TypeScript + TailwindCSS (frontend), Fastify + Node.js (backend), PostgreSQL + TimescaleDB + Redis (dados).
Siga os critérios de conclusão de cada tarefa antes de marcar como concluída.
Sempre use TypeScript strict mode e documente funções públicas com JSDoc.
```

**Para resolver bugs:**
```
Temos um bug na tarefa [T-XXX]. O comportamento esperado é [X]. O comportamento atual é [Y].
Analise o código relevante, identifique a causa raiz e proponha a correção com teste.
```

**Para code review:**
```
Revise o código da tarefa [T-XXX] verificando:
1. Tipos TypeScript corretos e sem any desnecessário
2. Tratamento de erros em todas as chamadas de rede
3. Cache sendo usado onde definido no TASKS.md
4. Nenhum secret ou API key hardcoded
```

---

*Atualize o status de cada tarefa (`[ ]` → `[x]`) conforme o progresso do projeto.*
