import data from "@/data/branches.json";
import { localParts, minutesText } from "./localTime";
import { normaliseText, soundKey, words } from "./text";

/**
 * The Budget locations a demo booking can use, exported from the research data by knowledge_base/export_branches.py
 * (same names and hours as Noura's knowledge base).
 */

export type CountryCode = "SA" | "AE" | "KW" | "QA" | "BH" | "OM" | "JO" | "EG" | "LB";

export type Branch = {
  code: string;
  codes: string[];
  country: CountryCode;
  city: string;
  name: string;
  kind: string;
  /** Opening hours as published, e.g. "Sun - Thu 8:30 AM - 11:00 PM; Fri 4:30 PM - 11:00 PM". */
  hours: string;
  /** Per day (0 = Sunday) the [open, close] minutes after midnight; a close above 1440 runs past midnight. null = not published. */
  schedule: number[][][] | null;
  phone: string;
};

export const BRANCHES = data.branches as Branch[];

export const COUNTRIES: Record<CountryCode, { name: string; timeZone: string }> = {
  SA: { name: "Saudi Arabia", timeZone: "Asia/Riyadh" },
  AE: { name: "United Arab Emirates", timeZone: "Asia/Dubai" },
  KW: { name: "Kuwait", timeZone: "Asia/Kuwait" },
  QA: { name: "Qatar", timeZone: "Asia/Qatar" },
  BH: { name: "Bahrain", timeZone: "Asia/Bahrain" },
  OM: { name: "Oman", timeZone: "Asia/Muscat" },
  JO: { name: "Jordan", timeZone: "Asia/Amman" },
  EG: { name: "Egypt", timeZone: "Africa/Cairo" },
  LB: { name: "Lebanon", timeZone: "Asia/Beirut" },
};

export function timeZoneOf(branch: Branch): string {
  return COUNTRIES[branch.country].timeZone;
}

// ---------------------------------------------------------------- cities

/** A place name without spaces, accents or a leading "Al": "Al-Khobar" and "alkhobar" both give "khobar". */
function placeKey(input: string): string {
  return words(input)
    .map((word) => word.replace(/^(al|el|ال)(?=\p{L}{3})/u, ""))
    .filter((word) => !["al", "el", "city", "مدينة"].includes(word))
    .join("");
}

/** Other names callers use for the cities in the list, in English and Arabic. */
const CITY_ALIASES: Record<string, string[]> = {
  Makkah: ["Mecca", "Makka", "Macca", "مكة", "مكه", "مكة المكرمة"],
  Madinah: ["Medina", "Madina", "Medinah", "Madinah Munawarah", "المدينة", "المدينة المنورة"],
  Jeddah: ["Jedda", "Jidda", "Jiddah", "Jeddah City", "جدة", "جده"],
  Riyadh: ["Riyad", "Ar Riyadh", "الرياض"],
  Dammam: ["Damam", "الدمام"],
  "Al Khobar": ["Khobar", "Kobar", "الخبر"],
  Taif: ["Al Taif", "Ta'if", "الطائف", "الطايف"],
  Abha: ["أبها", "ابها"],
  Tabuk: ["Tabouk", "تبوك"],
  Jizan: ["Jazan", "Gizan", "Gazan", "جازان", "جيزان"],
  "Al Hasa": ["Al Ahsa", "Ahsa", "Hasa", "Hofuf", "Al Hofuf", "الأحساء", "الاحساء", "الهفوف"],
  "Al Jubail": ["Jubail", "Jubail Industrial City", "الجبيل"],
  Yanbu: ["Yanbo", "ينبع"],
  Buraidah: ["Buraydah", "Buraida", "Qassim", "Al Qassim", "Gassim", "بريدة", "القصيم"],
  Hail: ["Ha'il", "حائل", "حايل"],
  Najran: ["نجران"],
  "Al Baha": ["Baha", "Baljurashi", "الباحة"],
  "Al Jouf": ["Jouf", "Al Jawf", "Sakaka", "الجوف", "سكاكا"],
  Arar: ["عرعر"],
  "Khamis Mushait": ["Khamis Mushayt", "Khamis", "خميس مشيط"],
  "Al Kharj": ["Kharj", "الخرج"],
  "Al Qatif": ["Qatif", "القطيف"],
  "Al Wajh": ["Wajh", "الوجه"],
  Rabigh: ["رابغ"],
  Qunfudah: ["Al Qunfudhah", "Qunfudhah", "القنفذة"],
  Bisha: ["بيشة"],
  Turaif: ["طريف"],
  Umluj: ["Umm Lajj", "أملج", "املج"],
  "Hafr Al Batin": ["Hafar Al Batin", "حفر الباطن"],
  "Al Qaisumah": ["Qaisumah", "Al Qaysumah", "القيصومة"],
  "Muhayil Aseer": ["Muhayil", "Muhayil Asir", "محايل", "محايل عسير"],
  Dubai: ["دبي"],
  "Abu Dhabi": ["Abudhabi", "أبوظبي", "ابوظبي", "أبو ظبي", "ابو ظبي"],
  Sharjah: ["الشارقة"],
  "Ras Al Khaimah": ["RAK", "رأس الخيمة", "راس الخيمة"],
  "Kuwait City": ["Kuwait", "Safat", "الكويت"],
  Doha: ["Qatar", "الدوحة", "قطر"],
  Manama: ["المنامة"],
  "Diyar Al Muharraq": ["Muharraq", "المحرق", "ديار المحرق"],
  Amwaj: ["أمواج", "امواج"],
  Juffair: ["الجفير"],
  Seef: ["السيف"],
  Sitra: ["سترة"],
  Sanabis: ["السنابس"],
  Muscat: ["مسقط"],
  Salalah: ["صلالة"],
  Sohar: ["صحار"],
  Sur: ["صور"],
  Duqm: ["الدقم"],
  Amman: ["عمان", "عمّان"],
  Aqaba: ["العقبة"],
  Cairo: ["القاهرة"],
  Giza: ["الجيزة"],
  Alexandria: ["Alex", "الإسكندرية", "الاسكندرية", "اسكندرية"],
  Hurghada: ["الغردقة"],
  "Sharm El Sheikh": ["Sharm", "شرم الشيخ"],
  "El Alamein": ["Alamein", "العلمين"],
  Beirut: ["بيروت"],
  "Sin El Fil": ["سن الفيل"],
};

