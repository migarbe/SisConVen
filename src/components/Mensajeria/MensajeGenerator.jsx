import { useState, useEffect } from 'react'
import { generarMensaje, getMensajesPorContexto, getMensajeByTipo, getContextoEjemplo } from '../../utils/mensajeService'
import { renderTemplate } from '../../utils/templateEngine'

export default function MensajeGenerator({
    clientes = [],
    facturas = [],
    productos = [],
    tasaCambio = 0,
    diasCredito = 7,
    onGenerarMensaje = null,
    onWhatsApp = null,
    tipoInicial = null,
    clienteInicial = null,
    facturaInicial = null,
    productoInicial = null,
    fechaEntregaInicial = null
}) {
    const [tipoMensaje, setTipoMensaje] = useState(tipoInicial || '')
    const [clienteSeleccionado, setClienteSeleccionado] = useState(clienteInicial || '')
    const [facturaSeleccionada, setFacturaSeleccionada] = useState(facturaInicial || '')
    const [productoSeleccionado, setProductoSeleccionado] = useState(productoInicial || '')
    const [fechaEntrega, setFechaEntrega] = useState(fechaEntregaInicial || '')
    const [mensajeGenerado, setMensajeGenerado] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('')
    const [whatsappValid, setWhatsappValid] = useState(true)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState('')
    const [contextoPersonalizado, setContextoPersonalizado] = useState(null)

    // Mensajes disponibles según el contexto
    const [mensajesDisponibles, setMensajesDisponibles] = useState([])

    useEffect(() => {
        // Determinar el contexto basado en los datos disponibles
        let contexto = 'general'
        if (facturaInicial) contexto = 'factura'
        else if (clienteInicial) contexto = 'cliente'
        else if (productoInicial) contexto = 'producto'

        const mensajes = getMensajesPorContexto(contexto === 'factura' ? 'factura' :
            contexto === 'cliente' ? 'cliente' :
                contexto === 'producto' ? 'producto' : 'general')
        setMensajesDisponibles(mensajes)

        // Si hay un tipo inicial, usarlo
        if (tipoInicial && mensajes.some(m => m.tipo === tipoInicial)) {
            setTipoMensaje(tipoInicial)
        }
    }, [tipoInicial, clienteInicial, facturaInicial, productoInicial])

    useEffect(() => {
        if (tipoMensaje) {
            generarMensajeAutomatico()
        }
    }, [tipoMensaje, clienteSeleccionado, facturaSeleccionada, productoSeleccionado, fechaEntrega, tasaCambio])

    const generarMensajeAutomatico = () => {
        setError('')
        setMensajeGenerado('')
        setWhatsappTo('')
        setWhatsappValid(true)
        setWhatsappNote('')

        if (!tipoMensaje) return

        // Obtener el mensaje por tipo o ID
        let mensaje = null
        if (tipoMensaje.includes('_')) {
            // Es un ID
            const mensajes = getMensajesPorContexto('general')
            mensaje = mensajes.find(m => m.id === tipoMensaje)
        } else {
            // Es un tipo
            mensaje = getMensajeByTipo(tipoMensaje)
        }

        if (!mensaje) {
            setError('Mensaje no encontrado')
            return
        }

        // Construir el contexto
        const context = construirContexto(mensaje)

        // Generar el mensaje
        const resultado = generarMensaje(mensaje.tipo, context)

        if (resultado.success) {
            setMensajeGenerado(resultado.mensaje.contenidoGenerado)
            setContextoPersonalizado(context)
        } else {
            setError(resultado.error)
        }
    }

    const construirContexto = (mensaje) => {
        const context = {}

        // Cliente
        if (mensaje.variables.some(v => v.includes('cliente.'))) {
            const clienteId = clienteSeleccionado || clienteInicial?.id || (clientes.length > 0 ? clientes[0].id : null)
            if (clienteId) {
                const cliente = clientes.find(c => c.id === clienteId)
                if (cliente) {
                    context.cliente = cliente
                    // Normalizar teléfono para WhatsApp
                    const { normalized, valid, note } = normalizePhoneVE(cliente.telefono || '')
                    setWhatsappTo(normalized)
                    setWhatsappValid(valid)
                    setWhatsappNote(note)
                }
            }
        }

        // Factura
        if (mensaje.variables.some(v => v.includes('factura.'))) {
            const facturaId = facturaSeleccionada || facturaInicial?.id
            if (facturaId) {
                const factura = facturas.find(f => f.id === facturaId)
                if (factura) {
                    context.factura = {
                        ...factura,
                        saldo_pendiente_usd: factura.saldo_pendiente_usd || factura.total_usd || 0,
                        total_usd: factura.total_usd || 0
                    }
                }
            }
        }

        // Producto
        if (mensaje.variables.some(v => v.includes('producto.'))) {
            const productoId = productoSeleccionado || productoInicial?.id || (productos.length > 0 ? productos[0].id : null)
            if (productoId) {
                const producto = productos.find(p => p.id === productoId)
                if (producto) {
                    context.producto = {
                        ...producto,
                        precio_credito: producto.precio_credito || (producto.precio_usd * 1.1)
                    }
                }
            }
        }

        // Fecha de entrega
        if (mensaje.variables.some(v => v.includes('fecha_entrega'))) {
            context.fecha_entrega = fechaEntrega || fechaEntregaInicial || new Date().toISOString().split('T')[0]
        }

        // Añadir días de crédito si se requiere
        if (typeof diasCredito !== 'undefined') {
            context.empresa = {
                ...(context.empresa || {}),
                dias_credito: diasCredito
            }
        }

        return context
    }

    const normalizePhoneVE = (phone) => {
        // Implementación simplificada de normalización de teléfono
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.length === 11 && cleaned.startsWith('04')) {
            return {
                normalized: '58' + cleaned.substring(1),
                valid: true,
                note: ''
            }
        } else if (cleaned.length === 10 && cleaned.startsWith('4')) {
            return {
                normalized: '58' + cleaned,
                valid: true,
                note: ''
            }
        } else {
            return {
                normalized: cleaned,
                valid: false,
                note: 'Teléfono no válido para WhatsApp'
            }
        }
    }

    const copiarWhatsApp = async () => {
        if (!mensajeGenerado) return
        try {
            await navigator.clipboard.writeText(mensajeGenerado)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            alert('No se pudo copiar al portapapeles. Copia manualmente el texto.')
        }
    }

    const abrirWhatsApp = () => {
        if (onWhatsApp) {
            onWhatsApp(mensajeGenerado, whatsappTo)
        } else {
            const url = whatsappTo
                ? `https://wa.me/${whatsappTo}?text=${encodeURIComponent(mensajeGenerado)}`
                : `https://wa.me/?text=${encodeURIComponent(mensajeGenerado)}`
            window.open(url, '_blank')
        }
    }

    const usarMensaje = () => {
        if (onGenerarMensaje) {
            onGenerarMensaje({
                tipo: tipoMensaje,
                contenido: mensajeGenerado,
                context: contextoPersonalizado,
                whatsappTo: whatsappTo,
                whatsappValid: whatsappValid
            })
        }
    }

    return (
        <div className="slide-up">
            <div className="card mb-4">
                <div className="card-header">
                    <h4 className="card-title">Generador de Mensajes</h4>
                    <p className="card-subtitle">Seleccione un mensaje y los datos para generar el contenido</p>
                </div>
                <div className="card-body">
                    <div className="grid grid-2" style={{ gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Tipo de Mensaje</label>
                            <select
                                className="form-input"
                                value={tipoMensaje}
                                onChange={(e) => setTipoMensaje(e.target.value)}
                            >
                                <option value="">Seleccionar tipo...</option>
                                {mensajesDisponibles.map(mensaje => (
                                    <option key={mensaje.id} value={mensaje.tipo}>
                                        {mensaje.nombre} ({mensaje.tipo})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {clientes.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select
                                    className="form-input"
                                    value={clienteSeleccionado}
                                    onChange={(e) => setClienteSeleccionado(e.target.value)}
                                >
                                    <option value="">Todos los clientes</option>
                                    {clientes.map(cliente => (
                                        <option key={cliente.id} value={cliente.id}>
                                            {cliente.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {facturas.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Factura</label>
                                <select
                                    className="form-input"
                                    value={facturaSeleccionada}
                                    onChange={(e) => setFacturaSeleccionada(e.target.value)}
                                >
                                    <option value="">Todas las facturas</option>
                                    {facturas.map(factura => (
                                        <option key={factura.id} value={factura.id}>
                                            #{factura.id} - {factura.cliente_nombre || 'Cliente'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {productos.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Producto</label>
                                <select
                                    className="form-input"
                                    value={productoSeleccionado}
                                    onChange={(e) => setProductoSeleccionado(e.target.value)}
                                >
                                    <option value="">Todos los productos</option>
                                    {productos.map(producto => (
                                        <option key={producto.id} value={producto.id}>
                                            {producto.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Fecha de Entrega</label>
                            <input
                                type="date"
                                className="form-input"
                                value={fechaEntrega}
                                onChange={(e) => setFechaEntrega(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="card mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    </div>
                </div>
            )}

            {mensajeGenerado && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h4 className="card-title">Mensaje Generado</h4>
                        {whatsappTo ? (
                            whatsappValid ? (
                                <p className="card-subtitle">Destino: +{whatsappTo} {whatsappNote && `— ${whatsappNote}`}</p>
                            ) : (
                                <p className="card-subtitle text-danger">Destino inválido: +{whatsappTo} {whatsappNote && `— ${whatsappNote}`}</p>
                            )
                        ) : (
                            <p className="card-subtitle">Destino no especificado</p>
                        )}
                    </div>
                    <div className="card-body">
                        <textarea
                            className="form-input"
                            rows={15}
                            readOnly
                            value={mensajeGenerado}
                            style={{ whiteSpace: 'pre-wrap' }}
                        />
                    </div>
                    <div className="card-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={copiarWhatsApp}>
                            {copied ? 'Copiado ✅' : 'Copiar'}
                        </button>
                        <button className="btn btn-primary" onClick={abrirWhatsApp}>
                            Abrir en WhatsApp
                        </button>
                        {onGenerarMensaje && (
                            <button className="btn btn-success" onClick={usarMensaje}>
                                Usar Mensaje
                            </button>
                        )}
                    </div>
                </div>
            )}

            {!tipoMensaje && (
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <div className="empty-state-icon">📝</div>
                            <h4>Seleccione un tipo de mensaje</h4>
                            <p className="text-muted">Elija un tipo de mensaje para comenzar a generar contenido</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}