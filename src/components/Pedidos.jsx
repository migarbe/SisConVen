import { useState, useMemo } from 'react'
import { formatPhoneForDisplay } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Pedidos({ pedidos, setPedidos, clientes, productos, tasaCambio, onConvertirAFactura }) {
    const [vistaActiva, setVistaActiva] = useState('lista') // 'lista' o 'formulario'
    const [editandoPedido, setEditandoPedido] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })

    // Estados para WhatsApp (similar a Facturas)
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('')
    const [whatsappValid, setWhatsappValid] = useState(true)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)

    // Formulario
    const [formData, setFormData] = useState({
        cliente_id: '',
        fecha: new Date().toISOString().slice(0, 10),
        fecha_entrega: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // Mañana por defecto
        items: []
    })

    const [currentItem, setCurrentItem] = useState({
        producto_id: '',
        cantidad: ''
    })

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const SortIndicator = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3 }}>↕</span>
        return <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
    }

    const pedidosFiltradosYOrdenados = useMemo(() => {
        let result = [...pedidos]

        // Filtrado
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p => {
                const cliente = clientes.find(c => c.id === p.cliente_id)
                return (
                    p.id.toString().includes(term) ||
                    (cliente && cliente.nombre.toLowerCase().includes(term))
                )
            })
        }

        // Ordenado
        result.sort((a, b) => {
            let valA = a[sortConfig.key]
            let valB = b[sortConfig.key]

            if (sortConfig.key === 'cliente') {
                valA = clientes.find(c => c.id === a.cliente_id)?.nombre || ''
                valB = clientes.find(c => c.id === b.cliente_id)?.nombre || ''
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })

        return result
    }, [pedidos, searchTerm, sortConfig, clientes])

    const totalKgEstimados = useMemo(() => {
        return pedidos.reduce((total, p) => {
            return total + p.items.reduce((sub, it) => sub + (parseFloat(it.cantidad) || 0), 0)
        }, 0)
    }, [pedidos])

    const totalPorProducto = useMemo(() => {
        const summary = {}
        pedidos.forEach(p => {
            p.items.forEach(it => {
                const prod = productos.find(pr => pr.id === it.producto_id)
                const nombre = prod ? prod.nombre : 'Desconocido'
                summary[nombre] = (summary[nombre] || 0) + (parseFloat(it.cantidad) || 0)
            })
        })
        return summary
    }, [pedidos, productos])

    // Normaliza y valida teléfonos para uso en WhatsApp
    const normalizePhoneVE = (raw) => {
        const digits = (raw || '').replace(/\D/g, '')
        if (!digits) return { normalized: '', valid: false, note: '' }
        let d = digits.replace(/^0+/, '')
        let addedPrefix = false
        if (!d.startsWith('58')) {
            if (d.length >= 7 && d.length <= 11) {
                d = '58' + d
                addedPrefix = true
            }
        }
        const valid = d.startsWith('58') && d.length >= 11 && d.length <= 15
        let note = addedPrefix ? 'Se añadió prefijo de país +58' : ''
        if (!valid) note = note ? `${note}; Número posiblemente inválido` : 'Número posiblemente inválido'
        return { normalized: d, valid, note }
    }

    const formatDateDDMMYYYY = (dateString) => {
        if (!dateString) return ''
        const [year, month, day] = dateString.split('-')
        return `${day}/${month}/${year}`
    }

    const handleAddItem = () => {
        if (!currentItem.producto_id || !currentItem.cantidad) {
            alert('Seleccione un producto y cantidad')
            return
        }

        const prod = productos.find(p => p.id === parseInt(currentItem.producto_id))
        const newItem = {
            producto_id: prod.id,
            nombre: prod.nombre,
            cantidad: parseFloat(currentItem.cantidad),
            precio_base_usd: prod.precio_usd
        }

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }))

        setCurrentItem({ producto_id: '', cantidad: '' })
    }

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.cliente_id || formData.items.length === 0) {
            alert('Debe seleccionar un cliente y al menos un producto')
            return
        }

        const nuevoPedido = {
            ...formData,
            id: editandoPedido ? editandoPedido.id : Date.now(),
            cliente_id: parseInt(formData.cliente_id)
        }

        // Generar mensaje de WhatsApp
        const cliente = clientes.find(c => c.id === nuevoPedido.cliente_id)
        const itemsText = nuevoPedido.items.map(it => `- ${it.nombre}: ${formatNumberVE(it.cantidad, 3)} Kg`).join('\n')

        const textToMsg = `*Nuevo Pedido Registrado*\n\nHola ${cliente?.nombre || 'Cliente'}, se ha registrado tu pedido:\n\n*Productos:*\n${itemsText}\n\n*Fecha estimada de entrega:* ${formatDateDDMMYYYY(nuevoPedido.fecha_entrega)}\n\nMuchas gracias por su preferencia.`

        const phoneData = normalizePhoneVE(cliente?.telefono || '')
        setWhatsappMessage(textToMsg)
        setWhatsappTo(phoneData.normalized)
        setWhatsappValid(phoneData.valid)
        setWhatsappNote(phoneData.note)

        if (editandoPedido) {
            setPedidos(pedidos.map(p => p.id === editandoPedido.id ? nuevoPedido : p))
        } else {
            setPedidos([...pedidos, nuevoPedido])
        }

        setVistaActiva('lista')
        setEditandoPedido(null)
        setFormData({
            cliente_id: '',
            fecha: new Date().toISOString().slice(0, 10),
            fecha_entrega: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            items: []
        })
    }

    const handleEditar = (pedido) => {
        setEditandoPedido(pedido)
        setFormData({
            cliente_id: pedido.cliente_id.toString(),
            fecha: pedido.fecha,
            fecha_entrega: pedido.fecha_entrega || new Date().toISOString().slice(0, 10),
            items: [...pedido.items]
        })
        setVistaActiva('formulario')
    }

    const handleEliminar = (id) => {
        if (window.confirm('¿Está seguro de eliminar este pedido?')) {
            setPedidos(pedidos.filter(p => p.id !== id))
        }
    }

    const formatNumberVE = (value, decimals = 2) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0
        return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    const copiarWhatsApp = async () => {
        if (!whatsappMessage) return
        try {
            await navigator.clipboard.writeText(whatsappMessage)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            alert('No se pudo copiar al portapapeles.')
        }
    }

    if (vistaActiva === 'formulario') {
        return (
            <div className="slide-up">
                <div className="page-header flex-between">
                    <div>
                        <h1 className="page-title">{editandoPedido ? 'Editar Pedido' : 'Nuevo Pedido'}</h1>
                        <p className="page-subtitle">Complete los datos de la orden</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setVistaActiva('lista')}>
                        Cancelar
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-2 mb-4">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Datos Básicos</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Cliente *</label>
                                    <select
                                        className="form-select"
                                        value={formData.cliente_id}
                                        onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar cliente...</option>
                                        {[...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-2 flex-gap">
                                    <div className="form-group">
                                        <label className="form-label">Fecha del Pedido *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.fecha}
                                            onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Entrega Estimada *</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.fecha_entrega}
                                            onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Agregar Productos</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Producto</label>
                                    <select
                                        className="form-select"
                                        value={currentItem.producto_id}
                                        onChange={(e) => setCurrentItem({ ...currentItem, producto_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar producto...</option>
                                        {productos.filter(p => (p.cantidad_kg || 0) > 0).map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} ({formatNumberVE(p.cantidad_kg, 1)} Kg disp.)</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cantidad (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        className="form-input"
                                        value={currentItem.cantidad}
                                        onChange={(e) => setCurrentItem({ ...currentItem, cantidad: e.target.value })}
                                        placeholder="0,000"
                                    />
                                </div>
                                <button type="button" className="btn btn-secondary w-full" onClick={handleAddItem}>
                                    + Agregar al Pedido
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">
                            <h3 className="card-title">Resumen de Productos</h3>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Cantidad</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.items.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="text-center text-muted">No hay productos agregados</td>
                                        </tr>
                                    ) : (
                                        formData.items.map((it, idx) => (
                                            <tr key={idx}>
                                                <td>{it.nombre}</td>
                                                <td>{formatNumberVE(it.cantidad, 3)} Kg</td>
                                                <td>
                                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveItem(idx)}>
                                                        Quitar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-gap">
                        <button type="submit" className="btn btn-primary btn-lg">
                            {editandoPedido ? 'Guardar Cambios' : 'Crear Pedido'}
                        </button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="slide-up">
            <div className="page-header flex-between">
                <div>
                    <h1 className="page-title">Pedidos / Ordenes de Compra</h1>
                    <p className="page-subtitle">Gestiona preventas y estimaciones de despacho</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setEditandoPedido(null);
                        setFormData({
                            cliente_id: '',
                            fecha: new Date().toISOString().slice(0, 10),
                            fecha_entrega: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                            items: []
                        });
                        setVistaActiva('formulario')
                    }}
                >
                    + Nuevo Pedido
                </button>
            </div>

            {/* Mensaje de WhatsApp Generado (Copiado de Facturas) */}
            {whatsappMessage && (
                <div className="card mb-4 border-whatsapp fade-in" style={{ backgroundColor: 'rgba(37, 211, 102, 0.05)' }}>
                    <div className="card-header flex-between">
                        <h3 className="card-title" style={{ color: '#25D366' }}>✅ Pedido Guardado: Notificación WhatsApp</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => setWhatsappMessage('')}>Cerrar</button>
                    </div>
                    <div className="card-body">
                        <div className="flex flex-gap items-center mb-3">
                            <div className={`p-2 rounded ${whatsappValid ? 'bg-success-light' : 'bg-danger-light'}`}>
                                <strong>Enviar a: </strong> {whatsappTo ? `+${whatsappTo}` : 'Sin teléfono'}
                            </div>
                            {whatsappNote && <span className="text-small text-muted italic">({whatsappNote})</span>}
                        </div>

                        <div className="p-3 bg-white rounded border mb-3" style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '0.95rem' }}>
                            {whatsappMessage}
                        </div>

                        <div className="flex flex-gap">
                            <button className="btn btn-secondary" onClick={copiarWhatsApp}>
                                {copied ? '✅ ¡Copiado!' : '📋 Copiar Mensaje'}
                            </button>
                            {whatsappValid && (
                                <a
                                    href={`https://wa.me/${whatsappTo}?text=${encodeURIComponent(whatsappMessage)}`}
                                    className="btn btn-whatsapp"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    🟢 Abrir WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-3 mb-4">
                <div className="stat-card">
                    <div className="stat-label">Total Pedidos</div>
                    <div className="stat-value">{pedidos.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Mercancía Empalabrada</div>
                    <div className="stat-value">{formatNumberVE(totalKgEstimados, 1)} Kg</div>
                </div>
            </div>

            {Object.keys(totalPorProducto).length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">Resumen por Producto</h3>
                    </div>
                    <div className="grid grid-4" style={{ padding: 'var(--spacing-md)' }}>
                        {Object.entries(totalPorProducto).map(([nombre, cant]) => (
                            <div key={nombre} className="rate-item">
                                <span className="rate-pair">{nombre}</span>
                                <span className="rate-value">{formatNumberVE(cant, 1)} Kg</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Historial de Pedidos</h3>
                    <div className="flex flex-gap items-center">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar por cliente o id..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ maxWidth: '300px' }}
                        />
                    </div>
                </div>

                {pedidos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <p>No hay pedidos registrados</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                                        ID <SortIndicator column="id" />
                                    </th>
                                    <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer' }}>
                                        Cliente <SortIndicator column="cliente" />
                                    </th>
                                    <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer' }}>
                                        Fecha <SortIndicator column="fecha" />
                                    </th>
                                    <th>Entrega</th>
                                    <th>Resumen</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidosFiltradosYOrdenados.map(pedido => {
                                    const cliente = clientes.find(c => c.id === pedido.cliente_id)
                                    const resumenItems = pedido.items.map(it => `${it.nombre} (${formatNumberVE(it.cantidad, 1)}kg)`).join(', ')
                                    return (
                                        <tr key={pedido.id}>
                                            <td>#{pedido.id.toString().slice(-6)}</td>
                                            <td>{cliente?.nombre || 'Desconocido'}</td>
                                            <td>{formatDateDDMMYYYY(pedido.fecha)}</td>
                                            <td>{pedido.fecha_entrega ? formatDateDDMMYYYY(pedido.fecha_entrega) : 'N/A'}</td>
                                            <td className="text-small text-muted" style={{ maxWidth: '400px' }}>{resumenItems}</td>
                                            <td>
                                                <div className="flex flex-gap">
                                                    <button className="btn btn-sm btn-success" onClick={() => onConvertirAFactura(pedido)}>
                                                        📝 Facturar
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleEditar(pedido)}>
                                                        Editar
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(pedido.id)}>
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
