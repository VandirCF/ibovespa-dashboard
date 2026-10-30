# PRD — IBovespa Dashboard

**Versão:** 1.1  
**Data:** Outubro 2026  
**Status:** Em desenvolvimento (MVP, fatos relevantes e indicadores entregues; deploy pendente)  
**Responsável:** A definir

**Histórico de versões**
- **1.1 (Outubro 2026):** recomendação por IA removida do escopo (cada análise consome tokens); painel de indicadores fundamentalistas ampliado e passa a usar a brapi como fonte; Alpha Vantage e Claude API removidas das fontes; fases atualizadas ao estado real do projeto.
- **1.0 (Abril 2026):** versão inicial.

---

## 1. Visão geral

### 1.1 Problema

Investidores pessoa física que operam na B3 precisam consultar múltiplas plataformas para reunir preços, gráficos, fatos relevantes e indicadores fundamentalistas de ativos do IBovespa. Essa fragmentação gera perda de tempo e dificulta a comparação entre ativos.

### 1.2 Solução

O **IBovespa Dashboard** é uma aplicação web que centraliza em uma única interface os dados dos principais ativos do índice Bovespa, com busca, gráficos interativos, listagem de fatos relevantes da B3 e um painel completo de indicadores fundamentalistas.

### 1.3 Objetivo de negócio

- Oferecer uma ferramenta de consulta rápida e acessível para investidores individuais.
- Apresentar indicadores fundamentalistas organizados por tipo de análise (valuation, rentabilidade, endividamento, crescimento).
- Servir como produto base para evolução futura com carteira pessoal, alertas e backtesting.

---

## 2. Usuários-alvo

| Perfil | Descrição |
|---|---|
| Investidor iniciante | Quer entender o desempenho de ativos e o significado de cada indicador |
| Investidor intermediário | Analisa gráficos, acompanha fatos relevantes e compara indicadores entre ativos |
| Estudante de finanças | Usa a plataforma como ferramenta de estudo e pesquisa |

**Fora do escopo:** traders profissionais, gestoras de fundos, plataformas de ordem e execução.

---

## 3. Funcionalidades

### 3.1 Lista de ativos do IBovespa

- Exibir os principais ativos que compõem o índice IBovespa (mínimo 50 ativos).
- Mostrar para cada ativo: ticker, nome da empresa, setor, preço atual, variação diária (R$ e %), volume.
- Atualização automática a cada 5 minutos durante o horário de mercado (10h–18h, dias úteis).
- Ordenação por variação, volume ou valor de mercado.
- Indicação visual de alta (verde) e baixa (vermelho) na variação diária.

**Critério de aceite:** A lista carrega em menos de 2 segundos. Os dados têm no máximo 5 minutos de defasagem durante o pregão.

### 3.2 Busca de ativos

- Campo de busca com autocomplete por ticker (ex.: PETR4) ou nome da empresa (ex.: Petrobras).
- Resultado em tempo real a partir do segundo caractere digitado.
- Suporte a busca parcial (ex.: "vale" retorna VALE3, VALE5).
- Histórico das últimas 5 buscas salvo em localStorage.

**Critério de aceite:** Resultados aparecem em menos de 300ms após a digitação.

### 3.3 Gráficos interativos

- Gráfico de candlestick (OHLCV) para o ativo selecionado.
- Períodos disponíveis: 1 dia, 1 semana, 1 mês, 3 meses, 1 ano, 5 anos.
- Gráfico de volume abaixo do candlestick.
- Linha de média móvel simples (20 e 50 períodos) como opção de sobreposição.
- Tooltip ao passar o mouse com OHLCV e volume do período.
- Responsivo para telas de 375px a 1920px.

**Critério de aceite:** O gráfico renderiza em menos de 1 segundo após a seleção do período.

### 3.4 Fatos relevantes

