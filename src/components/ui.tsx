import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { cn } from "../lib/cn";
import { formatMoneyValue } from "../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-md border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
};

export function Button({
  className,
  children,
  variant = "secondary",
  size = "md",
  busy = false,
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary:
      "border border-[#1677ff] bg-[#1677ff] text-white shadow-[0_12px_24px_rgba(22,119,255,0.24)] hover:bg-[#0f6ae6]",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    ghost:
      "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
    danger:
      "border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
    soft: "border border-blue-100 bg-blue-50 text-[#1677ff] hover:bg-blue-100",
  }[variant];

  const sizeClass = {
    sm: "h-9 rounded-md px-3 text-sm",
    md: "h-10 rounded-md px-4 text-sm",
    lg: "h-12 rounded-md px-5 text-[15px]",
  }[size];

  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        variantClass,
        sizeClass,
        className,
      )}
      {...props}
    >
      {busy ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export const inputClassName =
  "h-11 w-full rounded-md border border-slate-200/90 bg-slate-50/90 px-4 text-sm font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_1px_2px_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1677ff]/45 focus:bg-white focus:ring-4 focus:ring-[#1677ff]/10 disabled:cursor-not-allowed disabled:bg-slate-100";

type FieldProps = {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({ label, error, hint, children, className }: FieldProps) {
  return (
    <label className={cn("grid gap-2", className)}>
      {label ? (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      {children}
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
      {!error && hint ? (
        <span className="text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ type, className, ...props }, ref) {
  if (type === "search") {
    return (
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={ref}
          type={type}
          className={cn(inputClassName, "pl-11", className)}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      className={cn(inputClassName, className)}
      {...props}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea(props, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("min-h-[110px] py-3", inputClassName, props.className)}
      {...props}
    />
  );
});

export const NumberInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function NumberInput(props, ref) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={cn(inputClassName, props.className)}
      {...props}
    />
  );
});

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: number | string | null;
  allowEmpty?: boolean;
  onValueChange?: (value: number | null) => void;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    { value, allowEmpty = false, onValueChange, className, ...props },
    ref,
  ) {
    const displayValue =
      value === null || value === undefined || value === ""
        ? ""
        : formatMoneyValue(value);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^\d]/g, "");
          if (!digits) {
            onValueChange?.(allowEmpty ? null : 0);
            return;
          }

          onValueChange?.(Number(digits));
        }}
        className={cn(
          inputClassName,
          "software-mono text-right tabular-nums",
          className,
        )}
        {...props}
      />
    );
  },
);

export const SelectInput = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function SelectInput(props, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "appearance-none bg-[length:16px] bg-[right_16px_center] bg-no-repeat",
        inputClassName,
        props.className,
      )}
      {...props}
    />
  );
});

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-3 text-sm text-slate-700",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#1677ff] focus:ring-[#1677ff]"
      />
      <span>{label}</span>
    </label>
  );
}

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: "slate" | "blue" | "green" | "amber" | "red";
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-[#1677ff]",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center",
        className,
      )}
    >
      <div className="text-base font-semibold text-slate-900">{title}</div>
      {description ? (
        <div className="max-w-md text-sm leading-6 text-slate-500">
          {description}
        </div>
      ) : null}
      {action}
    </div>
  );
}

type OverlayProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function useOverlayLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: OverlayProps) {
  useOverlayLock(open, onClose);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-slate-100 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: OverlayProps) {
  useOverlayLock(open, onClose);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-[560px] flex-col bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="border-t border-slate-100 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
