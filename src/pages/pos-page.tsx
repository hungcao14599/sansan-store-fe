import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/icons";
import { ProductAvatar } from "../components/product-avatar";
import {
  Button,
  CurrencyInput,
  EmptyState,
  Spinner,
} from "../components/ui";
import { useToast } from "../components/toast-provider";
import {
  addOrderItem,
  cancelOrder,
  checkoutOrder,
  createOrderWithItem,
  extractErrorMessage,
  getOrders,
  removeOrderItem,
  searchProducts,
  updateOrderItem,
} from "../lib/api";
import { calculateCheckoutPreview } from "../lib/tax";
import { cn } from "../lib/cn";
import { formatMoneyValue, formatOrderStatus, toNumber } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import type { Order, Product } from "../types";

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "EWALLET" | "MIXED";

type OrderDraft = {
  discount: number;
  notes: string;
  createInvoiceFlag: boolean;
  provider: "MISA" | "VNPT" | "VIETTEL";
  paymentMethod: PaymentMethod;
  receivedAmount: number | null;
  paymentReference: string;
  customerSearch: string;
};

type TemporaryTab = {
  id: string;
  orderId: string | null;
};

const TEMP_TABS_STORAGE_KEY = "pos-temp-tabs";
const LEGACY_TEMP_ORDER_IDS_STORAGE_KEY = "pos-temp-order-ids";
const posOrdersQueryKey = ["orders", "pos"] as const;
const TEMP_ORDER_ID_PREFIX = "temp-order-";
const PRODUCT_SUGGESTION_BATCH_SIZE = 20;

