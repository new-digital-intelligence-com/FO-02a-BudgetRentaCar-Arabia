import { hasValidToolSecret } from "@/lib/agentAuth";
import { conversationDetails } from "@/lib/elevenlabs";
import { customerForConversation, customerForPhone, memoryFor, registerConversation } from "@/lib/memory";
import { mongoConfigured } from "@/lib/mongo";
import { normalisePhone } from "@/lib/phone";

/** A website call is tied to its customer when it starts; give that a moment in case the lookup comes first. */
const LATE_CHECKS = 3;
const LATE_WAIT_MS = 400;

// Tool `customer_lookup`: Noura calls it silently at the start of every call. It recognises a signed-in
// website customer (their call was tied to them when it started) or a phone caller whose number is on
// their account, and returns their name and short summaries of their earlier calls.
//
// Anything that goes wrong answers found=false with status 200 on purpose: a caller must never hear
// an error because a lookup failed. Problems are logged instead.
export async function POST(request: Request) {
  if (!hasValidToolSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = ((await request.json().catch(() => null)) ?? {}) as { conversation_id?: unknown };
  const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  if (!conversationId || !mongoConfigured()) return Response.json({ found: false });

  try {
    const registered = await customerForConversation(conversationId);
    if (registered) return Response.json(await memoryFor(registered, conversationId));

    // A phone call: recognise the caller by the number on their account.
    const details = await conversationDetails(conversationId);
    const number = details?.metadata?.phone_call?.external_number;
    if (number) {
      const phone = normalisePhone(number);
      const customer = phone ? await customerForPhone(phone) : null;
      if (!customer) return Response.json({ found: false });
      await registerConversation(conversationId, customer._id, "phone");
      return Response.json(await memoryFor(customer, conversationId));
    }

    // A website call whose start has not been recorded yet.
    for (let attempt = 0; attempt < LATE_CHECKS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, LATE_WAIT_MS));
      const late = await customerForConversation(conversationId);
      if (late) return Response.json(await memoryFor(late, conversationId));
    }
    return Response.json({ found: false });
  } catch (error) {
    console.error("customer-lookup failed", error);
    return Response.json({ found: false });
  }
}
