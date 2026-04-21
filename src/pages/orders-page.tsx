import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons";
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Field,
  Modal,
  NumberInput,
  Panel,
  TextArea,
  TextInput,
} from "../components/ui";
import { useToast } from "../components/toast-provider";
import {
  cancelOrder,
  extractErrorMessage,
  getOrders,
  returnPaidOrder,
} from "../lib/api";
import { cn } from "../lib/cn";
import {
  formatCurrency,
  formatDateTime,
  formatInvoiceStatus,
  formatMoneyValue,
  formatOrderStatus,
  formatOrderReturnInvoiceAction,
  formatPaymentMethod,
  formatPaymentTransactionType,
  formatRevenueLogType,
  getStatusTone,
  toNumber,
} from "../lib/utils";
import type { Order } from "../types";

type StatusFilter = "ALL" | "PAID" | "PENDING" | "CANCELLED" | "RETURNED";
const pageSizeOptions = [10, 25, 50] as const;

type ReturnDraftItem = {
  orderItemId: string;
  productName: string;
  sku: string;
  soldQuantity: number;
  returnedQuantity: number;
  availableQuantity: number;
  quantity: number;
  restock: boolean;
  refundableAmount: number;
};

type InvoiceListRow =
  | {
      id: string;
      kind: "order";
      code: string;
      typeLabel: "Bán hàng";
      customerName: string;
      statusKey: "PAID" | "PENDING" | "CANCELLED";
      statusLabel: string;
      statusTone: "green" | "amber" | "red";
      itemsCount: number;
      amount: number;
      createdBy: string;
      createdAt: string;
      order: Order;
      subtitle: string;
    }
  | {
      id: string;
      kind: "return";
      code: string;
      typeLabel: "Trả hàng";
      customerName: string;
      statusKey: "RETURNED";
      statusLabel: "Đã hoàn tiền";
      statusTone: "blue";
      itemsCount: number;
      amount: number;
      createdBy: string;
      createdAt: string;
      order: Order;
      returnId: string;
      subtitle: string;
    };

