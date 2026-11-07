// Display helpers. Money comes from the calculator's own module so the list and the receipt agree.
import { formatMoney as formatMinor } from "../../public/js/money.js";

const locale = typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US";

export function money(minor: number, currency: string): string {
  return formatMinor(minor, currency, locale);
}

export function date(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(ms));
}

export function persons(n: number): string {
  return n === 1 ? "1 person" : `${n} persons`;
}

/** The current page path and query, for sign-in round trips. */
export function herePath(): string {
  if (typeof location === "undefined") return "/";
  return location.pathname + location.search;
}
