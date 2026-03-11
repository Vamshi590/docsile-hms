"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getOpticalProducts,
  createOpticalProduct,
  getOpticalStock,
  addOpticalStock,
  updateOpticalStock,
} from "../actions";

const CATEGORIES = [
  "Frame",
  "Lens",
  "Contact Lens",
  "Accessory",
  "Solution",
  "Sunglasses",
];
const FRAME_TYPES = ["Full Rim", "Half Rim", "Rimless", "Wrap"];
const FRAME_MATERIALS = [
  "Metal",
  "Plastic",
  "TR-90",
  "Titanium",
  "Acetate",
  "Memory Metal",
];
const LENS_TYPES = [
  "Single Vision",
  "Bifocal",
  "Progressive",
  "Photochromic",
  "Tinted",
];
const LENS_MATERIALS = [
  "CR-39",
  "Polycarbonate",
  "Glass",
  "Trivex",
  "Hi-Index",
];
const LENS_COATINGS = [
  "Anti-Reflection",
  "Blue Cut",
  "Photochromic",
  "Hardcoat",
  "Mirror",
];
const LENS_INDICES = ["1.5", "1.56", "1.6", "1.67", "1.74"];
const CL_TYPES = ["Daily", "Monthly", "Yearly", "Toric", "Multifocal"];

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  type: string | null;
  material: string | null;
  color: string | null;
  size: string | null;
  coating: string | null;
  index: string | null;
  modelNumber: string | null;
  hsnCode: string | null;
  gstPercent: number;
};

type StockEntry = {
  id: string;
  productId: string;
  batchNumber: string | null;
  quantity: number;
  mrp: number;
  costPrice: number;
  gstPercent: number;
  power: string | null;
  product: Product;
};

