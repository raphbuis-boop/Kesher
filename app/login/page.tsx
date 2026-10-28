import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; mode?: string }>;
}) {
  const { next, email, mode } = await searchParams;

  return (
    <Suspense>
      <LoginClient next={next} initialEmail={email} initialTab={mode === "signup" ? "signup" : "signin"} />
    </Suspense>
  );
}
