/**
 * Address Value Object
 *
 * Immutable value object for addresses.
 * Validates all address fields and provides formatting helpers.
 */

export interface AddressData {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  apartment?: string;
}

export class AddressValueObject {
  private readonly street: string;
  private readonly city: string;
  private readonly state: string | null;
  private readonly postalCode: string;
  private readonly country: string;
  private readonly apartment: string | null;

  constructor(data: AddressData) {
    this.validateRequired(data);

    this.street = data.street.trim();
    this.city = data.city.trim();
    this.state = data.state?.trim() || null;
    this.postalCode = data.postalCode.trim();
    this.country = data.country.trim();
    this.apartment = data.apartment?.trim() || null;
  }

  /**
   * Validate required fields
   */
  private validateRequired(data: AddressData): void {
    const errors: string[] = [];

    if (!data.street || data.street.trim().length < 3) {
      errors.push("Street address is required (minimum 3 characters)");
    }

    if (!data.city || data.city.trim().length < 2) {
      errors.push("City is required (minimum 2 characters)");
    }

    if (!data.postalCode || data.postalCode.trim().length < 3) {
      errors.push("Postal code is required (minimum 3 characters)");
    }

    if (!data.country || data.country.trim().length < 2) {
      errors.push("Country is required");
    }

    if (errors.length > 0) {
      throw new Error(`Invalid address: ${errors.join(", ")}`);
    }
  }

  /**
   * Get street address
   */
  getStreet(): string {
    return this.street;
  }

  /**
   * Get city
   */
  getCity(): string {
    return this.city;
  }

  /**
   * Get state/province
   */
  getState(): string | null {
    return this.state;
  }

  /**
   * Get postal/zip code
   */
  getPostalCode(): string {
    return this.postalCode;
  }

  /**
   * Get country
   */
  getCountry(): string {
    return this.country;
  }

  /**
   * Get apartment/unit number
   */
  getApartment(): string | null {
    return this.apartment;
  }

  /**
   * Get full street address with apartment
   */
  getFullStreet(): string {
    if (this.apartment) {
      return `${this.street}, ${this.apartment}`;
    }
    return this.street;
  }

  /**
   * Get city and state combined
   */
  getCityState(): string {
    if (this.state) {
      return `${this.city}, ${this.state}`;
    }
    return this.city;
  }

  /**
   * Format as single line
   */
  toSingleLine(): string {
    const parts = [
      this.getFullStreet(),
      this.getCityState(),
      this.postalCode,
      this.country,
    ];
    return parts.join(", ");
  }

  /**
   * Format as multi-line (for shipping labels)
   */
  toMultiLine(): string[] {
    const lines: string[] = [];

    lines.push(this.getFullStreet());
    lines.push(`${this.getCityState()} ${this.postalCode}`);
    lines.push(this.country);

    return lines;
  }

  /**
   * Convert to plain object
   */
  toObject(): AddressData {
    return {
      street: this.street,
      city: this.city,
      state: this.state || undefined,
      postalCode: this.postalCode,
      country: this.country,
      apartment: this.apartment || undefined,
    };
  }

  /**
   * Check if address equals another
   */
  equals(other: AddressValueObject): boolean {
    return (
      this.street === other.getStreet() &&
      this.city === other.getCity() &&
      this.state === other.getState() &&
      this.postalCode === other.getPostalCode() &&
      this.country === other.getCountry() &&
      this.apartment === other.getApartment()
    );
  }

  /**
   * Create from plain object (factory method)
   */
  static create(data: AddressData): AddressValueObject {
    return new AddressValueObject(data);
  }

  /**
   * Create from single line string (basic parsing)
   */
  static fromString(address: string): AddressValueObject {
    const parts = address.split(",").map((p) => p.trim());

    if (parts.length < 3) {
      throw new Error(
        "Invalid address format. Expected: street, city, postalCode, country"
      );
    }

    return new AddressValueObject({
      street: parts[0],
      city: parts[1],
      postalCode: parts[parts.length - 2] || "",
      country: parts[parts.length - 1] || "",
    });
  }
}
