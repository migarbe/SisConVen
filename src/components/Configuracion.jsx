import React from 'react'
import { formatBs } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Configuracion({ settings, setSettings, brecha, setBrecha, brechaBase, porcentajeCredito, setPorcentajeCredito, diasCredito, setDiasCredito }) {

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
        </div>
    )
}
