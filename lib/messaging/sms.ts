// REAL delivery via Twilio (SMS and WhatsApp), plain fetch. Used only when configured AND DEMO_MODE is off.
// Otherwise callers fall back to the mock (a row in `messages`), so demos never send real messages.
//   SMS:       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM  (a number, or a Messaging Service SID starting "MG")
//   WhatsApp:  TWILIO_WHATSAPP_FROM  (for example "whatsapp:+14155238886")
// India note: SMS to Indian numbers needs DLT registration of the sender and template with your operator.

export type Channel = "sms" | "whatsapp";

const cfg = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  smsFrom: process.env.TWILIO_SMS_FROM,
  waFrom: process.env.TWILIO_WHATSAPP_FROM,
});

export const isDemoEnv = () => process.env.DEMO_MODE === "true";

/** True when a real send is possible for this channel and we are not in demo mode. */
export function liveDelivery(channel: Channel): boolean {
  if (isDemoEnv()) return false;
  const c = cfg();
  return Boolean(c.sid && c.token && (channel === "sms" ? c.smsFrom : c.waFrom));
}

export async function sendLive(channel: Channel, toPhone: string, body: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const c = cfg();
  if (!c.sid || !c.token) return false;
  const from = channel === "sms" ? c.smsFrom : c.waFrom;
  if (!from) return false;
  const params = new URLSearchParams({ Body: body });
  params.set("To", channel === "whatsapp" ? `whatsapp:${toPhone}` : toPhone);
  params.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
  try {
    const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false; // no PII in logs
  }
}
