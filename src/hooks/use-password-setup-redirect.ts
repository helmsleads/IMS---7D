"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPasswordSetupRedirectUrl } from "@/lib/auth-password-setup";

/**
 * If Supabase lands on login/home with invite/recovery tokens, forward to reset-password.
 */
export function usePasswordSetupRedirect() {
  const router = useRouter();

  useEffect(() => {
    const target = getPasswordSetupRedirectUrl();
    if (target) {
      router.replace(target);
    }
  }, [router]);
}
