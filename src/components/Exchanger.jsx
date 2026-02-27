import { useState, useEffect } from 'react'
import {
    fetchExchangeRates,
    convertCurrency,
    formatNumber,
    getLastUpdateString,
    getDollarBrecha,
    getRateSource,
    getBcvFechaVigencia
} from '../utils/exchangeRateService'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

const CURRENCY_FLAGS = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    COP: '🇨🇴',
    VES: '🇻🇪'
}

const CURRENCIES = ['USD', 'COP', 'VES']

const CURRENCY_NAMES = {
    USD: 'Dólar Estadounidense',
    COP: 'Peso Colombiano',
    VES: 'Bolívar Venezolano'
}

export default function Exchanger() {
    const [exchangeRates, setExchangeRates] = useState({})
    const [lastUpdate, setLastUpdate] = useState('')
    const [fromAmount, setFromAmount] = useState(1)
    const [toAmount, setToAmount] = useState(0)
    const [fromCurrency, setFromCurrency] = useState('USD')
    const [toCurrency, setToCurrency] = useState('VES')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [brechaInfo, setBrechaInfo] = useState(null)
    const [rateSource, setRateSource] = useState(getRateSource())
    const [bcvFecha, setBcvFecha] = useState(getBcvFechaVigencia())

    // Fetch rates on mount
    useEffect(() => {
        loadRates()
        loadBrecha()
        // Auto-refresh every 60 minutes
        const interval = setInterval(loadRates, 60 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const loadBrecha = async () => {
        try {
            const brecha = await getDollarBrecha()
            setBrechaInfo(brecha)
        } catch (err) {
            console.error('Error loading brecha:', err)
        }
    }

    // Update conversion when inputs change
    useEffect(() => {
        updateConversion()
    }, [fromAmount, fromCurrency, toCurrency, exchangeRates])

    // Update last update time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setLastUpdate(getLastUpdateString())
        }, 60000)
        return () => clearInterval(interval)
    }, [])

    const loadRates = async () => {
        setLoading(true)
        setError(null)
        try {
            const rates = await fetchExchangeRates()
            setExchangeRates(rates)
            setLastUpdate(getLastUpdateString())
            setRateSource(getRateSource())
            setBcvFecha(getBcvFechaVigencia())
        } catch (err) {
            setError('Error al cargar las tasas de cambio. Usando datos en caché.')
            console.error('Error loading rates:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateConversion = () => {
        if (!exchangeRates || Object.keys(exchangeRates).length === 0) return

        // Handle empty input gracefully
        const amount = parseFloat(fromAmount) || 0
        const converted = convertCurrency(amount, fromCurrency, toCurrency)
        setToAmount(converted)
    }

    const handleSwap = () => {
        setFromCurrency(toCurrency)
        setToCurrency(fromCurrency)
        // Animation handled by CSS
    }

    const handleRefresh = async () => {
        await loadRates()
    }

    const getRatesGrid = () => {
        const pairs = [
            { from: 'USD', to: 'VES' },
            { from: 'USD', to: 'COP' },
            { from: 'VES', to: 'COP' }
        ]

        return pairs.map(pair => {
            const rate = convertCurrency(1, pair.from, pair.to)
            return (
                <div key={`${pair.from}-${pair.to}`} className="rate-item">
                    <span className="rate-pair">
                        {CURRENCY_FLAGS[pair.from]} {pair.from} → {CURRENCY_FLAGS[pair.to]} {pair.to}
                    </span>
                    <span className="rate-value">{formatNumber(rate)}</span>
                </div>
            )
        })
    }


    return (
        <div className="slide-up">
            <div className="page-header">
                <h1 className="page-title">💱 Tasas de Cambio</h1>
                <p className="page-subtitle">Conversor de divisas con tasas en tiempo real</p>
            </div>

            {/* Error Toast */}
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

            {/* Exchange Rates Panel */}
            <div className="card mb-4">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 className="card-title">Tasas de Cambio Actuales</h3>
                        <p className="card-subtitle">Principales pares de divisas</p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={loading}
                        style={{ minWidth: '120px' }}
                    >
                        {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
                    </button>
                </div>

                <div className="card-body">
                    <div className="rates-grid">{getRatesGrid()}</div>

                    <div className="text-small text-muted mt-3" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🕐</span>
                        <span>Última actualización: {lastUpdate || 'Cargando...'}</span>
                    </div>

                    {(rateSource || bcvFecha) && (
                        <div className="text-small text-muted mt-1" style={{ display: 'flex', gap: '0.5rem' }}>
                            {rateSource && <span>Fuente: {rateSource}</span>}
                            {rateSource && bcvFecha && <span>•</span>}
                            {bcvFecha && <span>Fecha vigencia: {bcvFecha}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Brecha del Dólar */}
            {brechaInfo && (
                <div className="card mb-4" style={{
                    borderLeft: '4px solid var(--warning)',
                    background: 'rgba(245, 158, 11, 0.05)'
                }}>
                    <div className="card-header">
                        <h3 className="card-title">💹 Brecha del Dólar (Oficial vs Paralelo)</h3>
                        <p className="card-subtitle">Diferencia porcentual entre el dólar oficial y el paralelo</p>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-3" style={{ gap: 'var(--spacing-lg)' }}>
                            <div className="text-center">
                                <div className="text-small text-muted">Dólar Oficial (BCV)</div>
                                <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--success)' }}>
                                    {brechaInfo.oficial?.toFixed(2)} Bs.
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-small text-muted">Dólar Paralelo</div>
                                <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--warning)' }}>
                                    {brechaInfo.paralelo?.toFixed(2)} Bs.
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-small text-muted">Brecha</div>
                                <div className="stat-value" style={{
                                    fontSize: '1.5rem',
                                    color: brechaInfo.brecha > 0 ? 'var(--danger)' : 'var(--success)'
                                }}>
                                    {brechaInfo.brecha > 0 ? '+' : ''}{brechaInfo.brecha}%
                                </div>
                            </div>
                        </div>
                        <div className="text-small text-muted mt-3 text-center">
                            🕐 Actualizado: {new Date(brechaInfo.fechaActualizacion).toLocaleString('es-VE')}
                        </div>
                    </div>
                </div>
            )}

            {/* Currency Converter */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Convertir Divisas</h3>
                    <p className="card-subtitle">Conversión instantánea entre monedas</p>
                </div>

                <div className="card-body">
                    {/* From Currency */}
                    <div className="mb-3">
                        <label className="form-label">Desde</label>
                        <div className="grid grid-2" style={{ gap: '1rem' }}>
                            <input
                                type="number"
                                className="form-input"
                                value={fromAmount}
                                onChange={(e) => setFromAmount(e.target.value || 0)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                            <select
                                className="form-input"
                                value={fromCurrency}
                                onChange={(e) => setFromCurrency(e.target.value)}
                            >
                                {CURRENCIES.map(curr => (
                                    <option key={curr} value={curr}>
                                        {CURRENCY_FLAGS[curr]} {curr} - {CURRENCY_NAMES[curr]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={handleSwap}
                            style={{
                                borderRadius: '50%',
                                width: '48px',
                                height: '48px',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Intercambiar divisas"
                        >
                            ⇅
                        </button>
                    </div>

                    {/* To Currency */}
                    <div className="mb-3">
                        <label className="form-label">A</label>
                        <div className="grid grid-2" style={{ gap: '1rem' }}>
                            <input
                                type="number"
                                className="form-input"
                                value={formatNumber(toAmount)}
                                readOnly
                                placeholder="0.00"
                                style={{ background: 'var(--bg-secondary)' }}
                            />
                            <select
                                className="form-input"
                                value={toCurrency}
                                onChange={(e) => setToCurrency(e.target.value)}
                            >
                                {CURRENCIES.map(curr => (
                                    <option key={curr} value={curr}>
                                        {CURRENCY_FLAGS[curr]} {curr} - {CURRENCY_NAMES[curr]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Conversion Result */}
                    <div className="card" style={{ background: 'var(--bg-secondary)', marginTop: '1.5rem' }}>
                        <div className="card-body" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600 }}>{formatNumber(fromAmount)} {fromCurrency}</span>
                                {' = '}
                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                    {formatNumber(toAmount)} {toCurrency}
                                </span>
                            </div>
                            <div className="text-small text-muted">
                                Tasa: 1 {fromCurrency} = {formatNumber(convertCurrency(1, fromCurrency, toCurrency))} {toCurrency}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="text-center text-muted mt-4" style={{ fontSize: '0.875rem' }}>
                <p>Datos de divisas: DolarAPI (Venezuela)</p>
                <p className="text-small">Las tasas se actualizan automáticamente cada 60 minutos</p>
            </div>
        </div>
    )
}
