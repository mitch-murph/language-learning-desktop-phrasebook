import { useEffect, type RefObject } from 'react';

// Calls `onClose` when a mousedown lands outside every given element, while
// `open` is true. Only re-subscribes when `open` changes, so `refs`/`onClose`
// are read from the render that opened the popover (state setters and refs are
// stable, which is all current callers pass).
export function useClickOutside(refs: RefObject<HTMLElement>[], open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (refs.some(r => r.current?.contains(target))) return;
      onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
