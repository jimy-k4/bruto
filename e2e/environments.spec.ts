import { expect, test } from './fixtures'
import { note, noteCard, openProject, readDisk, waitForSaved, workspaceWith } from './helpers'

test('a note is stamped with its environment and moves up from the editor', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('login', { title: 'LOGIN', status: 'done', environment: 'DEV' }),
      note('other', { title: 'OTRA', status: 'done', y: 400 }),
    ]),
  )

  // Written by name, read as the project's id: the stamp says DEV, two steps of four.
  const card = noteCard(page, 'LOGIN')
  const stamp = card.locator('.note__env')

  await expect(stamp).toHaveText('DEV')
  await expect(stamp.locator('.is-reached')).toHaveCount(2)
  await expect(card).toHaveAccessibleName(/En DEV/)
  await expect(noteCard(page, 'OTRA').locator('.note__env')).toHaveCount(0)

  await card.click()
  await expect(page.getByLabel('Entorno', { exact: true })).toHaveValue('dev')
  await page.getByRole('button', { name: 'Subir a PRE' }).click()

  await expect(stamp).toHaveText('PRE')
  await expect(page.getByText(/^En PRE desde el /)).toBeVisible()
  await waitForSaved(page)

  const saved = (await readDisk(page)).notes[0]

  expect(saved.environment).toBe('pre')
  expect(Date.parse(saved.environmentAt)).not.toBeNaN()

  // Production is the last step: stamped solid, and there is nowhere further to go.
  await page.getByRole('button', { name: 'Subir a PRO' }).click()
  await expect(stamp).toHaveClass(/env-stamp--live/)
  await expect(page.getByRole('button', { name: /^Subir a/ })).toHaveCount(0)

  // The search filters by environment.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+f')
  await page
    .getByRole('group', { name: 'Filtrar por entorno' })
    .getByRole('button', { name: 'PRO' })
    .click()
  await expect(card).toHaveClass(/is-match/)
  await expect(noteCard(page, 'OTRA')).toHaveClass(/is-dimmed/)
})

test('a project keeps its own environments', async ({ page }) => {
  await openProject(page, workspaceWith([note('login', { title: 'LOGIN', environment: 'pre' })]))

  await noteCard(page, 'LOGIN').click()
  await page.getByRole('button', { name: 'Cambiar los entornos del proyecto' }).click()

  // PRE and PRO are only the user's by default.
  await expect(page.getByRole('button', { name: 'Solo tú', pressed: true })).toHaveCount(2)

  await page.getByRole('button', { name: 'Añadir entorno' }).click()
  await page.getByLabel('Nombre del entorno 5').fill('qa')
  await page.getByRole('button', { name: 'Mover QA antes' }).click()
  await page.getByLabel('Nombre del entorno 2').fill('INT')
  await waitForSaved(page)

  // Renamed, the note keeps its environment: notes hold the id, the stamp shows the name.
  expect((await readDisk(page)).environments.map((item: { name: string }) => item.name)).toEqual([
    'LOCAL',
    'INT',
    'PRE',
    'QA',
    'PRO',
  ])
  await expect(noteCard(page, 'LOGIN').locator('.note__env')).toHaveText('PRE')

  await page.getByRole('button', { name: 'Volver a LOCAL, DEV, PRE y PRO' }).click()
  await waitForSaved(page)
  expect(await readDisk(page)).not.toHaveProperty('environments')
})
