-- Extensão TimescaleDB (requer imagem timescale/timescaledb no docker-compose)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CreateTable
CREATE TABLE "Ativo" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "subsector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoHistorico" (
    "id" UUID NOT NULL,
    "ativoId" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "open" DECIMAL(12,4) NOT NULL,
    "high" DECIMAL(12,4) NOT NULL,
    "low" DECIMAL(12,4) NOT NULL,
    "close" DECIMAL(12,4) NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "PrecoHistorico_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateTable
CREATE TABLE "FatoRelevante" (
    "id" UUID NOT NULL,
    "ativoId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "dataPublicacao" TIMESTAMPTZ(6) NOT NULL,
    "resumo" TEXT,
    "urlDocumento" TEXT,

    CONSTRAINT "FatoRelevante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ativo_ticker_key" ON "Ativo"("ticker");

-- CreateIndex
CREATE INDEX "PrecoHistorico_ativoId_timestamp_idx" ON "PrecoHistorico"("ativoId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PrecoHistorico_ativoId_timestamp_key" ON "PrecoHistorico"("ativoId", "timestamp");

-- CreateIndex
CREATE INDEX "FatoRelevante_ativoId_dataPublicacao_idx" ON "FatoRelevante"("ativoId", "dataPublicacao" DESC);

-- AddForeignKey
ALTER TABLE "PrecoHistorico" ADD CONSTRAINT "PrecoHistorico_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FatoRelevante" ADD CONSTRAINT "FatoRelevante_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Converte PrecoHistorico em hypertable particionada por timestamp (T-003)
SELECT create_hypertable('"PrecoHistorico"', 'timestamp', if_not_exists => TRUE);
