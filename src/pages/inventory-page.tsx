import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons";
import {
  Badge,
  Button,
  NumberInput,
  Panel,
  SelectInput,
  TextInput,
} from "../components/ui";
import { useToast } from "../components/toast-provider";
import { adjustInventory, extractErrorMessage, getInventory } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDateTime } from "../lib/utils";
import type { Inventory } from "../types";

type StockFilter = "ALL" | "LOW" | "IN_STOCK" | "OUT_OF_STOCK";
const pageSizeOptions = [15, 25, 50] as const;

type DraftAdjustment = {
  delta: string;
  minStock: string;
};

export function InventoryPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [draftAdjustments, setDraftAdjustments] = useState<
    Record<string, DraftAdjustment>
  >({});

  const query = useQuery({ queryKey: ["inventory"], queryFn: getInventory });

  useEffect(() => {
    const next: Record<string, DraftAdjustment> = {};
    for (const item of query.data ?? []) {
      next[item.productId] = {
        delta: "",
        minStock: String(item.minStock ?? 0),
      };
    }
    setDraftAdjustments(next);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: ({
      productId,
      delta,
      minStock,
    }: {
      productId: string;
      delta: number;
      minStock: number;
    }) =>
      adjustInventory(productId, {
        type: delta > 0 ? "RESTOCK" : "ADJUSTMENT",
        delta,
        minStock,
      }),
    onSuccess: async () => {
      toast.success("Đã cập nhật tồn kho");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const filteredInventory = useMemo(() => {
    return (query.data ?? []).filter((item) => {
      const quantity = item.quantity ?? 0;
      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        [item.product.sku, item.product.name]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchesStock =
        stockFilter === "ALL" ||
        (stockFilter === "LOW" && quantity <= item.minStock) ||
        (stockFilter === "IN_STOCK" && quantity > 0) ||
        (stockFilter === "OUT_OF_STOCK" && quantity <= 0);

      return matchesSearch && matchesStock;
    });
  }, [query.data, search, stockFilter]);

  const inventorySummary = useMemo(() => {
    const inventory = query.data ?? [];
    return {
      total: inventory.length,
      inStock: inventory.filter((item) => item.quantity > 0).length,
      lowStock: inventory.filter((item) => item.quantity <= item.minStock)
        .length,
      outOfStock: inventory.filter((item) => item.quantity <= 0).length,
    };
  }, [query.data]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, stockFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / pageSize)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredInventory.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredInventory, pageSize]);

  const paginationRange = useMemo(() => {
    if (!filteredInventory.length) {
      return { from: 0, to: 0 };
    }

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, filteredInventory.length);
    return { from, to };
  }, [currentPage, filteredInventory.length, pageSize]);

  const handleSaveInventory = (item: Inventory) => {
    const draft = draftAdjustments[item.productId];
    const nextMinStock = Number(draft?.minStock ?? item.minStock);
    const delta = Number(draft?.delta || 0);

    if (!Number.isFinite(nextMinStock) || nextMinStock < 0) {
      toast.warning("Tồn tối thiểu phải lớn hơn hoặc bằng 0");
      return;
    }

    if (!Number.isFinite(delta)) {
      toast.warning("Số điều chỉnh không hợp lệ");
      return;
    }

    if (delta === 0 && nextMinStock === item.minStock) {
      toast.info("Chưa có thay đổi để cập nhật");
      return;
    }

    saveMutation.mutate({
      productId: item.productId,
      delta,
      minStock: nextMinStock,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-slate-900">
            Quản lý tồn kho
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Theo dõi số lượng tồn, ngưỡng tối thiểu và điều chỉnh nhập hoặc giảm
            kho trực tiếp trên từng mặt hàng.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{inventorySummary.total} mặt hàng</Badge>
          <Badge tone="amber">{inventorySummary.lowStock} sắp hết</Badge>
          <Badge tone="red">{inventorySummary.outOfStock} hết hàng</Badge>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[320px] flex-1 flex-wrap items-center gap-3">
            <div className="min-w-[280px] max-w-2xl flex-1">
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã hoặc tên hàng"
              />
            </div>
            <div className="w-full sm:w-[240px]">
              <SelectInput
                aria-label="Trạng thái tồn kho"
                value={stockFilter}
                onChange={(event) =>
                  setStockFilter(event.target.value as StockFilter)
                }
                // className="bg-white"
              >
                <option value="ALL">Tất cả</option>
                <option value="LOW">Sắp hết hàng</option>
                <option value="IN_STOCK">Còn hàng</option>
                <option value="OUT_OF_STOCK">Hết hàng</option>
              </SelectInput>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="soft"
              onClick={() =>
                toast.info("Chọn số dương để nhập thêm, số âm để giảm kho.")
              }
            >
              <Icon name="plus" className="h-4 w-4" />
              Điều chỉnh kho
            </Button>
            {/* <Button
              variant="secondary"
              onClick={() => toast.info("Chức năng import chưa được nối API.")}
            >
              <Icon name="upload" className="h-4 w-4" />
              Import
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.info("Chức năng export chưa được nối API.")}
            >
              <Icon name="download" className="h-4 w-4" />
              Xuất file
            </Button> */}
          </div>
        </div>

        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#eaf3ff] text-slate-700">
                <tr>
                  <th className="px-4 py-4 text-left font-semibold">Mã hàng</th>
                  <th className="px-4 py-4 text-left font-semibold">
                    Tên hàng
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Tồn hiện tại
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Tồn tối thiểu
                  </th>
                  <th className="px-4 py-4 text-center font-semibold">
                    Trạng thái
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Điều chỉnh
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Cập nhật cuối
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Đang tải dữ liệu tồn kho...
                    </td>
                  </tr>
                ) : paginatedInventory.length ? (
                  paginatedInventory.map((item) => {
                    const draft = draftAdjustments[item.productId] ?? {
                      delta: "",
                      minStock: String(item.minStock ?? 0),
                    };
                    const isSaving =
                      saveMutation.isPending &&
                      saveMutation.variables?.productId === item.productId;
                    const statusTone =
                      item.quantity <= 0
                        ? "red"
                        : item.quantity <= item.minStock
                        ? "amber"
                        : "green";
                    const statusLabel =
                      item.quantity <= 0
                        ? "Hết hàng"
                        : item.quantity <= item.minStock
                        ? "Sắp hết"
                        : "Ổn định";

                    return (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4 font-medium text-slate-700">
                          {item.product.sku}
                        </td>
                        <td className="px-4 py-4 text-slate-900">
                          {item.product.name}
                        </td>
                        <td className="px-4 py-4 text-right text-base font-semibold text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-4">
                          <div className="ml-auto max-w-[110px]">
                            <NumberInput
                              value={draft.minStock}
                              onChange={(event) =>
                                setDraftAdjustments((current) => ({
                                  ...current,
                                  [item.productId]: {
                                    ...(current[item.productId] ?? draft),
                                    minStock: event.target.value,
                                  },
                                }))
                              }
                              className="h-10 text-right"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge tone={statusTone}>{statusLabel}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="ml-auto max-w-[120px]">
                            <NumberInput
                              value={draft.delta}
                              onChange={(event) =>
                                setDraftAdjustments((current) => ({
                                  ...current,
                                  [item.productId]: {
                                    ...(current[item.productId] ?? draft),
                                    delta: event.target.value,
                                  },
                                }))
                              }
                              placeholder="+10 / -3"
                              className="h-10 text-right"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-slate-500">
                          {formatDateTime(item.updatedAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              busy={isSaving}
                              onClick={() => handleSaveInventory(item)}
                            >
                              Lưu
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-14 text-center text-slate-500"
                    >
                      Không có mặt hàng phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <SelectInput
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 w-[104px] rounded-md border-slate-300 bg-white"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} dòng
                  </option>
                ))}
              </SelectInput>
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
                {filteredInventory.length} mặt hàng
              </span>
            </div>
          </div>
        </Panel>
      </div>
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
