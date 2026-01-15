"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface ProductOption {
  value: string;
  label: string;
}

interface AddProductRowProps {
  products: ProductOption[];
  onAdd: (productId: string, qty: number) => void;
  qtyLabel?: string;
  buttonLabel?: string;
  placeholder?: string;
  minQty?: number;
  defaultQty?: number;
  disabled?: boolean;
}

export default function AddProductRow({
  products,
  onAdd,
  qtyLabel = "Qty",
  buttonLabel = "Add",
  placeholder = "Select product",
  minQty = 1,
  defaultQty = 1,
  disabled = false,
}: AddProductRowProps) {
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(defaultQty);

  const handleAdd = () => {
    if (!selectedProduct || qty < minQty) return;

    onAdd(selectedProduct, qty);

    // Clear fields after add
    setSelectedProduct("");
    setQty(defaultQty);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const isValid = selectedProduct && qty >= minQty;

  return (
    <div className="flex items-end gap-3 p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <Select
          label="Product"
          name="add-product"
          options={products}
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || products.length === 0}
        />
      </div>
      <div className="w-28">
        <Input
          label={qtyLabel}
          name="add-qty"
          type="number"
          min={minQty}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value) || minQty)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
      </div>
      <div className="pb-0.5">
        <Button
          type="button"
          variant="secondary"
          onClick={handleAdd}
          disabled={disabled || !isValid}
        >
          <Plus className="w-4 h-4 mr-1" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
