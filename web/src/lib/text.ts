/**
 * Text matching for what callers say. Noura hears names and places in Arabic and writes them in English letters, and
 * the same name has many spellings (Mohammed, Muhammad, محمد), so matching compares a rough "sound key" of each word.
 */

/** Arabic-Indic and Persian digits to 0-9. */
export function westernDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Lower case, Western digits, no accents or Arabic vowel marks, punctuation as spaces. */
export function normaliseText(input: string): string {
  return westernDigits(input)
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "") // Latin accents, Arabic harakat, tatweel
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function words(input: string): string[] {
  const text = normaliseText(input);
  return text ? text.split(" ") : [];
}

const ARABIC_SOUNDS: Record<string, string> = {
  ب: "b", ت: "t", ث: "t", ج: "j", ح: "h", خ: "k", د: "d", ذ: "d", ر: "r", ز: "z", س: "s", ش: "s", ص: "s", ض: "d",
  ط: "t", ظ: "z", غ: "j", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h",
  // vowels and weak letters, written or not depending on the spelling
  ا: "", أ: "", إ: "", آ: "", ء: "", ؤ: "", ئ: "", ع: "", و: "", ي: "", ى: "", ة: "",
};

/**
 * The consonants of a word as they sound, so different spellings meet: Mohammed / Muhammad / محمد -> "mhmd",
 * Abdullah / Abdallah / عبدالله -> "bdl", Khaled / Khalid / خالد -> "kld".
 */
export function soundKey(word: string): string {
  let latin = "";
  for (const char of normaliseText(word).replace(/ /g, "")) latin += ARABIC_SOUNDS[char] ?? char;
  const key = latin
    .replace(/kh/g, "k")
    .replace(/gh/g, "j")
    .replace(/sh|ch/g, "s")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/ph/g, "f")
    .replace(/q|c/g, "k")
    .replace(/g/g, "j")
    .replace(/v/g, "f")
    .replace(/p/g, "b")
    .replace(/x/g, "ks")
    .replace(/[aeiouyw]/g, "")
    .replace(/(.)\1+/g, "$1"); // doubled letters
  return key.length > 1 ? key.replace(/h$/, "") : key; // Fatimah / Fatima
}

/** Name words that say nothing on their own. */
const NAME_FILLERS = new Set(["al", "el", "bin", "ibn", "bint", "bn", "ال"]);

function nameWords(name: string): string[] {
  return words(name)
    .filter((word) => !NAME_FILLERS.has(word))
    .map((word) => (word.length > 4 ? word.replace(/^(al|el|ال)/, "") : word)); // Alghamdi / Al Ghamdi / الغامدي
}

/**
 * True when a name the caller gives matches the name on a booking: one word in common (first name or family name),
 * spelled any way. Enough as a second check next to the reservation number.
 */
export function namesMatch(given: string, stored: string): boolean {
  // Each word, and each two neighbours written together: "Abdul Rahman" also gives "abdulrahman".
  const pieces = (list: string[]) => [...list, ...list.slice(1).map((word, i) => list[i] + word)];
  const a = pieces(nameWords(given));
  const b = pieces(nameWords(stored));
  const sameWord = (x: string, y: string) => x === y || (soundKey(x).length > 1 && soundKey(x) === soundKey(y));
  return a.some((x) => b.some((y) => sameWord(x, y)));
}
