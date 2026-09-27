import { randomInt } from "node:crypto";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import {
  BRANCHES,
  COUNTRIES,
  findBranch,
  hoursOnDay,
  isOpenAt,
  timeZoneOf,
  type Branch,
  type CountryCode,
} from "./branches";
import { describeLocal, localParts, parseDate, parseTime, zonedToUtc } from "./localTime";
import { collections, type BookingAction, type BookingDoc, type BookingStop, type CustomerDoc } from "./mongo";
import { CAR_TYPES, MAX_RENTAL_DAYS, isCarType, quote, rentalDays, type CarType } from "./pricing";
import { namesMatch, normaliseText, westernDigits } from "./text";

/**
 * Demo reservations behind Noura's booking tools: price quotes, new bookings, and finding, changing, extending,
 * returning early and cancelling. Everything is checked like a real booking system would (branch, opening hours,
 * dates, notice, length, country), and every refusal says what Noura should ask the caller next.
 */

/** Who is calling: their conversation, and their account when the website or their phone number identified them. */
export type Caller = { conversationId: string | null; customer: CustomerDoc | null };

/** The tool's raw arguments, as ElevenLabs sends them. */
export type ToolInput = Record<string, unknown>;

/** A request Noura has to fix with the caller: `error` says what, `message` tells her what to do. Not a failure. */
export class BookingProblem extends Error {
  constructor(
    public readonly error: string,
    public readonly guidance: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(error);
  }

  toJSON() {
    return { ok: false, error: this.error, message: this.guidance, ...this.extra };
  }
}

function fail(error: string, message: string, extra: Record<string, unknown> = {}): never {
  throw new BookingProblem(error, message, extra);
}

