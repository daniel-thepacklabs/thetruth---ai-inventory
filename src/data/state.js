import { ALL_CATEGORIES } from './constants.js';

// Use a window-level singleton so Vite HMR never creates a new empty state object.
// During the ~2 min Finale sync, HMR can re-execute this file — without the guard,
// a fresh empty state replaces the one the sync is writing to, and sales data vanishes.
if (!window.__appState) {
  window.__appState = {
    RAW_DATA: [],
    SALES_DATA: [],
    SALES_ORDER_DATA: [],
    MONTHLY_TOTALS: [],
    overrides: {},
    removedIds: new Set(),
    selectedIds: new Set(),
    activeStatuses: new Set(['critical','alert','warning','ok','zerodem']),
    activeCats: new Set(ALL_CATEGORIES),
    activeSubcats: new Set(),
    toggles: { reorder:false, nodem:false, zerodem:false, onorder:false, discontinued:false },
    discontinuedIds: new Set(JSON.parse(localStorage.getItem('discontinued') || '[]')),
    activeModalId: null,
    ALL_SUBCATS: {},
    ALL_SUBCAT_LIST: new Set(),
    alertActiveCats: new Set(ALL_CATEGORIES),
    alertActiveSubcats: new Set(),
    COST_MAP: {},
    PRICE_MAP: {},
    SHOPIFY_PRICE_MAP: {},
    WHOLESALE_PRICE_MAP: {},
    SALES_BY_STATE: {},
    ALL_EDIBLE_FLAVORS: new Set(),
    ALL_EDIBLE_PACKS: new Set(),
    activeEdibleFlavors: new Set(),
    activeEdiblePacks: new Set(),
  };
}

export const state = window.__appState;
