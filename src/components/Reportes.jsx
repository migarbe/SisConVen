import React, { useState, useMemo, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatBs } from '../utils/formatters';
import { getExchangeRateHistory } from '../utils/exchangeRateService';
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Autocomplete } from '@mui/material'
import RateSource from './RateSource'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Reportes({ facturas, compras, productos, vendedores, clientes }) {
    const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' | 'compras' | 'tasas'
    const [periodo, setPeriodo] = useState('año'); // 'mes', 'trimestre', 'año'
    const [exchangeHistory, setExchangeHistory] = useState([]);
    const [historyDays, setHistoryDays] = useState(30);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load exchange rate history when tab changes to tasas
    useEffect(() => {
        if (activeTab === 'tasas') {
            const loadHistory = async () => {
                setLoadingHistory(true);
                try {
                    const history = await getExchangeRateHistory(historyDays);
                    setExchangeHistory(history);
                } catch (error) {
                    console.error('Error loading exchange history:', error);
                } finally {
                    setLoadingHistory(false);
                }
            };
            loadHistory();
        }
    }, [activeTab, historyDays]);

    // --- Lógica de Procesamiento de Datos ---

    const metrics = useMemo(() => {
        const hoy = new Date();
        const filterByPeriod = (dateString) => {
            const date = new Date(dateString);
            if (periodo === 'mes') {
                return date.getMonth() === hoy.getMonth() && date.getFullYear() === hoy.getFullYear();
            }
            if (periodo === 'trimestre') {
                const tresMesesAtras = new Date();
                tresMesesAtras.setMonth(hoy.getMonth() - 3);
                return date >= tresMesesAtras;
            }
            return date.getFullYear() === hoy.getFullYear();
        };

        // --- VENTAS ---
        const facturasFiltradas = (facturas || []).filter(f => filterByPeriod(f.fecha));

        // KPIs Ventas
        const totalVentasUSD = parseFloat(facturasFiltradas.reduce((sum, f) => sum + f.total_usd, 0).toFixed(2));
        const ticketPromedio = facturasFiltradas.length > 0 ? parseFloat((totalVentasUSD / facturasFiltradas.length).toFixed(2)) : 0;

        let totalCostoTotal = 0;
        let totalComisionesPagadas = 0;
        facturasFiltradas.forEach(f => {
            totalComisionesPagadas += (f.comisiones_total || 0);
            f.items.forEach(it => {
                const p = productos.find(prod => prod.id === it.producto_id);
                totalCostoTotal += (p?.precio_compra_usd || 0) * it.cantidad;
            });
        });
        totalCostoTotal = parseFloat(totalCostoTotal.toFixed(2));
        totalComisionesPagadas = parseFloat(totalComisionesPagadas.toFixed(2));
        const gananciaNetaTotal = parseFloat((totalVentasUSD - totalCostoTotal - totalComisionesPagadas).toFixed(2));
        const margenNeto = totalVentasUSD > 0 ? parseFloat(((gananciaNetaTotal / totalVentasUSD) * 100).toFixed(1)) : 0;

        // Gráficos Ventas
        const vendorPerformance = vendedores.map(v => {
            const vFacturas = facturasFiltradas.filter(f => f.vendedor_id?.toString() === v.id.toString());
            const totalVentas = parseFloat(vFacturas.reduce((sum, f) => sum + f.total_usd, 0).toFixed(2));
            const totalComisiones = parseFloat(vFacturas.reduce((sum, f) => sum + (f.comisiones_total || 0), 0).toFixed(2));

            let totalCosto = 0;
            vFacturas.forEach(f => {
                f.items.forEach(it => {
                    const p = productos.find(prod => prod.id === it.producto_id);
                    totalCosto += (p?.precio_compra_usd || 0) * it.cantidad;
                });
            });
            const margenContribucion = parseFloat((totalVentas - totalCosto - totalComisiones).toFixed(2));
            return { name: v.nombre, ventas: totalVentas, comision: totalComisiones, margen: margenContribucion };
        }).sort((a, b) => b.ventas - a.ventas);

        const topClientsData = Object.values(facturasFiltradas.reduce((acc, f) => {
            if (!acc[f.cliente_id]) {
                const cliente = Array.isArray(clientes) ? clientes.find(c => c.id === f.cliente_id) : null;
                acc[f.cliente_id] = { name: cliente?.nombre || `ID: ${f.cliente_id}`, total: 0 };
            }
            acc[f.cliente_id].total += f.total_usd;
            return acc;
        }, {})).sort((a, b) => b.total - a.total).slice(0, 5);

        const productProfitData = productos.map(p => {
            let totalVentasProd = 0;
            let totalCostoProd = 0;
            let totalComisGasto = 0;
            facturasFiltradas.forEach(f => {
                f.items.forEach(it => {
                    if (it.producto_id === p.id) {
                        totalVentasProd += it.subtotal;
                        totalCostoProd += (p.precio_compra_usd || 0) * it.cantidad;
                        const comDet = f.comisiones_detalle?.find(cd => cd.producto_id === p.id);
                        totalComisGasto += (comDet?.comision || 0);
                    }
                });
            });
            const gananciaProd = parseFloat((totalVentasProd - totalCostoProd - totalComisGasto).toFixed(2));
            return {
                name: p.nombre,
                ventas: parseFloat(totalVentasProd.toFixed(2)),
                ganancia: gananciaProd,
                margen: totalVentasProd > 0 ? parseFloat(((gananciaProd / totalVentasProd) * 100).toFixed(1)) : 0
            };
        }).sort((a, b) => b.ganancia - a.ganancia);

        // Calculate Sales Price Variation
        // Group by Date and Product -> Average Price
        const salesPriceVariation = [];
        const uniqueDates = [...new Set(facturasFiltradas.map(f => new Date(f.fecha).toLocaleDateString()))].sort((a, b) => new Date(a) - new Date(b));

        uniqueDates.forEach(dateStr => {
            const entry = { date: dateStr };
            productos.forEach(prod => {
                const dayFacturas = facturasFiltradas.filter(f => new Date(f.fecha).toLocaleDateString() === dateStr);
                let totalPrecio = 0;
                let count = 0;
                dayFacturas.forEach(f => {
                    f.items.forEach(it => {
                        if (it.producto_id === prod.id) {
                            totalPrecio += it.precio_usd;
                            count++;
                        }
                    });
                });
                if (count > 0) {
                    entry[prod.nombre] = parseFloat((totalPrecio / count).toFixed(2));
                }
            });
            salesPriceVariation.push(entry);
        });


        // --- COMPRAS ---
        const comprasFiltradas = (compras || []).filter(c => filterByPeriod(c.fecha));

        // KPIs Compras
        const totalComprasUSD = parseFloat(comprasFiltradas.reduce((sum, c) => sum + c.total_deuda_usd, 0).toFixed(2));

        const totalComprasKg = parseFloat(comprasFiltradas.reduce((sum, c) => {
            if (c.items && Array.isArray(c.items)) {
                return sum + c.items.reduce((s, i) => s + parseFloat(i.cantidad_kg), 0);
            }
            return sum + (parseFloat(c.cantidad_kg) || 0);
        }, 0).toFixed(3));

        const deudaPendienteCompras = parseFloat(comprasFiltradas.reduce((sum, c) => sum + c.saldo_pendiente_usd, 0).toFixed(2));

        // Calculate Purchase Price Variation
        // Group by Date and Product -> Cost in USD (approx) or COP
        const purchasePriceVariation = [];
        const uniquePurchaseDates = [...new Set(comprasFiltradas.map(c => new Date(c.fecha).toLocaleDateString()))].sort((a, b) => new Date(a) - new Date(b));

        uniquePurchaseDates.forEach(dateStr => {
            const entry = { date: dateStr };
            productos.forEach(prod => {
                // Filtrar compras del día
                const dayCompras = comprasFiltradas.filter(c => new Date(c.fecha).toLocaleDateString() === dateStr);

                // Recolectar costos de este producto en este día
                let totalCostUnit = 0;
                let count = 0;

                dayCompras.forEach(c => {
                    if (c.items && Array.isArray(c.items)) {
                        // Nueva estructura multi-item
                        c.items.forEach(it => {
                            if (it.producto_id === prod.id) {
                                // Calculamos costo unitario USD implícito
                                const unitCost = it.subtotal_usd / it.cantidad_kg;
                                totalCostUnit += unitCost;
                                count++;
                            }
                        })
                    } else {
                        // Estructura legacy
                        if (c.producto_id === prod.id) {
                            const unitCost = c.total_deuda_usd / c.cantidad_kg;
                            totalCostUnit += unitCost;
                            count++;
                        }
                    }
                });

                if (count > 0) {
                    entry[prod.nombre] = parseFloat((totalCostUnit / count).toFixed(2));
                }
            });
            purchasePriceVariation.push(entry);
        });

        // Aggregate Payment Methods for Compras
        const paymentMethodsData = [];
        const paymentsByMethod = {};

        comprasFiltradas.forEach(c => {
            if (c.pagos && Array.isArray(c.pagos)) {
                c.pagos.forEach(pago => {
                    const metodo = pago.metodo || 'Sin Especificar';
                    if (!paymentsByMethod[metodo]) {
                        paymentsByMethod[metodo] = 0;
                    }
                    paymentsByMethod[metodo] += pago.monto_usd || 0;
                });
            }
        });

        Object.keys(paymentsByMethod).forEach(metodo => {
            paymentMethodsData.push({
                name: metodo,
                monto: parseFloat(paymentsByMethod[metodo].toFixed(2))
            });
        });

        return {
            ventas: {
                kpis: { totalVentasUSD, gananciaNetaTotal, margenNeto, ticketPromedio },
                vendorPerformance,
                topClientsData,
                productProfitData,
                salesPriceVariation
            },
            compras: {
                kpis: { totalComprasUSD, totalComprasKg, deudaPendienteCompras },
                purchasePriceVariation,
                paymentMethodsData
            }
        };

    }, [facturas, compras, productos, vendedores, clientes, periodo]);

    if (!metrics) return null;

    // Colores para líneas de gráficos
    const LINE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F'];

    return (
        <div className="container main-content-fixed slide-up">
            <div className="page-header flex-between mb-2">
                <div>
                    <h1 className="page-title">Reportes Estratégicos</h1>
                    <p className="page-subtitle">Análisis financiero y de rendimiento comercial</p>
                    <RateSource />
                </div>
                <div className="flex flex-gap">
                    <select
                        className="form-select"
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                    >
                        <option value="mes">Este Mes</option>
                        <option value="trimestre">Trimestral</option>
                        <option value="año">Anual</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs mb-4">
                <button
                    className={`tab ${activeTab === 'ventas' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ventas')}
                >
                    💰 Reportes de Ventas
                </button>
                <button
                    className={`tab ${activeTab === 'compras' ? 'active' : ''}`}
                    onClick={() => setActiveTab('compras')}
                >
                    📦 Reportes de Compras
                </button>
                <button
                    className={`tab ${activeTab === 'tasas' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tasas')}
                >
                    💱 Tasas de Cambio
                </button>
            </div>

            {activeTab === 'ventas' && (
                <div className="fade-in">
                    {/* KPIs Ventas */}
                    <div className="grid grid-4 mb-4">
                        <div className="stat-card">
                            <div className="stat-label">Ventas Totales</div>
                            <div className="stat-value">${metrics.ventas.kpis.totalVentasUSD}</div>
                            <div className="text-small text-success">USD Acumulado</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Ganancia Neta</div>
                            <div className="stat-value">${metrics.ventas.kpis.gananciaNetaTotal}</div>
                            <div className="text-small text-info">Utilidad Final</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Margen Neto</div>
                            <div className="stat-value">{metrics.ventas.kpis.margenNeto}%</div>
                            <div className="text-small text-warning">Rendimiento Real</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Ticket Promedio</div>
                            <div className="stat-value">${metrics.ventas.kpis.ticketPromedio}</div>
                            <div className="text-small text-secondary">Por Factura</div>
                        </div>
                    </div>

                    {/* Sales Price Variation Chart */}
                    <div className="card mb-4">
                        <h3 className="mb-4">📈 Variación de Precios de Venta (USD)</h3>
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <LineChart data={metrics.ventas.salesPriceVariation}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                    <Legend />
                                    {productos.map((p, index) => (
                                        <Line
                                            key={p.id}
                                            type="monotone"
                                            dataKey={p.nombre}
                                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                            strokeWidth={2}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-2 mb-4">
                        {/* Gráfico 2: Comisiones y Margen por Vendedor */}
                        <div className="card">
                            <h3 className="mb-4">Desempeño y Margen x Vendedor</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={metrics.ventas.vendorPerformance}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
                                        <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                        <Legend />
                                        <Bar dataKey="ventas" name="Ventas ($)" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="margen" name="Margen Neto ($)" fill="var(--success)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gráfico 5: Top 5 Clientes */}
                        <div className="card">
                            <h3 className="mb-4">Top 5 Clientes (Ventas Totales)</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={metrics.ventas.topClientsData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                                        <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} />
                                        <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={12} width={120} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} formatter={(value) => [`$${value.toFixed(2)}`, 'Ventas Totales']} />
                                        <Bar dataKey="total" name="Ventas ($)" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-2 mb-4">
                        {/* Gráfico 4: Ganancias por Producto */}
                        <div className="card">
                            <h3 className="mb-4">Ganancias Netas por Producto</h3>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <BarChart data={metrics.ventas.productProfitData} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={true} vertical={false} />
                                        <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} />
                                        <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={10} width={100} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} formatter={(value) => [`$${value.toFixed(2)}`, 'Ganancia']} />
                                        <Legend />
                                        <Bar dataKey="ganancia" name="Utilidad ($)" fill="var(--success)" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Tabla Detalle de Rentabilidad */}
                        <div className="card">
                            <h3 className="mb-4">Detalle de Rentabilidad</h3>
                            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Ventas</th>
                                            <th>Ganancia</th>
                                            <th>Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...metrics.ventas.productProfitData].sort((a, b) => b.ganancia - a.ganancia).map((p, idx) => (
                                            <tr key={idx}>
                                                <td>{p.name}</td>
                                                <td>${p.ventas.toFixed(2)}</td>
                                                <td className="text-success"><strong>${p.ganancia.toFixed(2)}</strong></td>
                                                <td>
                                                    <span className={`badge ${p.margen > 30 ? 'badge-success' : 'badge-info'}`}>
                                                        {p.margen.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'compras' && (
                <div className="fade-in">
                    {/* KPIs Compras */}
                    <div className="grid grid-3 mb-4">
                        <div className="stat-card">
                            <div className="stat-label">Total Compras</div>
                            <div className="stat-value">${metrics.compras.kpis.totalComprasUSD}</div>
                            <div className="text-small text-muted">USD Acumulado</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Volumen Comprado</div>
                            <div className="stat-value">{metrics.compras.kpis.totalComprasKg}</div>
                            <div className="text-small text-muted">Kg Total</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Deuda Pendiente</div>
                            <div className="stat-value text-danger">${metrics.compras.kpis.deudaPendienteCompras}</div>
                            <div className="text-small text-danger">Por Pagar</div>
                        </div>
                    </div>

                    {/* Purchase Price Variation Chart */}
                    <div className="card mb-4">
                        <h3 className="mb-4">📉 Variación de Costos de Compra (USD/Kg)</h3>
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <LineChart data={metrics.compras.purchasePriceVariation}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={12} />
                                    <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                    <Legend />
                                    {productos.map((p, index) => (
                                        <Line
                                            key={p.id}
                                            type="monotone"
                                            dataKey={p.nombre}
                                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                            strokeWidth={2}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Payment Methods Chart */}
                    {metrics.compras.paymentMethodsData.length > 0 && (
                        <div className="card mb-4">
                            <h3 className="mb-4">💳 Métodos de Pago Utilizados</h3>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <BarChart data={metrics.compras.paymentMethodsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
                                        <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderColor: 'var(--border-color)',
                                                color: 'var(--text-primary)'
                                            }}
                                            formatter={(value) => `$${value.toFixed(2)} USD`}
                                        />
                                        <Legend />
                                        <Bar dataKey="monto" fill="#82ca9d" name="Monto Pagado (USD)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'tasas' && (
                <div className="fade-in">
                    {/* Selector de días para el historial */}
                    <div className="card mb-4">
                        <div className="flex-between">
                            <h3 className="mb-0">💱 Historial de Tasas de Cambio</h3>
                            <select
                                className="form-select"
                                value={historyDays}
                                onChange={(e) => setHistoryDays(parseInt(e.target.value))}
                                style={{ width: '200px' }}
                            >
                                <option value={7}>Últimos 7 días</option>
                                <option value={15}>Últimos 15 días</option>
                                <option value={30}>Últimos 30 días</option>
                                <option value={60}>Últimos 60 días</option>
                                <option value={90}>Últimos 90 días</option>
                            </select>
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="card">
                            <div className="text-center p-4">
                                <p>Cargando historial de tasas...</p>
                            </div>
                        </div>
                    ) : exchangeHistory.length === 0 ? (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-icon">📊</div>
                                <p>No hay datos de historial disponibles</p>
                                <p className="text-small text-muted">
                                    Los datos se收集arán automáticamente cuando uses la aplicación.
                                    Visita la sección de Tasas de Cambio para actualizar los datos.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Gráfico comparativo de todas las tasas */}
                            <div className="card mb-4">
                                <h3 className="mb-4">📈 Evolución de Todas las Tasas de Cambio</h3>
                                <div style={{ width: '100%', height: 400 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={exchangeHistory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                            <XAxis
                                                dataKey="fecha"
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                tickFormatter={(value) => new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}
                                            />
                                            <YAxis
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                tickFormatter={(value) => value.toLocaleString('es-VE')}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    borderColor: 'var(--border-color)',
                                                    color: 'var(--text-primary)'
                                                }}
                                                labelFormatter={(value) => new Date(value).toLocaleDateString('es-VE', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                                formatter={(value, name) => {
                                                    const labels = {
                                                        USD: 'USD ($)',
                                                        EUR: 'EUR (€)',
                                                        COP: 'COP ($)',
                                                        VES_oficial: 'VES Oficial (Bs)',
                                                        VES_paralelo: 'VES Paralelo (Bs)'
                                                    };
                                                    return [value.toLocaleString('es-VE', { maximumFractionDigits: 2 }), labels[name] || name];
                                                }}
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="VES_oficial"
                                                name="VES Oficial (BCV)"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="VES_paralelo"
                                                name="VES Paralelo"
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="COP"
                                                name="COP"
                                                stroke="#6366f1"
                                                strokeWidth={2}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="EUR"
                                                name="EUR"
                                                stroke="#8b5cf6"
                                                strokeWidth={2}
                                                connectNulls
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Gráfico solo VES (Oficial vs Paralelo) */}
                            <div className="card mb-4">
                                <h3 className="mb-4">💵 VES Oficial vs Paralelo</h3>
                                <div style={{ width: '100%', height: 350 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={exchangeHistory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                            <XAxis
                                                dataKey="fecha"
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                tickFormatter={(value) => new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}
                                            />
                                            <YAxis
                                                stroke="var(--text-tertiary)"
                                                fontSize={12}
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    borderColor: 'var(--border-color)',
                                                    color: 'var(--text-primary)'
                                                }}
                                                labelFormatter={(value) => new Date(value).toLocaleDateString('es-VE')}
                                                formatter={(value, name) => {
                                                    return [`${value.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs.`, name === 'VES_oficial' ? 'Oficial (BCV)' : 'Paralelo'];
                                                }}
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="VES_oficial"
                                                name="Oficial (BCV)"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6 }}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="VES_paralelo"
                                                name="Paralelo"
                                                stroke="#f59e0b"
                                                strokeWidth={3}
                                                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6 }}
                                                connectNulls
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Tabla de datos históricos */}
                            <div className="card">
                                <h3 className="mb-4">📋 Datos Históricos</h3>
                                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>USD</th>
                                                <th>EUR</th>
                                                <th>COP</th>
                                                <th>VES Oficial</th>
                                                <th>VES Paralelo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...exchangeHistory].reverse().map((entry, idx) => (
                                                <tr key={idx}>
                                                    <td>{new Date(entry.fecha).toLocaleDateString('es-VE')}</td>
                                                    <td>{entry.USD}</td>
                                                    <td>{entry.EUR?.toFixed(4)}</td>
                                                    <td>{entry.COP?.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</td>
                                                    <td className="text-success">{entry.VES_oficial?.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</td>
                                                    <td className="text-warning">{entry.VES_paralelo?.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
