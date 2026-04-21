import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DateRangePicker,
  type DateRangeValue,
} from "../components/date-range-picker";
import { Icon } from "../components/icons";
import { useToast } from "../components/toast-provider";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Panel,
  SelectInput,
  Spinner,
} from "../components/ui";
import {
  downloadRevenueReportExcel,
  extractErrorMessage,
  getInventory,
  getOrders,
  getRevenueReport,
} from "../lib/api";
import {
  formatInventoryAlertLevel,
  formatCurrency,
  formatDateTime,
  formatMoneyValue,
  formatOrderStatus,
  getInventoryAlertLevel,
  getInventoryAlertTone,
  getStatusTone,
  toNumber,
} from "../lib/utils";

const groupByOptions = [
  { label: "Theo ngày", value: "day" },
  { label: "Theo tuần", value: "week" },
  { label: "Theo tháng", value: "month" },
  { label: "Theo quý", value: "quarter" },
  { label: "Theo năm", value: "year" },
] as const;

type RevenueGroupBy = (typeof groupByOptions)[number]["value"];

export function DashboardPage() {
  const toast = useToast();
  const [filters, setFilters] = useState(() => ({
    groupBy: "day" as RevenueGroupBy,
    ...getDefaultDateRange(),
  }));
  const [isExporting, setIsExporting] = useState(false);

  const invalidDateRange = dayjs(filters.fromDate).isAfter(
    dayjs(filters.toDate),
    "day",
  );
  const reportParams = {
    groupBy: filters.groupBy,
    from: dayjs(filters.fromDate).startOf("day").toISOString(),
    to: dayjs(filters.toDate).endOf("day").toISOString(),
  };

  const revenueQuery = useQuery({
    queryKey: [
      "report",
      "revenue",
      reportParams.groupBy,
      reportParams.from,
      reportParams.to,
    ],
    queryFn: () => getRevenueReport(reportParams),
    staleTime: 60_000,
    enabled: !invalidDateRange,
  });

  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: getOrders });
  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: getInventory,
  });

  const isLoading =
    ordersQuery.isLoading ||
    inventoryQuery.isLoading ||
    (!invalidDateRange && revenueQuery.isLoading && !revenueQuery.data);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-[#1677ff]">
        <Spinner className="h-8 w-8 border-[3px]" />
      </div>
    );
  }

  const orders = ordersQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];
  const revenue = revenueQuery.data;
  const soldProducts = revenue?.products ?? [];
  const revenueError = revenueQuery.error
    ? extractErrorMessage(revenueQuery.error)
    : null;
  const lowStock = inventory.filter((item) => item.quantity <= item.minStock);
  const paidOrders = orders.filter((order) => order.status === "PAID");
  const cancelledOrders = orders.filter(
    (order) => order.status === "CANCELLED",
  );
  const groupLabel =
    groupByOptions.find((item) => item.value === filters.groupBy)?.label ??
    "Theo ngày";
  const periodNoun = {
    day: "ngày",
    week: "tuần",
    month: "tháng",
    quarter: "quý",
    year: "năm",
  }[filters.groupBy];
  const chartData =
    revenue?.items.map((item) => ({
      label: formatReportPeriod(item.period, filters.groupBy, "short"),
      detailLabel: formatReportPeriod(item.period, filters.groupBy, "long"),
      total: toNumber(item.total),
      salesRevenue: toNumber(item.salesRevenue),
      adjustmentRevenue: toNumber(item.adjustmentRevenue),
      entries: item.entries,
    })) ?? [];
  const averageRevenue = chartData.length
    ? chartData.reduce((sum, item) => sum + item.total, 0) / chartData.length
    : 0;
  const topProduct = soldProducts[0];
  const totalProductsSold = revenue?.summary.totalProductsSold ?? 0;
  const totalUnitsSold = revenue?.summary.totalUnitsSold ?? 0;

  const metrics = [
    {
      label: "Doanh thu thuần",
      value: formatCurrency(revenue?.summary.totalRevenue),
      note: "Bao gồm doanh thu bán hàng và các adjustment trong kỳ",
      icon: "chart" as const,
    },
    {
      label: "Thu hộ trong kỳ",
      value: formatCurrency(revenue?.summary.grossCollections),
      note: "Tổng giá trị của các order đã thanh toán",
      icon: "bag" as const,
    },
    {
      label: "Mặt hàng đã bán",
      value: `${totalProductsSold}`,
      note: "Số SKU có phát sinh bán hàng trong khoảng đang xem",
      icon: "tag" as const,
    },
    {
      label: "Tổng số lượng bán",
      value: formatMoneyValue(totalUnitsSold),
      note: "Tổng đơn vị hàng hóa đã bán ra",
      icon: "check" as const,
    },
  ];

  async function handleExport() {
    if (invalidDateRange) {
      toast.error("Khoảng thời gian không hợp lệ.");
      return;
    }

    try {
      setIsExporting(true);
      const { blob, filename } = await downloadRevenueReportExcel(reportParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Đã xuất file Excel doanh thu.");
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-visible">
        <div className="flex flex-wrap items-start justify-between gap-5 px-6 py-6 lg:px-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#1677ff]">
              Dashboard
            </div>
            <h1 className="mt-3 font-display text-3xl text-slate-900">
              Doanh thu, sản phẩm đã bán và vận hành cửa hàng
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              Bộ lọc thời gian đã chuyển sang kiểu date range picker. Báo cáo
              giờ cho biết đã bán những sản phẩm nào, bán bao nhiêu và mang về
              bao nhiêu tiền trong từng khoảng thời gian.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{groupLabel}</Badge>
            <Badge tone="green">{paidOrders.length} hóa đơn đã thu</Badge>
            <Badge tone="blue">{totalProductsSold} mặt hàng đã bán</Badge>
            <Badge tone="amber">{lowStock.length} cảnh báo kho</Badge>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-5 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
            <Field label="Nhóm dữ liệu">
              <SelectInput
                value={filters.groupBy}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    groupBy: event.target.value as RevenueGroupBy,
                  }))
                }
              >
                {groupByOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <DateRangePicker
              value={{
                fromDate: filters.fromDate,
                toDate: filters.toDate,
              }}
              onApply={(nextRange) =>
                setFilters((current) => ({
                  ...current,
                  ...nextRange,
                }))
              }
              onReset={() =>
                setFilters((current) => ({
                  ...current,
                  ...getDefaultDateRange(),
                }))
              }
            />

            <div className="flex items-end gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setFilters({
                    groupBy: "day",
                    ...getDefaultDateRange(),
                  })
                }
              >
                <Icon name="refresh" className="h-4 w-4" />
                Mặc định
              </Button>
              <Button
                variant="primary"
                busy={isExporting}
                disabled={invalidDateRange || Boolean(revenueError)}
                onClick={handleExport}
              >
                <Icon name="download" className="h-4 w-4" />
                Xuất Excel
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Icon name="calendar" className="h-4 w-4 text-[#1677ff]" />
            <span>
              Đang xem từ {dayjs(filters.fromDate).format("DD/MM/YYYY")} đến{" "}
              {dayjs(filters.toDate).format("DD/MM/YYYY")}
            </span>
          </div>

          {invalidDateRange ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              Khoảng thời gian không hợp lệ.
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Panel key={item.label} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {item.label}
                </div>
                <div className="mt-3 text-3xl font-semibold text-slate-900">
                  {item.value}
                </div>
                <div className="mt-2 text-sm text-slate-500">{item.note}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-[#1677ff]">
                <Icon name={item.icon} className="h-5 w-5" />
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_0.9fr]">
        <Panel className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                Biểu đồ doanh thu theo {periodNoun}
              </div>
              <div className="text-sm text-slate-500">
                Theo khoảng thời gian đã chọn trong date range picker
              </div>
            </div>
            <div className="flex items-center gap-2">
              {revenueQuery.isFetching ? (
                <Spinner className="h-4 w-4 text-[#1677ff]" />
              ) : null}
              <Badge tone="blue">{chartData.length} kỳ dữ liệu</Badge>
            </div>
          </div>

          <div className="h-[320px]">
            {invalidDateRange || revenueError ? (
              <EmptyState
                className="h-full"
                title="Không thể tải biểu đồ"
                description={
                  invalidDateRange
                    ? "Khoảng thời gian không hợp lệ."
                    : (revenueError ?? "Không có dữ liệu.")
                }
              />
            ) : chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="dashboardRevenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#1677ff"
                        stopOpacity={0.26}
                      />
                      <stop
                        offset="95%"
                        stopColor="#1677ff"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.detailLabel ?? ""
                    }
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      borderRadius: 16,
                      borderColor: "#e2e8f0",
                      boxShadow: "0 16px 32px rgba(15, 23, 42, 0.12)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#1677ff"
                    strokeWidth={2.4}
                    fill="url(#dashboardRevenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                className="h-full"
                title="Chưa có dữ liệu doanh thu"
                description="Không tìm thấy bút toán doanh thu nào trong khoảng đã chọn."
              />
            )}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">
                Tổng hợp tài chính
              </div>
              <Icon name="receipt" className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-3 text-sm">
              <SummaryLine
                label="Doanh thu bán hàng"
                value={formatCurrency(revenue?.summary.salesRevenue)}
              />
              <SummaryLine
                label="Điều chỉnh doanh thu"
                value={formatCurrency(revenue?.summary.adjustmentRevenue)}
              />
              <SummaryLine
                label="Tạm tính"
                value={formatCurrency(revenue?.summary.totalSubtotal)}
              />
              <SummaryLine
                label="Giảm giá"
                value={formatCurrency(revenue?.summary.totalDiscount)}
              />
              <SummaryLine
                label="Cơ sở tính thuế"
                value={formatCurrency(revenue?.summary.totalTaxable)}
              />
              <SummaryLine
                label="Thuế phát sinh"
                value={formatCurrency(revenue?.summary.totalTax)}
              />
              <SummaryLine
                label="Doanh thu thuần"
                value={formatCurrency(revenue?.summary.totalRevenue)}
                strong
              />
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">
                Sản phẩm nổi bật trong kỳ
              </div>
              <Badge tone={topProduct ? "blue" : "slate"}>
                {topProduct ? "Có dữ liệu" : "Trống"}
              </Badge>
            </div>

            {topProduct ? (
              <div className="space-y-4">
                <div className="rounded-md border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1677ff]">
                    Bán chạy nhất
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-900">
                    {topProduct.productName}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {topProduct.sku} • {topProduct.unit}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MetricMiniCard
                      label="Số lượng"
                      value={formatMoneyValue(topProduct.quantitySold)}
                    />
                    <MetricMiniCard
                      label="Số đơn"
                      value={formatMoneyValue(topProduct.ordersCount)}
                    />
                    <MetricMiniCard
                      label="Doanh thu"
                      value={formatCurrency(topProduct.totalRevenue)}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Tổng cộng đã bán {formatMoneyValue(totalUnitsSold)} đơn vị
                  thuộc {formatMoneyValue(totalProductsSold)} mặt hàng trong
                  khoảng thời gian này.
                </div>
              </div>
            ) : (
              <EmptyState
                title="Chưa có sản phẩm bán ra"
                description="Hãy chọn khoảng thời gian có hóa đơn đã thanh toán để xem thống kê hàng bán."
              />
            )}
          </Panel>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Sản phẩm đã bán trong kỳ
            </div>
            <div className="text-sm text-slate-500">
              Liệt kê mặt hàng đã bán, số lượng và toàn bộ phần tiền nong phát
              sinh
            </div>
          </div>
          <Badge tone="blue">{soldProducts.length} mặt hàng</Badge>
        </div>

        {invalidDateRange || revenueError ? (
          <EmptyState
            title="Không thể hiển thị danh sách sản phẩm"
            description={
              invalidDateRange
                ? "Khoảng thời gian không hợp lệ."
                : (revenueError ?? "Không có dữ liệu.")
            }
          />
        ) : soldProducts.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#eaf3ff] text-slate-600">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">SKU</th>
                  <th className="px-4 py-4 text-left font-semibold">
                    Sản phẩm
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">SL bán</th>
                  <th className="px-4 py-4 text-right font-semibold">Số đơn</th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Tạm tính
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Giảm giá
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">Thuế</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Doanh thu thuần
                  </th>
                </tr>
              </thead>
              <tbody>
                {soldProducts.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-t border-slate-100"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {item.sku}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">
                        {item.productName}
                      </div>
                      <div className="text-xs text-slate-400">{item.unit}</div>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatMoneyValue(item.quantitySold)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatMoneyValue(item.ordersCount)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(item.subtotal)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(item.discountAmount)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(item.taxAmount)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(item.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Chưa có sản phẩm bán ra"
            description="Không tìm thấy mặt hàng nào đã bán trong khoảng thời gian đã chọn."
          />
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Bảng thống kê theo {periodNoun}
            </div>
            <div className="text-sm text-slate-500">
              Doanh thu bán hàng, điều chỉnh và doanh thu thuần cho từng kỳ
            </div>
          </div>
          <Badge tone="blue">{chartData.length} dòng</Badge>
        </div>

        {invalidDateRange || revenueError ? (
          <EmptyState
            title="Không thể hiển thị bảng thống kê"
            description={
              invalidDateRange
                ? "Khoảng thời gian không hợp lệ."
                : (revenueError ?? "Không có dữ liệu.")
            }
          />
        ) : chartData.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#eaf3ff] text-slate-600">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Kỳ</th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Bút toán
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Doanh thu bán
                  </th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Điều chỉnh
                  </th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Doanh thu thuần
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((item) => (
                  <tr
                    key={item.detailLabel}
                    className="border-t border-slate-100"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {item.detailLabel}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-500">
                      {item.entries}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(item.salesRevenue)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">
                      {formatCurrency(item.adjustmentRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Chưa có kỳ thống kê nào"
            description="Hãy mở rộng khoảng thời gian hoặc tạo thêm giao dịch đã thanh toán."
          />
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                Hóa đơn gần nhất
              </div>
              <div className="text-sm text-slate-500">
                10 dòng mới nhất theo thời gian tạo
              </div>
            </div>
            <Badge tone="blue">{orders.slice(0, 10).length} giao dịch</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#eaf3ff] text-slate-600">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Mã đơn</th>
                  <th className="px-4 py-4 text-left font-semibold">
                    Trạng thái
                  </th>
                  <th className="px-4 py-4 text-left font-semibold">Khách</th>
                  <th className="px-4 py-4 text-right font-semibold">
                    Thanh toán
                  </th>
                  <th className="px-6 py-4 text-left font-semibold">
                    Thời gian
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={getStatusTone(order.status)}>
                        {formatOrderStatus(order.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {order.customerName ?? "Khách lẻ"}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">
                      {formatMoneyValue(order.total)}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">
                Cần chú ý hôm nay
              </div>
              <Icon name="bookmark" className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              <HighlightCard
                title="Đơn bị hủy"
                value={`${cancelledOrders.length}`}
                note="Theo dõi để kiểm tra các adjustment và refund transaction."
              />
              <HighlightCard
                title="Sản phẩm bán chạy"
                value={topProduct?.productName ?? "Chưa có"}
                note={
                  topProduct
                    ? `${formatMoneyValue(topProduct.quantitySold)} ${
                        topProduct.unit
                      } • ${formatCurrency(topProduct.totalRevenue)}`
                    : "Chưa có giao dịch đã thanh toán trong khoảng đang xem."
                }
              />
              <HighlightCard
                title={`Doanh thu/${periodNoun}`}
                value={formatCurrency(averageRevenue)}
                note="Giá trị trung bình trong khoảng báo cáo hiện tại."
              />
            </div>
          </Panel>

          <Panel className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-slate-900">
                Tồn kho cần xử lý
              </div>
              <Badge tone={lowStock.length ? "amber" : "green"}>
                {lowStock.length ? `${lowStock.length} mục` : "Ổn định"}
              </Badge>
            </div>
            <div className="space-y-3">
              {lowStock.slice(0, 5).map((item) =>
                (() => {
                  const alertLevel = getInventoryAlertLevel(
                    item.quantity,
                    item.minStock,
                  );

                  return (
                    <div
                      key={item.id}
                      className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">
                          {item.product.name}
                        </div>
                        <Badge tone={getInventoryAlertTone(alertLevel)}>
                          {formatInventoryAlertLevel(alertLevel)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {item.product.sku} • Còn {item.quantity} / Tối thiểu{" "}
                        {item.minStock}
                      </div>
                    </div>
                  );
                })(),
              )}
              {!lowStock.length ? (
                <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có sản phẩm nào chạm ngưỡng tối thiểu.
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        strong ? "border-t border-slate-200 pt-3" : ""
      }`}
    >
      <span
        className={strong ? "font-semibold text-slate-900" : "text-slate-500"}
      >
        {label}
      </span>
      <span
        className={`software-mono ${
          strong ? "font-semibold text-slate-900" : "text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HighlightCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
    </div>
  );
}

function MetricMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/80 bg-white/80 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatReportPeriod(
  value: string,
  groupBy: RevenueGroupBy,
  mode: "short" | "long",
) {
  const date = dayjs(value);

  if (groupBy === "day") {
    return mode === "short" ? date.format("DD/MM") : date.format("DD/MM/YYYY");
  }

  if (groupBy === "week") {
    return mode === "short"
      ? `T. ${date.format("DD/MM")}`
      : `Tuần bắt đầu ${date.format("DD/MM/YYYY")}`;
  }

  if (groupBy === "month") {
    return mode === "short"
      ? date.format("MM/YYYY")
      : `Tháng ${date.format("MM/YYYY")}`;
  }

  if (groupBy === "quarter") {
    return `Q${Math.floor(date.month() / 3) + 1}/${date.format("YYYY")}`;
  }

  return date.format("YYYY");
}

function getDefaultDateRange(reference = dayjs()): DateRangeValue {
  return {
    fromDate: reference.startOf("month").format("YYYY-MM-DD"),
    toDate: reference.format("YYYY-MM-DD"),
  };
}
