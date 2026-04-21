import "react-day-picker/style.css";

import dayjs from "dayjs";
import { vi } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { cn } from "../lib/cn";
import { Icon } from "./icons";
import { Button, inputClassName } from "./ui";

const presetOptions = [
  { label: "7 ngày gần đây", value: "7days" },
  { label: "Tháng này", value: "month" },
  { label: "Quý này", value: "quarter" },
  { label: "Năm nay", value: "year" },
] as const;

type DatePreset = (typeof presetOptions)[number]["value"];

export type DateRangeValue = {
  fromDate: string;
  toDate: string;
};

export function DateRangePicker({
  value,
  onApply,
  onReset,
}: {
  value: DateRangeValue;
  onApply: (value: DateRangeValue) => void;
  onReset: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    toDateRange(value),
  );

  useEffect(() => {
    if (!open) {
      setDraftRange(toDateRange(value));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const draftValue = fromDateRange(draftRange);
  const canApply = Boolean(draftValue);

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <div className="text-sm font-medium text-slate-700">Khoảng thời gian</div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          inputClassName,
          "flex items-center justify-between gap-3 text-left",
          open && "border-[#1677ff]/45 bg-white ring-4 ring-[#1677ff]/10",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#1677ff]">
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">
              {formatDateRangeLabel(value)}
            </span>
            <span className="block truncate text-xs text-slate-400">
              Chọn trực tiếp trên lịch để lọc doanh thu và sản phẩm đã bán
            </span>
          </span>
        </span>
        <Icon
          name="chevronDown"
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">
                Chọn khoảng ngày bằng lịch
              </div>
              <div className="text-sm text-slate-500">
                Bấm ngày bắt đầu và ngày kết thúc để tạo range
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {presetOptions.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  setDraftRange(toDateRange(getPresetDateRange(preset.value)))
                }
                className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#1677ff]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Range Đang Chọn
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {draftValue
                    ? formatDateRangeLabel(draftValue)
                    : "Chọn ngày bắt đầu và ngày kết thúc"}
                </div>
              </div>
              <BadgeCount
                label="Số ngày"
                value={
                  draftValue
                    ? `${dayjs(draftValue.toDate).diff(dayjs(draftValue.fromDate), "day") + 1}`
                    : "--"
                }
              />
            </div>

            <div className="software-date-range-picker overflow-x-auto">
              <DayPicker
                mode="range"
                locale={vi}
                selected={draftRange}
                onSelect={(range) => setDraftRange(range)}
                numberOfMonths={2}
                pagedNavigation
                showOutsideDays
                fixedWeeks
                defaultMonth={draftRange?.from ?? toDate(value.fromDate)}
                className="mx-auto"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              <Icon name="refresh" className="h-4 w-4" />
              Đặt về mặc định
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                disabled={!canApply}
                onClick={() => {
                  if (!draftValue) {
                    return;
                  }

                  onApply(draftValue);
                  setOpen(false);
                }}
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BadgeCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white bg-white px-3 py-2 text-right shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatDateRangeLabel(value: DateRangeValue) {
  return `${dayjs(value.fromDate).format("DD/MM/YYYY")} - ${dayjs(
    value.toDate,
  ).format("DD/MM/YYYY")}`;
}

function toDateRange(value: DateRangeValue): DateRange {
  return {
    from: toDate(value.fromDate),
    to: toDate(value.toDate),
  };
}

function fromDateRange(value?: DateRange): DateRangeValue | null {
  if (!value?.from || !value.to) {
    return null;
  }

  return {
    fromDate: dayjs(value.from).format("YYYY-MM-DD"),
    toDate: dayjs(value.to).format("YYYY-MM-DD"),
  };
}

function toDate(value: string) {
  return dayjs(value).toDate();
}

function getPresetDateRange(
  preset: DatePreset,
  reference = dayjs(),
): DateRangeValue {
  if (preset === "7days") {
    return {
      fromDate: reference.subtract(6, "day").format("YYYY-MM-DD"),
      toDate: reference.format("YYYY-MM-DD"),
    };
  }

  if (preset === "month") {
    return {
      fromDate: reference.startOf("month").format("YYYY-MM-DD"),
      toDate: reference.format("YYYY-MM-DD"),
    };
  }

  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(reference.month() / 3) * 3;
    const quarterStart = dayjs(
      new Date(reference.year(), quarterStartMonth, 1),
    );

    return {
      fromDate: quarterStart.format("YYYY-MM-DD"),
      toDate: reference.format("YYYY-MM-DD"),
    };
  }

  return {
    fromDate: dayjs(new Date(reference.year(), 0, 1)).format("YYYY-MM-DD"),
    toDate: reference.format("YYYY-MM-DD"),
  };
}
