import crypto from "crypto";

export interface WebhookHeaders {
  signature?: string;
  timestamp?: string;
  event?: string;
  authorization?: string;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

const MAX_AGE_SECONDS = parseInt(process.env["WEBHOOK_MAX_AGE_SECONDS"] || "300", 10);

/**
 * Site A signs: hex(HMAC_SHA256(WEBHOOK_SECRET, rawBody))
 * in X-Webhook-Signature. Site A does not send a timestamp, so the
 * X-Webhook-Timestamp header is optional here.
 */
export function verifyWebhookSignature(rawBody: string, headers: WebhookHeaders): VerificationResult {
  const secret = process.env["WEBHOOK_SECRET"];
  if (!secret) return { valid: false, reason: "WEBHOOK_SECRET not configured" };

  if (!headers.signature) return { valid: false, reason: "Missing X-Webhook-Signature header" };

  const bearerToken = process.env["WEBHOOK_BEARER_TOKEN"];
  if (bearerToken && headers.authorization !== `Bearer ${bearerToken}`) {
    return { valid: false, reason: "Invalid Authorization token" };
  }

  if (headers.timestamp) {
    const ts = Number(headers.timestamp);
    if (!Number.isFinite(ts)) return { valid: false, reason: "Malformed X-Webhook-Timestamp header" };

    const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (age > MAX_AGE_SECONDS) return { valid: false, reason: "Webhook timestamp is too old (possible replay)" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const provided = Buffer.from(headers.signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");

  const ok = provided.length === expectedBuf.length && crypto.timingSafeEqual(provided, expectedBuf);
  return ok ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}
