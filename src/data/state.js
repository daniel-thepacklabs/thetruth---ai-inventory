import { ALL_CATEGORIES } from './constants.js';

export const state = {
  RAW_DATA: [],
  SALES_DATA: [],
  MONTHLY_TOTALS: [],
  EDIBLE_ONHAND: {},
  overrides: {},
  removedIds: new Set(),
  selectedIds: new Set(),
  activeStatuses: new Set(['critical','alert','warning','ok']),
  activeCats: new Set(ALL_CATEGORIES),
  activeSubcats: new Set(),
  toggles: { reorder:false, nodem:false, adjusted:false, onorder:false, combined:true, individual:true },
  activeModalId: null,
  ALL_SUBCATS: {},
  ALL_SUBCAT_LIST: new Set(),
  alertActiveCats: new Set(ALL_CATEGORIES),
  alertActiveSubcats: new Set(),
};
