/** Exact catalogue variants. Search never changes the selected product. */
export const normalizeProductQuery = value => String(value ?? '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l').replace(/,/g, '.').replace(/[^a-z0-9.]+/g, ' ').trim();

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
