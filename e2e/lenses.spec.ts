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

test('"only with notes" keeps what notes point at, on the map, the lenses and the files', async ({
  page,
}) => {
  await openProject(
    page,
    workspaceWith([note('cart', { title: 'CARRITO', filePaths: ['web/app/cart/page.tsx'] })]),
  )
  await page.evaluate(writeProjectFiles, LENS_PROJECT)
  await page.keyboard.press('m')

  const map = page.locator('.structure-map')
  await expect(map.getByRole('button', { name: /^api,/ })).toBeVisible()

  await page.getByRole('button', { name: 'Solo con notas' }).click()
  await expect(map.getByRole('button', { name: /^web, 1 fichero, 1 nota/ })).toBeVisible()
  await expect(map.getByRole('button', { name: /^api,/ })).toHaveCount(0)

  await page
    .getByRole('group', { name: 'Vistas del proyecto' })
    .getByRole('button', { name: /Web/ })
    .click()
  await expect(page.locator('.lens-screen')).toHaveText([/\/cart/])

  await page
    .getByRole('group', { name: 'Vistas del proyecto' })
    .getByRole('button', { name: /API/ })
    .click()
  await expect(page.getByText('Ninguna nota apunta a nada de lo que se ve aquí.')).toBeVisible()

  // The files window remembers the same choice.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ficheros', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Solo con notas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(dialog.locator('.file-tree__row:not(.file-tree__row--directory)')).toHaveText([
    /page\.tsx\s*1/,
  ])
})

test('a Supabase project gets a PostgreSQL lens with row level security and policies', async ({
  page,
}) => {
  await openProject(page, workspaceWith([]))
  await page.evaluate(writeProjectFiles, {
    'supabase/migrations/001_init.sql': `create table public.profiles (id uuid primary key, name text);
create table public.bookings (id bigint primary key, profile_id uuid references public.profiles (id));
alter table public.profiles enable row level security;
create policy "Own profile" on public.profiles for select using (auth.uid() = id);`,
  })
  await page.keyboard.press('m')
  await page
    .getByRole('group', { name: 'Vistas del proyecto' })
    .getByRole('button', { name: /BBDD\s*PostgreSQL/ })
    .click()

  const profiles = page.locator('.lens-table', { hasText: 'profiles' })

  await expect(profiles.getByTitle(/Seguridad a nivel de fila/)).toBeVisible()
  await expect(page.locator('.lens-er__line')).toHaveCount(1)
  await expect(page.locator('.lens-tile', { hasText: 'Own profile' })).toContainText(
    'sobre profiles · SELECT',
  )
})

test('only the lenses a project fits are offered', async ({ page }) => {
  await openProject(page, workspaceWith([]))
  await page.evaluate(writeProjectFiles, { 'db/schema.sql': 'CREATE TABLE t (id NUMBER);' })
  await page.keyboard.press('m')

  const lenses = page.getByRole('group', { name: 'Vistas del proyecto' })

  // The demo project has src/App.tsx (React) and now a SQL script: no .NET.
  await expect(lenses.getByRole('button')).toHaveText([/Ficheros/, /Web/, /BBDD/])
})
