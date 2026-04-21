import dayjs from "dayjs";
import type {
  Invoice,
  Order,
  OrderReturn,
  PaymentTransaction,
  RevenueLog,
  User,
} from "../types";

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  return Number(value ?? 0);
}

export function formatCurrency(
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatMoneyValue(
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  return dayjs(value).format("DD/MM/YYYY HH:mm");
}

export function getStatusColor(status: "PENDING" | "PAID" | "CANCELLED") {
  if (status === "PAID") {
    return "green";
  }

  if (status === "CANCELLED") {
    return "red";
  }

  return "gold";
}

export function getStatusTone(status: "PENDING" | "PAID" | "CANCELLED") {
  if (status === "PAID") {
    return "green";
  }

  if (status === "CANCELLED") {
    return "red";
  }

  return "amber";
}

export function formatOrderStatus(status: Order["status"]) {
  return {
    PENDING: "Chờ xử lý",
    PAID: "Đã thanh toán",
    CANCELLED: "Đã hủy",
  }[status];
}

export function formatInvoiceStatus(status: Invoice["status"]) {
  return {
    PENDING: "Chờ phát hành",
    ISSUED: "Đã phát hành",
    FAILED: "Phát hành lỗi",
    CANCELLED: "Đã hủy",
  }[status];
}

export function formatRevenueLogType(type: RevenueLog["type"]) {
  return {
    SALE: "Ghi nhận doanh thu",
    ADJUSTMENT: "Điều chỉnh doanh thu",
  }[type];
}

export function formatPaymentTransactionType(type: PaymentTransaction["type"]) {
  return {
    COLLECTION: "Thu tiền",
    REFUND: "Hoàn tiền",
  }[type];
}

export function formatPaymentMethod(method: PaymentTransaction["method"]) {
  return {
    CASH: "Tiền mặt",
    BANK_TRANSFER: "Chuyển khoản",
    CARD: "Thẻ",
    EWALLET: "Ví điện tử",
    MIXED: "Hỗn hợp",
  }[method];
}

export function formatUserRole(role: User["role"]) {
  return {
    ADMIN: "Quản trị viên",
    STAFF: "Nhân viên",
  }[role];
}

export function formatOrderReturnInvoiceAction(
  action: OrderReturn["invoiceAction"],
) {
  return {
    NONE: "Không cần xử lý thêm",
    REVIEW_DRAFT: "Rà soát bản nháp hóa đơn",
    ISSUE_ADJUSTMENT: "Lập hóa đơn điều chỉnh giảm",
  }[action];
}

export type InventoryAlertLevel = "IN_STOCK" | "LOW" | "OUT_OF_STOCK";

export function getInventoryAlertLevel(
  quantity: number,
  minStock: number,
): InventoryAlertLevel {
  if (quantity <= 0) {
    return "OUT_OF_STOCK";
  }

  if (quantity <= minStock) {
    return "LOW";
  }

  return "IN_STOCK";
}

export function formatInventoryAlertLevel(level: InventoryAlertLevel) {
  return {
    IN_STOCK: "Ổn định",
    LOW: "Sắp hết",
    OUT_OF_STOCK: "Hết hàng",
  }[level];
}

export function getInventoryAlertTone(level: InventoryAlertLevel) {
  return {
    IN_STOCK: "green",
    LOW: "amber",
    OUT_OF_STOCK: "red",
  }[level] as "green" | "amber" | "red";
}

export function getAccentColor(seed: string) {
  const colors = [
    ["#dbeafe", "#2563eb"],
    ["#dcfce7", "#16a34a"],
    ["#ffedd5", "#ea580c"],
    ["#ede9fe", "#7c3aed"],
    ["#fce7f3", "#db2777"],
    ["#fee2e2", "#dc2626"],
  ] as const;

  const hash = seed
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("");
}
