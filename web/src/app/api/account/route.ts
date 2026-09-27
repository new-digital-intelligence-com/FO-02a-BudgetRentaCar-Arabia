import {
  AccountProblem,
  currentCustomer,
  endAccountSession,
  publicCustomer,
  setPhone,
  signIn,
  signUp,
  startAccountSession,
} from "@/lib/accounts";
import { recentCalls } from "@/lib/memory";
import { mongoConfigured } from "@/lib/mongo";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The signed-in customer and their latest calls with Noura, or customer=null. */
export async function GET() {
  if (!mongoConfigured()) return Response.json({ customer: null, calls: [] });
  try {
    const customer = await currentCustomer();
    if (!customer) return Response.json({ customer: null, calls: [] });
    const calls = await recentCalls(customer._id);
    return Response.json({
      customer: publicCustomer(customer),
      calls: calls.map(({ startedAt, channel, summary }) => ({ startedAt: startedAt.toISOString(), channel, summary })),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

/** Account actions: signup, signin, signout and phone (add, change or remove the phone number). */
export async function POST(request: Request) {
  if (!mongoConfigured()) return Response.json({ error: "unavailable" }, { status: 503 });
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "signup": {
        const customer = await signUp({
          name: text(body.name),
          email: text(body.email),
          password: text(body.password),
          phone: text(body.phone),
        });
        await startAccountSession(customer._id);
        return Response.json({ customer: publicCustomer(customer) });
      }
      case "signin": {
        const customer = await signIn(text(body.email), text(body.password));
        await startAccountSession(customer._id);
        return Response.json({ customer: publicCustomer(customer) });
      }
      case "signout":
        await endAccountSession();
        return Response.json({ customer: null });
      case "phone": {
        const customer = await currentCustomer();
        if (!customer) return Response.json({ error: "signed_out" }, { status: 401 });
        const phone = await setPhone(customer._id, text(body.phone));
        return Response.json({ customer: { ...publicCustomer(customer), phone } });
      }
      default:
        return Response.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AccountProblem) {
      return Response.json({ error: error.code }, { status: error.code === "wrong_credentials" ? 401 : 400 });
    }
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
