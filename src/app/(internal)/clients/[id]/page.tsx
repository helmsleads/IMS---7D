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
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { getClient, getClientInventory, getClientOrders, ClientWithSummary, ClientInventoryItem, ClientOrder } from "@/lib/api/clients";

type TabKey = "overview" | "inventory" | "orders" | "activity";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  { key: "orders", label: "Orders", icon: <FileText className="w-4 h-4" /> },
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

  const backLink = (
    <Link
      href="/clients"
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Clients
    </Link>
  );

  return (
    <AppShell
      title={client.company_name}
      subtitle={client.contact_name || "No contact name"}
      actions={backLink}
    >
      {/* Client Info Header */}
      <div className="mb-6">
        <Card>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                    {client.email}
                  </a>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
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
            {/* Contact Info */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                      {client.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900">{client.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Contact Name</p>
                    <p className="text-gray-900">{client.contact_name || "—"}</p>
                  </div>
                </div>
              </div>
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

      {activeTab === "activity" && (
        <Card>
          <EmptyState
            icon={<Activity className="w-12 h-12" />}
            title="Activity History"
            description="A complete log of inventory changes, orders, and account updates for this client will appear here."
          />
        </Card>
      )}
    </AppShell>
  );
}
