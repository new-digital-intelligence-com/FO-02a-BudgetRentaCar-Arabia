import { createHash, randomBytes } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { collections, type CustomerDoc } from "./mongo";
import { hashPassword, verifyPassword } from "./password";
import { normalisePhone } from "./phone";

/** The customer's own sign-in, separate from the site password cookie. */
export const ACCOUNT_COOKIE = "budget_account";
const ACCOUNT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MIN_PASSWORD_LENGTH = 8;

export type AccountError =
  | "name_required"
  | "invalid_email"
  | "weak_password"
  | "invalid_phone"
  | "email_taken"
  | "phone_taken"
  | "wrong_credentials";

export class AccountProblem extends Error {
  constructor(public readonly code: AccountError) {
    super(code);
  }
}

/** What the page may show about the signed-in customer (never the password hash). */
export type PublicCustomer = { name: string; email: string; phone: string | null };

export function publicCustomer(customer: CustomerDoc): PublicCustomer {
  return { name: customer.name, email: customer.email, phone: customer.phone };
}

function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function optionalPhone(input: string | undefined): string | null {
  if (!input?.trim()) return null;
  const phone = normalisePhone(input);
  if (!phone) throw new AccountProblem("invalid_phone");
  return phone;
}

function duplicateField(error: unknown): "email" | "phone" | null {
  if (!(error instanceof MongoServerError) || error.code !== 11000) return null;
  return Object.keys(error.keyPattern ?? {}).includes("phone") ? "phone" : "email";
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signUp(input: { name: string; email: string; password: string; phone?: string }): Promise<CustomerDoc> {
  const name = input.name.trim();
  if (!name) throw new AccountProblem("name_required");
  const email = normaliseEmail(input.email);
  if (!email) throw new AccountProblem("invalid_email");
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new AccountProblem("weak_password");
  const phone = optionalPhone(input.phone);

  const { customers } = await collections();
  const doc: CustomerDoc = { _id: new ObjectId(), name, email, phone, passwordHash: await hashPassword(input.password), createdAt: new Date() };
  try {
    await customers.insertOne(doc);
    return doc;
  } catch (error) {
    const field = duplicateField(error);
    if (field) throw new AccountProblem(field === "phone" ? "phone_taken" : "email_taken");
    throw error;
  }
}

export async function signIn(emailInput: string, password: string): Promise<CustomerDoc> {
  const email = normaliseEmail(emailInput);
  const { customers } = await collections();
  const customer = email ? await customers.findOne({ email }) : null;
  if (!customer || !(await verifyPassword(password, customer.passwordHash))) {
    // Slow down repeated guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    throw new AccountProblem("wrong_credentials");
  }
  return customer;
}

/** Signs this browser in as the customer. */
export async function startAccountSession(customerId: ObjectId): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const { accountSessions } = await collections();
  await accountSessions.insertOne({
    tokenHash: tokenHash(token),
    customerId,
    expiresAt: new Date(Date.now() + ACCOUNT_MAX_AGE_SECONDS * 1000),
  });
  (await cookies()).set(ACCOUNT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCOUNT_MAX_AGE_SECONDS,
  });
}

/** The customer signed in on this browser, or null. */
export async function currentCustomer(): Promise<CustomerDoc | null> {
  const token = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const { accountSessions, customers } = await collections();
  const session = await accountSessions.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  return session ? customers.findOne({ _id: session.customerId }) : null;
}

export async function endAccountSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCOUNT_COOKIE)?.value;
  if (token) {
    const { accountSessions } = await collections();
    await accountSessions.deleteOne({ tokenHash: tokenHash(token) });
  }
  cookieStore.delete(ACCOUNT_COOKIE);
}

/** Adds, changes or (with an empty value) removes the customer's phone number. */
export async function setPhone(customerId: ObjectId, input: string): Promise<string | null> {
  const phone = optionalPhone(input);
  const { customers } = await collections();
  try {
    await customers.updateOne({ _id: customerId }, { $set: { phone } });
  } catch (error) {
    if (duplicateField(error) === "phone") throw new AccountProblem("phone_taken");
    throw error;
  }
  return phone;
}
