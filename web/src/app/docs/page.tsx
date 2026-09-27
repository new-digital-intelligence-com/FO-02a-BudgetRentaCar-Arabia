import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { MAX_AHEAD_MS, NOTICE_MS } from "@/lib/bookings";
import { BRANCHES, COUNTRIES, type CountryCode } from "@/lib/branches";
import { CAR_TYPES, GRACE_MS, LONG_RENTAL_DISCOUNTS, MAX_RENTAL_DAYS, MONEY, ONE_WAY_FEE_SAR } from "@/lib/pricing";
import { CHANGELOG, KNOWLEDGE_PAGES, KNOWLEDGE_PDFS, LAST_UPDATED, MODULES, ROADMAP, TOOLS, type Status } from "./data";

// Project documentation for the team and for Budget: what each module does and how it works. Behind the site password
// like the rest of the demo. Texts that change live in ./data.ts; figures come from the booking code itself.

export const metadata: Metadata = {
  title: "Project docs – Budget Voice Assistant Demo",
  description: "How Noura, the Budget Arabia voice assistant demo, works: modules, features, status and changes.",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  ["overview", "Overview"],
  ["status", "Modules and status"],
  ["architecture", "How it works"],
  ["noura", "Noura, the agent"],
  ["knowledge", "Knowledge base"],
  ["website", "Website and call"],
  ["accounts", "Accounts and memory"],
  ["bookings", "Demo bookings"],
  ["tools", "Noura's tools"],
  ["handover", "Handover to a human"],
  ["security", "Security and data"],
  ["roadmap", "Next steps"],
  ["changelog", "Changelog"],
] as const;

