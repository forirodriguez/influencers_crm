import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function toE164(input: string, country?: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(input, country);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}
