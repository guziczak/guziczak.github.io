/**
 * Retain only reviewed source confirmations independent of an edited field.
 * This never creates a confirmation, approves a regimen, or preserves the
 * final result confirmation (handled separately by the caller).
 *
 * Whitelist reviewed against cardio-anticoagulant-regimens.js on 2026-11-21:
 * - NVAF indication depends on age (>=75 may establish its risk factor), but
 *   its stated indication/risk factors do not depend on entered weight/CrCl.
 * - Apixaban initial/continuation phase checks are distinct from its separate
 *   renal-scope confirmation, which is always cleared after a renal edit.
 * - Postoperative, six-month/prevention, rivaroxaban VTE and bleeding-risk
 *   confirmations combine chronology with clinical risk decisions. Clear them.
 * Unknown source/requirement/field: clear. Adding a new rule requires review.
 */
const INDEPENDENT_FIELDS = new Set([
  'humanCrCl', 'humanSerumCreatinine', 'renalInputMode', 'renalCreatinineUnit',
  'renalSex', 'renalCalculationWeight', 'renalCalculationReviewed',
  'renalStatus', 'renalImpairment', 'weight',
]);
const REVIEWED_SOURCES = new Map([
  ['cardio-eliquis-nvaf-standard', ['apixaban-nvaf-standard', 'anticoagulant-nvaf-indication']],
  ['cardio-eliquis-nvaf-two-criteria', ['apixaban-nvaf-two-criteria', 'anticoagulant-nvaf-indication']],
  ['cardio-eliquis-nvaf-severe-renal', ['apixaban-nvaf-severe-renal', 'anticoagulant-nvaf-indication']],
  ['cardio-xarelto-nvaf-standard', ['rivaroxaban-nvaf-standard', 'anticoagulant-nvaf-indication']],
  ['cardio-xarelto-nvaf-renal', ['rivaroxaban-nvaf-renal', 'anticoagulant-nvaf-indication']],
  ['cardio-eliquis-vte-initial', ['apixaban-vte', 'apixaban-vte-initial-phase']],
  ['cardio-eliquis-vte-continuation', ['apixaban-vte', 'apixaban-vte-continuation-phase']],
]);

export function sourceConfirmationsAfterEdit(source, confirmations, field) {
  if (!INDEPENDENT_FIELDS.has(field) || !Array.isArray(confirmations)
      || !source || typeof source !== 'object' || Array.isArray(source)
      || !Array.isArray(source.selectionRequirements)) return [];
  const reviewed = REVIEWED_SOURCES.get(source.id);
  if (!reviewed || source.anticoagulantRule !== reviewed[0]) return [];
  const existingIds = new Set(source.selectionRequirements
    .filter(requirement => requirement && typeof requirement.id === 'string')
    .map(requirement => requirement.id));
  // The apixaban phase/indication exemption was reviewed with an independently
  // invalidated renal scope. Do not reuse it for a changed source omitting that.
  if (reviewed[0].startsWith('apixaban') && !existingIds.has('apixaban-renal-scope')) return [];
  return [...new Set(confirmations.filter(id => typeof id === 'string'
    && id === reviewed[1] && existingIds.has(id)))];
}