/** A whole country said where a city is expected: every branch in it is a candidate. */
const COUNTRY_ALIASES = new Map<string, CountryCode>(
  (
    [
      ["SA", ["Saudi Arabia", "Saudi", "KSA", "السعودية"]],
      ["AE", ["UAE", "United Arab Emirates", "Emirates", "الإمارات", "الامارات"]],
      ["BH", ["Bahrain", "البحرين"]],
      ["OM", ["Oman", "سلطنة عمان"]],
      ["JO", ["Jordan", "الأردن", "الاردن"]],
      ["EG", ["Egypt", "مصر"]],
      ["LB", ["Lebanon", "لبنان"]],
    ] as [CountryCode, string[]][]
  ).flatMap(([code, names]) => names.map((name): [string, CountryCode] => [placeKey(name), code])),
);

const CITY_BY_KEY = new Map<string, string>();
for (const branch of BRANCHES) CITY_BY_KEY.set(placeKey(branch.city), branch.city);
for (const [city, aliases] of Object.entries(CITY_ALIASES)) for (const alias of aliases) CITY_BY_KEY.set(placeKey(alias), city);

/** The city as the list spells it, or null. Close spellings count when only one city sounds like it. */
export function resolveCity(input: string): string | null {
  const key = placeKey(input);
  if (!key) return null;
  const exact = CITY_BY_KEY.get(key);
  if (exact) return exact;
  const sound = soundKey(key);
  if (sound.length < 3) return null;
  const close = new Set([...CITY_BY_KEY].filter(([k]) => soundKey(k) === sound).map(([, city]) => city));
  return close.size === 1 ? [...close][0] : null;
}

// ---------------------------------------------------------------- branches

/** Words in a branch description that do not tell branches apart. */
const FILLER = new Set([
  "budget", "branch", "office", "location", "the", "al", "el", "in", "at", "of", "near", "rent", "car", "a", "street", "st",
  "road", "rd", "fr", "فرع", "في", "بدجت", "شارع", "طريق", "مكتب",
]);
/** Same meaning, one word (Arabic words without their "ال"). */
const SYNONYMS = new Map(
  Object.entries({
    مطار: "airport", apt: "airport", intl: "international", int: "international", دولي: "international",
    قطار: "train", محطة: "station", railway: "train", rail: "train", haramain: "train", حرمين: "train",
    فندق: "hotel", مول: "mall", صالة: "terminal",
  }),
);
/** Extra words for well-known places whose everyday name is not in the branch's own name. */
const EXTRA_WORDS: Record<string, string> = {
  RUH: "king khalid", C07: "king khalid", DMM: "king fahd", MED: "prince mohammad bin abdulaziz", ELQ: "qassim",
};

function branchWords(text: string): string[] {
  const prepared = normaliseText(text)
    .replace(/\bairport (road|rd)\b/g, "airportroad") // "Jizan Airport Road" is a street, not the airport
    .replace(/\b(?:terminal|t) ?(\d)\b/g, "t$1") // "Terminal 1" = "T1"
    .replace(/(^| )صالة ?(\d)(?= |$)/g, "$1t$2");
  return prepared
    .split(" ")
    .filter(Boolean)
    .map((word) => word.replace(/^(al|el|ال)(?=\p{L}{3})/u, "")) // "Alfaysaliyah" = "Al Faysaliyah", "المطار" = "مطار"
    .map((word) => SYNONYMS.get(word) ?? word)
    .filter((word) => !FILLER.has(word));
}

