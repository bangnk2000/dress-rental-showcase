'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Status = 'idle' | 'copied' | 'failed';

/** Clipboard + a short status line read by screen readers (design/responsive.md §6 "copy address"). */
export function CopyAddressButton({ address }: { address: string }) {
  const t = useTranslations('contact.info');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const id = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="hit relative inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-label-sm text-on-surface"
      >
        {status === 'copied' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {t('copy')}
      </button>
      <span role="status" className="order-last basis-full text-body-sm text-primary empty:hidden">
        {status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : ''}
      </span>
    </>
  );
}
