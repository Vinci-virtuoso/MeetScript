// Milestone 2 screens, every state, at 390 and 1280, screenshot into evidence/kit/ and axe clean.
// Sign-in (email, code: default, wrong, expired, too many attempts), header signed-in state, saved
// splits (empty, loading, error, long-list), pricing, checkout handoff, payment pending, done,
// manage plan. Paid states need the webhook secret from .dev.vars and, for the pending row, the
// sandbox key; without the key those tests are skipped and the report says so.
import { expect, test } from "@playwright/test";
import { accessToken, axe, bachsWebhook, hasRealBachsKey, linkCode, saveSplit, shot, signIn, startCheckout, uniqueEmail, useDevIp, VIEWPORTS } from "./kit-helpers";

for (const vp of VIEWPORTS) {
  test.describe(`kit screens at ${vp.width} px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("sign-in: email, code default, wrong code, too many attempts, expired, GitHub error", async ({ page }) => {
      const email = uniqueEmail("signin");
      await useDevIp(page);
      await page.goto("/sign-in");
      await expect(page.getByTestId("sign-in-email")).toHaveAttribute("data-ready", "true");
      await shot(page, "sign-in-default", vp.name);
      await axe(page);

      await page.getByLabel("Email").fill("not-an-email");
      await page.getByRole("button", { name: "Send code" }).click();
      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await shot(page, "sign-in-invalid-email", vp.name);

      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Send code" }).click();
      await expect(page.getByTestId("sign-in-code")).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
      await shot(page, "code-default", vp.name);
      await axe(page);

      // wrong code
      await page.getByLabel("Code").fill("000000");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("That code is not right")).toBeVisible();
      await expect(page.getByLabel("Code")).toHaveAttribute("aria-invalid", "true");
      await shot(page, "code-wrong", vp.name);
      await axe(page);

      // too many attempts: 4 more wrong codes burn it
      for (let i = 0; i < 4; i += 1) {
        await page.getByLabel("Code").fill("000000");
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByTestId("code-notice").or(page.getByText("That code is not right"))).toBeVisible();
      }
      await expect(page.getByText("Too many wrong codes.")).toBeVisible();
      await shot(page, "code-too-many-attempts", vp.name);
      await axe(page);

      // expired: the burnt code reads as expired on the next try
      await page.getByLabel("Code").fill("123456");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("This code expired.")).toBeVisible();
      await shot(page, "code-expired", vp.name);
      await axe(page);

      // GitHub came back with an error
      await page.goto("/sign-in?error=access_denied");
      await expect(page.getByText("GitHub sign-in did not finish.")).toBeVisible();
      await shot(page, "sign-in-github-error", vp.name);
    });

    test("signed-in header state and the account control on the calculator", async ({ page }) => {
      const email = uniqueEmail("header");
      await signIn(page, email, "/splits");
      await expect(page.getByTestId("account-signed-in")).toBeVisible();
      await expect(page.getByTestId("account-signed-in")).toContainText(email);
      await shot(page, "header-signed-in", vp.name);
      await axe(page);

      await page.goto("/");
      await expect(page.locator("#save-split")).toBeVisible();
      await expect(page.locator("#save-split")).toBeDisabled();
      await page.fill("#rent", "1445");
      await expect(page.locator("#save-split")).toBeEnabled();
      await page.click("#save-split");
      await page.fill("#save-name", "Flat on Oak St");
      await page.locator(".account-form button[type=submit]").click();
      await expect(page.locator("#save-status")).toContainText("Saved as Flat on Oak St");
      await shot(page, "calculator-saved", vp.name);
      await axe(page);
    });

    test("saved splits: loading, empty, error, list and the free limit", async ({ page }) => {
      const email = uniqueEmail("splits");
      await signIn(page, email, "/splits");
      await expect(page.getByTestId("splits-empty")).toBeVisible();
      await shot(page, "splits-empty", vp.name);
      await axe(page);

      // loading: hold the list request
      let release: () => void = () => {};
      const held = new Promise<void>((r) => (release = r));
      await page.route("**/api/splits", async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        await held;
        await route.continue();
      });
      await page.goto("/splits");
      await expect(page.getByTestId("splits-loading")).toBeVisible();
      await shot(page, "splits-loading", vp.name);
      await axe(page);
      release();
      await page.unroute("**/api/splits");

      // error: the list request fails
      await page.route("**/api/splits", (route) => (route.request().method() === "GET" ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"internal","message":"x"}' }) : route.continue()));
      await page.goto("/splits");
      await expect(page.getByTestId("splits-error")).toBeVisible();
      await shot(page, "splits-error", vp.name);
      await axe(page);
      await page.unroute("**/api/splits");

      // list at the free limit
      const token = await accessToken(page);
      await saveSplit(page, token, "Flat on Oak St", 3);
      await saveSplit(page, token, "Summer house with the Okonkwo family", 12);
      await saveSplit(page, token, "Studio", 1);
      await page.goto("/splits");
      await expect(page.getByTestId("split-row")).toHaveCount(3);
      await expect(page.getByText("3 of 3 free")).toBeVisible();
      await expect(page.getByRole("link", { name: "Upgrade to Pro" })).toBeVisible();
      await shot(page, "splits-list-free-limit", vp.name);
      await axe(page);

      // rename and delete inline
      const first = page.getByTestId("split-row").first();
      await first.getByRole("button", { name: "Rename" }).click();
      await first.getByLabel("Name").fill("Studio by the park");
      await first.getByRole("button", { name: "Save name" }).click();
      await expect(first).toContainText("Studio by the park");
      await first.getByRole("button", { name: "Delete" }).click();
      await expect(first.getByText("This cannot be undone.")).toBeVisible();
      await shot(page, "splits-delete-confirm", vp.name);
      await first.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByTestId("split-row")).toHaveCount(2);

      // the calculator's save control explains the limit
      await saveSplit(page, token, "Third", 2);
      await page.goto("/");
      await page.fill("#rent", "900");
      await page.click("#save-split");
      await page.fill("#save-name", "Fourth");
      await page.locator(".account-form button[type=submit]").click();
      await expect(page.locator("#save-status")).toContainText("Free accounts keep 3 saved splits");
      await shot(page, "calculator-save-limit", vp.name);
    });

    test("pricing, checkout handoff and a failed checkout", async ({ page }) => {
      await page.goto("/pricing");
      await expect(page.getByTestId("pricing")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in to upgrade" })).toBeVisible();
      await shot(page, "pricing-signed-out", vp.name);
      await axe(page);

      const email = uniqueEmail("pricing");
      await signIn(page, email, "/pricing");
      await expect(page.getByRole("button", { name: "Upgrade to Pro" })).toBeVisible();
      await shot(page, "pricing-free", vp.name);
      await axe(page);

      await page.goto("/pricing?canceled=1");
      await expect(page.getByText("Checkout cancelled.")).toBeVisible();
      await shot(page, "pricing-canceled", vp.name);

      // handoff: a slow checkout call keeps the opening state on screen, then a stand-in target
      await page.route("**/api/billing/checkout", async (route) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ checkoutId: "chk_e2e", url: "/e2e-checkout-target" }) });
      });
      await page.route("**/e2e-checkout-target", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Bachs checkout stand-in</title><p>checkout</p>" }));
      await page.goto("/pricing");
      await expect(page.getByTestId("pricing")).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Upgrade to Pro" }).click();
      await expect(page.getByTestId("checkout-handoff")).toBeVisible();
      await shot(page, "checkout-handoff", vp.name);
      await axe(page);
      await page.waitForURL("**/e2e-checkout-target");
      await page.unroute("**/api/billing/checkout");

      await page.route("**/api/billing/checkout", (route) =>
        route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "checkout_failed", message: "x" }) }),
      );
      await page.goto("/pricing");
      await expect(page.getByTestId("pricing")).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Upgrade to Pro" }).click();
      await expect(page.getByTestId("checkout-failed")).toBeVisible();
      await shot(page, "checkout-failed", vp.name);
      await axe(page);
    });

    test("payment pending, done, manage plan and the long list (sandbox checkout + signed webhook)", async ({ page }) => {
      test.skip(!hasRealBachsKey(), "BACHS_API_KEY is not in .dev.vars; the pending row needs a sandbox checkout");
      const email = uniqueEmail("pro");
      await signIn(page, email, "/account/plan");
      await expect(page.getByTestId("plan-free")).toBeVisible();
      await shot(page, "manage-plan-free", vp.name);
      await axe(page);

      const token = await accessToken(page);
      const { checkoutId } = await startCheckout(page, token);
      await page.goto(`/billing/pending?checkout_id=${encodeURIComponent(checkoutId)}`);
      await expect(page.getByTestId("payment-pending")).toBeVisible();
      await shot(page, "payment-pending", vp.name);
      await axe(page);

      const outcome = await bachsWebhook(page, "checkout.completed", {
        checkout_id: checkoutId,
        payment_status: "paid",
        amount: "5.00",
        currency: "USD",
        charge: { id: `ch_e2e_${Date.now().toString(36)}` },
        customer: { customer_id: `cust_e2e_${Date.now().toString(36)}` },
      });
      expect(outcome).toBe("settled");
      await page.waitForURL("**/billing/done", { timeout: 15000 });
      await expect(page.getByTestId("payment-done")).toBeVisible();
      await shot(page, "payment-done", vp.name);
      await axe(page);

      await page.goto("/account/plan");
      await expect(page.getByTestId("plan-pro")).toBeVisible();
      await shot(page, "manage-plan-pro", vp.name);
      await axe(page);
      await page.getByRole("button", { name: "Stop at period end" }).click();
      await page.getByRole("button", { name: "Stop Pro" }).click();
      await expect(page.getByTestId("plan-stopping")).toBeVisible();
      await shot(page, "manage-plan-stopping", vp.name);

      // an expired checkout
      const { checkoutId: expiredId } = await startCheckout(page, token);
      expect(await bachsWebhook(page, "checkout.expired", { checkout_id: expiredId })).toBe("expired");
      await page.goto(`/billing/pending?checkout_id=${encodeURIComponent(expiredId)}`);
      await expect(page.getByTestId("payment-expired")).toBeVisible();
      await shot(page, "payment-expired", vp.name);
      await axe(page);
      await page.goto("/billing/pending?checkout_id=chk_missing");
      await expect(page.getByTestId("payment-missing")).toBeVisible();
      await shot(page, "payment-missing", vp.name);

      // long list: Pro saves past the free limit
      for (let i = 1; i <= 12; i += 1) await saveSplit(page, token, i === 5 ? "Garden suite west with Alexandrina Okonkwo and friends" : `Split ${i}`, (i % 12) + 1);
      await page.goto("/splits");
      await expect(page.getByTestId("split-row")).toHaveCount(12);
      await expect(page.getByText("12 saved · Pro")).toBeVisible();
      await shot(page, "splits-long-list", vp.name);
      await axe(page);
    });
  });
}

test("the calculator keeps its link code contract for saved splits", async ({ page }) => {
  await page.goto(`/#${linkCode(3)}`);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator('[data-share="0"] .total')).toBeVisible();
});

test("no console errors on the account screens while signed out", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const path of ["/sign-in", "/pricing"]) {
    await page.goto(path);
    await expect(page.getByTestId("account-sign-in")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

export {};
