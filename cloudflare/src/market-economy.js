export const MARKET_QUALITIES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

export const MARKET_QUALITY_FLOORS = Object.freeze({
  F: 10,
  E: 100,
  D: 1_000,
  C: 5_000,
  B: 20_000,
  A: 80_000,
  S: 320_000,
  SS: 1_280_000,
  SSS: 5_120_000,
});

export const MARKET_QUALITY_HIGHS = Object.freeze({
  F: 99,
  E: 999,
  D: 4_999,
  C: 19_999,
  B: 79_999,
  A: 319_999,
  S: 1_279_999,
  SS: 5_119_999,
  // SSS 在世界书中只有“512w+”而没有有限上限；系统固定价以 512w 基准计算。
  SSS: 5_120_000,
});

export const MARKET_BUYBACK_BPS = Object.freeze({
  F: 3_500,
  E: 3_500,
  D: 2_500,
  C: 2_500,
  B: 2_000,
  A: 2_000,
  S: 2_000,
  SS: 2_000,
  SSS: 2_000,
});

export const MARKET_AUCTION_DURATIONS = Object.freeze([24, 48, 72]);
export const MARKET_LISTING_DAILY_BPS = 1_000;
export const MARKET_SUCCESS_FEE_BPS = 300;
export const MARKET_EXPIRED_GRACE_HOURS = 72;
export const MARKET_CREDENTIAL_DAILY_STOCK = 30;

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

export function marketQuality(value) {
  const quality = String(value || '').trim().toUpperCase();
  return MARKET_QUALITIES.includes(quality) ? quality : 'F';
}

export function marketQualityFromAsset(asset) {
  return marketQuality(asset?.data?.品质 || asset?.data?.层级 || asset?.quality || 'F');
}

export function marketQualityFloor(quality) {
  return MARKET_QUALITY_FLOORS[marketQuality(quality)];
}

export function marketQualityHigh(quality) {
  return MARKET_QUALITY_HIGHS[marketQuality(quality)];
}

export function marketBuybackUnitPrice(quality) {
  const grade = marketQuality(quality);
  return Math.max(1, Math.floor(MARKET_QUALITY_FLOORS[grade] * MARKET_BUYBACK_BPS[grade] / 10_000));
}

export function marketBuybackQuote(asset, quantity = 1) {
  const quality = marketQualityFromAsset(asset);
  const resolvedQuantity = Math.max(1, integer(quantity, 1));
  const unitPrice = marketBuybackUnitPrice(quality);
  return {
    quality,
    quantity: resolvedQuantity,
    unit_price: unitPrice,
    total_price: unitPrice * resolvedQuantity,
  };
}

export function marketAuctionQuote(asset, quantity = 1, durationHours = 24) {
  const quality = marketQualityFromAsset(asset);
  const resolvedQuantity = Math.max(1, integer(quantity, 1));
  const hours = integer(durationHours, 24);
  if (!MARKET_AUCTION_DURATIONS.includes(hours)) {
    throw new Error('拍卖时长只支持 24、48 或 72 小时');
  }

  const baseValue = marketQualityHigh(quality) * resolvedQuantity;
  const listingFee = Math.max(
    1,
    Math.ceil(baseValue * MARKET_LISTING_DAILY_BPS * (hours / 24) / 10_000),
  );

  return {
    quality,
    quantity: resolvedQuantity,
    duration_hours: hours,
    quality_floor: marketQualityFloor(quality),
    quality_high: marketQualityHigh(quality),
    listing_fee: listingFee,
  };
}

export function marketSaleSettlement(totalPrice) {
  const gross = Math.max(0, integer(totalPrice, 0));
  const marketFee = Math.max(0, Math.ceil(gross * MARKET_SUCCESS_FEE_BPS / 10_000));
  return {
    gross,
    market_fee: marketFee,
    seller_proceeds: Math.max(0, gross - marketFee),
  };
}

export function marketRecycleAt(expiresAt) {
  return Math.max(0, integer(expiresAt, 0)) + MARKET_EXPIRED_GRACE_HOURS * 60 * 60 * 1000;
}

export function marketDayKey(now = Date.now()) {
  return new Date(Number(now) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function marketCredentialSpecs() {
  return MARKET_QUALITIES.map(quality => ({
    quality,
    id: `system:credential:${quality}`,
    name: `${quality}级权限凭证`,
    unit_price: marketQualityHigh(quality),
    quantity: MARKET_CREDENTIAL_DAILY_STOCK,
  }));
}
