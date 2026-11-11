import type { Page } from '@playwright/test';

/** One element that sticks out of the layout viewport, described well enough to find it in code. */
export type Offender = {
  element: string;
  text: string;
  left: number;
  right: number;
};

export type LayoutProbe = {
  /** `document.documentElement.scrollWidth` — what the browser would let the user scroll to. */
  scrollWidth: number;
  /**
   * Outermost elements whose box crosses the left OR right edge of `width`. Left matters as much
   * as right: content pushed off the LEFT edge never widens `scrollWidth` (it cannot be scrolled
   * to), so the page check alone misses it — design §1's board card action row is that bug.
   * Elements inside a horizontally scrolling/clipping container are skipped (a nav strip that is
   * MEANT to scroll sideways is not an overflow); `html`/`body` do not count as such a container,
   * so hiding overflow on them does not hide an offender.
   */
  offenders: Offender[];
  /**
   * Containers that actually scroll sideways inside the page (the header/nav strip excluded — it
   * is designed to). The spec asserts none on the stacked list screens (D2).
   */
  scrollers: Offender[];
};

/**
 * Measures the page against `width` — the CONFIGURED viewport width, never `window.innerWidth`:
 * with `isMobile` Chromium zooms a too-wide page out, which grows `innerWidth` with the overflow
 * and would blind both checks.
 */
export async function probeLayout(page: Page, width: number): Promise<LayoutProbe> {
  return page.evaluate((w) => {
    const describe = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}`
          : '';
      const role = el.getAttribute('role');
      return {
        element: `${el.tagName.toLowerCase()}${id}${cls}${role ? `[role=${role}]` : ''}`,
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 50),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    };
    const sticksOut = (el: Element) => {
      const rect = el.getBoundingClientRect();
      // sr-only and collapsed nodes are 1px or less; they are not something a thumb can miss.
      if (rect.width <= 1 || rect.height <= 1) return false;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return rect.right > w + 0.5 || rect.left < -0.5;
    };
    const insideSideScroller = (el: Element) => {
      for (
        let p = el.parentElement;
        p && p !== document.body && p !== document.documentElement;
        p = p.parentElement
      ) {
        if (getComputedStyle(p).overflowX !== 'visible') return true;
      }
      return false;
    };

    const offenders: ReturnType<typeof describe>[] = [];
    const scrollers: ReturnType<typeof describe>[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const ox = getComputedStyle(el).overflowX;
      if (
        (ox === 'auto' || ox === 'scroll') &&
        el.scrollWidth > el.clientWidth + 1 &&
        // D1: the header's nav strip is DESIGNED to scroll sideways on a phone.
        !el.closest('header, nav')
      ) {
        scrollers.push(describe(el));
      }
      if (!sticksOut(el) || insideSideScroller(el)) continue;
      // Report the outermost offender only — its children overflow because it does.
      const parent = el.parentElement;
      if (parent && parent !== document.body && sticksOut(parent)) continue;
      offenders.push(describe(el));
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 12),
      scrollers: scrollers.slice(0, 12),
    };
  }, width);
}

/** Multi-line, human-readable form for an assertion message. */
export function formatOffenders(list: Offender[]): string {
  if (list.length === 0) return '(none)';
  return list
    .map((o) => `  ${o.element} [${o.left}..${o.right}px] "${o.text}"`)
    .join('\n');
}
