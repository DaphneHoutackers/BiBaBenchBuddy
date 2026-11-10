import DOMPurify from 'dompurify';
import { escapeHtml } from './htmlEncoding.js';

export { escapeHtml };

// Keep the editor's formatting and controls, but never executable markup.
export function sanitizeNoteHtml(html) {
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['contenteditable', 'target'],
    FORBID_TAGS: ['style', 'form'],
  });
}

export function sanitizeNoteSvg(svg) {
  return DOMPurify.sanitize(svg || '', {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['style', 'foreignObject'],
  });
}

// Parse entities exactly once; the result is plain text, rendered by React.
export function notePreviewText(html) {
  const container = document.createElement('div');
  container.innerHTML = sanitizeNoteHtml(html);
  container.querySelectorAll('br').forEach(node => node.replaceWith(' '));
  container.querySelectorAll('p, div, li, tr, td, th, h1, h2, h3, h4, h5, h6, blockquote').forEach(node => node.append(' '));
  return (container.textContent || '').replace(/\s+/g, ' ').trim();
}
