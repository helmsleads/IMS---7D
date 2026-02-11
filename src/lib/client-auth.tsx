"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

interface Client {
  id: string;
  company_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  industry?: string;
}

interface ClientAccess {
  id: string;
  client_id: string;
  role: string;
  is_primary: boolean;
  client: Client;
}

interface ImpersonatedUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface ClientContextType {
  user: User | null;
  client: Client | null;
  loading: boolean;
  isStaffPreview: boolean;
  // Multi-client support
  availableClients: ClientAccess[];
  hasMultipleClients: boolean;
  currentRole: string | null;
  switchClient: (clientId: string) => void;
  // Staff impersonation
  impersonatedClientId: string | null;
  impersonatedUser: ImpersonatedUser | null;
  exitImpersonation: () => void;
}

const SELECTED_CLIENT_KEY = "7d_selected_client";
const IMPERSONATE_CLIENT_KEY = "7d_impersonate_client";
const IMPERSONATE_USER_KEY = "7d_impersonate_user";

const ClientContext = createContext<ClientContextType>({
  user: null,
  client: null,
  loading: true,
  isStaffPreview: false,
  availableClients: [],
  hasMultipleClients: false,
  currentRole: null,
  switchClient: () => {},
  impersonatedClientId: null,
  impersonatedUser: null,
  exitImpersonation: () => {},
});

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const [availableClients, setAvailableClients] = useState<ClientAccess[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [impersonatedClientId, setImpersonatedClientId] = useState<string | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const supabase = createClient();

  const switchClient = useCallback((clientId: string) => {
    const clientAccess = availableClients.find((c) => c.client_id === clientId);
    if (clientAccess) {
      setClient(clientAccess.client);
      setCurrentRole(clientAccess.role);

      // Persist selection based on whether we're in staff impersonation mode
      if (typeof window !== "undefined") {
        if (isStaffPreview) {
          // Staff impersonation - use session storage
          sessionStorage.setItem(IMPERSONATE_CLIENT_KEY, clientId);
          setImpersonatedClientId(clientId);
        } else {
          // Regular client user - use local storage
          localStorage.setItem(SELECTED_CLIENT_KEY, clientId);
        }
      }
    }
  }, [availableClients, isStaffPreview]);

  const exitImpersonation = useCallback(() => {
    setImpersonatedClientId(null);
    setImpersonatedUser(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(IMPERSONATE_CLIENT_KEY);
      sessionStorage.removeItem(IMPERSONATE_USER_KEY);
      // Redirect back to internal dashboard
      window.location.href = "/dashboard";
    }
  }, []);

  useEffect(() => {
    const fetchClientOrStaff = async (userId: string, userEmail: string) => {
      try {
        // Check for impersonation via URL param or session storage
        let viewUserId: string | null = null;
        let viewClientId: string | null = null;

        if (typeof window !== "undefined") {
          // Check URL params
          const urlParams = new URLSearchParams(window.location.search);
          viewUserId = urlParams.get("view_user");
          viewClientId = urlParams.get("view_client");

          // Persist to session storage if URL param present
          if (viewUserId) {
            sessionStorage.setItem(IMPERSONATE_USER_KEY, viewUserId);
            if (viewClientId) {
              sessionStorage.setItem(IMPERSONATE_CLIENT_KEY, viewClientId);
            }
          } else {
            // Check session storage for existing impersonation
            viewUserId = sessionStorage.getItem(IMPERSONATE_USER_KEY);
            viewClientId = sessionStorage.getItem(IMPERSONATE_CLIENT_KEY);
          }
        }

        // If there's a user impersonation request, verify current user is staff first
        if (viewUserId) {
          const { data: staffData } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("id", userId)
            .eq("active", true)
            .single();

          if (staffData) {
            // Get the portal user being impersonated
            const { data: portalUser } = await supabase
              .from("user_profiles")
              .select("id, email, full_name")
              .eq("id", viewUserId)
              .single();

            if (portalUser) {
              // Load the impersonated user's client associations
              const { data: userClientsData } = await supabase
                .from("client_users")
                .select(`
                  id,
                  client_id,
                  role,
                  is_primary,
                  client:clients (
                    id, company_name,
                    address_line1, address_line2, city, state, zip, industry
                  )
                `)
                .eq("user_id", viewUserId)
                .order("is_primary", { ascending: false });

              if (userClientsData && userClientsData.length > 0) {
                const clientAccessList: ClientAccess[] = userClientsData
                  .filter((cu) => cu.client)
                  .map((cu) => ({
                    id: cu.id,
                    client_id: cu.client_id,
                    role: cu.role,
                    is_primary: cu.is_primary,
                    client: Array.isArray(cu.client) ? cu.client[0] : cu.client,
                  }));

                setAvailableClients(clientAccessList);
                setImpersonatedUser({
                  id: portalUser.id,
                  email: portalUser.email,
                  full_name: portalUser.full_name,
                });

                // Determine which client to show
                let selectedAccess: ClientAccess | undefined;

                // If a specific client was requested, use that
                if (viewClientId) {
                  selectedAccess = clientAccessList.find(c => c.client_id === viewClientId);
                }

                // Fall back to primary or first
                if (!selectedAccess) {
                  selectedAccess = clientAccessList.find(c => c.is_primary) || clientAccessList[0];
                }

                if (selectedAccess) {
                  setClient(selectedAccess.client);
                  setCurrentRole(selectedAccess.role);
                  setImpersonatedClientId(selectedAccess.client_id);
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(IMPERSONATE_CLIENT_KEY, selectedAccess.client_id);
                  }
                }

                setIsStaffPreview(true);
                setLoading(false);
                return;
              }
            }
          }
          // If not staff or user not found, clear impersonation and continue normally
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(IMPERSONATE_USER_KEY);
            sessionStorage.removeItem(IMPERSONATE_CLIENT_KEY);
          }
        }

        // First, check client_users table for multi-client access
        const { data: clientUsersData } = await supabase
          .from("client_users")
          .select(`
            id,
            client_id,
            role,
            is_primary,
            client:clients (
              id, company_name,
              address_line1, address_line2, city, state, zip, industry
            )
          `)
          .eq("user_id", userId)
          .order("is_primary", { ascending: false });

        if (clientUsersData && clientUsersData.length > 0) {
          // User has access via client_users table
          const clientAccessList: ClientAccess[] = clientUsersData
            .filter((cu) => cu.client)
            .map((cu) => ({
              id: cu.id,
              client_id: cu.client_id,
              role: cu.role,
              is_primary: cu.is_primary,
              client: Array.isArray(cu.client) ? cu.client[0] : cu.client,
            }));

          setAvailableClients(clientAccessList);

          // Determine which client to show
          let selectedClientId: string | null = null;

          // Check localStorage for previously selected client
          if (typeof window !== "undefined") {
            selectedClientId = localStorage.getItem(SELECTED_CLIENT_KEY);
          }

          // Find the selected client or fall back to primary or first
          let selectedAccess = clientAccessList.find(
            (c) => c.client_id === selectedClientId
          );

          if (!selectedAccess) {
            // Fall back to primary
            selectedAccess = clientAccessList.find((c) => c.is_primary);
          }

          if (!selectedAccess) {
            // Fall back to first
            selectedAccess = clientAccessList[0];
          }

          if (selectedAccess) {
            setClient(selectedAccess.client);
            setCurrentRole(selectedAccess.role);
            if (typeof window !== "undefined") {
              localStorage.setItem(SELECTED_CLIENT_KEY, selectedAccess.client_id);
            }
          }

          setIsStaffPreview(false);
          setImpersonatedClientId(null);
          setLoading(false);
          return;
        }

        // Fall back to legacy: check auth_id on clients table
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, company_name, address_line1, address_line2, city, state, zip, industry")
          .eq("auth_id", userId)
          .single();

        if (clientData) {
          setClient(clientData);
          setAvailableClients([{
            id: "legacy",
            client_id: clientData.id,
            role: "owner",
            is_primary: true,
            client: clientData,
          }]);
          setCurrentRole("owner");
          setIsStaffPreview(false);
          setImpersonatedClientId(null);
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
          // Staff user without specific client to view - show preview mode message
          setClient({
            id: "staff-preview",
            company_name: "Staff Preview Mode",
            address_line1: null,
            address_line2: null,
            city: null,
            state: null,
            zip: null,
          });
          setIsStaffPreview(true);
          setImpersonatedClientId(null);
          setCurrentRole("admin");
        } else {
          setClient(null);
          setIsStaffPreview(false);
          setImpersonatedClientId(null);
          setCurrentRole(null);
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
        setAvailableClients([]);
        setCurrentRole(null);
        setLoading(false);
        // Clear stored selection on logout
        if (typeof window !== "undefined") {
          localStorage.removeItem(SELECTED_CLIENT_KEY);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const hasMultipleClients = availableClients.length > 1;

  return (
    <ClientContext.Provider
      value={{
        user,
        client,
        loading,
        isStaffPreview,
        availableClients,
        hasMultipleClients,
        currentRole,
        switchClient,
        impersonatedClientId,
        impersonatedUser,
        exitImpersonation,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
