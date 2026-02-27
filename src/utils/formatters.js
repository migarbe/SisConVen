// Función para formatear montos en bolívares con separadores de miles
export const formatBs = (amount) => {
    const formatted = parseFloat(amount).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    return `Bs. ${formatted}`
}

// Función para formatear montos en dólares con separadores de miles
export const formatUSD = (amount) => {
    const formatted = parseFloat(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    return `$${formatted}`
}

// Normaliza y valida teléfonos para uso en https://wa.me/<telefono>
// Devuelve { normalized, valid, note }
export const normalizePhoneVE = (raw) => {
    const digits = (raw || '').replace(/\D/g, '')
    if (!digits) return { normalized: '', valid: false, note: '' }

    // Remover ceros a la izquierda
    let d = digits.replace(/^0+/, '')
    let addedPrefix = false

    // Si no tiene prefijo de país (58), intentar agregarlo si parece un número local
    if (!d.startsWith('58')) {
        if (d.length >= 7 && d.length <= 11) {
            d = '58' + d
            addedPrefix = true
        }
    }

    const valid = d.startsWith('58') && d.length >= 11 && d.length <= 15
    let note = ''
    if (addedPrefix) note = 'Se añadió prefijo de país +58'
    if (!valid) note = note ? `${note}; Número posiblemente inválido` : 'Número posiblemente inválido'

    return { normalized: d, valid, note }
}

// Formatea un teléfono para mostrarlo visualmente como "+58 ### ### ####" cuando es posible
export const formatPhoneForDisplay = (raw) => {
    const { normalized } = normalizePhoneVE(raw)
    if (!normalized) return ''

    // Si tiene prefijo 58, formatear en grupos 3-3-4 para los 10 dígitos restantes
    if (normalized.startsWith('58')) {
        const rest = normalized.slice(2)
        const g1 = rest.slice(0, 3)
        const g2 = rest.slice(3, 6)
        const g3 = rest.slice(6, 10)
        const groups = [g1, g2, g3].filter(Boolean)
        return `+58 ${groups.join(' ').trim()}`
    }

    // Fallback: agrupar en bloques de 3
    const parts = normalized.match(/.{1,3}/g) || []
    return `+${parts.join(' ')}`
}
