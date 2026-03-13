"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCog,
  Search,
  Building2,
  Mail,
  Shield,
  Trash2,
  Plus,
  ChevronRight,
  Users,
  X,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import { createClient } from "@/lib/supabase";
import { handleApiError } from "@/lib/utils/error-handler";
import { invitePortalUser, addUserToClientByEmail, ClientUserRole } from "@/lib/api/client-users";

interface PortalUserWithClients {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  title: string | null;
  created_at: string;
  client_access: {
    id: string;
    client_id: string;
    role: string;
    is_primary: boolean;
    client: {
      id: string;
      company_name: string;
    };
  }[];
}

interface Client {
  id: string;
  company_name: string;
}

const roleColors: Record<string, "default" | "success" | "warning" | "error"> = {
  owner: "warning",
  admin: "success",
  member: "default",
  viewer: "default",
};

export default function PortalUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PortalUserWithClients[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUserMode, setAddUserMode] = useState<"create" | "existing">("existing");
  const [addFormData, setAddFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    title: "",
  });
  const [addClientId, setAddClientId] = useState("");
  const [addRole, setAddRole] = useState<ClientUserRole>("member");
  const [sendInviteNow, setSendInviteNow] = useState(true);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Verify & Reset
  const [verifyingUser, setVerifyingUser] = useState<PortalUserWithClients | null>(null);
  const [verifyData, setVerifyData] = useState<Record<string, unknown> | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<PortalUserWithClients | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch all client_users relationships with clients only
      const { data: clientUsersData, error: clientUsersError } = await supabase
        .from("client_users")
        .select(`
          id,
          user_id,
          client_id,
          role,
          is_primary,
          created_at,
          client:clients (id, company_name)
        `)
        .order("created_at", { ascending: false });

      if (clientUsersError) {
        console.error("client_users error:", clientUsersError);
        throw new Error(clientUsersError.message || "Failed to fetch client users");
      }

      // Fetch user profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, phone, title, created_at");

      if (profilesError) {
        console.error("profiles error:", profilesError);
        throw new Error(profilesError.message || "Failed to fetch user profiles");
      }

      // Create a map of user profiles
      const profileMap = new Map<string, { id: string; email: string; full_name: string | null; phone: string | null; title: string | null; created_at: string }>();
      (profilesData || []).forEach((p) => profileMap.set(p.id, p));

      // Fetch all clients for the add modal
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("active", true)
        .order("company_name");

      if (clientsError) {
        console.error("clients error:", clientsError);
        throw new Error(clientsError.message || "Failed to fetch clients");
      }

      // Group by user
      const userMap = new Map<string, PortalUserWithClients>();

      (clientUsersData || []).forEach((cu) => {
        const user = profileMap.get(cu.user_id);
        const client = Array.isArray(cu.client) ? cu.client[0] : cu.client;

        if (!user || !client) return;

        if (!userMap.has(user.id)) {
          userMap.set(user.id, {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            title: user.title,
            created_at: user.created_at,
            client_access: [],
          });
        }

        userMap.get(user.id)!.client_access.push({
          id: cu.id,
          client_id: cu.client_id,
          role: cu.role,
          is_primary: cu.is_primary,
          client: client,
        });
      });

      const usersWithAccess = Array.from(userMap.values()).sort((a, b) =>
        a.email.localeCompare(b.email)
      );

      setUsers(usersWithAccess);
      setClients(clientsData || []);
    } catch (err) {
      console.error("Fetch error:", err);
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.client_access.some((a) =>
        a.client.company_name.toLowerCase().includes(query)
      )
    );
  });

  const resetAddForm = () => {
    setAddFormData({
      full_name: "",
      email: "",
      phone: "",
      title: "",
    });
    setAddClientId("");
    setAddRole("member");
    setSendInviteNow(true);
    setAddError(null);
    setAddSuccess(null);
    setAddUserMode("create");
  };

  const handleAddUser = async (e: React.FormEvent, sendEmail: boolean = true) => {
    e.preventDefault();
    if (!addClientId) {
      setAddError("Please select a client");
      return;
    }

    setAddSubmitting(true);
    setSendInviteNow(sendEmail);
    setAddError(null);
    setAddSuccess(null);

    try {
      let result;

      if (addUserMode === "create") {
        // Create/invite user
        if (!addFormData.email.trim()) {
          setAddError("Email is required");
          setAddSubmitting(false);
          return;
        }

        result = await invitePortalUser(
          addClientId,
          {
            email: addFormData.email.trim(),
            full_name: addFormData.full_name.trim() || undefined,
            phone: addFormData.phone.trim() || undefined,
            title: addFormData.title.trim() || undefined,
          },
          addRole,
          sendEmail
        );

        if (result.success) {
          setAddSuccess(
            sendEmail
              ? "Invitation sent! They will receive an email to set up their account."
              : "User created successfully. You can send the invitation later from the user list."
          );
          // Refresh data after a moment
          setTimeout(async () => {
            await fetchData();
          }, 1000);
          return;
        }
      } else {
        // Add existing user
        if (!addFormData.email.trim()) {
          setAddError("Email is required");
          setAddSubmitting(false);
          return;
        }

        result = await addUserToClientByEmail(
          addClientId,
          addFormData.email.trim(),
          addRole
        );

        if (result.success) {
          await fetchData();
          setShowAddModal(false);
          resetAddForm();
          return;
        }
      }

      if (!result.success) {
        setAddError(result.message);
      }
    } catch (err) {
      setAddError(handleApiError(err));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemoveAccess = async (clientUserId: string, userName: string, clientName: string) => {
    if (!confirm(`Remove ${userName}'s access to ${clientName}?`)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("client_users")
        .delete()
        .eq("id", clientUserId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert(handleApiError(err));
    }
  };

  const handleUpdateRole = async (clientUserId: string, newRole: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("client_users")
        .update({ role: newRole })
        .eq("id", clientUserId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert(handleApiError(err));
    }
  };

  const handleVerifyUser = async (user: PortalUserWithClients) => {
    setVerifyingUser(user);
    setVerifyData(null);
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerifyData(data);
    } catch (err) {
      setVerifyData({ error: err instanceof Error ? err.message : "Failed to verify" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleConfirmEmail = async (userId: string) => {
    try {
      const res = await fetch("/api/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm-email", userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refresh verify data
      if (verifyingUser) handleVerifyUser(verifyingUser);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to confirm email");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    setResetLoading(true);
    setResetResult(null);
    try {
      const res = await fetch("/api/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-password",
          userId: resetPasswordUser.id,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetResult({ success: true, message: "Password reset successfully" });
      setNewPassword("");
    } catch (err) {
      setResetResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to reset password",
      });
    } finally {
      setResetLoading(false);
    }
  };

  if (error && users.length === 0) {
    return (
      <AppShell title="Portal Users" subtitle="Manage users with portal access">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Portal Users"
      subtitle="Manage users with client portal access"
      actions={
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add User
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {filteredUsers.length === 0 && !loading ? (
        <Card>
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No portal users found"
            description={
              searchQuery
                ? "No users match your search"
                : "Add users to give them portal access to client accounts"
            }
            action={
              !searchQuery && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add User
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isExpanded = expandedUser === user.id;

            return (
              <Card key={user.id} padding="none">
                {/* User Header */}
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold">
                      {(user.full_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {user.full_name || user.email}
                      </p>
                      {user.title && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {user.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </span>
                      {user.phone && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-300">|</span>
                          {user.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">
                        {user.client_access.length} client{user.client_access.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.client_access.map((a) => a.client.company_name).join(", ").slice(0, 30)}
                        {user.client_access.map((a) => a.client.company_name).join(", ").length > 30 && "..."}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded Client Access */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Client Access
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerifyUser(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Verify Account
                        </button>
                        <button
                          onClick={() => { setResetPasswordUser(user); setNewPassword(""); setResetResult(null); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Reset Password
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {user.client_access.map((access) => (
                        <div
                          key={access.id}
                          className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <div>
                              <button
                                onClick={() => router.push(`/clients/${access.client_id}`)}
                                className="font-medium text-gray-900 hover:text-blue-600"
                              >
                                {access.client.company_name}
                              </button>
                              {access.is_primary && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">
                                  Primary
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <select
                              value={access.role}
                              onChange={(e) => handleUpdateRole(access.id, e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="owner">Owner</option>
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              onClick={() =>
                                handleRemoveAccess(
                                  access.id,
                                  user.full_name || user.email,
                                  access.client.company_name
                                )
                              }
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove access"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {!loading && users.length > 0 && (
        <div className="mt-6 text-sm text-gray-500 text-center">
          {users.length} user{users.length !== 1 ? "s" : ""} with portal access
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Add Portal User
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="px-4 pt-4">
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => { setAddUserMode("create"); setAddError(null); setAddSuccess(null); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    addUserMode === "create"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => { setAddUserMode("existing"); setAddError(null); setAddSuccess(null); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    addUserMode === "existing"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Add Existing User
                </button>
              </div>
            </div>

            <form id="addUserForm" onSubmit={handleAddUser} className="p-4 space-y-4">
              {addSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{addSuccess}</p>
                </div>
              )}

              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{addError}</p>
                </div>
              )}

              {addUserMode === "create" ? (
                <>
                  <p className="text-sm text-gray-500">
                    Send an email invitation. The user will set their own password when they accept.
                  </p>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={addFormData.email}
                      onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                      required
                      placeholder="john@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={addFormData.full_name}
                      onChange={(e) => setAddFormData({ ...addFormData, full_name: e.target.value })}
                      placeholder="John Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Phone & Title Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={addFormData.phone}
                        onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title / Position
                      </label>
                      <input
                        type="text"
                        value={addFormData.title}
                        onChange={(e) => setAddFormData({ ...addFormData, title: e.target.value })}
                        placeholder="Operations Manager"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Email for existing user */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={addFormData.email}
                      onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                      required
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The user must already have a portal account.
                    </p>
                  </div>
                </>
              )}

              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Client <span className="text-red-500">*</span>
                </label>
                <select
                  value={addClientId}
                  onChange={(e) => setAddClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as ClientUserRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="owner">Owner - Full access and billing</option>
                  <option value="admin">Admin - Manage orders and inventory</option>
                  <option value="member">Member - Create and view orders</option>
                  <option value="viewer">Viewer - View only access</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  disabled={addSubmitting}
                >
                  {addSuccess ? "Close" : "Cancel"}
                </Button>
                {!addSuccess && addUserMode === "create" && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(e) => handleAddUser(e as any, false)}
                      disabled={addSubmitting || !addFormData.email.trim() || !addClientId}
                      loading={addSubmitting && !sendInviteNow}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleAddUser(e as any, true)}
                      disabled={addSubmitting || !addFormData.email.trim() || !addClientId}
                      loading={addSubmitting && sendInviteNow}
                    >
                      Save & Send Invitation
                    </Button>
                  </>
                )}
                {!addSuccess && addUserMode === "existing" && (
                  <Button
                    type="submit"
                    disabled={addSubmitting || !addFormData.email.trim() || !addClientId}
                    loading={addSubmitting}
                  >
                    Add User
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Verify Account Modal */}
      <Modal
        isOpen={!!verifyingUser}
        onClose={() => { setVerifyingUser(null); setVerifyData(null); }}
        title={`Account Status: ${verifyingUser?.full_name || verifyingUser?.email || ""}`}
        size="md"
      >
        {verifyLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : verifyData?.error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{String(verifyData.error)}</p>
          </div>
        ) : verifyData?.auth ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium">{String((verifyData.auth as Record<string, unknown>).email)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Email Confirmed</span>
                <div className="flex items-center gap-2">
                  {(verifyData.auth as Record<string, unknown>).email_confirmed ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Yes
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-sm text-red-600">
                        <XCircle className="w-4 h-4" /> No
                      </span>
                      <button
                        onClick={() => handleConfirmEmail(verifyingUser!.id)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                      >
                        Confirm Now
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Last Sign In</span>
                <span className="text-sm font-medium">
                  {(verifyData.auth as Record<string, unknown>).last_sign_in
                    ? new Date(String((verifyData.auth as Record<string, unknown>).last_sign_in)).toLocaleString()
                    : "Never"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Account Created</span>
                <span className="text-sm font-medium">
                  {new Date(String((verifyData.auth as Record<string, unknown>).created_at)).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Banned</span>
                <span className={`text-sm font-medium ${(verifyData.auth as Record<string, unknown>).banned ? "text-red-600" : "text-green-700"}`}>
                  {(verifyData.auth as Record<string, unknown>).banned ? "Yes" : "No"}
                </span>
              </div>
            </div>
            {Array.isArray(verifyData.client_access) && verifyData.client_access.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Client Access</h4>
                <div className="space-y-1">
                  {(verifyData.client_access as Array<Record<string, unknown>>).map((ca) => (
                    <div key={String(ca.id)} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                      <span>{String((ca.client as Record<string, unknown>)?.company_name || "Unknown")}</span>
                      <Badge variant="default">{String(ca.role)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPasswordUser}
        onClose={() => { setResetPasswordUser(null); setNewPassword(""); setResetResult(null); }}
        title={`Reset Password: ${resetPasswordUser?.full_name || resetPasswordUser?.email || ""}`}
        size="sm"
        footer={
          !resetResult?.success ? (
            <>
              <Button variant="secondary" onClick={() => setResetPasswordUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                loading={resetLoading}
                disabled={!newPassword || newPassword.length < 8}
              >
                Reset Password
              </Button>
            </>
          ) : (
            <Button onClick={() => setResetPasswordUser(null)}>
              Done
            </Button>
          )
        }
      >
        {resetResult ? (
          <div className={`p-3 rounded-lg ${resetResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <p className={`text-sm ${resetResult.success ? "text-green-800" : "text-red-800"}`}>
              {resetResult.message}
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-gray-500">
              Set a new password for <strong>{resetPasswordUser?.email}</strong>. The user will need to use this password on their next login.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {newPassword && newPassword.length < 8 && (
                <p className="mt-1 text-xs text-red-500">Password must be at least 8 characters</p>
              )}
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
