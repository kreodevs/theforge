/** First vertically scrollable region under `root` (BFS) for mobile scroll FAB targeting. */
export function findVerticalScrollHost(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const queue: HTMLElement[] = [root];
  while (queue.length > 0) {
    const el = queue.shift()!;
    const st = getComputedStyle(el);
    const canY = st.overflowY === "auto" || st.overflowY === "scroll";
    if (canY && el.scrollHeight > el.clientHeight + 1) return el;
    for (let i = 0; i < el.children.length; i++) {
      const ch = el.children[i];
      if (ch instanceof HTMLElement) queue.push(ch);
    }
  }
  return null;
}
