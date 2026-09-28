/** Arabic-Indic and Persian digits. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/** Eleven v3 audio tags such as [happy] or [laughs]: they steer Noura's voice and are not meant to be read. */
const AUDIO_TAG = /\s*\[[a-z][a-z' -]{0,30}\]\s*/gi;

/**
 * Single digits with spaces, commas or dashes between them. Noura writes phone and reservation numbers this way
 * ("9 2 0، 0 0 4، 1 2 4") so the voice reads them digit by digit.
 */
const SPACED_DIGITS = /(?<!\d|\d\.)\d(?!\d|\.\d)(?:[  ]*[,،-]?[  ]*\d(?!\d|\.\d))+/g; // "3 4.5" is not a digit run

/**
 * Text as the transcript shows it: numbers in 0-9, a number Noura spelled out digit by digit shown whole
 * (920004124), and no voice tags.
 */
export function transcriptText(text: string): string {
  return text
    .replace(EASTERN_DIGITS, (d) => {
      const code = d.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(AUDIO_TAG, " ")
    .replace(SPACED_DIGITS, (run) => {
      const digits = run.replace(/\D/g, "");
      return digits.length >= 4 ? digits : run; // "1، 2، 3" stays a short list
    })
    .replace(/[  ]{2,}/g, " ")
    .trim();
}
