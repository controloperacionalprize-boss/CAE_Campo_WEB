export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function formatFechaLarga(d = new Date()) {
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function isValidDni(value: string) {
  return /^\d{8}$/.test(value.trim())
}

export function isValidRuc(value: string) {
  return /^\d{11}$/.test(value.trim())
}

export function paginate<T>(items: T[], skip: number, limit: number) {
  return {
    items: items.slice(skip, skip + limit),
    total: items.length,
    skip,
    limit,
  }
}
