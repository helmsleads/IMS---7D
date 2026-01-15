"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plus, Check, X } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import StockTransferModal from "@/components/internal/StockTransferModal";
import {
  getTransfers,
  completeTransfer,
  cancelTransfer,
  StockTransferWithDetails,
} from "@/lib/api/transfers";

function getStatusVariant(status: string): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
      return "error";
    default:
      return "default";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<StockTransferWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchTransfers = async () => {
    try {
      const data = await getTransfers();
      setTransfers(data);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleComplete = async (transfer: StockTransferWithDetails) => {
    setProcessingId(transfer.id);
    setErrorMessage("");
    try {
      await completeTransfer(transfer.id);
      await fetchTransfers();
      setSuccessMessage(`Transfer ${transfer.transfer_number} completed successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to complete transfer");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (transfer: StockTransferWithDetails) => {
    setProcessingId(transfer.id);
    setErrorMessage("");
    try {
      await cancelTransfer(transfer.id);
      await fetchTransfers();
      setSuccessMessage(`Transfer ${transfer.transfer_number} cancelled`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel transfer");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateComplete = () => {
    fetchTransfers();
    setSuccessMessage("Transfer created successfully");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const columns = [
    {
      key: "transfer_number",
      header: "Transfer #",
      render: (transfer: StockTransferWithDetails) => (
        <span className="font-medium text-gray-900">{transfer.transfer_number}</span>
      ),
    },
    {
      key: "locations",
      header: "Route",
      render: (transfer: StockTransferWithDetails) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900">{transfer.from_location.name}</span>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900">{transfer.to_location.name}</span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (transfer: StockTransferWithDetails) => (
        <span className="text-gray-600">
          {transfer.items.length} product{transfer.items.length !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (transfer: StockTransferWithDetails) => (
        <Badge variant={getStatusVariant(transfer.status)}>
          {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (transfer: StockTransferWithDetails) => (
        <span className="text-gray-500 text-sm">{formatDate(transfer.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (transfer: StockTransferWithDetails) => {
        if (transfer.status !== "pending") return null;
        const isProcessing = processingId === transfer.id;
        return (
          <div className="flex gap-2 justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleComplete(transfer);
              }}
              disabled={isProcessing}
              loading={isProcessing}
            >
              <Check className="w-4 h-4 mr-1" />
              Complete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(transfer);
              }}
              disabled={isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const actionButtons = (
    <Button onClick={() => setShowCreateModal(true)}>
      <Plus className="w-4 h-4 mr-1" />
      New Transfer
    </Button>
  );

  return (
    <AppShell title="Stock Transfers" actions={actionButtons}>
      {successMessage && (
        <div className="mb-4">
          <Alert
            type="success"
            message={successMessage}
            onClose={() => setSuccessMessage("")}
          />
        </div>
      )}

      {errorMessage && (
        <div className="mb-4">
          <Alert
            type="error"
            message={errorMessage}
            onClose={() => setErrorMessage("")}
          />
        </div>
      )}

      <Card padding="none">
        <Table
          columns={columns}
          data={transfers}
          loading={loading}
          emptyMessage="No transfers found. Create your first transfer to move inventory between locations."
        />
      </Card>

      <StockTransferModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onComplete={handleCreateComplete}
      />
    </AppShell>
  );
}
