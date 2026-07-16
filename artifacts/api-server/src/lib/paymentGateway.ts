import { logger } from "./logger";

export interface InitiateDepositParams {
  transactionId: number;
  userId: number;
  username: string;
  email: string;
  amount: number;
  phone: string;
}

export interface SiteADepositResult {
  checkoutRequestId?: string;
  merchantRequestId?: string;
  gatewayReference?: string;
  message?: string;
}

/**
 * The ONLY place that talks to Site A. Site B never contacts Safaricom
 * Daraja directly — Site A owns that integration.
 */
export async function initiateSiteADeposit(params: InitiateDepositParams): Promise<SiteADepositResult> {
  const baseUrl = process.env["SITE_A_API_URL"];
  const apiKey = process.env["SITE_A_API_KEY"];

  if (!baseUrl || !apiKey) {
    throw new Error("SITE_A_API_URL / SITE_A_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        transaction_id: params.transactionId,
        user_id: params.userId,
        username: params.username,
        email: params.email,
        amount: params.amount,
        phone: params.phone,
        currency: "KES",
        callback_data: { wallet: "main" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    logger.error({ err, transactionId: params.transactionId }, "Site A deposit request failed");
    throw new Error("Unable to reach payment gateway");
  } finally {
    clearTimeout(timeout);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body, fall through to error handling below
  }

  if (!res.ok) {
    logger.error({ status: res.status, body, transactionId: params.transactionId }, "Site A rejected deposit");
    throw new Error((body["message"] as string) || "Payment gateway rejected the request");
  }

  return {
    checkoutRequestId: body["checkout_request_id"] as string | undefined,
    merchantRequestId: body["merchant_request_id"] as string | undefined,
    gatewayReference: (body["gateway_reference"] as string | undefined) ?? (body["reference"] as string | undefined),
    message: body["message"] as string | undefined,
  };
}