const HOUR_MS = 60 * 60 * 1000;
const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];
const CITY_COUNT = new Set(BRANCHES.map((b) => `${b.country}:${b.city}`)).size;
const AIRPORT_COUNT = BRANCHES.filter((b) => b.kind === "Airport").length;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function DocsPage() {
  return (
    <div dir="ltr" lang="en" className="flex min-h-full flex-1 flex-col">
      <header className="bg-budget-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tracking-tight text-budget-orange">Budget</span>
            <span className="text-sm text-white/80">Voice assistant</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">Project docs</span>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-budget-navy transition hover:bg-budget-sky"
          >
            Open the demo
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
        <nav aria-label="Sections" className="mb-6 lg:mb-0">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {SECTIONS.map(([id, label]) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className="block rounded-full bg-white px-3 py-1.5 text-sm text-budget-ink shadow-sm transition hover:text-budget-orange lg:rounded-lg lg:bg-transparent lg:shadow-none lg:hover:bg-white"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-6">
          <Overview />
          <ModulesStatus />
          <Architecture />
          <Noura />
          <Knowledge />
          <Website />
          <Accounts />
          <Bookings />
          <Tools />
          <Handover />
          <Security />
          <Roadmap />
          <Changelog />
        </main>
      </div>

      <footer className="px-4 pb-6 text-center text-xs text-budget-muted">
        Demo by NDI (New Digital Intelligence). Not an official Budget website; bookings made here are demo bookings. Last
        updated {LAST_UPDATED}.
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- building blocks

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold text-budget-navy">{title}</h2>
      {lead && <p className="mt-2 max-w-3xl text-budget-muted">{lead}</p>}
      <div className="mt-5 space-y-5 leading-relaxed">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-bold text-budget-navy">{title}</h3>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-budget-orange" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-budget-navy text-xs font-bold text-white">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-budget-line">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-budget-sky text-budget-navy">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-3 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-budget-line">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-budget-sky px-4 py-3 text-sm text-budget-ink">{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-budget-sky px-1.5 py-0.5 font-mono text-[0.85em] text-budget-navy">{children}</code>;
}

/** Arabic inside an English sentence: right to left, and kept in one piece so a line break cannot scramble it. */
function Arabic({ children }: { children: ReactNode }) {
  return (
    <span dir="rtl" lang="ar" className="inline-block">
      {children}
    </span>
  );
}

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-green-100 text-green-800" },
  planned: { label: "Planned", className: "bg-amber-100 text-amber-800" },
  later: { label: "Later", className: "bg-budget-line/50 text-budget-muted" },
};

function Badge({ status }: { status: Status }) {
  const { label, className } = STATUS_STYLE[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

/** Boxes joined by arrows: a row on wide screens, a column on phones. */
function Flow({ boxes }: { boxes: { title: string; tone?: "navy" | "orange" | "sky"; lines: string[] }[] }) {
  const tones = {
    navy: "bg-budget-navy text-white",
    orange: "bg-budget-orange text-white",
    sky: "bg-budget-sky text-budget-navy",
  };
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {boxes.map((box, i) => (
        <div key={box.title} className="contents">
          {i > 0 && (
            <span className="self-center text-xl font-bold text-budget-orange" aria-hidden>
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </span>
          )}
          <div className={`flex-1 rounded-xl p-4 ${tones[box.tone ?? "sky"]}`}>
            <p className="font-bold">{box.title}</p>
            {box.lines.map((line) => (
              <p key={line} className="mt-1 text-sm opacity-90">
                {line}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- sections

function Overview() {
  const stats = [
    ["9", "countries"],
    [String(BRANCHES.length), "bookable branches"],
    [String(KNOWLEDGE_PDFS.length + KNOWLEDGE_PAGES.length), "knowledge documents"],
    [String(TOOLS.length), "tools"],
  ];
  return (
    <section id="overview" className="scroll-mt-6 rounded-2xl bg-budget-navy p-6 text-white shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-budget-orange">Budget Rent a Car · Arab region</p>
      <h1 className="mt-2 text-3xl font-bold">Noura, the Budget voice assistant</h1>
      <p className="mt-3 max-w-3xl text-white/85">
        A demo built by NDI (New Digital Intelligence). Customers talk to Noura in their own Arabic dialect or in English. She
        answers questions from Budget&apos;s public information, recognises returning customers, and makes and manages demo bookings.
        Nothing real happens: bookings are stored in a demo database and nothing is paid.
      </p>
      <p className="mt-2 max-w-3xl text-white/85">
        Today she is tested on this website. A phone number comes after the website version is validated. The 9 countries are Saudi
        Arabia (covered in depth), the UAE, Kuwait, Qatar, Bahrain, Oman, Jordan, Egypt and Lebanon.
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={label} className="rounded-xl bg-white/10 p-4">
            <dt className="text-sm text-white/75">{label}</dt>
            <dd className="text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ModulesStatus() {
  return (
    <Section id="status" title="Modules and status" lead={`Where each part of the project stands (updated ${LAST_UPDATED}).`}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((module) => (
          <li key={module.name}>
            <a
              href={`#${module.section}`}
              className="flex h-full flex-col gap-1 rounded-xl border border-budget-line p-4 transition hover:border-budget-orange"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-budget-navy">{module.name}</span>
                <Badge status={module.status} />
              </span>
              <span className="text-sm text-budget-muted">{module.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Architecture() {
  return (
    <Section id="architecture" title="How it works" lead="The path of one question, from the caller's voice to the answer.">
      <Flow
        boxes={[
          { title: "Caller", tone: "sky", lines: ["Browser on this site today", "Phone call later"] },
          {
            title: "ElevenLabs · Noura",
            tone: "navy",
            lines: ["Hears: speech to text", "Thinks: language model + Budget documents", "Speaks: voice Amal"],
          },
          { title: "Website API", tone: "orange", lines: ["Noura's tools", "Next.js on Vercel"] },
          { title: "Database", tone: "sky", lines: ["MongoDB Atlas", "Customers, calls, bookings"] },
        ]}
      />
      <Steps
        items={[
          "The caller presses the call button. The website asks ElevenLabs for a one-use call token, so the ElevenLabs key never reaches the browser.",
          "The caller's voice streams to ElevenLabs. Noura turns it into text, works out the answer with her language model and Budget's documents, and speaks it with her voice.",
          "When she needs data or an action (who is calling, a price, a booking), she calls one of her tools: a secure web request to this website's API.",
          "The website checks the request, reads or writes the database, and answers her in a fraction of a second. She tells the caller the result.",
        ]}
      />
    </Section>
  );
}

function Noura() {
  return (
    <Section id="noura" title="Noura, the agent" lead="An ElevenLabs voice agent with a Saudi persona and Budget's rules.">
      <Table
        head={["Part", "Setting"]}
        rows={[
          ["Persona", "A Saudi woman from Jeddah: warm, polite and efficient. She speaks of herself in the feminine."],
          ["Arabic", "The Saudi \"white dialect\". She adapts her words to the caller's dialect (the 9 countries), keeping her Saudi voice."],
          ["English", "She switches to English as soon as the caller speaks English, and back to Arabic when they do."],
          ["Voice", "Amal – Rich & Sophisticated (Saudi, with a Hijazi touch)"],
          ["Voice model", "Eleven v3 Conversational, with expressive mode (natural tone and emotion)"],
          ["Language model", "Gemini 3.7 Flash, set for steady answers. She knows the current Saudi date and time."],
          ["Hearing", "ElevenLabs Scribe Realtime speech recognition"],
          ["Call length", "Up to 10 minutes"],
          [
            "Greeting",
            <span key="g">
              <Arabic>«هلا وغلا، معك نورة من Budget لتأجير السيارات. كيف أقدر أخدمك اليوم؟»</Arabic>
              <br />
              In English: &quot;Hello, this is Noura from Budget Rent a Car. How can I help you today?&quot;
            </span>,
          ],
        ]}
      />
      <Sub title="How she speaks">
        <Bullets
          items={[
            <>
              Names stay in English letters: Budget, car brands and models (Toyota Camry), websites, Quick Pass. Everything else is
              said in Arabic: Gold is <Arabic>الذهبية</Arabic>, SUV is <Arabic>دفع رباعي</Arabic>, and street names are in Arabic.
            </>,
            "Short sentences and one question at a time. Phone and reservation numbers are said slowly, in small groups.",
            "She answers only from Budget's documents and never invents a branch, number, price or rule. Points Budget does not publish are presented as common practice, to be confirmed.",
            "She asks only for what a task needs, and never accepts card, CVV, ID, iqama or passport numbers, or passwords.",
            "She stays on Budget car rental and does not talk about competitors.",
          ]}
        />
      </Sub>
      <Sub title="Emergencies and problems she never handles alone">
        <Table
          head={["Situation", "What Noura does today"]}
          rows={[
            ["Accident", "Asks if anyone is hurt: if yes, 911 (or 997 for an ambulance) first. If not: report to Najm (920000560), do not admit responsibility, tell Budget."],
            ["Breakdown", "Budget 24-hour roadside assistance: 800 244 3399"],
            ["Safety (threat, theft, fire, medical)", "Emergency number 911 first"],
            ["Billing dispute", "Budget customer care: bccc@budgetsaudi.com or +966 12 692 7070, extension 1463"],
          ]}
        />
        <p className="mt-2 text-sm text-budget-muted">
          Outside Saudi Arabia she gives that country&apos;s Budget number. The transfer to a colleague is planned: see{" "}
          <a href="#handover" className="text-budget-orange underline underline-offset-2">
            Handover to a human
          </a>
          .
        </p>
      </Sub>
    </Section>
  );
}

function Knowledge() {
  return (
    <Section
      id="knowledge"
      title="Knowledge base"
      lead="What Noura knows about Budget: facts collected from Budget's public websites (checked 25 September 2026)."
    >
      <Sub title={`${KNOWLEDGE_PDFS.length} documents`}>
        <Table head={["Document", "Content"]} rows={KNOWLEDGE_PDFS.map((d) => [<b key={d.name}>{d.name}</b>, d.content])} />
      </Sub>
      <Sub title={`${KNOWLEDGE_PAGES.length} Budget web pages, read directly`}>
        <ul className="flex flex-wrap gap-2">
          {KNOWLEDGE_PAGES.map((page) => (
            <li key={page} className="rounded-full bg-budget-sky px-3 py-1 text-sm">
              {page}
            </li>
          ))}
        </ul>
      </Sub>
      <Bullets
        items={[
          "The documents are in English (Arabic text does not survive PDF text reading well); Noura answers in the caller's language anyway.",
          "They are kept in a Google Drive folder that ElevenLabs re-reads every week. The web pages are re-read every 7 days, and an offer page is removed automatically when the offer ends.",
          "Points Budget does not publish (for example extensions, early returns, one-way rentals, minimum age) are marked \"general practice\", and Noura says they need confirming.",
        ]}
      />
    </Section>
  );
}

function Website() {
  return (
    <Section id="website" title="Website and voice call" lead="The demo site where visitors talk to Noura.">
      <Bullets
        items={[
          "Arabic, right to left, by default, with an English switch. The switch also sets the language of the next call.",
          "The call screen: a voice orb that moves with the voices, the call status and timer, a mute button, and the live transcript of the call.",
          "Sample questions and the list of what Noura can help with.",
          "The whole site is locked by a demo password. Only Noura's tools can reach the site without it, with their own secret key.",
          "Hosted on Vercel. Each push to the project's GitHub repository deploys the new version.",
        ]}
      />
    </Section>
  );
}

function Accounts() {
  return (
    <Section id="accounts" title="Accounts and memory" lead="Noura recognises returning customers and remembers their earlier calls.">
      <Steps
        items={[
          "A customer creates an account on the site: name, email, password, and optionally a mobile number.",
          "While signed in, every call they make is linked to their account. On the phone (later), a caller is recognised by the mobile number saved in their account.",
          "At the start of each call, Noura silently looks the caller up. She greets a known customer by first name and knows the summaries of their last 5 calls and their upcoming bookings.",
          "She uses them only when they help, in her own words. She never reads a list aloud or talks about \"records\".",
        ]}
      />
      <Note>
        The account panel (<Arabic>حسابي</Arabic> / My account) shows the mobile number, the customer&apos;s bookings, and their past
        calls with a short summary of each. ElevenLabs writes the summary a little after the call ends.
      </Note>
    </Section>
  );
}

function Bookings() {
  const discounts = LONG_RENTAL_DISCOUNTS.slice()
    .reverse()
    .map((tier) => `${Math.round(tier.off * 100)}% off from ${tier.fromDays} days`)
    .join(", ");
  return (
    <Section
      id="bookings"
      title="Demo bookings"
      lead="Noura books and manages rentals like the real service. No car is really reserved and nothing is paid: in the real service the customer pays at the counter."
    >
      <Sub title="A new booking">
        <Steps
          items={[
            "Noura asks, one question at a time: the pick-up city and branch, the pick-up date and time, and the return date and time. The car goes back to the same branch unless the caller says otherwise.",
            "The car type. If the caller is not sure, she suggests two or three types with their prices.",
            "She gives the total and the number of days. Prices are demo prices, and she says so.",
            "She asks the driver's full name.",
            "She repeats everything in one sentence and books only after a clear yes.",
            "She gives the 6-digit reservation number slowly, and says what to bring to the counter: driving licence, passport or ID/iqama, and a credit card in the driver's name.",
          ]}
        />
      </Sub>
      <Sub title="An existing booking">
        <p className="mb-2">
          Noura needs the reservation number and the name on the booking. The name matches however it is spelled (Mohammed, Muhammad
          and <Arabic>محمد</Arabic> are the same). A signed-in customer&apos;s own bookings need neither: she already knows them.
        </p>
        <Table
          head={["The caller wants to…", "When it is possible"]}
          rows={[
            ["Change the dates, times, branches or car", "Before pick-up"],
            ["Keep the car longer (extend)", "Before or during the rental"],
            ["Return the car early (price recalculated on the days used)", "During the rental"],
            ["Cancel (free)", "Before pick-up"],
          ]}
        />
        <p className="mt-2 text-sm text-budget-muted">
          Before any change she says what will change and the new price, and waits for the caller&apos;s yes. A booking is upcoming,
          in progress, completed or cancelled.
        </p>
      </Sub>
      <Sub title="What is checked, like a real booking system">
        <Bullets
          items={[
            <>
              The branch exists. It can be named by its code (JED) or in words, in English or Arabic (&quot;Jeddah airport&quot;,{" "}
              <Arabic>«مطار جدة»</Arabic>). When several branches fit, Noura asks which one.
            </>,
            "The branch is open at the pick-up and return times. If not, Noura gives that day's hours and asks for another time.",
            "Times are the branch's local time, in its own time zone (Egypt and Lebanon change the clock in summer).",
            `At least ${plural(NOTICE_MS / HOUR_MS, "hour")} of notice, bookings up to ${Math.round(MAX_AHEAD_MS / (24 * HOUR_MS))} days ahead, and ${MAX_RENTAL_DAYS} days at most per rental (longer is leasing).`,
            "The car is returned in the country where it is picked up.",
            "A wrong name is refused without ever saying the real name on the booking.",
          ]}
        />
      </Sub>
      <Sub title={`${BRANCHES.length} branches in ${CITY_COUNT} cities (${AIRPORT_COUNT} at airports)`}>
        <Table
          head={["Country", "Branches", "Currency", "VAT"]}
          rows={COUNTRY_CODES.map((cc) => [
            COUNTRIES[cc].name,
            BRANCHES.filter((b) => b.country === cc).length,
            MONEY[cc].currency,
            MONEY[cc].vat ? `${Math.round(MONEY[cc].vat * 100)}%` : "none",
          ])}
        />
        <p className="mt-2 text-sm text-budget-muted">
          From budget.com (the same list as Noura&apos;s documents) and, for the UAE, budget-uae.com. Home delivery (&quot;At Your
          Door&quot;) is not bookable in the demo.
        </p>
      </Sub>
      <Sub title="Demo prices (Saudi Arabia)">
        <Table
          head={["Car type", "Example", "Seats", "Per day"]}
          rows={Object.values(CAR_TYPES).map((car) => [<b key={car.label}>{car.label}</b>, car.example, car.seats, `SAR ${car.sarPerDay}`])}
        />
        <div className="mt-3">
          <Bullets
            items={[
              `A day is 24 hours, with ${plural(GRACE_MS / HOUR_MS, "hour")} of grace before the next day starts.`,
              `Longer rentals cost less per day: ${discounts}.`,
              `Returning the car in another city adds a one-way fee of SAR ${ONE_WAY_FEE_SAR}. Then VAT is added.`,
              "In the other countries the same prices are converted to the local currency at a fixed demo rate, with that country's VAT.",
            ]}
          />
        </div>
      </Sub>
    </Section>
  );
}

function Tools() {
  return (
    <Section
      id="tools"
      title="Noura's tools"
      lead="The actions Noura can take during a call. Each one is a secure request to this website, except the two built into ElevenLabs."
    >
      <Table
        head={["Tool", "What it does", "When Noura uses it"]}
        rows={TOOLS.map((tool) => [<Code key={tool.name}>{tool.name}</Code>, tool.what, tool.when])}
      />
      <Note>
        When a request cannot go through (a closed branch, an unclear branch, a wrong name), the tool answers with what Noura should
        ask or say next, so the conversation continues naturally. If the system itself fails, she apologises and offers to try again
        or gives the reservations number 920004124.
      </Note>
    </Section>
  );
}

function Leg({ from, label, to }: { from: string; label: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-lg bg-budget-navy px-3 py-1.5 font-semibold text-white">{from}</span>
      <span className="flex items-center gap-1 text-budget-muted">
        <span className="h-0.5 w-6 bg-budget-orange" aria-hidden />
        {label}
        <span className="h-0.5 w-6 bg-budget-orange" aria-hidden />
      </span>
      <span className="rounded-lg bg-budget-sky px-3 py-1.5 font-semibold text-budget-navy">{to}</span>
    </div>
  );
}

function Handover() {
  return (
    <Section
      id="handover"
      title="Handover to a human"
      lead="Planned. When a person is needed, Noura hands the customer over to a colleague and saves a ticket."
    >
      <Sub title="When Noura hands over">
        <p>
          Accidents, breakdowns, safety incidents and billing disputes, and whenever the caller asks for a person, is upset, or Noura
          cannot help after two tries.
        </p>
      </Sub>
      <Sub title="Every handover is saved">
        <p>
          Before handing over, Noura saves a ticket: a ticket number, the reason, a short summary, the customer and their bookings, and
          the time. She tells the customer the ticket number. The conversation with Noura is also kept by ElevenLabs, with its
          transcript and summary.
        </p>
      </Sub>
      <Sub title="On the website (demo)">
        <p>
          A browser call cannot be moved to a phone. Noura saves the ticket, the page shows the transfer, and she tells the customer a
          colleague will follow up.
        </p>
      </Sub>
      <Sub title="On the phone (after the phone number)">
        <p className="mb-3">
          The customer&apos;s call and the colleague&apos;s phone are joined in a Twilio conference room. ElevenLabs does the steps
          automatically with its built-in <Code>transfer_to_number</Code> tool.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-budget-line p-4">
            <p className="mb-3 text-sm font-semibold text-budget-navy">During the call with Noura</p>
            <div className="space-y-2">
              <Leg from="Customer" label="call A" to="Twilio" />
              <Leg from="Twilio" label="audio stream" to="Noura" />
            </div>
          </div>
          <div className="rounded-xl border border-budget-orange p-4">
            <p className="mb-3 text-sm font-semibold text-budget-navy">After the handover</p>
            <div className="space-y-2">
              <Leg from="Customer" label="call A" to="Twilio room" />
              <Leg from="Employee" label="call B" to="Twilio room" />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Steps
            items={[
              "Noura tells the customer she is connecting them to a colleague.",
              "Twilio moves the customer's call into a conference room: the customer stays on the line.",
              "Twilio calls the colleague's phone from the same Twilio number (a virtual number can carry many calls at once).",
              "The colleague first hears Noura's short summary of the case, then joins the room.",
              "Noura leaves: her audio stream is closed. The customer and the colleague talk; for them it feels like one call.",
            ]}
          />
        </div>
      </Sub>
      <Sub title="Costs and setup on the phone">
        <Bullets
          items={[
            "Twilio charges both calls: the customer's (receiving or making the call, depending on who called) and the call to the colleague, plus a small conference fee per person per minute, only after a handover.",
            "ElevenLabs charges only the minutes Noura is on the call.",
            "Twilio: buy the number, add credit, and allow calls to the colleague's country. ElevenLabs: import the number, then the transfer rules and numbers, set by the project's setup script.",
            "For the demo, handovers will go to a test number chosen by NDI, not to Budget's real lines.",
          ]}
        />
      </Sub>
    </Section>
  );
}

function Security() {
  return (
    <Section id="security" title="Security and data" lead="What is protected, and what is stored.">
      <Bullets
        items={[
          "A demo only: no payment is taken, and card, ID and passport numbers are never asked for or stored.",
          "Account passwords are stored only as scrypt hashes; sign-in cookies are stored only as hashes too.",
          "The ElevenLabs key stays on the server. The browser only gets a one-use token for each call.",
          "Noura's tools accept only requests that carry Budget's secret key, kept in ElevenLabs as a secret.",
          "Data is stored in MongoDB Atlas: customers, sign-in sessions, calls linked to customers, and bookings. The project has its own database and keys, separate from other NDI projects.",
          "Search engines are asked not to index the site.",
        ]}
      />
    </Section>
  );
}

function Roadmap() {
  return (
    <Section id="roadmap" title="Next steps" lead="In order.">
      <Steps
        items={ROADMAP.map((step) => (
          <span key={step.title}>
            <b className="text-budget-navy">{step.title}.</b> {step.detail}
          </span>
        ))}
      />
    </Section>
  );
}

function Changelog() {
  return (
    <Section id="changelog" title="Changelog" lead="What changed, newest first.">
      <ol className="space-y-6 border-s-2 border-budget-line ps-5">
        {CHANGELOG.map((entry) => (
          <li key={entry.date} className="relative">
            <span className="absolute -start-[1.72rem] top-1.5 h-3 w-3 rounded-full bg-budget-orange" aria-hidden />
            <p className="font-bold text-budget-navy">{entry.date}</p>
            <div className="mt-2">
              <Bullets items={entry.items} />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
