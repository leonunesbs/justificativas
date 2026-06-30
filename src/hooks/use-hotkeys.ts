'use client';

import { useEffect, useRef } from 'react';

export type Hotkey = {
  /** Combo such as `ctrl+enter`, `ctrl+s`, `escape` or `?`. `ctrl` also matches ⌘ (meta) for macOS parity. */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /** Fire even while typing in an input/textarea/select. Defaults to `false`. */
  enableOnFormTags?: boolean;
  /** Call `event.preventDefault()` when the combo matches. Defaults to `true`. */
  preventDefault?: boolean;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function matchesCombo(combo: string, event: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';

  const needCtrl = parts.includes('ctrl');
  const needAlt = parts.includes('alt');
  const needShift = parts.includes('shift');

  // Treat Ctrl (Windows/Linux) and ⌘ (macOS) as the same intent.
  const hasCtrl = event.ctrlKey || event.metaKey;
  if (needCtrl !== hasCtrl) return false;
  if (needAlt !== event.altKey) return false;

  // `?` already implies Shift on most layouts, so don't double-check it.
  if (key !== '?' && needShift !== event.shiftKey) return false;

  return event.key.toLowerCase() === key;
}

/**
 * Registers global keyboard shortcuts on `window`. Optimized for Windows + Chrome:
 * only intercepts combos that Chrome lets `preventDefault` handle.
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Ignore the modifier keys themselves and IME composition.
      if (event.isComposing) return;

      const editable = isEditableTarget(event.target);

      for (const hotkey of hotkeysRef.current) {
        if (editable && !hotkey.enableOnFormTags) continue;
        if (!matchesCombo(hotkey.combo, event)) continue;

        if (hotkey.preventDefault ?? true) {
          event.preventDefault();
        }
        hotkey.handler(event);
        break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
