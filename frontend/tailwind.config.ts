import type { Config } from 'tailwindcss'

/**
 * Configuração do TailwindCSS 3.x com a paleta do IBovespa Dashboard.
 * - alta: verde para variação positiva
 * - baixa: vermelho para variação negativa
 * - fundo: fundo escuro padrão do app
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        alta: '#16A34A',
        baixa: '#DC2626',
        fundo: '#0F172A',
      },
    },
  },
  plugins: [],
}

export default config
