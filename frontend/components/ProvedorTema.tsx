'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** Temas disponíveis. */
export type Tema = 'escuro' | 'claro'

/** Chave do localStorage com a preferência de tema (preferência local, não dado de usuário). */
export const CHAVE_TEMA = 'ibov:tema'

interface ValorTema {
  tema: Tema
  alternar: () => void
}

const ContextoTema = createContext<ValorTema>({ tema: 'escuro', alternar: () => undefined })

/**
 * Aplica o tema no elemento <html> (atributo data-tema, usado pelo CSS) e salva a escolha.
 * Falhas de armazenamento são ignoradas: o tema vale para a sessão atual.
 * @param tema Tema a aplicar.
 */
function aplicarTema(tema: Tema): void {
  document.documentElement.setAttribute('data-tema', tema)
  try {
    window.localStorage.setItem(CHAVE_TEMA, tema)
  } catch {
    // Armazenamento indisponível: a escolha não persiste.
  }
}

/**
 * Provê o tema claro/escuro para toda a aplicação.
 * O script inline do layout já aplica o tema salvo antes da pintura; aqui apenas sincronizamos o estado.
 * @param props.children Conteúdo da aplicação.
 * @returns Contexto com o tema atual e a ação de alternar.
 */
export function ProvedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>('escuro')

  useEffect(() => {
    setTema(document.documentElement.getAttribute('data-tema') === 'claro' ? 'claro' : 'escuro')
  }, [])

  const alternar = useCallback(() => {
    const proximo: Tema = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(proximo)
    aplicarTema(proximo)
  }, [tema])

  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar])
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>
}

/**
 * Acessa o tema atual e a ação de alternar.
 * @returns Tema atual e função `alternar`.
 */
export function useTema(): ValorTema {
  return useContext(ContextoTema)
}
