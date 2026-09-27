import { currentCustomer } from "@/lib/accounts";
import { conversationToken } from "@/lib/elevenlabs";
import { registerConversation } from "@/lib/memory";
import { mongoConfigured } from "@/lib/mongo";
import { hasValidSession } from "@/lib/session";

// Starts a voice call with Noura. Checked again here (besides the proxy) because a call spends ElevenLabs credits.
export async function GET() {
  if (!(await hasValidSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { token, conversationId } = await conversationToken();
    await rememberSignedInCall(conversationId);
    return Response.json({ conversationToken: token, conversationId });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not start a voice call" }, { status: 502 });
  }
}

/**
 * A signed-in customer's call is tied to them before it starts, so Noura's lookup finds them at once.
 * Never blocks the call: without an account, or if the database is down, the call simply is not remembered.
 */
async function rememberSignedInCall(conversationId: string | null) {
  if (!conversationId || !mongoConfigured()) return;
  try {
    const customer = await currentCustomer();
    if (customer) await registerConversation(conversationId, customer._id, "website");
  } catch (error) {
    console.error("Could not remember the call", error);
  }
}
