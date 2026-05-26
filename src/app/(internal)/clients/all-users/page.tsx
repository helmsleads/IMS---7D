"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Input from "@/components/ui/Input";
import {
  AllUserRow,
  AllUserType,
  CLIENT_ROLES,
  STAFF_ROLES,
  deleteAllUser,
  fetchAllUsers,
  inviteAllUser,
  resendAllUserInvite,
  updateAllUser,
} from "@/lib/api/all-users";
import { createClient } from "@/lib/supabase";

interface ClientOption {
  id: string;
  company_name: string;
}

const typeBadgeVariant: Record<AllUserType, "default" | "success"> = {
  staff: "success",
  client: "default",
};

export default function AllUsersPage() {
  const [users, setUsers] = useState<AllUserRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AllUserType>("all");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AllUserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [resendModal, setResendModal] = useState<{
    open: boolean;
    user: AllUserRow | null;
    loading: boolean;
    error: string | null;
    success: string | null;
  }>({
    open: false,
    user: null,
    loading: false,
    error: null,
    success: null,
  });

  const [inviteForm, setInviteForm] = useState({
    user_type: "client" as AllUserType,
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "member",
    client_id: "",
  });

  const [editForm, setEditForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "",
    client_id: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, clientsRes] = await Promise.all([
        fetchAllUsers(),
        createClient()
          .from("clients")
          .select("id, company_name")
          .eq("active", true)
          .order("company_name"),
      ]);

      setUsers(usersData);
      if (clientsRes.error) throw new Error(clientsRes.error.message);
      setClients(clientsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (typeFilter !== "all") {
      list = list.filter((u) => u.type === typeFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.client && u.client.toLowerCase().includes(q))
    );
  }, [users, searchQuery, typeFilter]);

  const resetInviteForm = () => {
    setInviteForm({
      user_type: "client",
      email: "",
      first_name: "",
      last_name: "",
      phone: "",
      role: "member",
      client_id: "",
    });
    setFormError(null);
    setFormSuccess(null);
  };

  const openEdit = (user: AllUserRow) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || "",
      role: user.role,
      client_id: user.client_id || "",
    });
    setFormError(null);
    setFormSuccess(null);
    setShowEditModal(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) {
      setFormError("You must enter an email address.");
      return;
    }
    if (!inviteForm.first_name.trim()) {
      setFormError("First name is required.");
      return;
    }
    if (inviteForm.user_type === "client" && !inviteForm.client_id) {
      setFormError("Please select a client.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const result = await inviteAllUser({
      user_type: inviteForm.user_type,
      email: inviteForm.email.trim(),
      first_name: inviteForm.first_name.trim(),
      last_name: inviteForm.last_name.trim(),
      phone: inviteForm.phone.trim() || undefined,
      role: inviteForm.role,
      client_id:
        inviteForm.user_type === "client" ? inviteForm.client_id : undefined,
    });

    setSubmitting(false);

    if (result.success) {
      setFormSuccess(result.message);
      await loadData();
    } else {
      setFormError(result.message);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    setFormError(null);

    const result = await updateAllUser({
      id: editingUser.id,
      type: editingUser.type,
      email: editForm.email.trim(),
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      phone: editForm.phone.trim() || undefined,
      role: editForm.role,
      client_id: editingUser.type === "client" ? editForm.client_id : undefined,
      client_user_id: editingUser.client_user_id || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      setShowEditModal(false);
      setEditingUser(null);
      await loadData();
    } else {
      setFormError(result.message);
    }
  };

  const handleDelete = async (user: AllUserRow) => {
    const label =
      user.type === "staff"
        ? `deactivate staff user ${user.email}`
        : `remove portal access for ${user.email}`;
    if (!confirm(`Are you sure you want to ${label}?`)) return;

    const result = await deleteAllUser(user.id, user.type);
    if (result.success) {
      await loadData();
    } else {
      alert(result.message);
    }
  };

  const closeResendModal = () => {
    setResendModal({
      open: false,
      user: null,
      loading: false,
      error: null,
      success: null,
    });
  };

  const handleResendInvite = async (user: AllUserRow) => {
    setResendModal({
      open: true,
      user,
      loading: true,
      error: null,
      success: null,
    });

    const result = await resendAllUserInvite(user.id, user.type, user.email);

    setResendModal({
      open: true,
      user,
      loading: false,
      error: result.success
        ? null
        : result.message || "Failed to resend invitation. No details were returned.",
      success: result.success ? result.message : null,
    });
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      mobilePriority: 1,
      render: (user: AllUserRow) => (
        <div>
          <span className="font-medium text-gray-900">
            {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
              user.email}
          </span>
          <div className="md:hidden text-xs text-gray-500 mt-0.5">{user.email}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      hideOnMobile: true,
      render: (user: AllUserRow) => (
        <span className="text-gray-600">{user.email}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      hideOnMobile: true,
      render: (user: AllUserRow) => (
        <span className="text-gray-600">{user.phone || "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (user: AllUserRow) => (
        <Badge variant={typeBadgeVariant[user.type]}>
          {user.type === "staff" ? "Staff" : "Client"}
        </Badge>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: AllUserRow) => (
        <span className="capitalize text-gray-700">{user.role}</span>
      ),
    },
    {
      key: "client",
      header: "Client",
      hideOnMobile: true,
      render: (user: AllUserRow) => (
        <span className="text-gray-600">{user.client || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideOnMobile: true,
      render: (user: AllUserRow) => (
        <Badge variant={user.active ? "success" : "error"}>
          {user.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (user: AllUserRow) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleResendInvite(user)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Resend invitation"
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(user)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(user)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (error && users.length === 0) {
    return (
      <AppShell title="Users" subtitle="Staff and client portal users">
        <FetchError message={error} onRetry={loadData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Users"
      subtitle="All staff administrators and client portal users"
      actions={
        <Button
          onClick={() => {
            resetInviteForm();
            setShowInviteModal(true);
          }}
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Invite
        </Button>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, role, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | AllUserType)
          }
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          <option value="staff">Staff only</option>
          <option value="client">Client only</option>
        </select>
      </div>

      <Card padding="none">
        {filteredUsers.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="No users found"
              description={
                searchQuery || typeFilter !== "all"
                  ? "No users match your filters"
                  : "Invite staff or client users to get started"
              }
              action={
                !searchQuery && (
                  <Button
                    onClick={() => {
                      resetInviteForm();
                      setShowInviteModal(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Invite User
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredUsers}
            loading={loading}
            emptyMessage="No users found"
            mobileView="table"
          />
        )}
      </Card>

      {!loading && users.length > 0 && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          {filteredUsers.length} of {users.length} user
          {users.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Invite modal — aligned with backend invite flow */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          resetInviteForm();
        }}
        title="Invite User"
        size="lg"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          {formSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              {formSuccess}
            </div>
          )}
          {formError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
            >
              <p className="font-medium">Invitation failed</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{formError}</p>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Send an email invitation. The user will set their own password when
            they accept, same as the Helmsman portal invite flow.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User type <span className="text-red-500">*</span>
            </label>
            <select
              value={inviteForm.user_type}
              onChange={(e) => {
                const t = e.target.value as AllUserType;
                setInviteForm({
                  ...inviteForm,
                  user_type: t,
                  role: t === "staff" ? "warehouse" : "member",
                  client_id: "",
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="client">Client (portal)</option>
              <option value="staff">Staff (admin dashboard)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <Input
                value={inviteForm.first_name}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, first_name: e.target.value })
                }
                placeholder="Leo"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <Input
                value={inviteForm.last_name}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, last_name: e.target.value })
                }
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
              placeholder="user@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone number
            </label>
            <Input
              type="tel"
              value={inviteForm.phone}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, phone: e.target.value })
              }
              placeholder="(555) 123-4567"
            />
          </div>

          {inviteForm.user_type === "client" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                value={inviteForm.client_id}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, client_id: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, role: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {(inviteForm.user_type === "staff" ? STAFF_ROLES : CLIENT_ROLES).map(
                (r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowInviteModal(false);
                resetInviteForm();
              }}
              disabled={submitting}
            >
              {formSuccess ? "Close" : "Cancel"}
            </Button>
            {!formSuccess && (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Invitation"}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        title="Edit User"
        size="lg"
      >
        {editingUser && (
          <form onSubmit={handleEdit} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
              >
                <p className="font-medium">Could not save changes</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last name
                </label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                required
              />
            </div>

            {editingUser.type === "client" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone number
                </label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
            )}

            {editingUser.type === "client" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={editForm.client_id}
                  onChange={(e) =>
                    setEditForm({ ...editForm, client_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {(editingUser.type === "staff" ? STAFF_ROLES : CLIENT_ROLES).map(
                  (r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEditModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Resend invitation result modal */}
      <Modal
        isOpen={resendModal.open}
        onClose={closeResendModal}
        title={
          resendModal.loading
            ? "Sending invitation…"
            : resendModal.error
              ? "Invitation failed"
              : "Invitation sent"
        }
        size="md"
        footer={
          !resendModal.loading ? (
            <div className="flex justify-end">
              <Button type="button" onClick={closeResendModal}>
                Close
              </Button>
            </div>
          ) : undefined
        }
      >
        {resendModal.user && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {resendModal.loading ? (
                <>Sending invitation to <strong>{resendModal.user.email}</strong>…</>
              ) : (
                <>
                  Recipient: <strong>{resendModal.user.email}</strong>
                  {resendModal.user.first_name || resendModal.user.last_name ? (
                    <>
                      {" "}
                      (
                      {[resendModal.user.first_name, resendModal.user.last_name]
                        .filter(Boolean)
                        .join(" ")}
                      )
                    </>
                  ) : null}
                </>
              )}
            </p>

            {resendModal.loading && (
              <div className="flex items-center justify-center py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}

            {resendModal.error && (
              <div
                role="alert"
                className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
              >
                <p className="font-medium">Could not resend invitation</p>
                <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                  {resendModal.error}
                </p>
              </div>
            )}

            {resendModal.success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <p className="font-medium">Success</p>
                <p className="mt-2">{resendModal.success}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
