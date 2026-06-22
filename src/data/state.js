import { ALL_CATEGORIES } from './constants.js';

export const state = {
  RAW_DATA: [],
  SALES_DATA: [],
  MONTHLY_TOTALS: [],
  overrides: {},
  removedIds: new Set(),
  selectedIds: new Set(),
  activeStatuses: new Set(['critical','alert','warning','ok']),
  activeCats: new Set(ALL_CATEGORIES),
  activeSubcats: new Set(),
  toggles: { reorder:false, nodem:false, adjusted:false, onorder:false },
  activeModalId: null,
  ALL_SUBCATS: {},
  ALL_SUBCAT_LIST: new Set(),
  alertActiveCats: new Set(ALL_CATEGORIES),
  alertActiveSubcats: new Set(),
  ALL_EDIBLE_FLAVORS: new Set(),
  ALL_EDIBLE_PACKS: new Set(),
  activeEdibleFlavors: new Set(),
  activeEdiblePacks: new Set(),
};
