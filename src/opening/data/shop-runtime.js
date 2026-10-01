import { setOpeningSelection, getOpeningSelection } from './selection-store.js';

export function installShopItem(item) {
  const state = getOpeningSelection();
  const installed = Array.isArray(state.products) ? [...state.products] : [];
  if (item && !installed.some(entry => entry.id === item.id)) installed.push(item);
  setOpeningSelection('products', installed);
  return getOpeningSelection();
}

export function removeShopItem(id) {
  const state = getOpeningSelection();
  const installed = (state.products || []).filter(item => item.id !== id);
  setOpeningSelection('products', installed);
  return getOpeningSelection();
}
