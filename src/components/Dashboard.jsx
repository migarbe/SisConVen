import { useState, useEffect } from 'react'
import { formatBs } from '../utils/formatters'
import { fetchExchangeRates, getLastUpdateString, getDollarBrecha, getApiStatus, getRateSource, getBcvFechaVigencia } from '../utils/exchangeRateService'
import { Box, Typography, Grid, Card, CardContent, Chip, Button, LinearProgress, Alert, IconButton, Tooltip } from '@mui/material'
import { Refresh as RefreshIcon, TrendingUp as TrendingUpIcon, AttachMoney as AttachMoneyIcon, ShoppingCart as ShoppingCartIcon, Info as InfoIcon } from '@mui/icons-material'

export default function Dashboard({ facturas, pagos, tasaCambio, setTasaCambio, clientes, productos = [], vendedores = [], pedidos = [], setCurrentView, onVerDetalleFactura, onVerDetalleVendedor }) {
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(getLastUpdateString())
    const [brechaInfo, setBrechaInfo] = useState(null)
    const [loadingBrecha, setLoadingBrecha] = useState(false)
    const [rateSource, setRateSource] = useState(getRateSource())
    const [bcvFecha, setBcvFecha] = useState(getBcvFechaVigencia())
    const LOW_STOCK_THRESHOLD = 5 // Kg
    // incluir productos con 0 Kg y los que están por debajo del umbral
    const lowStockList = productos.filter(p => (p.cantidad_kg || 0) < LOW_STOCK_THRESHOLD)
    const lowStockCount = lowStockList.length

    // Fetch brecha info and API status on mount
    useEffect(() => {
        const loadBrecha = async () => {
            setLoadingBrecha(true)
            try {
                const brecha = await getDollarBrecha()
                setBrechaInfo(brecha)
            } catch (error) {
                console.error('Error loading brecha:', error)
            } finally {
                setLoadingBrecha(false)
            }
        }
        
        const loadApiStatus = async () => {
            try {
                await getApiStatus()
            } catch (error) {
                console.warn('Error loading API status:', error)
            }
        }
        
        loadBrecha()
        loadApiStatus()
        // set initial source and fecha if available
        try {
            setRateSource(getRateSource())
            setBcvFecha(getBcvFechaVigencia())
        } catch (err) {
            // ignore
        }
    }, [])

    const daysBetween = (from, to) => {
        const msPerDay = 1000 * 60 * 60 * 24
        // floor for past days, ceil for future? we'll use Math.ceil for remaining days
        return Math.ceil((to - from) / msPerDay)
    }

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

    // interpolate between two hex colors (#rrggbb)
    const interpolateHex = (hex1, hex2, t) => {
        const h1 = hex1.replace('#', '')
        const h2 = hex2.replace('#', '')
        const r1 = parseInt(h1.slice(0, 2), 16)
        const g1 = parseInt(h1.slice(2, 4), 16)
        const b1 = parseInt(h1.slice(4, 6), 16)
        const r2 = parseInt(h2.slice(0, 2), 16)
        const g2 = parseInt(h2.slice(2, 4), 16)
        const b2 = parseInt(h2.slice(4, 6), 16)
        const r = Math.round(r1 + (r2 - r1) * t)
        const g = Math.round(g1 + (g2 - g1) * t)
        const b = Math.round(b1 + (b2 - b1) * t)
        const toHex = (n) => n.toString(16).padStart(2, '0')
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    const getDueInfo = (factura) => {
        const fecha = new Date(factura.fecha)
        const dueDate = new Date(fecha.getTime() + 15 * 24 * 60 * 60 * 1000)
        const today = new Date()
        // daysUntil: positive if due in future (days left), 0 if due today, negative if overdue
        const diffDaysFloat = Math.floor((dueDate.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
        const daysUntil = diffDaysFloat

        if (daysUntil >= 0) {
            // not yet due: color scale green -> orange -> red as it approaches due date
            // thresholds: <=2 red, 3-4 orange, >=5 green
            let color = '#16a34a' // green
            if (daysUntil <= 2) color = '#ef4444' // red
            else if (daysUntil <= 4) color = '#f59e0b' // orange
            else color = '#16a34a' // green
            const label = daysUntil === 0 ? 'Vence hoy' : `Vence en ${daysUntil} día${daysUntil > 1 ? 's' : ''}`
            return { days: daysUntil, label, color, overdue: false }
        } else {
            // overdue: days past due as positive number
            const daysPast = Math.abs(daysUntil)
            // map daysPast (1..30+) to gradient red -> burgundy
            const t = clamp((daysPast - 1) / 29, 0, 1)
            const color = interpolateHex('#ef4444', '#5b0b0b', t)
            const label = `Vencida ${daysPast} día${daysPast > 1 ? 's' : ''}`
            return { days: daysPast, label, color, overdue: true }
        }
    }

    // Calcular estadísticas de comisiones
    const resumenComisiones = vendedores.map(vendedor => {
        const facturasVendedor = facturas.filter(f => f.vendedor_id?.toString() === vendedor.id.toString() && f.comisiones_total > 0)
        const totalGenerado = parseFloat(facturasVendedor.reduce((sum, f) => sum + (f.comisiones_total || 0), 0).toFixed(2))
        const totalPagado = parseFloat((vendedor.pagos_comisiones || []).reduce((sum, p) => sum + p.monto_usd, 0).toFixed(2))
        const totalPendiente = parseFloat(Math.max(0, totalGenerado - totalPagado).toFixed(2))

        return {
            id: vendedor.id,
            nombre: vendedor.nombre,
            generado: totalGenerado,
            pagado: totalPagado,
            pendiente: totalPendiente
        }
    }).filter(rc => rc.generado > 0)

    const totalComisionesPendientesUSD = parseFloat(resumenComisiones.reduce((sum, rc) => sum + rc.pendiente, 0).toFixed(2))

    // Calcular estadísticas
    const totalFacturasUSD = parseFloat(facturas.reduce((sum, f) => sum + f.total_usd, 0).toFixed(2))
    const totalPagadoUSD = parseFloat(facturas.reduce((sum, f) => sum + (f.total_usd - f.saldo_pendiente_usd), 0).toFixed(2))
    const totalPendienteUSD = parseFloat(facturas.reduce((sum, f) => sum + f.saldo_pendiente_usd, 0).toFixed(2))
    const totalPagadoBS = parseFloat(pagos.reduce((sum, p) => sum + p.monto_bs, 0).toFixed(2))

    const facturasPendientes = facturas.filter(f => f.estado !== 'Pagada')

    const handleRefreshRates = async () => {
        setRefreshing(true)
            try {
            const rates = await fetchExchangeRates()
            if (rates && rates.VES) {
                setTasaCambio(rates.VES)
            }
            setLastUpdate(getLastUpdateString())
                setRateSource(getRateSource())
                setBcvFecha(getBcvFechaVigencia())
            // Also refresh API status
            try {
                await getApiStatus()
            } catch (error) {
                console.warn('Error refreshing API status:', error)
            }
        } catch (error) {
            console.error('Error refreshing rates:', error)
        } finally {
            setRefreshing(false)
        }
    }

    return (
        <Box className="slide-up">
            {/* Encabezado */}
            <Box mb={3}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Dashboard
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                    Resumen general de ventas y pagos
                </Typography>
            </Box>

            {/* Tasa de Cambio Automática */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                        <Box>
                            <Typography variant="h3" component="div" gutterBottom>
                                1 USD = {tasaCambio.toFixed(2)} Bs.
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                🕐 Última actualización: {lastUpdate}
                            </Typography>
                            {(rateSource || bcvFecha) && (
                                <Typography variant="body2" color="textSecondary">
                                    {rateSource && (`Fuente: ${rateSource}`)}{rateSource && bcvFecha ? ' • ' : ''}{bcvFecha && (`Fecha vigencia: ${bcvFecha}`)}
                                </Typography>
                            )}
                        </Box>
                        <Box display="flex" gap={1}>
                            <Button
                                onClick={handleRefreshRates}
                                disabled={refreshing}
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                            >
                                {refreshing ? 'Actualizando...' : 'Actualizar'}
                            </Button>
                            <Button
                                onClick={() => setCurrentView && setCurrentView('exchanger')}
                                variant="contained"
                                startIcon={<AttachMoneyIcon />}
                            >
                                Ver Conversor
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Brecha del Dólar */}
            {brechaInfo && (
                <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'warning.main', bgcolor: 'background.paper', boxShadow: 2 }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                            <Typography variant="h6" component="h3">
                                Brecha del Dólar (Oficial vs Paralelo)
                            </Typography>
                            <Tooltip title="Diferencia porcentual entre el dólar oficial y el paralelo">
                                <InfoIcon color="action" />
                            </Tooltip>
                        </Box>
                        <Grid container spacing={2} justifyContent="center">
                            <Grid xs={12} sm={4} display="flex" flexDirection="column" alignItems="center">
                                <Typography variant="caption" color="textSecondary" gutterBottom>
                                    Dólar Oficial (BCV)
                                </Typography>
                                <Typography variant="h6" color="success.main">
                                    {brechaInfo.oficial?.toFixed(2)} Bs.
                                </Typography>
                            </Grid>
                            <Grid xs={12} sm={4} display="flex" flexDirection="column" alignItems="center">
                                <Typography variant="caption" color="textSecondary" gutterBottom>
                                    Dólar Paralelo
                                </Typography>
                                <Typography variant="h6" color="warning.main">
                                    {brechaInfo.paralelo?.toFixed(2)} Bs.
                                </Typography>
                            </Grid>
                            <Grid xs={12} sm={4} display="flex" flexDirection="column" alignItems="center">
                                <Typography variant="caption" color="textSecondary" gutterBottom>
                                    Brecha
                                </Typography>
                                <Typography 
                                    variant="h5" 
                                    color={brechaInfo.brecha > 0 ? 'error.main' : 'success.main'}
                                >
                                    {brechaInfo.brecha > 0 ? '+' : ''}{brechaInfo.brecha}%
                                </Typography>
                            </Grid>
                        </Grid>
                        <Typography variant="body2" color="textSecondary" mt={2} textAlign="center">
                            🕐 Actualizado: {new Date(brechaInfo.fechaActualizacion).toLocaleString('es-VE')}
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* Estadísticas */}
            <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Total Facturado
                                    </Typography>
                                    <Typography variant="h6">
                                        ${totalFacturasUSD.toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        USD
                                    </Typography>
                                </Box>
                                <TrendingUpIcon color="primary" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Total Pagado
                                    </Typography>
                                    <Typography variant="h6">
                                        ${totalPagadoUSD.toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {formatBs(totalPagadoBS)}
                                    </Typography>
                                </Box>
                                <AttachMoneyIcon color="success" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Saldo Pendiente
                                    </Typography>
                                    <Typography variant="h6">
                                        ${totalPendienteUSD.toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        USD
                                    </Typography>
                                </Box>
                                <Chip label="Pendiente" color="warning" size="small" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Comisiones x Pagar
                                    </Typography>
                                    <Typography variant="h6" color="success.main">
                                        ${totalComisionesPendientesUSD.toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        USD Pendientes
                                    </Typography>
                                </Box>
                                <AttachMoneyIcon color="success" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Pedidos Pendientes
                                    </Typography>
                                    <Typography variant="h6" color="info.main">
                                        {pedidos.length}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
                                        {pedidos.reduce((total, p) => total + p.items.reduce((sub, it) => sub + (it.cantidad || 0), 0), 0).toFixed(1)} Kg. estimados
                                    </Typography>
                                </Box>
                                <ShoppingCartIcon color="info" />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Alerta global de bajo stock */}
            {lowStockCount > 0 && (
                <Alert 
                    severity="warning" 
                    sx={{ mb: 3 }} 
                    action={
                        <Button 
                            color="warning" 
                            onClick={() => setCurrentView && setCurrentView('productos')}
                            size="small"
                        >
                            Ir a Productos
                        </Button>
                    }
                >
                    <Box>
                        <Typography variant="body1" fontWeight="bold">
                            ⚠️ {lowStockCount} producto(s) con bajo stock
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            Productos con menos de {LOW_STOCK_THRESHOLD} Kg. disponibles
                        </Typography>
                        <Typography variant="body2" mt={1}>
                            <strong>Ejemplo:</strong> {lowStockList.slice(0, 5).map(p => p.nombre).join(', ')}{lowStockCount > 5 && ` y ${lowStockCount - 5} más`}
                        </Typography>
                    </Box>
                </Alert>
            )}

            {/* Resumen de Comisiones */}
            {resumenComisiones.length > 0 && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                            <Box>
                                <Typography variant="h6" component="h3" gutterBottom>
                                    Resumen de Comisiones
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Estado de pagos a vendedores
                                </Typography>
                            </Box>
                            <Button
                                onClick={() => setCurrentView && setCurrentView('vendedores')}
                                variant="outlined"
                                size="small"
                            >
                                Gestionar Vendedores
                            </Button>
                        </Box>
                        
                        {/* Tabla de comisiones */}
                        <Box overflow="auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Vendedor</th>
                                        <th>Total Generado</th>
                                        <th>Total Pagado</th>
                                        <th>Saldo Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumenComisiones.map(rc => (
                                        <tr key={rc.id} onClick={() => onVerDetalleVendedor && onVerDetalleVendedor(vendedores.find(v => v.id === rc.id))} style={{ cursor: 'pointer' }} title="Click para ver detalle de comisiones">
                                            <td><strong>{rc.nombre}</strong></td>
                                            <td>${rc.generado.toFixed(2)} USD</td>
                                            <td className="text-danger">-${rc.pagado.toFixed(2)} USD</td>
                                            <td>
                                                <Chip 
                                                    label={`$${rc.pendiente.toFixed(2)} USD`}
                                                    color={rc.pendiente > 0 ? 'warning' : 'success'}
                                                    size="small"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Facturas Pendientes */}
            <Card>
                <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Box>
                            <Typography variant="h6" component="h3" gutterBottom>
                                Facturas Pendientes
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Facturas con saldo por cobrar
                            </Typography>
                        </Box>
                    </Box>

                    {facturasPendientes.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <Typography variant="h6" color="textSecondary">
                                No hay facturas pendientes
                            </Typography>
                        </Box>
                    ) : (
                        <Box overflow="auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Factura #</th>
                                        <th>Cliente</th>
                                        <th>Días hasta/vencida</th>
                                        <th>Total</th>
                                        <th>Saldo Pendiente</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturasPendientes.map((factura) => {
                                        const cliente = clientes.find(c => c.id === factura.cliente_id)
                                        const due = getDueInfo(factura)
                                        return (
                                            <tr key={factura.id} onClick={() => onVerDetalleFactura && onVerDetalleFactura(factura)} style={{ cursor: 'pointer' }} title="Click para ver detalle">
                                                <td>#{factura.id}</td>
                                                <td>{cliente?.nombre || 'N/A'}</td>
                                                <td>
                                                    <Chip 
                                                        label={due.label}
                                                        style={{ 
                                                            background: due.overdue ? '#fff0f0' : '#f0fdf4',
                                                            color: due.color,
                                                            fontWeight: 600
                                                        }}
                                                    />
                                                </td>
                                                <td>${factura.total_usd.toFixed(2)}</td>
                                                <td>${factura.saldo_pendiente_usd.toFixed(2)}</td>
                                                <td>
                                                    <Chip 
                                                        label={factura.estado}
                                                        color={factura.estado === 'Pagada' ? 'success' : factura.estado === 'Parcial' ? 'warning' : 'error'}
                                                        size="small"
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    )
}
