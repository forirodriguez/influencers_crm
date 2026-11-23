import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

function signWhatsapp(body: string): string {
  const digest = createHmac("sha256", process.env.WHATSAPP_APP_SECRET ?? "dev-whatsapp-secret").update(body).digest("hex");
  return `sha256=${digest}`;
}

async function register(page: Page, input: { name: string; email: string; password: string }) {
  await page.goto("/registro");
  await page.getByLabel("Nombre").fill(input.name);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Contraseña").fill(input.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/hoy");
  await expect(page.getByRole("heading", { name: new RegExp(input.name.split(" ")[0] ?? input.name) })).toBeVisible();
}

test("recorre el MVP: cuenta, CRM, media kit, WhatsApp y exportación", async ({ page, request }) => {
  const stamp = Date.now().toString();
  const email = `e2e-${stamp}@example.com`;
  const password = "password123";
  const name = "Cami E2E";
  const brand = `Marca ${stamp.slice(-6)}`;
  const phone = `+54911${stamp.slice(-8)}`;
  const bio = `Bio de prueba ${stamp}`;

  await register(page, { name, email, password });

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("**/");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/hoy");

  await page.getByRole("link", { name: "Marcas" }).click();
  await page.getByRole("link", { name: "Nueva marca" }).click();
  await page.locator('input[name="name"]').fill(brand);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: brand })).toBeVisible();

  await page.getByRole("link", { name: "Acuerdos" }).click();
  await page.getByRole("link", { name: "Nuevo acuerdo" }).click();
  await page.locator('input[name="title"]').fill("Reel de lanzamiento");
  await page.locator('select[name="brandId"]').selectOption({ label: brand });
  await page.locator('input[name="amount"]').fill("120000");
  await page.locator('input[name="paymentDueDate"]').fill("2026-12-15");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.waitForURL(/\/acuerdos\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Reel de lanzamiento" })).toBeVisible();

  await page.getByRole("combobox", { name: "Etapa" }).selectOption({ label: "Confirmado" });
  await expect(page.getByText("Pasó de Lead a Confirmado")).toBeVisible();

  const deliverables = page.locator("section").filter({ has: page.getByRole("heading", { name: "Entregables" }) });
  await deliverables.locator('input[name="publishDueAt"]').fill("2026-11-25T15:00");
  await deliverables.getByRole("button", { name: "Agregar" }).click();
  await expect(deliverables.getByText(/1 reel/)).toBeVisible();

  const payments = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cobros" }) });
  await expect(payments.getByText(/Pendiente ·/)).toBeVisible();
  await payments.locator("form").first().locator('input[name="amount"]').fill("120000");
  await payments.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(payments.getByText(/Cobrado ·/)).toBeVisible();

  await page.getByRole("link", { name: "Media kit" }).click();
  await page.getByRole("textbox", { name: "Bio" }).fill(bio);
  await page.getByRole("button", { name: "Guardar media kit" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir página" }).click();
  await expect(page.getByText(bio)).toBeVisible();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.goto("/ajustes");
  await page.getByPlaceholder("+598 99 123 456").fill(phone);
  await page.getByRole("checkbox", { name: /Acepto recibir/ }).check();
  await page.getByRole("button", { name: "Enviar código" }).click();
  const codeText = await page.getByText(/código es \d{6}/).textContent();
  const code = codeText?.match(/(\d{6})/)?.[1];
  expect(code).toBeTruthy();
  await page.getByLabel("Código").fill(code ?? "");
  await page.getByRole("button", { name: "Confirmar número" }).click();
  await expect(page.getByText("WhatsApp activo")).toBeVisible();

  const nuevoBody = JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: `wamid.e2e.${stamp}`,
            from: phone.replace(/\D/g, ""),
            type: "text",
            text: { body: `nuevo Webhook ${stamp.slice(-4)} 2500 ARS` },
          }],
        },
      }],
    }],
  });
  const created = await request.post("/api/webhooks/whatsapp", {
    data: nuevoBody,
    headers: { "content-type": "application/json", "x-hub-signature-256": signWhatsapp(nuevoBody) },
  });
  expect(created.ok()).toBeTruthy();
  const createdJson = await created.json() as { data: { results: { reply: string }[] } };
  expect(createdJson.data.results[0]?.reply).toContain(`Webhook ${stamp.slice(-4)}`);

  const paidBody = JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: `wamid.e2e.paid.${stamp}`,
            from: phone.replace(/\D/g, ""),
            type: "text",
            text: { body: `cobré Webhook ${stamp.slice(-4)}` },
          }],
        },
      }],
    }],
  });
  const paid = await request.post("/api/webhooks/whatsapp", {
    data: paidBody,
    headers: { "content-type": "application/json", "x-hub-signature-256": signWhatsapp(paidBody) },
  });
  expect(paid.ok()).toBeTruthy();
  const paidJson = await paid.json() as { data: { results: { reply: string }[] } };
  expect(paidJson.data.results[0]?.reply.toLowerCase()).toContain("cobrado");

  await page.goto("/pipeline");
  await expect(page.getByRole("link", { name: new RegExp(`Acuerdo con Webhook ${stamp.slice(-4)}`) }).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Descargar JSON" }).click();
  const download = await downloadPromise;
  const exported = await readFile(await download.path() ?? "", "utf8");
  expect(exported).toContain(email);
  expect(exported).toContain(brand);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hoy");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Acuerdos" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Acuerdos" }).click();
  await expect(page.getByRole("combobox", { name: "Etapa" }).first()).toBeVisible();
  await page.goto("/media-kit");
  const kitOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(kitOverflow).toBeLessThanOrEqual(1);
});