export function OrdersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Order | null>(null);
  const [focusedReturnId, setFocusedReturnId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnDraftItem[]>([]);
  const query = useQuery({ queryKey: ["orders"], queryFn: getOrders });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) =>
      cancelOrder(orderId, { reason: "Cancelled from invoices screen" }),
    onSuccess: async () => {
      toast.success("Đã chuyển hóa đơn sang trạng thái đã hủy");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["report"] });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({
      orderId,
      items,
      reason,
    }: {
      orderId: string;
      items: Array<{
        orderItemId: string;
        quantity: number;
        restock: boolean;
      }>;
      reason?: string;
    }) =>
      returnPaidOrder(orderId, {
        items,
        reason,
      }),
    onSuccess: async (order) => {
      const latestReturn = order.returns?.[0];
      toast.success(
        latestReturn
          ? `Đã tạo phiếu trả hàng ${latestReturn.returnNumber}`
          : "Đã xử lý trả hàng"
      );
      setSelected(order);
      setFocusedReturnId(latestReturn?.id ?? null);
      setReturnModalOpen(false);
      setReturnReason("");
      setReturnItems([]);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["report"] });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const invoiceRows = useMemo(
    () => buildInvoiceRows(query.data ?? []),
    [query.data]
  );

  const filteredRows = useMemo(() => {
    return invoiceRows.filter((row) => {
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [row.code, row.customerName, row.createdBy, row.subtitle]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" || row.statusKey === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoiceRows, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: invoiceRows.length,
      paid: invoiceRows.filter((item) => item.statusKey === "PAID").length,
      pending: invoiceRows.filter((item) => item.statusKey === "PENDING")
        .length,
      cancelled: invoiceRows.filter((item) => item.statusKey === "CANCELLED")
        .length,
      returned: invoiceRows.filter((item) => item.statusKey === "RETURNED")
        .length,
    }),
    [invoiceRows]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selected) {
      setReturnModalOpen(false);
      setReturnReason("");
      setReturnItems([]);
      setFocusedReturnId(null);
    }
  }, [selected]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  const paginationRange = useMemo(() => {
    if (!filteredRows.length) {
      return { from: 0, to: 0 };
    }

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, filteredRows.length);
    return { from, to };
  }, [currentPage, filteredRows.length, pageSize]);

  const selectedReturnedQuantityMap = useMemo(
    () => buildReturnedQuantityMap(selected?.returns),
    [selected?.returns]
  );

  const selectedReturnableItems = useMemo(() => {
    if (!selected) {
      return [];
    }

    return buildReturnDraft(selected);
  }, [selected]);

  const refundedAmount = useMemo(() => {
    if (!selected?.paymentTransactions?.length) {
      return 0;
    }

    return selected.paymentTransactions
      .filter((payment) => payment.type === "REFUND")
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  }, [selected?.paymentTransactions]);

  const focusedReturn = useMemo(
    () =>
      selected?.returns?.find((item) => item.id === focusedReturnId) ?? null,
    [focusedReturnId, selected?.returns]
  );

  const openReturnModal = (order: Order) => {
    setSelected(order);
    setFocusedReturnId(null);
    setReturnItems(buildReturnDraft(order));
    setReturnReason("");
    setReturnModalOpen(true);
  };

  const openOrderDrawer = (order: Order, returnId?: string) => {
    setSelected(order);
    setFocusedReturnId(returnId ?? null);
  };

  const submitReturn = () => {
    if (!selected) {
      return;
    }

    const payloadItems = returnItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        restock: item.restock,
      }));

    if (!payloadItems.length) {
      toast.error("Chọn ít nhất một mặt hàng cần trả");
      return;
    }

    returnMutation.mutate({
      orderId: selected.id,
      items: payloadItems,
      reason: returnReason.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-slate-900">Hóa đơn</h1>
          <p className="mt-2 text-sm text-slate-500">
            Màn lịch sử giao dịch được đưa về kiểu `Invoices`: danh sách phẳng,
            ưu tiên truy vấn nhanh và mở drawer để xem đầy đủ item, payment,
            revenue log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{summary.total} chứng từ</Badge>
          <Badge tone="green">{summary.paid} đã thu</Badge>
          <Badge tone="amber">{summary.pending} đang chờ</Badge>
          <Badge tone="red">{summary.cancelled} đã hủy</Badge>
          <Badge tone="blue">{summary.returned} phiếu trả</Badge>
        </div>
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[300px] flex-1 max-w-xl">
            <TextInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã hóa đơn, khách hàng hoặc thu ngân"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["ALL", "Tất cả"],
              ["PAID", "Đã thu"],
              ["PENDING", "Chờ xử lý"],
              ["CANCELLED", "Đã hủy"],
              ["RETURNED", "Phiếu trả"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                  statusFilter === value
                    ? "border-[#1677ff] bg-[#1677ff] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
                onClick={() => setStatusFilter(value as StatusFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#eaf3ff] text-slate-700">
              <tr>
                <th className="px-5 py-4 text-left font-semibold">
                  Mã chứng từ
                </th>
                <th className="px-4 py-4 text-left font-semibold">Loại</th>
                <th className="px-4 py-4 text-left font-semibold">
                  Khách hàng
                </th>
                <th className="px-4 py-4 text-left font-semibold">
                  Trạng thái
                </th>
                <th className="px-4 py-4 text-right font-semibold">Số món</th>
                <th className="px-4 py-4 text-right font-semibold">
                  Thanh toán
                </th>
                <th className="px-4 py-4 text-left font-semibold">Thu ngân</th>
                <th className="px-4 py-4 text-left font-semibold">
                  Thời gian tạo
                </th>
                <th className="px-5 py-4 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Đang tải danh sách chứng từ...
                  </td>
                </tr>
              ) : paginatedRows.length ? (
                paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{row.code}</div>
                      {row.subtitle ? (
                        <div className="mt-1 text-xs text-slate-400">
                          {row.subtitle}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={row.kind === "return" ? "blue" : "slate"}>
                        {row.typeLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {row.customerName}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {row.itemsCount}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">
                      {formatMoneyValue(row.amount)}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {row.createdBy}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() =>
                            openOrderDrawer(
                              row.order,
                              row.kind === "return" ? row.returnId : undefined
                            )
                          }
                        >
                          {row.kind === "return"
                            ? "Xem phiếu trả"
                            : "Xem chi tiết"}
                        </Button>
                        {row.kind === "order" ? (
                          <Button
                            variant="danger"
                            size="sm"
                            busy={
                              cancelMutation.isPending &&
                              cancelMutation.variables === row.order.id
                            }
                            disabled={row.order.status === "CANCELLED"}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hủy hóa đơn ${row.order.orderNumber}?`
                                )
                              ) {
                                cancelMutation.mutate(row.order.id);
                              }
                            }}
                          >
                            Hủy
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-14 text-center text-slate-500"
                  >
                    Không tìm thấy chứng từ phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-9 w-[104px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-4 focus:ring-[#1677ff]/10"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} dòng
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton
              icon="chevronsLeft"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            />
            <PaginationButton
              icon="chevronLeft"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            />
            <div className="flex h-9 min-w-[42px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-medium text-slate-700">
              {currentPage}
            </div>
            <PaginationButton
              icon="chevronRight"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            />
            <PaginationButton
              icon="chevronsRight"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            />
            <span className="ml-2 whitespace-nowrap">
              {paginationRange.from} - {paginationRange.to} trong{" "}
              {filteredRows.length} chứng từ
            </span>
          </div>
        </div>
      </Panel>

      <Drawer
        open={Boolean(selected)}
        title={
          focusedReturn
            ? `${focusedReturn.returnNumber} • ${selected?.orderNumber ?? ""}`
            : selected?.orderNumber ?? "Chi tiết hóa đơn"
        }
        onClose={() => {
          setSelected(null);
          setFocusedReturnId(null);
        }}
      >
        {selected ? (
          <div className="space-y-5">
            {focusedReturn ? (
              <Panel className="border-blue-200 bg-blue-50/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-500">Phiếu trả hàng</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {focusedReturn.returnNumber}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {formatDateTime(focusedReturn.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Tiền hoàn</div>
                    <div className="mt-2 text-2xl font-semibold text-[#1677ff]">
                      {formatCurrency(focusedReturn.total)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">
                    {formatOrderReturnInvoiceAction(
                      focusedReturn.invoiceAction
                    )}
                  </Badge>
                </div>

                {focusedReturn.reason ? (
                  <div className="mt-4 text-sm text-slate-700">
                    Lý do: {focusedReturn.reason}
                  </div>
                ) : null}

                {focusedReturn.invoiceNote ? (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {focusedReturn.invoiceNote}
                  </div>
                ) : null}
              </Panel>
            ) : null}

            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-400">Trạng thái</div>
                  <div className="mt-2">
                    <Badge tone={getStatusTone(selected.status)}>
                      {formatOrderStatus(selected.status)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Tổng thanh toán</div>
                  <div className="mt-2 text-3xl font-semibold text-[#1677ff]">
                    {formatMoneyValue(selected.total)}
                  </div>
                </div>
              </div>

              {selected.status === "PAID" && selectedReturnableItems.length ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="soft"
                    onClick={() => openReturnModal(selected)}
                  >
                    Trả hàng một phần
                  </Button>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 text-sm">
                <InfoLine
                  label="Tạm tính"
                  value={formatCurrency(selected.subtotal)}
                />
                <InfoLine
                  label="Giảm giá"
                  value={formatCurrency(selected.discount)}
                />
                <InfoLine label="Thuế" value={formatCurrency(selected.tax)} />
                <InfoLine
                  label="Tạo lúc"
                  value={formatDateTime(selected.createdAt)}
                />
                <InfoLine
                  label="Thu ngân"
                  value={selected.createdBy?.fullName ?? "--"}
                />
                <InfoLine
                  label="Thanh toán lúc"
                  value={formatDateTime(selected.paidAt ?? null)}
                />
                <InfoLine
                  label="Đã hoàn tiền"
                  value={formatCurrency(refundedAmount)}
                />
              </div>
            </Panel>

            <DetailSection title="Danh sách mặt hàng">
              {selected.items.length ? (
                selected.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.productName}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Đã trả {selectedReturnedQuantityMap.get(item.id) ?? 0}/
                        {item.quantity}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(item.lineTotal)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText text="Chưa có mặt hàng trong hóa đơn." />
              )}
            </DetailSection>

            <DetailSection title="Phiếu trả hàng">
              {selected.returns?.length ? (
                selected.returns.map((orderReturn) => (
                  <div
                    key={orderReturn.id}
                    className={cn(
                      "rounded-md border bg-slate-50 px-4 py-4",
                      focusedReturnId === orderReturn.id
                        ? "border-blue-200 bg-blue-50/60"
                        : "border-slate-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {orderReturn.returnNumber}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {formatDateTime(orderReturn.createdAt)}
                          {orderReturn.createdBy?.fullName
                            ? ` • ${orderReturn.createdBy.fullName}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Tiền hoàn</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrency(orderReturn.total)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="blue">
                        {formatOrderReturnInvoiceAction(
                          orderReturn.invoiceAction
                        )}
                      </Badge>
                    </div>

                    {orderReturn.reason ? (
                      <div className="mt-3 text-sm text-slate-600">
                        Lý do: {orderReturn.reason}
                      </div>
                    ) : null}

                    {orderReturn.invoiceNote ? (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {orderReturn.invoiceNote}
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-2">
                      {orderReturn.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 rounded-md bg-white px-4 py-3"
                        >
                          <div>
                            <div className="font-medium text-slate-900">
                              {item.productName}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              Trả {item.quantity} • Nhập lại kho{" "}
                              {item.restockedQuantity}/{item.quantity}
                            </div>
                          </div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText text="Chưa có phiếu trả hàng nào." />
              )}
            </DetailSection>

            <DetailSection title="Bút toán doanh thu">
              {selected.revenueLogs?.length ? (
                selected.revenueLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="font-medium text-slate-900">
                      {formatRevenueLogType(log.type)} •{" "}
                      {formatCurrency(log.amount)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {log.reason ?? "Không có lý do"} •{" "}
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText text="Không có revenue log." />
              )}
            </DetailSection>

            <DetailSection title="Giao dịch thanh toán">
              {selected.paymentTransactions?.length ? (
                selected.paymentTransactions.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="font-medium text-slate-900">
                      {formatPaymentTransactionType(payment.type)} •{" "}
                      {formatPaymentMethod(payment.method)} •{" "}
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {payment.externalReference ??
                        payment.note ??
                        "Không có tham chiếu"}{" "}
                      • {formatDateTime(payment.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText text="Không có giao dịch thanh toán." />
              )}
            </DetailSection>

            <DetailSection title="Hóa đơn điện tử">
              {selected.invoice ? (
                <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-4 text-sm">
                  <InfoLine
                    label="Nhà cung cấp"
                    value={selected.invoice.provider}
                  />
                  <InfoLine
                    label="Trạng thái"
                    value={formatInvoiceStatus(selected.invoice.status)}
                  />
                  <InfoLine
                    label="Mã tham chiếu"
                    value={selected.invoice.externalReference ?? "--"}
                  />
                  <InfoLine
                    label="Series"
                    value={selected.invoice.invoiceSeries ?? "--"}
                  />
                  <InfoLine
                    label="Template"
                    value={selected.invoice.invoiceTemplateCode ?? "--"}
                  />
                  <InfoLine
                    label="Ghi chú xử lý"
                    value={selected.invoice.providerStatusMessage ?? "--"}
                  />
                </div>
              ) : (
                <EmptyText text="Hóa đơn này chưa tạo invoice điện tử." />
              )}
            </DetailSection>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={returnModalOpen && Boolean(selected)}
        title={
          selected
            ? `Trả hàng cho ${selected.orderNumber}`
            : "Trả hàng một phần"
        }
        onClose={() => {
          setReturnModalOpen(false);
          setReturnReason("");
          setReturnItems([]);
        }}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setReturnModalOpen(false);
                setReturnReason("");
                setReturnItems([]);
              }}
            >
              Đóng
            </Button>
            <Button
              variant="primary"
              busy={returnMutation.isPending}
              onClick={submitReturn}
            >
              Xác nhận trả hàng
            </Button>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">
              Sau khi xác nhận, hệ thống sẽ tạo phiếu trả hàng, bút toán giảm
              doanh thu, giao dịch hoàn tiền và chỉ nhập lại tồn kho cho những
              món được đánh dấu đủ điều kiện bán lại.
            </div>

            <div className="space-y-3">
              {returnItems.length ? (
                returnItems.map((item, index) => (
                  <div
                    key={item.orderItemId}
                    className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-slate-900">
                          {item.productName}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.sku} • Đã bán {item.soldQuantity} • Đã trả{" "}
                          {item.returnedQuantity} • Còn được trả{" "}
                          {item.availableQuantity}
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        Hoàn tối đa{" "}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(item.refundableAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
                      <Field label="Số lượng trả">
                        <NumberInput
                          min={0}
                          max={item.availableQuantity}
                          value={String(item.quantity)}
                          onChange={(event) => {
                            const nextQuantity = Math.max(
                              0,
                              Math.min(
                                item.availableQuantity,
                                Number(event.target.value || 0)
                              )
                            );
                            setReturnItems((current) =>
                              current.map((currentItem, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...currentItem,
                                      quantity: nextQuantity,
                                      restock:
                                        nextQuantity === 0
                                          ? false
                                          : currentItem.restock,
                                    }
                                  : currentItem
                              )
                            );
                          }}
                        />
                      </Field>

                      <div className="flex items-end">
                        <Checkbox
                          checked={item.restock}
                          onChange={(checked) => {
                            setReturnItems((current) =>
                              current.map((currentItem, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...currentItem,
                                      restock:
                                        currentItem.quantity > 0 && checked,
                                    }
                                  : currentItem
                              )
                            );
                          }}
                          label="Nhập lại tồn kho bán được"
                          className="pt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyText text="Không còn mặt hàng nào có thể trả." />
              )}
            </div>

            <Field
              label="Lý do trả hàng"
              hint="Dùng để ghi nhận phiếu trả hàng, bút toán điều chỉnh và hoàn tiền."
            >
              <TextArea
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="Ví dụ: Khách đổi ý, sản phẩm lỗi, giao nhầm hàng..."
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-500">Tiền hoàn dự kiến</span>
              <span className="text-lg font-semibold text-slate-900">
                {formatCurrency(calculateReturnPreviewTotal(returnItems))}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function buildReturnedQuantityMap(orderReturns?: Order["returns"]) {
  const map = new Map<string, number>();

  orderReturns?.forEach((orderReturn) => {
    orderReturn.items.forEach((item) => {
      map.set(
        item.orderItemId,
        (map.get(item.orderItemId) ?? 0) + item.quantity
      );
    });
  });

  return map;
}

function buildInvoiceRows(orders: Order[]): InvoiceListRow[] {
  return orders
    .flatMap((order) => {
      const rows: InvoiceListRow[] = [
        {
          id: `order-${order.id}`,
          kind: "order",
          code: order.orderNumber,
          typeLabel: "Bán hàng",
          customerName: order.customerName ?? "Khách lẻ",
          statusKey: order.status,
          statusLabel: formatOrderStatus(order.status),
          statusTone: getStatusTone(order.status),
          itemsCount: order.items.length,
          amount: toNumber(order.total),
          createdBy: order.createdBy?.fullName ?? "--",
          createdAt: order.createdAt,
          order,
          subtitle: order.invoice?.externalReference
            ? `Mã invoice ${order.invoice.externalReference}`
            : "",
        },
      ];

      order.returns?.forEach((orderReturn) => {
        rows.push({
          id: `return-${orderReturn.id}`,
          kind: "return",
          code: orderReturn.returnNumber,
          typeLabel: "Trả hàng",
          customerName: order.customerName ?? "Khách lẻ",
          statusKey: "RETURNED",
          statusLabel: "Đã hoàn tiền",
          statusTone: "blue",
          itemsCount: orderReturn.items.length,
          amount: toNumber(orderReturn.total),
          createdBy: orderReturn.createdBy?.fullName ?? "--",
          createdAt: orderReturn.createdAt,
          order,
          returnId: orderReturn.id,
          subtitle: `Hoàn cho ${order.orderNumber}`,
        });
      });

      return rows;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
}

function buildReturnedAmountMap(orderReturns?: Order["returns"]) {
  const map = new Map<string, number>();

  orderReturns?.forEach((orderReturn) => {
    orderReturn.items.forEach((item) => {
      map.set(
        item.orderItemId,
        (map.get(item.orderItemId) ?? 0) + toNumber(item.lineTotal)
      );
    });
  });

  return map;
}

function buildReturnDraft(order: Order): ReturnDraftItem[] {
  const returnedQuantityMap = buildReturnedQuantityMap(order.returns);
  const returnedAmountMap = buildReturnedAmountMap(order.returns);

  return order.items
    .map((item) => {
      const returnedQuantity = returnedQuantityMap.get(item.id) ?? 0;
      const availableQuantity = Math.max(0, item.quantity - returnedQuantity);
      const remainingRefundableAmount = Math.max(
        0,
        toNumber(item.lineTotal) - (returnedAmountMap.get(item.id) ?? 0)
      );

      return {
        orderItemId: item.id,
        productName: item.productName,
        sku: item.sku,
        soldQuantity: item.quantity,
        returnedQuantity,
        availableQuantity,
        quantity: 0,
        restock: false,
        refundableAmount: remainingRefundableAmount,
      };
    })
    .filter((item) => item.availableQuantity > 0);
}

function calculateReturnPreviewTotal(items: ReturnDraftItem[]) {
  return items.reduce((sum, item) => {
    if (!item.quantity || !item.availableQuantity) {
      return sum;
    }

    return (
      sum + (item.refundableAmount * item.quantity) / item.availableQuantity
    );
  }, 0);
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 text-base font-semibold text-slate-900">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function PaginationButton({
  icon,
  disabled,
  onClick,
}: {
  icon: "chevronsLeft" | "chevronLeft" | "chevronRight" | "chevronsRight";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md border transition",
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
