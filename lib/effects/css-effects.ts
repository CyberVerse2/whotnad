/**
 * Transient CSS class helpers.
 * Direct DOM manipulation to avoid React re-renders for short-lived effects.
 */

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Add a CSS class to an element, auto-remove after duration.
 * If the same key is already active, resets the timer.
 */
export function flashClass(
  el: HTMLElement | null,
  className: string,
  durationMs: number,
  key?: string
) {
  if (!el) return;
  const k = key ?? className;

  // Clear existing timer for this key
  const existing = activeTimers.get(k);
  if (existing) clearTimeout(existing);

  el.classList.add(className);
  const timer = setTimeout(() => {
    el.classList.remove(className);
    activeTimers.delete(k);
  }, durationMs);
  activeTimers.set(k, timer);
}

/** Remove all active flash timers (cleanup on unmount) */
export function clearAllFlashTimers() {
  for (const timer of activeTimers.values()) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}