export function InventoryTab({
  onStockChanged,
}: {
  onStockChanged?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"stock" | "products">("stock");
  const [stock, setStock] = useState<StockEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Dialogs
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);

  // Add product form
  const [productForm, setProductForm] = useState({
    name: "",
    brand: "",
    category: "Frame",
    type: "",
    material: "",
    color: "",
    size: "",
    coating: "",
    index: "",
    modelNumber: "",
    hsnCode: "",
    gstPercent: "12",
  });

  // Add stock form
  const [stockForm, setStockForm] = useState({
    productId: "",
    batchNumber: "",
    quantity: "1",
    mrp: "",
    costPrice: "",
    gstPercent: "12",
    power: "",
  });

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingStock, setSavingStock] = useState(false);

  async function loadData() {
    setLoading(true);
    const [stockData, productData] = await Promise.all([
      getOpticalStock({
        search: search || undefined,
        category: filterCategory !== "All" ? filterCategory : undefined,
        lowStock: filterLowStock,
      }),
      getOpticalProducts(),
    ]);
    setStock(stockData as StockEntry[]);
    setProducts(productData as Product[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [search, filterCategory, filterLowStock]);

  async function handleCreateProduct() {
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSavingProduct(true);
    const result = await createOpticalProduct({
      name: productForm.name.trim(),
      brand: productForm.brand.trim() || undefined,
      category: productForm.category,
      type: productForm.type || undefined,
      material: productForm.material || undefined,
      color: productForm.color || undefined,
      size: productForm.size || undefined,
      coating: productForm.coating || undefined,
      index: productForm.index || undefined,
      modelNumber: productForm.modelNumber || undefined,
      hsnCode: productForm.hsnCode || undefined,
      gstPercent: parseFloat(productForm.gstPercent) || 12,
    });
    setSavingProduct(false);
    if (result.success) {
      toast.success("Product added");
      setShowProductDialog(false);
      setProductForm({
        name: "",
        brand: "",
        category: "Frame",
        type: "",
        material: "",
        color: "",
        size: "",
        coating: "",
        index: "",
        modelNumber: "",
        hsnCode: "",
        gstPercent: "12",
      });
      loadData();
    } else {
      toast.error(result.error);
    }
  }

  async function handleAddStock() {
    if (!stockForm.productId) {
      toast.error("Select a product");
      return;
    }
    if (!stockForm.mrp) {
      toast.error("MRP is required");
      return;
    }
    setSavingStock(true);
    const result = await addOpticalStock({
      productId: stockForm.productId,
      batchNumber: stockForm.batchNumber || undefined,
      quantity: parseInt(stockForm.quantity) || 1,
      mrp: parseFloat(stockForm.mrp) || 0,
      costPrice: parseFloat(stockForm.costPrice) || 0,
      gstPercent: parseFloat(stockForm.gstPercent) || 12,
      power: stockForm.power || undefined,
    });
    setSavingStock(false);
    if (result.success) {
      toast.success("Stock added");
      setShowStockDialog(false);
      setStockForm({
        productId: "",
        batchNumber: "",
        quantity: "1",
        mrp: "",
        costPrice: "",
        gstPercent: "12",
        power: "",
      });
      loadData();
      onStockChanged?.();
    } else {
      toast.error(result.error);
    }
  }

  async function handleInlineEdit(
    stockId: string,
    field: string,
    value: string
  ) {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) return;
    const result = await updateOpticalStock(stockId, { [field]: numVal });
    if (result.success) {
      toast.success("Updated");
      loadData();
      onStockChanged?.();
    } else {
      toast.error(result.error);
    }
  }

  // Category-specific type options
  const typeOptions =
    productForm.category === "Frame"
      ? FRAME_TYPES
      : productForm.category === "Lens"
      ? LENS_TYPES
      : productForm.category === "Contact Lens"
      ? CL_TYPES
      : [];

  const materialOptions =
    productForm.category === "Frame"
      ? FRAME_MATERIALS
      : productForm.category === "Lens"
      ? LENS_MATERIALS
      : [];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      filterCategory === "All" || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="inline-flex  items-center rounded-lg border border-border bg-gray-100 p-0.5 gap-0.5">
        <button
          onClick={() => setActiveTab("stock")}
          className={cn(
            "px-3 py-1 text-sm  font-medium rounded-md transition-colors",
            activeTab === "stock"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Stock
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={cn(
            "px-3 py-1 text-sm font-medium  rounded-md transition-colors",
            activeTab === "products"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-muted-foreground bg-gray-100 hover:text-foreground"
          )}
        >
          Products
          <span className="ml-1.5 text-xs tabular-nums opacity-60">
            ({products.length})
          </span>
        </button>
      </div>

      {/* Header: Search + Filters + Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "stock" ? "Search stock..." : "Search products..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-36 h-9 text-sm focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeTab === "stock" && (
          <Button
            variant={filterLowStock ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setFilterLowStock(!filterLowStock)}
          >
            Low Stock
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setShowProductDialog(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Product
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() => setShowStockDialog(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Stock
        </Button>
      </div>

      {/* Stock Tab */}
      {activeTab === "stock" &&
        (loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : stock.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No stock found. Add products and stock to get started.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                  <th className="text-left px-3 py-2.5 font-medium">Product</th>
                  <th className="text-left px-2 py-2.5 font-medium w-20">
                    Category
                  </th>
                  <th className="text-left px-2 py-2.5 font-medium w-24">
                    Batch
                  </th>
                  <th className="text-center px-2 py-2.5 font-medium w-16">
                    Qty
                  </th>
                  <th className="text-right px-2 py-2.5 font-medium w-24">
                    MRP
                  </th>
                  <th className="text-right px-2 py-2.5 font-medium w-24">
                    Cost
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium w-24">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium">
                        {item.product.brand && (
                          <span className="text-muted-foreground">
                            {item.product.brand}{" "}
                          </span>
                        )}
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          item.product.type,
                          item.product.material,
                          item.product.color,
                          item.product.size,
                          item.product.modelNumber,
                          item.power,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5 font-normal"
                      >
                        {item.product.category}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                      {item.batchNumber || "—"}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Input
                        type="number"
                        defaultValue={item.quantity}
                        onBlur={(e) => {
                          if (e.target.value !== String(item.quantity)) {
                            handleInlineEdit(
                              item.id,
                              "quantity",
                              e.target.value
                            );
                          }
                        }}
                        className={cn(
                          "h-7 w-14 text-center mx-auto px-1 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-gray-200 bg-transparent tabular-nums",
                          item.quantity <= 5 && "text-destructive font-semibold"
                        )}
                        min={0}
                      />
                      {item.quantity <= 5 && item.quantity > 0 && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1 py-0 mt-0.5"
                        >
                          Low
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Input
                        type="number"
                        defaultValue={item.mrp}
                        onBlur={(e) => {
                          if (e.target.value !== String(item.mrp)) {
                            handleInlineEdit(item.id, "mrp", e.target.value);
                          }
                        }}
                        className="h-7 w-24 text-right ml-auto px-2 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-gray-200 bg-transparent tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Input
                        type="number"
                        defaultValue={item.costPrice}
                        onBlur={(e) => {
                          if (e.target.value !== String(item.costPrice)) {
                            handleInlineEdit(
                              item.id,
                              "costPrice",
                              e.target.value
                            );
                          }
                        }}
                        className="h-7 w-24 text-right ml-auto px-2 border-0 shadow-none focus-visible:ring-1 focus-visible:ring-gray-200 bg-transparent tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatCurrency(item.quantity * item.mrp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* Products Tab */}
      {activeTab === "products" &&
        (loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No products found. Add a product to get started.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                  <th className="text-left px-3 py-2.5 font-medium">Product</th>
                  <th className="text-left px-2 py-2.5 font-medium w-24">
                    Category
                  </th>
                  <th className="text-left px-2 py-2.5 font-medium">Details</th>
                  <th className="text-left px-2 py-2.5 font-medium w-24">
                    Model
                  </th>
                  <th className="text-left px-2 py-2.5 font-medium w-20">
                    HSN
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium w-16">
                    GST %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium">
                        {p.brand && (
                          <span className="text-muted-foreground">
                            {p.brand}{" "}
                          </span>
                        )}
                        {p.name}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0.5 font-normal"
                      >
                        {p.category}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-muted-foreground">
                      {[
                        p.type,
                        p.material,
                        p.coating,
                        p.index ? `${p.index} idx` : null,
                        p.color,
                        p.size,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                      {p.modelNumber || "—"}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">
                      {p.hsnCode || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {p.gstPercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* ── Add Product Dialog ── */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Optical Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Classic Rectangle"
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input
                  value={productForm.brand}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, brand: e.target.value }))
                  }
                  placeholder="e.g. Ray-Ban"
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={productForm.category}
                  onValueChange={(v) =>
                    setProductForm((p) => ({
                      ...p,
                      category: v,
                      type: "",
                      material: "",
                      coating: "",
                      index: "",
                    }))
                  }
                >
                  <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {typeOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={productForm.type}
                    onValueChange={(v) =>
                      setProductForm((p) => ({ ...p, type: v }))
                    }
                  >
                    <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {materialOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Material</Label>
                  <Select
                    value={productForm.material}
                    onValueChange={(v) =>
                      setProductForm((p) => ({ ...p, material: v }))
                    }
                  >
                    <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {productForm.category === "Lens" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Coating</Label>
                  <Select
                    value={productForm.coating}
                    onValueChange={(v) =>
                      setProductForm((p) => ({ ...p, coating: v }))
                    }
                  >
                    <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LENS_COATINGS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Index</Label>
                  <Select
                    value={productForm.index}
                    onValueChange={(v) =>
                      setProductForm((p) => ({ ...p, index: v }))
                    }
                  >
                    <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {LENS_INDICES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input
                  value={productForm.color}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, color: e.target.value }))
                  }
                  placeholder="e.g. Black"
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {productForm.category === "Frame"
                    ? "Size (Eye-Bridge-Temple)"
                    : "Size"}
                </Label>
                <Input
                  value={productForm.size}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, size: e.target.value }))
                  }
                  placeholder={
                    productForm.category === "Frame" ? "e.g. 52-18-140" : ""
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Model Number</Label>
                <Input
                  value={productForm.modelNumber}
                  onChange={(e) =>
                    setProductForm((p) => ({
                      ...p,
                      modelNumber: e.target.value,
                    }))
                  }
                  placeholder="SKU/Model"
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>HSN Code</Label>
                <Input
                  value={productForm.hsnCode}
                  onChange={(e) =>
                    setProductForm((p) => ({ ...p, hsnCode: e.target.value }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <Input
                  type="number"
                  value={productForm.gstPercent}
                  onChange={(e) =>
                    setProductForm((p) => ({
                      ...p,
                      gstPercent: e.target.value,
                    }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowProductDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={savingProduct}>
              {savingProduct && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Stock Dialog ── */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Product <span className="text-destructive">*</span>
              </Label>
              <Select
                value={stockForm.productId}
                onValueChange={(v) =>
                  setStockForm((p) => ({ ...p, productId: v }))
                }
              >
                <SelectTrigger className="focus:ring-1 focus:ring-gray-200 focus:ring-offset-0">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.brand ? `${p.brand} ` : ""}
                      {p.name} ({p.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Batch / Lot</Label>
                <Input
                  value={stockForm.batchNumber}
                  onChange={(e) =>
                    setStockForm((p) => ({ ...p, batchNumber: e.target.value }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Power (for CL)</Label>
                <Input
                  value={stockForm.power}
                  onChange={(e) =>
                    setStockForm((p) => ({ ...p, power: e.target.value }))
                  }
                  placeholder="e.g. -2.00"
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={stockForm.quantity}
                  onChange={(e) =>
                    setStockForm((p) => ({ ...p, quantity: e.target.value }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  MRP <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={stockForm.mrp}
                  onChange={(e) =>
                    setStockForm((p) => ({ ...p, mrp: e.target.value }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  value={stockForm.costPrice}
                  onChange={(e) =>
                    setStockForm((p) => ({ ...p, costPrice: e.target.value }))
                  }
                  className="focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>GST %</Label>
              <Input
                type="number"
                value={stockForm.gstPercent}
                onChange={(e) =>
                  setStockForm((p) => ({ ...p, gstPercent: e.target.value }))
                }
                className="w-24 focus-visible:ring-1 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStock} disabled={savingStock}>
              {savingStock && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
