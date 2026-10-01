import { setOpeningSelection, getOpeningSelection } from './selection-store.js';

export function installShopItem(item) {
  const state = getOpeningSelection();
  const installed = Array.isArray(state.shop) ? [...state.shop] : [];
  if (item && !installed.some(entry => entry.id === item.id)) installed.push(item);
  const next = { ...state, shop: installed };
  setOpeningSelection(next);
  return next;
}

export function removeShopItem(id) {
  const state = getOpeningSelection();
  const next = {
    ...state,
    shop: (state.shop || []).filter(item => item.id !== id),
  };
  setOpeningSelection(next);
  return next;
}
