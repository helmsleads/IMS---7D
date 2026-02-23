"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Bell,
  Plus,
  Pencil,
  Trash2,
  Star,
  CreditCard,
  Users,
  Mail,
  Phone,
  Shield,
  UserPlus,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import {
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  setMyDefaultAddress,
  PortalAddress,
  CreateAddressData,
} from "@/lib/api/portal-addresses";
import {
  getClientNotificationSettings,
  updateClientNotificationSetting,
  ClientNotificationSettings,
  ClientNotificationType,
} from "@/lib/api/portal-notifications";
import {
  getClientUsers,
  addUserToClientByEmail,
  invitePortalUser,
  updateClientUser,
  removeClientUser,
  ClientUserWithDetails,
  ClientUserRole,
  InviteUserData,
} from "@/lib/api/client-users";

type TabType = "addresses" | "notifications" | "team";

interface NotificationOption {
  id: ClientNotificationType;
  label: string;
  description: string;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    id: "order_updates",
    label: "Order Updates",
    description: "Get notified when your order status changes (confirmed, packed, shipped, delivered)",
  },
  {
    id: "shipment_tracking",
    label: "Shipment Tracking",
    description: "Receive tracking updates and delivery notifications for shipped orders",
  },
  {
    id: "invoice_reminders",
    label: "Invoice Reminders",
    description: "Receive reminders about upcoming or overdue invoices",
  },
  {
    id: "low_stock_alerts",
    label: "Low Stock Alerts",
    description: "Get notified when your inventory levels fall below reorder points",
  },
];

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
  { value: "PR", label: "Puerto Rico" },
];

const COUNTRIES = [
  { value: "USA", label: "United States" },
  { value: "CAN", label: "Canada" },
  { value: "MEX", label: "Mexico" },
  { value: "GBR", label: "United Kingdom" },
  { value: "AUS", label: "Australia" },
  { value: "DEU", label: "Germany" },
  { value: "FRA", label: "France" },
  { value: "JPN", label: "Japan" },
  { value: "CHN", label: "China" },
  { value: "IND", label: "India" },
  { value: "BRA", label: "Brazil" },
  { value: "OTHER", label: "Other" },
];

const BASE_ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const ROLE_OPTIONS_WITH_OWNER = [
  ...BASE_ROLE_OPTIONS,
  { value: "owner", label: "Owner" },
];

