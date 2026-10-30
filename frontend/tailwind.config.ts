import type { Config } from 'tailwindcss'

/**
 * Escala de cinza (slate) lida de variáveis CSS, para trocar entre tema escuro e claro
 * sem mudar as classes dos componentes. Ver app/globals.css.
 */
const escala = (nome: string) => `rgb(var(--${nome}) / <alpha-value>)`

/**
 * Configuração do TailwindCSS 3.x com a paleta do IBovespa Dashboard.
 * - alta: verde para variação positiva
 * - baixa: vermelho para variação negativa
 * - fundo: cor de fundo do tema atual
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        alta: '#16A34A',
        baixa: '#DC2626',
        fundo: escala('fundo'),
        slate: {
          50: escala('s50'),
          100: escala('s100'),
          200: escala('s200'),
          300: escala('s300'),
          400: escala('s400'),
          500: escala('s500'),
          600: escala('s600'),
          700: escala('s700'),
          800: escala('s800'),
          900: escala('s900'),
          950: escala('s950'),
        },
      },
    },
  },
  plugins: [],
}

export default config
