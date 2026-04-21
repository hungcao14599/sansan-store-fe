export type User = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "STAFF";
  isActive?: boolean;
};

export type Inventory = {
  id: string;
  productId: string;
  quantity: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
};

export type Product = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unit: string;
  price: string | number;
  costPrice?: string | number | null;
  discountAmount: string | number;
  discountPercent: string | number;
  taxCategory: "NO_VAT" | "VAT_0" | "VAT_5" | "VAT_8" | "VAT_10";
  taxRate: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventory?: Inventory | null;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  unitPrice: string | number;
  quantity: number;
  taxCategory: "NO_VAT" | "VAT_0" | "VAT_5" | "VAT_8" | "VAT_10";
  taxRate: string | number;
  lineSubtotal: string | number;
  discountAmount: string | number;
  taxableAmount: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
};

export type RevenueLog = {
  id: string;
  orderId: string;
  type: "SALE" | "ADJUSTMENT";
  amount: string | number;
  reason?: string | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  orderId: string;
  provider: "MISA" | "VNPT" | "VIETTEL";
  status: "PENDING" | "ISSUED" | "FAILED" | "CANCELLED";
  externalReference?: string | null;
  invoiceSeries?: string | null;
  invoiceTemplateCode?: string | null;
  providerStatusMessage?: string | null;
  createdAt: string;
};

export type OrderReturnItem = {
  id: string;
  orderReturnId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  restockedQuantity: number;
  unitPrice: string | number;
  lineSubtotal: string | number;
  discountAmount: string | number;
  taxableAmount: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
  note?: string | null;
  createdAt: string;
};

export type OrderReturn = {
  id: string;
  orderId: string;
  returnNumber: string;
  reason?: string | null;
  subtotal: string | number;
  discount: string | number;
  taxableTotal: string | number;
  tax: string | number;
  total: string | number;
  invoiceAction: "NONE" | "REVIEW_DRAFT" | "ISSUE_ADJUSTMENT";
  invoiceNote?: string | null;
  createdAt: string;
  createdBy?: Pick<User, "id" | "email" | "fullName"> | null;
  items: OrderReturnItem[];
};

export type PaymentTransaction = {
  id: string;
  orderId: string;
  type: "COLLECTION" | "REFUND";
  method: "CASH" | "BANK_TRANSFER" | "CARD" | "EWALLET" | "MIXED";
  amount: string | number;
  receivedAmount?: string | number | null;
  changeAmount?: string | number | null;
  externalReference?: string | null;
  note?: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  total: string | number;
  notes?: string | null;
  customerName?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  createdBy?: Pick<User, "id" | "email" | "fullName">;
  items: OrderItem[];
  revenueLogs?: RevenueLog[];
  invoice?: Invoice | null;
  paymentTransactions?: PaymentTransaction[];
  returns?: OrderReturn[];
};

export type RevenueReport = {
  groupBy: "day" | "week" | "month" | "quarter" | "year";
  summary: {
    totalRevenue: string | number;
    salesRevenue: string | number;
    adjustmentRevenue: string | number;
    totalEntries: number;
    totalProductsSold: number;
    totalUnitsSold: number;
    totalSubtotal: string | number;
    totalDiscount: string | number;
    totalTaxable: string | number;
    totalTax: string | number;
    grossCollections: string | number;
    from: string;
    to: string;
  };
  items: Array<{
    period: string;
    total: string | number;
    salesRevenue: string | number;
    adjustmentRevenue: string | number;
    entries: number;
  }>;
  products: Array<{
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    quantitySold: number;
    ordersCount: number;
    subtotal: string | number;
    discountAmount: string | number;
    taxAmount: string | number;
    totalRevenue: string | number;
  }>;
};
