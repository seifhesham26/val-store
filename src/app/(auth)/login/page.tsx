import { Suspense } from "react";
import { LoginCard } from "@/components/auth/login";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
