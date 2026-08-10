import { useState, type FormEvent } from 'react';

import { loginHttpControllerLogin, meHttpControllerMe } from '@/api/generated/identity/identity';
import { setTokens } from '@/api/mutator/auth-tokens';

interface LoginPageProps {
  onSignedIn: (role: 'owner' | 'staff') => void;
}

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await loginHttpControllerLogin({ email, password });
      setTokens(tokens);
      const me = await meHttpControllerMe();
      onSignedIn(me.role);
    } catch {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center px-6 py-12">
      <form className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={submit}>
        <p className="text-sm font-medium text-sky-700">Dress rental</p>
        <h1 className="mt-2 text-3xl font-bold">QR URL Admin</h1>
        <p className="mt-2 text-sm text-slate-600">Đăng nhập bằng tài khoản owner để tạo mã QR.</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="email">Email</label>
        <input className="mt-1 w-full rounded border p-2" id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">Mật khẩu</label>
        <input className="mt-1 w-full rounded border p-2" id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="mt-6 w-full rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={submitting} type="submit">
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
