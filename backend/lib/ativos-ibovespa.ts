/**
 * Ativo do IBovespa (ticker, nome, setor e subsetor em pt-BR).
 */
export interface AtivoIbovespa {
  ticker: string
  nome: string
  setor: string
  subsector: string
}

/**
 * 50 principais ativos do IBovespa. Fonte da lista exibida pela API e do seed do banco.
 * A composição muda a cada quadrimestre: conferir na composição oficial da B3 antes de produção.
 * Revisão de outubro de 2026: CCRO3 → MOTV3 (Motiva), ELET3 → AXIA3 (Axia Energia),
 * EMBR3 → EMBJ3 (Embraer), MRFG3 → MBRF3 (MBRF) e NUBR33 (sem negociação nas fontes) → VBBR3 (Vibra).
 */
export const ATIVOS_IBOVESPA: readonly AtivoIbovespa[] = [
  { ticker: 'VALE3', nome: 'Vale', setor: 'Materiais Básicos', subsector: 'Mineração' },
  {
    ticker: 'PETR4',
    nome: 'Petrobras PN',
    setor: 'Petróleo e Gás',
    subsector: 'Petróleo, Gás e Biocombustíveis',
  },
  {
    ticker: 'PETR3',
    nome: 'Petrobras ON',
    setor: 'Petróleo e Gás',
    subsector: 'Petróleo, Gás e Biocombustíveis',
  },
  { ticker: 'ITUB4', nome: 'Itaú Unibanco PN', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'BBDC4', nome: 'Bradesco PN', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'BBDC3', nome: 'Bradesco ON', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'BBAS3', nome: 'Banco do Brasil ON', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'SANB11', nome: 'Santander Brasil Unit', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'BPAC11', nome: 'BTG Pactual Unit', setor: 'Financeiro', subsector: 'Bancos' },
  { ticker: 'ITSA4', nome: 'Itaúsa PN', setor: 'Financeiro', subsector: 'Holdings Diversificadas' },
  { ticker: 'B3SA3', nome: 'B3', setor: 'Financeiro', subsector: 'Serviços Financeiros Diversos' },
  { ticker: 'BBSE3', nome: 'BB Seguridade', setor: 'Financeiro', subsector: 'Seguros' },
  { ticker: 'PSSA3', nome: 'Porto Seguro', setor: 'Financeiro', subsector: 'Seguros' },
  { ticker: 'WEGE3', nome: 'WEG', setor: 'Industrial', subsector: 'Máquinas e Equipamentos' },
  { ticker: 'EMBJ3', nome: 'Embraer', setor: 'Industrial', subsector: 'Aeronáutica e Defesa' },
  { ticker: 'RAIL3', nome: 'Rumo', setor: 'Industrial', subsector: 'Transporte Ferroviário' },
  {
    ticker: 'MOTV3',
    nome: 'Motiva (ex-CCR)',
    setor: 'Industrial',
    subsector: 'Concessões de Infraestrutura',
  },
  { ticker: 'RENT3', nome: 'Localiza', setor: 'Industrial', subsector: 'Locação de Veículos' },
  { ticker: 'ABEV3', nome: 'Ambev', setor: 'Consumo não Cíclico', subsector: 'Bebidas' },
  {
    ticker: 'JBSS3',
    nome: 'JBS',
    setor: 'Consumo não Cíclico',
    subsector: 'Alimentos Processados',
  },
  { ticker: 'ASAI3', nome: 'Assaí', setor: 'Consumo não Cíclico', subsector: 'Supermercados' },
  {
    ticker: 'CRFB3',
    nome: 'Carrefour Brasil',
    setor: 'Consumo não Cíclico',
    subsector: 'Supermercados',
  },
  {
    ticker: 'SLCE3',
    nome: 'SLC Agrícola',
    setor: 'Consumo não Cíclico',
    subsector: 'Agropecuária',
  },
  {
    ticker: 'SMTO3',
    nome: 'São Martinho',
    setor: 'Consumo não Cíclico',
    subsector: 'Açúcar e Álcool',
  },
  {
    ticker: 'MBRF3',
    nome: 'MBRF (Marfrig e BRF)',
    setor: 'Consumo não Cíclico',
    subsector: 'Alimentos Processados',
  },
  { ticker: 'RDOR3', nome: "Rede D'Or", setor: 'Saúde', subsector: 'Serviços Médico-Hospitalares' },
  { ticker: 'HAPV3', nome: 'Hapvida', setor: 'Saúde', subsector: 'Planos de Saúde' },
  { ticker: 'FLRY3', nome: 'Fleury', setor: 'Saúde', subsector: 'Medicina Diagnóstica' },
  { ticker: 'RADL3', nome: 'RaiaDrogasil', setor: 'Saúde', subsector: 'Drogarias' },
  {
    ticker: 'AXIA3',
    nome: 'Axia Energia (ex-Eletrobras) ON',
    setor: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
  },
  {
    ticker: 'EQTL3',
    nome: 'Equatorial',
    setor: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
  },
  {
    ticker: 'ENGI11',
    nome: 'Energisa Unit',
    setor: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
  },
  { ticker: 'CPLE6', nome: 'Copel PN', setor: 'Utilidade Pública', subsector: 'Energia Elétrica' },
  { ticker: 'CMIG4', nome: 'Cemig PN', setor: 'Utilidade Pública', subsector: 'Energia Elétrica' },
  {
    ticker: 'CPFE3',
    nome: 'CPFL Energia',
    setor: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
  },
  { ticker: 'SBSP3', nome: 'Sabesp', setor: 'Utilidade Pública', subsector: 'Água e Saneamento' },
  { ticker: 'PRIO3', nome: 'PRIO', setor: 'Petróleo e Gás', subsector: 'Petróleo e Gás' },
  {
    ticker: 'CSAN3',
    nome: 'Cosan',
    setor: 'Petróleo e Gás',
    subsector: 'Distribuição de Combustíveis',
  },
  {
    ticker: 'UGPA3',
    nome: 'Ultrapar',
    setor: 'Petróleo e Gás',
    subsector: 'Distribuição de Combustíveis',
  },
  {
    ticker: 'VBBR3',
    nome: 'Vibra Energia',
    setor: 'Petróleo e Gás',
    subsector: 'Distribuição de Combustíveis',
  },
  {
    ticker: 'CSNA3',
    nome: 'Siderúrgica Nacional',
    setor: 'Materiais Básicos',
    subsector: 'Siderurgia',
  },
  { ticker: 'GGBR4', nome: 'Gerdau PN', setor: 'Materiais Básicos', subsector: 'Siderurgia' },
  { ticker: 'CMIN3', nome: 'CSN Mineração', setor: 'Materiais Básicos', subsector: 'Mineração' },
  { ticker: 'BRKM5', nome: 'Braskem PNA', setor: 'Materiais Básicos', subsector: 'Petroquímica' },
  { ticker: 'SUZB3', nome: 'Suzano', setor: 'Materiais Básicos', subsector: 'Papel e Celulose' },
  {
    ticker: 'LREN3',
    nome: 'Lojas Renner',
    setor: 'Consumo Cíclico',
    subsector: 'Tecidos, Vestuário e Calçados',
  },
  { ticker: 'MGLU3', nome: 'Magazine Luiza', setor: 'Consumo Cíclico', subsector: 'Varejo' },
  { ticker: 'MRVE3', nome: 'MRV', setor: 'Consumo Cíclico', subsector: 'Construção Civil' },
  { ticker: 'TOTS3', nome: 'Totvs', setor: 'Tecnologia', subsector: 'Software' },
  {
    ticker: 'VIVT3',
    nome: 'Telefônica Brasil (Vivo)',
    setor: 'Comunicações',
    subsector: 'Telecomunicações',
  },
]
