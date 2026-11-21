/**
 * Calculate Moving Average Cost (HPP - Harga Pokok Penjualan)
 * @param {number} oldStock - Current stock level before incoming purchase
 * @param {number} oldHPP - Current average unit cost
 * @param {number} newStock - Incoming stock quantity
 * @param {number} newPrice - Unit price of incoming stock
 * @returns {number} New average HPP (rounded to nearest integer)
 */
export function calculateMovingAverageHPP(oldStock, oldHPP, newStock, newPrice) {
  const currentStock = Math.max(0, Number(oldStock) || 0);
  const currentHPP = Math.max(0, Number(oldHPP) || 0);
  const incomingQty = Math.max(0, Number(newStock) || 0);
  const incomingPrice = Math.max(0, Number(newPrice) || 0);

  // If no incoming stock, keep old HPP
  if (incomingQty <= 0) {
    return Math.round(currentHPP);
  }

  // If previously no stock or 0, new HPP is the incoming price
  if (currentStock <= 0) {
    return Math.round(incomingPrice);
  }

  const totalQty = currentStock + incomingQty;
  if (totalQty === 0) {
    return 0;
  }

  const totalValue = (currentStock * currentHPP) + (incomingQty * incomingPrice);
  return Math.round(totalValue / totalQty);
}

/**
 * Calculate Cost of Goods Sold (COGS)
 * @param {number} qty - Quantity sold
 * @param {number} hppAtTime - Unit HPP at the time of sale
 * @returns {number} Total COGS (rounded to nearest integer)
 */
export function calculateCOGS(qty, hppAtTime) {
  const quantity = Math.max(0, Number(qty) || 0);
  const unitHPP = Math.max(0, Number(hppAtTime) || 0);
  return Math.round(quantity * unitHPP);
}

/**
 * Calculate Gross Profit (Laba Kotor)
 * @param {number} revenue - Total sales revenue
 * @param {number} cogs - Total cost of goods sold
 * @returns {number} Gross profit
 */
export function calculateGrossProfit(revenue, cogs) {
  const rev = Number(revenue) || 0;
  const cost = Number(cogs) || 0;
  return Math.round(rev - cost);
}
