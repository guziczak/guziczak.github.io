/**
 * Catalogue visibility is separate from arithmetic and clinical suitability.
 * A veterinary formulation is offered only for an explicitly listed species.
 * Returned entries/forms are shallow copies; source metadata is never changed.
 */
const ANIMAL_SPECIES = new Set(['dog', 'cat', 'horse', 'hamster', 'rat']);

export function availableDrugs(drugs, specialty, species) {
  if (!Array.isArray(drugs) || typeof specialty !== 'string' || !specialty) return [];
  const veterinary = specialty === 'veterinary';
  if (veterinary && !ANIMAL_SPECIES.has(species)) return [];

  return drugs.flatMap(drug => {
    if (!drug || !Array.isArray(drug.specialties) || !drug.specialties.includes(specialty) || !Array.isArray(drug.forms)) return [];
    const forms = drug.forms.filter(form => {
      if (!form || typeof form !== 'object') return false;
      return veterinary
        ? Array.isArray(form.targetSpecies) && form.targetSpecies.includes(species)
        : !Object.hasOwn(form, 'targetSpecies');
    }).map(form => ({ ...form }));
    return forms.length ? [{ ...drug, forms }] : [];
  });
}
