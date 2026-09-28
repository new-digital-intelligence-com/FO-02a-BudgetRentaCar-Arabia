"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountPanel, SIGNED_OUT, type AccountState } from "./AccountPanel";
import { COPY, type UiLanguage } from "./copy";
import { transcriptText } from "./transcriptText";
import { VoiceOrb } from "./VoiceOrb";

type Line = { id: string; role: "user" | "agent"; text: string };

export function VoiceAssistant() {
  return (
    <ConversationProvider>
      <Assistant />
    </ConversationProvider>
  );
}

function Assistant() {
  const [language, setLanguage] = useState<UiLanguage>("ar");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [account, setAccount] = useState<AccountState>(SIGNED_OUT);
  const [accountOpen, setAccountOpen] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const t = COPY[language];

  /** The signed-in customer, their bookings and their calls (a new call's summary arrives a little after it ends). */
  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (response.ok) setAccount((await response.json()) as AccountState);
    } catch {
      // Keep what is shown; the next refresh will try again.
    }
  }, []);

  useEffect(() => {
    // Load once when the page opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the state is set after the fetch resolves
    void refreshAccount();
  }, [refreshAccount]);

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      const text = transcriptText(message);
      if (text) setLines((current) => [...current, { id: crypto.randomUUID(), role, text }]);
    },
    onConnect: ({ conversationId }) => {
      setStartedAt(Date.now());
      // Ties the call to the signed-in customer (the server ignores it for anyone else).
      void fetch("/api/voice/started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      }).catch(() => undefined);
    },
    onDisconnect: () => {
      setStartedAt(null);
      void refreshAccount();
    },
    onError: (message) => {
      console.error(message);
      setError(COPY[language].startError);
    },
  });
  const { status, isSpeaking, isMuted, setMuted } = conversation;
  const connected = status === "connected";
  const connecting = status === "connecting";

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  // Call timer.
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  async function startCall() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setError(t.micError);
      return;
    }
    const response = await fetch("/api/voice/token");
    if (!response.ok) {
      setError(t.startError);
      return;
    }
    const { conversationToken } = (await response.json()) as { conversationToken: string };
    setLines([]);
    setNow(Date.now());
    // Arabic is Noura's default; English uses the agent's "en" preset (English greeting, same voice).
    conversation.startSession({
      conversationToken,
      connectionType: "webrtc",
      ...(language === "en" ? { overrides: { agent: { language: "en" } } } : {}),
    });
  }

  function endCall() {
    if (status !== "disconnected") conversation.endSession();
  }

  const statusText = connecting
    ? t.statusConnecting
    : connected
      ? isMuted
        ? t.statusMuted
        : isSpeaking
          ? t.statusSpeaking
          : t.statusListening
      : t.statusIdle;
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} lang={language} className="flex min-h-full flex-1 flex-col">
      <header className="bg-budget-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-tight text-budget-orange" dir="ltr">
              Budget
            </span>
            <span className="text-sm text-white/80">{t.brandTagline}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{t.demoBadge}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitch value={language} onChange={setLanguage} disabled={connected || connecting} label={t.languageLabel} />
            <button
              type="button"
              onClick={() => {
                setAccountOpen(true);
                void refreshAccount();
              }}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-budget-navy transition hover:bg-budget-sky"
            >
              {account.customer ? `${t.hello} ${account.customer.name.split(/\s+/)[0]}` : t.signIn}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_1.1fr]">
        <section className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-budget-navy">{t.title}</h1>
          <p className="mt-2 text-budget-muted">{t.subtitle}</p>

          <VoiceOrb
            active={connected}
            isSpeaking={isSpeaking}
            getInputVolume={conversation.getInputVolume}
            getOutputVolume={conversation.getOutputVolume}
          />

          <p className="text-center font-medium text-budget-navy" aria-live="polite">
            {statusText}
            {connected && <span className="ms-2 tabular-nums text-budget-muted" dir="ltr">{clock}</span>}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {connected || connecting ? (
              <>
                <button
                  type="button"
                  onClick={endCall}
                  className="rounded-full bg-budget-red px-7 py-3 font-semibold text-white transition hover:bg-budget-red-dark"
                >
                  {t.end}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted(!isMuted)}
                  disabled={!connected}
                  aria-pressed={isMuted}
                  className="rounded-full border border-budget-line px-6 py-3 font-semibold text-budget-navy transition hover:bg-budget-sky disabled:opacity-50"
                >
                  {isMuted ? t.unmute : t.mute}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startCall()}
                className="rounded-full bg-budget-orange px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:bg-budget-orange-dark"
              >
                {t.start}
              </button>
            )}
          </div>
          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-budget-red-dark">{error}</p>}
          <p className="mt-4 text-center text-sm text-budget-navy">
            {account.customer ? (
              t.memoryOn
            ) : (
              <button type="button" onClick={() => setAccountOpen(true)} className="underline underline-offset-4">
                {t.memoryOff}
              </button>
            )}
          </p>
          <p className="mt-1 text-center text-xs text-budget-muted">{t.callLimit}</p>
        </section>

        <section className="flex min-h-80 flex-col rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-budget-navy">{t.transcriptTitle}</h2>
          <div className="mt-4 max-h-[28rem] flex-1 space-y-3 overflow-y-auto pe-1">
            {lines.length === 0 ? (
              <p className="text-sm text-budget-muted">{t.transcriptEmpty}</p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className={`flex ${line.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      line.role === "user" ? "bg-budget-sky text-budget-ink" : "bg-budget-navy text-white"
                    }`}
                  >
                    <p className="text-xs font-semibold opacity-70">{line.role === "user" ? t.you : t.noura}</p>
                    <p dir="auto" className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                      {line.text}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-budget-navy">{t.tryTitle}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {t.tryQuestions.map((question) => (
              <li key={question} dir="auto" className="rounded-full bg-budget-sky px-3.5 py-1.5 text-sm text-budget-ink">
                {question}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-budget-navy">{t.helpTitle}</h2>
          <ul className="mt-3 space-y-1.5 text-budget-ink">
            {t.help.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-budget-orange" aria-hidden>
                  ●
                </span>
                {item}
              </li>
            ))}
          </ul>
          <h3 className="mt-5 font-bold text-budget-navy">{t.countriesTitle}</h3>
          <p className="mt-1 text-sm text-budget-muted">{t.countries}</p>
        </section>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-budget-muted">
        {t.footer}
        <form action="/api/logout" method="post" className="mt-2 flex justify-center gap-4">
          <Link href="/docs" className="underline underline-offset-4 hover:text-budget-navy">
            {t.docsLink}
          </Link>
          <button type="submit" className="underline underline-offset-4 hover:text-budget-navy">
            {t.lockDemo}
          </button>
        </form>
      </footer>

      {accountOpen && (
        <AccountPanel t={t} account={account} onAccountChange={setAccount} onClose={() => setAccountOpen(false)} />
      )}
    </div>
  );
}

function LanguageSwitch({
  value,
  onChange,
  disabled,
  label,
}: {
  value: UiLanguage;
  onChange: (language: UiLanguage) => void;
  disabled: boolean;
  label: string;
}) {
  const options: { value: UiLanguage; label: string }[] = [
    { value: "ar", label: "العربية" },
    { value: "en", label: "English" },
  ];
  return (
    <div className="flex rounded-full bg-white/15 p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
          className={`rounded-full px-3.5 py-1 text-sm font-medium transition disabled:cursor-not-allowed ${
            value === option.value ? "bg-white text-budget-navy" : "text-white/85 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
