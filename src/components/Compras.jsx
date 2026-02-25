import { useState, useEffect } from 'react'
import { getExchangeRates, convertCurrency } from '../utils/exchangeRateService'
import { formatBs } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Compras({ compras, setCompras, productos, setProductos, tasaCambio }) {
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [mostrarModalPago, setMostrarModalPago] = useState(false)
    const [compraAPagar, setCompraAPagar] = useState(null)
    const [exchangeRates, setExchangeRates] = useState({})

    const [editingId, setEditingId] = useState(null)

    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        items: []
    })

    const [itemActual, setItemActual] = useState({
        producto_id: '',
        cantidad_kg: '',
        costo_cop_kg: ''
    })

    const [pagoData, setPagoData] = useState({
        monto_usd: '',
        metodo: 'Efectivo',
        referencia: ''
    })

    // Cargar tasas para conversiones
    useEffect(() => {
        const loadRates = async () => {
            try {
                const rates = await getExchangeRates()
                setExchangeRates(rates)
            } catch (error) {
                console.error('Error al cargar tasas en Compras:', error)
            }
        }
        loadRates()
    }, [])

    const handleAgregarItem = (e) => {
        e.preventDefault()
        const prodId = parseInt(itemActual.producto_id)
        const cantidad = parseFloat(itemActual.cantidad_kg)
        const costoCop = parseFloat(itemActual.costo_cop_kg)
        const producto = productos.find(p => p.id === prodId)

        if (!producto || isNaN(cantidad) || isNaN(costoCop) || cantidad <= 0 || costoCop <= 0) {
            alert('Datos del item inválidos.')
            return
        }

        // Calcular costo en USD para este item
        let costoUsdItem = 0
        if (exchangeRates && exchangeRates.COP) {
            const totalCopItem = costoCop * cantidad
            costoUsdItem = parseFloat(convertCurrency(totalCopItem, 'COP', 'USD').toFixed(2))
        } else {
            const tasaCop = 4200
            costoUsdItem = parseFloat(((costoCop * cantidad) / tasaCop).toFixed(2))
        }

        const nuevoItem = {
            id: Date.now() + Math.random(),
            producto_id: prodId,
            producto_nombre: producto.nombre,
            cantidad_kg: cantidad,
            costo_cop_kg: costoCop,
            subtotal_cop: costoCop * cantidad,
            subtotal_usd: costoUsdItem
        }

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, nuevoItem]
        }))

        setItemActual({ producto_id: '', cantidad_kg: '', costo_cop_kg: '' })
    }

    const eliminarItem = (id) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter(it => it.id !== id)
        }))
    }

    const handleEditarCompra = (compra) => {
        setFormData({
            fecha: new Date(compra.fecha).toISOString().split('T')[0],
            items: compra.items ? [...compra.items] : [{
                id: Date.now(),
                producto_id: compra.producto_id,
                producto_nombre: compra.producto_nombre,
                cantidad_kg: compra.cantidad_kg,
                costo_cop_kg: compra.costo_cop_kg,
                subtotal_cop: compra.total_cop,
                subtotal_usd: compra.total_deuda_usd
            }]
        })
        setEditingId(compra.id)
        setMostrarFormulario(true)
    }

    const handleEliminarCompra = (id) => {
        const compra = compras.find(c => c.id === id)
        if (!compra) return

        // 1. Revertir Stock
        // Si es multi-item
        let productosTemp = [...productos]
        if (compra.items && Array.isArray(compra.items)) {
            compra.items.forEach(item => {
                const idx = productosTemp.findIndex(p => p.id === item.producto_id)
                if (idx !== -1) {
                    // Restar lo que se había agregado
                    productosTemp[idx].cantidad_kg = Math.max(0, (parseFloat(productosTemp[idx].cantidad_kg) || 0) - item.cantidad_kg)
                }
            })
        } else {
            // Legacy single-item
            const idx = productosTemp.findIndex(p => p.id === compra.producto_id)
            if (idx !== -1) {
                productosTemp[idx].cantidad_kg = Math.max(0, (parseFloat(productosTemp[idx].cantidad_kg) || 0) - compra.cantidad_kg)
            }
        }
        setProductos(productosTemp)

        // 2. Eliminar Compra
        setCompras(compras.filter(c => c.id !== id))
    }

    const handleGuardarCompra = (e) => {
        e.preventDefault()

        if (formData.items.length === 0) {
            alert('Debe agregar al menos un producto a la compra.')
            return
        }

        let productosTemp = [...productos]

        // Si estamos editando, primero REVERTIMOS los cambios de la compra original
        if (editingId) {
            const compraOriginal = compras.find(c => c.id === editingId)
            if (compraOriginal) {
                if (compraOriginal.items && Array.isArray(compraOriginal.items)) {
                    compraOriginal.items.forEach(item => {
                        const idx = productosTemp.findIndex(p => p.id === item.producto_id)
                        if (idx !== -1) {
                            productosTemp[idx].cantidad_kg = Math.max(0, (parseFloat(productosTemp[idx].cantidad_kg) || 0) - item.cantidad_kg)
                        }
                    })
                } else {
                    const idx = productosTemp.findIndex(p => p.id === compraOriginal.producto_id)
                    if (idx !== -1) {
                        productosTemp[idx].cantidad_kg = Math.max(0, (parseFloat(productosTemp[idx].cantidad_kg) || 0) - compraOriginal.cantidad_kg)
                    }
                }
            }
        }

        // Calcular Totales Globales de la NUEVA data
        const totalCop = formData.items.reduce((sum, it) => sum + it.subtotal_cop, 0)
        const totalDeudaUsd = formData.items.reduce((sum, it) => sum + it.subtotal_usd, 0)

        // Aplicar los NUEVOS cambios al stock
        formData.items.forEach(item => {
            const idx = productosTemp.findIndex(p => p.id === item.producto_id)
            if (idx !== -1) {
                const p = productosTemp[idx]
                productosTemp[idx] = {
                    ...p,
                    cantidad_kg: (parseFloat(p.cantidad_kg) || 0) + item.cantidad_kg,
                    ppf_cop: item.costo_cop_kg // Actualizamos PPF al costo de esta entrada
                }
            }
        })
        setProductos(productosTemp)

        // Crear/Actualizar Registro de Compra
        const fechaCompra = new Date(formData.fecha)
        const fechaCurrentStr = (dateInput) => {
            const now = new Date()
            const selected = new Date(dateInput)
            if (selected.toDateString() === now.toDateString()) {
                return now.toISOString()
            }
            selected.setHours(12, 0, 0, 0)
            return selected.toISOString()
        }
        let fechaFinal = fechaCurrentStr(formData.fecha)

        const nuevaCompraData = {
            id: editingId || Date.now(),
            fecha: fechaFinal,
            items: formData.items,
            total_cop: totalCop,
            total_deuda_usd: parseFloat(totalDeudaUsd.toFixed(2)),
            saldo_pendiente_usd: parseFloat(totalDeudaUsd.toFixed(2)),
            estado: 'Pendiente',
            pagos: editingId ? (compras.find(c => c.id === editingId)?.pagos || []) : []
        }

        if (editingId) {
            setCompras(compras.map(c => c.id === editingId ? nuevaCompraData : c))
        } else {
            setCompras([nuevaCompraData, ...compras])
        }

        // Reset
        setFormData({ fecha: new Date().toISOString().split('T')[0], items: [] })
        setMostrarFormulario(false)
        setEditingId(null)
    }

    const abrirModalPago = (compra) => {
        setCompraAPagar(compra)
        setPagoData({ monto_usd: compra.saldo_pendiente_usd.toFixed(2), metodo: 'Efectivo', referencia: '' })
        setMostrarModalPago(true)
    }

    const handleRegistrarPago = (e) => {
        e.preventDefault()
        if (!compraAPagar) return

        const monto = parseFloat(pagoData.monto_usd)
        if (isNaN(monto) || monto <= 0 || monto > compraAPagar.saldo_pendiente_usd + 0.01) {
            alert('Monto inválido. No puede exceder el saldo pendiente.')
            return
        }

        const nuevoPago = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            monto_usd: monto,
            metodo: pagoData.metodo,
            referencia: pagoData.referencia
        }

        const comprasActualizadas = compras.map(c => {
            if (c.id === compraAPagar.id) {
                const nuevoSaldo = parseFloat(Math.max(0, c.saldo_pendiente_usd - monto).toFixed(2))
                return {
                    ...c,
                    saldo_pendiente_usd: nuevoSaldo,
                    estado: nuevoSaldo < 0.01 ? 'Pagada' : 'Pendiente',
                    pagos: [...c.pagos, nuevoPago]
                }
            }
            return c
        })

        setCompras(comprasActualizadas)
        setMostrarModalPago(false)
        setCompraAPagar(null)
    }

    const formatDate = (dateString) => {
        const d = new Date(dateString)
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    }

    return (
        <div className="slide-up">
            <div className="page-header flex-between">
                <div>
                    <h1 className="page-title">Compras e Inventario</h1>
                    <p className="page-subtitle">Registra entrada de mercancía y gestiona cuentas por pagar</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setMostrarFormulario(!mostrarFormulario)
                        setEditingId(null)
                        setFormData({ fecha: new Date().toISOString().split('T')[0], items: [] })
                    }}
                >
                    {mostrarFormulario ? 'Cancelar' : '+ Nueva Compra'}
                </button>
            </div>

            {mostrarFormulario && (
                <div className="card mb-4 fade-in">
                    <h3 className="mb-3">Registrar Entrada de Mercancía</h3>
                    <form onSubmit={handleGuardarCompra}>
                        <div className="grid grid-4 flex-gap">
                            <div className="form-group">
                                <label className="form-label">Fecha *</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={formData.fecha}
                                    onChange={e => setFormData({ ...formData, fecha: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Sección para agregar items */}
                        <div className="border p-3 rounded mb-3 bg-secondary-subtle">
                            <h5 className="mb-2">Agregar Producto</h5>
                            <div className="grid grid-4 flex-gap items-end">
                                <div className="form-group">
                                    <label className="form-label">Producto</label>
                                    <select
                                        className="form-select"
                                        value={itemActual.producto_id}
                                        onChange={e => setItemActual({ ...itemActual, producto_id: e.target.value })}
                                    >
                                        <option value="">Seleccione...</option>
                                        {productos.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cant. (Kg)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        className="form-input"
                                        value={itemActual.cantidad_kg}
                                        onChange={e => setItemActual({ ...itemActual, cantidad_kg: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Costo (COP/Kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={itemActual.costo_cop_kg}
                                        onChange={e => setItemActual({ ...itemActual, costo_cop_kg: e.target.value })}
                                        placeholder="Ej. 15000"
                                    />
                                </div>
                                <div className="form-group">
                                    <button
                                        type="button"
                                        className="btn btn-primary w-100"
                                        onClick={handleAgregarItem}
                                    >
                                        Agregar +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lista de Items Agregados */}
                        {formData.items.length > 0 && (
                            <div className="mb-3">
                                <h5>Items en esta Compra:</h5>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Cant.</th>
                                                <th>Costo Und.</th>
                                                <th>Subtotal (COP)</th>
                                                <th>Subtotal (USD)</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.items.map(item => (
                                                <tr key={item.id}>
                                                    <td>{item.producto_nombre}</td>
                                                    <td>{item.cantidad_kg} Kg</td>
                                                    <td>{item.costo_cop_kg.toLocaleString()}</td>
                                                    <td>{item.subtotal_cop.toLocaleString()}</td>
                                                    <td>${item.subtotal_usd.toFixed(2)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="text-danger btn-link"
                                                            onClick={() => eliminarItem(item.id)}
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="fw-bold">
                                                <td colSpan="3" className="text-right">Total:</td>
                                                <td>{formData.items.reduce((s, i) => s + i.subtotal_cop, 0).toLocaleString()}</td>
                                                <td>${formData.items.reduce((s, i) => s + i.subtotal_usd, 0).toFixed(2)}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="mt-3 flex justify-end">
                            <button
                                type="submit"
                                className="btn btn-success"
                                disabled={formData.items.length === 0}
                            >
                                Guardar Compra Completa
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-2 flex-gap mb-4">
                <div className="card bg-primary-light">
                    <h4>Cuentas por Pagar (USD)</h4>
                    <div className="stat-value text-primary">
                        ${compras.reduce((acc, c) => acc + c.saldo_pendiente_usd, 0).toFixed(2)}
                    </div>
                </div>
                <div className="card">
                    <h4>Última Tasa COP/USD</h4>
                    <div className="stat-value text-muted">
                        {exchangeRates.COP ? `~${Math.round(exchangeRates.COP).toLocaleString('es-CO')}` : 'Cargando...'}
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 className="mb-3">Historial de Compras</h3>
                {compras.length === 0 ? (
                    <p className="text-muted text-center py-4">No hay compras registradas.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Detalle</th>
                                    <th>Total (COP)</th>
                                    <th>Deuda (USD)</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {compras.map(compra => (
                                    <tr key={compra.id}>
                                        <td>{formatDate(compra.fecha)}</td>
                                        <td>
                                            {compra.items ? (
                                                <div style={{ fontSize: '0.9em' }}>
                                                    {compra.items.length} items: <br />
                                                    {compra.items.map(it => (
                                                        <span key={it.id} className="d-block text-muted">
                                                            - {it.producto_nombre} ({it.cantidad_kg}kg)
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                /* Backward compatibility for old single items */
                                                <div>
                                                    <strong>{compra.producto_nombre}</strong> <br />
                                                    {compra.cantidad_kg} Kg <br />
                                                    <small className="text-muted">a {parseFloat(compra.costo_cop_kg).toLocaleString('es-CO')} COP/Kg</small>
                                                </div>
                                            )}
                                        </td>
                                        <td>{parseFloat(compra.total_cop).toLocaleString('es-CO')} COP</td>
                                        <td>
                                            <div>Total: ${compra.total_deuda_usd.toFixed(2)}</div>
                                            <div className="text-danger">Pend: ${compra.saldo_pendiente_usd.toFixed(2)}</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${compra.estado === 'Pagada' ? 'badge-success' : 'badge-warning'}`}>
                                                {compra.estado}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex flex-gap">
                                                {compra.estado !== 'Pagada' && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => abrirModalPago(compra)}
                                                        title="Registrar Pago"
                                                    >
                                                        Pagar
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleEditarCompra(compra)}
                                                    title="Editar Compra"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => {
                                                        if (window.confirm('¿Está seguro de eliminar esta compra? El stock será revertido.')) {
                                                            handleEliminarCompra(compra.id)
                                                        }
                                                    }}
                                                    title="Eliminar Compra"
                                                >
                                                    🗑️
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

            {/* Modal de Pago */}
            {mostrarModalPago && (
                <div className="modal-backdrop" onClick={() => setMostrarModalPago(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Registrar Pago</h3>
                            <button className="close-btn" onClick={() => setMostrarModalPago(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p><strong>Producto:</strong> {compraAPagar.producto_nombre}</p>
                            <p><strong>Saldo Pendiente:</strong> ${compraAPagar.saldo_pendiente_usd.toFixed(2)} USD</p>

                            <form onSubmit={handleRegistrarPago} className="mt-3">
                                <div className="form-group mb-3">
                                    <label className="form-label">Monto a Pagar (USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={pagoData.monto_usd}
                                        onChange={e => setPagoData({ ...pagoData, monto_usd: e.target.value })}
                                        max={compraAPagar.saldo_pendiente_usd}
                                        required
                                    />
                                </div>
                                <div className="form-group mb-4">
                                    <select
                                        className="form-select"
                                        value={pagoData.metodo}
                                        onChange={e => setPagoData({ ...pagoData, metodo: e.target.value })}
                                    >
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Zelle">Zelle</option>
                                        <option value="Binance">Binance</option>
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                    </select>
                                </div>
                                <div className="form-group mb-4">
                                    <label className="form-label">Referencia / Nota</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={pagoData.referencia}
                                        onChange={e => setPagoData({ ...pagoData, referencia: e.target.value })}
                                        placeholder="Opcional. Ej: #123456"
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary w-100">Confirmar Pago</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