- Listar os comunicados oficiais mais recentes do ativo selecionado publicados na B3.
- Informações por comunicado: data, categoria (resultado, fato relevante, aviso, assembleia, outros) e título.
- Link para o documento original do comunicado.
- Filtro por categoria e por período (últimos 30 / 90 / 180 dias).
- Exibir no mínimo os 10 comunicados mais recentes, com "Carregar mais" quando houver mais.

**Critério de aceite:** Comunicados carregam em menos de 3 segundos. Dados não são mais antigos que 24 horas.

### 3.5 Indicadores fundamentalistas

Painel na tela de detalhe com 23 indicadores em 4 grupos:

- **Valuation:** valor de mercado, P/L (Preço/Lucro), P/VP (Preço/Valor Patrimonial), EV/EBITDA, EV/Receita, PEG, Dividend Yield, FCF Yield.
- **Rentabilidade:** ROE, ROA, margem bruta, margem EBITDA, margem operacional, margem líquida.
- **Endividamento e liquidez:** dívida líquida/EBITDA, dívida líquida/patrimônio líquido, liquidez corrente, liquidez seca.
- **Crescimento e por ação:** crescimento da receita e do lucro (12 meses), LPA, VPA, beta.

Regras:
- Cada indicador tem um tooltip com a explicação do que mede.
- Abreviaturas aparecem sempre com o significado por extenso.
- Indicador sem dado disponível é exibido como "—", nunca estimado.
- Valores em pt-BR (ex.: R$ 716,79 bi, 12,3%, 1,1x).

**Critério de aceite:** Os indicadores são carregados em menos de 3 segundos e atualizados a cada 24 horas.

---

## 4. Requisitos não funcionais

### 4.1 Performance

- Tempo de carregamento inicial (LCP): menor que 2,5 segundos em conexão 4G.
- Core Web Vitals: LCP < 2,5s, INP < 200ms, CLS < 0,1.
- Cache de dados de preço: TTL de 5 minutos (Redis).
- Cache de indicadores fundamentalistas: TTL de 24 horas (Redis).

### 4.2 Disponibilidade

- Uptime mínimo de 99% em dias úteis, horário de mercado.
- Em caso de falha na fonte de dados primária, fallback automático para fonte secundária.

### 4.3 Segurança

- Chaves de API externas armazenadas apenas no servidor (nunca no frontend).
- Rate limiting de 60 requisições por minuto por IP na API pública.
- Sem armazenamento de dados pessoais do usuário na fase inicial (MVP sem autenticação).

### 4.4 Escalabilidade

- A arquitetura deve suportar até 500 usuários simultâneos sem degradação.
- Jobs de coleta de dados desacoplados da API HTTP via fila (BullMQ).

### 4.5 Observabilidade

- Erros de frontend, de backend e de jobs são enviados ao Sentry quando a DSN estiver configurada.
- Erros esperados (limite de requisições 429 e cancelamentos) não são enviados.

---

## 5. Arquitetura técnica

### 5.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS |
| Gráficos | TradingView Lightweight Charts |
| Backend / API | Node.js com Fastify |
| Banco de dados | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Fila de jobs | BullMQ |
| ORM | Prisma |
| Testes E2E | Playwright |
| Monitoramento | Sentry |
| Deploy frontend | Vercel |
| Deploy backend | Railway |

### 5.2 Fontes de dados

| Fonte | Dados | Observações |
|---|---|---|
| brapi.dev | Preços em tempo real, lista IBovespa, indicadores fundamentalistas | API REST com token; alguns módulos dependem do plano |
| yahoo-finance2 (npm) | Histórico OHLCV | Gratuito, sem autenticação; sujeito a limite de requisições |
| B3 / Investidor10 | Fatos relevantes | Scraping controlado, com delay de 1s entre requisições |

### 5.3 MCPs recomendados (Claude Code)

- **Filesystem MCP** — leitura e escrita de arquivos do projeto
- **GitHub MCP** — commits e PRs automáticos
- **Fetch MCP** — teste de chamadas às APIs externas
- **Brave Search MCP** — pesquisa de documentação durante o desenvolvimento
- **PostgreSQL MCP** (opcional) — execução de queries e migrations