export default function PortalSettingsPage() {
  const { client, currentRole, user } = useClient();
  const [activeTab, setActiveTab] = useState<TabType>("addresses");
  const [addresses, setAddresses] = useState<PortalAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<PortalAddress | null>(null);
  const [addressForm, setAddressForm] = useState<CreateAddressData>({
    label: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
    is_default: false,
    is_billing: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Notification settings from API
  const [notificationSettings, setNotificationSettings] = useState<ClientNotificationSettings>({
    order_updates: true,
    shipment_tracking: true,
    invoice_reminders: true,
    low_stock_alerts: false,
  });
  const [savingNotification, setSavingNotification] = useState<string | null>(null);

  // Team members
  const [teamMembers, setTeamMembers] = useState<ClientUserWithDetails[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserMode, setAddUserMode] = useState<"invite" | "existing">("invite");
  const [existingUserEmail, setExistingUserEmail] = useState("");
  const [existingUserRole, setExistingUserRole] = useState<ClientUserRole>("member");
  const [inviteForm, setInviteForm] = useState<InviteUserData & { role: ClientUserRole }>({
    email: "",
    full_name: "",
    phone: "",
    title: "",
    role: "member",
  });
  const [sendInviteNow, setSendInviteNow] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");
  const [removingUser, setRemovingUser] = useState<string | null>(null);

  // Check if current user can manage team
  const canManageTeam = currentRole === "owner" || currentRole === "admin";

  // Compute role options based on current user's role
  const roleOptions = currentRole === "owner" ? ROLE_OPTIONS_WITH_OWNER : BASE_ROLE_OPTIONS;

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        const [addressData, notifSettings] = await Promise.all([
          getMyAddresses(client.id),
          getClientNotificationSettings(client.id),
        ]);
        setAddresses(addressData);
        setNotificationSettings(notifSettings);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client]);

  // Fetch team members when team tab is active
  useEffect(() => {
    const fetchTeam = async () => {
      if (!client || activeTab !== "team" || !canManageTeam) return;

      setLoadingTeam(true);
      try {
        const members = await getClientUsers(client.id);
        setTeamMembers(members);
      } catch (error) {
        console.error("Failed to fetch team members:", error);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeam();
  }, [client, activeTab, canManageTeam]);

  const resetAddressForm = () => {
    setAddressForm({
      label: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip: "",
      country: "USA",
      is_default: false,
      is_billing: false,
    });
    setEditingAddress(null);
    setShowAddressModal(false);
  };

  const openAddModal = () => {
    resetAddressForm();
    setShowAddressModal(true);
  };

  const handleEditAddress = (address: PortalAddress) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || "",
      address_line1: address.address_line1,
      address_line2: address.address_line2 || "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      is_default: address.is_default,
      is_billing: address.is_billing,
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setSaving(true);
    try {
      if (editingAddress) {
        const updated = await updateMyAddress(client.id, editingAddress.id, addressForm);
        setAddresses((prev) =>
          prev.map((addr) => (addr.id === updated.id ? updated : addr))
        );
      } else {
        const newAddress = await createMyAddress(client.id, addressForm);
        setAddresses((prev) => [newAddress, ...prev]);
      }
      resetAddressForm();
    } catch (error) {
      console.error("Failed to save address:", error);
      alert("Failed to save address. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!client) return;
    if (!confirm("Are you sure you want to delete this address?")) return;

    setDeleting(addressId);
    try {
      await deleteMyAddress(client.id, addressId);
      setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
    } catch (error) {
      console.error("Failed to delete address:", error);
      alert(error instanceof Error ? error.message : "Failed to delete address");
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!client) return;

    try {
      const updated = await setMyDefaultAddress(client.id, addressId);
      setAddresses((prev) =>
        prev.map((addr) => ({
          ...addr,
          is_default: addr.id === updated.id,
        }))
      );
    } catch (error) {
      console.error("Failed to set default address:", error);
    }
  };

  const toggleNotification = async (id: ClientNotificationType) => {
    if (!client) return;

    const newValue = !notificationSettings[id];

    // Optimistic update
    setNotificationSettings((prev) => ({
      ...prev,
      [id]: newValue,
    }));

    setSavingNotification(id);
    try {
      const result = await updateClientNotificationSetting(client.id, id, newValue);
      if (!result.success) {
        // Revert on error
        setNotificationSettings((prev) => ({
          ...prev,
          [id]: !newValue,
        }));
        console.error("Failed to update notification setting:", result.error);
      }
    } catch (error) {
      // Revert on error
      setNotificationSettings((prev) => ({
        ...prev,
        [id]: !newValue,
      }));
      console.error("Failed to update notification setting:", error);
    } finally {
      setSavingNotification(null);
    }
  };

  const formatAddress = (address: PortalAddress) => {
    const parts = [
      address.address_line1,
      address.address_line2,
      `${address.city}, ${address.state} ${address.zip}`,
      address.country !== "USA" ? address.country : null,
    ].filter(Boolean);
    return parts;
  };

  // Team management functions
  const resetUserForm = () => {
    setShowAddUserModal(false);
    setAddUserMode("invite");
    setExistingUserEmail("");
    setExistingUserRole("member");
    setInviteForm({
      email: "",
      full_name: "",
      phone: "",
      title: "",
      role: "member",
    });
    setSendInviteNow(true);
    setUserError("");
    setUserSuccess("");
  };

  const handleInviteUser = async (e: React.FormEvent, sendEmail: boolean = true) => {
    e.preventDefault();
    if (!client) return;

    setSavingUser(true);
    setSendInviteNow(sendEmail);
    setUserError("");
    setUserSuccess("");

    try {
      const result = await invitePortalUser(
        client.id,
        {
          email: inviteForm.email,
          full_name: inviteForm.full_name,
          phone: inviteForm.phone,
          title: inviteForm.title,
        },
        inviteForm.role,
        sendEmail
      );

      if (!result.success) {
        setUserError(result.message);
        return;
      }

      setUserSuccess(
        sendEmail
          ? "Invitation sent! They will receive an email to set up their account."
          : "User created successfully. You can send the invitation later."
      );

      // Refresh team members after a moment (user might not appear immediately)
      setTimeout(async () => {
        const members = await getClientUsers(client.id);
        setTeamMembers(members);
      }, 1000);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleAddExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setSavingUser(true);
    setUserError("");
    setUserSuccess("");

    try {
      const result = await addUserToClientByEmail(
        client.id,
        existingUserEmail,
        existingUserRole
      );

      if (!result.success) {
        setUserError(result.message);
        return;
      }

      // Refresh team members
      const members = await getClientUsers(client.id);
      setTeamMembers(members);
      resetUserForm();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Failed to add user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ClientUserRole) => {
    try {
      await updateClientUser(memberId, { role: newRole });
      setTeamMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role. Please try again.");
    }
  };

  const handleRemoveUser = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this user's access?")) return;

    setRemovingUser(memberId);
    try {
      await removeClientUser(memberId);
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error("Failed to remove user:", error);
      alert("Failed to remove user. Please try again.");
    } finally {
      setRemovingUser(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      case "member":
        return "bg-green-100 text-green-700";
      case "viewer":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage your addresses and notification preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("addresses")}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === "addresses"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Addresses
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            activeTab === "notifications"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Bell className="w-4 h-4" />
          Notifications
        </button>
        {canManageTeam && (
          <button
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === "team"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4" />
            Team
          </button>
        )}
      </div>

      {/* Addresses Tab */}
      {activeTab === "addresses" && (
        <div className="space-y-6">
          {/* Add Address Button */}
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Address
          </Button>

          {/* Address List */}
          {addresses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <Card key={address.id}>
                  {/* Label and Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-gray-900">
                      {address.label || "Address"}
                    </span>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                    {address.is_billing && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CreditCard className="w-3 h-3" />
                        Billing
                      </span>
                    )}
                  </div>

                  {/* Full Address */}
                  <div className="text-sm text-gray-600 space-y-0.5 mb-4">
                    {formatAddress(address).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAddress(address)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAddress(address.id)}
                      loading={deleting === address.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                    {!address.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(address.id)}
                      >
                        <Star className="w-3.5 h-3.5 mr-1.5" />
                        Set as Default
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Empty State */
            <Card>
              <div className="text-center py-12 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No addresses saved</p>
                <p className="text-sm mt-1 mb-4">
                  Add your shipping and billing addresses
                </p>
                <Button onClick={openAddModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Address
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Address Modal */}
      <Modal
        isOpen={showAddressModal}
        onClose={resetAddressForm}
        title={editingAddress ? "Edit Address" : "Add New Address"}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={resetAddressForm}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" loading={saving}>
              {editingAddress ? "Update Address" : "Save Address"}
            </Button>
          </div>
        }
      >
        <form id="address-form" onSubmit={handleSaveAddress} className="space-y-4">
          <Input
            label="Label"
            name="address-label"
            value={addressForm.label || ""}
            onChange={(e) =>
              setAddressForm({ ...addressForm, label: e.target.value })
            }
            placeholder="e.g., Home, Office, Warehouse"
          />

          <Input
            label="Address Line 1"
            name="address-line1"
            value={addressForm.address_line1}
            onChange={(e) =>
              setAddressForm({ ...addressForm, address_line1: e.target.value })
            }
            required
          />

          <Input
            label="Address Line 2"
            name="address-line2"
            value={addressForm.address_line2 || ""}
            onChange={(e) =>
              setAddressForm({ ...addressForm, address_line2: e.target.value })
            }
            placeholder="Apt, Suite, Unit, etc."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              name="address-city"
              value={addressForm.city}
              onChange={(e) =>
                setAddressForm({ ...addressForm, city: e.target.value })
              }
              required
            />
            <Select
              label="State"
              name="address-state"
              options={US_STATES}
              value={addressForm.state}
              onChange={(e) =>
                setAddressForm({ ...addressForm, state: e.target.value })
              }
              placeholder="Select state"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="ZIP Code"
              name="address-zip"
              value={addressForm.zip}
              onChange={(e) =>
                setAddressForm({ ...addressForm, zip: e.target.value })
              }
              required
            />
            <Select
              label="Country"
              name="address-country"
              options={COUNTRIES}
              value={addressForm.country || "USA"}
              onChange={(e) =>
                setAddressForm({ ...addressForm, country: e.target.value })
              }
              required
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addressForm.is_default}
                onChange={(e) =>
                  setAddressForm({ ...addressForm, is_default: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Set as default shipping address</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addressForm.is_billing}
                onChange={(e) =>
                  setAddressForm({ ...addressForm, is_billing: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Set as billing address</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Email Notifications
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose which notifications you&apos;d like to receive via email
            </p>

            <div className="space-y-4">
              {NOTIFICATION_OPTIONS.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                  <Toggle
                    checked={notificationSettings[option.id]}
                    onChange={() => toggleNotification(option.id)}
                    loading={savingNotification === option.id}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Save Note */}
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Notification preferences are saved automatically
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Changes to your notification settings will take effect immediately.
                  You can update these preferences at any time.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && canManageTeam && (
        <div className="space-y-6">
          {/* Add User Button */}
          <Button onClick={() => setShowAddUserModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Team Member
          </Button>

          {/* Team Members List */}
          {loadingTeam ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : teamMembers.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Team Members ({teamMembers.length})
              </h2>
              <div className="divide-y divide-gray-100">
                {teamMembers.map((member) => (
                  <div key={member.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {member.user?.full_name || "Unnamed User"}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </span>
                          {member.is_primary && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                              Primary
                            </span>
                          )}
                          {member.user_id === user?.id && (
                            <span className="text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {member.user?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {member.user.email}
                            </span>
                          )}
                          {member.user?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {member.user.phone}
                            </span>
                          )}
                        </div>
                        {member.user?.title && (
                          <p className="text-sm text-gray-500 mt-0.5">{member.user.title}</p>
                        )}
                      </div>

                      {/* Actions */}
                      {member.user_id !== user?.id && (
                        <div className="flex items-center gap-3">
                          {/* Role Selector */}
                          <div className="w-32">
                            <Select
                              name={`role-${member.id}`}
                              options={roleOptions}
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value as ClientUserRole)}
                            />
                          </div>

                          {/* Remove Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(member.id)}
                            loading={removingUser === member.id}
                            className="text-red-600 hover:bg-red-50"
                            title="Remove access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No team members yet</p>
                <p className="text-sm mt-1 mb-4">
                  Add team members to give them access to your company portal
                </p>
                <Button onClick={() => setShowAddUserModal(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Team Member
                </Button>
              </div>
            </Card>
          )}

          {/* Role Permissions Info */}
          <Card className="bg-gray-50 border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Shield className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Role Permissions</h3>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li><strong>Owner:</strong> Full access including team management</li>
                  <li><strong>Admin:</strong> Manage orders, inventory, and team members</li>
                  <li><strong>Member:</strong> Create orders and view inventory</li>
                  <li><strong>Viewer:</strong> View-only access to orders and inventory</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUserModal}
        onClose={resetUserForm}
        title="Add Team Member"
        size="lg"
      >
        {/* Mode Toggle */}
        <div className="flex border-b border-gray-200 -mx-4 -mt-4 mb-4">
          <button
            onClick={() => { setAddUserMode("invite"); setUserError(""); setUserSuccess(""); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              addUserMode === "invite"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Send Invite
          </button>
          <button
            onClick={() => { setAddUserMode("existing"); setUserError(""); setUserSuccess(""); }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              addUserMode === "existing"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Add Existing
          </button>
        </div>

        {/* Success Message */}
        {userSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {userSuccess}
          </div>
        )}

        {/* Error Message */}
        {userError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {userError}
          </div>
        )}

        {/* Invite User Form */}
        {addUserMode === "invite" && (
          <form onSubmit={handleInviteUser}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Send an email invitation. The user will set their own password when they accept.
              </p>

              <Input
                label="Email"
                name="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, email: e.target.value })
                }
                required
                placeholder="user@example.com"
              />

              <Input
                label="Full Name"
                name="invite-name"
                value={inviteForm.full_name}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, full_name: e.target.value })
                }
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  name="invite-phone"
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, phone: e.target.value })
                  }
                />
                <Input
                  label="Title"
                  name="invite-title"
                  value={inviteForm.title}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, title: e.target.value })
                  }
                  placeholder="e.g., Manager"
                />
              </div>

              <Select
                label="Role"
                name="invite-role"
                options={roleOptions}
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, role: e.target.value as ClientUserRole })
                }
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
              <Button variant="secondary" onClick={resetUserForm} type="button">
                Cancel
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={(e) => handleInviteUser(e as React.FormEvent, false)}
                loading={savingUser && !sendInviteNow}
              >
                Save
              </Button>
              <Button
                type="button"
                onClick={(e) => handleInviteUser(e as React.FormEvent, true)}
                loading={savingUser && sendInviteNow}
              >
                <Mail className="w-4 h-4 mr-2" />
                Save & Send Invitation
              </Button>
            </div>
          </form>
        )}

        {/* Add Existing User Form */}
        {addUserMode === "existing" && (
          <form onSubmit={handleAddExistingUser}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Add someone who already has a portal account to your team.
              </p>

              <Input
                label="Email Address"
                name="existing-email"
                type="email"
                value={existingUserEmail}
                onChange={(e) => setExistingUserEmail(e.target.value)}
                required
                placeholder="user@example.com"
              />

              <Select
                label="Role"
                name="existing-role"
                options={roleOptions}
                value={existingUserRole}
                onChange={(e) => setExistingUserRole(e.target.value as ClientUserRole)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
              <Button variant="secondary" onClick={resetUserForm} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={savingUser}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
