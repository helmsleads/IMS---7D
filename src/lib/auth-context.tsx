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
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  staffUser: null,
  isStaff: false,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
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
      } else {
        setStaffUser(staffData);
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser) {
        checkStaffStatus(authUser);
      } else {
        setStaffUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const isStaff = !!staffUser;

  return (
    <AuthContext.Provider value={{ user, staffUser, isStaff, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
