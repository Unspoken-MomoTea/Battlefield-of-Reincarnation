export function readOpeningShop(source = {}) {
  const items = Array.isArray(source.items) ? source.items : [];
  return items.map(item => ({
    id: item.id ?? item.名称 ?? crypto.randomUUID?.() ?? String(Date.now()),
    name: item.name ?? item.名称 ?? '',
    type: item.type ?? item.类型 ?? '',
    cost: item.cost ?? item.价格 ?? 0,
    data: item,
  }));
}

export function selectOpeningShopItem(state, item) {
  state.shop = state.shop || [];
  if (!state.shop.some(entry => entry.id === item.id)) state.shop.push(item);
  return state.shop;
}
