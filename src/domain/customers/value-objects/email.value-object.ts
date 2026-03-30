/**
 * Email Value Object
 *
 * Ensures email addresses are valid and normalized.
 */

export class Email {
  private readonly value: string;

  private constructor(email: string) {
    this.value = email.toLowerCase().trim();
  }

  /**
   * Create Email from string
   * @param email - Email address to validate
   * @throws Error if email is invalid
   */
  static create(email: string): Email {
    const trimmed = email.trim();

    if (!trimmed) {
      throw new Error("Email cannot be empty");
    }

    if (!this.isValid(trimmed)) {
      throw new Error("Invalid email format");
    }

    return new Email(trimmed);
  }

  /**
   * Get the email value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get the domain part of the email
   */
  getDomain(): string {
    return this.value.split("@")[1];
  }

  /**
   * Get the local part of the email (before @)
   */
  getLocalPart(): string {
    return this.value.split("@")[0];
  }

  /**
   * Check equality with another Email
   */
  equals(other: Email): boolean {
    return this.value === other.value;
  }

  /**
   * Validate email format
   */
  private static isValid(email: string): boolean {
    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    // Additional checks
    const [local, domain] = email.split("@");

    // Local part shouldn't be too long
    if (local.length > 64) {
      return false;
    }

    // Domain shouldn't be too long
    if (domain.length > 255) {
      return false;
    }

    return true;
  }

  /**
   * Convert to string for serialization
   */
  toString(): string {
    return this.value;
  }
}
