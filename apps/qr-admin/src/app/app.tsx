import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="mx-auto min-h-svh max-w-3xl px-6 py-16">
        <p className="text-sm font-medium text-sky-700">Dress rental</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">QR URL Admin</h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Ứng dụng quản trị QR đã sẵn sàng. Đăng nhập, tạo mã QR và lịch sử QR sẽ được thêm cùng
          feature QR URL kế tiếp.
        </p>
      </main>
    </QueryClientProvider>
  );
}
