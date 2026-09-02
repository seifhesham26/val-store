/**
 * Phone Value Object
 *
 * Immutable value object for phone numbers.
 * Uses libphonenumber-js for robust international phone validation.
 */

import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type PhoneNumber,
} from "libphonenumber-js";

export class PhoneValueObject {
  private readonly value: string;
  private readonly phoneNumber: PhoneNumber;

  constructor(phone: string, defaultCountry: string = "EG") {
    const parsed = parsePhoneNumberFromString(phone, defaultCountry as never);

    if (!parsed || !parsed.isValid()) {
      throw new Error(
        "Invalid phone number. Please enter a valid phone number."
      );
    }

    this.phoneNumber = parsed;
    // Store in E.164 format (international standard): +1234567890
    this.value = parsed.format("E.164");
  }

  /**
   * Get the phone in E.164 format (+1234567890)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get phone formatted for display based on country
   * e.g., "(123) 456-7890" for US numbers
   */
  getFormattedValue(): string {
    return this.phoneNumber.formatNational();
  }

  /**
   * Get international formatted phone
   * e.g., "+1 123 456 7890"
   */
  getInternationalFormat(): string {
    return this.phoneNumber.formatInternational();
  }

  /**
   * Get the country code (e.g., "US", "GB")
   */
  getCountryCode(): string | undefined {
    return this.phoneNumber.country;
  }

  /**
   * Get the calling code (e.g., "1" for US)
   */
  getCallingCode(): string {
    return this.phoneNumber.countryCallingCode;
  }

  /**
   * Check if phone is equal to another
   */
  equals(other: PhoneValueObject): boolean {
    return this.value === other.value;
  }

  /**
   * Create from string (factory method)
   * @param phone - Phone number string (can be national or international format)
   * @param defaultCountry - Default country code if not in international format
   */
  static create(
    phone: string,
    defaultCountry: string = "EG"
  ): PhoneValueObject {
    return new PhoneValueObject(phone, defaultCountry);
  }

  /**
   * Check if a string is a valid phone without throwing
   */
  static isValid(phone: string, defaultCountry: string = "EG"): boolean {
    try {
      return isValidPhoneNumber(phone, defaultCountry as never);
    } catch {
      return false;
    }
  }

  /**
   * Does this login identifier look like a phone number rather than an email?
   *
   * A heuristic, and deliberately only that: it decides which *lookup* to try,
   * not whether anything is valid. `toE164` still has to parse it and the
   * credentials still have to check out, so a wrong guess here costs a failed
   * sign-in, never an authorisation decision.
   *
   * It lived in `LoginForm` as a local function, which meant the browser
   * decided how the server would interpret the string it was about to send.
   * It is here so the server can classify the identifier itself — see
   * `signIn` in `src/server/routers/auth.ts`, which no longer trusts the
   * client to have done any of this.
   */
  static looksLikePhone(value: string): boolean {
    if (value.length === 0 || value.includes("@")) {
      return false;
    }

    const digitsOnly = value.replace(/[^0-9]/g, "");

    // Enough digits to be a subscriber number, and mostly digits rather than a
    // word that happens to contain some.
    return digitsOnly.length >= 7 && digitsOnly.length / value.length > 0.7;
  }

  /**
   * Parse and format a phone number to E.164 format
   * Returns null if invalid
   */
  static toE164(phone: string, defaultCountry: string = "EG"): string | null {
    try {
      const parsed = parsePhoneNumberFromString(phone, defaultCountry as never);
      return parsed?.isValid() ? parsed.format("E.164") : null;
    } catch {
      return null;
    }
  }
}
