// Driving the menus with a thumb.
//
// The panels are ordinary DOM — buttons and sliders, built for a mouse. This
// walks a focus ring through whatever is on screen, so a pad can shop, spend
// and read without ever touching the keyboard. Panels rebuild themselves on
// every purchase, so the ring re-seeds itself whenever its element goes away.
//
// The ring only ever lands on things you can press, and the longest panels —
// the assay office, the catalog — are mostly prose between them. So the right
// stick scrolls the panel itself, exactly as a mouse wheel does, independent
// of wherever the ring happens to be sitting.

const FOCUSABLE = 'button:not([disabled]), input[type="range"], a.ghost-link';

function items(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => el.offsetParent !== null);
}

export class MenuNav {
  private cur: HTMLElement | null = null;

  /** the ring lives inside one root at a time; a new root re-seeds it */
  sync(root: HTMLElement | null): void {
    if (!root) { this.blur(); return; }
    if (this.cur && root.contains(this.cur) && this.cur.offsetParent !== null) return;
    const list = items(root);
    this.focus(list.find(el => el.classList.contains('primary')) ?? list[0] ?? null);
  }

  move(root: HTMLElement, dir: number): boolean {
    const list = items(root);
    if (list.length === 0) return false;
    const i = this.cur ? list.indexOf(this.cur) : -1;
    const next = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    this.focus(list[next]);
    return true;
  }

  /** left/right: a slider slides, anything else walks the ring sideways */
  adjust(root: HTMLElement, dir: number): boolean {
    const el = this.cur;
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const step = Number(el.step) || 1;
      const span = Number(el.max) - Number(el.min);
      const bump = Math.max(step, Math.round(span / 20));
      const v = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + dir * bump));
      if (v === Number(el.value)) return true;
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return this.move(root, dir);
  }

  /** returns false when there was nothing under the ring to press */
  activate(): boolean {
    const el = this.cur;
    if (!el || el instanceof HTMLInputElement) return false;
    el.click();
    return true;
  }

  /**
   * Right stick: scroll the pane under the ring, by pixels. Returns false when
   * nothing on screen has anything left to scroll in that direction, so the
   * caller can leave the stick to whatever else wants it.
   */
  scroll(root: HTMLElement, px: number): boolean {
    const pane = this.scrollable(root);
    if (!pane) return false;
    const max = pane.scrollHeight - pane.clientHeight;
    const before = pane.scrollTop;
    pane.scrollTop = Math.max(0, Math.min(max, before + px));
    return pane.scrollTop !== before;
  }

  /** the deepest scrolling box the ring is inside, else the tallest one in it */
  private scrollable(root: HTMLElement): HTMLElement | null {
    const overflows = (el: HTMLElement) =>
      el.scrollHeight - el.clientHeight > 1 && getComputedStyle(el).overflowY !== 'visible';
    for (let el = this.cur; el && el !== root.parentElement; el = el.parentElement) {
      if (overflows(el)) return el;
    }
    if (overflows(root)) return root;
    return Array.from(root.querySelectorAll<HTMLElement>('*')).find(overflows) ?? null;
  }

  blur(): void {
    this.cur?.classList.remove('nav-focus');
    this.cur = null;
  }

  private focus(el: HTMLElement | null): void {
    this.cur?.classList.remove('nav-focus');
    this.cur = el;
    if (!el) return;
    el.classList.add('nav-focus');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }
}
