import { expect, test } from './fixtures'
import { note, openProject, workspaceWith } from './helpers'
import { LENS_PROJECT, writeProjectFiles } from './lens-fixture'

test('lenses draw the web app, the API and the database, with their notes', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('cart', { title: 'CARRITO', status: 'todo', filePaths: ['web/app/cart/page.tsx'] }),
      note('orders', {
        title: 'PEDIDOS API',
        x: 400,
        filePaths: ['api/Controllers/OrdersController.cs'],
      }),
      note('schema', { title: 'ESQUEMA', x: 800, aiFilePaths: ['db/tables.sql'] }),
    ]),
  )
  await page.evaluate(writeProjectFiles, LENS_PROJECT)
  await page.keyboard.press('m')

  const lenses = page.getByRole('group', { name: 'Vistas del proyecto' })
  const side = page.getByRole('complementary', { name: 'Notas de la estructura' })

  // Web: pages are screens with their route and the components on them.
  await lenses.getByRole('button', { name: /Web\s*Next\.js/ }).click()
  const cart = page.locator('.lens-screen', { hasText: '/cart' })
  await expect(cart).toContainText('Price')
  await expect(page.locator('.lens-screen', { hasText: '/products/:id' })).toBeVisible()
  await cart.click()
  await expect(side.getByRole('button', { name: /CARRITO/ })).toBeVisible()

  // API: resources with verbs, routes and what they depend on.
  await lenses.getByRole('button', { name: /API\s*\.NET/ }).click()
  const orders = page.locator('.lens-resource', { hasText: '/api/Orders' })
  await expect(orders.locator('.lens-verb')).toHaveText(['GET', 'GET', 'POST', 'DELETE'])
  await expect(orders).toContainText('IOrderService')
  await orders
    .getByRole('button', { name: /Orders/ })
    .first()
    .click()
  await expect(side.getByRole('button', { name: /PEDIDOS API/ })).toBeVisible()

  // Database: tables with keys, and packages split into specification and body.
  await lenses.getByRole('button', { name: /BBDD\s*PL\/SQL/ }).click()
  const lines = page.locator('.lens-table', { hasText: 'ORDER_LINES' })
  await expect(lines.locator('.lens-column', { hasText: 'PRODUCT_ID' })).toContainText('FK')
  await expect(page.locator('.lens-er__line')).toHaveCount(3)
  await expect(page.locator('.lens-package', { hasText: 'PKG_STOCK' })).toContainText(
    'No encontrado',
  )
  await lines.click()
  await expect(side.getByRole('button', { name: /ESQUEMA/ })).toBeVisible()
})

test('only the lenses a project fits are offered', async ({ page }) => {
  await openProject(page, workspaceWith([]))
  await page.evaluate(writeProjectFiles, { 'db/schema.sql': 'CREATE TABLE t (id NUMBER);' })
  await page.keyboard.press('m')

  const lenses = page.getByRole('group', { name: 'Vistas del proyecto' })

  // The demo project has src/App.tsx (React) and now a SQL script: no .NET.
  await expect(lenses.getByRole('button')).toHaveText([/Ficheros/, /Web/, /BBDD/])
})
