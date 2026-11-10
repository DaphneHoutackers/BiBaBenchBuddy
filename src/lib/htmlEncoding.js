// Encode once for both HTML text and quoted attribute contexts.
export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
