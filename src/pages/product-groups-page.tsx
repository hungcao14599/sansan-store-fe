import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Icon } from "../components/icons";
import {
  Badge,
  Button,
  Field,
  Modal,
  Panel,
  SelectInput,
  TextArea,
  TextInput,
} from "../components/ui";
import { useToast } from "../components/toast-provider";
import {
  createProductGroup,
  deactivateProductGroup,
  extractErrorMessage,
  getProductGroups,
  updateProductGroup,
} from "../lib/api";
import { cn } from "../lib/cn";
import { formatDateTime } from "../lib/utils";
import type { ProductGroup } from "../types";

const productGroupSchema = z.object({
  name: z.string().min(2, "Tên nhóm tối thiểu 2 ký tự"),
  description: z.string().optional(),
});

type ProductGroupFormValues = z.infer<typeof productGroupSchema>;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
const pageSizeOptions = [15, 25, 50] as const;

export function ProductGroupsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductGroup | null>(null);

  const query = useQuery({
    queryKey: ["product-groups", "manage"],
    queryFn: () => getProductGroups({ includeInactive: true }),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductGroupFormValues>({
    resolver: zodResolver(productGroupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description ?? "",
      });
      return;
    }

    reset({
      name: "",
      description: "",
    });
  }, [editing, reset]);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: (values: ProductGroupFormValues) => {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      };

      if (editing) {
        return updateProductGroup(editing.id, payload);
      }

      return createProductGroup(payload);
    },
    onSuccess: async () => {
      toast.success(editing ? "Đã cập nhật nhóm sản phẩm." : "Đã tạo nhóm sản phẩm.");
      closeModal();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-groups"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const statusMutation = useMutation({
    mutationFn: (group: ProductGroup) =>
      group.isActive
        ? deactivateProductGroup(group.id)
        : updateProductGroup(group.id, { isActive: true }),
    onSuccess: async (group) => {
      setEditing((current) => (current?.id === group.id ? group : current));
      toast.success(
        group.isActive
          ? "Đã kích hoạt nhóm sản phẩm."
          : "Đã ngưng dùng nhóm sản phẩm.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-groups"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  const groups = query.data ?? [];
  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return groups.filter((group) => {
      const matchesSearch =
        !keyword ||
        [group.name, group.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && group.isActive) ||
        (statusFilter === "INACTIVE" && !group.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [groups, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((group) => group.isActive).length,
      inactive: groups.filter((group) => !group.isActive).length,
      products: groups.reduce(
        (total, group) => total + (group._count?.products ?? 0),
        0,
      ),
    }),
    [groups],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredGroups.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredGroups, pageSize]);

  const paginationRange = useMemo(() => {
    if (!filteredGroups.length) {
      return { from: 0, to: 0 };
    }

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, filteredGroups.length);
    return { from, to };
  }, [currentPage, filteredGroups.length, pageSize]);

  const openCreateModal = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEditModal = (group: ProductGroup) => {
    setEditing(group);
    setOpen(true);
  };

  const toggleGroupStatus = (group: ProductGroup) => {
    if (
      group.isActive &&
      !window.confirm(`Ngưng dùng nhóm sản phẩm ${group.name}?`)
    ) {
      return;
    }

    statusMutation.mutate(group);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-slate-900">
            Nhóm sản phẩm
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Danh mục nhóm dùng cho phân loại, lọc và xuất dữ liệu hàng hóa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{summary.total} nhóm</Badge>
          <Badge tone="green">{summary.active} đang dùng</Badge>
          <Badge tone="slate">{summary.products} sản phẩm</Badge>
        </div>
      </div>

      <div className="">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[260px] max-w-xl flex-1">
            <TextInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mô tả nhóm"
            />
          </div>

          <div className="flex items-center gap-2">
            <SelectInput
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang dùng</option>
              <option value="INACTIVE">Ngưng dùng</option>
            </SelectInput>
            <Button variant="primary" onClick={openCreateModal}>
              <Icon name="plus" className="h-4 w-4" />
              Tạo nhóm
            </Button>
          </div>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-sm">
            <thead className="border-b border-[#b8d0ee] bg-[#d9e9fb] text-slate-700">
              <tr>
                <th className="w-[260px] px-5 py-3.5 text-left font-semibold">
                  Tên nhóm
                </th>
                <th className="px-5 py-3.5 text-left font-semibold">Mô tả</th>
                <th className="w-[130px] px-5 py-3.5 text-right font-semibold">
                  Sản phẩm
                </th>
                <th className="w-[150px] px-5 py-3.5 text-left font-semibold">
                  Trạng thái
                </th>
                <th className="w-[170px] px-5 py-3.5 text-left font-semibold">
                  Cập nhật
                </th>
                <th className="w-[160px] px-5 py-3.5 text-right font-semibold">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Đang tải dữ liệu nhóm sản phẩm...
                  </td>
                </tr>
              ) : paginatedGroups.length ? (
                paginatedGroups.map((group) => (
                  <tr
                    key={group.id}
                    className="border-b border-slate-100 bg-white transition hover:bg-slate-50/80"
                  >
                    <td className="px-5 py-4 align-top">
                      <button
                        className="block max-w-[230px] truncate text-left text-[15px] font-semibold text-slate-900 transition hover:text-[#1677ff]"
                        onClick={() => openEditModal(group)}
                        title={group.name}
                      >
                        {group.name}
                      </button>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-600">
                      <div className="line-clamp-2">
                        {group.description || "---"}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-right font-medium text-slate-900">
                      {group._count?.products ?? 0}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <Badge tone={group.isActive ? "green" : "slate"}>
                        {group.isActive ? "Đang dùng" : "Ngưng dùng"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-500">
                      {formatDateTime(group.updatedAt)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => openEditModal(group)}
                          title="Sửa nhóm"
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md border bg-white transition",
                            group.isActive
                              ? "border-red-200 text-red-500 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
                          )}
                          disabled={
                            statusMutation.isPending &&
                            statusMutation.variables?.id === group.id
                          }
                          onClick={() => toggleGroupStatus(group)}
                          title={group.isActive ? "Ngưng dùng" : "Kích hoạt"}
                        >
                          <Icon
                            name={group.isActive ? "trash" : "refresh"}
                            className="h-4 w-4"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-14 text-center text-slate-500"
                  >
                    Không có nhóm sản phẩm phù hợp với bộ lọc hiện tại.
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
              onChange={(event) => setPageSize(Number(event.target.value))}
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
              {filteredGroups.length} nhóm
            </span>
          </div>
        </div>
      </Panel>

      <Modal
        open={open}
        title={editing ? `Cập nhật nhóm: ${editing.name}` : "Tạo nhóm sản phẩm"}
        onClose={closeModal}
      >
        <form
          className="space-y-5"
          onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        >
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Field label="Tên nhóm" error={errors.name?.message}>
                <TextInput {...field} autoFocus />
              </Field>
            )}
          />

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
                variant={editing.isActive ? "danger" : "soft"}
                className="mr-auto"
                busy={
                  statusMutation.isPending &&
                  statusMutation.variables?.id === editing.id
                }
                onClick={() => toggleGroupStatus(editing)}
              >
                <Icon
                  name={editing.isActive ? "trash" : "refresh"}
                  className="h-4 w-4"
                />
                {editing.isActive ? "Ngưng dùng" : "Kích hoạt"}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={closeModal}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" busy={saveMutation.isPending}>
              {editing ? "Lưu thay đổi" : "Tạo nhóm"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PaginationButton({
  icon,
  disabled,
  onClick,
}: {
  icon: "chevronsLeft" | "chevronLeft" | "chevronRight" | "chevronsRight";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}
