/**
 * The parts of /docs that change as the project moves on. Update this file with every change to the project (a new
 * feature, a changed rule, a fix): the status, the changelog and the next steps. Numbers that come from the code
 * (branches, prices, booking rules) are read from it directly in page.tsx and need no update here.
 */

export const LAST_UPDATED = "27 September 2026";

export type Status = "live" | "planned" | "later";

export const MODULES: { name: string; status: Status; note: string; section: string }[] = [
  { name: "Knowledge base", status: "live", note: "6 PDFs and 10 Budget web pages, synced weekly", section: "knowledge" },
  { name: "Noura, the voice agent", status: "live", note: "Saudi dialect, adapts to 9 countries, English", section: "noura" },
  { name: "Website and voice call", status: "live", note: "Arabic and English, behind a password", section: "website" },
  { name: "Customer accounts and memory", status: "live", note: "Noura greets known customers by name", section: "accounts" },
  { name: "Demo bookings", status: "live", note: "Quote, book, change, extend, return early, cancel", section: "bookings" },
  { name: "Handover to a human", status: "planned", note: "Design ready: demo on the website, real transfer on the phone", section: "handover" },
  { name: "Web search on Budget's websites", status: "planned", note: "Needs an Anthropic API key for this project", section: "roadmap" },
  { name: "Phone number (Twilio)", status: "later", note: "After the website version is validated", section: "handover" },
];

export const KNOWLEDGE_PDFS = [
  { name: "Arab region overview", content: "Budget operators, contacts and emergency numbers in each of the 9 countries" },
  { name: "Budget Saudi: company, contacts and services", content: "Loyalty programme, Quick Pass, chauffeur, leasing, used cars, current offers" },
  { name: "Saudi rental rules", content: "Documents, age, Tajeer contract, fuel, damage, fines, extensions, early returns, cancellations, accidents" },
  { name: "Saudi branches", content: "88 branches in 31 cities with address, phone and opening hours" },
  { name: "The other 8 countries", content: "Contacts, Qatar's published rules, and 55 branches" },
  { name: "Frequently asked questions", content: "29 short questions and answers" },
];

export const KNOWLEDGE_PAGES = [
  "Budget Saudi: contact numbers",
  "Budget Saudi: loyalty programme",
  "Budget Saudi: Quick Pass",
  "Offer: Unlimited Miles",
  "Offer: AlUla visitors",
  "Offer: Royal Commission for AlUla",
  "Car with driver: terms",
  "Offer: Explore the UAE",
  "Budget UAE: contact",
  "Budget UAE: locations",
];

export const TOOLS: { name: string; what: string; when: string }[] = [
  { name: "customer_lookup", what: "Recognises the caller: name, upcoming bookings, summaries of the last 5 calls", when: "Silently, at the start of every call" },
  { name: "get_price_quote", what: "Demo price of a rental, for one car type or all of them; checks the branch and its hours", when: "Before every new booking, or when asked a price" },
  { name: "create_booking", what: "Makes a demo reservation and returns its 6-digit number", when: "After the caller confirmed every detail" },
  { name: "find_booking", what: "Finds a reservation, or lists a known customer's own bookings", when: "Before any change to an existing booking" },
  { name: "change_booking", what: "New dates, times, branches or car type", when: "Before pick-up, after the caller confirmed" },
  { name: "extend_rental", what: "Moves the return later, with the extra cost", when: "Before or during the rental" },
  { name: "early_return", what: "Returns the car early; the price is recalculated on the days used", when: "During the rental" },
  { name: "cancel_booking", what: "Cancels for free (pay at the counter)", when: "Before pick-up, after the caller confirmed" },
  { name: "language_detection", what: "Switches between Arabic and English (built into ElevenLabs)", when: "As soon as the caller changes language" },
  { name: "end_call", what: "Ends the call (built into ElevenLabs)", when: "When the caller is done, or the line stays silent" },
];

export const ROADMAP: { title: string; detail: string }[] = [
  {
    title: "Handover to a human",
    detail:
      "Website: Noura saves a ticket (reason, summary, customer) and the page shows the transfer. Phone: a real transfer " +
      "with ElevenLabs' transfer_to_number once the Twilio number exists.",
  },
  {
    title: "Web search on Budget's websites",
    detail: "Noura checks budgetsaudi.com, budget-uae.com and the country sites during a call, for anything not in her documents.",
  },
  { title: "Phone number", detail: "A Twilio number imported into ElevenLabs, after the website version is validated." },
  { title: "Optional: agent authentication", detail: "Only calls started from the demo site would be accepted, to protect the credits." },
];

export const CHANGELOG: { date: string; items: string[] }[] = [
  {
    date: "27 September 2026",
    items: [
      "Project docs page (this page).",
      "Voice model changed to Eleven v3 Conversational with expressive mode, chosen after a test call: more natural delivery, same price.",
      "English calls fixed. The English setting used a voice model ElevenLabs does not allow for English, so a call started in English stayed silent. Noura now also answers in English from the caller's first English sentence.",
      "Demo bookings: 7 booking tools, 140 branches in 9 countries, demo prices, and «حجوزاتي» / My bookings in the account panel.",
      "Website live on Vercel, and the memory tool connected: Noura greets signed-in customers by name and remembers their earlier calls.",
    ],
  },
  {
    date: "25 – 26 September 2026",
    items: [
      "Research of Budget's public websites in the 9 countries, and the knowledge base built from it.",
      "Noura created: Saudi persona from Jeddah, the voice Amal, dialect adaptation, English, and the escalation rules.",
      "Website with the voice call, customer accounts and call memory, built and tested locally.",
    ],
  },
];
