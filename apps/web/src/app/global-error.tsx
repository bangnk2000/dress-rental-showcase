'use client';

// Last-resort boundary: it replaces the root layout, so no providers (no next-intl) and no
// globals.css exist here. Copy and the DESIGN.md role colors (surface, on-surface(-variant),
// primary — light and dark, see globals.css) are inline on purpose: the one sanctioned exception
// to "every string via t(), every color via a token".
const css = `
  body { margin: 0; min-height: 100dvh; padding: 4rem 1.25rem; text-align: center;
         font-family: Georgia, serif; background: #fcf9f6; color: #524345; }
  h1 { font-weight: 400; color: #1b1c1a; }
  button { border: 0; border-radius: 0.25rem; padding: 0.75rem 2rem; cursor: pointer;
           background: #6e3841; color: #ffffff; }
  @media (prefers-color-scheme: dark) {
    body { background: #131312; color: #d6c2c3; }
    h1 { color: #e5e2df; }
    button { background: #feb3bc; color: #51212a; }
  }
`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <style>{css}</style>
        <h1>Đã có lỗi xảy ra</h1>
        <button type="button" onClick={reset}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
