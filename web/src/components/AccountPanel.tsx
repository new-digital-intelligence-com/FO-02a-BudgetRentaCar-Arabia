"use client";

import { useState } from "react";
import type { Copy } from "./copy";

export type AccountCustomer = { name: string; email: string; phone: string | null };
export type AccountCall = { startedAt: string; channel: "website" | "phone"; summary: string | null };
type BookingStop = { name: string; city: string; at: string };
/** A demo booking as /api/account sends it (see accountBooking in src/lib/bookings.ts). */
export type AccountBooking = {
  reservationNumber: string;
  state: keyof Copy["bookingStates"];
  carType: keyof Copy["carTypes"];
  car: string;
  timeZone: string;
  pickup: BookingStop;
  dropoff: BookingStop;
  total: number;
  currency: string;
  returnedEarly: boolean;
};
export type AccountState = { customer: AccountCustomer | null; calls: AccountCall[]; bookings: AccountBooking[] };
export const SIGNED_OUT: AccountState = { customer: null, calls: [], bookings: [] };

type Props = {
  t: Copy;
  account: AccountState;
  onAccountChange: (account: AccountState) => void;
  onClose: () => void;
};

async function postAccount(body: Record<string, string>): Promise<{ customer?: AccountCustomer | null; error?: string }> {
  const response = await fetch("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json().catch(() => ({ error: "unavailable" }))) as { customer?: AccountCustomer | null; error?: string };
}

/** Sign in or create an account; once signed in, the phone number and the customer's calls with Noura. */
export function AccountPanel({ t, account, onAccountChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-budget-navy/40 px-4 py-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {account.customer ? (
          <SignedIn t={t} account={account} customer={account.customer} onAccountChange={onAccountChange} />
        ) : (
          <SignInForm t={t} onAccountChange={onAccountChange} />
        )}
        <button type="button" onClick={onClose} className="mt-5 w-full text-sm text-budget-muted hover:text-budget-navy">
          {t.close}
        </button>
      </div>
    </div>
  );
}

function errorText(t: Copy, code: string | undefined): string {
  return t.errors[(code ?? "unavailable") as keyof Copy["errors"]] ?? t.errors.unavailable;
}

function SignInForm({ t, onAccountChange }: { t: Copy; onAccountChange: (account: AccountState) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postAccount(
      mode === "signup" ? { action: "signup", name, email, password, phone } : { action: "signin", email, password },
    );
    setBusy(false);
    if (result.customer) {
      onAccountChange({ ...SIGNED_OUT, customer: result.customer });
      // The calls and bookings come with the next account refresh.
      void fetch("/api/account")
        .then((response) => response.json())
        .then((data: AccountState) => data.customer && onAccountChange(data))
        .catch(() => undefined);
      return;
    }
    setError(errorText(t, result.error));
  }

  const field = "mt-1 w-full rounded-lg border border-budget-line px-3 py-2.5 outline-none focus:border-budget-orange";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-budget-navy">{mode === "signup" ? t.signUpTitle : t.signInTitle}</h2>
        <p className="mt-1 text-sm text-budget-muted">{t.accountBenefit}</p>
      </div>
      {mode === "signup" && (
        <label className="block">
          <span className="text-sm font-semibold text-budget-navy">{t.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={field} />
        </label>
      )}
      <label className="block">
        <span className="text-sm font-semibold text-budget-navy">{t.email}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" dir="ltr" className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-budget-navy">{t.password}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          dir="ltr"
          className={field}
        />
        {mode === "signup" && <span className="mt-1 block text-xs text-budget-muted">{t.passwordHint}</span>}
      </label>
      {mode === "signup" && (
        <label className="block">
          <span className="text-sm font-semibold text-budget-navy">{t.phone}</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" dir="ltr" className={field} />
          <span className="mt-1 block text-xs text-budget-muted">{t.phoneHint}</span>
        </label>
      )}
      {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-budget-red-dark">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-budget-orange py-2.5 font-semibold text-white transition hover:bg-budget-orange-dark disabled:opacity-50"
      >
        {busy ? "…" : mode === "signup" ? t.submitSignUp : t.submitSignIn}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
        className="w-full text-sm font-medium text-budget-navy underline-offset-4 hover:underline"
      >
        {mode === "signup" ? t.toSignIn : t.toSignUp}
      </button>
    </form>
  );
}

function SignedIn({
  t,
  account,
  customer,
  onAccountChange,
}: {
  t: Copy;
  account: AccountState;
  customer: AccountCustomer;
  onAccountChange: (account: AccountState) => void;
}) {
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dateFormat = new Intl.DateTimeFormat(t.locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" });

  async function savePhone() {
    setBusy(true);
    setMessage(null);
    const result = await postAccount({ action: "phone", phone });
    setBusy(false);
    if (result.customer) {
      onAccountChange({ ...account, customer: result.customer });
      setPhone(result.customer.phone ?? "");
      setMessage({ ok: true, text: t.phoneSaved });
    } else {
      setMessage({ ok: false, text: errorText(t, result.error) });
    }
  }

  async function signOut() {
    await postAccount({ action: "signout" });
    onAccountChange(SIGNED_OUT);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-budget-navy">
          {t.hello} {customer.name}
        </h2>
        <p className="text-sm text-budget-muted" dir="ltr">
          {customer.email}
        </p>
      </div>

      <div>
        <label className="block">
          <span className="text-sm font-semibold text-budget-navy">{t.phone}</span>
          <div className="mt-1 flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              dir="ltr"
              className="w-full rounded-lg border border-budget-line px-3 py-2 outline-none focus:border-budget-orange"
            />
            <button
              type="button"
              onClick={() => void savePhone()}
              disabled={busy || phone === (customer.phone ?? "")}
              className="shrink-0 rounded-lg bg-budget-navy px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t.savePhone}
            </button>
          </div>
        </label>
        <p className="mt-1 text-xs text-budget-muted">{t.phoneHint}</p>
        {message && <p className={`mt-1 text-sm ${message.ok ? "text-green-700" : "text-budget-red-dark"}`}>{message.text}</p>}
      </div>

      <div>
        <h3 className="font-bold text-budget-navy">{t.myBookings}</h3>
        {account.bookings.length === 0 ? (
          <p className="mt-1 text-sm text-budget-muted">{t.noBookings}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {account.bookings.map((booking) => (
              <BookingCard key={booking.reservationNumber} t={t} booking={booking} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-bold text-budget-navy">{t.pastCalls}</h3>
        {account.calls.length === 0 ? (
          <p className="mt-1 text-sm text-budget-muted">{t.noCalls}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {account.calls.map((call) => (
              <li key={call.startedAt} className="rounded-lg bg-budget-sky p-3 text-sm">
                <p className="text-xs font-semibold text-budget-muted">
                  {dateFormat.format(new Date(call.startedAt))} · {call.channel === "phone" ? t.channelPhone : t.channelWebsite}
                </p>
                <p dir="auto" className="mt-1 text-budget-ink">
                  {call.summary === null ? t.summaryPending : call.summary || t.noSummary}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="w-full rounded-full border border-budget-line py-2 text-sm font-semibold text-budget-navy hover:bg-budget-sky"
      >
        {t.signOut}
      </button>
    </div>
  );
}

const STATE_STYLE: Record<AccountBooking["state"], string> = {
  upcoming: "bg-green-100 text-green-800",
  in_progress: "bg-budget-orange/15 text-budget-orange-dark",
  completed: "bg-budget-line/50 text-budget-muted",
  cancelled: "bg-red-50 text-budget-red-dark",
};

/** One demo booking: number, status, car, pick-up and return (in the branch's own time zone) and the demo price. */
function BookingCard({ t, booking }: { t: Copy; booking: AccountBooking }) {
  const when = new Intl.DateTimeFormat(t.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: booking.timeZone,
  });
  const price = new Intl.NumberFormat(t.locale, { style: "currency", currency: booking.currency });
  const cancelled = booking.state === "cancelled";
  const stops: [string, BookingStop][] = [
    [t.pickupLabel, booking.pickup],
    [t.returnLabel, booking.dropoff],
  ];
  return (
    <li className={`rounded-lg border border-budget-line p-3 text-sm ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-budget-navy">
          {t.reservation} <span dir="ltr" className="tabular-nums">{booking.reservationNumber}</span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_STYLE[booking.state]}`}>
          {t.bookingStates[booking.state]}
        </span>
      </div>
      <p className="mt-1 text-budget-ink">
        {t.carTypes[booking.carType]} · <span dir="ltr">{booking.car}</span>
      </p>
      <dl className="mt-2 space-y-1">
        {stops.map(([label, stop]) => (
          <div key={label} className="flex gap-2">
            <dt className="w-16 shrink-0 text-xs font-semibold text-budget-muted">{label}</dt>
            <dd className="min-w-0">
              <span dir="ltr" className="block truncate text-budget-ink" title={stop.name}>
                {stop.name}
              </span>
              <span className="text-xs text-budget-muted">{when.format(new Date(stop.at))}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-budget-navy">
        {t.totalLabel}: <span className="font-semibold">{price.format(booking.total)}</span>{" "}
        <span className="text-xs text-budget-muted">({t.demoPrice})</span>
        {booking.returnedEarly && <span className="ms-2 text-xs text-budget-muted">· {t.returnedEarly}</span>}
      </p>
    </li>
  );
}
