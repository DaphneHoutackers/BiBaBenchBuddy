const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function rankToolSearchResults(items, query, limit = 9) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return items.filter(item => !item.tabId).slice(0, limit);

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return items
    .map((item, index) => {
      const label = normalize(item.label);
      const parent = normalize(item.parentLabel);
      const category = normalize(item.category);
      const keywords = normalize(item.keywords);
      const searchable = `${label} ${parent} ${category} ${keywords}`;

      if (!terms.every(term => searchable.includes(term))) return null;

      let score = 0;
      if (label === normalizedQuery) score += 120;
      if (label.startsWith(normalizedQuery)) score += 80;
      if (label.includes(normalizedQuery)) score += 50;
      if (parent.startsWith(normalizedQuery)) score += 30;
      if (keywords.includes(normalizedQuery)) score += 15;
      score += terms.reduce((total, term) => total + (label.startsWith(term) ? 8 : 0), 0);

      return { item, score, index };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.item);
}
