import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Icon } from '../components/icons';
import { Button, Field, TextInput } from '../components/ui';
import { useToast } from '../components/toast-provider';
import { extractErrorMessage, login } from '../lib/api';
import { useAuthStore } from '../store/auth-store';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const highlights = [
  {
    title: 'KiotViet-style workflow',
    text: 'Vào ca nhanh, ưu tiên tốc độ bán hàng và quan sát doanh thu vận hành.',
  },
  {
    title: 'Realtime inventory',
    text: 'Hàng hóa, bảng giá và hóa đơn dùng cùng một mô hình dữ liệu thống nhất.',
  },
  {
    title: 'No antd layer',
    text: 'Toàn bộ màn hình được custom lại bằng Tailwind để dễ mở rộng UI nội bộ.',
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@sansan.local',
      password: 'Admin@123',
    },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      toast.success('Đăng nhập thành công');
      navigate('/dashboard');
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#f3f5f7] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0e67ea_0%,#1677ff_45%,#2f8cff_100%)] px-7 py-8 text-white lg:px-12 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_32%)]" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/16 text-xl font-bold backdrop-blur">
                KV
              </div>
              <div>
                <div className="font-display text-3xl">Sansan Store</div>
                <div className="text-sm uppercase tracking-[0.3em] text-blue-100/80">
                  POS SYSTEM
                </div>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
                <Icon name="lightning" className="h-4 w-4" />
                Cập nhật UI theo mẫu KiotViet
              </div>
              <h1 className="font-display text-4xl leading-tight sm:text-5xl">
                Màn hình vận hành bán hàng được làm lại theo layout nội bộ, tối ưu cho quầy thu ngân.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-blue-50/90">
                Đăng nhập để truy cập POS, bảng giá, hàng hóa, hóa đơn và dashboard trong cùng một flow quản trị.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-[28px] border border-white/14 bg-white/10 p-5 backdrop-blur"
              >
                <div className="mb-2 text-base font-semibold">{item.title}</div>
                <div className="text-sm leading-6 text-blue-50/85">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-8 lg:px-10">
        <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white p-7 shadow-[0_28px_90px_rgba(15,23,42,0.12)] sm:p-9">
          <div className="mb-8">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#1677ff]">
              Bắt đầu ca làm việc
            </div>
            <h2 className="mt-3 font-display text-3xl text-slate-900">Đăng nhập hệ thống</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Tài khoản mẫu: <span className="software-mono font-medium text-slate-700">admin@sansan.local</span>
              {' '} / <span className="software-mono font-medium text-slate-700">Admin@123</span>
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Field label="Email" error={errors.email?.message}>
                  <TextInput {...field} placeholder="name@company.com" />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Field label="Mật khẩu" error={errors.password?.message}>
                  <TextInput {...field} type="password" placeholder="Nhập mật khẩu" />
                </Field>
              )}
            />

            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
              Sau khi vào hệ thống, có thể mở trực tiếp POS để bán hàng hoặc chuyển sang các màn Hàng hóa, Quản lý tồn kho, Hóa đơn để thao tác quản trị.
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              busy={mutation.isPending || isSubmitting}
            >
              <Icon name="arrowRight" className="h-4 w-4" />
              Vào màn hình điều hành
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
