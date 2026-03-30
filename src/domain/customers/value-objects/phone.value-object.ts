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
