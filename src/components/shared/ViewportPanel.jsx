import { forwardRef, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Menus live outside scrolling/transforming panels and fit the actual viewport.
const ViewportPanel = forwardRef(function ViewportPanel({ children, className = '', style, onMouseDown, onPointerDown, ...props }, forwardedRef) {
  const marker = useRef(null);
  const panel = useRef(null);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const place = () => {
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0;
      const top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      element.style.translate = 'none';
      element.style.maxWidth = `${Math.max(0, width - 16)}px`;
      element.style.maxHeight = `${Math.max(0, height - 16)}px`;
      if (className.includes('absolute')) {
        const anchor = marker.current?.parentElement?.getBoundingClientRect();
        if (anchor) {
          const submenu = className.includes('left-full');
          element.style.right = 'auto';
          element.style.bottom = 'auto';
          element.style.left = `${submenu ? anchor.right : className.includes('right-0') ? anchor.right - element.offsetWidth : anchor.left}px`;
          element.style.top = `${submenu ? anchor.top : anchor.bottom + 4}px`;
          if (submenu && anchor.right + element.offsetWidth > left + width - 8) element.style.left = `${anchor.left - element.offsetWidth}px`;
          if (!submenu && anchor.bottom + element.offsetHeight > top + height - 8 && anchor.top > element.offsetHeight) element.style.top = `${anchor.top - element.offsetHeight - 4}px`;
        }
      }
      const rect = element.getBoundingClientRect();
      const x = Math.max(left + 8 - rect.left, Math.min(0, left + width - 8 - rect.right));
      const y = Math.max(top + 8 - rect.top, Math.min(0, top + height - 8 - rect.bottom));
      element.style.translate = `${x}px ${y}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [className, style?.left, style?.top]);
  return <><span ref={marker} style={{ display: 'none' }} />{createPortal(
    <div {...props} ref={node => { panel.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      className={className} style={{ ...style, position: 'fixed', zIndex: 10000, overflowY: 'auto', boxSizing: 'border-box', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      onMouseDown={event => { event.stopPropagation(); onMouseDown?.(event); }}
      onPointerDown={event => { event.stopPropagation(); onPointerDown?.(event); }}>
      {children}
    </div>, document.body)}</>;
});

export default ViewportPanel;
