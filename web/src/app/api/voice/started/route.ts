import { currentCustomer } from "@/lib/accounts";
import { registerConversation } from "@/lib/memory";
import { mongoConfigured } from "@/lib/mongo";

/**
 * The page reports the conversation id once the call is connected. It ties the call to the signed-in
 * customer in case the token did not carry the id; tying the same call twice changes nothing.
 */
export async function POST(request: Request) {
  const body = ((await request.json().catch(() => null)) ?? {}) as { conversationId?: unknown };
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (!/^[\w-]{6,100}$/.test(conversationId)) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!mongoConfigured()) return Response.json({ remembered: false });
  try {
    const customer = await currentCustomer();
    if (!customer) return Response.json({ remembered: false });
    await registerConversation(conversationId, customer._id, "website");
    return Response.json({ remembered: true });
  } catch (error) {
    console.error(error);
    return Response.json({ remembered: false });
  }
}
