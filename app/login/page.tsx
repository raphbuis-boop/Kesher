import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <Suspense>
      <LoginClient next={next} />
    </Suspense>
  );
}
