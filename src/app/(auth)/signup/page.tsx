import { Suspense } from "react";
import { SignupCard } from "@/components/auth/signup";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupCard />
    </Suspense>
  );
}
