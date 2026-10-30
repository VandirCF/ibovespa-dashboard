import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { CarregadorSentry } from '@/components/CarregadorSentry'
import { ProvedorTema } from '@/components/ProvedorTema'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'IBovespa Dashboard',
  description: 'Cotações, gráficos, fatos relevantes e análises dos ativos do IBovespa.',
}

/** Script executado antes da pintura: aplica o tema salvo, evitando piscar a tela clara/escura. */
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('ibov:tema');document.documentElement.setAttribute('data-tema',t==='claro'?'claro':'escuro')}catch(e){document.documentElement.setAttribute('data-tema','escuro')}})();`

/**
 * Layout raiz da aplicação.
 * @param props.children Conteúdo da página atual.
 * @returns Estrutura HTML base com o provedor de tema.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" data-tema="escuro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        <ProvedorTema>{children}</ProvedorTema>
        <CarregadorSentry />
      </body>
    </html>
  )
}
