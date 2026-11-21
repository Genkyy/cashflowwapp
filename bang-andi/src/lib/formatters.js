import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { id } from 'date-fns/locale';

function toDate(date) {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (isValid(parsed)) return parsed;
    const d = new Date(date);
    if (isValid(d)) return d;
  }
  const d = new Date(date);
  return isValid(d) ? d : new Date();
}

/**
 * Format number to Indonesian Currency: "Rp 1.234.567"
 * @param {number|string} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Math.round(Number(amount) || 0);
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(abs);
  return `${isNegative ? '-' : ''}Rp ${formatted}`;
}

/**
 * Format number in Indonesian locale
 * @param {number|string} num
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(num, decimals = 0) {
  const val = Number(num) || 0;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

/**
 * Format date to short, full, or iso string
 * @param {Date|string|number} date
 * @param {'short'|'full'|'iso'} formatType
 * @returns {string}
 */
export function formatDate(date, formatType = 'short') {
  const d = toDate(date);
  if (formatType === 'full') {
    return format(d, 'EEEE, d MMMM yyyy', { locale: id });
  }
  if (formatType === 'iso') {
    return format(d, 'yyyy-MM-dd');
  }
  return format(d, 'd MMM yyyy', { locale: id });
}

/**
 * Format datetime: "20 Nov 2026 14:30"
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDatetime(date) {
  const d = toDate(date);
  return format(d, 'd MMM yyyy HH:mm', { locale: id });
}

/**
 * Format phone number to Indonesian format: "0812-3456-7890"
 * @param {string} phone
 * @returns {string}
 */
export function formatPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  }
  if (!digits.startsWith('0') && digits.length >= 9) {
    digits = '0' + digits;
  }

  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 13)}`;
}

/**
 * Generate WhatsApp Click-to-chat URL
 * @param {string} phone
 * @param {string} message
 * @returns {string}
 */
export function formatWaLink(phone, message = '') {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (!digits.startsWith('62')) {
    digits = '62' + digits;
  }
  const baseUrl = `https://wa.me/${digits}`;
  if (!message) return baseUrl;
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

/**
 * Removes currency symbols and formatting, returns integer/float number
 * @param {string|number} str
 * @returns {number}
 */
export function parseCurrencyInput(str) {
  if (typeof str === 'number') return Math.round(str);
  if (!str) return 0;
  const isNegative = String(str).includes('-');
  const cleaned = String(str).replace(/[^\d]/g, '');
  const val = Number(cleaned) || 0;
  return isNegative ? -val : val;
}

/**
 * Format date relatively: "Hari ini", "Kemarin", "3 hari lalu", etc.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatRelativeDate(date) {
  const target = toDate(date);
  const now = new Date();
  const diffDays = differenceInCalendarDays(now, target);

  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays > 1 && diffDays < 30) return `${diffDays} hari lalu`;
  if (diffDays === -1) return 'Besok';
  if (diffDays < -1 && diffDays > -30) return `${Math.abs(diffDays)} hari lagi`;
  return formatDate(target, 'short');
}
