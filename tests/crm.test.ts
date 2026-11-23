import { afterAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { closePools, withAdmin, withUser } from "../src/db/client";
import { truncatePublicTables } from "../src/db/truncate";
import { POST as createBrandRoute } from "../src/app/api/v1/brands/route";
import { GET as getBrandRoute } from "../src/app/api/v1/brands/[id]/route";
import { POST as moveDealRoute } from "../src/app/api/v1/deals/[id]/move/route";
import { paymentSummary, listBrands, listStages, listActivities, listPaymentExpectations } from "../src/modules/crm/queries";
import {
  createBrand,
  createContact,
  createDeal,
  createPayment,
  deleteBrand,
  followUpForDeal,
  moveDeal,
  persistOverdue,
  recordReceipt,
  reorderStages,
} from "../src/modules/crm/service";
import { createAgencyWorkspace, registerWithPassword } from "../src/modules/identity/service";
import { memberships } from "../src/modules/identity/schema";

beforeEach(async () => {
  const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
  await truncatePublicTables(admin);
  await admin.end();
});

afterAll(async () => {
  await closePools();
});

async function creator(email: string, country: "AR" | "MX" = "AR") {
  return registerWithPassword({
    name: "Cami Test",
    email,
    password: "password123",
    country,
    acceptTerms: true,
  });
}

function cookie(token: string, workspaceId: string) {
  return `icrm_session=${token}; icrm_workspace=${workspaceId}`;
}

describe("CRM", () => {
  it("carga marcas, mueve el pipeline, cobra por moneda y arma el wa.me", async () => {
    const cami = await creator("cami-crm@example.com");
    const actor = { userId: cami.userId, workspaceId: cami.workspaceId };

    await withUser(cami.userId, async (db) => {
      const brand = await createBrand(db, actor, {
        name: "Bruma Belleza",
        country: "AR",
        instagram: "@bruma",
      });
      await expect(createBrand(db, actor, { name: "  brúma   belleza " })).rejects.toMatchObject({
        code: "duplicate",
        status: 409,
      });
      const contact = await createContact(db, actor, brand.id, {
        name: "Sol",
        whatsapp: "+54 9 11 5555 4444",
        email: "sol@bruma.test",
      });
      expect(contact.whatsappE164).toBe("+5491155554444");

      const stages = await listStages(db, cami.workspaceId);
      const perdido = stages.find((stage) => stage.kind === "lost");
      const negociando = stages.find((stage) => stage.name === "Negociando");
      expect(perdido && negociando).toBeTruthy();

      const deal = await createDeal(db, actor, {
        title: "Reel serum",
        brandId: brand.id,
        primaryContactId: contact.id,
        compensationType: "paid",
        amount: "450.000",
        currency: "ARS",
        publishDueAt: "2026-12-01T15:00",
        deliverablePlatform: "instagram",
        deliverableFormat: "reel",
        paymentDueDate: "2026-12-20",
        exclusivityCategory: "belleza",
        exclusivityUntil: "2027-01-01",
      });
      expect(deal.brandReused).toBe(false);

      const other = await createBrand(db, actor, { name: "Otra Marca" });
      const clash = await createDeal(db, actor, {
        title: "Otra belleza",
        brandId: other.id,
        compensationType: "barter",
        barterValue: "80000",
        barterCurrency: "ARS",
        exclusivityCategory: "belleza",
      });
      expect(clash.exclusivityWarning?.brandName).toBe("Bruma Belleza");

      await expect(moveDeal(db, actor, deal.id, { stageId: perdido!.id })).rejects.toMatchObject({
        code: "lost_reason_required",
      });
      await moveDeal(db, actor, deal.id, { stageId: negociando!.id });
      const history = await listActivities(db, cami.workspaceId, deal.id);
      expect(history.some((item) => item.type === "stage_changed")).toBe(true);

      const usd = await createPayment(db, actor, deal.id, {
        amount: "400",
        currency: "USD",
        dueDate: "2026-01-01",
      });
      await persistOverdue(db, cami.workspaceId, "2026-11-23");
      const payments = await listPaymentExpectations(db, cami.workspaceId, { dealId: deal.id });
      expect(payments.find((item) => item.id === usd.id)?.status).toBe("overdue");

      const partial = await recordReceipt(db, actor, usd.id, {
        amount: "100",
        currency: "USD",
        method: "bank_transfer",
        receivedAt: "2026-11-20",
      });
      expect(partial.status).toBe("partial");
      const paid = await recordReceipt(db, actor, usd.id, {
        amount: "300",
        currency: "USD",
        method: "mercado_pago",
      });
      expect(paid.status).toBe("paid");

      const summary = await paymentSummary(db, cami.workspaceId, "2026-11-23", "America/Argentina/Buenos_Aires");
      const ars = summary.find((item) => item.currency === "ARS");
      const dollars = summary.find((item) => item.currency === "USD");
      expect(ars?.pending).toBe(45_000_000n);
      expect(dollars?.paid).toBe(40_000n);
      expect(dollars?.overdue).toBe(0n);
      expect(Number(ars?.pending) + Number(dollars?.paid)).not.toBe(Number(ars?.pending));

      const link = await followUpForDeal(db, actor, deal.id, "whatsapp");
      expect(link.href).toMatch(/^https:\/\/wa\.me\/5491155554444\?text=/);
      expect(decodeURIComponent(link.href ?? "")).toContain("ARS");
      expect(link.text.toLowerCase()).not.toMatch(/factura|cae|cfdi/);

      const disposable = await createBrand(db, actor, { name: "Temporal" });
      await deleteBrand(db, actor, disposable.id);
      const again = await createBrand(db, actor, { name: "Temporal" });
      expect(again.id).not.toBe(disposable.id);

      const flipped = [...stages].reverse().map((stage) => ({ id: stage.id, name: stage.name, kind: stage.kind }));
      const reordered = await reorderStages(db, actor, { stages: flipped });
      expect(reordered[0]?.id).toBe(flipped[0]?.id);
      expect((await listBrands(db, cami.workspaceId)).some((item) => item.name === "Bruma Belleza")).toBe(true);
    });

    const response = await createBrandRoute(new Request("http://localhost/api/v1/brands", {
      method: "POST",
      headers: { cookie: cookie(cami.token, cami.workspaceId), "content-type": "application/json" },
      body: JSON.stringify({ name: "Desde la API" }),
    }));
    expect(response.status).not.toBe(501);
    const body = await response.json();
    expect(body.data.brand.name).toBe("Desde la API");

    const diego = await creator("diego-crm@example.com", "MX");
    const hidden = await getBrandRoute(new Request("http://localhost/api/v1/brands/x", {
      headers: { cookie: cookie(diego.token, diego.workspaceId) },
    }), { params: Promise.resolve({ id: body.data.brand.id as string }) });
    expect(hidden.status).toBe(404);

    const moved = await moveDealRoute(new Request("http://localhost/api/v1/deals/x/move", {
      method: "POST",
      headers: { cookie: cookie(diego.token, diego.workspaceId), "content-type": "application/json" },
      body: JSON.stringify({ stageId: "00000000-0000-4000-8000-000000000000" }),
    }), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) });
    expect(moved.status).toBe(404);
  });

  it("un viewer no puede escribir", async () => {
    const owner = await creator("valen-crm@example.com");
    const viewer = await creator("lector-crm@example.com");
    const agency = await createAgencyWorkspace(owner.userId, "Estudio Test");
    await withAdmin(async (db) => {
      await db.insert(memberships).values({
        workspaceId: agency.workspaceId,
        userId: viewer.userId,
        role: "viewer",
        acceptedAt: new Date(),
      });
    });
    const response = await createBrandRoute(new Request("http://localhost/api/v1/brands", {
      method: "POST",
      headers: { cookie: cookie(viewer.token, agency.workspaceId), "content-type": "application/json" },
      body: JSON.stringify({ name: "No debería" }),
    }));
    expect(response.status).toBe(403);
  });
});