function text(input: ToolInput, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/** A pick-up must be booked at least this long ahead. */
const NOTICE_MS = 60 * 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
/** An early return a few minutes in the past means "now". */
const NOW_TOLERANCE_MS = 15 * 60 * 1000;

export const DEMO_PRICE_NOTE =
  "Demo price: Budget publishes no prices, so these are made-up demo prices. Say so the first time you give a price.";
const DEMO_BOOKING_NOTE =
  "Demo booking: no car is really reserved and nothing is charged. In the real service the customer pays at the counter.";
const BRING_TO_COUNTER =
  "Driving licence, passport or national ID / iqama, and a credit card in the driver's name. The reservation number helps.";

// ---------------------------------------------------------------- branches and times

function branchOf(stop: BookingStop, country: CountryCode): Branch {
  return (
    BRANCHES.find((b) => b.code === stop.code) ?? {
      code: stop.code,
      codes: [stop.code],
      country,
      city: stop.city,
      name: stop.name,
      kind: "City branch",
      hours: "not published",
      schedule: null,
      phone: "",
    }
  );
}

function resolveBranch(which: "pick-up" | "return", query: string, city: string): Branch {
  const found = findBranch(query || city, city || undefined);
  if (found.ok) return found.branch;
  if (found.error === "unknown_city") {
    fail("unknown_city", `There is no Budget branch in "${found.city}" in the booking system. Ask the caller for the nearest city with a Budget branch.`, {
      which,
    });
  }
  const where = found.city ? ` in ${found.city}` : "";
  if (found.error === "branch_not_clear") {
    fail("branch_not_clear", `Several ${which} branches${where} fit. Ask the caller which one they mean (say the names, never the codes).`, {
      which,
      options: found.options,
    });
  }
  fail("branch_not_found", `No ${which} branch${where} matches "${query}". Ask the caller to describe it again, or offer the options.`, {
    which,
    options: found.options,
  });
}

function stopView(branch: Branch, at: Date) {
  return { branch: branch.name, city: branch.city, time: describeLocal(at, timeZoneOf(branch)), hours_that_day: hoursOnDay(branch, at) };
}

function checkOpen(which: "pick-up" | "return", branch: Branch, at: Date) {
  if (isOpenAt(branch, at)) return;
  fail(
    "branch_closed",
    `The ${which} branch is closed at ${describeLocal(at, timeZoneOf(branch))}. Tell the caller its hours that day and ask for another time.`,
    { which, branch: branch.name, hours_that_day: hoursOnDay(branch, at), opening_hours: branch.hours },
  );
}

type Trip = { pickup: Branch; dropoff: Branch; pickupAt: Date; returnAt: Date };

/**
 * The branches and times of a rental, checked. With `base` (a change to a booking) anything not given keeps the
 * booking's value; when only the pick-up moves, the rental keeps its length.
 */
export function planTrip(input: ToolInput, base: BookingDoc | null, now = new Date()): Trip {
  const given = (key: string) => text(input, key) !== "";
  if (!base) {
    const missing = [
      !given("pickup_branch") && !given("pickup_city") && "pick-up branch",
      !given("pickup_date") && "pick-up date",
      !given("pickup_time") && "pick-up time",
      !given("return_date") && "return date",
    ].filter(Boolean);
    if (missing.length) fail("missing_details", `Ask the caller for: ${missing.join(", ")}.`, { missing });
  }

  const pickupMoved = given("pickup_branch") || given("pickup_city");
  const pickup = pickupMoved
    ? resolveBranch("pick-up", text(input, "pickup_branch"), text(input, "pickup_city"))
    : branchOf(base!.pickup, base!.country);

  let dropoff: Branch;
  if (given("return_branch") || given("return_city")) {
    dropoff = resolveBranch("return", text(input, "return_branch"), text(input, "return_city"));
  } else if (!base || base.dropoff.code === base.pickup.code) {
    dropoff = pickup; // returned where it was picked up
  } else {
    dropoff = branchOf(base.dropoff, base.country);
  }
  if (dropoff.country !== pickup.country) {
    fail("different_country", "The car must be returned in the country where it is picked up. Cross-border rentals are arranged by the reservations team.", {
      pickup_country: COUNTRIES[pickup.country].name,
      return_country: COUNTRIES[dropoff.country].name,
    });
  }

  const readDate = (key: string, which: string) =>
    parseDate(text(input, key)) ?? fail("invalid_date", `The ${which} date must be written YYYY-MM-DD, for example 2026-10-02.`);
  const readTime = (key: string, which: string) =>
    parseTime(text(input, key)) ?? fail("invalid_time", `The ${which} time must be written HH:MM in 24-hour time, for example 14:30.`);

  const oldPickup = base ? localParts(base.pickup.at, COUNTRIES[base.country].timeZone) : null;
  const pickupDate = given("pickup_date") ? readDate("pickup_date", "pick-up") : oldPickup!;
  const pickupMinutes = given("pickup_time") ? readTime("pickup_time", "pick-up") : oldPickup!.minutes;
  const pickupAt = zonedToUtc(pickupDate, pickupMinutes, timeZoneOf(pickup));

  let returnAt: Date;
  if (!base || given("return_date") || given("return_time")) {
    const oldReturn = base ? localParts(base.dropoff.at, COUNTRIES[base.country].timeZone) : null;
    const returnDate = given("return_date") ? readDate("return_date", "return") : oldReturn!;
    const returnMinutes = given("return_time") ? readTime("return_time", "return") : (oldReturn?.minutes ?? pickupMinutes);
    returnAt = zonedToUtc(returnDate, returnMinutes, timeZoneOf(dropoff));
  } else {
    returnAt = new Date(pickupAt.getTime() + (base.dropoff.at.getTime() - base.pickup.at.getTime()));
  }

  const pickupChanged = !base || pickup.code !== base.pickup.code || pickupAt.getTime() !== base.pickup.at.getTime();
  const returnChanged = !base || dropoff.code !== base.dropoff.code || returnAt.getTime() !== base.dropoff.at.getTime();
  const nowAtBranch = describeLocal(now, timeZoneOf(pickup));
  if (pickupChanged && pickupAt.getTime() < now.getTime()) {
    fail("pickup_in_past", `That pick-up time has already passed. It is now ${nowAtBranch} at the branch.`, { pickup: stopView(pickup, pickupAt) });
  }
  if (pickupChanged && pickupAt.getTime() < now.getTime() + NOTICE_MS) {
    fail("pickup_too_soon", `A pick-up must be booked at least one hour ahead. It is now ${nowAtBranch} at the branch.`, {
      pickup: stopView(pickup, pickupAt),
    });
  }
  if (pickupAt.getTime() > now.getTime() + MAX_AHEAD_MS) {
    fail("pickup_too_far", "Bookings open up to one year ahead. Ask for an earlier date.");
  }
  if (returnAt.getTime() <= pickupAt.getTime()) {
    fail("return_before_pickup", "The return must be after the pick-up. Check both dates and times with the caller.", {
      pickup: stopView(pickup, pickupAt),
      return: stopView(dropoff, returnAt),
    });
  }
  if (rentalDays(pickupAt, returnAt) > MAX_RENTAL_DAYS) {
    fail("too_long", `A rental can last at most ${MAX_RENTAL_DAYS} days. For longer, Budget offers monthly leasing: give the reservations or leasing contact.`);
  }
  if (pickupChanged) checkOpen("pick-up", pickup, pickupAt);
  if (returnChanged) checkOpen("return", dropoff, returnAt);
  return { pickup, dropoff, pickupAt, returnAt };
}

// ---------------------------------------------------------------- car types and names

const CAR_TYPE_WORDS: Record<string, CarType> = {
  economy: "economy", small: "economy", cheap: "economy", cheapest: "economy", اقتصادية: "economy", اقتصادي: "economy",
  compact: "compact", صغيرة: "compact",
  family_sedan: "family_sedan", family: "family_sedan", sedan: "family_sedan", standard: "family_sedan", intermediate: "family_sedan",
  midsize: "family_sedan", عائلية: "family_sedan", سيدان: "family_sedan",
  suv: "suv", "4x4": "suv", jeep: "suv", crossover: "suv", دفع_رباعي: "suv", جيب: "suv",
  van: "van", minivan: "van", bus: "van", people_carrier: "van", "7_seater": "van", "9_seater": "van", فان: "van", باص: "van",
  luxury: "luxury", premium: "luxury", فخمة: "luxury", فاخرة: "luxury",
};

function carTypeWord(word: string): CarType | undefined {
  return Object.hasOwn(CAR_TYPE_WORDS, word) ? CAR_TYPE_WORDS[word] : undefined;
}

function carTypeFrom(input: ToolInput): CarType | null {
  const raw = text(input, "car_type");
  if (!raw) return null;
  const key = normaliseText(raw).replace(/ /g, "_").replace(/^ال/, "");
  const type = isCarType(key) ? key : (carTypeWord(key) ?? key.split("_").map(carTypeWord).find(Boolean));
  return type ?? fail("invalid_car_type", `Unknown car type "${raw}". The types are: ${Object.keys(CAR_TYPES).join(", ")}.`);
}

function requireCarType(input: ToolInput): CarType {
  return carTypeFrom(input) ?? fail("missing_details", "Ask the caller which car type they want.", { missing: ["car type"] });
}

/** "ahmed  al-ghamdi" -> "Ahmed Al-Ghamdi". Arabic letters stay as they are. */
function cleanName(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{M}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/(^|[\s-])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

// ---------------------------------------------------------------- what Noura hears back

type BookingState = "upcoming" | "in_progress" | "completed" | "cancelled";

export function bookingState(booking: BookingDoc, now = new Date()): BookingState {
  if (booking.status === "cancelled") return "cancelled";
  if (now.getTime() < booking.pickup.at.getTime()) return "upcoming";
  if (now.getTime() < booking.dropoff.at.getTime()) return "in_progress";
  return "completed";
}

const NEXT_STEPS: Record<BookingState, string[]> = {
  upcoming: ["change_booking", "extend_rental", "cancel_booking"],
  in_progress: ["extend_rental", "early_return"],
  completed: [],
  cancelled: [],
};

export function bookingView(booking: BookingDoc, now = new Date()) {
  const timeZone = COUNTRIES[booking.country].timeZone;
  const state = bookingState(booking, now);
  return {
    reservation_number: booking.reservationNumber,
    status: state,
    driver_name: booking.driverName,
    car_type: booking.carType,
    car: CAR_TYPES[booking.carType].example,
    pickup: { branch: booking.pickup.name, city: booking.pickup.city, time: describeLocal(booking.pickup.at, timeZone) },
    return: { branch: booking.dropoff.name, city: booking.dropoff.city, time: describeLocal(booking.dropoff.at, timeZone) },
    price: booking.price,
    ...(booking.earlyReturnFrom ? { returned_early: true, first_agreed_return: describeLocal(booking.earlyReturnFrom, timeZone) } : {}),
    possible_actions: NEXT_STEPS[state],
  };
}

function tripView(trip: Trip) {
  return {
    pickup: stopView(trip.pickup, trip.pickupAt),
    return: stopView(trip.dropoff, trip.returnAt),
    country: COUNTRIES[trip.pickup.country].name,
  };
}

function stop(branch: Branch, at: Date): BookingStop {
  return { code: branch.code, name: branch.name, city: branch.city, at };
}

// ---------------------------------------------------------------- finding a booking

function reservationNumberFrom(input: ToolInput): string {
  const digits = westernDigits(text(input, "reservation_number")).replace(/\D/g, "");
  if (!digits) fail("missing_details", "Ask the caller for their reservation number.", { missing: ["reservation number"] });
  if (digits.length !== 6) {
    fail("invalid_reservation_number", `Reservation numbers have 6 digits; "${digits}" has ${digits.length}. Ask the caller to repeat it slowly.`);
  }
  return digits;
}

function isOwnBooking(booking: BookingDoc, caller: Caller): boolean {
  return Boolean(booking.customerId && caller.customer && booking.customerId.equals(caller.customer._id));
}

/** The booking, once the caller has shown it is theirs: the name on it, or it belongs to their account. */
async function bookingFor(input: ToolInput, caller: Caller): Promise<BookingDoc> {
  const reservationNumber = reservationNumberFrom(input);
  const { bookings } = await collections();
  const booking = await bookings.findOne({ reservationNumber });
  if (!booking) {
    fail("not_found", `There is no booking ${reservationNumber}. Read the number back to the caller digit by digit and ask them to check it.`);
  }
  if (isOwnBooking(booking, caller)) return booking;
  const name = text(input, "driver_name");
  if (!name) fail("name_needed", "Ask the caller for the name on the booking.", { missing: ["name on the booking"] });
  if (!namesMatch(name, booking.driverName)) {
    fail(
      "name_mismatch",
      "That name is not the name on this booking. Ask the caller to say the name again, or to check the reservation number. Never say the name on the booking.",
    );
  }
  return booking;
}

function requireState(booking: BookingDoc, allowed: BookingState[], now: Date) {
  const state = bookingState(booking, now);
  if (allowed.includes(state)) return;
  const messages: Record<BookingState, string> = {
    upcoming: "This rental has not started yet. To shorten it use change_booking; to call it off use cancel_booking.",
    in_progress: "This rental has already started, so it can no longer be changed or cancelled. It can be extended, or the car returned early.",
    completed: "This rental is already finished. Nothing can be changed. For a question about its bill, give the customer care contact.",
    cancelled: "This booking was cancelled. Offer to make a new booking.",
  };
  const codes: Record<BookingState, string> = {
    upcoming: "not_started",
    in_progress: "rental_started",
    completed: "rental_completed",
    cancelled: "booking_cancelled",
  };
  fail(codes[state], messages[state], { booking: bookingView(booking, now) });
}

async function save(booking: BookingDoc, update: Partial<BookingDoc>, action: BookingAction, note: string, caller: Caller) {
  const { bookings } = await collections();
  const now = new Date();
  const saved = await bookings.findOneAndUpdate(
    { _id: booking._id },
    {
      $set: { ...update, updatedAt: now },
      $push: { history: { at: now, action, conversationId: caller.conversationId, note } },
    },
    { returnDocument: "after" },
  );
  return saved ?? { ...booking, ...update };
}

// ---------------------------------------------------------------- the tools

/** get_price_quote: the demo price of a rental, for one car type or all of them. */
export function priceQuote(input: ToolInput, now = new Date()) {
  const trip = planTrip(input, null, now);
  const carType = carTypeFrom(input);
  if (carType) {
    return {
      ok: true,
      ...tripView(trip),
      car_type: carType,
      car: CAR_TYPES[carType].example,
      price: quote(carType, trip.pickup, trip.dropoff, trip.pickupAt, trip.returnAt),
      note: DEMO_PRICE_NOTE,
    };
  }
  const prices = (Object.keys(CAR_TYPES) as CarType[]).map((type) => {
    const price = quote(type, trip.pickup, trip.dropoff, trip.pickupAt, trip.returnAt);
    return { car_type: type, car: CAR_TYPES[type].example, daily_rate: price.daily_rate, total: price.total };
  });
  const sample = quote("economy", trip.pickup, trip.dropoff, trip.pickupAt, trip.returnAt);
  return {
    ok: true,
    ...tripView(trip),
    currency: sample.currency,
    days: sample.days,
    prices,
    totals_include: `VAT ${sample.vat_percent}%${sample.one_way_fee ? " and the one-way fee" : ""}${sample.discount_percent ? `, and ${sample.discount_percent}% off for the rental length` : ""}`,
    note: DEMO_PRICE_NOTE,
  };
}

/** create_booking: a new demo reservation, tied to the caller's account when they have one. */
export async function createBooking(input: ToolInput, caller: Caller, now = new Date()) {
  const trip = planTrip(input, null, now);
  const carType = requireCarType(input);
  const driverName = cleanName(text(input, "driver_name"));
  if (!/\p{L}{2}/u.test(driverName)) {
    fail("missing_details", "Ask for the driver's full name, and write it in English letters.", { missing: ["driver name"] });
  }
  const price = quote(carType, trip.pickup, trip.dropoff, trip.pickupAt, trip.returnAt);
  const answer = (booking: BookingDoc, alreadyBooked: boolean) => ({
    ok: true,
    ...(alreadyBooked ? { already_booked: true } : {}),
    booking: bookingView(booking, now),
    linked_to_account: Boolean(booking.customerId),
    bring_to_counter: BRING_TO_COUNTER,
    note: DEMO_BOOKING_NOTE,
  });

  const { bookings } = await collections();
  if (caller.conversationId) {
    // The same booking asked twice in one call (a repeated tool call) is made once.
    const same: Filter<BookingDoc> = {
      conversationId: caller.conversationId,
      status: "confirmed",
      driverName,
      carType,
      "pickup.code": trip.pickup.code,
      "pickup.at": trip.pickupAt,
      "dropoff.code": trip.dropoff.code,
      "dropoff.at": trip.returnAt,
    };
    const existing = await bookings.findOne(same);
    if (existing) return answer(existing, true);
  }

  const created = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const booking: BookingDoc = {
      _id: new ObjectId(),
      reservationNumber: String(randomInt(100_000, 1_000_000)),
      status: "confirmed",
      customerId: caller.customer?._id ?? null,
      driverName,
      country: trip.pickup.country,
      carType,
      pickup: stop(trip.pickup, trip.pickupAt),
      dropoff: stop(trip.dropoff, trip.returnAt),
      price,
      earlyReturnFrom: null,
      conversationId: caller.conversationId,
      createdAt: created,
      updatedAt: created,
      history: [{ at: created, action: "created", conversationId: caller.conversationId, note: "" }],
    };
    try {
      await bookings.insertOne(booking);
      return answer(booking, false);
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error; // number taken: draw another
    }
  }
  throw new Error("No free reservation number after 5 tries");
}

/** find_booking: one booking by number (and name), or without a number the known caller's own bookings. */
export async function findBooking(input: ToolInput, caller: Caller, now = new Date()) {
  if (!text(input, "reservation_number") && caller.customer) {
    const own = await customerBookings(caller.customer._id, { current: true });
    return {
      ok: true,
      bookings: own.map((b) => bookingView(b, now)),
      ...(own.length ? {} : { message: "This customer has no upcoming or current bookings on their account." }),
    };
  }
  const booking = await bookingFor(input, caller);
  return { ok: true, booking: bookingView(booking, now) };
}

/** change_booking: new dates, times, branches or car type for a booking that has not started. */
export async function changeBooking(input: ToolInput, caller: Caller, now = new Date()) {
  const booking = await bookingFor(input, caller);
  requireState(booking, ["upcoming"], now);
  const trip = planTrip(input, booking, now);
  const carType = carTypeFrom(input) ?? booking.carType;

  // [what changed, the log line]
  const changes = (
    [
      [trip.pickup.code !== booking.pickup.code, "pick-up branch", `pick-up ${booking.pickup.code} -> ${trip.pickup.code}`],
      [trip.pickupAt.getTime() !== booking.pickup.at.getTime(), "pick-up time", `pick-up ${booking.pickup.at.toISOString()} -> ${trip.pickupAt.toISOString()}`],
      [trip.dropoff.code !== booking.dropoff.code, "return branch", `return ${booking.dropoff.code} -> ${trip.dropoff.code}`],
      [trip.returnAt.getTime() !== booking.dropoff.at.getTime(), "return time", `return ${booking.dropoff.at.toISOString()} -> ${trip.returnAt.toISOString()}`],
      [carType !== booking.carType, "car type", `car ${booking.carType} -> ${carType}`],
    ] as const
  ).filter(([changed]) => changed);
  if (changes.length === 0) {
    fail("nothing_to_change", "The booking already has these details. Ask the caller what they want to change.", {
      booking: bookingView(booking, now),
    });
  }

  const price = quote(carType, trip.pickup, trip.dropoff, trip.pickupAt, trip.returnAt);
  const saved = await save(
    booking,
    {
      country: trip.pickup.country,
      carType,
      pickup: stop(trip.pickup, trip.pickupAt),
      dropoff: stop(trip.dropoff, trip.returnAt),
      price,
    },
    "changed",
    changes.map(([, , log]) => log).join("; "),
    caller,
  );
  return {
    ok: true,
    changed: changes.map(([, what]) => what),
    booking: bookingView(saved, now),
    previous_total: booking.price.total,
    new_total: price.total,
    currency: price.currency,
  };
}

/** extend_rental: a later return, before or during the rental. */
export async function extendRental(input: ToolInput, caller: Caller, now = new Date()) {
  const booking = await bookingFor(input, caller);
  requireState(booking, ["upcoming", "in_progress"], now);
  if (!text(input, "new_return_date")) {
    fail("missing_details", "Ask the caller until when they want to keep the car.", { missing: ["new return date"] });
  }
  const pickup = branchOf(booking.pickup, booking.country);
  const dropoff = branchOf(booking.dropoff, booking.country);
  const timeZone = timeZoneOf(dropoff);
  const date = parseDate(text(input, "new_return_date")) ?? fail("invalid_date", "The new return date must be written YYYY-MM-DD.");
  const minutes = text(input, "new_return_time")
    ? (parseTime(text(input, "new_return_time")) ?? fail("invalid_time", "The new return time must be written HH:MM in 24-hour time."))
    : localParts(booking.dropoff.at, timeZone).minutes;
  const returnAt = zonedToUtc(date, minutes, timeZone);

  if (returnAt.getTime() <= booking.dropoff.at.getTime()) {
    fail("not_later", "That is not later than the agreed return. For an earlier return use early_return (rental started) or change_booking (not started).", {
      booking: bookingView(booking, now),
    });
  }
  if (rentalDays(booking.pickup.at, returnAt) > MAX_RENTAL_DAYS) {
    fail("too_long", `A rental can last at most ${MAX_RENTAL_DAYS} days in total. For longer, Budget offers monthly leasing.`);
  }
  checkOpen("return", dropoff, returnAt);

  const price = quote(booking.carType, pickup, dropoff, booking.pickup.at, returnAt);
  const saved = await save(booking, { dropoff: { ...booking.dropoff, at: returnAt }, price }, "extended", "", caller);
  return {
    ok: true,
    booking: bookingView(saved, now),
    previous_total: booking.price.total,
    new_total: price.total,
    extra_cost: Math.round((price.total - booking.price.total) * 1000) / 1000,
    currency: price.currency,
    note: "Extensions depend on the car being available; the demo always has one.",
  };
}

/** early_return: the car comes back before the agreed time of a rental that has started. */
export async function earlyReturn(input: ToolInput, caller: Caller, now = new Date()) {
  const booking = await bookingFor(input, caller);
  requireState(booking, ["in_progress"], now);
  const pickup = branchOf(booking.pickup, booking.country);
  const dropoff = branchOf(booking.dropoff, booking.country);
  const timeZone = timeZoneOf(dropoff);

  let returnAt = now;
  if (text(input, "return_date") || text(input, "return_time")) {
    const today = localParts(now, timeZone);
    const date = text(input, "return_date")
      ? (parseDate(text(input, "return_date")) ?? fail("invalid_date", "The return date must be written YYYY-MM-DD."))
      : today;
    const minutes = text(input, "return_time")
      ? (parseTime(text(input, "return_time")) ?? fail("invalid_time", "The return time must be written HH:MM in 24-hour time."))
      : today.minutes;
    returnAt = zonedToUtc(date, minutes, timeZone);
  }
  if (returnAt.getTime() < now.getTime() - NOW_TOLERANCE_MS) {
    fail("time_in_past", `That time has already passed. It is now ${describeLocal(now, timeZone)} at the branch.`);
  }
  if (returnAt.getTime() < now.getTime()) returnAt = now;
  if (returnAt.getTime() >= booking.dropoff.at.getTime()) {
    fail("not_earlier", "That is not before the agreed return. To keep the car longer use extend_rental.", { booking: bookingView(booking, now) });
  }
  checkOpen("return", dropoff, returnAt);

  const price = quote(booking.carType, pickup, dropoff, booking.pickup.at, returnAt);
  const saved = await save(
    booking,
    { dropoff: { ...booking.dropoff, at: returnAt }, price, earlyReturnFrom: booking.earlyReturnFrom ?? booking.dropoff.at },
    "early_return",
    "",
    caller,
  );
  return {
    ok: true,
    booking: bookingView(saved, now),
    previous_total: booking.price.total,
    new_total: price.total,
    currency: price.currency,
    note:
      "The price is recalculated on the days actually used, so a weekly or monthly rate may no longer apply. " +
      "Return the car to the agreed branch. In the real service the branch confirms the final amount.",
  };
}

/** cancel_booking: calls off a booking that has not started. Free: demo bookings are paid at the counter. */
export async function cancelBooking(input: ToolInput, caller: Caller, now = new Date()) {
  const booking = await bookingFor(input, caller);
  requireState(booking, ["upcoming"], now);
  const saved = await save(booking, { status: "cancelled" }, "cancelled", "", caller);
  return {
    ok: true,
    booking: bookingView(saved, now),
    cancellation_fee: 0,
    note: "Cancelling a pay-at-the-counter booking is free.",
  };
}

// ---------------------------------------------------------------- the customer's bookings

/** Newest pick-up first; `current` keeps only bookings that are not cancelled and not yet returned (soonest first). */
export async function customerBookings(customerId: ObjectId, options: { current?: boolean; limit?: number } = {}): Promise<BookingDoc[]> {
  const { bookings } = await collections();
  const filter: Filter<BookingDoc> = options.current
    ? { customerId, status: "confirmed", "dropoff.at": { $gt: new Date() } }
    : { customerId };
  return bookings
    .find(filter)
    .sort({ "pickup.at": options.current ? 1 : -1 })
    .limit(options.limit ?? (options.current ? 5 : 20))
    .toArray();
}

/** The account panel's list: current bookings first (soonest first), then finished and cancelled ones (newest first). */
export function accountBookings(list: BookingDoc[], now = new Date()) {
  const current = (b: BookingDoc) => ["upcoming", "in_progress"].includes(bookingState(b, now));
  return [
    ...list.filter(current).sort((a, b) => a.pickup.at.getTime() - b.pickup.at.getTime()),
    ...list.filter((b) => !current(b)).sort((a, b) => b.pickup.at.getTime() - a.pickup.at.getTime()),
  ].map((booking) => accountBooking(booking, now));
}

/** A booking as the account panel shows it. */
export function accountBooking(booking: BookingDoc, now = new Date()) {
  return {
    reservationNumber: booking.reservationNumber,
    state: bookingState(booking, now),
    carType: booking.carType,
    car: CAR_TYPES[booking.carType].example,
    timeZone: COUNTRIES[booking.country].timeZone,
    pickup: { name: booking.pickup.name, city: booking.pickup.city, at: booking.pickup.at.toISOString() },
    dropoff: { name: booking.dropoff.name, city: booking.dropoff.city, at: booking.dropoff.at.toISOString() },
    total: booking.price.total,
    currency: booking.price.currency,
    returnedEarly: Boolean(booking.earlyReturnFrom),
  };
}

export type AccountBooking = ReturnType<typeof accountBooking>;
