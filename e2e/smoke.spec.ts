import { expect, test, type Page } from "@playwright/test";

const mockEvmAccount = "0x1111111111111111111111111111111111111111";
const demoKey = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

async function installMockMetaMask(page: Page) {
  await page.addInitScript((account) => {
    Object.defineProperty(window, "ethereum", {
      value: {
        isMetaMask: true,
        async request({ method }: { method: string }) {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
          if (method === "eth_chainId") return "0x30d4a";
          if (
            method === "wallet_switchEthereumChain" ||
            method === "wallet_requestPermissions" ||
            method === "wallet_revokePermissions"
          ) {
            return null;
          }
          throw new Error(`Unsupported mock method ${method}`);
        },
        on() {},
        removeListener() {},
      },
    });
  }, mockEvmAccount);
}

test("home explains the product and lists open events", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Scan once.");
  await expect(page.getByTestId("network-health")).toContainText("Preview");
  await expect(page.getByText("Rome Builder Night · Hanoi")).toBeVisible();
  await expect(page.getByText("Solana x EVM Meetup")).toHaveCount(0);
});

test("filters switch between open, upcoming, and ended events", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(page.getByText("Dual-lane Solidity Workshop")).toBeVisible();
  await page.getByRole("button", { name: "Ended", exact: true }).click();
  await expect(page.getByText("Solana x EVM Meetup")).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".poll-card")).toHaveCount(3);
});

test("event page shows the EVM and Solana attendance split", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Rome Builder Night · Hanoi").click();
  await expect(page).toHaveURL(/\/event\/3$/);
  await expect(page.locator(".attendance")).toContainText("89 checked in of 120");
  await expect(page.locator(".attendance")).toContainText("51 Solana, proven on-chain");
  await expect(page.getByRole("region", { name: "Check-in QR code" })).toHaveCount(0);
});

test("the organizer device shows the check-in QR code", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem("tessera:event-key:3", `0x${key}`);
  }, demoKey);
  await page.goto("/event/3");
  const panel = page.getByRole("region", { name: "Check-in QR code" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("img", { name: /Check-in QR code for event 3/ })).toBeVisible();
});

test("claim links reject missing or replaced codes", async ({ page }) => {
  await page.goto("/claim/3");
  await expect(page.locator(".notice")).toContainText("missing its check-in code");
  await page.goto(`/claim/3#k=${"1".repeat(64)}`);
  await expect(page.locator(".notice")).toContainText("replaced by the organizer");
});

test("a valid claim link asks for a wallet and stays read-only in preview", async ({ page }) => {
  await installMockMetaMask(page);
  await page.goto(`/claim/3#k=${demoKey}`);
  await expect(page.getByText("Connect the wallet that should hold your badge.")).toBeVisible();
  await page.locator(".claim-connect").getByRole("button", { name: "MetaMask" }).click();
  await page.getByRole("button", { name: "Claim my badge" }).click();
  await expect(page.locator(".form-error")).toContainText(/read-only/);
});

test("ended events refuse new claims", async ({ page }) => {
  await page.goto(`/claim/1#k=${demoKey}`);
  await expect(page.locator(".notice")).toContainText("has ended");
});

test("passports list badges and invalid routes 404", async ({ page }) => {
  await page.goto(`/passport/${mockEvmAccount}`);
  await expect(page.getByText("Proven Solana").first()).toBeVisible();
  await expect(page.locator(".stamp")).toHaveCount(2);
  await page.goto("/passport/not-an-address");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("create event validates input and stays read-only in preview", async ({ page }) => {
  await installMockMetaMask(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await page.getByRole("button", { name: "Create an event" }).click();
  const dialog = page.getByRole("dialog", { name: "Create an event" });
  await dialog.locator('input[name="name"]').fill("E2E meetup");
  await dialog.locator('input[name="endsAt"]').fill("2020-01-01T10:00");
  await dialog.getByRole("button", { name: "Create event" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/after it starts|future/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("responses carry security headers", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