/** A location code with only its letters and digits: "AE-DXB-T1" -> "AEDXBT1". */
function codeKey(input: string): string {
  return normaliseText(input).replace(/[^a-z0-9]/g, "").toUpperCase();
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  // "Salam" / "Salamah", but not "airport" / "airportroad"
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.length - short.length <= 3 && long.startsWith(short)) return true;
  const key = soundKey(a);
  return key.length >= 3 && key === soundKey(b);
}

const WORDS_BY_CODE = new Map(
  BRANCHES.map((b) => [b.code, branchWords(`${b.name} ${b.kind} ${b.codes.join(" ")} ${EXTRA_WORDS[b.code] ?? ""}`)]),
);

export type BranchOption = { code: string; name: string; city: string; kind: string; hours: string };

export function branchOption(branch: Branch): BranchOption {
  return { code: branch.code, name: branch.name, city: branch.city, kind: branch.kind, hours: branch.hours };
}

export type BranchSearch =
  | { ok: true; branch: Branch }
  | { ok: false; error: "unknown_city"; city: string }
  | { ok: false; error: "branch_not_clear" | "branch_not_found"; city: string | null; options: BranchOption[] };

const MAX_OPTIONS = 8;

/**
 * Finds the branch a caller means: a location code ("JED"), or words from its name ("Jeddah airport", "Tahlia
 * Street") within the city. When several fit equally, or none, the answer lists the options to ask about.
 */
export function findBranch(query: string, cityInput?: string, country?: CountryCode): BranchSearch {
  const asCode = codeKey(query);
  const byCode = asCode ? BRANCHES.find((b) => b.codes.some((code) => codeKey(code) === asCode)) : undefined;
  if (byCode) return { ok: true, branch: byCode };

  let candidates = country ? BRANCHES.filter((b) => b.country === country) : BRANCHES;
  let city: string | null = null;
  const cityText = cityInput?.trim() ?? "";
  if (cityText) {
    const countryCode = COUNTRY_ALIASES.get(placeKey(cityText));
    city = countryCode ? null : resolveCity(cityText);
    if (countryCode) candidates = candidates.filter((b) => b.country === countryCode);
    else if (city) candidates = candidates.filter((b) => b.city === city);
    else return { ok: false, error: "unknown_city", city: cityText };
  } else {
    // "Jeddah airport" with no city: the city may be in the words themselves.
    const found = words(query)
      .map((word, i, all) => resolveCity(word) ?? (all[i + 1] ? resolveCity(`${word} ${all[i + 1]}`) : null))
      .find(Boolean);
    if (found) {
      city = found;
      candidates = candidates.filter((b) => b.city === city);
    }
  }
  if (candidates.length === 0) return { ok: false, error: "branch_not_found", city, options: [] };

  const cityWords = new Set(city ? branchWords(city) : []);
  const wanted = branchWords(query).filter((word) => !cityWords.has(word) && !(city && resolveCity(word) === city));
  const scored = candidates.map((branch) => ({
    branch,
    score: wanted.filter((word) => WORDS_BY_CODE.get(branch.code)!.some((own) => sameWord(word, own))).length,
  }));
  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best).map((s) => s.branch);

  if (best === 0) {
    if (candidates.length === 1) return { ok: true, branch: candidates[0] };
    const error = wanted.length === 0 ? "branch_not_clear" : "branch_not_found";
    return { ok: false, error, city, options: candidates.slice(0, MAX_OPTIONS).map(branchOption) };
  }
  if (top.length === 1) return { ok: true, branch: top[0] };
  return { ok: false, error: "branch_not_clear", city, options: top.slice(0, MAX_OPTIONS).map(branchOption) };
}

// ---------------------------------------------------------------- opening hours

/** True when the branch is open at that moment (always true when its hours are not published). */
export function isOpenAt(branch: Branch, at: Date): boolean {
  if (!branch.schedule) return true;
  const { weekday, minutes } = localParts(at, timeZoneOf(branch));
  const today = branch.schedule[weekday] ?? [];
  const yesterday = branch.schedule[(weekday + 6) % 7] ?? [];
  return (
    today.some(([open, close]) => open <= minutes && minutes < close) ||
    yesterday.some(([, close]) => close > 1440 && minutes + 1440 < close)
  );
}

/** The opening hours on the day of that moment, e.g. "16:30-23:00" or "closed". */
export function hoursOnDay(branch: Branch, at: Date): string {
  if (!branch.schedule) return "not published";
  const spans = branch.schedule[localParts(at, timeZoneOf(branch)).weekday] ?? [];
  if (spans.length === 0) return "closed";
  if (spans.length === 1 && spans[0][0] === 0 && spans[0][1] === 1440) return "open 24 hours";
  return spans.map(([open, close]) => `${minutesText(open)}-${minutesText(close)}`).join(" and ");
}
