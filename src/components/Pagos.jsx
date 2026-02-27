import { useState, useEffect } from 'react'
import { formatBs, formatUSD, normalizePhoneVE } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Pagos({ pagos, setPagos, facturas, setFacturas, tasaCambio, clientes, facturaAPagar, setFacturaAPagar }) {
    const [vistaActiva, setVistaActiva] = useState('lista') // 'lista', 'formulario'
    const [editandoPago, setEditandoPago] = useState(null)
    const [formData, setFormData] = useState({
        factura_id: '',
        monto_usd: '',
        forma_pago: 'Pago Movil'
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })

    // Manejar factura a pagar enviada desde otra vista

    useEffect(() => {
        if (facturaAPagar) {
            setFormData({
                factura_id: facturaAPagar.id.toString(),
                monto_usd: facturaAPagar.saldo_pendiente_usd.toFixed(2),
                forma_pago: 'Pago Movil'
            })
            setVistaActiva('formulario')
            setFacturaAPagar(null) // Limpiar para evitar loop
        }
    }, [facturaAPagar, setFacturaAPagar])

    // WhatsApp Message Modal state
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('')
    const [whatsappValid, setWhatsappValid] = useState(false)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)

    const facturasPendientes = facturas.filter(f => f.saldo_pendiente_usd > 0)

    const handleSubmit = (e) => {
        e.preventDefault()

        const factura = facturas.find(f => f.id === parseInt(formData.factura_id))
        if (!factura) return

        let montoUSD = parseFloat(formData.monto_usd)
        if (isNaN(montoUSD) || montoUSD <= 0) {
            alert('Ingresa un monto válido en USD')
            return
        }

        // Si el monto ingresado es >= 95% del saldo pendiente, asumimos que se pagará completamente
        const THRESHOLD = 0.95
        if (montoUSD >= THRESHOLD * factura.saldo_pendiente_usd) {
            const montoAjustado = factura.saldo_pendiente_usd
            setFormData(prev => ({ ...prev, monto_usd: montoAjustado.toFixed(2) }))
            montoUSD = montoAjustado
            alert(`El monto supera el 95% del saldo pendiente. Se ajustará a $${montoAjustado.toFixed(2)} y se registrará como pago completo.`)
        }

        const montoBS = montoUSD * tasaCambio

        if (montoUSD > factura.saldo_pendiente_usd) {
            alert(`El monto excede el saldo pendiente. Máximo: $${factura.saldo_pendiente_usd.toFixed(2)} USD (${formatBs(factura.saldo_pendiente_usd * tasaCambio)})`)
            return
        }

        const nuevoPago = {
            id: Date.now(),
            factura_id: factura.id,
            fecha: new Date().toISOString(),
            monto_bs: montoBS,
            tasa_cambio: tasaCambio,
            monto_usd: montoUSD,
            forma_pago: formData.forma_pago
        }

        let nuevoSaldo = 0

        if (editandoPago) {
            // Caso Edición: Primero revertimos el impacto del pago anterior en la factura
            const viejoPago = editandoPago
            const facturaOriginal = facturas.find(f => f.id === viejoPago.factura_id)

            if (facturaOriginal) {
                const saldoRevertido = parseFloat((facturaOriginal.saldo_pendiente_usd + viejoPago.monto_usd).toFixed(2))
                let estadoRevertido = 'Pendiente'
                if (saldoRevertido < facturaOriginal.total_usd) estadoRevertido = 'Parcial'

                // Actualizamos temporalmente las facturas para que el cálculo siguiente sea correcto
                const facturasTemp = facturas.map(f =>
                    f.id === facturaOriginal.id
                        ? { ...f, saldo_pendiente_usd: saldoRevertido, estado: estadoRevertido }
                        : f
                )

                // Ahora aplicamos el nuevo monto sobre la factura revertida
                const facturaActualizada = facturasTemp.find(f => f.id === factura.id)
                nuevoSaldo = parseFloat((facturaActualizada.saldo_pendiente_usd - montoUSD).toFixed(2))
                let nuevoEstado = 'Pendiente'
                if (nuevoSaldo <= 0.01) nuevoEstado = 'Pagada'
                else if (nuevoSaldo < facturaActualizada.total_usd) nuevoEstado = 'Parcial'

                setFacturas(facturasTemp.map(f =>
                    f.id === factura.id
                        ? { ...f, saldo_pendiente_usd: Math.max(0, nuevoSaldo), estado: nuevoEstado }
                        : f
                ))

                setPagos(pagos.map(p => p.id === viejoPago.id ? nuevoPago : p))
            }
        } else {
            // Caso Nuevo Pago
            nuevoSaldo = parseFloat((factura.saldo_pendiente_usd - montoUSD).toFixed(2))
            let nuevoEstado = 'Pendiente'

            if (nuevoSaldo <= 0.01) {
                nuevoEstado = 'Pagada'
            } else if (nuevoSaldo < factura.total_usd) {
                nuevoEstado = 'Parcial'
            }

            setFacturas(facturas.map(f =>
                f.id === factura.id
                    ? { ...f, saldo_pendiente_usd: Math.max(0, nuevoSaldo), estado: nuevoEstado }
                    : f
            ))

            setPagos([...pagos, nuevoPago])
        }

        const cliente = clientes.find(c => c.id === factura.cliente_id)
        const fechaPago = new Date(nuevoPago.fecha)
        const formatDateDDMMYYYY = (d) => {
            const dt = new Date(d)
            const day = String(dt.getDate()).padStart(2, '0')
            const month = String(dt.getMonth() + 1).padStart(2, '0')
            const year = dt.getFullYear()
            return `${day}/${month}/${year}`
        }
        const formatNumberVE = (value, decimals = 2) => {
            const n = typeof value === 'number' ? value : parseFloat(value) || 0
            return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        }

        let texto = `Hola ${cliente?.nombre || ''},\n\n` +
            `Confirmamos la recepción de su pago.` + '\n\n'

        texto += `Factura: #${factura.id}\n`
        texto += `Fecha de pago: ${formatDateDDMMYYYY(fechaPago)}\n`
        texto += `Forma de pago: ${formData.forma_pago}\n`
        texto += `Monto recibido: $${formatNumberVE(montoUSD, 2)} USD (${formatBs(montoBS)})\n`

        if (nuevoSaldo <= 0.01) {
            texto += `\nLa factura ha sido *pagada completamente*.\n\n`
        } else {
            texto += `Saldo restante: $${formatNumberVE(Math.max(0, nuevoSaldo), 2)} USD (${formatBs(Math.max(0, nuevoSaldo) * tasaCambio)})\n\n`
        }

        texto += 'Gracias por su pago y por hacer negocios con nosotros.'

        const telefonoRaw = cliente?.telefono || ''
        const { normalized, valid, note } = normalizePhoneVE(telefonoRaw)

        setWhatsappTo(normalized)
        setWhatsappValid(valid)
        setWhatsappNote(note)
        setWhatsappMessage(texto)
        setCopied(false)

        if (editandoPago) {
            alert('✅ Pago actualizado correctamente')
        }

        setFormData({ factura_id: '', monto_usd: '', forma_pago: 'Pago Movil' })
        setEditandoPago(null)
        setVistaActiva('lista')
    }

    const copiarWhatsApp = async () => {
        try {
            await navigator.clipboard.writeText(whatsappMessage)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Error al copiar:', err)
        }
    }

    const handleEditarPago = (pago) => {
        setFormData({
            factura_id: pago.factura_id.toString(),
            monto_usd: pago.monto_usd.toString(),
            forma_pago: pago.forma_pago || 'Pago Movil'
        })
        setEditandoPago(pago)
        setVistaActiva('formulario')
    }

    const handleEliminarPago = (pago) => {
        if (!confirm('¿Estás seguro de eliminar este pago? El saldo de la factura se revertirá.')) return

        const factura = facturas.find(f => f.id === pago.factura_id)
        if (factura) {
            const nuevoSaldo = factura.saldo_pendiente_usd + pago.monto_usd
            let nuevoEstado = 'Pendiente'
            if (nuevoSaldo < factura.total_usd) nuevoEstado = 'Parcial'

            setFacturas(facturas.map(f =>
                f.id === factura.id
                    ? { ...f, saldo_pendiente_usd: nuevoSaldo, estado: nuevoEstado }
                    : f
            ))
        }

        setPagos(pagos.filter(p => p.id !== pago.id))
    }

    const handleCancelar = () => {
        setFormData({ factura_id: '', monto_usd: '', forma_pago: 'Pago Movil' })
        setEditandoPago(null)
        setVistaActiva('lista')
    }

    const facturaSeleccionada = formData.factura_id
        ? facturas.find(f => f.id === parseInt(formData.factura_id))
        : null

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

    const pagosFiltradosYOrdenados = [...pagos]
        .filter(p => {
            const factura = facturas.find(f => f.id === p.factura_id)
            const cliente = factura ? clientes.find(c => c.id === factura.cliente_id) : null
            const search = searchTerm.toLowerCase()
            return (
                p.factura_id.toString().includes(search) ||
                (cliente?.nombre || '').toLowerCase().includes(search) ||
                (p.forma_pago || '').toLowerCase().includes(search)
            )
        })
        .sort((a, b) => {
            let valA, valB

            switch (sortConfig.key) {
                case 'fecha':
                    valA = new Date(a.fecha).getTime()
                    valB = new Date(b.fecha).getTime()
                    break
                case 'factura_id':
                    valA = a.factura_id
                    valB = b.factura_id
                    break
                case 'cliente':
                    const factA = facturas.find(f => f.id === a.factura_id)
                    const factB = facturas.find(f => f.id === b.factura_id)
                    valA = (clientes.find(c => c.id === factA?.cliente_id)?.nombre || '').toLowerCase()
                    valB = (clientes.find(c => c.id === factB?.cliente_id)?.nombre || '').toLowerCase()
                    break
                case 'monto_usd':
                    valA = a.monto_usd
                    valB = b.monto_usd
                    break
                case 'monto_bs':
                    valA = a.monto_bs
                    valB = b.monto_bs
                    break
                default:
                    valA = a[sortConfig.key]
                    valB = b[sortConfig.key]
            }

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
                        <h1 className="page-title">{editandoPago ? 'Editar Pago' : 'Registrar Pago'}</h1>
                        <p className="page-subtitle">Tasa de cambio actual: 1 USD = {tasaCambio.toFixed(2)} Bs.</p>
                    </div>
                </div>

                <div className="card mb-4 fade-in">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Factura *</label>
                            <select
                                className="form-select"
                                value={formData.factura_id}
                                onChange={(e) => setFormData({ ...formData, factura_id: e.target.value })}
                                required
                                disabled={!!editandoPago}
                            >
                                <option value="">Seleccionar factura...</option>
                                {facturas.map((factura) => {
                                    // En modo edición mostramos todas las del cliente, en modo nuevo solo las pendientes
                                    if (!editandoPago && factura.saldo_pendiente_usd <= 0) return null;

                                    const cliente = clientes.find(c => c.id === factura.cliente_id)
                                    return (
                                        <option key={factura.id} value={factura.id}>
                                            #{factura.id} - {cliente?.nombre} - Saldo: ${factura.saldo_pendiente_usd.toFixed(2)}
                                        </option>
                                    )
                                })}
                            </select>
                            {editandoPago && <p className="muted text-small mt-1">No se puede cambiar la factura al editar un pago por seguridad del saldo.</p>}
                        </div>

                        {facturaSeleccionada && (
                            <div className="card mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                                <h4 className="mb-2">Detalles de la Factura</h4>
                                <div className="grid grid-3">
                                    <div>
                                        <div className="text-small text-muted">Total Factura</div>
                                        <div className="text-primary">${facturaSeleccionada.total_usd.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-small text-muted">Saldo Pendiente</div>
                                        <div className="text-primary">${facturaSeleccionada.saldo_pendiente_usd.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-small text-muted">En Bolívares</div>
                                        <div className="text-primary">{formatBs(facturaSeleccionada.saldo_pendiente_usd * tasaCambio)}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Forma de Pago *</label>
                            <select
                                className="form-select"
                                value={formData.forma_pago}
                                onChange={(e) => setFormData({ ...formData, forma_pago: e.target.value })}
                                required
                            >
                                <option value="Pago Movil">Pago Movil</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Divisas">Divisas</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Monto en USD *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-input"
                                value={formData.monto_usd}
                                onChange={(e) => setFormData({ ...formData, monto_usd: e.target.value })}
                                required
                            />
                            {formData.monto_usd && (
                                <div className="mt-2 text-small">
                                    <span className="text-muted">Equivalente en Bs: </span>
                                    <strong style={{ color: 'var(--accent-primary)' }}>{formatBs(parseFloat(formData.monto_usd) * tasaCambio)}</strong>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-gap mt-4">
                            <button type="submit" className="btn btn-success">
                                {editandoPago ? 'Guardar Cambios' : 'Confirmar y Registrar Pago'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={handleCancelar}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    } else {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <h1 className="page-title">Pagos</h1>
                        <p className="page-subtitle">Registra pagos de facturas</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => setVistaActiva('formulario')}
                        disabled={facturasPendientes.length === 0}
                    >
                        + Registrar Pago
                    </button>
                </div>

                {facturasPendientes.length === 0 && (
                    <div className="card mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)' }}>
                        <p className="text-center" style={{ color: 'var(--success)', margin: 0 }}>
                            ✅ No hay facturas pendientes de pago
                        </p>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Historial de Pagos</h3>
                        <div className="flex flex-gap items-center">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar por cliente, factura..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                            <p className="card-subtitle">{pagos.length} pago(s) registrado(s)</p>
                        </div>
                    </div>

                    {pagos.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">💰</div>
                            <p>No hay pagos registrados</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Fecha <SortIndicator column="fecha" />
                                        </th>
                                        <th onClick={() => handleSort('factura_id')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Factura # <SortIndicator column="factura_id" />
                                        </th>
                                        <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Cliente <SortIndicator column="cliente" />
                                        </th>
                                        <th>Forma de Pago</th>
                                        <th onClick={() => handleSort('monto_bs')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Monto Bs. <SortIndicator column="monto_bs" />
                                        </th>
                                        <th>Tasa Cambio</th>
                                        <th onClick={() => handleSort('monto_usd')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Monto USD <SortIndicator column="monto_usd" />
                                        </th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagosFiltradosYOrdenados.map((pago) => {
                                        const factura = facturas.find(f => f.id === pago.factura_id)
                                        const cliente = factura ? clientes.find(c => c.id === factura.cliente_id) : null
                                        return (
                                            <tr key={pago.id}>
                                                <td>{new Date(pago.fecha).toLocaleDateString()}</td>
                                                <td>#{pago.factura_id}</td>
                                                <td>{cliente?.nombre || 'N/A'}</td>
                                                <td><span className="badge badge-info">{pago.forma_pago || 'Pago Movil'}</span></td>
                                                <td>{formatBs(pago.monto_bs)}</td>
                                                <td>1 USD = {pago.tasa_cambio.toFixed(2)} Bs.</td>
                                                <td>${pago.monto_usd.toFixed(2)}</td>
                                                <td>
                                                    <div className="flex flex-gap">
                                                        <button className="btn btn-sm btn-secondary" onClick={() => handleEditarPago(pago)}>
                                                            Editar
                                                        </button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleEliminarPago(pago)}>
                                                            Eliminar
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

            {/* WhatsApp Message Modal - Shared across all views */}
            {whatsappMessage && (
                <div className="modal-overlay">
                    <div className="modal card" style={{ maxWidth: '600px', width: '90%' }}>
                        <div className="card-header">
                            <h3 className="card-title">Mensaje de Pago Listo</h3>
                            <p className="card-subtitle">Previsualiza el mensaje antes de enviar</p>
                        </div>
                        <div className="card-body">
                            <textarea
                                className="form-input"
                                rows={10}
                                readOnly
                                value={whatsappMessage}
                                style={{ fontFamily: 'monospace', fontSize: '0.9rem', backgroundColor: 'var(--bg-light)' }}
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
                                    {copied ? 'Copiado ✅' : '📋 Copiar Mensaje'}
                                </button>
                                <a
                                    className="btn btn-primary"
                                    style={{ flex: 2 }}
                                    href={
                                        whatsappTo
                                            ? `https://wa.me/${whatsappTo}?text=${encodeURIComponent(whatsappMessage)}`
                                            : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    🚀 Abrir en WhatsApp
                                </a>
                                <button type="button" className="btn btn-secondary" onClick={() => setWhatsappMessage('')}>
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
