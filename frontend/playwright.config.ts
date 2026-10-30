import { defineConfig, devices } from '@playwright/test'

/** URL do frontend nos testes. Pode ser sobrescrita com E2E_BASE_URL (ex.: um ambiente de staging). */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
/** URL do backend, usada para subir o servidor quando ele não estiver rodando. */
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3001'

const portaFrontend = new URL(BASE_URL).port || '3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { FRONTEND_ORIGIN: BASE_URL },
    },
    {
      command: `npm run dev -- -p ${portaFrontend}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
