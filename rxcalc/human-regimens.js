import { DENTAL_SYSTEMIC_REGIMENS } from './dental-systemic.js';
import { DENTAL_TOPICAL_REGIMENS } from './dental-topicals.js';
import { NYSTATIN_REGIMENS } from './nystatin-regimens.js';
import { CARDIO_ANTICOAGULANT_REGIMENS } from './cardio-anticoagulant-regimens.js';
import { CARDIO_MAINTENANCE_REGIMENS } from './cardio-maintenance-regimens.js';
import { PERIODONTAL_SOURCE_REGIMENS } from './periodontal-source-regimens.js';

/** Explicit, source-linked options. Selecting a product never infers an indication. */
export const HUMAN_REGIMENS = [...DENTAL_SYSTEMIC_REGIMENS, ...DENTAL_TOPICAL_REGIMENS,
  ...NYSTATIN_REGIMENS, ...CARDIO_ANTICOAGULANT_REGIMENS, ...CARDIO_MAINTENANCE_REGIMENS,
  ...PERIODONTAL_SOURCE_REGIMENS];
