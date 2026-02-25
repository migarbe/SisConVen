import { useState, useEffect } from 'react'
import { getExchangeRates, convertCurrency } from '../utils/exchangeRateService'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material'

export default function Productos({ productos, setProductos, brechaGlobal, porcentajeCredito }) {
    const LOW_STOCK_THRESHOLD = 5 // Kg
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [editando, setEditando] = useState(null)
    const [exchangeRates, setExchangeRates] = useState({})

    const [formData, setFormData] = useState({
        nombre: '',
        ppf_cop: '',
        comision_tipo: 'porcentaje',
        comision_valor: '0',
        ganancia_tipo: 'porcentaje',
        ganancia_valor: '0',
        precio_usd: 0,
        precio_credito: 0,
        cantidad_kg: ''
    })
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' })

    // Cargar tasas de cambio para cálculos
    useEffect(() => {
        const loadRates = async () => {
            try {
                const rates = await getExchangeRates()
                setExchangeRates(rates)
            } catch (error) {
                console.error('Error al cargar tasas en Productos:', error)
            }
        }
        loadRates()
    }, [])

    // Recalcular precios cuando cambian los inputs
    useEffect(() => {
        if (!exchangeRates || Object.keys(exchangeRates).length === 0) return

        const ppf = parseFloat(formData.ppf_cop) || 0
        const brecha = parseFloat(brechaGlobal) || 0
        const pctCredito = parseFloat(porcentajeCredito) || 0

        // 1. Convertir PPF a USD
        const ppf_usd = parseFloat(convertCurrency(ppf, 'COP', 'USD').toFixed(2))

        // 2. Aplicar Brecha
        const base_usd = parseFloat((ppf_usd * (1 + (brecha / 100))).toFixed(2))

        // 3. Calcular Comisión
        let comision_val = 0
        const c_val = parseFloat(formData.comision_valor) || 0
        if (formData.comision_tipo === 'porcentaje') {
            comision_val = parseFloat((base_usd * (c_val / 100)).toFixed(2))
        } else {
            comision_val = c_val
        }

        // 4. Calcular Ganancia
        let ganancia_val = 0
        const g_val = parseFloat(formData.ganancia_valor) || 0
        if (formData.ganancia_tipo === 'porcentaje') {
            ganancia_val = parseFloat((base_usd * (g_val / 100)).toFixed(2))
        } else {
            ganancia_val = g_val
        }

        const precio_contado = parseFloat((base_usd + comision_val + ganancia_val).toFixed(2))
        const precio_credito = parseFloat((precio_contado * (1 + (pctCredito / 100))).toFixed(2))

        setFormData(prev => ({
            ...prev,
            precio_usd: precio_contado,
            precio_credito: precio_credito
        }))
    }, [formData.ppf_cop, brechaGlobal, porcentajeCredito, formData.comision_tipo, formData.comision_valor, formData.ganancia_tipo, formData.ganancia_valor, exchangeRates])

    const handleSubmit = (e) => {
        e.preventDefault()

        const dataToSave = {
            ...formData,
            ppf_cop: parseFloat(formData.ppf_cop) || 0,
            comision_valor: parseFloat(formData.comision_valor) || 0,
            ganancia_valor: parseFloat(formData.ganancia_valor) || 0,
            precio_usd: parseFloat(formData.precio_usd) || 0,
            precio_credito: parseFloat(formData.precio_credito) || 0,
            cantidad_kg: parseFloat(formData.cantidad_kg) || 0
        }

        if (editando) {
            setProductos(productos.map(p =>
                p.id === editando.id ? {
                    ...p,
                    ...dataToSave,
                    id: editando.id
                } : p
            ))
            setEditando(null)
        } else {
            const nuevoProducto = {
                ...dataToSave,
                id: Date.now()
            }
            setProductos([...productos, nuevoProducto])
        }

        setFormData({
            nombre: '',
            ppf_cop: '',
            comision_tipo: 'porcentaje',
            comision_valor: '0',
            ganancia_tipo: 'porcentaje',
            ganancia_valor: '0',
            precio_usd: 0,
            precio_credito: 0,
            cantidad_kg: ''
        })
        setMostrarFormulario(false)
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

    const productosFiltradosYOrdenados = [...productos]
        .filter(p => {
            const search = searchTerm.toLowerCase()
            return (
                p.nombre.toLowerCase().includes(search) ||
                (p.id || '').toString().includes(search)
            )
        })
        .sort((a, b) => {
            let valA = a[sortConfig.key]
            let valB = b[sortConfig.key]

            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })

    const handleEditar = (producto) => {
        setFormData({
            nombre: producto.nombre,
            ppf_cop: (producto.ppf_cop || 0).toString(),
            comision_tipo: producto.comision_tipo || 'porcentaje',
            comision_valor: (producto.comision_valor || 0).toString(),
            ganancia_tipo: producto.ganancia_tipo || 'porcentaje',
            ganancia_valor: (producto.ganancia_valor || 0).toString(),
            precio_usd: producto.precio_usd || 0,
            precio_credito: producto.precio_credito || 0,
            cantidad_kg: (producto.cantidad_kg || 0).toString()
        })
        setEditando(producto)
        setMostrarFormulario(true)
    }

    const handleEliminar = (id) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            setProductos(productos.filter(p => p.id !== id))
        }
    }

    const handleCancelar = () => {
        setFormData({
            nombre: '',
            ppf_cop: '',
            brecha: '0',
            comision_tipo: 'porcentaje',
            comision_valor: '0',
            ganancia_tipo: 'porcentaje',
            ganancia_valor: '0',
            precio_usd: 0,
            precio_credito: 0,
            cantidad_kg: ''
        })
        setEditando(null)
        setMostrarFormulario(false)
    }

    return (
        <div className="slide-up">
            <div className="page-header flex-between">
                <div>
                    <h1 className="page-title">Productos</h1>
                    <p className="page-subtitle">Gestiona tu catálogo de productos</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        if (mostrarFormulario) handleCancelar()
                        else setMostrarFormulario(true)
                    }}
                >
                    {mostrarFormulario ? 'Cancelar' : '+ Nuevo Producto'}
                </button>
            </div>

            {mostrarFormulario && (
                <div className="card mb-4 fade-in">
                    <div className="card-header">
                        <h3 className="card-title">
                            {editando ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-2 flex-gap">
                            <div className="form-group">
                                <label className="form-label">Nombre del Producto *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">PPF (COP) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input"
                                    value={formData.ppf_cop}
                                    onChange={(e) => setFormData({ ...formData, ppf_cop: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-1 mt-3">
                            <div className="form-group">
                                <label className="form-label">Cantidad (Kg.)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    className="form-input"
                                    value={formData.cantidad_kg}
                                    onChange={(e) => setFormData({ ...formData, cantidad_kg: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-2 flex-gap">
                            <div className="card bg-light p-3">
                                <h4 className="mb-2">Comisión</h4>
                                <div className="flex flex-gap">
                                    <select
                                        className="form-input"
                                        style={{ width: '130px' }}
                                        value={formData.comision_tipo}
                                        onChange={(e) => setFormData({ ...formData, comision_tipo: e.target.value })}
                                    >
                                        <option value="porcentaje">Porcentual (%)</option>
                                        <option value="fijo">Fijo (USD)</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={formData.comision_valor}
                                        onChange={(e) => setFormData({ ...formData, comision_valor: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="card bg-light p-3">
                                <h4 className="mb-2">Ganancia</h4>
                                <div className="flex flex-gap">
                                    <select
                                        className="form-input"
                                        style={{ width: '130px' }}
                                        value={formData.ganancia_tipo}
                                        onChange={(e) => setFormData({ ...formData, ganancia_tipo: e.target.value })}
                                    >
                                        <option value="porcentaje">Porcentual (%)</option>
                                        <option value="fijo">Fijo (USD)</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={formData.ganancia_valor}
                                        onChange={(e) => setFormData({ ...formData, ganancia_valor: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card border-primary p-3 mt-3 mb-4 bg-primary-light">
                            <div className="grid grid-3 text-center">
                                <div>
                                    <div className="text-small text-muted">Precio de Contado</div>
                                    <div className="stat-value text-primary">${(formData.precio_usd || 0).toFixed(2)} USD</div>
                                </div>
                                <div>
                                    <div className="text-small text-muted">Precio a Crédito (+{porcentajeCredito}%)</div>
                                    <div className="stat-value text-success">${(formData.precio_credito || 0).toFixed(2)} USD</div>
                                </div>
                                <div>
                                    <div className="text-small text-muted">Brecha Global</div>
                                    <div className="stat-value text-muted" style={{ opacity: 0.8 }}>{brechaGlobal}%</div>
                                </div>
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
                </div >
            )
            }

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Catálogo de Productos</h3>
                    <div className="flex flex-gap items-center flex-wrap">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ maxWidth: '250px' }}
                        />
                        <select
                            className="form-select"
                            value={`${sortConfig.key}-${sortConfig.direction}`}
                            onChange={(e) => {
                                const [key, dir] = e.target.value.split('-')
                                setSortConfig({ key, direction: dir })
                            }}
                            style={{ maxWidth: '200px' }}
                        >
                            <option value="nombre-asc">Nombre (A-Z)</option>
                            <option value="nombre-desc">Nombre (Z-A)</option>
                            <option value="precio_usd-asc">Precio Menor</option>
                            <option value="precio_usd-desc">Precio Mayor</option>
                            <option value="cantidad_kg-asc">Stock Menor</option>
                            <option value="cantidad_kg-desc">Stock Mayor</option>
                        </select>
                        <p className="card-subtitle">{productos.length} producto(s) disponible(s)</p>
                    </div>
                </div>

                {productos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📦</div>
                        <p>No hay productos registrados</p>
                        <button className="btn btn-primary mt-2" onClick={() => setMostrarFormulario(true)}>
                            Agregar Primer Producto
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-3">
                        {productosFiltradosYOrdenados.map((producto) => (
                            <div key={producto.id} className="card">
                                <h4>{producto.nombre}</h4>
                                <div className="flex-between mt-2">
                                    <div>
                                        <div className="text-small text-muted">Contado</div>
                                        <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                                            ${(producto.precio_usd || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="text-small text-muted">Crédito (+{porcentajeCredito}%)</div>
                                        <div className="stat-value text-success" style={{ fontSize: '1.1rem' }}>
                                            ${(producto.precio_usd * (1 + (porcentajeCredito / 100))).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <hr className="my-2" style={{ opacity: 0.1 }} />
                                <div className="grid grid-2 flex-gap">
                                    <div className="text-small">
                                        <span className="text-muted">PPF:</span> {(producto.ppf_cop || 0).toLocaleString('es-VE')} COP
                                    </div>
                                    <div className="text-small" style={{ textAlign: 'right' }}>
                                        <span className="text-muted">Brecha:</span> {brechaGlobal}%
                                    </div>
                                </div>
                                <div className="text-small mt-2">Stock: {((producto.cantidad_kg || 0)).toLocaleString('es-VE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Kg.
                                    {((producto.cantidad_kg || 0) <= 0) ? (
                                        <span className="badge badge-danger" style={{ marginLeft: '0.5rem' }}>Sin stock</span>
                                    ) : ((producto.cantidad_kg || 0) < LOW_STOCK_THRESHOLD) ? (
                                        <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Bajo stock</span>
                                    ) : null}
                                </div>
                                <div className="flex flex-gap mt-3">
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => handleEditar(producto)}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleEliminar(producto.id)}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    )
}
