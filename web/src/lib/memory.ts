import type { ObjectId } from "mongodb";
import { conversationDetails } from "./elevenlabs";
import { collections, type ConversationDoc, type CustomerDoc } from "./mongo";

/** How many earlier calls Noura hears about, newest first. */
const RECENT_CALLS = 5;
/** ElevenLabs writes the summary a little after the call ends; ask again after this long. */
const SUMMARY_RETRY_MS = 60_000;
/** Too young to have a summary yet: the call is probably still going on. */
const SUMMARY_MIN_AGE_MS = 20_000;

export type Channel = ConversationDoc["channel"];

/**
 * Ties a conversation to a customer. The website does it when a signed-in customer starts a call; a
 * phone call is tied when Noura's lookup recognises the caller's number. Tying the same call twice
 * keeps the first answer.
 */
export async function registerConversation(conversationId: string, customerId: ObjectId, channel: Channel): Promise<void> {
  const { conversations } = await collections();
  await conversations.updateOne(
    { conversationId },
    { $setOnInsert: { conversationId, customerId, channel, startedAt: new Date(), summary: null, summaryCheckedAt: null } },
    { upsert: true },
  );
}

export async function customerForConversation(conversationId: string): Promise<CustomerDoc | null> {
  if (!conversationId) return null;
  const { conversations, customers } = await collections();
  const conversation = await conversations.findOne({ conversationId });
  return conversation ? customers.findOne({ _id: conversation.customerId }) : null;
}

export async function customerForPhone(phone: string): Promise<CustomerDoc | null> {
  const { customers } = await collections();
  return customers.findOne({ phone });
}

/** Fills in the summaries ElevenLabs has written since we last looked. A failure leaves the call as it was. */
async function fillSummaries(calls: ConversationDoc[]): Promise<ConversationDoc[]> {
  const { conversations } = await collections();
  const now = Date.now();
  return Promise.all(
    calls.map(async (call) => {
      const due =
        call.summary === null &&
        now - call.startedAt.getTime() > SUMMARY_MIN_AGE_MS &&
        (!call.summaryCheckedAt || now - call.summaryCheckedAt.getTime() > SUMMARY_RETRY_MS);
      if (!due) return call;
      try {
        const details = await conversationDetails(call.conversationId);
        const finished = !details || details.status === "done" || details.status === "failed";
        // An empty string means "finished, nothing to remember", so it is never asked for again.
        const summary = finished ? details?.analysis?.transcript_summary?.trim() || "" : null;
        await conversations.updateOne({ conversationId: call.conversationId }, { $set: { summary, summaryCheckedAt: new Date() } });
        return { ...call, summary };
      } catch (error) {
        console.error("Could not read the conversation summary", call.conversationId, error);
        return call;
      }
    }),
  );
}

export type PastCall = { conversationId: string; startedAt: Date; channel: Channel; summary: string | null };

/** The customer's latest calls with their summaries (null while ElevenLabs is still writing one). */
export async function recentCalls(customerId: ObjectId, excludeConversationId?: string): Promise<PastCall[]> {
  const { conversations } = await collections();
  const calls = await conversations
    .find({ customerId, ...(excludeConversationId ? { conversationId: { $ne: excludeConversationId } } : {}) })
    .sort({ startedAt: -1 })
    .limit(RECENT_CALLS)
    .toArray();
  return (await fillSummaries(calls)).map(({ conversationId, startedAt, channel, summary }) => ({
    conversationId,
    startedAt,
    channel,
    summary,
  }));
}

const RIYADH_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  dateStyle: "medium",
  timeStyle: "short",
});

/** What Noura's lookup tool answers about a known customer during the current call. */
export async function memoryFor(customer: CustomerDoc, currentConversationId: string) {
  const calls = await recentCalls(customer._id, currentConversationId);
  return {
    found: true,
    name: customer.name,
    first_name: customer.name.split(/\s+/)[0],
    has_phone_on_file: Boolean(customer.phone),
    previous_calls: calls
      .filter((call) => call.summary)
      .map((call) => ({
        when: `${RIYADH_TIME.format(call.startedAt)} (Saudi time)`,
        channel: call.channel,
        summary: call.summary,
      })),
  };
}
