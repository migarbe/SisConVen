/**
 * Motor de Plantillas para Mensajes
 * Sistema de reemplazo de variables dinámicas en mensajes
 */

/**
 * Variables disponibles para reemplazo en mensajes
 */
export const VARIABLES = {
    // Cliente
    'cliente.nombre': 'Nombre del cliente',
    'cliente.telefono': 'Teléfono del cliente',
    'cliente.direccion': 'Dirección del cliente',
    'cliente.email': 'Correo del cliente',

    // Factura
    'factura.id': 'Número de factura',
    'factura.fecha': 'Fecha de emisión',
    'factura.vencimiento': 'Fecha de vencimiento',
    'factura.saldo': 'Saldo pendiente',
    'factura.total': 'Monto total',
    'factura.detalles': 'Detalles de la factura',

    // Producto
    'producto.nombre': 'Nombre del producto',
    'producto.precio': 'Precio del producto',
    'producto.cantidad': 'Cantidad disponible',
    'producto.precio_credito': 'Precio de crédito',

    // Empresa
    'empresa.nombre': 'Nombre de la empresa',
    'empresa.telefono': 'Teléfono de contacto',
    'empresa.banco': 'Datos bancarios',
    'empresa.direccion': 'Dirección de la empresa',
    'empresa.dias_credito': 'Días de crédito',

    // Fechas
    'fecha_actual': 'Fecha actual',
    'fecha_entrega': 'Fecha de entrega programada'
}

/**
 * Configuración de la empresa (puede ser cargada desde localStorage o configuración)
 */
const EMPRESA_CONFIG = {
    nombre: 'SISCONVEN 2026',
    telefono: '(0422) 769-3572',
    banco: '0105 - Banco Mercantil C.A.',
    direccion: 'Dirección Comercial',
    dias_credito: 7
}

/**
 * Reemplaza variables en una plantilla con valores reales
 * @param {string} template - Plantilla con variables
 * @param {Object} context - Contexto con los valores a reemplazar
 * @returns {string} - Mensaje con variables reemplazadas
 */
export function renderTemplate(template, context = {}) {
    if (!template || typeof template !== 'string') {
        return template || ''
    }

    let result = template

    // Cliente variables
    if (context.cliente) {
        result = result.replace(/{cliente\.nombre}/g, context.cliente.nombre || '')
        result = result.replace(/{cliente\.telefono}/g, context.cliente.telefono || '')
        result = result.replace(/{cliente\.direccion}/g, context.cliente.direccion || '')
        result = result.replace(/{cliente\.email}/g, context.cliente.email || '')
    }

    // Factura variables
    if (context.factura) {
        result = result.replace(/{factura\.id}/g, context.factura.id || '')
        result = result.replace(/{factura\.fecha}/g, formatDate(context.factura.fecha))
        // calcular vencimiento usando los días de crédito si están disponibles
        const vencDays = (context.empresa && context.empresa.dias_credito) ? context.empresa.dias_credito : 7
        result = result.replace(/{factura\.vencimiento}/g, formatDate(getVencimiento(context.factura.fecha, vencDays)))
        result = result.replace(/{factura\.saldo}/g, formatCurrency(context.factura.saldo_pendiente_usd || 0))
        result = result.replace(/{factura\.total}/g, formatCurrency(context.factura.total_usd || 0))
        result = result.replace(/{factura\.detalles}/g, getFacturaDetalles(context.factura))
    }

    // Producto variables
    if (context.producto) {
        result = result.replace(/{producto\.nombre}/g, context.producto.nombre || '')
        result = result.replace(/{producto\.precio}/g, formatCurrency(context.producto.precio_usd || 0))
        result = result.replace(/{producto\.cantidad}/g, formatKg(context.producto.cantidad_kg || 0))
        result = result.replace(/{producto\.precio_credito}/g, formatCurrency(context.producto.precio_credito || 0))
    }

    // Empresa variables
    result = result.replace(/{empresa\.nombre}/g, EMPRESA_CONFIG.nombre)
    result = result.replace(/{empresa\.telefono}/g, EMPRESA_CONFIG.telefono)
    result = result.replace(/{empresa\.banco}/g, EMPRESA_CONFIG.banco)
    result = result.replace(/{empresa\.direccion}/g, EMPRESA_CONFIG.direccion)
    // Días de crédito: puede venir desde el contexto o del config global
    if (context.empresa && context.empresa.dias_credito !== undefined) {
        result = result.replace(/{empresa\.dias_credito}/g, context.empresa.dias_credito)
    } else {
        result = result.replace(/{empresa\.dias_credito}/g, EMPRESA_CONFIG.dias_credito || '')
    }

    // Fechas
    result = result.replace(/{fecha_actual}/g, formatDate(new Date()))
    if (context.fecha_entrega) {
        result = result.replace(/{fecha_entrega}/g, formatDate(context.fecha_entrega))
    } else {
        result = result.replace(/{fecha_entrega}/g, formatDate(new Date()))
    }

    return result
}

