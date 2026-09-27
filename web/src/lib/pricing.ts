import type { Branch, CountryCode } from "./branches";

/**
 * Demo prices. Budget publishes no prices, so these are made up for the demo (plausible 2026 Gulf rates) and Noura
 * says so. A rate is per started 24 hours; longer rentals get a lower daily rate, as weekly and monthly rates do.
 */

export const CAR_TYPES = {
  economy: { label: "Economy", sarPerDay: 120, example: "Hyundai Accent or similar", seats: 5 },
  compact: { label: "Compact", sarPerDay: 150, example: "Toyota Corolla or similar", seats: 5 },
  family_sedan: { label: "Family sedan", sarPerDay: 190, example: "Toyota Camry or similar", seats: 5 },
  suv: { label: "SUV", sarPerDay: 280, example: "Hyundai Tucson or similar", seats: 5 },
  van: { label: "Van", sarPerDay: 330, example: "Hyundai Staria or similar", seats: 9 },
  luxury: { label: "Luxury", sarPerDay: 600, example: "Mercedes-Benz E-Class or similar", seats: 5 },
} as const;

export type CarType = keyof typeof CAR_TYPES;

export function isCarType(value: unknown): value is CarType {
  return typeof value === "string" && Object.hasOwn(CAR_TYPES, value);
}

/** Each country's currency and VAT. Prices are the Saudi ones converted at a fixed demo rate, rounded to `step`. */
const MONEY: Record<CountryCode, { currency: string; perSar: number; step: number; decimals: number; vat: number }> = {
  SA: { currency: "SAR", perSar: 1, step: 1, decimals: 2, vat: 0.15 },
  AE: { currency: "AED", perSar: 0.98, step: 1, decimals: 2, vat: 0.05 },
  KW: { currency: "KWD", perSar: 0.082, step: 0.5, decimals: 3, vat: 0 },
  QA: { currency: "QAR", perSar: 0.97, step: 1, decimals: 2, vat: 0 },
  BH: { currency: "BHD", perSar: 0.1, step: 0.5, decimals: 3, vat: 0.1 },
  OM: { currency: "OMR", perSar: 0.1026, step: 0.5, decimals: 3, vat: 0.05 },
  JO: { currency: "JOD", perSar: 0.189, step: 0.5, decimals: 3, vat: 0.16 },
  EG: { currency: "EGP", perSar: 12.9, step: 10, decimals: 2, vat: 0.14 },
  LB: { currency: "USD", perSar: 0.2667, step: 1, decimals: 2, vat: 0.11 },
};

/** Returning the car in another city (same country). */
const ONE_WAY_FEE_SAR = 250;
/** Longest demo rental; longer needs are leasing. */
export const MAX_RENTAL_DAYS = 60;
const HOUR_MS = 60 * 60 * 1000;
/** A rental day is 24 hours, with one hour of grace before another day starts. */
const GRACE_MS = HOUR_MS;

/** Lower daily rates for longer rentals: 15% off from 7 days (weekly), 30% off from 28 days (monthly). */
function discountFor(days: number): number {
  if (days >= 28) return 0.3;
  if (days >= 7) return 0.15;
  return 0;
}

export function rentalDays(pickupAt: Date, returnAt: Date): number {
  return Math.max(1, Math.ceil((returnAt.getTime() - pickupAt.getTime() - GRACE_MS) / (24 * HOUR_MS)));
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

function money(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type PriceQuote = {
  currency: string;
  days: number;
  daily_rate: number;
  discount_percent: number;
  rental_amount: number;
  one_way_fee: number;
  vat_percent: number;
  vat: number;
  total: number;
};

export function quote(carType: CarType, pickup: Branch, dropoff: Branch, pickupAt: Date, returnAt: Date): PriceQuote {
  const m = MONEY[pickup.country];
  const days = rentalDays(pickupAt, returnAt);
  const discount = discountFor(days);
  const dailyRate = roundTo(CAR_TYPES[carType].sarPerDay * m.perSar, m.step);
  const rental = money(dailyRate * days * (1 - discount), m.decimals);
  const oneWay = dropoff.city === pickup.city ? 0 : roundTo(ONE_WAY_FEE_SAR * m.perSar, m.step);
  const vat = money((rental + oneWay) * m.vat, m.decimals);
  return {
    currency: m.currency,
    days,
    daily_rate: dailyRate,
    discount_percent: Math.round(discount * 100),
    rental_amount: rental,
    one_way_fee: oneWay,
    vat_percent: Math.round(m.vat * 100),
    vat,
    total: money(rental + oneWay + vat, m.decimals),
  };
}
