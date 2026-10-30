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
})
