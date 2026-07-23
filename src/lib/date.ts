// Central date display formatting — always day/month/year ordering, never m/d/y.
// Machine formats (ISO yyyy-mm-dd for <input type="date">, query params, filenames)
// are intentionally NOT routed through here.

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

const WEEKDAYS_AR = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
]

function toDate(input: Date | string): Date {
  return typeof input === "string" ? new Date(input) : input
}

/** Numeric day/month/year, e.g. "23/07/2026". */
export function formatDate(input: Date | string | null | undefined): string {
  if (!input) return "—"
  const d = toDate(input)
  if (isNaN(d.getTime())) return "—"
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${d.getFullYear()}`
}

/** "23 يوليو 2026" */
export function formatDateLong(input: Date | string | null | undefined): string {
  if (!input) return "—"
  const d = toDate(input)
  if (isNaN(d.getTime())) return "—"
  return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`
}

/** "الخميس، 23 يوليو 2026" */
export function formatDateWithWeekday(input: Date | string | null | undefined): string {
  if (!input) return "—"
  const d = toDate(input)
  if (isNaN(d.getTime())) return "—"
  return `${WEEKDAYS_AR[d.getDay()]}، ${formatDateLong(d)}`
}

/** "يوليو 2026" */
export function formatMonthYear(input: Date | string): string {
  const d = toDate(input)
  return `${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`
}

/** "23/07/2026 - 15:04" */
export function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) return "—"
  const d = toDate(input)
  if (isNaN(d.getTime())) return "—"
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${formatDate(d)} - ${hours}:${minutes}`
}
