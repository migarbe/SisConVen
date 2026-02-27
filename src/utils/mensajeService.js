/**
 * Servicio de Gestión de Mensajes
 * Sistema CRUD completo para administrar plantillas de mensajes
 */

import { renderTemplate, validateTemplate, getExampleContext } from './templateEngine'

/**
 * Estructura base de un mensaje
 */
const MENSAJE_SCHEMA = {
    id: '',
    nombre: '',
    tipo: '',
    contenido: '',
    variables: [],
    activo: true,
    fecha_creacion: '',
    fecha_actualizacion: ''
}

/**
 * Mensajes predefinidos para la migración
 */
const MENSAJES_PREDEFINIDOS = [
    {
        id: 'cobro',
        nombre: 'Recordatorio de Pago',
        tipo: 'cobro',
        contenido: `Hola {cliente.nombre}, reciba un cordial saludo,\n\nLe informamos sobre su deuda pendiente detallada a continuación:\n\n*Factura:* #{factura.id} — *Fecha:* {factura.fecha} — *Vence:* {factura.vencimiento}\n*Monto pendiente:* ${factura.saldo} USD\n\n*Total adeudado:* ${factura.total} USD\n\nPor favor, realice el pago antes de la fecha de vencimiento. Muchas gracias.`,
        variables: ['{cliente.nombre}', '{factura.id}', '{factura.fecha}', '{factura.vencimiento}', '{factura.saldo}', '{factura.total}'],
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    },
    {
        id: 'pedido',
        nombre: 'Catálogo de Productos',
        tipo: 'pedido',
        contenido: `Cordial saludo estimado {cliente.nombre},\n\nYa estamos recibiendo pedidos. A continuación, les presentamos nuestra lista de productos y precios disponibles para la venta:\n\nFecha de entrega estimada: {fecha_entrega}\n\n{producto.nombre}\n• Precio Contado: ${producto.precio} USD\n• Precio Crédito: ${producto.precio_credito} USD\n\n_El crédito es por 15 días_\n\nEstamos a su disposición para cualquier consulta o pedido. ¡Que tengan un excelente día!`,
        variables: ['{cliente.nombre}', '{fecha_entrega}', '{producto.nombre}', '{producto.precio}', '{producto.precio_credito}'],
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    },
    {
        id: 'agradecimiento',
        nombre: 'Agradecimiento por Pago',
        tipo: 'agradecimiento',
        contenido: `Hola {cliente.nombre}, reciba un cordial saludo,\n\nGracias por su preferencia y confianza en nuestros productos.\n\nReferencia: Factura #{factura.id} del {factura.fecha}. Agradecemos su pago.`,
        variables: ['{cliente.nombre}', '{factura.id}', '{factura.fecha}'],
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    },
    {
        id: 'detalles_pago',
        nombre: 'Instrucciones de Pago',
        tipo: 'detalles_pago',
        contenido: `Hola {cliente.nombre}, reciba un cordial saludo.\n\nAcá encontrará los detalles para realizar el pago:\n\n*Pago Movil*\n*Banco:* 0105 - Banco Mercantil C.A.\n*Teléfono:* (0422) 769-3572\n*C.I:* V-13097345\n\nPor favor confirme su pago enviando su comprobante de pago por este medio.`,
        variables: ['{cliente.nombre}'],
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    }
]

/**
 * Genera un ID único para mensajes
 */
function generateId() {
    return 'msg_' + Math.random().toString(36).substr(2, 9)
}

/**
 * Obtiene todos los mensajes desde localStorage
 */
export function getMensajes() {
    try {
        const saved = localStorage.getItem('mensajes')
        if (!saved) {
            // Si no hay mensajes guardados, crear los predefinidos
            const mensajes = MENSAJES_PREDEFINIDOS.map(m => ({ ...m, id: generateId() }))
            localStorage.setItem('mensajes', JSON.stringify(mensajes))
            return mensajes
        }
        return JSON.parse(saved)
    } catch (error) {
        console.error('Error al cargar mensajes:', error)
        return []
    }
}

/**
 * Guarda los mensajes en localStorage
 * @param {Array} mensajes - Lista de mensajes a guardar
 */
