import { expect, test } from '@playwright/test'

test.describe('Detalhe do ativo PETR4', () => {
  test('página carrega com o nome Petrobras', async ({ page }) => {
    await page.goto('/ativo/PETR4')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Petrobras', {
      timeout: 30_000,
    })
  })

  test('trocar período do gráfico não quebra a página', async ({ page }) => {
    const erros: string[] = []
    page.on('pageerror', (erro) => erros.push(erro.message))

    await page.goto('/ativo/PETR4')
    await expect(page.getByLabel('Gráfico de candles de PETR4')).toBeVisible({ timeout: 30_000 })

    const periodo = page.getByRole('group', { name: 'Período do gráfico' })
    await periodo.getByRole('button', { name: '1A' }).click()
    await expect(periodo.getByRole('button', { name: '1A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByLabel('Gráfico de candles de PETR4')).toBeVisible()

    expect(erros).toEqual([])
  })

  test('aba de fatos relevantes mostra ao menos 1 comunicado', async ({ page }) => {
    await page.goto('/ativo/PETR4')
    await page.getByRole('tab', { name: 'Fatos relevantes' }).click()
    const painel = page.locator('[role=tabpanel]:not([hidden])')
    await expect(painel.locator('article').first()).toBeVisible({ timeout: 30_000 })
    await expect.poll(() => painel.locator('article').count()).toBeGreaterThanOrEqual(1)
  })
})
