import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';

import { apiErrorMessage } from '@/api/errors';
import { getQrSvgBlob } from '@/api/qr-image';
import {
  createUrlCodeHttpControllerCreate,
  listQrLinksHttpControllerList,
} from '@/api/generated/qr-links/qr-links';
import type { CreateUrlCodeRequestDto, QrLinkResponseDto } from '@/api/generated/model';

import { validateLabel, validateTargetUrl } from './target-url';

const PAGE_SIZE = 20;

function dateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

interface QrUrlPageProps {
  /** Ends the session. Sessions survive reloads now, so leaving one open is a deliberate act. */
  onSignOut: () => void;
}

export function QrUrlPage({ onSignOut }: QrUrlPageProps) {
  const queryClient = useQueryClient();
  const [targetUrl, setTargetUrl] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QrLinkResponseDto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const history = useQuery({
    queryKey: ['qr-links', { page, limit: PAGE_SIZE }],
    queryFn: () => listQrLinksHttpControllerList({ page, limit: PAGE_SIZE }),
  });
  const create = useMutation<QrLinkResponseDto, Error, CreateUrlCodeRequestDto>({
    mutationFn: (input) => createUrlCodeHttpControllerCreate(input),
    onSuccess: (link) => {
      setTargetUrl('');
      setLabel('');
      setSelected(link);
      void queryClient.invalidateQueries({ queryKey: ['qr-links'] });
    },
    onError: (error) => setFormError(apiErrorMessage(error)),
  });

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setImageError(null);
    // Drop the previous QR before fetching the new one. Leaving it up means a slow request shows
    // — and downloads, under the NEW row's target URL and filename — the QR of the row before it.
    // A wrong QR that looks right is worse than a moment of "Đang tải SVG…".
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    void getQrSvgBlob(selected.id)
      .then((blob) => {
        if (!active) return;
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
      })
      .catch((error: unknown) => {
        if (active) setImageError(apiErrorMessage(error));
      });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetError = validateTargetUrl(targetUrl);
    const labelError = validateLabel(label);
    if (targetError || labelError) {
      setFormError(targetError ?? labelError);
      return;
    }
    setFormError(null);
    create.mutate({ targetUrl: targetUrl.trim(), label: label.trim() || undefined });
  }

  function download() {
    if (!previewUrl || !selected) return;
    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `qr-${selected.id}.svg`;
    anchor.click();
  }

  return (
    <main className="mx-auto min-h-svh max-w-4xl px-6 py-10">
      <header className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-sky-700">Dress rental</p><h1 className="mt-1 text-3xl font-bold">QR URL Admin</h1></div><button className="shrink-0 rounded border px-3 py-1 text-sm" onClick={onSignOut} type="button">Đăng xuất</button></header>
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Tạo QR URL</h2>
        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-medium">URL đích<input className="rounded border p-2" placeholder="https://example.com" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Nhãn nội bộ (tuỳ chọn)<input className="rounded border p-2" placeholder="Poster cửa hàng" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
          <button className="justify-self-start rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={create.isPending} type="submit">{create.isPending ? 'Đang tạo…' : 'Tạo mã QR'}</button>
        </form>
      </section>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
        <h2 className="text-xl font-semibold">Xem trước</h2>
        {!selected && <p className="mt-3 text-slate-600">Tạo hoặc chọn một mã QR trong lịch sử.</p>}
        {selected && <div className="mt-4 flex flex-wrap items-center gap-6"><div className="grid h-56 w-56 place-items-center border bg-white">{previewUrl ? <img alt={`QR cho ${selected.targetUrl}`} className="h-full w-full p-2" src={previewUrl} /> : <span>Đang tải SVG…</span>}</div><div><p className="break-all text-sm text-slate-700">{selected.targetUrl}</p>{imageError && <p className="mt-2 text-sm text-red-700">{imageError}</p>}<button className="mt-4 rounded border border-sky-700 px-4 py-2 font-semibold text-sky-800 disabled:opacity-50" disabled={!previewUrl} onClick={download} type="button">Tải SVG</button></div></div>}
      </section>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Lịch sử QR</h2>
        {history.isLoading && <p className="mt-3 text-slate-600">Đang tải lịch sử…</p>}
        {history.isError && <button className="mt-3 rounded border px-3 py-1" onClick={() => void history.refetch()} type="button">Tải lại lịch sử</button>}
        {history.data?.data.length === 0 && <p className="mt-3 text-slate-600">Chưa có mã QR nào.</p>}
        {history.data && history.data.data.length > 0 && <ul className="mt-4 divide-y">{history.data.data.map((link) => <li className="flex items-center justify-between gap-4 py-3" key={link.id}><div className="min-w-0"><p className="font-medium">{link.label || 'Không có nhãn'}</p><p className="truncate text-sm text-slate-600">{link.targetUrl}</p><p className="text-xs text-slate-500">{dateTime(link.createdAt)} · {link.createdByName ?? 'Nhân sự đã nghỉ'}</p></div><button className="shrink-0 rounded border px-3 py-1" onClick={() => setSelected(link)} type="button">Xem QR</button></li>)}</ul>}
        {history.data && history.data.count > PAGE_SIZE && <div className="mt-4 flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">Trước</button><span>Trang {page}</span><button disabled={history.data.data.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)} type="button">Sau</button></div>}
      </section>
    </main>
  );
}
