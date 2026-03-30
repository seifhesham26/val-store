"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import type { ExtendedSignUpEmail } from "@/types/auth";
import { PhoneValueObject } from "@/domain/customers/value-objects/phone.value-object";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthday: string;
}

export function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<SignupFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    birthday: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((previousFormData) => ({
      ...previousFormData,
      [event.target.name]: event.target.value,
    }));
  };

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers and + (for international format)
    const value = event.target.value.replace(/[^0-9+]/g, "");
    setFormData((previousFormData) => ({
      ...previousFormData,
      phone: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Validate and format phone number to E.164 format if provided
      let formattedPhone: string | undefined;
      if (formData.phone) {
        formattedPhone = PhoneValueObject.toE164(formData.phone) ?? undefined;
        if (!formattedPhone) {
          toast.error(
            "Invalid phone number. Please enter a valid phone number."
          );
          setIsLoading(false);
          return;
        }
      }

      // Use properly typed signUp with custom fields (no any!)
      const { error: signUpError } = await (
        signUp.email as ExtendedSignUpEmail
      )({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`,
        phone: formattedPhone,
        birthday: formData.birthday || undefined,
      });

      if (signUpError) {
        toast.error(signUpError.message || "Failed to create account");
        return;
      }

      // Success - redirect to home page
      toast.success("Account created successfully!");
      router.push(`/`);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-gray-300">
            First name
          </Label>
          <Input
            id="firstName"
            name="firstName"
            placeholder="John"
            value={formData.firstName}
            onChange={handleChange}
            required
            className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-gray-300">
            Last name
          </Label>
          <Input
            id="lastName"
            name="lastName"
            placeholder="Doe"
            value={formData.lastName}
            onChange={handleChange}
            required
            className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-300">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={handleChange}
          required
          className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-gray-300">
          Phone
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="1234567890"
          value={formData.phone}
          onChange={handlePhoneChange}
          className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-300">
          Password
        </Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={handleChange}
          required
          className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-gray-300">
          Confirm password
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          placeholder="Re-enter your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className="bg-white/6 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday" className="text-gray-300">
          Birthday
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-white/6 border-white/10 text-white hover:bg-white/10 hover:text-white",
                !formData.birthday && "text-gray-500"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.birthday ? (
                format(new Date(formData.birthday), "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={
                formData.birthday ? new Date(formData.birthday) : undefined
              }
              onSelect={(date) => {
                setFormData((prev) => ({
                  ...prev,
                  birthday: date ? format(date, "yyyy-MM-dd") : "",
                }));
              }}
              initialFocus
              captionLayout="dropdown"
              fromYear={1900}
              toYear={new Date().getFullYear()}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button
        type="submit"
        className="w-full bg-val-accent text-white hover:bg-val-accent-light hover:text-black transition-colors"
        disabled={isLoading}
      >
        {isLoading ? "Creating account..." : "Create account"}
      </Button>

      <div className="mt-4 text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-val-accent hover:text-val-accent-light transition-colors"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
}
