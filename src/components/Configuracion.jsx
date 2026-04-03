import React, { useEffect, useState } from 'react'
import { formatBs } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Tooltip, Autocomplete, Snackbar, Alert as MuiAlert } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'
import { setPreferredRateSource, getPreferredRateSource, getUsdToVesRate, fetchRatesFromBcvUrl } from '../utils/exchangeRateService'

export default function Configuracion({ settings, setSettings, brecha, setBrecha, brechaBase, porcentajeCredito, setPorcentajeCredito, diasCredito, setDiasCredito, interesMoratorio, setInteresMoratorio, setTasaCambio }) {

    const [preferredSource, setPreferredSource] = useState('api')
    const [bcvUrl, setBcvUrl] = useState('https://agroflorca.ddns.net/sisconven/tasa_bcv.json')
    const [useProxy, setUseProxy] = useState(false)
    const [rateStatus, setRateStatus] = useState('')
    const [toastOpen, setToastOpen] = useState(false)
    const [toastMsg, setToastMsg] = useState('')
    const [toastSeverity, setToastSeverity] = useState('info')

    const showToast = (msg, severity = 'info', duration = 4000) => {
        setToastMsg(msg)
        setToastSeverity(severity)
        setToastOpen(true)
        setTimeout(() => setToastOpen(false), duration)
    }

    useEffect(() => {
        try {
            const p = getPreferredRateSource()
            if (p && p.type) {
                setPreferredSource(p.type)
                if (p.url) setBcvUrl(p.url)
                if (p.useProxy) setUseProxy(!!p.useProxy)
            }
        } catch (err) {
            console.warn('Could not load preferred rate source:', err)
        }
    }, [])

    const handleSaveRateSource = async () => {
        try {
            setRateStatus('Guardando...')
                // setRateStatus('Guardando...')
                showToast('Guardando...', 'info', 2000)

            // If BCV selected, first attempt to fetch and parse the JSON at the provided URL
            if (preferredSource === 'bcv') {
                try {
                    const rate = await fetchRatesFromBcvUrl(bcvUrl, useProxy)
                    // Save preference only after successful parse
                    setPreferredRateSource({ type: 'bcv', url: bcvUrl, useProxy })
                    const formatted = Number(parseFloat(rate).toFixed(2))
                    setRateStatus(`Tasa BCV: ${formatted.toFixed(2)} • OK`)
                        showToast(`Tasa BCV: ${formatted.toFixed(2)} • OK`, 'success', 5000)
                    if (typeof setTasaCambio === 'function') setTasaCambio(formatted)
                    setTimeout(() => setRateStatus(''), 5000)
                    return
                } catch (err) {
                    console.error('Error fetching/parsing BCV URL:', err)
                    // Provide clearer hint about CORS
                    const msg = err.message && err.message.toLowerCase().includes('failed to fetch')
                        ? 'Error al obtener el archivo (posible CORS o red). Puedes activar un proxy CORS en el servidor o usar la Fuente API.'
                        : `Error al obtener tasa BCV: ${err.message}`
                    setRateStatus(msg)
                        showToast(msg.includes('CORS') ? msg : `Error: ${msg}`, msg.includes('CORS') ? 'warning' : 'error', 7000)
                    setTimeout(() => setRateStatus(''), 7000)
                    return
                }
            }

            // Otherwise (API selected) just save preference
            setPreferredRateSource({ type: preferredSource, url: bcvUrl, useProxy })
            const newRate = await getUsdToVesRate()
            const formattedNew = Number(parseFloat(newRate).toFixed(2))
            setRateStatus(`Fuente API aplicada: ${formattedNew.toFixed(2)}`)
                showToast(`Fuente API aplicada: ${formattedNew.toFixed(2)}`, 'success', 4000)
            try { if (typeof setTasaCambio === 'function') setTasaCambio(formattedNew) } catch (e) { /* ignore */ }
            setTimeout(() => setRateStatus(''), 4000)
        } catch (err) {
            console.error('Error saving rate source:', err)
            setRateStatus('Error al aplicar la fuente; inténtalo nuevamente.')
                showToast('Error al aplicar la fuente; inténtalo nuevamente.', 'error', 4000)
            setTimeout(() => setRateStatus(''), 4000)
        }
    }

    // Calcular la brecha total: base (del dólar paralelo) + adicional del usuario
    const brechaTotal = brechaBase + brecha
    const PALETTES = {
        dark: [
            { id: 'indigo', name: 'Premium Indigo', primary: '#6366f1', secondary: '#8b5cf6' },
            { id: 'neon', name: 'Cyber Neon', primary: '#06b6d4', secondary: '#ec4899' },
            { id: 'ocean', name: 'Deep Ocean', primary: '#10b981', secondary: '#3b82f6' }
        ],
        light: [
            { id: 'clean', name: 'Modern Clean', primary: '#2563eb', secondary: '#6366f1' },
            { id: 'soft', name: 'Soft Sand', primary: '#d97706', secondary: '#92400e' },
            { id: 'nature', name: 'Nature Green', primary: '#059669', secondary: '#15803d' }
        ]
    }

    const handleThemeChange = (theme) => {
        const defaultPalette = theme === 'light' ? 'clean' : 'indigo'
        setSettings({ ...settings, theme, palette: defaultPalette })
    }

    const handlePaletteChange = (paletteId) => {
        setSettings({ ...settings, palette: paletteId })
    }

    const handleFontSizeChange = (e) => {
        setSettings({ ...settings, fontSize: parseInt(e.target.value) })
    }

    const currentPalettes = settings.theme === 'light' ? PALETTES.light : PALETTES.dark

    return (
        <div className="container main-content-fixed slide-up">
            <div className="page-header">
                <h1 className="page-title">Configuración</h1>
                <p className="page-subtitle">Personaliza el aspecto y las variables del sistema</p>
            </div>

            <div className="grid grid-2">
                {/* Configuración de Ventas y Precios (NUEVO) */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 className="mb-4">💰 Variables de Ventas y Precios</h3>

                    {/* Mostrar info de brecha base del dólar paralelo vs oficial */}
                    {brechaBase > 0 && (
                        <div className="card mb-4" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--warning)' }}>
                            <div className="flex-between">
                                <div>
                                    <div className="text-small text-muted">Brecha Dólar Paralelo vs Oficial (BCV)</div>
                                    <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--warning)' }}>
                                        {brechaBase.toFixed(2)}%
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="text-small text-muted">Brecha Total Aplicada</div>
                                    <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>
                                        {brechaTotal.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-3 flex-gap">
                        <div className="form-group">
                            <label className="form-label">Fuente de la tasa</label>
                            <p className="text-small text-muted mb-2">Elige la fuente para convertir USD→VES usada en facturas y reportes.</p>
                            <div className="flex flex-gap mt-2">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="radio" name="rate_source" value="api" checked={preferredSource==='api'} onChange={() => setPreferredSource('api')} /> API (DolarAPI)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                                    <input type="radio" name="rate_source" value="bcv" checked={preferredSource==='bcv'} onChange={() => setPreferredSource('bcv')} /> BCV JSON
                                </label>
                            </div>
                            {preferredSource === 'bcv' && (
                                <div style={{ marginTop: '8px' }}>
                                    <input type="text" className="form-input" value={bcvUrl} onChange={(e) => setBcvUrl(e.target.value)} />
                                    <p className="text-small text-muted mt-1">URL del JSON que devuelve la tasa BCV (editable).</p>
                                    <div style={{ marginTop: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} /> Forzar uso de proxy CORS (AllOrigins)
                                        </label>
                                        <div style={{ marginTop: '6px' }}>
                                            <button type="button" className="btn btn-secondary" onClick={async () => {
                                
                                                try {
                                                    await navigator.clipboard.writeText(curl)
                                                        // setRateStatus('Comando curl copiado al portapapeles')
                                                        showToast('Comando curl copiado al portapapeles', 'info', 2500)
                                                        setTimeout(() => setRateStatus(''), 2500)
                                                } catch (err) {
                                                    // setRateStatus('No se pudo copiar el comando curl')
                                                    showToast('No se pudo copiar el comando curl', 'error', 2500)
                                                    setTimeout(() => setRateStatus(''), 2500)
                                                }
                                            }}>Copiar comando curl</button>
                                            <span style={{ marginLeft: '8px' }} className="text-small text-muted">(útil para probar desde terminal)</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div style={{ marginTop: '8px' }}>
                                <button type="button" className="btn btn-primary" onClick={handleSaveRateSource}>Guardar Fuente</button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Incremento de Brecha</label>
                            <p className="text-small text-muted mb-2">Porcentaje adicional sobre la brecha del dólar paralelo.</p>
                            <div className="flex items-center" style={{ gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={brecha}
                                    onChange={(e) => setBrecha(parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', fontWeight: 'bold' }}
                                    step="0.01"
                                    min="0"
                                />
                                <span style={{ fontWeight: 600 }}>%</span>
                            </div>
                            <p className="text-small text-muted mt-1">
                                Brecha base: {brechaBase.toFixed(2)}% + Incremento: {brecha}% = Total: {brechaTotal.toFixed(2)}%
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Recargo para Ventas a Crédito</label>
                            <p className="text-small text-muted mb-2">Porcentaje adicional aplicado al precio base en ventas a crédito.</p>
                            <div className="flex items-center" style={{ gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={porcentajeCredito}
                                    onChange={(e) => setPorcentajeCredito(parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', fontWeight: 'bold' }}
                                    step="0.01"
                                    min="0"
                                />
                                <span style={{ fontWeight: 600 }}>%</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Días de Crédito</label>
                            <p className="text-small text-muted mb-2">Número de días que el cliente tiene para pagar una factura a crédito.</p>
                            <div className="flex items-center" style={{ gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={diasCredito}
                                    onChange={(e) => setDiasCredito(parseInt(e.target.value) || 0)}
                                    style={{ width: '100%', fontWeight: 'bold' }}
                                    step="1"
                                    min="0"
                                />
                                <span style={{ fontWeight: 600 }}>días</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Interés Moratorio</label>
                            <p className="text-small text-muted mb-2">Porcentaje de recargo de mora (por mes) al vencer crédito.</p>
                            <div className="flex items-center" style={{ gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={interesMoratorio}
                                    onChange={(e) => setInteresMoratorio(parseFloat(e.target.value) || 0)}
                                    style={{ width: '100%', fontWeight: 'bold' }}
                                    step="0.01"
                                    min="0"
                                />
                                <span style={{ fontWeight: 600 }}>%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tema y Tamaño de Fuente */}
                <div className="card">
                    <h3 className="mb-4">🎨 Apariencia</h3>

                    <div className="form-group">
                        <label className="form-label">Tema de la Aplicación</label>
                        <div className="flex flex-gap mt-2">
                            <button
                                className={`btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleThemeChange('light')}
                                style={{ flex: 1 }}
                            >
                                🌞 Claro
                            </button>
                            <button
                                className={`btn ${settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleThemeChange('dark')}
                                style={{ flex: 1 }}
                            >
                                🌙 Oscuro
                            </button>
                        </div>
                    </div>

                    <div className="form-group mt-4">
                        <label className="form-label flex-between">
                            Tamaño de Fuente
                            <span>{settings.fontSize}px</span>
                        </label>
                        <input
                            type="range"
                            min="12"
                            max="20"
                            step="1"
                            value={settings.fontSize}
                            onChange={handleFontSizeChange}
                            className="mt-2"
                            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                        />
                        <div className="flex-between text-small text-muted mt-1">
                            <span>Pequeña</span>
                            <span>Normal</span>
                            <span>Grande</span>
                        </div>
                    </div>
                </div>

                {/* Paletas de Colores */}
                <div className="card">
                    <h3 className="mb-4">Paleta de Colores</h3>
                    <div className="grid gap-3">
                        {currentPalettes.map((p) => (
                            <div
                                key={p.id}
                                className={`card p-3 flex-between ${settings.palette === p.id ? 'active-palette' : ''}`}
                                onClick={() => handlePaletteChange(p.id)}
                                style={{
                                    cursor: 'pointer',
                                    border: settings.palette === p.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                    background: 'var(--bg-tertiary)'
                                }}
                            >
                                <div>
                                    <h4 className="mb-1">{p.name}</h4>
                                    <div className="flex flex-gap">
                                        <div style={{ width: '24px', height: '24px', background: p.primary, borderRadius: '4px' }}></div>
                                        <div style={{ width: '24px', height: '24px', background: p.secondary, borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                {settings.palette === p.id && <span style={{ color: 'var(--accent-primary)' }}>✓ Seleccionado</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card mt-4">
                <h3>Previsualización</h3>
                <p className="mt-2 text-muted">Así se verá el contenido del sistema con tu configuración actual.</p>
                <div className="mt-4 p-4" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <h4 className="mb-2">Título de Ejemplo</h4>
                    <p className="mb-3">Este es un párrafo de texto para visualizar el tamaño de la fuente y los colores de base.</p>
                    <div className="flex flex-gap">
                        <button className="btn btn-primary">Botón Primario</button>
                        <button className="btn btn-secondary">Botón Secundario</button>
                        <span className="badge badge-success">Badge Success</span>
                    </div>
                </div>
            </div>
                <Snackbar open={toastOpen} autoHideDuration={4000} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                    <MuiAlert onClose={() => setToastOpen(false)} severity={toastSeverity} sx={{ width: '100%' }}>
                        {toastMsg}
                    </MuiAlert>
                </Snackbar>
        </div>
    )
}
