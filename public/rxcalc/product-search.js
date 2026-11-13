/** Exact catalogue variants. Search never changes the selected product. */
export const normalizeProductQuery = value => String(value ?? '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l').replace(/,/g, '.').replace(/[^a-z0-9.]+/g, ' ').trim();

const queryTokens = query => [...new Set(normalizeProductQuery(query).split(/\s+/).filter(Boolean))];

/** Keep offsets into the original text while applying the catalogue's search normalization. */
function normalizedTextOffsets(value) {
  const text = String(value ?? '');
  let normalized = '', offset = 0;
  const positions = [];
  for (const character of text) {
    const start = offset;
    offset += character.length;
    const folded = character.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/,/g, '.');
    if (!folded) {
      // A separately encoded combining accent belongs to its preceding character.
      if (positions.length) positions[positions.length - 1].end = offset;
      continue;
    }
    for (const part of folded) {
      const next = /[a-z0-9.]/.test(part) ? part : ' ';
      if (next === ' ' && normalized.endsWith(' ')) {
        positions[positions.length - 1].end = offset;
      } else {
        normalized += next;
        positions.push({ start, end: offset });
      }
    }
  }
  const leading = normalized.startsWith(' ') ? 1 : 0;
  const trailing = normalized.endsWith(' ') ? 1 : 0;
  return {
    text,
    normalized: normalized.trim(),
    positions: positions.slice(leading, trailing ? -1 : undefined),
  };
}

/** Plain text segments only. The UI must escape every segment before adding markup. */
export function highlightSegments(value, query = '') {
  const { text, normalized, positions } = normalizedTextOffsets(value);
  if (!text) return [];
  const ranges = [];
  for (const token of queryTokens(query)) {
    let at = normalized.indexOf(token);
    while (at !== -1) {
      ranges.push({ start: positions[at].start, end: positions[at + token.length - 1].end });
      at = normalized.indexOf(token, at + 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  const segments = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), matched: false });
    segments.push({ text: text.slice(range.start, range.end), matched: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });
  return segments;
}

/** Explain matching tokens using actual catalogue fields, without inferring clinical meaning. */
export function searchMatchDetails(drug, query = '', form = null, pack = null) {
  const tokens = queryTokens(query);
  if (!drug || !tokens.length) return [];
  const forms = form ? [form] : drug.forms || [];
  const fields = [
    ...forms.map(item => ({ kind: 'product', label: 'Preparat', text: item.label })),
    { kind: 'package', label: 'Opakowanie', text: pack?.label },
    { kind: 'substance', label: 'Substancja', text: drug.substanceLabel },
    { kind: 'substance', label: 'Substancja', text: drug.substance },
    { kind: 'name', label: 'Nazwa', text: drug.name },
    ...forms.map(item => ({ kind: 'route', label: 'Droga podania', text: item.routeLabel })),
    ...forms.map(item => ({ kind: 'keyword', label: 'Postać', text: item.shortFormLabel })),
    ...(drug.searchTerms || []).map(text => ({ kind: 'keyword', label: 'Hasło', text })),
    ...forms.flatMap(item => (item.searchTerms || []).map(text => ({ kind: 'keyword', label: 'Hasło', text }))),
  ];
  const covered = new Set(), result = [];
  for (const field of fields) {
    if (typeof field.text !== 'string' || !field.text.trim()) continue;
    const normalized = normalizeProductQuery(field.text);
    const matching = tokens.filter(token => normalized.includes(token));
    if (!matching.some(token => !covered.has(token))) continue;
    result.push(field);
    matching.forEach(token => covered.add(token));
    if (covered.size === tokens.length) break;
  }
  return result;
}

export function catalogueProducts(drugs = []) {
  return drugs.flatMap(drug => (drug.forms || []).flatMap(form =>
    (form.packOptions || []).map(pack => ({
      key: `${drug.id}|${form.id}|${pack.id}`, drug, form, pack,
      searchText: normalizeProductQuery([
        drug.name, drug.substance, drug.substanceLabel, ...(drug.searchTerms || []),
        form.label, form.shortFormLabel, form.routeLabel, pack.label,
        ...(form.searchTerms || []),
      ].filter(Boolean).join(' ')),
    }))));
}

export function searchProducts(drugs, query = '') {
  const tokens = normalizeProductQuery(query).split(/\s+/).filter(Boolean);
  return catalogueProducts(drugs).filter(product => tokens.every(token => product.searchText.includes(token)));
}
