"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import {
  ArrowLeft,
  Bell,
  Loader2,
  AlertCircle,
  Check,
  Search,
} from "lucide-react";
import {
  NotificationType,
  getAllUsersNotificationSettings,
  updateUserNotificationSettingAdmin,
  AdminUserNotificationSettings,
} from "@/lib/api/notifications";

const NOTIFICATION_COLUMNS: {
  id: NotificationType;
  label: string;
  short: string;
}[] = [
  { id: "new_order", label: "New Order Requests", short: "New Orders" },
  { id: "order_shipped", label: "Order Shipped", short: "Shipped" },
  { id: "low_stock", label: "Low Stock Alerts", short: "Low Stock" },
  { id: "inbound_arrived", label: "Inbound Arrivals", short: "Inbound" },
];

export default function StaffNotificationsPage() {
  const [users, setUsers] = useState<AdminUserNotificationSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllUsersNotificationSettings();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (!showInactive && !user.active) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, showInactive]);

  const handleToggle = async (
    user: AdminUserNotificationSettings,
    type: NotificationType
  ) => {
    const key = `${user.userId}:${type}`;
    const next = !user.settings[type];
    setSavingKey(key);
    setFeedback(null);

    setUsers((prev) =>
      prev.map((u) =>
        u.userId === user.userId
          ? { ...u, settings: { ...u.settings, [type]: next } }
          : u
      )
    );

    const result = await updateUserNotificationSettingAdmin(
      user.userId,
      type,
      next
    );

    if (!result.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === user.userId
            ? { ...u, settings: { ...u.settings, [type]: !next } }
            : u
        )
      );
      setFeedback(result.error || "Failed to update");
    } else {
      setFeedback(`Updated ${user.name} — ${NOTIFICATION_COLUMNS.find((c) => c.id === type)?.label}`);
      setTimeout(() => setFeedback(null), 2500);
    }

    setSavingKey(null);
  };

  const enableNewOrdersForActive = async () => {
    const targets = users.filter((u) => u.active && !u.settings.new_order);
    if (targets.length === 0) {
      setFeedback("All active users already receive new order emails");
      return;
    }

    setSavingKey("bulk:new_order");
    setFeedback(null);

    let failed = 0;
    for (const user of targets) {
      const result = await updateUserNotificationSettingAdmin(
        user.userId,
        "new_order",
        true
      );
      if (!result.success) failed++;
    }

    await load();
    setSavingKey(null);
    setFeedback(
      failed === 0
        ? `Enabled New Order emails for ${targets.length} staff`
        : `Updated with ${failed} error(s) — refresh and retry failures`
    );
  };

  return (
    <AppShell title="Staff Notifications">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Bell className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Staff Notification Recipients
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Control which internal users receive email alerts. Portal shipment
                requests email everyone with New Order Requests enabled. Unset
                preferences do not receive email.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={enableNewOrdersForActive}
            disabled={!!savingKey || loading}
            className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Enable New Orders for all active
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-auto underline text-red-600"
          >
            Retry
          </button>
        </div>
      )}

      {feedback && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name or email…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show inactive users
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No staff users match your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Staff member</th>
                  {NOTIFICATION_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="px-3 py-3 font-medium text-center whitespace-nowrap"
                      title={col.label}
                    >
                      {col.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr
                    key={user.userId}
                    className={user.active ? "bg-white" : "bg-slate-50 opacity-70"}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-slate-500 text-xs">{user.email}</div>
                      <div className="text-slate-400 text-xs capitalize mt-0.5">
                        {user.role}
                        {!user.active && " · inactive"}
                      </div>
                    </td>
                    {NOTIFICATION_COLUMNS.map((col) => {
                      const key = `${user.userId}:${col.id}`;
                      const enabled = user.settings[col.id];
                      const busy = savingKey === key || savingKey === "bulk:new_order";
                      return (
                        <td key={col.id} className="px-3 py-3 text-center">
                          <button
                            type="button"
                            disabled={busy || !user.active}
                            onClick={() => handleToggle(user, col.id)}
                            aria-label={`${enabled ? "Disable" : "Enable"} ${col.label} for ${user.name}`}
                            className={`
                              relative inline-flex w-11 h-6 rounded-full transition-colors disabled:opacity-40
                              ${enabled ? "bg-indigo-600" : "bg-slate-300"}
                            `}
                          >
                            {busy && savingKey === key ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                              </span>
                            ) : (
                              <span
                                className={`
                                  absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all
                                  ${enabled ? "left-6" : "left-1"}
                                `}
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Global kill-switches still apply under System Settings → Notifications
        (Order Notifications, Low Stock Alerts, Inbound Notifications).
      </p>
    </AppShell>
  );
}
