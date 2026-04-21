import axios from "axios";
import { useAuthStore } from "../store/auth-store";
import type { Inventory, Order, Product, RevenueReport, User } from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }

    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;

    if (Array.isArray(data?.message)) {
      return data.message.join(", ");
    }

    return data?.message ?? error.message;
  }

  return "Unexpected error";
}

export async function login(payload: { email: string; password: string }) {
  const response = await api.post<{ accessToken: string; user: User }>(
    "/auth/login",
    payload,
  );
  return response.data;
}

export async function register(payload: {
  email: string;
  fullName: string;
  password: string;
}) {
  const response = await api.post<User>("/auth/register", payload);
  return response.data;
}

export async function getMe() {
  const response = await api.get<User>("/users/me");
  return response.data;
}

export async function getProducts() {
  const response = await api.get<Product[]>("/products");
  return response.data;
}

export async function createProduct(payload: Record<string, unknown>) {
  const response = await api.post<Product>("/products", payload);
  return response.data;
}

export async function updateProduct(
  productId: string,
  payload: Record<string, unknown>,
) {
  const response = await api.patch<Product>(`/products/${productId}`, payload);
  return response.data;
}

export async function deactivateProduct(productId: string) {
  const response = await api.delete<Product>(`/products/${productId}`);
  return response.data;
}

export async function getInventory() {
  const response = await api.get<Inventory[]>("/inventory");
  return response.data;
}

export async function adjustInventory(
  productId: string,
  payload: Record<string, unknown>,
) {
  const response = await api.patch<Inventory>(
    `/inventory/${productId}/adjust`,
    payload,
  );
  return response.data;
}

export async function createOrder(payload?: {
  customerName?: string;
  notes?: string;
}) {
  const response = await api.post<Order>("/orders", payload ?? {});
  return response.data;
}

export async function getOrders() {
  const response = await api.get<Order[]>("/orders");
  return response.data;
}

export async function getOrder(orderId: string) {
  const response = await api.get<Order>(`/orders/${orderId}`);
  return response.data;
}

export async function addOrderItem(
  orderId: string,
  payload: { productId: string; quantity: number },
) {
  const response = await api.post<Order>(`/orders/${orderId}/items`, payload);
  return response.data;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  payload: { quantity: number },
) {
  const response = await api.patch<Order>(
    `/orders/${orderId}/items/${itemId}`,
    payload,
  );
  return response.data;
}

export async function removeOrderItem(orderId: string, itemId: string) {
  const response = await api.delete<Order>(
    `/orders/${orderId}/items/${itemId}`,
  );
  return response.data;
}

export async function checkoutOrder(
  orderId: string,
  payload: {
    discount?: number;
    createInvoice?: boolean;
    provider?: "MISA" | "VNPT" | "VIETTEL";
    paymentMethod?: "CASH" | "BANK_TRANSFER" | "CARD" | "EWALLET" | "MIXED";
    receivedAmount?: number;
    paymentReference?: string;
    notes?: string;
  },
) {
  const response = await api.post<Order>(
    `/orders/${orderId}/checkout`,
    payload,
  );
  return response.data;
}

export async function cancelOrder(
  orderId: string,
  payload?: { reason?: string },
) {
  const response = await api.post<Order>(
    `/orders/${orderId}/cancel`,
    payload ?? {},
  );
  return response.data;
}

export async function returnPaidOrder(
  orderId: string,
  payload: {
    items: Array<{
      orderItemId: string;
      quantity: number;
      restock?: boolean;
    }>;
    reason?: string;
    refundMethod?: "CASH" | "BANK_TRANSFER" | "CARD" | "EWALLET" | "MIXED";
    refundReference?: string;
  },
) {
  const response = await api.post<Order>(`/orders/${orderId}/returns`, payload);
  return response.data;
}

export async function getRevenueReport(params?: {
  groupBy?: "day" | "week" | "month" | "quarter" | "year";
  from?: string;
  to?: string;
}) {
  const response = await api.get<RevenueReport>("/reports/revenue", {
    params,
  });
  return response.data;
}

export async function downloadRevenueReportExcel(params?: {
  groupBy?: "day" | "week" | "month" | "quarter" | "year";
  from?: string;
  to?: string;
}) {
  const response = await api.get<Blob>("/reports/revenue/export", {
    params,
    responseType: "blob",
  });

  const contentDisposition = response.headers["content-disposition"];
  const matchedFilename =
    contentDisposition?.match(/filename="?([^"]+)"?/i)?.[1];

  return {
    blob: response.data,
    filename: matchedFilename ?? "revenue-report.xlsx",
  };
}
