import { MongoClient, type Db, type ObjectId } from "mongodb";
import type { CountryCode } from "./branches";
import type { CarType, PriceQuote } from "./pricing";

/** A customer account on the website. The phone number (optional) is how Noura will recognise them on a phone call. */
export type CustomerDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  createdAt: Date;
};

/** A signed-in browser. Only a hash of the cookie value is stored. */
export type AccountSessionDoc = {
  tokenHash: string;
  customerId: ObjectId;
  expiresAt: Date;
};

/** One conversation with Noura that belongs to a known customer, with the summary ElevenLabs writes after it. */
export type ConversationDoc = {
  conversationId: string;
  customerId: ObjectId;
  channel: "website" | "phone";
  startedAt: Date;
  summary: string | null;
  summaryCheckedAt: Date | null;
};

/** One end of a rental: the branch (copied, so a later change in the branch list does not change the booking) and when. */
export type BookingStop = { code: string; name: string; city: string; at: Date };

export type BookingAction = "created" | "changed" | "extended" | "early_return" | "cancelled";

/**
 * A demo reservation made with Noura. No car is really reserved and nothing is paid (payment is "at the counter").
 * `status` only says whether it was cancelled; upcoming / in progress / completed come from the times.
 */
export type BookingDoc = {
  _id: ObjectId;
  reservationNumber: string;
  status: "confirmed" | "cancelled";
  /** The account it belongs to: the signed-in website customer, or the phone caller recognised by their number. */
  customerId: ObjectId | null;
  driverName: string;
  country: CountryCode;
  carType: CarType;
  pickup: BookingStop;
  dropoff: BookingStop;
  price: PriceQuote;
  /** Set when the car was returned before the agreed time: the return time that was first agreed. */
  earlyReturnFrom: Date | null;
  conversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  history: { at: Date; action: BookingAction; conversationId: string | null; note: string }[];
};

declare global {
  var budgetMongo: Promise<Db> | undefined;
}

export function mongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must be set");
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 }).connect();
  const database = client.db(process.env.MONGODB_DB || "budget_demo");
  await Promise.all([
    database.collection("customers").createIndex({ email: 1 }, { unique: true }),
    database
      .collection("customers")
      .createIndex({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } }),
    database.collection("account_sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection("account_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection("conversations").createIndex({ conversationId: 1 }, { unique: true }),
    database.collection("conversations").createIndex({ customerId: 1, startedAt: -1 }),
    database.collection("bookings").createIndex({ reservationNumber: 1 }, { unique: true }),
    database.collection("bookings").createIndex({ customerId: 1, "pickup.at": -1 }),
    database.collection("bookings").createIndex({ conversationId: 1 }),
  ]);
  return database;
}

/** The Budget demo database. One connection per server instance, reused across requests. */
export async function db(): Promise<Db> {
  globalThis.budgetMongo ??= connect().catch((error) => {
    globalThis.budgetMongo = undefined; // try again on the next request
    throw error;
  });
  return globalThis.budgetMongo;
}

export async function collections() {
  const database = await db();
  return {
    customers: database.collection<CustomerDoc>("customers"),
    accountSessions: database.collection<AccountSessionDoc>("account_sessions"),
    conversations: database.collection<ConversationDoc>("conversations"),
    bookings: database.collection<BookingDoc>("bookings"),
  };
}
