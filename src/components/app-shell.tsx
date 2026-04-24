import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Icon } from "./icons";
import { Button, Spinner } from "./ui";
import { getMe } from "../lib/api";
import { cn } from "../lib/cn";
import { formatUserRole } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";

const navigationItems = [
  {
    key: "/dashboard",
    label: "Dashboard",
    icon: "chart" as const,
    roles: ["ADMIN"] as const,
  },
  {
    key: "/pos",
    label: "Bán hàng",
    icon: "bag" as const,
    roles: ["ADMIN", "STAFF"] as const,
  },
  {
    key: "/products",
    label: "Hàng hóa",
    icon: "tag" as const,
    roles: ["ADMIN"] as const,
  },
  {
    key: "/product-groups",
    label: "Nhóm sản phẩm",
    icon: "bookmark" as const,
    roles: ["ADMIN"] as const,
  },
  {
    key: "/inventory",
    label: "Quản lý tồn kho",
    icon: "grid" as const,
    roles: ["ADMIN"] as const,
  },
  {
    key: "/invoices",
    label: "Hóa đơn",
    icon: "receipt" as const,
    roles: ["ADMIN", "STAFF"] as const,
  },
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [clock, setClock] = useState(() => dayjs());

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: Boolean(token),
    initialData: user ?? undefined,
    retry: false,
    staleTime: 60_000,
  });
  const currentUser = data ?? user;

  const allowedNavigationItems = useMemo(
    () =>
      navigationItems.filter(
        (item) =>
          !currentUser || item.roles.some((role) => role === currentUser.role)
      ),
    [currentUser?.role]
  );

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(dayjs()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activePath = useMemo(() => {
    const segment = `/${location.pathname.split("/")[1]}`;
    if (segment === "/pricebook") {
      return "/inventory";
    }
    if (segment === "/orders") {
      return "/invoices";
    }
    return segment;
  }, [location.pathname]);

  if (isLoading && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f5f7] text-[#1677ff]">
        <Spinner className="h-8 w-8 border-[3px]" />
      </div>
    );
  }

  if (
    currentUser &&
    currentUser.role !== "ADMIN" &&
    !allowedNavigationItems.some((item) => item.key === activePath)
  ) {
    return <Navigate to="/pos" replace />;
  }

  if (activePath === "/pos") {
    return (
      <div className="min-h-screen bg-[#eef2f6]">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur xl:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#1677ff] text-sm font-bold text-white shadow-[0_10px_24px_rgba(22,119,255,0.28)]">
              KV
            </div>
            <div>
              <div className="text-base font-semibold">Minsan Store POS</div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Retail operations
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
              {clock.format("DD/MM/YYYY HH:mm")}
            </div>
            {currentUser ? (
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-slate-900">
                    {currentUser.fullName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatUserRole(currentUser.role)}
                  </div>
                </div>
              </div>
            ) : null}
            <Button
              variant="secondary"
              className="rounded-md"
              onClick={() => {
                clearSession();
                navigate("/login");
              }}
            >
              <Icon name="logout" className="h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto px-5 pb-3 lg:px-8">
          {allowedNavigationItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.key}
              className={({ isActive }) =>
                cn(
                  "inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition",
                  isActive || activePath === item.key
                    ? "border-[#1677ff] bg-[#1677ff] text-white shadow-[0_12px_24px_rgba(22,119,255,0.22)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )
              }
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>

      <div className="flex w-full flex-col xl:min-h-screen xl:flex-row xl:items-stretch">
        <aside className="hidden w-[320px] shrink-0 border-r border-slate-200/80 bg-[linear-gradient(180deg,#fbfcfe_0%,#f4f7fb_100%)] xl:sticky xl:top-0 xl:block xl:h-screen xl:self-start">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(22,119,255,0.12),transparent_38%)] px-6 py-7">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#1677ff] text-sm font-bold text-white shadow-[0_14px_28px_rgba(22,119,255,0.26)]">
                  KV
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-slate-900">
                    Minsan Store POS
                  </div>
                  <div className="text-xs uppercase tracking-[0.26em] text-slate-400">
                    Retail operations
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="space-y-6">
                <div className="rounded-md border border-slate-200/80 bg-white/85 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                    Thời gian hệ thống
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {clock.format("DD/MM/YYYY HH:mm")}
                  </div>
                </div>

                <div>
                  <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                    Điều hướng
                  </div>
                  <nav className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                    {allowedNavigationItems.map((item, index) => (
                      <NavLink
                        key={item.key}
                        to={item.key}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex min-h-[58px] items-center gap-3 px-4 py-3 text-sm font-medium transition",
                            index > 0 && "border-t border-slate-100",
                            isActive || activePath === item.key
                              ? "bg-[linear-gradient(135deg,#1677ff_0%,#2d68f7_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                              : "text-slate-600 hover:bg-slate-50/80",
                          )
                        }
                      >
                        {({ isActive }) => {
                          const active = isActive || activePath === item.key;
                          return (
                            <>
                              <span
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-md transition",
                                  active
                                    ? "bg-white/16 text-white"
                                    : "bg-slate-100 text-slate-500 group-hover:bg-white",
                                )}
                              >
                                <Icon name={item.icon} className="h-4 w-4" />
                              </span>
                              <span className="flex-1">{item.label}</span>
                              {active ? (
                                <span className="h-2 w-2 rounded-md bg-white/90 shadow-[0_0_0_4px_rgba(255,255,255,0.16)]" />
                              ) : null}
                            </>
                          );
                        }}
                      </NavLink>
                    ))}
                  </nav>
                </div>

                <div className="rounded-md border border-slate-200/80 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
                      {currentUser?.fullName.charAt(0) ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {currentUser?.fullName ?? "System User"}
                      </div>
                      <div className="truncate text-xs uppercase tracking-[0.14em] text-slate-400">
                        {currentUser?.role
                          ? formatUserRole(currentUser.role)
                          : "Người dùng"}
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="w-full justify-center rounded-md border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                  onClick={() => {
                    clearSession();
                    navigate("/login");
                  }}
                >
                  <Icon name="logout" className="h-4 w-4" />
                  Đăng xuất
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
