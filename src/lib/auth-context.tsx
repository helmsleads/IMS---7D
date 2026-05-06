"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { UserRole } from "@/types/database";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  staffUser: StaffUser | null;
  isStaff: boolean;
  isMfaVerified: boolean;
  hasTotpFactor: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  staffUser: null,
  isStaff: false,
  isMfaVerified: false,
  hasTotpFactor: false,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [isMfaVerified, setIsMfaVerified] = useState(false);
  const [hasTotpFactor, setHasTotpFactor] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkStaffStatus = async (authUser: User) => {
      // Check if this user is in the internal users table
      const { data: staffData, error } = await supabase
        .from("users")
        .select("id, name, email, role, active")
        .eq("id", authUser.id)
        .eq("active", true)
        .single();

      if (error || !staffData) {
        setStaffUser(null);
        setHasTotpFactor(false);
        setIsMfaVerified(false);
      } else {
        setStaffUser(staffData);
        const [{ data: factorData }, { data: aalData }] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        const hasVerifiedTotp = (factorData?.totp ?? []).some(
          (factor) => factor.status === "verified"
        );
        setHasTotpFactor(hasVerifiedTotp);
        setIsMfaVerified(aalData?.currentLevel === "aal2");
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        setLoading(true);
        checkStaffStatus(authUser);
      } else {
        setStaffUser(null);
        setHasTotpFactor(false);
        setIsMfaVerified(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const isStaff = !!staffUser;

  return (
    <AuthContext.Provider
      value={{ user, staffUser, isStaff, isMfaVerified, hasTotpFactor, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
