const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** 350000 → "350.000đ" — the shop's own price notation (not the ISO "₫" currency style). */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`;
}

/** 2800000 → "2.800k" — the compact strike-through retail price on dress cards. */
export function formatVndCompact(amount: number): string {
  return `${vnd.format(Math.round(amount / 1000))}k`;
}
