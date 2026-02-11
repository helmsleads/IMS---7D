"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  formatCaseAwareQty,
  getContainerTypeBadgeColor,
} from "@/lib/api/pallet-breakdown";

export interface PalletContentDisplay {
  id: string;
  product_id: string;
  qty: number;
  lot_id?: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
    container_type?: string;
    units_per_case?: number | null;
  };
  lot?: {
    id: string;
    lot_number: string;
    expiration_date?: string | null;
  } | null;
}

interface PalletContentsCardProps {
  contents: PalletContentDisplay[];
  showPullButton?: boolean;
  onPull?: (content: PalletContentDisplay) => void;
  pullingId?: string | null;
}

export default function PalletContentsCard({
  contents,
  showPullButton = false,
  onPull,
  pullingId,
}: PalletContentsCardProps) {
  if (!contents || contents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No contents on this pallet</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quantity
            </th>
            {showPullButton && (
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {contents.map((item) => {
            const containerType = item.product.container_type || "other";
            const unitsPerCase = item.product.units_per_case ?? null;

            return (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                    </p>
                    <p className="text-sm text-gray-500">{item.product.sku}</p>
                    {item.lot && (
                      <p className="text-xs text-purple-600 mt-0.5">
                        Lot: {item.lot.lot_number}
                        {item.lot.expiration_date && (
                          <span className="ml-2 text-gray-400">
                            Exp: {item.lot.expiration_date}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getContainerTypeBadgeColor(containerType)}>
                    {containerType.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-medium text-gray-900">
                    {formatCaseAwareQty(item.qty, containerType, unitsPerCase)}
                  </span>
                </td>
                {showPullButton && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onPull?.(item)}
                      disabled={pullingId === item.id}
                      loading={pullingId === item.id}
                    >
                      Pull
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
