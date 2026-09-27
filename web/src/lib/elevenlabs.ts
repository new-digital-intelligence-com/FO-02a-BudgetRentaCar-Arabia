const API_BASE = "https://api.elevenlabs.io/v1/convai";

function credentials() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set");
  }
  return { apiKey, agentId };
}

/**
 * A one-use WebRTC token for a voice call with Noura. The browser starts the call with it and never
 * sees the API key. ElevenLabs also returns the id the conversation will have.
 */
export async function conversationToken(): Promise<{ token: string; conversationId: string | null }> {
  const { apiKey, agentId } = credentials();
  const response = await fetch(`${API_BASE}/conversation/token?${new URLSearchParams({ agent_id: agentId })}`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs conversation token failed with ${response.status}`);
  }
  const body = (await response.json()) as { token: string; conversation_id?: string | null };
  return { token: body.token, conversationId: body.conversation_id ?? null };
}

export type ConversationDetails = {
  status: "initiated" | "in-progress" | "processing" | "done" | "failed";
  agent_id?: string;
  analysis?: { transcript_summary?: string | null } | null;
  metadata?: {
    start_time_unix_secs?: number;
    /** Phone calls only: the customer's own number, whichever side dialled. */
    phone_call?: { external_number?: string | null } | null;
  };
};

/** One conversation as ElevenLabs stored it (status, summary, phone number). Reading it is free. */
export async function conversationDetails(conversationId: string): Promise<ConversationDetails | null> {
  const { apiKey } = credentials();
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`ElevenLabs conversation lookup failed with ${response.status}`);
  return (await response.json()) as ConversationDetails;
}
