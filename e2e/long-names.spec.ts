import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { note, openProject, workspaceWith } from './helpers'
import { writeProjectFiles } from './lens-fixture'

const LONG = 'CustomerSubscriptionRenewalNotificationPreferences'

/** A project whose every name is far longer than the boxes that draw it. */
const LONG_PROJECT: Record<string, string> = {
  'web/package.json': '{ "dependencies": { "next": "15.0.0", "react": "19.0.0" } }',
  [`web/app/${LONG.toLowerCase()}/[subscriptionIdentifier]/page.tsx`]: `import ${LONG}Panel from '../../components/${LONG}Panel'\nimport ${LONG}Summary from '../../components/${LONG}Summary'`,
  [`web/app/components/${LONG}Panel.tsx`]: '',
  [`web/app/components/${LONG}Summary.tsx`]: '',
  [`web/app/hooks/use${LONG}.ts`]: '',
  'api/Shop.Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
  [`api/Controllers/${LONG}Controller.cs`]: `[ApiController]
[Route("api/customer-subscription-renewal-notification-preferences")]
[Authorize]
public class ${LONG}Controller : ControllerBase
{
    public ${LONG}Controller(I${LONG}Service service) {}
    [HttpGet("{subscriptionIdentifier}/renewal-notification-preferences")] public IActionResult GetAllRenewalNotificationPreferencesForSubscription(int subscriptionIdentifier) => Ok();
}`,
  [`api/Services/${LONG}Service.cs`]: `public interface I${LONG}Service {}\npublic class ${LONG}Service : I${LONG}Service {}`,
  'db/tables.sql': `CREATE TABLE customer_subscription_renewal_notification_preferences (subscription_renewal_identifier NUMBER PRIMARY KEY, notification_channel_description VARCHAR2(4000));
CREATE TABLE customer_subscription_renewal_notification_history (history_identifier NUMBER PRIMARY KEY, subscription_renewal_identifier NUMBER REFERENCES customer_subscription_renewal_notification_preferences(subscription_renewal_identifier));`,
  'db/pkg_customer_subscription_renewal_notifications.pks': `CREATE OR REPLACE PACKAGE pkg_customer_subscription_renewal_notifications AS
  PROCEDURE send_customer_subscription_renewal_notification_reminder(p NUMBER);
END;
/`,
  'db/pkg_customer_subscription_renewal_notifications.pkb': `CREATE OR REPLACE PACKAGE BODY pkg_customer_subscription_renewal_notifications AS
  PROCEDURE write_customer_subscription_renewal_notification_audit_log IS BEGIN NULL; END;
  PROCEDURE send_customer_subscription_renewal_notification_reminder(p NUMBER) IS BEGIN INSERT INTO customer_subscription_renewal_notification_history (history_identifier) VALUES (1); END;
END;
/`,
  'db/views.sql': `CREATE OR REPLACE VIEW v_customer_subscription_renewal_notification_overview AS SELECT * FROM customer_subscription_renewal_notification_preferences;`,
}

/** Every piece of text that pokes out of the box that draws it. */
const overflowing = (page: Page) =>
  page.evaluate(() => {
    const boxes = document.querySelectorAll(
      '.lens :is(.lens-tile, .lens-screen, .lens-brick-block, .lens-resource, .lens-table, .lens-package, .lens-chip, .lens-brick), .structure-block',
    )
    const found: string[] = []

    for (const box of boxes) {
      const outer = box.getBoundingClientRect()
      const parent = box.parentElement!.getBoundingClientRect()

      if (outer.right > parent.right + 1 && !box.closest('.lens-er')) {
        found.push(`${box.className.split(' ')[0]} wider than its place`)
      }

      for (const child of box.querySelectorAll('*')) {
        const inner = child.getBoundingClientRect()

        if (inner.width === 0) continue
        if (inner.right > outer.right + 1 || inner.left < outer.left - 1) {
          found.push(
            `${child.className || child.tagName} out of ${box.className.split(' ')[0]} ${Math.round(inner.left)}-${Math.round(inner.right)} vs ${Math.round(outer.left)}-${Math.round(outer.right)}`,
          )
          break
        }
      }
    }

    return found
  })

test('long names stay inside their boxes', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('a', {
        title: 'X',
        filePaths: [`web/app/components/${LONG}Panel.tsx`, 'db/tables.sql'],
      }),
    ]),
  )
  await page.evaluate(writeProjectFiles, LONG_PROJECT)
  await page.keyboard.press('m')

  const lenses = page.getByRole('group', { name: 'Vistas del proyecto' })

  for (const width of [1400, 900]) {
    await page.setViewportSize({ width, height: 900 })

    for (const lens of [/Ficheros/, /Web/, /API/, /BBDD/]) {
      await lenses.getByRole('button', { name: lens }).click()
      await expect(page.locator('.lens, .structure-block').first()).toBeVisible()
      expect.soft(await overflowing(page), `${lens} at ${width}px`).toEqual([])
      // Nothing widens the app itself: the window never scrolls sideways.
      expect
        .soft(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    }
  }
})
