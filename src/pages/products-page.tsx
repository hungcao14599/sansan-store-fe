import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Icon } from "../components/icons";
import { ProductAvatar } from "../components/product-avatar";
import {
  Badge,
  Button,
  CurrencyInput,
  Field,
  Modal,
  NumberInput,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
} from "../components/ui";
import { useToast } from "../components/toast-provider";
import {
  createProduct,
  deactivateProduct,
  extractErrorMessage,
  getProducts,
  updateProduct,
} from "../lib/api";
import { taxCategoryOptions } from "../lib/tax";
import { cn } from "../lib/cn";
import { formatDateTime, formatMoneyValue } from "../lib/utils";
import type { Product } from "../types";

const productSchema = z.object({
  sku: z.string().min(2, "SKU tối thiểu 2 ký tự"),
  name: z.string().min(2, "Tên sản phẩm là bắt buộc"),
  unit: z.string().min(1, "Đơn vị là bắt buộc"),
  price: z.number({ invalid_type_error: "Nhập giá bán" }).positive(),
  costPrice: z.number().min(0).optional().nullable(),
  discountAmount: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  taxCategory: z.enum(["NO_VAT", "VAT_0", "VAT_5", "VAT_8", "VAT_10"]),
  barcode: z.string().optional(),
  description: z.string().optional(),
  initialStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type StockFilter = "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
type ActiveFilter = "ALL" | "YES" | "NO";
type ForecastFilterMode = "ALL" | "CUSTOM";
type ForecastFilterLevel = "LOW" | "OUT";
type CreatedTimeFilterMode = "ALL" | "CUSTOM";
const pageSizeOptions = [15, 25, 50] as const;

export function ProductsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const selectPageCheckboxRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [forecastMode, setForecastMode] = useState<ForecastFilterMode>("ALL");
  const [forecastLevel, setForecastLevel] =
    useState<ForecastFilterLevel>("LOW");
  const [createdTimeMode, setCreatedTimeMode] =
    useState<CreatedTimeFilterMode>("ALL");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [starredProductIds, setStarredProductIds] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      unit: "sp",
      price: 0,
      costPrice: null,
      discountAmount: 0,
      discountPercent: 0,
      taxCategory: "NO_VAT",
      barcode: "",
      description: "",
      initialStock: 0,
      minStock: 0,
    },
  });

  useEffect(() => {
    if (editing) {
      reset({
        sku: editing.sku,
        name: editing.name,
        unit: editing.unit,
        price: Number(editing.price),
        costPrice: editing.costPrice ? Number(editing.costPrice) : null,
        discountAmount: Number(editing.discountAmount ?? 0),
        discountPercent: Number(editing.discountPercent ?? 0),
        taxCategory: editing.taxCategory,
        barcode: editing.barcode ?? "",
        description: editing.description ?? "",
        initialStock: editing.inventory?.quantity ?? 0,
        minStock: editing.inventory?.minStock ?? 0,
      });
      return;
    }

    reset({
      sku: "",
      name: "",
      unit: "sp",
      price: 0,
      costPrice: null,
      discountAmount: 0,
      discountPercent: 0,
      taxCategory: "NO_VAT",
      barcode: "",
      description: "",
      initialStock: 0,
      minStock: 0,
    });
  }, [editing, reset]);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (editing) {
        return updateProduct(editing.id, {
          sku: values.sku,
          name: values.name,
          unit: values.unit,
          price: values.price,
          costPrice: values.costPrice ?? undefined,
          discountAmount: values.discountAmount,
          discountPercent: values.discountPercent,
          taxCategory: values.taxCategory,
          barcode: values.barcode || undefined,
          description: values.description || undefined,
        });
      }

      return createProduct({
        ...values,
        costPrice: values.costPrice ?? undefined,
        barcode: values.barcode || undefined,
        description: values.description || undefined,
      });
    },
    onSuccess: async () => {
      toast.success(editing ? "Đã cập nhật sản phẩm" : "Đã tạo sản phẩm");
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateProduct,
    onSuccess: async () => {
      toast.success("Đã ngưng kinh doanh sản phẩm");
      closeModal();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const filteredProducts = useMemo(() => {
    return (query.data ?? []).filter((product) => {
      const normalizedSearch = search.trim().toLowerCase();
      const normalizedProductType = productTypeFilter.trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch ||
        [product.sku, product.name, product.barcode ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const quantity = product.inventory?.quantity ?? 0;
      const minStock = product.inventory?.minStock ?? 0;
      const matchesStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" && quantity > 0) ||
        (stockFilter === "OUT_OF_STOCK" && quantity <= 0);

      const matchesActive =
        activeFilter === "ALL" ||
        (activeFilter === "YES" && product.isActive) ||
        (activeFilter === "NO" && !product.isActive);

      const matchesProductType =
        !normalizedProductType ||
        product.unit.toLowerCase().includes(normalizedProductType);
      const matchesForecast =
        forecastMode === "ALL" ||
        (forecastLevel === "OUT" ? quantity <= 0 : quantity <= minStock);

      const createdAt = new Date(product.createdAt).getTime();
      const fromTime = createdFrom
        ? new Date(`${createdFrom}T00:00:00`).getTime()
        : null;
      const toTime = createdTo
        ? new Date(`${createdTo}T23:59:59`).getTime()
        : null;
      const matchesCreatedTime =
        createdTimeMode === "ALL" ||
        ((!fromTime || createdAt >= fromTime) &&
          (!toTime || createdAt <= toTime));

      return (
        matchesSearch &&
        matchesStock &&
        matchesActive &&
        matchesProductType &&
        matchesForecast &&
        matchesCreatedTime
      );
    });
  }, [
    activeFilter,
    createdFrom,
    createdTimeMode,
    createdTo,
    forecastLevel,
    forecastMode,
    productTypeFilter,
    query.data,
    search,
    stockFilter,
  ]);

  const unitOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (query.data ?? []).map((product) => product.unit).filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right)),
    [query.data]
  );

  const summary = useMemo(
    () => ({
      total: query.data?.length ?? 0,
      active: query.data?.filter((item) => item.isActive).length ?? 0,
      lowStock:
        query.data?.filter(
          (item) =>
            (item.inventory?.quantity ?? 0) <= (item.inventory?.minStock ?? 0)
        ).length ?? 0,
    }),
    [query.data]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeFilter,
    createdFrom,
    createdTimeMode,
    createdTo,
    forecastLevel,
    forecastMode,
    productTypeFilter,
    search,
    stockFilter,
  ]);

  useEffect(() => {
    const validIds = new Set((query.data ?? []).map((item) => item.id));
    setSelectedProductIds((current) =>
      current.filter((item) => validIds.has(item))
    );
    setStarredProductIds((current) =>
      current.filter((item) => validIds.has(item))
    );
  }, [query.data]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredProducts, pageSize]);

  const currentPageIds = useMemo(
    () => paginatedProducts.map((product) => product.id),
    [paginatedProducts]
  );

  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedProductIds.includes(id));
  const someCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.some((id) => selectedProductIds.includes(id));

  useEffect(() => {
    if (selectPageCheckboxRef.current) {
      selectPageCheckboxRef.current.indeterminate =
        someCurrentPageSelected && !allCurrentPageSelected;
    }
  }, [allCurrentPageSelected, someCurrentPageSelected]);

  const paginationRange = useMemo(() => {
    if (!filteredProducts.length) {
      return { from: 0, to: 0 };
    }

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, filteredProducts.length);
    return { from, to };
  }, [currentPage, filteredProducts.length, pageSize]);

  const openCreateModal = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditing(product);
    setOpen(true);
  };

  const toggleSelectedProduct = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((item) => item !== productId)
        : [...current, productId]
    );
  };

  const toggleSelectedCurrentPage = () => {
    setSelectedProductIds((current) => {
      if (allCurrentPageSelected) {
        return current.filter((item) => !currentPageIds.includes(item));
      }

      return [...new Set([...current, ...currentPageIds])];
    });
  };

  const toggleStarredProduct = (productId: string) => {
    setStarredProductIds((current) =>
      current.includes(productId)
        ? current.filter((item) => item !== productId)
        : [...current, productId]
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-slate-900">Hàng hóa</h1>
          <p className="mt-2 text-sm text-slate-500">
            Bố cục được cập nhật theo kiểu quản lý hàng hóa của KiotViet: filter
            trái, grid dữ liệu phải và action bar nằm trên cùng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{summary.total} mặt hàng</Badge>
          <Badge tone="green">{summary.active} đang bán</Badge>
          <Badge tone="amber">{summary.lowStock} cần nhập thêm</Badge>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Panel className="p-5">
          <div className="space-y-5">
            <SidebarBlock
              title="Tồn kho"
              content={
                <SelectInput
                  value={stockFilter}
                  onChange={(event) =>
                    setStockFilter(event.target.value as StockFilter)
                  }
                >
                  <option value="ALL">Tất cả</option>
                  <option value="IN_STOCK">Còn hàng</option>
                  <option value="OUT_OF_STOCK">Hết hàng</option>
                </SelectInput>
              }
            />
            <SidebarBlock
              title="Dự kiến hết hàng"
              content={
                <div className="space-y-3">
                  <FilterRadio
                    label="Toàn thời gian"
                    checked={forecastMode === "ALL"}
                    onClick={() => setForecastMode("ALL")}
                  />
                  <FilterRadio
                    label="Tùy chỉnh"
                    checked={forecastMode === "CUSTOM"}
                    onClick={() => setForecastMode("CUSTOM")}
                  />
                  {forecastMode === "CUSTOM" ? (
                    <SelectInput
                      value={forecastLevel}
                      onChange={(event) =>
                        setForecastLevel(
                          event.target.value as ForecastFilterLevel
                        )
                      }
                    >
                      <option value="LOW">Sắp hết hàng</option>
                      <option value="OUT">Hết hàng</option>
                    </SelectInput>
                  ) : null}
                </div>
              }
            />
            <SidebarBlock
              title="Thời gian tạo"
              content={
                <div className="space-y-3">
                  <FilterRadio
                    label="Toàn thời gian"
                    checked={createdTimeMode === "ALL"}
                    onClick={() => setCreatedTimeMode("ALL")}
                  />
                  <FilterRadio
                    label="Tùy chỉnh"
                    checked={createdTimeMode === "CUSTOM"}
                    onClick={() => setCreatedTimeMode("CUSTOM")}
                  />
                  {createdTimeMode === "CUSTOM" ? (
                    <div className="grid gap-3">
                      <TextInput
                        type="date"
                        value={createdFrom}
                        onChange={(event) => setCreatedFrom(event.target.value)}
                      />
                      <TextInput
                        type="date"
                        value={createdTo}
                        onChange={(event) => setCreatedTo(event.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              }
            />

            <SidebarBlock
              title="Loại hàng"
              content={
                <SelectInput
                  value={productTypeFilter}
                  onChange={(event) => setProductTypeFilter(event.target.value)}
                >
                  <option value="">Tất cả</option>
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </SelectInput>
              }
            />

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-900">
                Bán trực tiếp
              </div>
              <div className="flex gap-2">
                {[
                  ["ALL", "Tất cả"],
                  ["YES", "Có"],
                  ["NO", "Không"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium transition",
                      activeFilter === value
                        ? "border-[#1677ff] bg-[#1677ff] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                    onClick={() => setActiveFilter(value as ActiveFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[280px] max-w-xl flex-1">
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã, tên hàng"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Icon name="sliders" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="border-[#86b3ff] text-[#1677ff] hover:border-[#5d97ff] hover:bg-blue-50"
                onClick={openCreateModal}
              >
                <Icon name="plus" className="h-4 w-4" />
                Tạo mới
                <Icon name="chevronDown" className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.info("Chức năng import chưa được nối API.")
                }
              >
                <Icon name="upload" className="h-4 w-4" />
                Import file
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.info("Chức năng export chưa được nối API.")
                }
              >
                <Icon name="download" className="h-4 w-4" />
                Xuất file
              </Button>
              <IconButton icon="grid" />
              <IconButton icon="settings" />
              <IconButton icon="help" />
            </div>
          </div>

          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] table-fixed text-sm">
                <thead className="border-b border-[#b8d0ee] bg-[#d9e9fb] text-slate-700">
                  <tr>
                    <th className="w-10 px-3 py-3.5 text-left font-semibold">
                      <input
                        ref={selectPageCheckboxRef}
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={toggleSelectedCurrentPage}
                        className="h-4 w-4 rounded border-slate-300 text-[#1677ff] focus:ring-[#1677ff]"
                      />
                    </th>
                    <th className="w-10 px-2 py-3.5 text-left font-semibold">
                      <Icon name="star" className="h-4 w-4 text-slate-400" />
                    </th>
                    <th className="w-11 px-2 py-3.5 text-left font-semibold" />
                    <th className="w-[148px] px-4 py-3.5 text-left font-semibold">
                      Mã hàng
                    </th>
                    <th className="w-[238px] px-4 py-3.5 text-left font-semibold">
                      Tên hàng
                    </th>
                    <th className="w-[126px] px-4 py-3.5 text-right font-semibold">
                      Giá bán
                    </th>
                    <th className="w-[126px] px-4 py-3.5 text-right font-semibold">
                      Giá vốn
                    </th>
                    <th className="w-[118px] px-4 py-3.5 text-right font-semibold">
                      Tồn kho
                    </th>
                    <th className="w-[118px] px-4 py-3.5 text-right font-semibold">
                      Khách đặt
                    </th>
                    <th className="w-[146px] px-4 py-3.5 text-left font-semibold">
                      Thời gian tạo
                    </th>
                    <th className="w-[150px] px-4 py-3.5 text-left font-semibold">
                      Dự kiến hết hàng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.isLoading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        Đang tải dữ liệu hàng hóa...
                      </td>
                    </tr>
                  ) : paginatedProducts.length ? (
                    paginatedProducts.map((product) => {
                      const quantity = product.inventory?.quantity ?? 0;
                      const isSelected = selectedProductIds.includes(
                        product.id
                      );
                      const isStarred = starredProductIds.includes(product.id);

                      return (
                        <tr
                          key={product.id}
                          className={cn(
                            "border-b border-slate-100 transition hover:bg-slate-50/80",
                            isSelected ? "bg-blue-50/40" : "bg-white"
                          )}
                        >
                          <td className="px-3 py-3.5 align-top">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectedProduct(product.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[#1677ff] focus:ring-[#1677ff]"
                            />
                          </td>
                          <td className="px-2 py-3.5 align-top">
                            <button
                              className="text-slate-300 transition hover:text-amber-400"
                              onClick={() => toggleStarredProduct(product.id)}
                            >
                              <Icon
                                name="star"
                                className={cn(
                                  "h-4 w-4",
                                  isStarred
                                    ? "text-amber-400"
                                    : "text-slate-300"
                                )}
                                fill={isStarred ? "currentColor" : "none"}
                                strokeWidth={1.7}
                              />
                            </button>
                          </td>
                          <td className="px-2 py-3.5 align-top">
                            <ProductAvatar
                              seed={product.sku}
                              label={product.name}
                              className="h-7 w-7 rounded-md border-slate-200 shadow-none"
                            />
                          </td>
                          <td className="px-4 py-3.5 align-top font-medium text-slate-700">
                            {product.sku}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <button
                              className="block max-w-[220px] text-left text-[15px] font-medium leading-6 text-slate-900 transition hover:text-[#1677ff]"
                              onClick={() => openEditModal(product)}
                              title="Mở để chỉnh sửa sản phẩm"
                            >
                              {product.name}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 align-top text-right font-medium text-slate-900">
                            {formatMoneyValue(product.price)}
                          </td>
                          <td className="px-4 py-3.5 align-top text-right text-slate-600">
                            {formatMoneyValue(product.costPrice ?? 0)}
                          </td>
                          <td className="px-4 py-3.5 align-top text-right text-slate-600">
                            {quantity}
                          </td>
                          <td className="px-4 py-3.5 align-top text-right text-slate-600">
                            0
                          </td>
                          <td className="px-4 py-3.5 align-top text-slate-500">
                            {formatDateTime(product.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 align-top text-slate-400">
                            ---
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-6 py-14 text-center text-slate-500"
                      >
                        Không có sản phẩm phù hợp với bộ lọc hiện tại.
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
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
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
                  {filteredProducts.length} hàng hóa
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Modal
        open={open}
        title={
          editing ? `Cập nhật sản phẩm: ${editing.name}` : "Tạo sản phẩm mới"
        }
        onClose={closeModal}
      >
        <form
          className="space-y-5"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="sku"
              render={({ field }) => (
                <Field label="SKU" error={errors.sku?.message}>
                  <TextInput {...field} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Field label="Đơn vị" error={errors.unit?.message}>
                  <TextInput {...field} />
                </Field>
              )}
            />
          </div>

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Field label="Tên sản phẩm" error={errors.name?.message}>
                <TextInput {...field} />
              </Field>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <Field label="Giá bán" error={errors.price?.message}>
                  <CurrencyInput
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? 0)}
                  />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="taxCategory"
              render={({ field }) => (
                <Field label="Nhóm thuế">
                  <SelectInput value={field.value} onChange={field.onChange}>
                    {taxCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="costPrice"
              render={({ field }) => (
                <Field label="Giá vốn">
                  <CurrencyInput
                    value={field.value ?? null}
                    allowEmpty
                    onValueChange={(value) => field.onChange(value)}
                  />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="discountAmount"
              render={({ field }) => (
                <Field label="Giảm tiền" error={errors.discountAmount?.message}>
                  <CurrencyInput
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? 0)}
                  />
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="discountPercent"
              render={({ field }) => (
                <Field label="Giảm %" error={errors.discountPercent?.message}>
                  <NumberInput
                    min={0}
                    max={100}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value || 0))
                    }
                  />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="barcode"
              render={({ field }) => (
                <Field label="Barcode">
                  <TextInput {...field} value={field.value ?? ""} />
                </Field>
              )}
            />
          </div>

          {!editing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                control={control}
                name="initialStock"
                render={({ field }) => (
                  <Field label="Tồn ban đầu">
                    <NumberInput
                      min={0}
                      value={field.value ?? 0}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value || 0))
                      }
                    />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="minStock"
                render={({ field }) => (
                  <Field label="Mức tồn tối thiểu">
                    <NumberInput
                      min={0}
                      value={field.value ?? 0}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value || 0))
                      }
                    />
                  </Field>
                )}
              />
            </div>
          ) : null}

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Field label="Mô tả">
                <TextArea {...field} value={field.value ?? ""} />
              </Field>
            )}
          />

          <div className="flex justify-end gap-3">
            {editing ? (
              <Button
                variant="danger"
                className="mr-auto"
                busy={
                  deactivateMutation.isPending &&
                  deactivateMutation.variables === editing.id
                }
                disabled={!editing.isActive}
                onClick={() => {
                  if (window.confirm(`Ngưng kinh doanh ${editing.name}?`)) {
                    deactivateMutation.mutate(editing.id);
                  }
                }}
              >
                Ngưng bán
              </Button>
            ) : null}
            <Button variant="secondary" onClick={closeModal}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" busy={mutation.isPending}>
              {editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SidebarBlock({
  title,
  action,
  content,
}: {
  title: string;
  action?: string;
  content: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {action ? (
          <button className="text-sm font-medium text-[#1677ff]">
            {action}
          </button>
        ) : null}
      </div>
      {content}
    </div>
  );
}

function FilterRadio({
  label,
  checked = false,
  onClick,
}: {
  label: string;
  checked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-600 transition hover:border-slate-300"
      onClick={onClick}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-md border",
          checked
            ? "border-[#1677ff] bg-[#1677ff]"
            : "border-slate-300 bg-white"
        )}
      />
      <span>{label}</span>
      <Icon name="chevronRight" className="ml-auto h-4 w-4 text-slate-400" />
    </button>
  );
}

function IconButton({ icon }: { icon: "grid" | "settings" | "help" }) {
  return (
    <button className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50">
      <Icon name={icon} className="h-4 w-4" />
    </button>
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
