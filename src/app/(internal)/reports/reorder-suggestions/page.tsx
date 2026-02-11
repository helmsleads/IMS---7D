"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import FetchError from "@/components/ui/FetchError";
import Badge from "@/components/ui/Badge";
import { getReorderSuggestions, ReorderSuggestion } from "@/lib/api/dashboard";
import { useRouter } from "next/navigation";

export default function ReorderSuggestionsPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReorderSuggestions();
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getUrgencyBadge = (currentQty: number, reorderPoint: number) => {
    if (currentQty === 0) {
      return <Badge variant="error">Out of Stock</Badge>;
    }
    const ratio = currentQty / reorderPoint;
    if (ratio <= 0.25) {
      return <Badge variant="error">Critical</Badge>;
    }
    if (ratio <= 0.5) {
      return <Badge variant="warning">Low</Badge>;
    }
    return <Badge variant="info">Below Reorder</Badge>;
  };

  const handleCreatePO = (suggestion: ReorderSuggestion) => {
    // Navigate to new inbound order with pre-filled data
    const params = new URLSearchParams({
      product_id: suggestion.productId,
      qty: suggestion.suggestedQty.toString(),
      supplier: suggestion.supplier || "",
    });
    router.push(`/inbound/new?${params.toString()}`);
  };

  if (loading) {
    return (
      <AppShell title="Reorder Suggestions" subtitle="Products below reorder point">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Reorder Suggestions" subtitle="Products below reorder point">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  const outOfStockCount = suggestions.filter((s) => s.currentQty === 0).length;
  const criticalCount = suggestions.filter(
    (s) => s.currentQty > 0 && s.currentQty / s.reorderPoint <= 0.25
  ).length;

  return (
    <AppShell
      title="Reorder Suggestions"
      subtitle="Products below reorder point with recommended order quantities"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-gray-900">{suggestions.length}</p>
            <p className="text-sm text-gray-500">Items Need Reorder</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-red-600">{outOfStockCount}</p>
            <p className="text-sm text-gray-500">Out of Stock</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-semibold text-orange-600">{criticalCount}</p>
            <p className="text-sm text-gray-500">Critical (&lt;25%)</p>
          </div>
        </Card>
      </div>

      {/* Suggestions Table */}
      <Card>
        {suggestions.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500">All items are above their reorder points</p>
          </div>
        ) : (
          <Table
            columns={[
              {
                key: "sku",
                label: "SKU",
                render: (row: ReorderSuggestion) => (
                  <span className="font-medium text-gray-900">{row.sku}</span>
                ),
              },
              {
                key: "productName",
                label: "Product",
                render: (row: ReorderSuggestion) => (
                  <div>
                    <p className="text-gray-900">{row.productName}</p>
                    {row.clientName && (
                      <p className="text-xs text-gray-500">{row.clientName}</p>
                    )}
                  </div>
                ),
              },
              {
                key: "currentQty",
                label: "On Hand",
                render: (row: ReorderSuggestion) => (
                  <span className={row.currentQty === 0 ? "text-red-600 font-medium" : "text-gray-900"}>
                    {row.currentQty.toLocaleString()}
                  </span>
                ),
              },
              {
                key: "reorderPoint",
                label: "Reorder At",
                render: (row: ReorderSuggestion) => (
                  <span className="text-gray-600">{row.reorderPoint.toLocaleString()}</span>
                ),
              },
              {
                key: "urgency",
                label: "Urgency",
                render: (row: ReorderSuggestion) => getUrgencyBadge(row.currentQty, row.reorderPoint),
              },
              {
                key: "suggestedQty",
                label: "Suggested Order",
                render: (row: ReorderSuggestion) => (
                  <span className="font-medium text-blue-600">
                    {row.suggestedQty.toLocaleString()} units
                  </span>
                ),
              },
              {
                key: "supplier",
                label: "Supplier",
                render: (row: ReorderSuggestion) => (
                  <span className="text-gray-600">{row.supplier || "—"}</span>
                ),
              },
              {
                key: "actions",
                label: "",
                render: (row: ReorderSuggestion) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCreatePO(row)}
                  >
                    Create PO
                  </Button>
                ),
              },
            ]}
            data={suggestions}
          />
        )}
      </Card>
    </AppShell>
  );
}
