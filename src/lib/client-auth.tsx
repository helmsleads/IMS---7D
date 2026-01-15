"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

interface Client {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface ClientContextType {
  user: User | null;
  client: Client | null;
  loading: boolean;
  isStaffPreview: boolean;
}

const ClientContext = createContext<ClientContextType>({
  user: null,
  client: null,
  loading: true,
  isStaffPreview: false,
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchClientOrStaff = async (userId: string, userEmail: string) => {
      try {
        // First try to find as client
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, company_name, contact_name, email, phone, address_line1, address_line2, city, state, zip")
          .eq("auth_id", userId)
          .single();

        if (clientData) {
          setClient(clientData);
          setIsStaffPreview(false);
          setLoading(false);
          return;
        }

        // If not a client, check if they're staff (for preview mode)
        const { data: staffData } = await supabase
          .from("users")
          .select("id, name, email, role")
          .eq("id", userId)
          .single();

        if (staffData) {
          // Staff user - create a preview client object
          setClient({
            id: "staff-preview",
            company_name: "Staff Preview Mode",
            contact_name: staffData.name,
            email: staffData.email,
            phone: null,
            address_line1: null,
            address_line2: null,
            city: null,
            state: null,
            zip: null,
          });
          setIsStaffPreview(true);
        } else {
          setClient(null);
          setIsStaffPreview(false);
        }
      } finally {
        setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setLoading(true);
        fetchClientOrStaff(currentUser.id, currentUser.email || "");
      } else {
        setClient(null);
        setIsStaffPreview(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <ClientContext.Provider value={{ user, client, loading, isStaffPreview }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
