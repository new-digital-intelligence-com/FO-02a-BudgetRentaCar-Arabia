import { createHash, timingSafeEqual } from "node:crypto";

/** Header the agent's tools send; its value is Budget's own secret, stored in ElevenLabs (never CDA's). */
export const TOOL_SECRET_HEADER = "x-budget-agent-secret";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** True when the request comes from Noura's tools. Fails closed when AGENT_TOOL_SECRET is not set. */
export function hasValidToolSecret(request: Request): boolean {
  const expected = process.env.AGENT_TOOL_SECRET;
  const given = request.headers.get(TOOL_SECRET_HEADER);
  if (!expected || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}
