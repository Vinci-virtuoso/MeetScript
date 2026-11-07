import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const routes = [
  '/',
  '/about',
  '/privacy',
  '/terms',
  '/sign-in',
  '/app',
  '/sample',
  '/sample?state=empty',
  '/sample/meetings',
  '/sample/meetings/design-review',
  '/sample/meetings/design-review?tab=transcript',
  '/sample/meetings/design-review?tab=audio',
  '/sample/chat',
  '/sample/actions',
  '/sample/settings/workspace',
  '/sample/settings/members',
  '/sample/settings/privacy',
  '/sample/settings/usage',
  '/sample/account',
];
for (const width of [390, 768, 1280])
  for (const theme of ['light', 'dark'])
    test(`${width}px ${theme}: route accessibility and reflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (t) => localStorage.setItem('ms-theme', t),
        theme,
      );
      for (const [i, route] of routes.entries()) {
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute(
          'data-hydrated',
          'true',
        );
        await expect(page.locator('main h1')).toBeVisible();
        if (route.startsWith('/sample'))
          await expect(
            page.getByText('Sample workspace — not a live recording.', {
              exact: false,
            }),
          ).toBeVisible();
        await page.waitForTimeout(80);
        const findings = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          findings.violations,
          `${route}: ${JSON.stringify(findings.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          route,
        ).toBe(true);
        await page.screenshot({
          path: `docs/implementation/screenshots/${width}-${theme}-${String(i).padStart(2, '0')}.png`,
          fullPage: true,
        });
      }
    });
test('join disclosure, keyboard focus, and fail-closed sample submission', async ({
  page,
}) => {
  await page.goto('/sample');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const trigger = page.getByRole('button', {
    name: 'Join meeting',
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Join meeting', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Google Meet URL')
    .fill('https://evil.test/abc-defg-hij');
  await expect(
    dialog.getByRole('button', { name: 'Join meeting', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel('Google Meet URL')
    .fill('https://meet.google.com/abc-defg-hij');
  await dialog.getByRole('checkbox').check();
  await dialog
    .getByRole('button', { name: 'Join meeting', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('No bot will join');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('sample actions persist and cannot affect real workspace', async ({
  page,
}) => {
  await page.goto('/sample/actions');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page
    .getByRole('checkbox', {
      name: 'Complete: Share the updated recording controls prototype',
      exact: true,
    })
    .click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page
      .getByRole('paragraph')
      .filter({ hasText: /^Share the updated recording controls prototype$/ }),
  ).not.toBeVisible();
  await page.getByLabel('Action status').selectOption('complete');
  await expect(
    page
      .getByRole('paragraph')
      .filter({ hasText: /^Share the updated recording controls prototype$/ }),
  ).toBeVisible();
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { name: 'Your notebook is private' }),
  ).toBeVisible();
  await expect(
    page.getByText('Product design review', { exact: true }),
  ).not.toBeVisible();
});
test('citations open exact transcript and keyboard tabs work', async ({
  page,
}) => {
  await page.goto('/sample/meetings/design-review');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('link', { name: '03:24 · transcript' }).first().click();
  await expect(page.locator('#s2')).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'Transcript', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Transcript', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('tab', { name: 'Audio', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'Sample audio is not provided' }),
  ).toBeVisible();
});
test('320px navigation drawer traps focus and restores trigger', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/sample');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(
    drawer.getByRole('link', { name: 'Privacy & consent' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
