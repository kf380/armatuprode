import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const preference = new Preference(client);
const payment = new Payment(client);

/**
 * Validates MercadoPago webhook signature.
 * Manifest format per MP docs: `id:DATA_ID;request-id:REQUEST_ID;ts:TS;`
 * x-signature header: `ts=<unix>,v1=<hmacSha256Hex>`
 */
export function validateWebhookSignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null,
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in production. In non-prod, allow so dev/staging keep working.
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }

  if (!signatureHeader || !requestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [k, v] = segment.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.ts;
  const provided = parts.v1;
  if (!ts || !provided) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface CreatePreferenceParams {
  title: string;
  unitPrice: number;
  externalReference: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
}

export async function createMPPreference({
  title,
  unitPrice,
  externalReference,
  backUrls,
  notificationUrl,
}: CreatePreferenceParams) {
  const result = await preference.create({
    body: {
      items: [
        {
          id: externalReference,
          title,
          quantity: 1,
          unit_price: unitPrice,
          currency_id: "ARS",
        },
      ],
      back_urls: backUrls,
      auto_return: "approved",
      external_reference: externalReference,
      notification_url: notificationUrl,
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
  };
}

export async function getMPPayment(paymentId: string) {
  const result = await payment.get({ id: paymentId });
  return {
    id: String(result.id),
    status: result.status,
    externalReference: result.external_reference,
    transactionAmount: result.transaction_amount,
  };
}
