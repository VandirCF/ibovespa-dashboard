import { expect, test } from '@playwright/test'

test.describe('Home: lista de ativos', () => {
  test('página carrega com a lista de ativos', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 })
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(10)
  })

  test('ordenação por coluna altera a ordem das linhas', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 })
    // A lista do servidor pode ser trocada pela revalidação do SWR logo após a montagem:
    // espera os dados estabilizarem para comparar a mesma lista antes e depois de ordenar.
    await page.waitForLoadState('networkidle')

    const coluna = (): Promise<string[]> =>
      page
        .locator('tbody tr td:first-child')
        .allInnerTexts()
        .then((textos) => textos.map((t) => t.trim()))

    const primeiraOrdem = await coluna()
    await page.locator('thead th button').first().click()
    const ordemOrdenada = await coluna()

    const ascendente = [...primeiraOrdem].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    const descendente = [...ascendente].reverse()
    expect([JSON.stringify(ascendente), JSON.stringify(descendente)]).toContain(
      JSON.stringify(ordemOrdenada),
    )
  })

  test('seletor mostra fundos imobiliários e mantém a escolha após recarregar', async ({
    page,
  }) => {
    await page.goto('/')
    const seletor = page.getByRole('group', { name: 'Tipo de ativo' })
    await seletor.getByRole('button', { name: 'Fundos imobiliários' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fundos imobiliários mais negociados',
    )
    await expect(page).toHaveURL(/\?tipo=fii$/)
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(10)
    const tickers = await page.locator('tbody tr td:first-child').allInnerTexts()
    expect(tickers.every((ticker) => /11$/.test(ticker.trim()))).toBe(true)

    await page.reload()
    await expect(seletor.getByRole('button', { name: 'Fundos imobiliários' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
