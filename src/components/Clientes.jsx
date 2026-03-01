import { useState, useEffect } from 'react'
import { normalizePhoneVE, formatPhoneForDisplay, formatBs } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'

export default function Clientes({ clientes, setClientes, externalEditCliente, setExternalEditCliente, facturas = [], tasaCambio = 0, diasCredito = 7 }) {
    const [vistaActiva, setVistaActiva] = useState('lista') // 'lista', 'formulario', 'facturas'
    const [editando, setEditando] = useState(null)
    const [formData, setFormData] = useState({
        nombre: '',
        telefono: '',
        direccion: ''
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' })

    const [telefonoValid, setTelefonoValid] = useState(true)
    const [telefonoNote, setTelefonoNote] = useState('')

    const autocorrectPhone = () => {
        const res = normalizePhoneVE(formData.telefono)
        if (res.normalized) {
            setFormData({ ...formData, telefono: `+${res.normalized}` })
        }
        setTelefonoValid(res.valid)
        setTelefonoNote(res.note)
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        if (editando) {
            // Editar cliente existente
            setClientes(clientes.map(c =>
                c.id === editando.id ? { ...formData, id: editando.id } : c
            ))
            setEditando(null)
        } else {
            // Crear nuevo cliente
            const nuevoCliente = {
                id: Date.now(),
                ...formData
            }
            setClientes([...clientes, nuevoCliente])
        }

        // Resetear formulario
        setFormData({ nombre: '', telefono: '', direccion: '' })
        setVistaActiva('lista')
    }

    const handleEditar = (cliente) => {
        setFormData({
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            direccion: cliente.direccion
        })
        setEditando(cliente)
        setVistaActiva('formulario')
    }

    // Si hay una petición externa de edición (p. ej. desde Facturas), abrir el formulario
    useEffect(() => {
        if (externalEditCliente) {
            setFormData({
                nombre: externalEditCliente.nombre || '',
                telefono: externalEditCliente.telefono || '',
                direccion: externalEditCliente.direccion || ''
            })
            setEditando(externalEditCliente)
            setVistaActiva('formulario')

            // Limpiar la petición externa para evitar reabrir repetidamente
            if (typeof setExternalEditCliente === 'function') setExternalEditCliente(null)
        }
    }, [externalEditCliente, setExternalEditCliente])

    const handleEliminar = (id) => {
        if (confirm('¿Estás seguro de eliminar este cliente?')) {
            setClientes(clientes.filter(c => c.id !== id))
        }
    }

    const handleCancelar = () => {
        setFormData({ nombre: '', telefono: '', direccion: '' })
        setEditando(null)
        setVistaActiva('lista')
    }

    const formatDateDDMMYYYY = (date) => {
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    const formatNumberVE = (value, decimals = 2) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0
        return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    const enviarRecordatorio = (factura, cliente) => {
        if (!factura || !cliente) return
        const creditDays = diasCredito || 7
        const fechaEmi = formatDateDDMMYYYY(factura.fecha)
        const fechaVenc = formatDateDDMMYYYY(new Date(new Date(factura.fecha).getTime() + creditDays * 24 * 60 * 60 * 1000))
        const montoUSD = factura.saldo_pendiente_usd || 0
        const montoBS = montoUSD * tasaCambio

        let texto = `Hola ${cliente.nombre}, reciba un cordial saludo.\n\n` +
            `Le recordamos que la factura #${factura.id} emitida el ${fechaEmi} y con vencimiento el ${fechaVenc} presenta un saldo pendiente de $${formatNumberVE(montoUSD, 2)} USD (${formatBs(montoBS)}).\n\n` +
            'Por favor proceda con el pago a la brevedad. Muchas gracias.'

        const { normalized, valid } = normalizePhoneVE(cliente.telefono || '')
        const waLink = valid ? `https://wa.me/${normalized}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`
        try {
            const newWin = window.open(waLink, '_blank')
            if (newWin) {
                setToastMessage('Se abrió WhatsApp correctamente.')
            } else {
                setToastMessage('No se pudo abrir WhatsApp automáticamente. Copie el mensaje y envíelo manualmente.')
            }
        } catch (err) {
            setToastMessage('No se pudo abrir WhatsApp automáticamente. Copie el mensaje y envíelo manualmente.')
        }

        // Registrar el recordatorio en el historial del cliente
        const nuevoRecordatorio = {
            factura_id: factura.id,
            fecha: new Date().toISOString(),
            mensaje: texto
        }
        const nuevosClientes = clientes.map(c => {
            if (c.id === cliente.id) {
                const historial = Array.isArray(c.recordatorios) ? c.recordatorios.slice() : []
                return { ...c, recordatorios: [...historial, nuevoRecordatorio] }
            }
            return c
        })
        setClientes(nuevosClientes)

        setShowToast(true)
        setTimeout(() => setShowToast(false), 4000)
    }

    const handleEliminarRecordatorio = (clienteId, index) => {
        if (!confirm('¿Eliminar este recordatorio?')) return
        const nuevos = clientes.map(c => {
            if (c.id === clienteId) {
                const historial = Array.isArray(c.recordatorios) ? c.recordatorios.slice() : []
                historial.splice(index, 1)
                return { ...c, recordatorios: historial }
            }
            return c
        })
        setClientes(nuevos)
    }

    const handleEliminarTodosRecordatorios = (clienteId) => {
        if (!confirm('¿Eliminar TODOS los recordatorios de este cliente? Esta acción no se puede deshacer.')) return
        const nuevos = clientes.map(c => c.id === clienteId ? { ...c, recordatorios: [] } : c)
        setClientes(nuevos)
        setToastMessage('Se eliminaron todos los recordatorios del cliente.')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 4000)
    }


    // Estado para mostrar facturas de un cliente
    const [facturasPendientesCliente, setFacturasPendientesCliente] = useState([])
    const [facturasPendientesTotalUSD, setFacturasPendientesTotalUSD] = useState(0)
    const [selectedClienteId, setSelectedClienteId] = useState(null)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState('')
    const selectedClient = clientes.find(c => c.id === selectedClienteId)
    const recordatorios = selectedClient?.recordatorios || []
    const reversedRecordatorios = recordatorios.slice().reverse()

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

    const clientesFiltradosYOrdenados = [...clientes]
        .filter(c => {
            const search = searchTerm.toLowerCase()
            return (
                c.nombre.toLowerCase().includes(search) ||
                (c.telefono || '').toLowerCase().includes(search) ||
                (c.direccion || '').toLowerCase().includes(search)
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

    if (vistaActiva === 'formulario') {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={handleCancelar}>
                            ← Volver a la Lista
                        </button>
                        <h3 className="card-title">
                            {editando ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                    </div>
                </div>

                <div className="card mb-4 fade-in">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nombre *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Teléfono *</label>
                            <input
                                type="tel"
                                className="form-input"
                                value={formData.telefono}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setFormData({ ...formData, telefono: v })
                                    const res = normalizePhoneVE(v)
                                    setTelefonoValid(res.valid)
                                    setTelefonoNote(res.note)
                                }}
                                onBlur={() => autocorrectPhone()}
                                required
                            />

                            {telefonoValid ? (
                                telefonoNote ? <p className="muted">{telefonoNote}</p> : <p className="muted">Número válido</p>
                            ) : (
                                <div>
                                    <p className="text-danger">Número posiblemente inválido</p>
                                    {telefonoNote && <p className="muted">{telefonoNote}</p>}
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={autocorrectPhone}>Autocorregir</button>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Dirección *</label>
                            <textarea
                                className="form-textarea"
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                required
                            />
                        </div>

                        <div className="flex flex-gap mt-4">
                            <button type="submit" className="btn btn-primary">
                                {editando ? 'Actualizar Cliente' : 'Guardar Cliente'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={handleCancelar}>
                                Cancelar y Volver
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    } else if (vistaActiva === 'facturas' && selectedClient) {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={() => setVistaActiva('lista')}>
                            ← Volver a la Lista
                        </button>
                        <h1 className="page-title">Facturas de {selectedClient.nombre}</h1>
                    </div>
                </div>

                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">Facturas Pendientes</h3>
                    </div>
                    <div className="card-body">
                        {facturasPendientesCliente.length === 0 ? (
                            <div className="empty-state">
                                <p>No hay facturas pendientes para este cliente.</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Factura #</th>
                                            <th>Fecha</th>
                                            <th>Saldo pendiente (USD)</th>
                                            <th>Saldo pendiente (Bs)</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facturasPendientesCliente.map(f => {
                                            const creditDays = diasCredito || 7
                                            const vencimiento = new Date(new Date(f.fecha).getTime() + creditDays * 24 * 60 * 60 * 1000)
                                            const estaVencida = vencimiento < new Date()
                                            return (
                                                <tr key={f.id}>
                                                    <td>#{f.id}</td>
                                                    <td>{formatDateDDMMYYYY(f.fecha)}</td>
                                                    <td>${(f.saldo_pendiente_usd || 0).toFixed(2)}</td>
                                                    <td>{formatBs((f.saldo_pendiente_usd || 0) * tasaCambio)}</td>
                                                    <td>
                                                        {estaVencida ? (
                                                            <button className="btn btn-sm btn-warning" onClick={() => enviarRecordatorio(f, selectedClient)}>
                                                                Enviar Recordatorio
                                                            </button>
                                                        ) : (
                                                            <span className="text-muted text-small">No vencida</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'var(--bg-tertiary)' }}>
                                            <td colSpan="2" className="text-right"><strong>Total Pendiente:</strong></td>
                                            <td className="text-danger"><strong>${facturasPendientesTotalUSD.toFixed(2)} USD</strong></td>
                                            <td colSpan="2"><strong>{formatBs(facturasPendientesTotalUSD * tasaCambio)}</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {recordatorios.length > 0 && (
                    <div className="card mb-4">
                        <div className="card-header flex-between">
                            <h3 className="card-title">Historial de Recordatorios</h3>
                            <button className="btn btn-sm btn-danger" onClick={() => handleEliminarTodosRecordatorios(selectedClienteId)}>
                                Eliminar Todo el Historial
                            </button>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha Envío</th>
                                        <th>Factura #</th>
                                        <th>Mensaje Enviado</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reversedRecordatorios.map((r, i) => {
                                        const originalIndex = recordatorios.length - 1 - i
                                        return (
                                            <tr key={originalIndex}>
                                                <td>{formatDateDDMMYYYY(r.fecha)}</td>
                                                <td>#{r.factura_id}</td>
                                                <td style={{ maxWidth: '40ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.mensaje}>
                                                    {r.mensaje}
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleEliminarRecordatorio(selectedClienteId, originalIndex)}>
                                                        Eliminar
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex flex-gap mt-4">
                    <button className="btn btn-secondary" onClick={() => setVistaActiva('lista')}>
                        Volver a la Lista
                    </button>
                </div>
            </div>
        )
    } else {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <h1 className="page-title">Clientes</h1>
                        <p className="page-subtitle">Gestiona tu cartera de clientes</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => { setEditando(null); setFormData({ nombre: '', telefono: '', direccion: '' }); setVistaActiva('formulario') }}
                    >
                        + Nuevo Cliente
                    </button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Lista de Clientes</h3>
                        <div className="flex flex-gap items-center">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar por nombre, teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                            <p className="card-subtitle">{clientes.length} cliente(s) registrado(s)</p>
                        </div>
                    </div>

                    {clientes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <p>No hay clientes registrados</p>
                            <button className="btn btn-primary mt-2" onClick={() => setVistaActiva('formulario')}>
                                Agregar Primer Cliente
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
                                        <th onClick={() => handleSort('telefono')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Teléfono <SortIndicator column="telefono" />
                                        </th>
                                        <th onClick={() => handleSort('direccion')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Dirección <SortIndicator column="direccion" />
                                        </th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientesFiltradosYOrdenados.map((cliente) => (
                                        <tr key={cliente.id}>
                                            <td>{cliente.nombre}</td>
                                            <td>{formatPhoneForDisplay(cliente.telefono) || cliente.telefono || 'N/A'}</td>
                                            <td>{cliente.direccion}</td>
                                            <td>
                                                <div className="flex flex-gap">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleEditar(cliente)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-info"
                                                        onClick={() => {
                                                            const pendientes = facturas.filter(f => f.cliente_id === cliente.id && f.saldo_pendiente_usd > 0)
                                                            setFacturasPendientesCliente(pendientes)
                                                            const total = pendientes.reduce((s, it) => s + (it.saldo_pendiente_usd || 0), 0)
                                                            setFacturasPendientesTotalUSD(total)
                                                            setSelectedClienteId(cliente.id)
                                                            setVistaActiva('facturas')
                                                        }}
                                                    >
                                                        Ver Facturas
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleEliminar(cliente.id)}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
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
            {showToast && (
                <div className="toast-toast" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}>
                    <div className="toast card" style={{ padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>{toastMessage}</div>
                            <button className="btn btn-sm" onClick={() => setShowToast(false)}>✕</button>
                        </div>
                    </div>
                </div>
            )}

            {vistaContenido}
        </div>
    )
}
