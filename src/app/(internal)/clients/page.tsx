"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Eye, Pencil, Search } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import ClientForm, { ClientFormData } from "@/components/internal/ClientForm";
import { getClients, createClientRecord, updateClient, Client } from "@/lib/api/clients";
import { handleApiError } from "@/lib/utils/error-handler";

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) {
      return clients;
    }

    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.company_name.toLowerCase().includes(query) ||
        (client.contact_name && client.contact_name.toLowerCase().includes(query)) ||
        client.email.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleOpenModal = (client?: Client) => {
    setEditingClient(client || null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
  };

  const handleSaveClient = async (data: ClientFormData) => {
    if (editingClient) {
      // Update existing client
      await updateClient(editingClient.id, {
        company_name: data.company_name,
        contact_name: data.contact_name || null,
        email: data.email,
        phone: data.phone || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        active: data.active,
      });
    } else {
      // Create new client
      await createClientRecord({
        company_name: data.company_name,
        contact_name: data.contact_name || null,
        email: data.email,
        phone: data.phone || null,
        address_line1: data.address_line1 || null,
        address_line2: data.address_line2 || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        active: data.active,
      });
    }

    handleCloseModal();
    await fetchClients();
  };

  const columns = [
    {
      key: "company_name",
      header: "Company Name",
      render: (client: Client) => (
        <span className="font-medium text-gray-900">{client.company_name}</span>
      ),
    },
    {
      key: "contact_name",
      header: "Contact Name",
      render: (client: Client) => (
        <span className="text-gray-600">{client.contact_name || "—"}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (client: Client) => (
        <a
          href={`mailto:${client.email}`}
          className="text-blue-600 hover:text-blue-800"
          onClick={(e) => e.stopPropagation()}
        >
          {client.email}
        </a>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (client: Client) => (
        <span className="text-gray-600">{client.phone || "—"}</span>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (client: Client) => {
        const parts = [client.city, client.state].filter(Boolean);
        return (
          <span className="text-gray-600">
            {parts.length > 0 ? parts.join(", ") : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (client: Client) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            client.active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {client.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (client: Client) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/clients/${client.id}`);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(client);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={() => handleOpenModal()}>
      <Plus className="w-4 h-4 mr-1" />
      Add Client
    </Button>
  );

  if (!loading && clients.length === 0 && !showModal) {
    return (
      <AppShell
        title="Clients"
        subtitle="Manage your client accounts"
        actions={actionButtons}
      >
        <Card>
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No clients yet"
            description="Add your first client to start managing their inventory and orders"
            action={
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-1" />
                Add Client
              </Button>
            }
          />
        </Card>

        {/* Modal */}
        <Modal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingClient ? "Edit Client" : "Add Client"}
          size="lg"
        >
          <ClientForm
            initialData={editingClient || undefined}
            onSubmit={handleSaveClient}
            onCancel={handleCloseModal}
            submitLabel={editingClient ? "Update Client" : "Create Client"}
            isEdit={!!editingClient}
          />
        </Modal>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Clients" subtitle="Manage your client accounts">
        <FetchError message={error} onRetry={fetchClients} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Clients"
      subtitle="Manage your client accounts"
      actions={actionButtons}
    >
      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by company, contact, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={filteredClients}
          loading={loading}
          onRowClick={(client) => router.push(`/clients/${client.id}`)}
          emptyMessage={searchQuery ? "No clients match your search" : "No clients found"}
        />
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingClient ? "Edit Client" : "Add Client"}
        size="lg"
      >
        <ClientForm
          initialData={editingClient || undefined}
          onSubmit={handleSaveClient}
          onCancel={handleCloseModal}
          submitLabel={editingClient ? "Update Client" : "Create Client"}
          isEdit={!!editingClient}
        />
      </Modal>
    </AppShell>
  );
}
