import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const preference = new Preference(client);
const payment = new Payment(client);

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
