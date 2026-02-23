"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Package,
  FileText,
  Activity,
  LayoutDashboard,
  Plus,
  Briefcase,
  Pencil,
  Trash2,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  ExternalLink,
  X,
  Star,
  TrendingUp,
  Percent,
  Users,
  UserPlus,
  Shield,
  Eye,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { getClient, getClientInventory, getClientOrders, deleteClient, updateClient, ClientWithSummary, ClientInventoryItem, ClientOrder } from "@/lib/api/clients";
import Modal from "@/components/ui/Modal";
import {
  getClientServices,
  getClientAddons,
  removeClientService,
  removeClientAddon,
  ClientServiceWithDetails,
  ClientAddonWithDetails,
} from "@/lib/api/client-services";
import { getInvoices, InvoiceWithItems } from "@/lib/api/invoices";
import {
  getClientAddresses,
  createClientAddress,
  updateClientAddress,
  deleteClientAddress,
  setDefaultAddress,
} from "@/lib/api/client-addresses";
import { getIndustryDisplayName } from "@/lib/api/workflow-profiles";
import {
  getClientUsers,
  addUserToClientByEmail,
  invitePortalUser,
  updateClientUser,
  removeClientUser,
  updateUserProfile,
  ClientUserWithDetails,
} from "@/lib/api/client-users";
import { ClientAddress, ClientUserRole } from "@/types/database";
import {
  getClientProductValues,
  setClientProductValue,
  calculateClientProfitability,
  ClientProductValueWithProduct,
  ClientProfitability,
} from "@/lib/api/profitability";