export function saveMensajes(mensajes) {
    try {
        localStorage.setItem('mensajes', JSON.stringify(mensajes))
        return true
    } catch (error) {
        console.error('Error al guardar mensajes:', error)
        return false
    }
}

/**
 * Crea un nuevo mensaje
 * @param {Object} mensajeData - Datos del mensaje a crear
 * @returns {Object} - Mensaje creado
 */
export function crearMensaje(mensajeData) {
    const validation = validateTemplate(mensajeData.contenido)

    if (!validation.isValid) {
        throw new Error('Plantilla inválida: ' + validation.errors.join(', '))
    }

    const nuevoMensaje = {
        ...MENSAJE_SCHEMA,
        id: generateId(),
        nombre: mensajeData.nombre.trim(),
        tipo: mensajeData.tipo.trim().toLowerCase(),
        contenido: mensajeData.contenido,
        variables: validation.variables,
        activo: true,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    }

    const mensajes = getMensajes()

    // Validar que el tipo no exista ya
    if (mensajes.some(m => m.tipo === nuevoMensaje.tipo)) {
        throw new Error('Ya existe un mensaje con este tipo')
    }

    mensajes.push(nuevoMensaje)

    if (saveMensajes(mensajes)) {
        return nuevoMensaje
    } else {
        throw new Error('No se pudo guardar el mensaje')
    }
}

/**
 * Actualiza un mensaje existente
 * @param {string} id - ID del mensaje a actualizar
 * @param {Object} mensajeData - Nuevos datos del mensaje
 * @returns {Object} - Mensaje actualizado
 */
export function actualizarMensaje(id, mensajeData) {
    const mensajes = getMensajes()
    const index = mensajes.findIndex(m => m.id === id)

    if (index === -1) {
        throw new Error('Mensaje no encontrado')
    }

    const validation = validateTemplate(mensajeData.contenido)

    if (!validation.isValid) {
        throw new Error('Plantilla inválida: ' + validation.errors.join(', '))
    }

    // Validar que el tipo no esté duplicado (excepto el mismo mensaje)
    const tipoExiste = mensajes.some((m, i) => m.tipo === mensajeData.tipo && i !== index)
    if (tipoExiste) {
        throw new Error('Ya existe un mensaje con este tipo')
    }

    const mensajeActualizado = {
        ...mensajes[index],
        nombre: mensajeData.nombre.trim(),
        tipo: mensajeData.tipo.trim().toLowerCase(),
        contenido: mensajeData.contenido,
        variables: validation.variables,
        fecha_actualizacion: new Date().toISOString()
    }

    mensajes[index] = mensajeActualizado

    if (saveMensajes(mensajes)) {
        return mensajeActualizado
    } else {
        throw new Error('No se pudo actualizar el mensaje')
    }
}

/**
 * Elimina un mensaje
 * @param {string} id - ID del mensaje a eliminar
 * @returns {boolean} - True si se eliminó correctamente
 */
export function eliminarMensaje(id) {
    const mensajes = getMensajes()
    const index = mensajes.findIndex(m => m.id === id)

    if (index === -1) {
        throw new Error('Mensaje no encontrado')
    }

    // No permitir eliminar mensajes predefinidos
    const mensaje = mensajes[index]
    if (MENSAJES_PREDEFINIDOS.some(p => p.tipo === mensaje.tipo)) {
        throw new Error('No se pueden eliminar mensajes predefinidos')
    }

    mensajes.splice(index, 1)

    return saveMensajes(mensajes)
}

/**
 * Obtiene un mensaje por su ID
 * @param {string} id - ID del mensaje
 * @returns {Object|null} - Mensaje encontrado o null
 */
export function getMensajeById(id) {
    const mensajes = getMensajes()
    return mensajes.find(m => m.id === id) || null
}

/**
 * Obtiene un mensaje por su tipo
 * @param {string} tipo - Tipo del mensaje
 * @returns {Object|null} - Mensaje encontrado o null
 */
export function getMensajeByTipo(tipo) {
    const mensajes = getMensajes()
    return mensajes.find(m => m.tipo === tipo) || null
}

/**
 * Obtiene mensajes activos por tipo de contexto
 * @param {string} contextType - Tipo de contexto (cliente, factura, producto, etc.)
 * @returns {Array} - Mensajes que contienen variables del contexto especificado
 */
