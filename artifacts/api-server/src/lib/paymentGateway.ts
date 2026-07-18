import { logger } from "./logger";

export interface InitiateDepositParams {
  transactionId: number;
  amount: number;
  phone: string;
}

export interface SiteADepositResult {
  checkoutRequestId?: string;
  merchantRequestId?: string;
  status?: string;
}

/**
 * The ONLY place that talks to Site A. Site B never contacts Safaricom
 * Daraja directly — Site A owns that integration.
 *
 * Site A's real contract (as deployed):
 *   - Auth via X-API-Key header (not Authorization: Bearer)
 *   - Body: { amount, phone_number, account_reference, transaction_desc? }
 *   - Success (200): { merchant_request_id, checkout_request_id, status }
 *   - Failure (4xx/5xx): { error: string }
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
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        amount: params.amount,
        phone_number: params.phone,
        account_reference: String(params.transactionId),
        transaction_desc: "Deposit",
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
    throw new Error((body["error"] as string) || "Payment gateway rejected the request");
  }

  return {
    checkoutRequestId: body["checkout_request_id"] as string | undefined,
    merchantRequestId: body["merchant_request_id"] as string | undefined,
    status: body["status"] as string | undefined,
  };
}