type TabKey = "overview" | "inventory" | "orders" | "services" | "billing" | "addresses" | "users" | "profitability" | "activity";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  { key: "orders", label: "Orders", icon: <FileText className="w-4 h-4" /> },
  { key: "services", label: "Services", icon: <Briefcase className="w-4 h-4" /> },
  { key: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> },
  { key: "addresses", label: "Addresses", icon: <MapPin className="w-4 h-4" /> },
  { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
  { key: "profitability", label: "Profitability", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "activity", label: "Activity", icon: <Activity className="w-4 h-4" /> },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientWithSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [inventory, setInventory] = useState<ClientInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [services, setServices] = useState<ClientServiceWithDetails[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [addons, setAddons] = useState<ClientAddonWithDetails[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceWithItems[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ClientAddress | null>(null);
  const [addressFormData, setAddressFormData] = useState({
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
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [profitability, setProfitability] = useState<ClientProfitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [productValues, setProductValues] = useState<ClientProductValueWithProduct[]>([]);
  const [productValuesLoading, setProductValuesLoading] = useState(false);
  const [showEditValueModal, setShowEditValueModal] = useState(false);
  const [editingProductValue, setEditingProductValue] = useState<ClientProductValueWithProduct | null>(null);
  const [productValueFormData, setProductValueFormData] = useState({
    sale_price: "",
    cost: "",
  });
  const [productValueSubmitting, setProductValueSubmitting] = useState(false);
  const [clientUsers, setClientUsers] = useState<ClientUserWithDetails[]>([]);
  const [clientUsersLoading, setClientUsersLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserMode, setAddUserMode] = useState<"invite" | "existing">("invite");
  const [addUserFormData, setAddUserFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    title: "",
  });
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);
  const [addUserRole, setAddUserRole] = useState<ClientUserRole>("member");
  const [sendInviteNow, setSendInviteNow] = useState(true);
  const [addUserSubmitting, setAddUserSubmitting] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingWorkflowOverride, setUpdatingWorkflowOverride] = useState(false);

  const handleToggleProductWorkflowOverride = async () => {
    if (!client) return;
    setUpdatingWorkflowOverride(true);
    try {
      const updated = await updateClient(client.id, {
        allow_product_workflow_override: !client.allow_product_workflow_override,
      });
      setClient({
        ...client,
        allow_product_workflow_override: updated.allow_product_workflow_override,
      });
    } catch (error) {
      console.error("Failed to update client:", error);
      alert(error instanceof Error ? error.message : "Failed to update setting");
    } finally {
      setUpdatingWorkflowOverride(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setDeleting(true);
    try {
      await deleteClient(client.id);
      router.push("/clients");
    } catch (error) {
      console.error("Failed to delete client:", error);
      alert(error instanceof Error ? error.message : "Failed to delete client");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const data = await getClient(params.id as string);
        setClient(data);
      } catch (error) {
        console.error("Failed to fetch client:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchClient();
    }
  }, [params.id]);

  // Fetch inventory when tab changes to inventory
  useEffect(() => {
    const fetchInventory = async () => {
      if (activeTab !== "inventory" || !params.id) return;

      setInventoryLoading(true);
      try {
        const data = await getClientInventory(params.id as string);
        setInventory(data);
      } catch (error) {
        console.error("Failed to fetch inventory:", error);
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventory();
  }, [activeTab, params.id]);

  // Fetch orders when tab changes to orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (activeTab !== "orders" || !params.id) return;

      setOrdersLoading(true);
      try {
        const data = await getClientOrders(params.id as string);
        setOrders(data);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [activeTab, params.id]);

  // Fetch services and addons when tab changes to services
  useEffect(() => {
    const fetchServices = async () => {
      if (activeTab !== "services" || !params.id) return;

      setServicesLoading(true);
      setAddonsLoading(true);
      try {
        const [servicesData, addonsData] = await Promise.all([
          getClientServices(params.id as string),
          getClientAddons(params.id as string),
        ]);
        setServices(servicesData);
        setAddons(addonsData);
      } catch (error) {
        console.error("Failed to fetch services:", error);
      } finally {
        setServicesLoading(false);
        setAddonsLoading(false);
      }
    };

    fetchServices();
  }, [activeTab, params.id]);

  // Fetch invoices when tab changes to billing
  useEffect(() => {
    const fetchInvoices = async () => {
      if (activeTab !== "billing" || !params.id) return;

      setInvoicesLoading(true);
      try {
        const data = await getInvoices({ clientId: params.id as string });
        setInvoices(data);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setInvoicesLoading(false);
      }
    };

    fetchInvoices();
  }, [activeTab, params.id]);

  // Calculate billing summary
  const billingSummary = {
    totalInvoiced: invoices.reduce((sum, inv) => sum + inv.total, 0),
    totalPaid: invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.total, 0),
    outstandingBalance: invoices
      .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => sum + inv.total, 0),
  };

  // Fetch addresses when tab changes to addresses
  useEffect(() => {
    const fetchAddresses = async () => {
      if (activeTab !== "addresses" || !params.id) return;

      setAddressesLoading(true);
      try {
        const data = await getClientAddresses(params.id as string);
        setAddresses(data);
      } catch (error) {
        console.error("Failed to fetch addresses:", error);
      } finally {
        setAddressesLoading(false);
      }
    };

    fetchAddresses();
  }, [activeTab, params.id]);

  const resetAddressForm = () => {
    setAddressFormData({
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
  };

  const handleOpenAddressModal = (address?: ClientAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressFormData({
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
    } else {
      resetAddressForm();
    }
    setShowAddressModal(true);
  };

  const handleCloseAddressModal = () => {
    setShowAddressModal(false);
    resetAddressForm();
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.id || !addressFormData.address_line1 || !addressFormData.city) return;

    setAddressSubmitting(true);
    try {
      if (editingAddress) {
        const updated = await updateClientAddress(editingAddress.id, addressFormData);
        setAddresses(addresses.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createClientAddress({
          ...addressFormData,
          client_id: params.id as string,
        });
        setAddresses([...addresses, created]);
      }
      handleCloseAddressModal();
    } catch (error) {
      console.error("Failed to save address:", error);
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await deleteClientAddress(addressId);
      setAddresses(addresses.filter((a) => a.id !== addressId));
    } catch (error) {
      console.error("Failed to delete address:", error);
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!params.id) return;
    try {
      await setDefaultAddress(params.id as string, addressId);
      setAddresses(
        addresses.map((a) => ({
          ...a,
          is_default: a.id === addressId,
        }))
      );
    } catch (error) {
      console.error("Failed to set default address:", error);
    }
  };

  // Fetch profitability when tab changes to profitability
  useEffect(() => {
    const fetchProfitability = async () => {
      if (activeTab !== "profitability" || !params.id) return;

      setProfitabilityLoading(true);
      setProductValuesLoading(true);
      try {
        // Get current month date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDate = startOfMonth.toISOString().split("T")[0];
        const endDate = endOfMonth.toISOString().split("T")[0];

        const [profitData, valuesData] = await Promise.all([
          calculateClientProfitability(params.id as string, startDate, endDate),
          getClientProductValues(params.id as string),
        ]);
        setProfitability(profitData);
        setProductValues(valuesData);
      } catch (error) {
        console.error("Failed to fetch profitability:", error);
      } finally {
        setProfitabilityLoading(false);
        setProductValuesLoading(false);
      }
    };

    fetchProfitability();
  }, [activeTab, params.id]);

  // Fetch client users when tab changes to users or overview
  useEffect(() => {
    const fetchClientUsers = async () => {
      if ((activeTab !== "users" && activeTab !== "overview") || !params.id) return;
      if (clientUsers.length > 0 && activeTab === "overview") return; // Don't refetch if already loaded

      setClientUsersLoading(true);
      try {
        const data = await getClientUsers(params.id as string);
        setClientUsers(data);
      } catch (error) {
        console.error("Failed to fetch client users:", error);
      } finally {
        setClientUsersLoading(false);
      }
    };

    fetchClientUsers();
  }, [activeTab, params.id]);

  const resetAddUserForm = () => {
    setAddUserFormData({
      full_name: "",
      email: "",
      phone: "",
      title: "",
    });
    setAddUserRole("member");
    setSendInviteNow(true);
    setAddUserError(null);
    setAddUserSuccess(null);
    setAddUserMode("invite");
  };

  const handleAddUser = async (e: React.FormEvent, sendEmail: boolean = true) => {
    e.preventDefault();
    if (!params.id) return;

    setAddUserSubmitting(true);
    setSendInviteNow(sendEmail);
    setAddUserError(null);
    setAddUserSuccess(null);

    try {
      let result;

      if (addUserMode === "invite") {
        // Create/invite user
        if (!addUserFormData.email.trim()) {
          setAddUserError("Email is required");
          setAddUserSubmitting(false);
          return;
        }

        result = await invitePortalUser(
          params.id as string,
          {
            email: addUserFormData.email.trim(),
            full_name: addUserFormData.full_name.trim() || undefined,
            phone: addUserFormData.phone.trim() || undefined,
            title: addUserFormData.title.trim() || undefined,
          },
          addUserRole,
          sendEmail
        );

        if (result.success) {
          setAddUserSuccess(
            sendEmail
              ? "Invitation sent! They will receive an email to set up their account."
              : "User created successfully. You can send the invitation later."
          );
          // Refresh users list after a moment
          setTimeout(async () => {
            const updatedUsers = await getClientUsers(params.id as string);
            setClientUsers(updatedUsers);
          }, 1000);
          return;
        }
      } else {
        // Add existing user
        if (!addUserFormData.email.trim()) {
          setAddUserError("Email is required");
          setAddUserSubmitting(false);
          return;
        }

        result = await addUserToClientByEmail(
          params.id as string,
          addUserFormData.email.trim(),
          addUserRole
        );

        if (result.success) {
          // Refresh the users list
          const updatedUsers = await getClientUsers(params.id as string);
          setClientUsers(updatedUsers);
          setShowAddUserModal(false);
          resetAddUserForm();
          return;
        }
      }

      if (!result.success) {
        setAddUserError(result.message);
      }
    } catch (error) {
      console.error("Failed to add user:", error);
      setAddUserError("Failed to add user. Please try again.");
    } finally {
      setAddUserSubmitting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user's access?")) return;

    try {
      await removeClientUser(userId);
      setClientUsers(clientUsers.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: ClientUserRole) => {
    try {
      await updateClientUser(userId, { role: newRole });
      setClientUsers(
        clientUsers.map((u) =>
          u.id === userId ? { ...u, role: newRole } : u
        )
      );
    } catch (error) {
      console.error("Failed to update user role:", error);
    }
  };

  const handleOpenEditValueModal = (productValue: ClientProductValueWithProduct) => {
    setEditingProductValue(productValue);
    setProductValueFormData({
      sale_price: productValue.sale_price?.toString() || "",
      cost: productValue.cost?.toString() || "",
    });
    setShowEditValueModal(true);
  };

  const handleCloseEditValueModal = () => {
    setShowEditValueModal(false);
    setEditingProductValue(null);
    setProductValueFormData({ sale_price: "", cost: "" });
  };

  const handleSaveProductValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.id || !editingProductValue) return;

    setProductValueSubmitting(true);
    try {
      const salePrice = productValueFormData.sale_price
        ? parseFloat(productValueFormData.sale_price)
        : null;
      const cost = productValueFormData.cost
        ? parseFloat(productValueFormData.cost)
        : null;

      await setClientProductValue(
        params.id as string,
        editingProductValue.product_id,
        salePrice,
        cost
      );

      // Update local state
      setProductValues(
        productValues.map((pv) =>
          pv.product_id === editingProductValue.product_id
            ? { ...pv, sale_price: salePrice, cost: cost }
            : pv
        )
      );
      handleCloseEditValueModal();
    } catch (error) {
      console.error("Failed to save product value:", error);
    } finally {
      setProductValueSubmitting(false);
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to remove this service?")) return;
    try {
      await removeClientService(serviceId);
      setServices(services.filter((s) => s.id !== serviceId));
    } catch (error) {
      console.error("Failed to remove service:", error);
    }
  };

  const handleRemoveAddon = async (addonId: string) => {
    if (!confirm("Are you sure you want to remove this add-on?")) return;
    try {
      await removeClientAddon(addonId);
      setAddons(addons.filter((a) => a.id !== addonId));
    } catch (error) {
      console.error("Failed to remove add-on:", error);
    }
  };

  if (loading) {
    return (
      <AppShell title="Loading..." subtitle="">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title="Client Not Found" subtitle="">
        <Card>
          <p className="text-gray-600">The requested client could not be found.</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push("/clients")}
          >
            Back to Clients
          </Button>
        </Card>
      </AppShell>
    );
  }

  const formatAddress = () => {
    const parts = [
      client.address_line1,
      client.address_line2,
      [client.city, client.state, client.zip].filter(Boolean).join(", "),
    ].filter(Boolean);
    return parts.length > 0 ? parts : null;
  };

  const address = formatAddress();

  const headerActions = (
    <div className="flex items-center gap-3">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setShowDeleteModal(true)}
      >
        <Trash2 className="w-4 h-4 mr-1" />
        Delete
      </Button>
    </div>
  );

  return (
    <AppShell
      title={client.company_name}
      subtitle={client.industries?.map(i => getIndustryDisplayName(i)).join(", ") || "No industries"}
      actions={headerActions}
    >
      <Breadcrumbs items={[
        { label: "Clients", href: "/clients" },
        { label: client.company_name || "Client Details" }
      ]} />
      {/* Client Info Header */}
      <div className="mb-6">
        <Card>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold text-gray-900">
                  {client.company_name}
                </h2>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    client.active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {client.active ? "Active" : "Inactive"}
                </span>
{clientUsers.find(u => u.is_primary)?.user_id ? (
                  <a
                    href={`/portal/dashboard?view_user=${clientUsers.find(u => u.is_primary)?.user_id}&view_client=${client.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Portal
                  </a>
                ) : clientUsers.length > 0 ? (
                  <a
                    href={`/portal/dashboard?view_user=${clientUsers[0].user_id}&view_client=${client.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Portal
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                    <Eye className="w-3.5 h-3.5" />
                    No users
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  <span>{client.industries?.map(i => getIndustryDisplayName(i)).join(", ") || "No industries"}</span>
                </div>
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5" />
                    <div>
                      {address.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex gap-6 md:gap-8">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {client.inventory_summary.total_units.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Units in Stock</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                ${client.inventory_summary.total_value.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Inventory Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {client.order_summary.total_orders}
              </p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
      </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {client.inventory_summary.total_units.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Total Inventory</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {client.order_summary.pending_inbound + client.order_summary.pending_outbound}
                  </p>
                  <p className="text-sm text-gray-500">Active Orders</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {client.order_summary.total_orders}
                  </p>
                  <p className="text-sm text-gray-500">Total Orders</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Authorized Users */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Authorized Users</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("users")}
                >
                  View All
                </Button>
              </div>
              {clientUsers.length > 0 ? (
                <div className="space-y-3">
                  {clientUsers.slice(0, 3).map((cu) => (
                    <div key={cu.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {cu.user?.full_name?.charAt(0) || cu.user?.email?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {cu.user?.full_name || cu.user?.email || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{cu.role}</p>
                      </div>
                      {cu.is_primary && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}
                  {clientUsers.length > 3 && (
                    <p className="text-sm text-gray-500">
                      +{clientUsers.length - 3} more users
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No users assigned</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => setActiveTab("users")}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                </div>
              )}
            </Card>

            {/* Shipping Address */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
              {address ? (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="text-gray-900">
                    {address.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No shipping address on file</p>
              )}
            </Card>

            {/* Portal Access */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Portal Access</h3>
              {client.auth_id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-700">Enabled</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Client can log in to the portal using their email address to view inventory and orders.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span className="text-sm font-medium text-gray-600">Not Enabled</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Portal access has not been set up for this client.
                  </p>
                </div>
              )}
            </Card>

            {/* Account Info */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      client.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {client.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Created</span>
                  <span className="text-gray-900">
                    {new Date(client.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </Card>

            {/* Industry & Workflow */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Industries & Workflow</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Product Types</p>
                  <div className="flex flex-wrap gap-2">
                    {client.industries?.length > 0 ? (
                      client.industries.map((ind) => (
                        <span
                          key={ind}
                          className="inline-flex px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full"
                        >
                          {getIndustryDisplayName(ind)}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">No industries selected</span>
                    )}
                  </div>
                </div>

                {client.workflow_profile ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Workflow Profile</p>
                    <p className="font-medium text-gray-900">{client.workflow_profile.name}</p>
                    {client.workflow_profile.description && (
                      <p className="text-sm text-gray-600 mt-1">{client.workflow_profile.description}</p>
                    )}

                    {/* Compliance badges */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {client.workflow_profile.requires_lot_tracking && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Lot Tracking
                        </span>
                      )}
                      {client.workflow_profile.requires_expiration_dates && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Expiration Dates
                        </span>
                      )}
                      {client.workflow_profile.requires_age_verification && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Age Verification
                        </span>
                      )}
                      {client.workflow_profile.requires_ttb_compliance && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          TTB Compliance
                        </span>
                      )}
                      {client.workflow_profile.has_state_restrictions && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          State Restrictions
                        </span>
                      )}
                    </div>

                    {/* Allowed container types */}
                    {client.workflow_profile.allowed_container_types && client.workflow_profile.allowed_container_types.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Allowed Container Types</p>
                        <p className="text-sm text-gray-700">
                          {client.workflow_profile.allowed_container_types.map(t =>
                            t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                          ).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Workflow Profile</p>
                    <p className="text-gray-500 italic">No profile assigned</p>
                  </div>
                )}

                {/* Product Workflow Override Toggle */}
                {client.workflow_profile && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Allow Product-Level Workflow Override
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          When enabled, individual products can have their own workflow profile instead of using the client default
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleProductWorkflowOverride}
                        disabled={updatingWorkflowOverride}
                        className={`
                          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                          ${updatingWorkflowOverride ? 'opacity-50 cursor-not-allowed' : ''}
                          ${client.allow_product_workflow_override ? 'bg-blue-600' : 'bg-gray-200'}
                        `}
                      >
                        <span
                          className={`
                            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                            transition duration-200 ease-in-out
                            ${client.allow_product_workflow_override ? 'translate-x-5' : 'translate-x-0'}
                          `}
                        />
                      </button>
                    </div>
                    {client.allow_product_workflow_override && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-700">
                          <strong>Enabled:</strong> Products for this client can now have individual workflow profiles assigned.
                          Edit each product to set a specific workflow, or leave blank to use the client default.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-4">
          {/* Header with action */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Inventory at 7D Warehouse
            </h3>
            <Button onClick={() => router.push(`/inventory/assign?client=${client.id}`)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Inventory
            </Button>
          </div>

          {inventory.length === 0 && !inventoryLoading ? (
            <Card>
              <EmptyState
                icon={<Package className="w-12 h-12" />}
                title="No inventory"
                description="This client doesn't have any inventory at 7D yet"
                action={
                  <Button onClick={() => router.push(`/inventory/assign?client=${client.id}`)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Inventory
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card padding="none">
              <Table
                columns={[
                  {
                    key: "product",
                    header: "Product",
                    render: (item: ClientInventoryItem) => (
                      <div>
                        <p className="font-medium text-gray-900">{item.product.name}</p>
                        <p className="text-sm text-gray-500">{item.product.sku}</p>
                      </div>
                    ),
                  },
                  {
                    key: "location",
                    header: "Location",
                    render: (item: ClientInventoryItem) => (
                      <div>
                        <p className="text-gray-900">{item.location.name}</p>
                        {(item.location.city || item.location.state) && (
                          <p className="text-sm text-gray-500">
                            {[item.location.city, item.location.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "qty_on_hand",
                    header: "Qty On Hand",
                    render: (item: ClientInventoryItem) => (
                      <span className="font-medium text-gray-900">
                        {item.qty_on_hand.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "qty_reserved",
                    header: "Qty Reserved",
                    render: (item: ClientInventoryItem) => (
                      <span className={item.qty_reserved > 0 ? "text-amber-600" : "text-gray-500"}>
                        {item.qty_reserved.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "available",
                    header: "Available",
                    render: (item: ClientInventoryItem) => {
                      const available = item.qty_on_hand - item.qty_reserved;
                      return (
                        <span className={`font-medium ${available > 0 ? "text-green-600" : "text-gray-500"}`}>
                          {available.toLocaleString()}
                        </span>
                      );
                    },
                  },
                ]}
                data={inventory}
                loading={inventoryLoading}
                emptyMessage="No inventory found"
              />
            </Card>
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Header with action */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Orders
            </h3>
            <Button onClick={() => router.push(`/outbound/new?client=${client.id}`)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Order
            </Button>
          </div>

          {orders.length === 0 && !ordersLoading ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-12 h-12" />}
                title="No orders"
                description="This client doesn't have any orders yet"
                action={
                  <Button onClick={() => router.push(`/outbound/new?client=${client.id}`)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create Order
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card padding="none">
              <Table
                columns={[
                  {
                    key: "order_number",
                    header: "Order Number",
                    render: (order: ClientOrder) => (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.order_number}</span>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            order.type === "inbound"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {order.type === "inbound" ? "Inbound" : "Outbound"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (order: ClientOrder) => {
                      const statusColors: Record<string, string> = {
                        pending: "bg-yellow-100 text-yellow-800",
                        confirmed: "bg-blue-100 text-blue-800",
                        processing: "bg-purple-100 text-purple-800",
                        packed: "bg-indigo-100 text-indigo-800",
                        shipped: "bg-green-100 text-green-800",
                        delivered: "bg-gray-100 text-gray-800",
                        received: "bg-green-100 text-green-800",
                        in_transit: "bg-blue-100 text-blue-800",
                        cancelled: "bg-red-100 text-red-800",
                      };
                      return (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            statusColors[order.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace("_", " ")}
                        </span>
                      );
                    },
                  },
                  {
                    key: "items",
                    header: "Items",
                    render: (order: ClientOrder) => (
                      <span className="text-gray-600">{order.item_count} items</span>
                    ),
                  },
                  {
                    key: "date",
                    header: "Date",
                    render: (order: ClientOrder) => (
                      <span className="text-gray-600">
                        {new Date(order.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    ),
                  },
                ]}
                data={orders}
                loading={ordersLoading}
                onRowClick={(order) =>
                  router.push(`/${order.type === "inbound" ? "inbound" : "outbound"}/${order.id}`)
                }
                emptyMessage="No orders found"
              />
            </Card>
          )}
        </div>
      )}

      {activeTab === "services" && (
        <div className="space-y-6">
          {/* Client Services */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Services</h3>
              <Button onClick={() => router.push(`/clients/${client.id}/services/assign`)}>
                <Plus className="w-4 h-4 mr-1" />
                Assign Service
              </Button>
            </div>

            {services.length === 0 && !servicesLoading ? (
              <Card>
                <EmptyState
                  icon={<Briefcase className="w-12 h-12" />}
                  title="No services assigned"
                  description="Assign services to this client to track billing and service levels"
                  action={
                    <Button onClick={() => router.push(`/clients/${client.id}/services/assign`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Assign Service
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card padding="none">
                <Table
                  columns={[
                    {
                      key: "service",
                      header: "Service",
                      render: (item: ClientServiceWithDetails) => (
                        <div>
                          <p className="font-medium text-gray-900">{item.service.name}</p>
                          {item.service.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {item.service.description}
                            </p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "tier",
                      header: "Tier",
                      render: (item: ClientServiceWithDetails) => (
                        <span className="text-gray-600">
                          {item.tier?.name || "No tier"}
                        </span>
                      ),
                    },
                    {
                      key: "price",
                      header: "Price",
                      render: (item: ClientServiceWithDetails) => {
                        const price = item.custom_price ?? item.service.base_price;
                        const unit = item.custom_price_unit ?? item.service.price_unit;
                        return (
                          <div>
                            <span className="font-medium text-gray-900">
                              {price != null ? `$${price.toFixed(2)}` : "—"}
                            </span>
                            {unit && (
                              <span className="text-sm text-gray-500 ml-1">/{unit}</span>
                            )}
                            {item.custom_price != null && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (item: ClientServiceWithDetails) => (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            item.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      ),
                    },
                    {
                      key: "started_at",
                      header: "Started",
                      render: (item: ClientServiceWithDetails) => (
                        <span className="text-gray-600">
                          {item.started_at
                            ? new Date(item.started_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (item: ClientServiceWithDetails) => (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/clients/${client.id}/services/${item.id}/edit`)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveService(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  data={services.filter((s) => s.is_active)}
                  loading={servicesLoading}
                  emptyMessage="No services assigned"
                />
              </Card>
            )}
          </div>

          {/* Client Add-ons */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Add-ons</h3>
              <Button onClick={() => router.push(`/clients/${client.id}/addons/assign`)}>
                <Plus className="w-4 h-4 mr-1" />
                Assign Add-on
              </Button>
            </div>

            {addons.length === 0 && !addonsLoading ? (
              <Card>
                <EmptyState
                  icon={<Plus className="w-12 h-12" />}
                  title="No add-ons assigned"
                  description="Add-ons provide additional services beyond the base service"
                  action={
                    <Button onClick={() => router.push(`/clients/${client.id}/addons/assign`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Assign Add-on
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card padding="none">
                <Table
                  columns={[
                    {
                      key: "addon",
                      header: "Add-on",
                      render: (item: ClientAddonWithDetails) => (
                        <div>
                          <p className="font-medium text-gray-900">{item.addon.name}</p>
                          {item.addon.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {item.addon.description}
                            </p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "service",
                      header: "Service",
                      render: () => (
                        <span className="text-gray-600">—</span>
                      ),
                    },
                    {
                      key: "price",
                      header: "Price",
                      render: (item: ClientAddonWithDetails) => {
                        const price = item.custom_price ?? item.addon.price;
                        const unit = item.addon.price_unit;
                        return (
                          <div>
                            <span className="font-medium text-gray-900">
                              {price != null ? `$${price.toFixed(2)}` : "—"}
                            </span>
                            {unit && (
                              <span className="text-sm text-gray-500 ml-1">/{unit}</span>
                            )}
                            {item.custom_price != null && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (item: ClientAddonWithDetails) => (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            item.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      ),
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (item: ClientAddonWithDetails) => (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/clients/${client.id}/addons/${item.id}/edit`)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveAddon(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  data={addons.filter((a) => a.is_active)}
                  loading={addonsLoading}
                  emptyMessage="No add-ons assigned"
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Billing Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${billingSummary.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-500">Total Invoiced</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${billingSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-500">Total Paid</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${billingSummary.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-500">Outstanding</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">Net 30</p>
                  <p className="text-sm text-gray-500">Payment Terms</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Invoices */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
              <div className="flex gap-2">
                <Link href={`/clients/${client.id}/billing`}>
                  <Button variant="secondary">
                    <DollarSign className="w-4 h-4 mr-1" />
                    Rate Cards
                  </Button>
                </Link>
                <Link href={`/billing?client=${client.id}`}>
                  <Button variant="secondary">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View All Invoices
                  </Button>
                </Link>
                <Button onClick={() => router.push(`/billing/generate?client=${client.id}`)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Generate Invoice
                </Button>
              </div>
            </div>

            {invoices.length === 0 && !invoicesLoading ? (
              <Card>
                <EmptyState
                  icon={<CreditCard className="w-12 h-12" />}
                  title="No invoices"
                  description="No invoices have been generated for this client yet"
                  action={
                    <Button onClick={() => router.push(`/billing/generate?client=${client.id}`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Generate Invoice
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card padding="none">
                <Table
                  columns={[
                    {
                      key: "invoice_number",
                      header: "Invoice Number",
                      render: (invoice: InvoiceWithItems) => (
                        <Link
                          href={`/billing/${invoice.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {invoice.invoice_number}
                        </Link>
                      ),
                    },
                    {
                      key: "period",
                      header: "Period",
                      render: (invoice: InvoiceWithItems) => (
                        <span className="text-gray-600">
                          {new Date(invoice.period_start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {" - "}
                          {new Date(invoice.period_end).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ),
                    },
                    {
                      key: "total",
                      header: "Total",
                      render: (invoice: InvoiceWithItems) => (
                        <span className="font-medium text-gray-900">
                          ${invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (invoice: InvoiceWithItems) => {
                        const statusColors: Record<string, string> = {
                          draft: "bg-gray-100 text-gray-800",
                          sent: "bg-blue-100 text-blue-800",
                          paid: "bg-green-100 text-green-800",
                          overdue: "bg-red-100 text-red-800",
                          cancelled: "bg-gray-100 text-gray-600",
                        };
                        return (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              statusColors[invoice.status] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        );
                      },
                    },
                    {
                      key: "due_date",
                      header: "Due Date",
                      render: (invoice: InvoiceWithItems) => {
                        if (!invoice.due_date) return <span className="text-gray-400">—</span>;
                        const dueDate = new Date(invoice.due_date);
                        const isOverdue = invoice.status !== "paid" && dueDate < new Date();
                        return (
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>
                            {dueDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        );
                      },
                    },
                  ]}
                  data={invoices.slice(0, 10)}
                  loading={invoicesLoading}
                  onRowClick={(invoice) => router.push(`/billing/${invoice.id}`)}
                  emptyMessage="No invoices found"
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "addresses" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Client Addresses</h3>
            <Button onClick={() => handleOpenAddressModal()}>
              <Plus className="w-4 h-4 mr-1" />
              Add Address
            </Button>
          </div>

          {addresses.length === 0 && !addressesLoading ? (
            <Card>
              <EmptyState
                icon={<MapPin className="w-12 h-12" />}
                title="No addresses"
                description="Add shipping and billing addresses for this client"
                action={
                  <Button onClick={() => handleOpenAddressModal()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Address
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addressesLoading ? (
                <>
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                        <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                      </div>
                    </Card>
                  ))}
                </>
              ) : (
                addresses.map((address) => (
                  <Card key={address.id}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">
                            {address.label || "Address"}
                          </h4>
                          {address.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              <Star className="w-3 h-3 mr-1" />
                              Default
                            </span>
                          )}
                          {address.is_billing && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              <CreditCard className="w-3 h-3 mr-1" />
                              Billing
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-0.5">
                          <p>{address.address_line1}</p>
                          {address.address_line2 && <p>{address.address_line2}</p>}
                          <p>
                            {address.city}, {address.state} {address.zip}
                          </p>
                          <p>{address.country}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!address.is_default && (
                          <button
                            onClick={() => handleSetDefaultAddress(address.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="Set as Default"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenAddressModal(address)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "profitability" && (
        <div className="space-y-6">
          {/* Profitability Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {profitabilityLoading ? "..." : `$${(profitability?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-sm text-gray-500">Total Sales</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {profitabilityLoading ? "..." : `$${(profitability?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-sm text-gray-500">Product Cost</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">$0.00</p>
                  <p className="text-sm text-gray-500">7D Costs</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className={`text-2xl font-semibold ${(profitability?.grossProfit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {profitabilityLoading ? "..." : `$${(profitability?.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-sm text-gray-500">Net Profit</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Percent className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className={`text-2xl font-semibold ${(profitability?.marginPercent || 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {profitabilityLoading ? "..." : `${(profitability?.marginPercent || 0).toFixed(1)}%`}
                  </p>
                  <p className="text-sm text-gray-500">Net Margin</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Product Values */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Product Values</h3>
              <div className="flex gap-2">
                <Link href={`/profitability?client=${client.id}`}>
                  <Button variant="secondary">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Full Report
                  </Button>
                </Link>
                <Button onClick={() => router.push(`/clients/${client.id}/profitability/edit`)}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit Product Values
                </Button>
              </div>
            </div>

            {productValues.length === 0 && !productValuesLoading ? (
              <Card>
                <EmptyState
                  icon={<TrendingUp className="w-12 h-12" />}
                  title="No product values set"
                  description="Set custom sale prices and costs for this client's products"
                  action={
                    <Button onClick={() => router.push(`/clients/${client.id}/profitability/edit`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Product Values
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card padding="none">
                <Table
                  columns={[
                    {
                      key: "product",
                      header: "Product",
                      render: (item: ClientProductValueWithProduct) => (
                        <div>
                          <p className="font-medium text-gray-900">{item.product.name}</p>
                        </div>
                      ),
                    },
                    {
                      key: "sku",
                      header: "SKU",
                      render: (item: ClientProductValueWithProduct) => (
                        <span className="text-gray-600 font-mono text-sm">
                          {item.product.sku}
                        </span>
                      ),
                    },
                    {
                      key: "sale_price",
                      header: "Sale Price",
                      render: (item: ClientProductValueWithProduct) => (
                        <span className="font-medium text-gray-900">
                          {item.sale_price != null
                            ? `$${item.sale_price.toFixed(2)}`
                            : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "cost",
                      header: "Cost",
                      render: (item: ClientProductValueWithProduct) => (
                        <span className="text-gray-600">
                          {item.cost != null ? `$${item.cost.toFixed(2)}` : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "margin",
                      header: "Margin",
                      render: (item: ClientProductValueWithProduct) => {
                        if (item.sale_price == null || item.cost == null) {
                          return <span className="text-gray-400">—</span>;
                        }
                        const margin = item.sale_price - item.cost;
                        const marginPercent =
                          item.sale_price > 0
                            ? (margin / item.sale_price) * 100
                            : 0;
                        return (
                          <span
                            className={`font-medium ${
                              margin >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            ${margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                          </span>
                        );
                      },
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (item: ClientProductValueWithProduct) => (
                        <button
                          onClick={() => handleOpenEditValueModal(item)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      ),
                    },
                  ]}
                  data={productValues}
                  loading={productValuesLoading}
                  emptyMessage="No product values set"
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Authorized Users</h3>
            <Button onClick={() => setShowAddUserModal(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              Add User
            </Button>
          </div>

          {clientUsers.length === 0 && !clientUsersLoading ? (
            <Card>
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title="No authorized users"
                description="Add users who should have portal access to this client's data"
                action={
                  <Button onClick={() => setShowAddUserModal(true)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add User
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card padding="none">
              <Table
                columns={[
                  {
                    key: "user",
                    header: "User",
                    render: (user: ClientUserWithDetails) => (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {(user.user?.full_name || user.user?.email)?.charAt(0).toUpperCase() || "U"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.user?.full_name || user.user?.email || `User ${user.user_id.slice(0, 8)}...`}
                          </p>
                          {user.user?.full_name && user.user?.email && (
                            <p className="text-sm text-gray-500">{user.user.email}</p>
                          )}
                          {user.is_primary && (
                            <span className="text-xs text-blue-600">Primary Client</span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "title",
                    header: "Title",
                    render: (user: ClientUserWithDetails) => (
                      <span className="text-gray-600">
                        {user.user?.title || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    render: (user: ClientUserWithDetails) => (
                      <span className="text-gray-600">
                        {user.user?.phone || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "role",
                    header: "Role",
                    render: (user: ClientUserWithDetails) => (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleUpdateUserRole(user.id, e.target.value as ClientUserRole)
                        }
                        className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ),
                  },
                  {
                    key: "added",
                    header: "Added",
                    render: (user: ClientUserWithDetails) => (
                      <span className="text-gray-600">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (user: ClientUserWithDetails) => (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/portal/dashboard?view_user=${user.user_id}`}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View Portal"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Remove access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={clientUsers}
                loading={clientUsersLoading}
                emptyMessage="No authorized users"
              />
            </Card>
          )}

          <Card>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900">User Roles</h4>
                <ul className="mt-2 text-sm text-gray-600 space-y-1">
                  <li><strong>Owner:</strong> Full access including billing and user management</li>
                  <li><strong>Admin:</strong> Can manage orders and inventory</li>
                  <li><strong>Member:</strong> Standard portal access</li>
                  <li><strong>Viewer:</strong> Read-only access</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "activity" && (
        <Card>
          <EmptyState
            icon={<Activity className="w-12 h-12" />}
            title="Activity History"
            description="A complete log of inventory changes, orders, and account updates for this client will appear here."
          />
        </Card>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {addUserMode === "create" ? "Create New User" : "Add Existing User"}
              </h2>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  resetAddUserForm();
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
                  onClick={() => { setAddUserMode("invite"); setAddUserError(null); setAddUserSuccess(null); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    addUserMode === "invite"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => { setAddUserMode("existing"); setAddUserError(null); setAddUserSuccess(null); }}
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

            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              {addUserSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{addUserSuccess}</p>
                </div>
              )}

              {addUserError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{addUserError}</p>
                </div>
              )}

              {addUserMode === "invite" ? (
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
                      value={addUserFormData.email}
                      onChange={(e) => setAddUserFormData({ ...addUserFormData, email: e.target.value })}
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
                      value={addUserFormData.full_name}
                      onChange={(e) => setAddUserFormData({ ...addUserFormData, full_name: e.target.value })}
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
                        value={addUserFormData.phone}
                        onChange={(e) => setAddUserFormData({ ...addUserFormData, phone: e.target.value })}
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
                        value={addUserFormData.title}
                        onChange={(e) => setAddUserFormData({ ...addUserFormData, title: e.target.value })}
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
                      value={addUserFormData.email}
                      onChange={(e) => setAddUserFormData({ ...addUserFormData, email: e.target.value })}
                      required
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The user must already have a portal account to be added.
                    </p>
                  </div>
                </>
              )}

              {/* Role - shown for both modes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value as ClientUserRole)}
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
                    setShowAddUserModal(false);
                    resetAddUserForm();
                  }}
                  disabled={addUserSubmitting}
                >
                  {addUserSuccess ? "Close" : "Cancel"}
                </Button>
                {!addUserSuccess && addUserMode === "invite" && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(e) => handleAddUser(e as any, false)}
                      disabled={addUserSubmitting || !addUserFormData.email.trim()}
                      loading={addUserSubmitting && !sendInviteNow}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleAddUser(e as any, true)}
                      disabled={addUserSubmitting || !addUserFormData.email.trim()}
                      loading={addUserSubmitting && sendInviteNow}
                    >
                      Save & Send Invitation
                    </Button>
                  </>
                )}
                {!addUserSuccess && addUserMode === "existing" && (
                  <Button
                    type="submit"
                    disabled={addUserSubmitting || !addUserFormData.email.trim()}
                    loading={addUserSubmitting}
                  >
                    Add User
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAddress ? "Edit Address" : "Add Address"}
              </h2>
              <button
                onClick={handleCloseAddressModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={addressFormData.label}
                  onChange={(e) =>
                    setAddressFormData({ ...addressFormData, label: e.target.value })
                  }
                  placeholder="e.g., Main Warehouse, Headquarters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressFormData.address_line1}
                  onChange={(e) =>
                    setAddressFormData({ ...addressFormData, address_line1: e.target.value })
                  }
                  required
                  placeholder="Street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={addressFormData.address_line2}
                  onChange={(e) =>
                    setAddressFormData({ ...addressFormData, address_line2: e.target.value })
                  }
                  placeholder="Apt, Suite, Unit, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressFormData.city}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, city: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressFormData.state}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, state: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressFormData.zip}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, zip: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={addressFormData.country}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, country: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addressFormData.is_default}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, is_default: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Set as default address</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addressFormData.is_billing}
                    onChange={(e) =>
                      setAddressFormData({ ...addressFormData, is_billing: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Billing address</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseAddressModal}
                  disabled={addressSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addressSubmitting || !addressFormData.address_line1 || !addressFormData.city}
                >
                  {addressSubmitting ? "Saving..." : editingAddress ? "Save Changes" : "Add Address"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Value Modal */}
      {showEditValueModal && editingProductValue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Product Value
              </h2>
              <button
                onClick={handleCloseEditValueModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductValue} className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">{editingProductValue.product.name}</p>
                <p className="text-sm text-gray-500 font-mono">{editingProductValue.product.sku}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productValueFormData.sale_price}
                    onChange={(e) =>
                      setProductValueFormData({ ...productValueFormData, sale_price: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productValueFormData.cost}
                    onChange={(e) =>
                      setProductValueFormData({ ...productValueFormData, cost: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {productValueFormData.sale_price && productValueFormData.cost && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Margin:</span>
                    <span className={`font-medium ${
                      parseFloat(productValueFormData.sale_price) - parseFloat(productValueFormData.cost) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      ${(parseFloat(productValueFormData.sale_price) - parseFloat(productValueFormData.cost)).toFixed(2)}
                      {" "}
                      ({parseFloat(productValueFormData.sale_price) > 0
                        ? (((parseFloat(productValueFormData.sale_price) - parseFloat(productValueFormData.cost)) / parseFloat(productValueFormData.sale_price)) * 100).toFixed(1)
                        : 0}%)
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseEditValueModal}
                  disabled={productValueSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={productValueSubmitting}>
                  {productValueSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Client"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{client?.company_name}</strong>?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. All associated data including products, inventory, orders, and addresses will be affected.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteClient}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Client"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