export function getMensajesPorContexto(contextType) {
    const mensajes = getMensajes()
    return mensajes.filter(m =>
        m.activo &&
        m.variables.some(v => v.includes(contextType + '.'))
    )
}

/**
 * Genera un mensaje usando una plantilla y un contexto
 * @param {string} tipo - Tipo de mensaje o ID del mensaje
 * @param {Object} context - Contexto con los valores a reemplazar
 * @returns {Object} - Resultado de la generación
 */
export function generarMensaje(tipo, context = {}) {
    let mensaje = null

    // Buscar por tipo o por ID
    if (tipo.includes('_')) {
        mensaje = getMensajeById(tipo)
    } else {
        mensaje = getMensajeByTipo(tipo)
    }

    if (!mensaje) {
        throw new Error('Mensaje no encontrado')
    }

    if (!mensaje.activo) {
        throw new Error('El mensaje está desactivado')
    }

    try {
        const contenidoGenerado = renderTemplate(mensaje.contenido, context)

        return {
            success: true,
            mensaje: {
                ...mensaje,
                contenidoGenerado
            },
            context,
            variables: mensaje.variables
        }
    } catch (error) {
        return {
            success: false,
            error: error.message,
            mensaje,
            context,
            variables: mensaje.variables
        }
    }
}

/**
 * Obtiene estadísticas de los mensajes
 * @returns {Object} - Estadísticas de los mensajes
 */
export function getEstadisticasMensajes() {
    const mensajes = getMensajes()

    return {
        total: mensajes.length,
        activos: mensajes.filter(m => m.activo).length,
        inactivos: mensajes.filter(m => !m.activo).length,
        conErrores: mensajes.filter(m => {
            const validation = validateTemplate(m.contenido)
            return !validation.isValid
        }).length,
        tipos: [...new Set(mensajes.map(m => m.tipo))],
        variablesUsadas: [...new Set(mensajes.flatMap(m => m.variables))]
    }
}

/**
 * Exporta los mensajes a JSON
 * @returns {string} - JSON string de los mensajes
 */
export function exportarMensajes() {
    const mensajes = getMensajes()
    return JSON.stringify(mensajes, null, 2)
}

/**
 * Importa mensajes desde JSON
 * @param {string} jsonStr - JSON string de los mensajes
 * @returns {boolean} - True si la importación fue exitosa
 */
export function importarMensajes(jsonStr) {
    try {
        const nuevosMensajes = JSON.parse(jsonStr)

        if (!Array.isArray(nuevosMensajes)) {
            throw new Error('El formato JSON no es válido')
        }

        // Validar cada mensaje
        for (const mensaje of nuevosMensajes) {
            const validation = validateTemplate(mensaje.contenido)
            if (!validation.isValid) {
                throw new Error(`Mensaje "${mensaje.nombre}" tiene una plantilla inválida`)
            }
        }

        // Generar nuevos IDs para evitar conflictos
        const mensajesConNuevosIds = nuevosMensajes.map(m => ({
            ...m,
            id: generateId(),
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        }))

        const mensajesExistentes = getMensajes()
        const todosLosMensajes = [...mensajesExistentes, ...mensajesConNuevosIds]

        return saveMensajes(todosLosMensajes)
    } catch (error) {
        console.error('Error al importar mensajes:', error)
        throw error
    }
}

/**
 * Restablece los mensajes predefinidos
 * @returns {boolean} - True si se restablecieron correctamente
 */
export function restablecerMensajesPredefinidos() {
    try {
        const mensajesActuales = getMensajes()
        const mensajesPersonalizados = mensajesActuales.filter(m =>
            !MENSAJES_PREDEFINIDOS.some(p => p.tipo === m.tipo)
        )

        const nuevosPredefinidos = MENSAJES_PREDEFINIDOS.map(m => ({
            ...m,
            id: generateId(),
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        }))

        const todosLosMensajes = [...mensajesPersonalizados, ...nuevosPredefinidos]

        return saveMensajes(todosLosMensajes)
    } catch (error) {
        console.error('Error al restablecer mensajes predefinidos:', error)
        return false
    }
}

/**
 * Obtiene un contexto de ejemplo para pruebas
 * @returns {Object} - Contexto de ejemplo
 */
export function getContextoEjemplo() {
    return getExampleContext()
}