---

## 6. Fluxo principal do usuário

1. Usuário acessa a home e vê a lista de ativos do IBovespa com preços atualizados.
2. Usuário digita no campo de busca (ex.: "PETR4") e seleciona o ativo.
3. A tela de detalhe abre com gráfico de candlestick do dia atual.
4. Usuário altera o período para "1 mês" — gráfico recarrega.
5. Usuário abre a aba "Indicadores" e vê os indicadores agrupados por tipo de análise, com explicação em cada card.
6. Usuário abre a aba "Fatos relevantes", filtra por categoria e período e acessa o documento original.

---

## 7. Fora do escopo (MVP)

- Autenticação e carteira personalizada
- Alertas de preço por e-mail ou push
- Comparação entre múltiplos ativos no mesmo gráfico
- Dados de opções, BDRs e FIIs
- Backtesting de estratégias
- App mobile nativo
- Integração com corretoras
- Recomendação de investimento gerada por IA: foi removida do escopo porque cada análise consome tokens de uma API paga. Pode voltar em uma versão futura, com decisão explícita de custo.

---

## 8. Métricas de sucesso

| Métrica | Meta (3 meses após lançamento) |
|---|---|
| Usuários únicos por mês | 500 |
| Tempo médio de sessão | > 3 minutos |
| Sessões com consulta a indicadores ou fatos relevantes | > 40% |
| Uptime | > 99% em dias de pregão |
| NPS dos primeiros usuários | > 40 |

---

## 9. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| API de dados financeiros instável | Alta | Alto | Fallback entre fontes (brapi → Yahoo Finance) e último valor conhecido |
| Rate limit das APIs | Média | Médio | Cache agressivo no Redis + fila de jobs |
| Plano da brapi sem acesso a alguns ativos ou módulos | Alta | Médio | Cache de "sem acesso" por 6h e fallback para Yahoo; indicadores ausentes exibidos como "—" |
| Scraping de fatos relevantes bloqueado | Média | Médio | Delay de 1s, tratamento de 403/429 com lista vazia e log |
| Erros em produção sem visibilidade | Média | Alto | Sentry no frontend e no backend, com filtro de erros esperados |

---

## 10. Fases de entrega

### Fase 1 — MVP (concluída)
- [x] Scaffold do projeto (Next.js + Fastify + PostgreSQL + Redis)
- [x] Lista de ativos com preços em tempo real (brapi.dev)
- [x] Busca com autocomplete
- [x] Tela de detalhe com gráfico de candlestick (1D, 1S, 1M, 1A)

### Fase 2 — Fatos relevantes (concluída)
- [x] Integração com fonte de fatos relevantes (Investidor10)
- [x] Filtros por categoria e período
- [x] Link para o documento original

### Fase 3 — Indicadores fundamentalistas (concluída)
- [x] Painel com 23 indicadores em 4 grupos, com tooltips
- [x] Fonte brapi, cache de 24 horas e formatação pt-BR

### Fase 4 — Recomendação por IA (removida)
- Removida do escopo: cada análise consome tokens. Ver seção 7.

### Fase 5 — Qualidade e deploy (em andamento)
- [x] Testes E2E com Playwright e job de E2E no CI
- [x] Configuração de deploy (Vercel e Railway) e workflow de deploy na `main`
- [x] Monitoramento com Sentry configurado no código (ativa com DSN)
- [ ] Criar contas e cadastrar segredos (Vercel, Railway, Sentry)
- [ ] Medir Core Web Vitals no PageSpeed Insights (mobile)
- [ ] Teste E2E da home estável (depende de dados ao vivo da brapi e do Yahoo)

---

## 11. Referências

- [Documentação brapi.dev](https://brapi.dev/docs)
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Composição do IBovespa — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm)
- [Playwright](https://playwright.dev/docs/intro)
- [Sentry para Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

*Este documento é um artefato vivo. Atualizações devem ser registradas com data e versão no topo do arquivo.*
