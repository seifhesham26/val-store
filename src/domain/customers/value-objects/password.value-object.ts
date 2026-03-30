/**
 * Password Value Object
 *
 * Immutable value object for passwords.
 * Enforces strong password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong";
}

export class PasswordValueObject {
  private readonly value: string;

  private constructor(password: string) {
    this.value = password;
  }

  /**
   * Create a new password value object
   * Throws if password doesn't meet requirements
   */
  static create(plainTextPassword: string): PasswordValueObject {
    const validation = PasswordValueObject.validate(plainTextPassword);

    if (!validation.isValid) {
      throw new Error(
        `Password requirements not met: ${validation.errors.join(", ")}`
      );
    }

    return new PasswordValueObject(plainTextPassword);
  }

  /**
   * Validate password without throwing
   * Returns detailed validation result with strength indicator
   */
  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let strengthScore = 0;

    // Length check
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    } else {
      strengthScore++;
      if (password.length >= 12) strengthScore++;
      if (password.length >= 16) strengthScore++;
    }

    // Uppercase check
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    } else {
      strengthScore++;
    }

    // Lowercase check
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    } else {
      strengthScore++;
    }

    // Number check
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    } else {
      strengthScore++;
    }

    // Special character check
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push(
        "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)"
      );
    } else {
      strengthScore++;
    }

    // Determine strength
    let strength: "weak" | "medium" | "strong";
    if (strengthScore <= 3) {
      strength = "weak";
    } else if (strengthScore <= 5) {
      strength = "medium";
    } else {
      strength = "strong";
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Get password requirements as user-friendly list
   */
  static getRequirements(): string[] {
    return [
      "At least 8 characters long",
      "At least one uppercase letter (A-Z)",
      "At least one lowercase letter (a-z)",
      "At least one number (0-9)",
      "At least one special character (!@#$%^&*...)",
    ];
  }

  /**
   * Get the password value
   * Note: In real apps, this should only be used for hashing
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check if password matches another
   */
  equals(other: PasswordValueObject): boolean {
    return this.value === other.getValue();
  }

  /**
   * Get password strength indicator (0-100)
   */
  getStrengthPercentage(): number {
    const validation = PasswordValueObject.validate(this.value);
    switch (validation.strength) {
      case "weak":
        return 33;
      case "medium":
        return 66;
      case "strong":
        return 100;
    }
  }
}
