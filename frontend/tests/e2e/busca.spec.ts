import { expect, test } from '@playwright/test'

const CAMPO_BUSCA = 'Buscar ativo por ticker ou nome'

test.describe('Busca de ativos', () => {
  test('digitar PETR mostra PETR4 no dropdown', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: CAMPO_BUSCA }).fill('PETR')
    await expect(page.getByRole('listbox')).toContainText('PETR4', { timeout: 15_000 })
  })

  test('clicar em PETR4 navega para /ativo/PETR4', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: CAMPO_BUSCA }).fill('PETR')
    await page.getByRole('option', { name: /PETR4/ }).first().click()
    await expect(page).toHaveURL(/\/ativo\/PETR4$/)
  })

  test('histórico de buscas persiste após reload', async ({ page }) => {
    await page.goto('/ativo/PETR4')
    await page.goto('/')

    const campo = page.getByRole('combobox', { name: CAMPO_BUSCA })
    await campo.fill('PETR')
    await page.getByRole('option', { name: /PETR4/ }).first().click()
    await expect(page).toHaveURL(/\/ativo\/PETR4$/)

    await page.goto('/')
    await page.getByRole('combobox', { name: CAMPO_BUSCA }).click()
    await expect(page.getByRole('listbox', { name: 'Buscas recentes' })).toContainText('PETR4')

    await page.reload()
    await page.getByRole('combobox', { name: CAMPO_BUSCA }).click()
    await expect(page.getByRole('listbox', { name: 'Buscas recentes' })).toContainText('PETR4')
  })
})