export function PosPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const scanValueRef = useRef("");
  const lastHandledScanRef = useRef<string | null>(null);
  const orderCreationPromisesRef = useRef<Record<string, Promise<Order>>>({});

  const [scanValue, setScanValue] = useState("");
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [orderDrafts, setOrderDrafts] = useState<Record<string, OrderDraft>>(
    {}
  );
  const [temporaryTabs, setTemporaryTabs] = useState<TemporaryTab[]>(() =>
    readTemporaryTabs()
  );
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const deferredSearchValue = useDeferredValue(scanValue.trim());

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", "pos-search", deferredSearchValue],
    queryFn: ({ pageParam }) =>
      searchProducts({
        q: deferredSearchValue || undefined,
        limit: PRODUCT_SUGGESTION_BATCH_SIZE,
        offset: pageParam,
      }),
    enabled:
      Boolean(activeTabId) &&
      (searchDropdownOpen || Boolean(deferredSearchValue)),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: posOrdersQueryKey,
    queryFn: () => getOrders({ status: "PENDING", view: "pos" }),
    staleTime: 20_000,
  });

  const pendingOrders = useMemo(
    () =>
      sortPendingOrders(
        (ordersQuery.data ?? []).filter((item) => item.status === "PENDING")
      ),
    [ordersQuery.data]
  );

  const activeTab = useMemo(
    () => temporaryTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, temporaryTabs]
  );

  const activeOrderId = activeTab?.orderId ?? null;

  const activeOrder = useMemo(
    () =>
      (ordersQuery.data ?? []).find((item) => item.id === activeOrderId) ??
      null,
    [activeOrderId, ordersQuery.data]
  );

  const activeDraft = activeTabId
    ? orderDrafts[activeTabId] ?? createDefaultDraft(activeOrder?.notes)
    : createDefaultDraft();

  const searchSuggestions = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data]
  );

  const productLookup = useMemo(() => {
    const lookup = new Map<string, Product>();

    for (const product of searchSuggestions) {
      if (!product.isActive) {
        continue;
      }

      for (const code of [product.barcode, product.sku]) {
        if (!code) {
          continue;
        }

        lookup.set(code.trim().toLowerCase(), product);
      }
    }

    return lookup;
  }, [searchSuggestions]);

  const productById = useMemo(() => {
    return new Map(searchSuggestions.map((product) => [product.id, product]));
  }, [searchSuggestions]);

  const hasMoreSearchSuggestions = Boolean(productsQuery.hasNextPage);

  const draftItems = useMemo(
    () =>
      (activeOrder?.items ?? []).map((item) => {
        const draftQuantity = itemQuantities[item.id] ?? item.quantity;
        const unitPrice = toNumber(item.unitPrice);
        const taxRate = toNumber(item.taxRate);
        const lineSubtotal = unitPrice * draftQuantity;
        const taxAmount =
          Math.round(((lineSubtotal * taxRate) / 100) * 100) / 100;
        const lineTotal = Math.round((lineSubtotal + taxAmount) * 100) / 100;

        return {
          ...item,
          quantity: draftQuantity,
          lineSubtotal,
          lineTotal,
          taxAmount,
        };
      }),
    [activeOrder?.items, itemQuantities]
  );

  const checkoutPreview = useMemo(
    () => calculateCheckoutPreview(draftItems, activeDraft.discount),
    [activeDraft.discount, draftItems]
  );

  const draftItemPreviewMap = useMemo(
    () => new Map(draftItems.map((item) => [item.id, item])),
    [draftItems]
  );

  const totalUnits = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.quantity, 0),
    [draftItems]
  );

  const cashChange =
    activeDraft.paymentMethod === "CASH"
      ? Math.max(
          (activeDraft.receivedAmount ?? checkoutPreview.total) -
            checkoutPreview.total,
          0
        )
      : 0;

  const syncScanValue = (value: string) => {
    scanValueRef.current = value;
    setScanValue(value);
  };

  const updateDraft = (
    orderId: string,
    patch: Partial<OrderDraft> | ((current: OrderDraft) => OrderDraft)
  ) => {
    setOrderDrafts((current) => {
      const existing = current[orderId] ?? createDefaultDraft();
      const nextValue =
        typeof patch === "function"
          ? patch(existing)
          : { ...existing, ...patch };
      return {
        ...current,
        [orderId]: nextValue,
      };
    });
  };

  const updateActiveDraft = (patch: Partial<OrderDraft>) => {
    if (!activeTabId) {
      return;
    }

    updateDraft(activeTabId, patch);
  };

  const switchOrder = (tabId: string) => {
    setActiveTabId(tabId);
    setSearchDropdownOpen(false);
    syncScanValue("");
    lastHandledScanRef.current = null;
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const requestCreateTab = () => {
    const nextTab = createTemporaryTab();
    setTemporaryTabs((current) => [...current, nextTab]);
    setOrderDrafts((current) => ({
      ...current,
      [nextTab.id]: createDefaultDraft(),
    }));
    setActiveTabId(nextTab.id);
    setSearchDropdownOpen(false);
    setItemQuantities({});
    syncScanValue("");
    lastHandledScanRef.current = null;
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const closeOrderMutation = useMutation({
    mutationFn: (tab: TemporaryTab) =>
      cancelOrder(tab.orderId!, {
        reason: "Closed pending order from POS tabs",
      }),
    onSuccess: async (_order, tab) => {
      removePosOrder(tab.orderId!);
      setTemporaryTabs((current) =>
        current.filter((item) => item.id !== tab.id)
      );
      setOrderDrafts((current) => {
        const next = { ...current };
        delete next[tab.id];
        return next;
      });
      if (activeTabId === tab.id) {
        setActiveTabId(null);
        setSearchDropdownOpen(false);
      }
      setItemQuantities({});
      syncScanValue("");
      lastHandledScanRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ["orders", "summary"] });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  useEffect(() => {
    if (!temporaryTabs.length) {
      return;
    }

    setOrderDrafts((current) => {
      let changed = false;
      const next = { ...current };

      for (const tab of temporaryTabs) {
        const notes = tab.orderId
          ? (ordersQuery.data ?? []).find((item) => item.id === tab.orderId)
              ?.notes
          : undefined;

        if (!next[tab.id]) {
          next[tab.id] = createDefaultDraft(notes);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [ordersQuery.data, temporaryTabs]);

  useEffect(() => {
    if (ordersQuery.isLoading) {
      return;
    }

    const pendingIdSet = new Set(pendingOrders.map((item) => item.id));
    setTemporaryTabs((current) => {
      const next = current.filter(
        (tab) => !tab.orderId || pendingIdSet.has(tab.orderId)
      );
      return next.length === current.length ? current : next;
    });
  }, [ordersQuery.isLoading, pendingOrders]);

  useEffect(() => {
    writeTemporaryTabs(temporaryTabs);
  }, [temporaryTabs]);

  useEffect(() => {
    if (ordersQuery.isLoading || closeOrderMutation.isPending) {
      return;
    }

    if (temporaryTabs.length) {
      if (
        !activeTabId ||
        !temporaryTabs.some((item) => item.id === activeTabId)
      ) {
        setActiveTabId(temporaryTabs[0].id);
      }
      return;
    }

    if (activeTabId !== null) {
      setActiveTabId(null);
    }
  }, [
    activeTabId,
    closeOrderMutation.isPending,
    ordersQuery.isLoading,
    temporaryTabs,
  ]);

  useEffect(() => {
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!activeTabId) {
      setSearchDropdownOpen(false);
    }
  }, [activeTabId]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const item of activeOrder?.items ?? []) {
      next[item.id] = item.quantity;
    }
    setItemQuantities(next);
  }, [activeOrder?.items]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    if (activeDraft.paymentMethod !== "CASH") {
      if (activeDraft.receivedAmount !== checkoutPreview.total) {
        updateDraft(activeTabId, { receivedAmount: checkoutPreview.total });
      }
      return;
    }

    if (activeDraft.receivedAmount === null && checkoutPreview.total > 0) {
      updateDraft(activeTabId, { receivedAmount: checkoutPreview.total });
    }
  }, [
    activeDraft.paymentMethod,
    activeDraft.receivedAmount,
    activeTabId,
    checkoutPreview.total,
  ]);

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.key === "F3") {
        event.preventDefault();
        setSearchDropdownOpen(true);
        searchInputRef.current?.focus();
      }

      if (event.key === "F4") {
        event.preventDefault();
        customerInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, []);

  const upsertPosOrder = (order: Order) => {
    queryClient.setQueryData<Order[]>(posOrdersQueryKey, (current) => [
      order,
      ...(current ?? []).filter((item) => item.id !== order.id),
    ]);
  };

  const removePosOrder = (orderId: string) => {
    queryClient.setQueryData<Order[]>(posOrdersQueryKey, (current) =>
      (current ?? []).filter((item) => item.id !== orderId)
    );
  };

  const createOrderForTabWithItem = async (
    tabId: string,
    productId: string,
    quantity: number
  ) => {
    const tab = temporaryTabs.find((item) => item.id === tabId);
    if (!tab) {
      return null;
    }

    if (tab.orderId) {
      return null;
    }

    const pendingPromise = orderCreationPromisesRef.current[tabId];
    if (pendingPromise) {
      return pendingPromise;
    }

    const draft = orderDrafts[tabId] ?? createDefaultDraft();
    const optimisticOrderId = `${TEMP_ORDER_ID_PREFIX}${tabId}`;
    const product = productById.get(productId);

    if (product) {
      upsertPosOrder(
        buildOptimisticOrder(optimisticOrderId, product, quantity, draft)
      );
      setTemporaryTabs((current) =>
        current.map((item) =>
          item.id === tabId ? { ...item, orderId: optimisticOrderId } : item
        )
      );
      lastHandledScanRef.current = null;
      syncScanValue("");
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    const createPromise = createOrderWithItem({
      productId,
      quantity,
      customerName: draft.customerSearch.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    })
      .then((order) => {
        removePosOrder(optimisticOrderId);
        upsertPosOrder(order);
        setTemporaryTabs((current) =>
          current.map((item) =>
            item.id === tabId ? { ...item, orderId: order.id } : item
          )
        );
        lastHandledScanRef.current = null;
        syncScanValue("");
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
        return order;
      })
      .catch((error) => {
        removePosOrder(optimisticOrderId);
        setTemporaryTabs((current) =>
          current.map((item) =>
            item.id === tabId ? { ...item, orderId: null } : item
          )
        );
        toast.error(extractErrorMessage(error));
        throw error;
      })
      .finally(() => {
        delete orderCreationPromisesRef.current[tabId];
      });

    orderCreationPromisesRef.current[tabId] = createPromise;
    return createPromise;
  };

  const addItemMutation = useMutation({
    mutationFn: (payload: {
      orderId: string;
      productId: string;
      quantity: number;
    }) =>
      addOrderItem(payload.orderId, {
        productId: payload.productId,
        quantity: payload.quantity,
      }),
    onMutate: (payload) => {
      const previousOrders =
        queryClient.getQueryData<Order[]>(posOrdersQueryKey) ?? [];
      const product = productById.get(payload.productId);
      const order = previousOrders.find((item) => item.id === payload.orderId);

      if (!product || !order) {
        return { previousOrders };
      }

      upsertPosOrder(
        buildOptimisticOrder(
          payload.orderId,
          product,
          payload.quantity,
          activeDraft,
          order
        )
      );

      return { previousOrders };
    },
    onSuccess: (order) => {
      upsertPosOrder(order);
      lastHandledScanRef.current = null;
      syncScanValue("");
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    },
    onError: (error, _payload, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(posOrdersQueryKey, context.previousOrders);
      }
      toast.error(extractErrorMessage(error));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: (payload: { itemId: string; quantity: number }) =>
      updateOrderItem(activeOrderId!, payload.itemId, {
        quantity: payload.quantity,
      }),
    onSuccess: (order) => {
      upsertPosOrder(order);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeOrderItem(activeOrderId!, itemId),
    onSuccess: (order) => {
      upsertPosOrder(order);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutOrder(activeOrderId!, {
        discount: activeDraft.discount,
        notes: activeDraft.notes,
        createInvoice: activeDraft.createInvoiceFlag,
        provider: activeDraft.provider,
        paymentMethod: activeDraft.paymentMethod,
        receivedAmount:
          activeDraft.receivedAmount !== null
            ? Number(activeDraft.receivedAmount)
            : checkoutPreview.total,
        paymentReference: activeDraft.paymentReference || undefined,
      }),
    onSuccess: async (_order) => {
      const completedTabId = activeTabId!;
      if (activeOrderId) {
        removePosOrder(activeOrderId);
      }
      toast.success(
        `Thanh toán thành công. Đơn đã chuyển sang ${formatOrderStatus(
          "PAID"
        )}.`
      );

      setTemporaryTabs((current) =>
        current.filter((tab) => tab.id !== completedTabId)
      );
      setOrderDrafts((current) => {
        const next = { ...current };
        delete next[completedTabId];
        return next;
      });
      setActiveTabId(null);
      setSearchDropdownOpen(false);
      setItemQuantities({});
      syncScanValue("");
      lastHandledScanRef.current = null;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["report"] }),
      ]);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const addProductToOrder = async (productId: string, quantity = 1) => {
    if (!activeTabId) {
      toast.info("Bấm + để tạo hóa đơn tạm trước khi thêm sản phẩm.");
      return;
    }

    if (addItemMutation.isPending) {
      return;
    }

    const orderId = activeOrderId;

    if (isTemporaryOrderId(orderId)) {
      return;
    }

    if (!orderId) {
      try {
        await createOrderForTabWithItem(activeTabId, productId, quantity);
      } catch {}
      return;
    }

    try {
      await addItemMutation.mutateAsync({
        orderId,
        productId,
        quantity,
      });
    } catch {
      return;
    }
  };

  const resolveProductFromSearch = () => {
    const normalizedCode = scanValueRef.current.trim().toLowerCase();
    if (!normalizedCode) {
      return null;
    }

    return productLookup.get(normalizedCode) ?? searchSuggestions[0] ?? null;
  };

  const handleSearchSubmit = (showNotFoundMessage = true) => {
    if (!activeTabId) {
      if (scanValueRef.current.trim()) {
        toast.info("Bấm + để tạo hóa đơn tạm trước khi thêm sản phẩm.");
      }
      return;
    }

    const matchedProduct = resolveProductFromSearch();
    if (!matchedProduct || addItemMutation.isPending) {
      if (showNotFoundMessage && scanValueRef.current.trim()) {
        toast.warning(
          "Không tìm thấy sản phẩm theo barcode, SKU hoặc từ khóa."
        );
      }
      return;
    }

    if ((matchedProduct.inventory?.quantity ?? 0) <= 0) {
      toast.warning(`Sản phẩm ${matchedProduct.name} đang hết tồn kho.`);
      return;
    }

    const normalizedCode = scanValueRef.current.trim().toLowerCase();
    if (productLookup.has(normalizedCode)) {
      lastHandledScanRef.current = normalizedCode;
    }

    void addProductToOrder(matchedProduct.id, 1);
  };

  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    const handleGlobalScannerInput = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const searchInputElement = searchInputRef.current;
      const isSearchInputFocused = activeElement === searchInputElement;
      const isEditableElement = Boolean(
        activeElement &&
          (activeElement.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName))
      );

      if (isEditableElement && !isSearchInputFocused) {
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (!scanValueRef.current.trim()) {
          return;
        }

        if (isSearchInputFocused) {
          return;
        }

        event.preventDefault();
        handleSearchSubmit(true);
        return;
      }

      if (event.key === "Backspace" && !isSearchInputFocused) {
        if (!scanValueRef.current) {
          return;
        }

        event.preventDefault();
        syncScanValue(scanValueRef.current.slice(0, -1));
        searchInputRef.current?.focus();
        return;
      }

      if (event.key.length !== 1 || isSearchInputFocused) {
        return;
      }

      event.preventDefault();
      syncScanValue(`${scanValueRef.current}${event.key}`);
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleGlobalScannerInput);
    return () =>
      window.removeEventListener("keydown", handleGlobalScannerInput);
  }, [
    activeTabId,
    addItemMutation.isPending,
    productLookup,
    searchSuggestions,
  ]);

  useEffect(() => {
    if (!scanValue.trim() || !activeTabId || addItemMutation.isPending) {
      return;
    }

    const normalizedCode = scanValue.trim().toLowerCase();
    const timer = window.setTimeout(() => {
      if (lastHandledScanRef.current === normalizedCode) {
        return;
      }

      if (productLookup.has(normalizedCode)) {
        handleSearchSubmit(false);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    scanValue,
    activeTabId,
    addItemMutation.isPending,
    productLookup,
    searchSuggestions,
  ]);

  const commitItemQuantity = (itemId: string, fallbackQuantity: number) => {
    const nextQuantity = Math.max(
      itemQuantities[itemId] ?? fallbackQuantity,
      1
    );
    setItemQuantities((current) => ({
      ...current,
      [itemId]: nextQuantity,
    }));

    if (nextQuantity === fallbackQuantity) {
      return;
    }

    updateItemMutation.mutate({
      itemId,
      quantity: nextQuantity,
    });
  };

  const incrementItemQuantity = (itemId: string, currentQuantity: number) => {
    const nextQuantity = currentQuantity + 1;
    setItemQuantities((current) => ({
      ...current,
      [itemId]: nextQuantity,
    }));
    updateItemMutation.mutate({
      itemId,
      quantity: nextQuantity,
    });
  };

  const showSearchDropdown = Boolean(activeTabId) && searchDropdownOpen;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-[#1677ff] text-white shadow-[0_8px_30px_rgba(22,119,255,0.35)]">
        <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 lg:flex-nowrap lg:px-4">
          <div className="relative min-w-[280px] flex-1 lg:max-w-[420px]">
            <Icon
              name="search"
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchInputRef}
              value={scanValue}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                syncScanValue(event.target.value)
              }
              onPointerDown={() => {
                if (activeTabId) {
                  setSearchDropdownOpen(true);
                }
              }}
              onBlur={() =>
                window.setTimeout(() => setSearchDropdownOpen(false), 100)
              }
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  setSearchDropdownOpen(false);
                  handleSearchSubmit();
                }
              }}
              placeholder={
                activeTabId ? "Tìm hàng hóa (F3)" : "Bấm + để tạo hóa đơn tạm"
              }
              className="h-11 w-full rounded-md border border-white/25 bg-white px-11 pr-4 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />

            {showSearchDropdown ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                {productsQuery.isLoading ? (
                  <div className="flex items-center gap-3 px-4 py-5 text-sm text-slate-500">
                    <Spinner className="h-4 w-4 border-2" />
                    Đang tải sản phẩm...
                  </div>
                ) : searchSuggestions.length ? (
                  <div
                    className="max-h-[420px] overflow-y-auto py-2"
                    onScroll={(event) => {
                      const element = event.currentTarget;
                      const distanceToBottom =
                        element.scrollHeight -
                        element.scrollTop -
                        element.clientHeight;

                      if (distanceToBottom > 80 || !hasMoreSearchSuggestions) {
                        return;
                      }

                      if (!productsQuery.isFetchingNextPage) {
                        void productsQuery.fetchNextPage();
                      }
                    }}
                  >
                    {searchSuggestions.map((product) => (
                      <button
                        key={product.id}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSearchDropdownOpen(false);
                          void addProductToOrder(product.id);
                        }}
                      >
                        <ProductAvatar
                          seed={product.sku}
                          label={product.name}
                          className="h-11 w-11 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {product.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {product.sku} • Kho{" "}
                            {product.inventory?.quantity ?? 0}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-[#1677ff]">
                          {formatMoneyValue(product.price)}
                        </div>
                      </button>
                    ))}
                    {hasMoreSearchSuggestions ? (
                      <div className="px-4 py-3 text-center text-xs font-medium text-slate-400">
                        {productsQuery.isFetchingNextPage
                          ? "Đang tải thêm sản phẩm..."
                          : "Kéo xuống để tải thêm sản phẩm"}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-center text-xs text-slate-300">
                        Đã hiển thị {searchSuggestions.length} sản phẩm
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-sm text-slate-500">
                    Không tìm thấy sản phẩm phù hợp.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto">
            {temporaryTabs.map((tab, index) => {
              const active = tab.id === activeTabId;
              const isClosing =
                closeOrderMutation.isPending &&
                closeOrderMutation.variables?.id === tab.id;
              const canCloseTab = !tab.orderId || isAdmin;
              return (
                <div
                  key={tab.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "group flex h-11 items-center gap-3 rounded-t-[14px] rounded-b-md border px-4 text-sm font-semibold transition",
                    active
                      ? "border-white bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.14)]"
                      : "border-white/10 bg-transparent text-white hover:bg-white/10"
                  )}
                  onClick={() => switchOrder(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      switchOrder(tab.id);
                    }
                  }}
                >
                  <Icon
                    name={active ? "swapHorizontal" : "receipt"}
                    className={cn(
                      "h-4 w-4",
                      active ? "text-[#1677ff]" : "text-white"
                    )}
                  />
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      active ? "text-[15px]" : "text-[14px]"
                    )}
                  >
                    Hóa đơn {index + 1}
                  </span>
                  {canCloseTab ? (
                    <button
                      className={cn(
                        "rounded-md p-1 text-xs transition",
                        active
                          ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                      disabled={isClosing}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!tab.orderId) {
                          setTemporaryTabs((current) =>
                            current.filter((item) => item.id !== tab.id)
                          );
                          setOrderDrafts((current) => {
                            const next = { ...current };
                            delete next[tab.id];
                            return next;
                          });
                          if (activeTabId === tab.id) {
                            setActiveTabId(null);
                          }
                          setItemQuantities({});
                          syncScanValue("");
                          lastHandledScanRef.current = null;
                          return;
                        }

                        closeOrderMutation.mutate(tab);
                      }}
                    >
                      {isClosing ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Icon name="close" className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}

            <button
              className="flex h-10 w-10 items-center justify-center rounded-md border border-white/18 bg-white/10 text-white transition hover:bg-white/16"
              onClick={requestCreateTab}
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {isAdmin ? (
              <button
                className="mr-2 inline-flex h-10 items-center gap-2 rounded-md border border-white/24 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16"
                onClick={() => navigate("/dashboard")}
              >
                <Icon name="chart" className="h-4 w-4" />
                Màn chính
              </button>
            ) : null}
            <button
              className="mr-2 inline-flex h-10 items-center gap-2 rounded-md border border-white/24 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16"
              onClick={() => navigate("/invoices")}
            >
              <Icon name="receipt" className="h-4 w-4" />
              Hóa đơn
            </button>
            {/* {(["bag", "undo", "refresh", "printer"] as const).map((icon) => (
              <ToolbarButton key={icon} icon={icon} />
            ))}
            <div className="ml-2 whitespace-nowrap text-base font-semibold">
              0968963562
            </div>
            <ToolbarButton icon="menu" /> */}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 bg-[#eef2f6] p-3 lg:p-4">
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="flex min-h-[520px] flex-col rounded-md bg-[#edf1f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            <div className="flex-1 overflow-hidden">
              {ordersQuery.isLoading && activeOrderId && !activeOrder ? (
                <div className="flex h-full items-center justify-center text-[#1677ff]">
                  <Spinner className="h-8 w-8 border-[3px]" />
                </div>
              ) : !activeTabId ? (
                <EmptyState
                  className="h-full"
                  title="Chưa có hóa đơn tạm"
                  description="Bấm dấu + trên thanh tab để tạo hóa đơn mới. Order thật chỉ được tạo khi tab đó thêm món đầu tiên."
                  action={
                    <Button
                      variant="primary"
                      size="md"
                      className="min-w-[180px]"
                      onClick={requestCreateTab}
                    >
                      Tạo hóa đơn tạm
                    </Button>
                  }
                />
              ) : activeOrder?.items.length ? (
                <div className="h-full space-y-2 overflow-y-auto pr-1">
                  {activeOrder.items.map((item, index) => {
                    const draftQuantity =
                      itemQuantities[item.id] ?? item.quantity;
                    const preview = draftItemPreviewMap.get(item.id);
                    const isUpdating =
                      updateItemMutation.isPending &&
                      updateItemMutation.variables?.itemId === item.id;
                    const isRemoving =
                      removeItemMutation.isPending &&
                      removeItemMutation.variables === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
                      >
                        <div className="grid items-center gap-3 md:grid-cols-[26px_30px_116px_minmax(0,1fr)_84px_114px_122px_28px_28px]">
                          <div className="text-lg font-medium text-slate-900">
                            {activeOrder.items.length - index}
                          </div>

                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
                            disabled={isRemoving}
                            onClick={() => removeItemMutation.mutate(item.id)}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>

                          <div className="truncate text-[15px] font-medium text-slate-700">
                            {item.sku}
                          </div>

                          <div className="truncate text-[15px] font-semibold text-slate-900">
                            {item.productName}
                          </div>

                          <div className="flex justify-center">
                            <div className="w-14 border-b border-slate-300">
                              <input
                                type="number"
                                min={1}
                                value={draftQuantity}
                                onChange={(event) =>
                                  setItemQuantities((current) => ({
                                    ...current,
                                    [item.id]: Number(event.target.value || 1),
                                  }))
                                }
                                onBlur={() =>
                                  commitItemQuantity(item.id, item.quantity)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitItemQuantity(item.id, item.quantity);
                                  }
                                }}
                                className={cn(
                                  "w-full border-none bg-transparent pb-1 text-center text-[15px] outline-none",
                                  draftQuantity > 1
                                    ? "text-red-500"
                                    : "text-slate-900"
                                )}
                              />
                            </div>
                          </div>

                          <div className="software-mono text-right text-[15px] text-slate-700">
                            {formatMoneyValue(item.unitPrice)}
                          </div>

                          <div className="software-mono text-right text-[16px] font-semibold text-slate-900">
                            {formatMoneyValue(
                              preview?.lineTotal ?? item.lineTotal
                            )}
                          </div>

                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-[#1677ff]"
                            disabled={isUpdating}
                            onClick={() =>
                              incrementItemQuantity(item.id, draftQuantity)
                            }
                          >
                            <Icon name="plus" className="h-4 w-4" />
                          </button>

                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
                            onClick={() =>
                              toast.info(`Sản phẩm: ${item.productName}`)
                            }
                          >
                            <Icon name="more" className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  className="h-full"
                  title="Chưa có sản phẩm trong hóa đơn"
                  description="Dùng ô tìm hàng hóa ở thanh xanh phía trên để thêm sản phẩm vào đơn đang chọn."
                />
              )}
            </div>

            <div className="px-1.5 pb-1.5">
              <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3 text-slate-400">
                  <Icon name="edit" className="h-5 w-5" />
                  <input
                    value={activeDraft.notes}
                    onChange={(event) =>
                      updateActiveDraft({ notes: event.target.value })
                    }
                    placeholder="Ghi chú đơn hàng"
                    disabled={!activeTabId}
                    className="w-full border-none bg-transparent text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[520px] flex-col rounded-md bg-white shadow-[0_10px_32px_rgba(15,23,42,0.08)]">
            {/* <div className="space-y-4 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3 text-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  <span>{user?.fullName ?? "Thu ngân"}</span>
                  <Icon name="chevronDown" className="h-4 w-4 text-slate-400" />
                  <Icon name="user" className="ml-1 h-4 w-4 text-slate-400" />
                </div>
                <div className="text-[15px] text-slate-500">
                  {dayjs().format("DD/MM/YYYY HH:mm")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Icon
                    name="search"
                    className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <TextInput
                    ref={customerInputRef}
                    value={activeDraft.customerSearch}
                    onChange={(event) =>
                      updateActiveDraft({ customerSearch: event.target.value })
                    }
                    placeholder="Tìm khách hàng (F4)"
                    disabled={!activeTabId}
                    className="h-10 rounded-md bg-slate-50 pl-10"
                  />
                </div>
                <button className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100">
                  <Icon name="plus" className="h-5 w-5" />
                </button>
              </div>
            </div> */}

            <div className="space-y-4 px-5 py-5">
              <p className="font-bold">Thông tin thanh toán</p>
              <PaymentSummaryLine
                label="Tổng tiền hàng"
                value={`${totalUnits}`}
              />
              <PaymentSummaryLine
                label="Giảm giá"
                value={formatMoneyValue(activeDraft.discount)}
              />
              <PaymentSummaryLine
                label="Khách cần trả"
                value={formatMoneyValue(checkoutPreview.total)}
                highlight
              />
              <PaymentSummaryLine
                label="Khách thanh toán"
                value={formatMoneyValue(
                  activeDraft.receivedAmount ?? checkoutPreview.total
                )}
              />

              {/* <div className="flex items-center gap-4 pt-1">
                {paymentMethodOptions.map((option) => (
                  <button
                    key={option.value}
                    className="inline-flex items-center gap-2 text-[15px] text-slate-700"
                    onClick={() => updateActiveDraft({ paymentMethod: option.value })}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-md border',
                        activeDraft.paymentMethod === option.value
                          ? 'border-[#1677ff] text-[#1677ff]'
                          : 'border-slate-400 text-transparent',
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-md bg-current" />
                    </span>
                    {option.label}
                  </button>
                ))}
                <button className="ml-auto flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-500">
                  <Icon name="more" className="h-4 w-4" />
                </button>
              </div> */}

              {activeDraft.paymentMethod === "CASH" ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-2 text-sm text-slate-500">
                        Tiền khách đưa
                      </div>
                      <CurrencyInput
                        value={
                          activeDraft.receivedAmount ?? checkoutPreview.total
                        }
                        onValueChange={(value) =>
                          updateActiveDraft({
                            receivedAmount: value ?? checkoutPreview.total,
                          })
                        }
                        disabled={!activeTabId}
                        className="h-10 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-sm text-slate-500">
                        Tiền thối
                      </div>

                      <CurrencyInput
                        value={cashChange}
                        disabled={true}
                        className="h-10 rounded-md bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-slate-50 px-4 py-8 text-center">
                  <div className="text-[15px] text-slate-500">
                    Bạn chưa có tài khoản ngân hàng
                  </div>
                  <button className="mt-2 text-lg font-semibold text-[#1677ff]">
                    + Thêm tài khoản
                  </button>
                </div>
              )}

              {/* <div className="space-y-3">
                <div>
                  <div className="mb-2 text-sm text-slate-500">Mã giao dịch</div>
                  <TextInput
                    value={activeDraft.paymentReference}
                    onChange={(event) => updateActiveDraft({ paymentReference: event.target.value })}
                    placeholder="VCB-20260417-001"
                  />
                </div>

                <Checkbox
                  checked={activeDraft.createInvoiceFlag}
                  onChange={(checked) => updateActiveDraft({ createInvoiceFlag: checked })}
                  label="Tạo hóa đơn điện tử cùng lúc"
                />

                {activeDraft.createInvoiceFlag ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['MISA', 'VNPT', 'VIETTEL'] as const).map((provider) => (
                      <button
                        key={provider}
                        className={cn(
                          'rounded-md border px-3 py-2 text-sm font-medium transition',
                          activeDraft.provider === provider
                            ? 'border-[#1677ff] bg-blue-50 text-[#1677ff]'
                            : 'border-slate-200 bg-white text-slate-600',
                        )}
                        onClick={() => updateActiveDraft({ provider })}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div> */}
            </div>

            <div className="mt-auto px-5 pb-5">
              <Button
                variant="primary"
                size="lg"
                className="w-full rounded-md"
                disabled={!activeOrder?.items.length}
                busy={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
              >
                THANH TOÁN
              </Button>
            </div>
          </section>
        </div>
      </main>

      {/* <footer className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur lg:px-5">
        <div className="flex flex-wrap items-center gap-4">
          <FooterMode
            icon="lightning"
            label="Bán nhanh"
            active={saleMode === 'QUICK'}
            onClick={() => setSaleMode('QUICK')}
          />
          <FooterMode
            icon="clock"
            label="Bán thường"
            active={saleMode === 'STANDARD'}
            onClick={() => setSaleMode('STANDARD')}
          />
          <FooterMode
            icon="truck"
            label="Bán giao hàng"
            active={saleMode === 'DELIVERY'}
            onClick={() => setSaleMode('DELIVERY')}
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-md bg-blue-50 px-4 py-2 text-base font-semibold text-[#1677ff]">
            1900 6522
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-[#1677ff]">
            <Icon name="help" className="h-4 w-4" />
          </button>
        </div>
      </footer> */}
    </div>
  );
}

function createDefaultDraft(notes?: string | null): OrderDraft {
  return {
    discount: 0,
    notes: notes ?? "",
    createInvoiceFlag: false,
    provider: "MISA",
    paymentMethod: "CASH",
    receivedAmount: null,
    paymentReference: "",
    customerSearch: "",
  };
}

function createTemporaryTab(): TemporaryTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderId: null,
  };
}

function isTemporaryOrderId(orderId?: string | null) {
  return Boolean(orderId?.startsWith(TEMP_ORDER_ID_PREFIX));
}

function buildOptimisticOrder(
  orderId: string,
  product: Product,
  quantity: number,
  draft: OrderDraft,
  existingOrder?: Order
): Order {
  const now = new Date().toISOString();
  const existingItems = existingOrder?.items ?? [];
  const existingItem = existingItems.find(
    (item) => item.productId === product.id
  );
  const nextItems = existingItem
    ? existingItems.map((item) =>
        item.id === existingItem.id
          ? buildOptimisticOrderItem(
              orderId,
              product,
              item.quantity + quantity,
              item.id
            )
          : item
      )
    : [...existingItems, buildOptimisticOrderItem(orderId, product, quantity)];
  const totals = calculateOptimisticOrderTotals(nextItems);

  return {
    id: orderId,
    orderNumber: existingOrder?.orderNumber ?? "Đang tạo...",
    status: "PENDING",
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    notes: existingOrder?.notes ?? draft.notes,
    customerName:
      existingOrder?.customerName ?? (draft.customerSearch.trim() || null),
    createdAt: existingOrder?.createdAt ?? now,
    paidAt: existingOrder?.paidAt ?? null,
    cancelledAt: existingOrder?.cancelledAt ?? null,
    createdBy: existingOrder?.createdBy,
    items: nextItems,
    paymentTransactions: existingOrder?.paymentTransactions ?? [],
    revenueLogs: existingOrder?.revenueLogs ?? [],
    returns: existingOrder?.returns ?? [],
    invoice: existingOrder?.invoice ?? null,
  };
}

function buildOptimisticOrderItem(
  orderId: string,
  product: Product,
  quantity: number,
  itemId = `${orderId}-item-${product.id}`
) {
  const unitPrice = toNumber(product.price);
  const taxRate = toNumber(product.taxRate);
  const lineSubtotal = roundCurrency(unitPrice * quantity);
  const discountAmount = 0;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = roundCurrency((taxableAmount * taxRate) / 100);
  const lineTotal = roundCurrency(taxableAmount + taxAmount);

  return {
    id: itemId,
    orderId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    unit: product.unit,
    unitPrice,
    quantity,
    taxCategory: product.taxCategory,
    taxRate,
    lineSubtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    lineTotal,
  };
}

function calculateOptimisticOrderTotals(items: Order["items"]) {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + toNumber(item.lineSubtotal), 0)
  );
  const discount = roundCurrency(
    items.reduce((sum, item) => sum + toNumber(item.discountAmount), 0)
  );
  const tax = roundCurrency(
    items.reduce((sum, item) => sum + toNumber(item.taxAmount), 0)
  );
  const total = roundCurrency(
    items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0)
  );

  return { subtotal, discount, tax, total };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readTemporaryTabs(): TemporaryTab[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(TEMP_TABS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isTemporaryTab);
      }
    }

    const legacyRaw = window.sessionStorage.getItem(
      LEGACY_TEMP_ORDER_IDS_STORAGE_KEY
    );
    if (!legacyRaw) {
      return [];
    }

    const parsed = JSON.parse(legacyRaw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .map((orderId) => ({
            id: `legacy-${orderId}`,
            orderId,
          }))
      : [];
  } catch {
    return [];
  }
}

function writeTemporaryTabs(tabs: TemporaryTab[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(TEMP_TABS_STORAGE_KEY, JSON.stringify(tabs));
    window.sessionStorage.removeItem(LEGACY_TEMP_ORDER_IDS_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function isTemporaryTab(value: unknown): value is TemporaryTab {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "orderId" in value &&
      (typeof value.orderId === "string" || value.orderId === null)
  );
}

function sortPendingOrders(orders: Order[]) {
  return [...orders].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}

function PaymentSummaryLine({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={cn(
          "text-[15px]",
          highlight ? "font-semibold text-slate-900" : "text-slate-600"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "software-mono text-right text-[15px]",
          highlight
            ? "text-[18px] font-semibold text-[#1677ff]"
            : "text-slate-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}
