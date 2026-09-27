import { hasValidToolSecret } from "@/lib/agentAuth";
import {
  BookingProblem,
  cancelBooking,
  changeBooking,
  createBooking,
  earlyReturn,
  extendRental,
  findBooking,
  priceQuote,
  type Caller,
  type ToolInput,
} from "@/lib/bookings";
import { customerForConversation } from "@/lib/memory";
import { mongoConfigured } from "@/lib/mongo";

type Tool = (input: ToolInput, caller: Caller) => unknown;

/** Noura's booking tools, one address each: /api/agent/bookings/<action>. The quote needs no database. */
const TOOLS: Record<string, { tool: Tool; database: boolean }> = {
  quote: { tool: (input) => priceQuote(input), database: false },
  create: { tool: createBooking, database: true },
  find: { tool: findBooking, database: true },
  change: { tool: changeBooking, database: true },
  extend: { tool: extendRental, database: true },
  "early-return": { tool: earlyReturn, database: true },
  cancel: { tool: cancelBooking, database: true },
};

/** The caller's account, when this call was tied to one (signed-in website customer, or a phone number on an account). */
async function callerFor(input: ToolInput): Promise<Caller> {
  const conversationId = typeof input.conversation_id === "string" && input.conversation_id ? input.conversation_id : null;
  return { conversationId, customer: conversationId ? await customerForConversation(conversationId) : null };
}

// Something Noura must sort out with the caller (a closed branch, a wrong name…) is a normal answer with ok=false and
// a message telling her what to do. Only a real failure becomes error=system_error, still with status 200 so she can
// apologise instead of going silent.
export async function POST(request: Request, context: RouteContext<"/api/agent/bookings/[action]">) {
  if (!hasValidToolSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { action } = await context.params;
  const entry = Object.hasOwn(TOOLS, action) ? TOOLS[action] : undefined;
  if (!entry) return Response.json({ error: "Unknown tool" }, { status: 404 });
  const input = ((await request.json().catch(() => null)) ?? {}) as ToolInput;

  try {
    if (entry.database && !mongoConfigured()) throw new Error("MONGODB_URI is not set");
    const caller = entry.database ? await callerFor(input) : { conversationId: null, customer: null };
    return Response.json(await entry.tool(input, caller));
  } catch (error) {
    if (error instanceof BookingProblem) return Response.json(error.toJSON());
    console.error(`booking tool "${action}" failed`, error);
    return Response.json({
      ok: false,
      error: "system_error",
      message: "The booking system did not answer. Apologise, then offer to try again, or give the reservations number 920004124.",
    });
  }
}
