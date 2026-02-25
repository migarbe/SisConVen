import { useState, useEffect } from 'react'
import { normalizePhoneVE } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Vendedores({ vendedores, setVendedores, productos, facturas, tasaCambio, vendedorADetalle, setVendedorADetalle }) {
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [editando, setEditando] = useState(null)
    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        email: '',
        cedula: '',
        banco: ''
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' })

    // Estado para gestionar la navegación de vistas
    const [vistaActiva, setVistaActiva] = useState('lista') // 'lista', 'comisiones', 'detalle'
    const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null)
    const [comisionesTemp, setComisionesTemp] = useState({})

    // Efecto para abrir directamente el detalle de comisiones de un vendedor (usado desde Dashboard)
    useEffect(() => {
        if (vendedorADetalle) {
            verDetalleComisiones(vendedorADetalle)
            setVendedorADetalle(null)
        }
    }, [vendedorADetalle, setVendedorADetalle])

    // Estados para procesos de pago y WhatsApp
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('')
    const [whatsappValid, setWhatsappValid] = useState(false)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)
    const [procesandoPago, setProcesandoPago] = useState(null)
    const [referenciaPago, setReferenciaPago] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()

        if (editando) {
            setVendedores(vendedores.map(v =>
                v.id === editando.id ? {
                    ...v,
                    ...formData,
                    id: editando.id
                } : v
            ))
            setEditando(null)
        } else {
            const nuevoVendedor = {
                id: Date.now(),
                nombre: formData.nombre,
                telefono: formData.telefono,
                email: formData.email,
                cedula: formData.cedula,
                banco: formData.banco,
                comisiones: {} // { producto_id: { tipo: 'porcentaje' | 'monto', valor: number } }
            }
            setVendedores([...vendedores, nuevoVendedor])
        }

        setFormData({ nombre: '', telefono: '', email: '', cedula: '', banco: '' })
        setMostrarFormulario(false)
    }

    const handleEditar = (vendedor) => {
        setFormData({
            nombre: vendedor.nombre,
            telefono: vendedor.telefono || '',
            email: vendedor.email || '',
            cedula: vendedor.cedula || '',
            banco: vendedor.banco || ''
        })
        setEditando(vendedor)
        setMostrarFormulario(true)
    }

    const handleEliminar = (id) => {
        if (confirm('¿Estás seguro de eliminar este vendedor?')) {
            setVendedores(vendedores.filter(v => v.id !== id))
        }
    }

    const handleCancelar = () => {
        setFormData({ nombre: '', telefono: '', email: '', cedula: '', banco: '' })
        setEditando(null)
        setMostrarFormulario(false)
    }

    const abrirGestionComisiones = (vendedor) => {
        setVendedorSeleccionado(vendedor)
        // Inicializar comisiones temporales con las existentes
        setComisionesTemp({ ...(vendedor.comisiones || {}) })
        setVistaActiva('comisiones')
    }

    const actualizarComision = (productoId, tipo, valor) => {
        setComisionesTemp({
            ...comisionesTemp,
            [productoId]: { tipo, valor: parseFloat(valor) || 0 }
        })
    }

    const eliminarComision = (productoId) => {
        const nuevasComisiones = { ...comisionesTemp }
        delete nuevasComisiones[productoId]
        setComisionesTemp(nuevasComisiones)
    }

    const guardarComisiones = () => {
        setVendedores(vendedores.map(v =>
            v.id === vendedorSeleccionado.id ? {
                ...v,
                comisiones: comisionesTemp
            } : v
        ))
        setVistaActiva('lista')
        setVendedorSeleccionado(null)
        setComisionesTemp({})
    }

    const cancelarComisiones = () => {
        setVistaActiva('lista')
        setVendedorSeleccionado(null)
        setComisionesTemp({})
    }

    const calcularComisionesVendedor = (vendedorId) => {
        if (!facturas || facturas.length === 0) {
            return { total: 0, facturas: [] }
        }

        const vendedor = vendedores.find(v => v.id.toString() === vendedorId.toString())
        const facturasVendedor = facturas.filter(f => f.vendedor_id?.toString() === vendedorId.toString() && f.comisiones_total > 0)

        // Calcular total de comisiones pagadas
        const totalPagado = parseFloat((vendedor?.pagos_comisiones || []).reduce((sum, pago) => sum + pago.monto_usd, 0).toFixed(2))

        // Calcular total de comisiones generadas
        const totalGenerado = parseFloat(facturasVendedor.reduce((sum, f) => sum + (f.comisiones_total || 0), 0).toFixed(2))

        // Total pendiente = generado - pagado
        const totalPendiente = parseFloat(Math.max(0, totalGenerado - totalPagado).toFixed(2))

        return {
            total: totalPendiente,
            totalGenerado,
            totalPagado,
            facturas: facturasVendedor
        }
    }

    const verDetalleComisiones = (vendedor) => {
        setVendedorSeleccionado(vendedor)
        setVistaActiva('detalle')
    }

    const formatDateDDMMYYYY = (date) => {
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    const formatBs = (value) => {
        const formatted = value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return `Bs. ${formatted}`
    }

    const copyToClipboard = async (text, fieldName) => {
        try {
            await navigator.clipboard.writeText(text)
            alert(`✅ ${fieldName} copiado`)
        } catch (err) {
            console.error('Error al copiar:', err)
        }
    }

    const pagarComisiones = (vendedor) => {
        const comisionesData = calcularComisionesVendedor(vendedor.id)

        if (comisionesData.total <= 0) {
            alert('No hay comisiones pendientes para pagar')
            return
        }

        // En lugar de confirmar directamente, abrimos el modal de Pago Móvil
        setProcesandoPago({
            vendedor,
            monto_usd: comisionesData.total,
            monto_bs: comisionesData.total * tasaCambio,
            comisionesData
        })
        setReferenciaPago('')
    }

    const finalizarPagoComisiones = () => {
        if (!referenciaPago.trim()) {
            alert('Por favor, ingresa el número de confirmación / referencia bancaria')
            return
        }

        const { vendedor, monto_usd, monto_bs, comisionesData } = procesandoPago

        // Registrar pago
        const pago = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            monto_usd,
            tasa_cambio: tasaCambio,
            monto_bs,
            referencia: referenciaPago,
            facturas: comisionesData.facturas.map(f => ({
                id: f.id,
                comision: f.comisiones_total,
                detalle: f.comisiones_detalle
            }))
        }

        // Actualizar vendedor con el pago
        const vendedorActualizado = {
            ...vendedor,
            pagos_comisiones: [...(vendedor.pagos_comisiones || []), pago]
        }

        setVendedores(vendedores.map(v => v.id === vendedor.id ? vendedorActualizado : v))

        // Generar mensaje de WhatsApp
        generarMensajePago(vendedor, pago, comisionesData)

        // Limpiar estado
        setProcesandoPago(null)
        setReferenciaPago('')

        alert('✅ Pago registrado y mensaje de WhatsApp generado')
    }

    const generarMensajePago = (vendedor, pago, comisionesData) => {
        const fechaPago = formatDateDDMMYYYY(pago.fecha)

        // Agrupar comisiones por producto
        const productosTotales = {}
        comisionesData.facturas.forEach(factura => {
            factura.comisiones_detalle?.forEach(det => {
                if (!productosTotales[det.nombre]) {
                    productosTotales[det.nombre] = 0
                }
                productosTotales[det.nombre] += det.comision
            })
        })

        const resumenProductos = Object.entries(productosTotales)
            .map(([nombre, total]) => `  • ${nombre}: $${total.toFixed(2)} USD`)
            .join('\n')

        const mensaje = `*Pago de Comisiones*\n\n` +
            `Hola ${vendedor.nombre}, se ha procesado el pago de tus comisiones:\n\n` +
            `*Fecha:* ${fechaPago}\n` +
            `*Facturas procesadas:* ${comisionesData.facturas.length}\n\n` +
            `*Resumen por producto:*\n${resumenProductos}\n\n` +
            `*Total en USD:* $${pago.monto_usd.toFixed(2)}\n` +
            `*Tasa de cambio:* ${pago.tasa_cambio.toFixed(2)} Bs/USD\n` +
            `*Total en Bolívares:* ${formatBs(pago.monto_bs)}\n\n` +
            `*Referencia bancaria:* ${pago.referencia}\n\n` +
            `*Datos para Pago Móvil:*\n` +
            `• Teléfono: ${vendedor.telefono || 'N/A'}\n` +
            `• Cédula: ${vendedor.cedula || 'N/A'}\n` +
            `• Banco: ${vendedor.banco || 'N/A'}\n\n` +
            `Gracias por tu trabajo. ¡Sigue así!`

        const telefonoRaw = vendedor?.telefono || ''
        const { normalized, valid, note } = normalizePhoneVE(telefonoRaw)

        setWhatsappTo(normalized)
        setWhatsappValid(valid)
        setWhatsappNote(note)
        setWhatsappMessage(mensaje)
    }

    const copiarWhatsApp = async () => {
        if (!whatsappMessage) return
        try {
            await navigator.clipboard.writeText(whatsappMessage)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            alert('No se pudo copiar al portapapeles')
        }
    }

    const calcularComisionTotal = (vendedor) => {
        if (!vendedor.comisiones) return 0
        let total = 0
        Object.entries(vendedor.comisiones).forEach(([productoId, config]) => {
            const producto = productos.find(p => p.id === parseInt(productoId))
            if (producto && config.tipo === 'monto') {
                total += config.valor
            }
        })
        return total
    }

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const SortIndicator = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '5px' }}>↕️</span>
        return <span style={{ marginLeft: '5px' }}>{sortConfig.direction === 'asc' ? '🔼' : '🔽'}</span>
    }

    const vendedoresFiltradosYOrdenados = [...vendedores]
        .filter(v => {
            const search = searchTerm.toLowerCase()
            return (
                v.nombre.toLowerCase().includes(search) ||
                (v.cedula || '').toLowerCase().includes(search) ||
                (v.telefono || '').toLowerCase().includes(search)
            )
        })
        .sort((a, b) => {
            let valA = a[sortConfig.key] || ''
            let valB = b[sortConfig.key] || ''

            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })

    let vistaContenido;

    if (vistaActiva === 'comisiones' && vendedorSeleccionado) {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={cancelarComisiones}>
                            ← Volver a la Lista
                        </button>
                        <h1 className="page-title">Configurar Comisiones</h1>
                        <p className="page-subtitle">Gestionando comisiones para <strong>{vendedorSeleccionado.nombre}</strong></p>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Productos y Comisiones</h3>
                        <p className="card-subtitle">Configura el porcentaje o monto fijo que recibe el vendedor por cada producto</p>
                    </div>
                    <div className="card-body">
                        {productos.length === 0 ? (
                            <div className="empty-state">
                                <p className="text-muted">No hay productos registrados para asignar comisiones.</p>
                            </div>
                        ) : (
                            <div className="grid grid-1 flex-gap">
                                {productos.map((producto) => {
                                    const comision = comisionesTemp[producto.id]
                                    const tieneComision = !!comision

                                    return (
                                        <div key={producto.id} className="card border p-3 hover-shadow transition">
                                            <div className="flex-between mb-3">
                                                <div>
                                                    <h4 style={{ margin: 0 }}>{producto.nombre}</h4>
                                                    <p className="text-small text-muted">
                                                        Precio: ${producto.precio_usd.toFixed(2)} USD
                                                    </p>
                                                </div>
                                                {tieneComision && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => eliminarComision(producto.id)}
                                                    >
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-2 flex-gap">
                                                <div className="form-group mb-0">
                                                    <label className="form-label">Tipo de comisión</label>
                                                    <select
                                                        className="form-input"
                                                        value={comision?.tipo || 'porcentaje'}
                                                        onChange={(e) => actualizarComision(
                                                            producto.id,
                                                            e.target.value,
                                                            comision?.valor || 0
                                                        )}
                                                    >
                                                        <option value="porcentaje">Porcentaje (%)</option>
                                                        <option value="monto">Monto fijo (USD)</option>
                                                    </select>
                                                </div>

                                                <div className="form-group mb-0">
                                                    <label className="form-label">
                                                        {comision?.tipo === 'monto' ? 'Monto (USD)' : 'Porcentaje (%)'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max={comision?.tipo === 'porcentaje' ? '100' : undefined}
                                                        className="form-input"
                                                        value={comision?.valor || ''}
                                                        onChange={(e) => actualizarComision(
                                                            producto.id,
                                                            comision?.tipo || 'porcentaje',
                                                            e.target.value
                                                        )}
                                                        placeholder={comision?.tipo === 'monto' ? '0.00' : '0'}
                                                    />
                                                </div>
                                            </div>

                                            {tieneComision && comision.valor > 0 && (
                                                <div className="mt-3 p-2 rounded bg-success-light border-success-subtle">
                                                    <span className="text-success">
                                                        <strong>Comisión estimada: </strong>
                                                        {comision.tipo === 'porcentaje' ? (
                                                            `${comision.valor}% = $${(producto.precio_usd * comision.valor / 100).toFixed(2)} USD`
                                                        ) : (
                                                            `$${comision.valor.toFixed(2)} USD`
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    <div className="card-footer border-top mt-4">
                        <div className="flex flex-gap">
                            <button className="btn btn-primary" onClick={guardarComisiones}>
                                Guardar Cambios
                            </button>
                            <button className="btn btn-secondary" onClick={cancelarComisiones}>
                                Cancelar y Volver
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    } else if (vistaActiva === 'detalle' && vendedorSeleccionado) {
        const comisionesData = calcularComisionesVendedor(vendedorSeleccionado.id)
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={() => setVistaActiva('lista')}>
                            ← Volver a la Lista
                        </button>
                        <h1 className="page-title">Resumen de Comisiones</h1>
                        <p className="page-subtitle">Vendedor: <strong>{vendedorSeleccionado.nombre}</strong></p>
                    </div>
                    {comisionesData.total > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => pagarComisiones(vendedorSeleccionado)}
                        >
                            💰 Pagar $${comisionesData.total.toFixed(2)} USD
                        </button>
                    )}
                </div>

                <div className="grid grid-3 flex-gap mb-4">
                    <div className="card p-3 text-center">
                        <p className="text-muted text-small mb-1">Total Generado</p>
                        <h2 className="text-primary">${comisionesData.totalGenerado.toFixed(2)}</h2>
                    </div>
                    <div className="card p-3 text-center">
                        <p className="text-muted text-small mb-1">Total Pagado</p>
                        <h2 className="text-danger">${comisionesData.totalPagado.toFixed(2)}</h2>
                    </div>
                    <div className="card p-3 text-center border-success">
                        <p className="text-muted text-small mb-1">Pendiente por Pagar</p>
                        <h2 className="text-success">${comisionesData.total.toFixed(2)}</h2>
                    </div>
                </div>

                {/* Historial de Pagos */}
                {vendedorSeleccionado.pagos_comisiones && vendedorSeleccionado.pagos_comisiones.length > 0 && (
                    <div className="card mb-4">
                        <div className="card-header">
                            <h3 className="card-title">Historial de Pagos</h3>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Monto USD</th>
                                        <th>Tasa</th>
                                        <th>Monto Bs</th>
                                        <th>Referencia</th>
                                        <th>Facturas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...vendedorSeleccionado.pagos_comisiones].reverse().map((pago) => (
                                        <tr key={pago.id}>
                                            <td>{formatDateDDMMYYYY(pago.fecha)}</td>
                                            <td><strong>${pago.monto_usd.toFixed(2)}</strong></td>
                                            <td>{pago.tasa_cambio.toFixed(2)}</td>
                                            <td>{formatBs(pago.monto_bs)}</td>
                                            <td><code className="text-small">{pago.referencia}</code></td>
                                            <td>{pago.facturas.length} factura(s)</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Facturas Pendientes / Detalle</h3>
                        <p className="card-subtitle">Listado de facturas que generaron comisiones</p>
                    </div>
                    <div className="table-container">
                        {comisionesData.facturas.length === 0 ? (
                            <p className="p-4 text-center text-muted">No hay facturas registradas para este vendedor.</p>
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Factura #</th>
                                        <th>Fecha</th>
                                        <th>Total Factura</th>
                                        <th>Comisión</th>
                                        <th>Detalle por Producto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comisionesData.facturas.map((factura) => (
                                        <tr key={factura.id}>
                                            <td><strong>#{factura.id}</strong></td>
                                            <td>{formatDateDDMMYYYY(factura.fecha)}</td>
                                            <td>${factura.total_usd.toFixed(2)} USD</td>
                                            <td className="text-success"><strong>${(factura.comisiones_total || 0).toFixed(2)}</strong></td>
                                            <td>
                                                {factura.comisiones_detalle && factura.comisiones_detalle.length > 0 ? (
                                                    <div className="text-small">
                                                        {factura.comisiones_detalle.map((com, idx) => (
                                                            <div key={idx} className="mb-1">
                                                                • {com.nombre}: {com.tipo === 'porcentaje' ? `${com.valor}%` : `$${com.valor.toFixed(2)}`} = <strong>${com.comision.toFixed(2)}</strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-muted">Sin detalle</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="card-footer border-top mt-4">
                        <button className="btn btn-secondary" onClick={() => setVistaActiva('lista')}>
                            Volver a la Lista
                        </button>
                    </div>
                </div>
            </div>
        )
    } else {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <h1 className="page-title">Vendedores</h1>
                        <p className="page-subtitle">Gestiona tu equipo de ventas y sus comisiones</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => setMostrarFormulario(!mostrarFormulario)}
                    >
                        {mostrarFormulario ? 'Cancelar' : '+ Nuevo Vendedor'}
                    </button>
                </div>

                {/* Formulario de Vendedor */}
                {mostrarFormulario && (
                    <div className="card mb-4 fade-in">
                        <div className="card-header">
                            <h3 className="card-title">
                                {editando ? 'Editar Vendedor' : 'Nuevo Vendedor'}
                            </h3>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Nombre completo *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-2 flex-gap">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={formData.telefono}
                                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-2 flex-gap">
                                <div className="form-group">
                                    <label className="form-label">Cédula</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="V-12345678"
                                        value={formData.cedula}
                                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Banco</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Banesco / Mercantil..."
                                        value={formData.banco}
                                        onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-gap">
                                <button type="submit" className="btn btn-primary">
                                    {editando ? 'Actualizar' : 'Guardar'}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={handleCancelar}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Lista de Vendedores */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Equipo de Ventas</h3>
                        <div className="flex flex-gap items-center">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar vendedor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                            <p className="card-subtitle">{vendedores.length} vendedor(es) registrado(s)</p>
                        </div>
                    </div>

                    {vendedores.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">👤</div>
                            <p>No hay vendedores registrados</p>
                            <button className="btn btn-primary mt-2" onClick={() => setMostrarFormulario(true)}>
                                Agregar Primer Vendedor
                            </button>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('nombre')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Nombre <SortIndicator column="nombre" />
                                        </th>
                                        <th onClick={() => handleSort('cedula')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            ID/Cédula <SortIndicator column="cedula" />
                                        </th>
                                        <th onClick={() => handleSort('telefono')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Teléfono <SortIndicator column="telefono" />
                                        </th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vendedoresFiltradosYOrdenados.map((vendedor) => {
                                        const comisionesData = calcularComisionesVendedor(vendedor.id)
                                        return (
                                            <tr key={vendedor.id}>
                                                <td><strong>{vendedor.nombre}</strong></td>
                                                <td>{vendedor.cedula || 'N/A'}</td>
                                                <td>{vendedor.telefono || 'N/A'}</td>
                                                <td>
                                                    <div className="flex flex-gap" style={{ justifyContent: 'flex-end' }}>
                                                        <button
                                                            className="btn btn-sm btn-info"
                                                            onClick={() => verDetalleComisiones(vendedor)}
                                                            title="Ver resumen de comisiones pagadas y pendientes"
                                                        >
                                                            📊 Resumen
                                                        </button>
                                                        {comisionesData.total > 0 && (
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => verDetalleComisiones(vendedor)}
                                                                title={`Pendiente por pagar: $${comisionesData.total.toFixed(2)} USD`}
                                                            >
                                                                💰 ${comisionesData.total.toFixed(2)}
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => abrirGestionComisiones(vendedor)}
                                                            title="Configurar porcentajes/montos"
                                                        >
                                                            ⚙️ Config.
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => handleEditar(vendedor)}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleEliminar(vendedor.id)}
                                                        >
                                                            Borrar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="slide-up">
            {vistaContenido}

            {/* Modal para Procesar Pago (Pago Móvil) */}
            {procesandoPago && (
                <div className="modal-overlay">
                    <div className="modal card" style={{ maxWidth: '500px', width: '90%' }}>
                        <div className="card-header">
                            <h3 className="card-title">Procesar Pago Móvil</h3>
                            <p className="card-subtitle">Copia los datos para realizar la transferencia</p>
                        </div>
                        <div className="card-body">
                            <div className="mb-4">
                                <div className="text-small text-muted mb-1">Monto a Pagar (Bs.)</div>
                                <div className="flex-between p-2 bg-light rounded">
                                    <strong style={{ fontSize: '1.25rem' }}>{formatBs(procesandoPago.monto_bs)}</strong>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => copyToClipboard(procesandoPago.monto_bs.toFixed(2), 'Monto')}
                                    >📋</button>
                                </div>
                            </div>

                            <div className="grid grid-1 flex-gap mb-4">
                                <div className="p-2 border rounded">
                                    <div className="text-small text-muted">Banco</div>
                                    <div className="flex-between">
                                        <span>{procesandoPago.vendedor.banco || 'N/A'}</span>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => copyToClipboard(procesandoPago.vendedor.banco || '', 'Banco')}
                                        >📋</button>
                                    </div>
                                </div>
                                <div className="p-2 border rounded">
                                    <div className="text-small text-muted">Teléfono</div>
                                    <div className="flex-between">
                                        <span>{procesandoPago.vendedor.telefono || 'N/A'}</span>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => copyToClipboard(procesandoPago.vendedor.telefono || '', 'Teléfono')}
                                        >📋</button>
                                    </div>
                                </div>
                                <div className="p-2 border rounded">
                                    <div className="text-small text-muted">Cédula</div>
                                    <div className="flex-between">
                                        <span>{procesandoPago.vendedor.cedula || 'N/A'}</span>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => copyToClipboard(procesandoPago.vendedor.cedula || '', 'Cédula')}
                                        >📋</button>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Número de Confirmación / Referencia *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ingrese los últimos 4-6 dígitos o número completo"
                                    value={referenciaPago}
                                    onChange={(e) => setReferenciaPago(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-small text-muted mt-1">Este dato es obligatorio para registrar el pago.</p>
                            </div>
                        </div>
                        <div className="card-footer">
                            <div className="flex flex-gap">
                                <button
                                    className="btn btn-primary"
                                    onClick={finalizarPagoComisiones}
                                    disabled={!referenciaPago.trim()}
                                >
                                    ✅ Confirmar y Notificar
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setProcesandoPago(null)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp Message Modal */}
            {whatsappMessage && (
                <div className="modal-overlay">
                    <div className="modal card" style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="card-header">
                            <h3 className="card-title">Notificación de Pago</h3>
                            <p className="card-subtitle">Copia el mensaje para enviarlo por WhatsApp</p>
                        </div>
                        <div className="card-body">
                            <textarea
                                className="form-input"
                                value={whatsappMessage}
                                readOnly
                                rows="10"
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    backgroundColor: 'var(--bg-light)'
                                }}
                            />
                            <div className="mt-3">
                                {whatsappTo ? (
                                    whatsappValid ? (
                                        <div className="text-success p-2 bg-success-light rounded border-success-subtle">
                                            Destino validado: <strong>+{whatsappTo}</strong>
                                            {whatsappNote && <div className="text-small opacity-75">{whatsappNote}</div>}
                                        </div>
                                    ) : (
                                        <div className="text-danger p-2 bg-danger-light rounded border-danger-subtle">
                                            ⚠️ Número inválido o mal formateado: <strong>+{whatsappTo}</strong>
                                            {whatsappNote && <div className="text-small opacity-75">{whatsappNote}</div>}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-muted p-2 bg-light rounded border opacity-75">
                                        ℹ️ No hay número de teléfono asociado. Se abrirá WhatsApp sin destinatario.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="card-footer">
                            <div className="flex flex-gap">
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={copiarWhatsApp}>
                                    {copied ? '✅ ¡Copiado!' : '📋 Copiar Mensaje'}
                                </button>
                                <a
                                    className="btn btn-primary"
                                    style={{ flex: 2 }}
                                    href={whatsappTo ? `https://wa.me/${whatsappTo}?text=${encodeURIComponent(whatsappMessage)}` : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    🚀 Abrir en WhatsApp
                                </a>
                                <button className="btn btn-secondary" onClick={() => setWhatsappMessage('')}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
