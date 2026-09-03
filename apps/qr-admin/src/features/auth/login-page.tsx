import { useState, type FormEvent } from 'react';

import { apiErrorMessage } from '@/api/errors';
import { loginHttpControllerLogin, meHttpControllerMe } from '@/api/generated/identity/identity';
import { setTokens } from '@/api/mutator/auth-tokens';

interface LoginPageProps {
  onSignedIn: (role: 'owner' | 'staff') => void;
}

export function LoginPage({ onSignedIn }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await loginHttpControllerLogin({ username, password });
      setTokens(tokens);
      const me = await meHttpControllerMe();
      onSignedIn(me.role);
    } catch (caught) {
      // Wrong password is the rejected_invalid_credentials OUTCOME; a staff account signing in
      // successfully but lacking qr:* rights is a 403 envelope. The seam tells them apart.
      setError(apiErrorMessage(caught));
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
        <label className="mt-6 block text-sm font-medium" htmlFor="username">Tên đăng nhập</label>
        <input className="mt-1 w-full rounded border p-2" id="username" type="text" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} required />
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
