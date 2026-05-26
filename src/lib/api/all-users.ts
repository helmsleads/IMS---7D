import { UserRole } from "@/types/database";
import { ClientUserRole } from "@/lib/api/client-users";
import { parseFetchError } from "@/lib/api/parse-api-error";

export type AllUserType = "staff" | "client";

export interface AllUserRow {
  id: string;
  type: AllUserType;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  client: string | null;
  client_id: string | null;
  client_user_id: string | null;
  active: boolean;
  created_at: string;
}

export interface InviteAllUserData {
  user_type: AllUserType;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  client_id?: string;
}

export interface UpdateAllUserData {
  id: string;
  type: AllUserType;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  client_id?: string;
  client_user_id?: string;
}

export function splitName(fullName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { first_name: "", last_name: "" };
  const space = trimmed.indexOf(" ");
  if (space === -1) return { first_name: trimmed, last_name: "" };
  return {
    first_name: trimmed.slice(0, space),
    last_name: trimmed.slice(space + 1).trim(),
  };
}

export function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ");
}

export async function fetchAllUsers(): Promise<AllUserRow[]> {
  const res = await fetch("/api/all-users");
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to load users");
  }
  return data.users || [];
}

export async function inviteAllUser(
  payload: InviteAllUserData
): Promise<{ success: boolean; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/all-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", ...payload }),
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error: could not reach the server",
    };
  }

  if (!res.ok) {
    return {
      success: false,
      message: await parseFetchError(res, "Failed to send invitation"),
    };
  }

  const data = await res.json().catch(() => ({}));
  return {
    success: true,
    message: data.message || "Invitation email sent successfully",
  };
}

export async function updateAllUser(
  payload: UpdateAllUserData
): Promise<{ success: boolean; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/all-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error: could not reach the server",
    };
  }
  if (!res.ok) {
    return {
      success: false,
      message: await parseFetchError(res, "Failed to update user"),
    };
  }
  const data = await res.json().catch(() => ({}));
  return { success: true, message: data.message || "User updated successfully" };
}

export async function deleteAllUser(
  id: string,
  type: AllUserType
): Promise<{ success: boolean; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/all-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error: could not reach the server",
    };
  }
  if (!res.ok) {
    return {
      success: false,
      message: await parseFetchError(res, "Failed to delete user"),
    };
  }
  const data = await res.json().catch(() => ({}));
  return { success: true, message: data.message || "User removed successfully" };
}

export async function resendAllUserInvite(
  id: string,
  type: AllUserType,
  email: string
): Promise<{ success: boolean; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/all-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", id, type, email }),
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error: could not reach the server",
    };
  }

  if (!res.ok) {
    return {
      success: false,
      message: await parseFetchError(res, "Failed to resend invitation"),
    };
  }

  const data = await res.json().catch(() => ({}));
  return {
    success: true,
    message: data.message || "Invitation email resent successfully",
  };
}

export const STAFF_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrator" },
  { value: "warehouse", label: "Warehouse Staff" },
  { value: "viewer", label: "Viewer" },
];

export const CLIENT_ROLES: { value: ClientUserRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];
