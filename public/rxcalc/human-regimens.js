import { DENTAL_SYSTEMIC_REGIMENS } from './dental-systemic.js';
import { DENTAL_TOPICAL_REGIMENS } from './dental-topicals.js';

/** Explicit, source-linked options. Selecting a product never infers an indication. */
export const HUMAN_REGIMENS = [...DENTAL_SYSTEMIC_REGIMENS, ...DENTAL_TOPICAL_REGIMENS];
