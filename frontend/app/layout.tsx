import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'IBovespa Dashboard',
  description: 'Cotações, gráficos, fatos relevantes e análises dos ativos do IBovespa.',
}

/**
 * Layout raiz da aplicação.
 * @param props.children Conteúdo da página atual.
 * @returns Estrutura HTML base com tema escuro.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-fundo">
      <body className={`${geistSans.variable} bg-fundo antialiased`}>{children}</body>
    </html>
  )
}
