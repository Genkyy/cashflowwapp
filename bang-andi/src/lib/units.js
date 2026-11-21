import { formatNumber } from './formatters.js';

/**
 * Convert quantity from specified unit to base unit
 * @param {number} qty
 * @param {string} unitName
 * @param {Array<{unit_name: string, factor: number, item_id?: any}>} conversions
 * @returns {number}
 */
export function convertToBaseUnit(qty, unitName, conversions = []) {
  const quantity = Number(qty) || 0;
  if (!unitName || !Array.isArray(conversions)) return quantity;

  const conv = conversions.find(
    (c) => c.unit_name?.toLowerCase() === unitName.toLowerCase()
  );

  if (!conv || !conv.factor) {
    return quantity;
  }

  return quantity * Number(conv.factor);
}

/**
 * Convert quantity from base unit to specified alt unit
 * @param {number} qty
 * @param {string} unitName
 * @param {Array<{unit_name: string, factor: number, item_id?: any}>} conversions
 * @returns {number}
 */
export function convertFromBaseUnit(qty, unitName, conversions = []) {
  const quantity = Number(qty) || 0;
  if (!unitName || !Array.isArray(conversions)) return quantity;

  const conv = conversions.find(
    (c) => c.unit_name?.toLowerCase() === unitName.toLowerCase()
  );

  if (!conv || !conv.factor || Number(conv.factor) === 0) {
    return quantity;
  }

  return quantity / Number(conv.factor);
}

/**
 * Get all available units for an item (base unit + alternate units)
 * @param {{id?: any, base_unit?: string, unit?: string}} item
 * @param {Array<{item_id?: any, unit_name: string, factor: number}>} conversions
 * @returns {Array<{name: string, factor: number, label: string}>}
 */
export function getAvailableUnits(item, conversions = []) {
  const baseUnit = item?.base_unit || item?.unit || 'unit';
  const units = [
    {
      name: baseUnit,
      factor: 1,
      label: baseUnit,
    },
  ];

  if (!Array.isArray(conversions)) {
    return units;
  }

  const itemConvs = conversions.filter(
    (c) => !item?.id || !c.item_id || String(c.item_id) === String(item.id)
  );

  for (const c of itemConvs) {
    if (c.unit_name && c.unit_name.toLowerCase() !== baseUnit.toLowerCase()) {
      units.push({
        name: c.unit_name,
        factor: Number(c.factor) || 1,
        label: `${c.unit_name} (${c.factor} ${baseUnit})`,
      });
    }
  }

  return units;
}

/**
 * Format quantity with base unit and optional alt unit
 * Example: formatQtyWithUnit(45, 'kg', 'Peti', conversions) -> "45 kg (3 Peti)"
 * @param {number} qty - Quantity in base unit
 * @param {string} baseUnit
 * @param {string} [unitUsed]
 * @param {Array} [conversions]
 * @returns {string}
 */
export function formatQtyWithUnit(qty, baseUnit = '', unitUsed = '', conversions = []) {
  const quantity = Number(qty) || 0;
  const baseLabel = `${formatNumber(quantity)} ${baseUnit}`.trim();

  if (!unitUsed || unitUsed.toLowerCase() === baseUnit.toLowerCase()) {
    return baseLabel;
  }

  const altQty = convertFromBaseUnit(quantity, unitUsed, conversions);
  const roundedAlt = Number.isInteger(altQty) ? altQty : Number(altQty.toFixed(2));
  return `${baseLabel} (${formatNumber(roundedAlt)} ${unitUsed})`;
}