/**
 * Obtiene los detalles de una factura para incluir en el mensaje
 * @param {Object} factura - Objeto factura
 * @returns {string} - Detalles formateados de la factura
 */
function getFacturaDetalles(factura) {
    if (!factura || !factura.detalles || factura.detalles.length === 0) {
        return ''
    }

    return factura.detalles.map(detalle => {
        return `${detalle.cantidad} x ${detalle.producto_nombre} = $${formatCurrency(detalle.subtotal_usd)}`
    }).join('\n')
}

/**
 * Obtiene la fecha de vencimiento (por defecto 7 días después de la fecha de emisión, puede pasarse un número de días)
 * @param {string|Date} fechaEmision - Fecha de emisión
 * @param {number} [dias=7] - Días de crédito a sumar
 * @returns {Date} - Fecha de vencimiento
 */
function getVencimiento(fechaEmision, dias = 7) {
    const fecha = new Date(fechaEmision)
    fecha.setDate(fecha.getDate() + dias)
    return fecha
}

/**
 * Formatea una fecha en formato DD/MM/YYYY
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
    if (!date) return ''

    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
}

/**
 * Formatea un monto en dólares con 2 decimales
 * @param {number} amount - Monto a formatear
 * @returns {string} - Monto formateado
 */
function formatCurrency(amount) {
    const n = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formatea una cantidad en kilogramos
 * @param {number} amount - Cantidad a formatear
 * @returns {string} - Cantidad formateada
 */
function formatKg(amount) {
    const n = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    if (Number.isInteger(n)) {
        return n.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    }
    let s = n.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    s = s.replace(/0+$/, '').replace(/,$/, '')
    return s
}

/**
 * Valida si una plantilla contiene variables válidas
 * @param {string} template - Plantilla a validar
 * @returns {Object} - Resultado de validación
 */
export function validateTemplate(template) {
    const errors = []
    const warnings = []

    if (!template || template.trim() === '') {
        errors.push('La plantilla no puede estar vacía')
        return { isValid: false, errors, warnings }
    }

    // Buscar variables en la plantilla
    const variableMatches = template.match(/{[^}]+}/g) || []

    variableMatches.forEach(variable => {
        if (!VARIABLES[variable.slice(1, -1)]) {
            warnings.push(`Variable desconocida: ${variable}`)
        }
    })

    // Validaciones específicas por tipo de mensaje
    if (template.includes('{factura.')) {
        if (!template.includes('{factura.id}')) {
            warnings.push('Se recomienda incluir el número de factura ({factura.id})')
        }
        if (!template.includes('{factura.saldo}')) {
            warnings.push('Se recomienda incluir el saldo pendiente ({factura.saldo})')
        }
    }

    if (template.includes('{cliente.')) {
        if (!template.includes('{cliente.nombre}')) {
            warnings.push('Se recomienda incluir el nombre del cliente ({cliente.nombre})')
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        variables: variableMatches
    }
}

/**
 * Obtiene una lista de variables disponibles para un tipo de contexto
 * @param {string} contextType - Tipo de contexto (cliente, factura, producto, etc.)
 * @returns {Array} - Lista de variables disponibles
 */
export function getVariablesForContext(contextType) {
    return Object.entries(VARIABLES)
        .filter(([key]) => key.startsWith(contextType + '.'))
        .map(([key, description]) => ({ key, description }))
}

/**
 * Genera un contexto de ejemplo para pruebas
 * @returns {Object} - Contexto de ejemplo
 */
export function getExampleContext() {
    return {
        cliente: {
            nombre: 'Juan Pérez',
            telefono: '0414-1234567',
            direccion: 'Caracas, Venezuela',
            email: 'juan.perez@email.com'
        },
        factura: {
            id: 'F-001',
            fecha: '2026-02-15',
            saldo_pendiente_usd: 150.50,
            total_usd: 200.00,
            detalles: [
                { cantidad: 2, producto_nombre: 'Queso Blanco', subtotal_usd: 11.60 },
                { cantidad: 1, producto_nombre: 'Mantequilla', subtotal_usd: 11.00 }
            ]
        },
        producto: {
            nombre: 'Queso Blanco',
            precio_usd: 5.80,
            cantidad_kg: 50,
            precio_credito: 6.38
        },
        fecha_entrega: '2026-02-20',
        empresa: {
            dias_credito: 7
        }
    }
}