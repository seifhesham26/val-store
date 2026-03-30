/**
 * Money Value Object
 *
 * Represents a monetary amount with currency.
 * Ensures precision in financial calculations using cents/minor units.
 */

export class Money {
  private readonly amount: number; // Amount in cents (e.g., $10.50 = 1050)
  private readonly currency: string;

  private constructor(amount: number, currency: string = "USD") {
    this.amount = amount;
    this.currency = currency;
  }

  /**
   * Create Money from dollars (major units)
   * @param dollars - Amount in dollars (e.g., 10.50)
   * @param currency - Currency code (default: USD)
   */
  static fromDollars(dollars: number, currency: string = "USD"): Money {
    if (dollars < 0) {
      throw new Error("Amount cannot be negative");
    }
    if (!Number.isFinite(dollars)) {
      throw new Error("Amount must be a finite number");
    }
    // Convert to cents to avoid floating point issues
    const cents = Math.round(dollars * 100);
    return new Money(cents, currency);
  }

  /**
   * Create Money from cents (minor units)
   * @param cents - Amount in cents (e.g., 1050 for $10.50)
   * @param currency - Currency code (default: USD)
   */
  static fromCents(cents: number, currency: string = "USD"): Money {
    if (cents < 0) {
      throw new Error("Amount cannot be negative");
    }
    if (!Number.isInteger(cents)) {
      throw new Error("Cents must be an integer");
    }
    return new Money(cents, currency);
  }

  /**
   * Create Money from decimal string (for database storage)
   * @param decimalString - String like "10.50"
   * @param currency - Currency code (default: USD)
   */
  static fromDecimalString(
    decimalString: string,
    currency: string = "USD"
  ): Money {
    const dollars = parseFloat(decimalString);
    if (isNaN(dollars)) {
      throw new Error("Invalid decimal string");
    }
    return Money.fromDollars(dollars, currency);
  }

  /**
   * Get amount in dollars (major units)
   */
  getDollars(): number {
    return this.amount / 100;
  }

  /**
   * Get amount in cents (minor units)
   */
  getCents(): number {
    return this.amount;
  }

  /**
   * Get currency code
   */
  getCurrency(): string {
    return this.currency;
  }

  /**
   * Get formatted string for database storage (e.g., "10.50")
   */
  toDecimalString(): string {
    return this.getDollars().toFixed(2);
  }

  /**
   * Get formatted display string (e.g., "$10.50")
   */
  toDisplayString(): string {
    const symbol = this.getCurrencySymbol();
    return `${symbol}${this.getDollars().toFixed(2)}`;
  }

  /**
   * Add two Money values
   */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  /**
   * Subtract two Money values
   */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error("Result cannot be negative");
    }
    return new Money(result, this.currency);
  }

  /**
   * Multiply by a scalar
   */
  multiply(multiplier: number): Money {
    if (multiplier < 0) {
      throw new Error("Multiplier cannot be negative");
    }
    return new Money(Math.round(this.amount * multiplier), this.currency);
  }

  /**
   * Calculate percentage discount
   * @param percentage - Discount percentage (e.g., 20 for 20%)
   */
  applyDiscount(percentage: number): Money {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Percentage must be between 0 and 100");
    }
    const discountMultiplier = (100 - percentage) / 100;
    return this.multiply(discountMultiplier);
  }

  /**
   * Compare with another Money value
   */
  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  /**
   * Compare with another Money value
   */
  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  /**
   * Check equality with another Money value
   */
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.amount === 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`
      );
    }
  }

  private getCurrencySymbol(): string {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
    };
    return symbols[this.currency] || this.currency;
  }
}
