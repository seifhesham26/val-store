"use client";

/**
 * Password strength meter
 *
 * Shared by the signup form and the reset-password page so both surfaces
 * show the same requirements in the same order. Renders nothing once the
 * field is empty - there is nothing useful to say about a password that
 * hasn't been typed yet.
 *
 * `PasswordValueObject.validate()` is the single source of truth for what
 * "strong enough" means; this component only decides how to draw its
 * result. Per-requirement pass/fail is read off `validate().errors` by
 * keyword rather than re-implementing the character-class regexes here -
 * two independent regex sets for the same rule are how they drift apart.
 */

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PasswordValueObject } from "@/domain/customers/value-objects/password.value-object";

const REQUIREMENTS = [
  { label: "At least 8 characters", keyword: "8 characters" },
  { label: "One uppercase letter (A-Z)", keyword: "uppercase" },
  { label: "One lowercase letter (a-z)", keyword: "lowercase" },
  { label: "One number (0-9)", keyword: "one number" },
  { label: "One special character", keyword: "special character" },
] as const;

// Mirrors PasswordValueObject.getStrengthPercentage(), which only exists on
// an already-valid instance - this needs a percentage while the password is
// still failing rules, so the weak/medium/strong -> number mapping is
// duplicated here rather than forcing a throwaway `create()` call.
const STRENGTH_PERCENTAGE: Record<"weak" | "medium" | "strong", number> = {
  weak: 33,
  medium: 66,
  strong: 100,
};

const STRENGTH_BAR_COLOR: Record<"weak" | "medium" | "strong", string> = {
  weak: "bg-red-500",
  medium: "bg-yellow-500",
  strong: "bg-green-500",
};

const STRENGTH_TEXT_COLOR: Record<"weak" | "medium" | "strong", string> = {
  weak: "text-red-400",
  medium: "text-yellow-400",
  strong: "text-green-400",
};

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  if (!password) {
    return null;
  }

  const { errors, strength } = PasswordValueObject.validate(password);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              STRENGTH_BAR_COLOR[strength]
            )}
            style={{ width: `${STRENGTH_PERCENTAGE[strength]}%` }}
          />
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium capitalize",
            STRENGTH_TEXT_COLOR[strength]
          )}
        >
          {strength}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {REQUIREMENTS.map((requirement) => {
          const met = !errors.some((error) =>
            error.includes(requirement.keyword)
          );

          return (
            <li
              key={requirement.label}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                met ? "text-green-400" : "text-gray-500"
              )}
            >
              {met ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <X className="h-3 w-3 shrink-0" />
              )}
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
