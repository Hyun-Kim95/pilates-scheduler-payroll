/**
 * 로컬 날짜 YYYY-MM-DD (타임존 오프셋 사용으로 UTC/로컬 혼동 방지)
 */
export function toLocalDateString(d) {
  const x = d instanceof Date ? d : new Date();
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function toLocalYearMonthString(d) {
  const x = d instanceof Date ? d : new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
