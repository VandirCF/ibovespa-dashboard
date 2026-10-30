# PRD — IBovespa Dashboard

**Versão:** 1.0  
**Data:** Abril 2026  
**Status:** Em elaboração  
**Responsável:** A definir

---

## 1. Visão geral

### 1.1 Problema

Investidores pessoa física que operam na B3 precisam consultar múltiplas plataformas para reunir preços, gráficos, fatos relevantes e análises de ativos do IBovespa. Essa fragmentação gera perda de tempo, dificulta a tomada de decisão e não oferece recomendações contextualizadas com inteligência artificial.

### 1.2 Solução

O **IBovespa Dashboard** é uma aplicação web que centraliza em uma única interface os dados dos principais ativos do índice Bovespa, com busca inteligente, gráficos interativos, listagem de fatos relevantes da B3 e recomendações geradas por IA (Claude API).

### 1.3 Objetivo de negócio

- Oferecer uma ferramenta de consulta rápida e acessível para investidores individuais.
- Demonstrar o uso de IA aplicada a finanças com a Claude API.
- Servir como produto base para evolução futura com carteira pessoal, alertas e backtesting.

---

## 2. Usuários-alvo

| Perfil | Descrição |
|---|---|
| Investidor iniciante | Quer entender o desempenho de ativos e receber orientações simplificadas |
| Investidor intermediário | Analisa gráficos, acompanha fatos relevantes e quer recomendações rápidas |
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
- Informações por comunicado: data/hora, categoria (resultado, fato relevante, aviso, assembleia), título e resumo.
- Link para o documento original no site da B3.
- Filtro por categoria e por período (últimos 30 / 90 / 180 dias).
- Exibir no mínimo os 10 comunicados mais recentes.

**Critério de aceite:** Comunicados carregam em menos de 3 segundos. Dados não são mais antigos que 24 horas.

### 3.5 Recomendações com IA

- Para cada ativo, gerar uma análise com base em: preço atual, variação dos últimos 30 dias, indicadores P/L, dividend yield, e os 3 fatos relevantes mais recentes.
- A IA (Claude API) retorna: sinal de recomendação (Comprar / Manter / Vender), justificativa em português com no máximo 200 palavras, e pontos de atenção (positivos e negativos).
- Aviso obrigatório de que a análise é gerada por IA e não constitui recomendação de investimento regulamentada.
- Cache da recomendação por 1 hora para o mesmo ativo.
- Botão de regenerar análise disponível para o usuário.

**Critério de aceite:** A recomendação é gerada em menos de 10 segundos. O aviso de "não é recomendação oficial" é sempre visível.

---

## 4. Requisitos não funcionais

### 4.1 Performance

- Tempo de carregamento inicial (LCP): menor que 2,5 segundos em conexão 4G.
- Core Web Vitals: LCP < 2,5s, INP < 200ms, CLS < 0,1.
- Cache de dados de preço: TTL de 5 minutos (Redis).
- Cache de recomendação IA: TTL de 60 minutos (Redis).

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
| Deploy frontend | Vercel |
| Deploy backend | Railway ou Render |

### 5.2 Fontes de dados

| Fonte | Dados | Observações |
|---|---|---|
| brapi.dev | Preços em tempo real, lista IBovespa | API REST gratuita, limites generosos |
| yahoo-finance2 (npm) | Histórico OHLCV | Gratuito, sem autenticação |
| Alpha Vantage | Indicadores fundamentalistas | Plano free: 25 req/dia |
| B3 / Investidor10 | Fatos relevantes | Scraping controlado |
| Claude API (Anthropic) | Análise e recomendação IA | claude-sonnet-4-6 |

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
5. Usuário rola para baixo e vê os últimos fatos relevantes da empresa.
6. Usuário clica em "Gerar análise com IA" — após alguns segundos, a recomendação aparece com sinal e justificativa.
7. Usuário lê o aviso de que a análise é gerada por IA e não constitui recomendação financeira.

---

## 7. Fora do escopo (MVP)

- Autenticação e carteira personalizada
- Alertas de preço por e-mail ou push
- Comparação entre múltiplos ativos no mesmo gráfico
- Dados de opções, BDRs e FIIs
- Backtesting de estratégias
- App mobile nativo
- Integração com corretoras

---

## 8. Métricas de sucesso

| Métrica | Meta (3 meses após lançamento) |
|---|---|
| Usuários únicos por mês | 500 |
| Tempo médio de sessão | > 3 minutos |
| Taxa de geração de análise IA | > 30% das sessões |
| Uptime | > 99% em dias de pregão |
| NPS dos primeiros usuários | > 40 |

---

## 9. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| API de dados financeiros instável | Alta | Alto | Implementar fallback entre fontes (brapi → Yahoo Finance) |
| Rate limit das APIs gratuitas | Média | Médio | Cache agressivo no Redis + fila de jobs |
| Custo da Claude API escalar | Baixa | Médio | Cache de 1h por recomendação + limite de gerações por usuário |
| Scraping de fatos relevantes bloqueado | Média | Médio | Manter dois scrapers alternativos (B3 + Investidor10) |
| Alucinação da IA em recomendações | Alta | Alto | Aviso obrigatório, input estruturado, sem dados inventados |

---

## 10. Fases de entrega

### Fase 1 — MVP (4 semanas)
- [ ] Scaffold do projeto (Next.js + Fastify + PostgreSQL + Redis)
- [ ] Lista de ativos com preços em tempo real (brapi.dev)
- [ ] Busca com autocomplete
- [ ] Tela de detalhe com gráfico de candlestick (1D, 1S, 1M, 1A)

### Fase 2 — Fatos relevantes (2 semanas)
- [ ] Integração com fonte de fatos relevantes
- [ ] Filtros por categoria e período
- [ ] Link para documento original na B3

### Fase 3 — IA (2 semanas)
- [ ] Integração com Claude API
- [ ] Geração de recomendação com cache
- [ ] Aviso regulatório obrigatório
- [ ] Botão de regenerar análise

### Fase 4 — Qualidade e deploy (1 semana)
- [ ] Testes E2E com Playwright
- [ ] Otimização de Core Web Vitals
- [ ] Deploy em produção (Vercel + Railway)
- [ ] Monitoramento com Sentry

---

## 11. Referências

- [Documentação brapi.dev](https://brapi.dev/docs)
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [Claude API — Anthropic](https://docs.anthropic.com)
- [Composição do IBovespa — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/ibovespa.htm)

---

*Este documento é um artefato vivo. Atualizações devem ser registradas com data e versão no topo do arquivo.*
