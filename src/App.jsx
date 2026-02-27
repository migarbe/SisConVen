import { useState, useEffect } from 'react'
import { CssBaseline, ThemeProvider, createTheme, AppBar, Toolbar, Drawer, List, ListItem, ListItemIcon, ListItemText, Box, IconButton, Menu, MenuItem, Switch, FormControlLabel, Divider, Typography } from '@mui/material'
import { Inventory as BoxIcon, ShoppingCart, Receipt, Payment, Message, AttachMoney, People, Settings, BarChart, Inventory, Storage, Menu as MenuIcon } from '@mui/icons-material'
import Dashboard from './components/Dashboard'
import Clientes from './components/Clientes'
import Productos from './components/Productos'
import Facturas from './components/Facturas'
import Pedidos from './components/Pedidos'
import Pagos from './components/Pagos'
import DataManagement from './components/DataManagement'
import Mensajeria from './components/Mensajeria'
import Exchanger from './components/Exchanger'
import Vendedores from './components/Vendedores'
import Configuracion from './components/Configuracion'
import Reportes from './components/Reportes'
import Compras from './components/Compras'
import { initExchangeRateService, getUsdToVesRate, getDollarBrecha } from './utils/exchangeRateService'

function App() {
    const [currentView, setCurrentView] = useState('dashboard')
    const [isLoaded, setIsLoaded] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Estado para configuración visual (inicializado primero para derivar themeMode)
    const [visualSettings, setVisualSettings] = useState(() => {
        const saved = localStorage.getItem('visualSettings')
        return saved ? JSON.parse(saved) : {
            theme: 'dark',
            palette: 'indigo',
            fontSize: 14
        }
    })

    const [themeMode, setThemeMode] = useState(visualSettings.theme)

    // Crear tema de Material UI
    const theme = createTheme({
        palette: {
            mode: themeMode,
            primary: {
                main: '#6366f1',
            },
            secondary: {
                main: '#8b5cf6',
            },
            background: {
                default: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                paper: themeMode === 'dark' ? '#1e293b' : '#ffffff',
            },
            text: {
                primary: themeMode === 'dark' ? '#f1f5f9' : '#1e293b',
                secondary: themeMode === 'dark' ? '#94a3b8' : '#64748b',
            },
        },
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            h1: {
                fontSize: '2rem',
                fontWeight: 600,
            },
            h2: {
                fontSize: '1.5rem',
                fontWeight: 600,
            },
            h3: {
                fontSize: '1.25rem',
                fontWeight: 600,
            },
            h4: {
                fontSize: '1.125rem',
                fontWeight: 600,
            },
            h5: {
                fontSize: '1rem',
                fontWeight: 600,
            },
            h6: {
                fontSize: '0.875rem',
                fontWeight: 600,
            },
            body1: {
                fontSize: '0.875rem',
            },
            body2: {
                fontSize: '0.75rem',
            },
        },
        components: {
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: '12px',
                        boxShadow: themeMode === 'dark' 
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 600,
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                        },
                    },
                },
            },
            MuiTable: {
                styleOverrides: {
                    root: {
                        '& .MuiTableCell-root': {
                            fontSize: '0.875rem',
                        },
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                        color: themeMode === 'dark' ? '#f1f5f9' : '#1e293b',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: themeMode === 'dark' ? '#1e293b' : '#ffffff',
                        color: themeMode === 'dark' ? '#f1f5f9' : '#1e293b',
                    },
                },
            },
            MuiListItem: {
                styleOverrides: {
                    root: {
                        '&:hover': {
                            backgroundColor: themeMode === 'dark' ? '#334155' : '#f1f5f9',
                        },
                    },
                },
            },
        },
    })

    // Estado global
    const [clientes, setClientes] = useState([])
    const [productos, setProductos] = useState([])
    const [facturas, setFacturas] = useState([])
    const [pagos, setPagos] = useState([])
    const [vendedores, setVendedores] = useState([])
    const [pedidos, setPedidos] = useState([])
    const [compras, setCompras] = useState([]) // Estado para compras
    const [tasaCambio, setTasaCambio] = useState(50) // Tasa por defecto (se reemplaza al inicializar con el valor oficial obtenido del BCV JSON o de la API)
    const [brecha, setBrecha] = useState(0) // Brecha adicional del usuario (%)
    const [brechaBase, setBrechaBase] = useState(0) // Brecha del dólar paralelo vs oficial (%)
    const [porcentajeCredito, setPorcentajeCredito] = useState(10) // Porcentaje recargo crédito (%)
    const [diasCredito, setDiasCredito] = useState(15) // Días de crédito por defecto
    const [deliveryDate, setDeliveryDate] = useState(() => {
        const saved = localStorage.getItem('deliveryDate')
        if (saved) return saved
        const d = new Date()
        return d.toISOString().slice(0, 10)
    })

    // El estado visualSettings ya se inicializó arriba para coordinar con themeMode

    // Estado para convertir pedidos a facturas
    const [pedidoAConvertir, setPedidoAConvertir] = useState(null)

    // Estado para editar clientes desde otras vistas (ej. botón "Editar número")
    const [externalEditCliente, setExternalEditCliente] = useState(null)

    // Estado para navegar al detalle de una factura desde otras vistas (ej. Dashboard)
    const [facturaADetalle, setFacturaADetalle] = useState(null)

    // Estado para navegar al detalle de un vendedor desde otras vistas (ej. Dashboard)
    // Estado para navegar al detalle de un vendedor desde otras vistas (ej. Dashboard)
    const [vendedorADetalle, setVendedorADetalle] = useState(null)

    // Estado para iniciar un pago desde Facturas
    const [facturaAPagar, setFacturaAPagar] = useState(null)

    // Estado para control de menús desplegables
    const [activeDropdown, setActiveDropdown] = useState(null)

    const toggleDropdown = (dropdown) => {
        if (activeDropdown === dropdown) {
            setActiveDropdown(null)
        } else {
            setActiveDropdown(dropdown)
        }
    }

    const closeDropdowns = () => {
        setActiveDropdown(null)
        setMobileMenuOpen(false)
    }

    const openClienteEditor = (cliente) => {
        setExternalEditCliente(cliente)
        setCurrentView('clientes')
    }

    // Inicializar servicio de tasas de cambio y cargar datos
    useEffect(() => {
        const initApp = async () => {
            try {
                // Inicializar servicio de tasas
                initExchangeRateService()

                // Obtener tasa actual
                const rate = await getUsdToVesRate()
                setTasaCambio(rate)

                // Obtener brecha del dólar paralelo vs oficial
                try {
                    const brechaData = await getDollarBrecha()
                    if (brechaData && brechaData.brecha) {
                        setBrechaBase(brechaData.brecha)
                    }
                } catch (err) {
                    console.error('Error al obtener brecha:', err)
                }

                // Cargar datos del localStorage
                const savedClientes = localStorage.getItem('clientes')
                const savedProductos = localStorage.getItem('productos')
                const savedFacturas = localStorage.getItem('facturas')
                const savedPagos = localStorage.getItem('pagos')
                const savedVendedores = localStorage.getItem('vendedores')
                const savedBrecha = localStorage.getItem('brecha')
                const savedPorcentajeCredito = localStorage.getItem('porcentajeCredito')
                const savedDiasCredito = localStorage.getItem('diasCredito')
                const savedCompras = localStorage.getItem('compras')

                if (savedClientes) setClientes(JSON.parse(savedClientes))
                if (savedProductos) setProductos(JSON.parse(savedProductos))
                else {
                    // Productos iniciales
                    const productosIniciales = [
                        { id: 1, nombre: 'Queso Blanco', precio_usd: 5.80, precio_compra_usd: 3.00, cantidad_kg: 50 },
                        { id: 2, nombre: 'Mantequilla', precio_usd: 11.00, precio_compra_usd: 7.00, cantidad_kg: 20 },
                        { id: 3, nombre: 'Natilla', precio_usd: 3.00, precio_compra_usd: 1.50, cantidad_kg: 100 }
                    ]
                    setProductos(productosIniciales)
                }
                if (savedFacturas) setFacturas(JSON.parse(savedFacturas))
                if (savedPagos) setPagos(JSON.parse(savedPagos))
                if (savedBrecha) setBrecha(parseFloat(savedBrecha))
                if (savedPorcentajeCredito) setPorcentajeCredito(parseFloat(savedPorcentajeCredito))
                if (savedDiasCredito) setDiasCredito(parseInt(savedDiasCredito))
                if (savedCompras) setCompras(JSON.parse(savedCompras))
                const savedPedidos = localStorage.getItem('pedidos')
                if (savedPedidos) setPedidos(JSON.parse(savedPedidos))

                let currentVendedores = []
                if (savedVendedores) {
                    currentVendedores = JSON.parse(savedVendedores)
                }

                // Asegurar que exista "Venta Directa"
                const existeVentaDirecta = currentVendedores.some(v => v.nombre === 'Venta Directa')
                if (!existeVentaDirecta) {
                    currentVendedores.push({
                        id: 'default-venta-directa',
                        nombre: 'Venta Directa',
                        telefono: '',
                        email: '',
                        cedula: '',
                        banco: '',
                        comisiones: {}
                    })
                }
                setVendedores(currentVendedores)
            } catch (error) {
                console.error('Error al cargar datos:', error)
            } finally {
                setIsLoaded(true)
            }
        }

        initApp()

        // Auto-actualización de tasas cada 60 minutos
        const interval = setInterval(async () => {
            try {
                const rate = await getUsdToVesRate()
                setTasaCambio(rate)
            } catch (error) {
                console.error('Error al actualizar tasa:', error)
            }
        }, 60 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

    // Resetear scroll al cambiar de vista
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [currentView])

    // Aplicar configuración visual
    useEffect(() => {
        const root = document.documentElement
        root.setAttribute('data-theme', visualSettings.theme)
        setThemeMode(visualSettings.theme) // Sincronizar tema de Material UI
        root.style.setProperty('--base-font-size', `${visualSettings.fontSize}px`)

        // Aplicar colores de la paleta
        const palettes = {
            dark: {
                indigo: { primary: '#6366f1', secondary: '#8b5cf6' },
                neon: { primary: '#06b6d4', secondary: '#ec4899' },
                ocean: { primary: '#10b981', secondary: '#3b82f6' }
            },
            light: {
                clean: { primary: '#2563eb', secondary: '#6366f1' },
                soft: { primary: '#d97706', secondary: '#92400e' },
                nature: { primary: '#059669', secondary: '#15803d' }
            }
        }

        const currentPalette = palettes[visualSettings.theme][visualSettings.palette]
        if (currentPalette) {
            root.style.setProperty('--accent-primary', currentPalette.primary)
            root.style.setProperty('--accent-secondary', currentPalette.secondary)
        }

        localStorage.setItem('visualSettings', JSON.stringify(visualSettings))
    }, [visualSettings])

    // Guardar en localStorage cuando cambien los datos (solo después de cargar)
    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('clientes', JSON.stringify(clientes))
            } catch (error) {
                console.error('Error al guardar clientes:', error)
            }
        }
    }, [clientes, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('productos', JSON.stringify(productos))
            } catch (error) {
                console.error('Error al guardar productos:', error)
            }
        }
    }, [productos, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('facturas', JSON.stringify(facturas))
            } catch (error) {
                console.error('Error al guardar facturas:', error)
            }
        }
    }, [facturas, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('pagos', JSON.stringify(pagos))
            } catch (error) {
                console.error('Error al guardar pagos:', error)
            }
        }
    }, [pagos, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('vendedores', JSON.stringify(vendedores))
            } catch (error) {
                console.error('Error al guardar vendedores:', error)
            }
        }
    }, [vendedores, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('brecha', brecha.toString())
        }
    }, [brecha, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('porcentajeCredito', porcentajeCredito.toString())
        }
    }, [porcentajeCredito, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('diasCredito', diasCredito.toString())
        }
    }, [diasCredito, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('pedidos', JSON.stringify(pedidos))
        }
    }, [pedidos, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('deliveryDate', deliveryDate)
        }
    }, [deliveryDate, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            try {
                localStorage.setItem('compras', JSON.stringify(compras))
            } catch (error) {
                console.error('Error al guardar compras:', error)
            }
        }
    }, [compras, isLoaded])

    // No guardamos tasaCambio en localStorage porque se obtiene automáticamente de la API

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return (
                    <Dashboard
                        facturas={facturas}
                        pagos={pagos}
                        tasaCambio={tasaCambio}
                        setTasaCambio={setTasaCambio}
                        clientes={clientes}
                        productos={productos}
                        vendedores={vendedores}
                        pedidos={pedidos}
                        setCurrentView={setCurrentView}
                        onVerDetalleFactura={(factura) => {
                            setFacturaADetalle(factura)
                            setCurrentView('facturas')
                        }}
                        onVerDetalleVendedor={(vendedor) => {
                            setVendedorADetalle(vendedor)
                            setCurrentView('vendedores')
                        }}
                    />
                )
            case 'clientes':
                return (
                    <Clientes
                        clientes={clientes}
                        setClientes={setClientes}
                        externalEditCliente={externalEditCliente}
                        setExternalEditCliente={setExternalEditCliente}
                        facturas={facturas}
                        tasaCambio={tasaCambio}
                    />
                )
            case 'productos':
                return (
                    <Productos
                        productos={productos}
                        setProductos={setProductos}
                        brechaGlobal={brechaBase + brecha}
                        porcentajeCredito={porcentajeCredito}
                    />
                )
            case 'pedidos':
                return (
                    <Pedidos
                        pedidos={pedidos}
                        setPedidos={setPedidos}
                        clientes={clientes}
                        productos={productos}
                        tasaCambio={tasaCambio}
                        onConvertirAFactura={(pedido) => {
                            setPedidoAConvertir(pedido)
                            setCurrentView('facturas')
                        }}
                    />
                )
            case 'facturas':
                return (
                    <Facturas
                        facturas={facturas}
                        setFacturas={setFacturas}
                        pedidos={pedidos}
                        setPedidos={setPedidos}
                        clientes={clientes}
                        productos={productos}
                        setProductos={setProductos}
                        openClienteEditor={openClienteEditor}
                        tasaCambio={tasaCambio}
                        vendedores={vendedores}
                        pedidoAConvertir={pedidoAConvertir}
                        setPedidoAConvertir={setPedidoAConvertir}
                        facturaADetalle={facturaADetalle}
                        setFacturaADetalle={setFacturaADetalle}
                        porcentajeCredito={porcentajeCredito}
                        diasCredito={diasCredito}
                        onPagarFactura={(factura) => {
                            setFacturaAPagar(factura)
                            setCurrentView('pagos')
                        }}
                    />
                )
            case 'pagos':
                return (
                    <Pagos
                        pagos={pagos}
                        setPagos={setPagos}
                        facturas={facturas}
                        setFacturas={setFacturas}
                        tasaCambio={tasaCambio}
                        clientes={clientes}
                        facturaAPagar={facturaAPagar}
                        setFacturaAPagar={setFacturaAPagar}
                    />
                )
            case 'mensajeria':
                return (
                    <Mensajeria
                        clientes={clientes}
                        facturas={facturas}
                        tasaCambio={tasaCambio}
                        productos={productos}
                        deliveryDate={deliveryDate}
                        setDeliveryDate={setDeliveryDate}
                    />
                )
            case 'exchanger':
                return <Exchanger />
            case 'reportes':
                return (
                    <Reportes
                        facturas={facturas}
                        pagos={pagos}
                        productos={productos}
                        vendedores={vendedores}
                        tasaCambio={tasaCambio}
                        clientes={clientes}
                        compras={compras}
                    />
                )
            case 'configuracion':
                return (
                    <Configuracion
                        settings={visualSettings}
                        setSettings={setVisualSettings}
                        brecha={brecha}
                        setBrecha={setBrecha}
                        brechaBase={brechaBase}
                        porcentajeCredito={porcentajeCredito}
                        setPorcentajeCredito={setPorcentajeCredito}
                        diasCredito={diasCredito}
                        setDiasCredito={setDiasCredito}
                    />
                )
            case 'vendedores':
                return (
                    <Vendedores
                        vendedores={vendedores}
                        setVendedores={setVendedores}
                        productos={productos}
                        facturas={facturas}
                        tasaCambio={tasaCambio}
                        vendedorADetalle={vendedorADetalle}
                        setVendedorADetalle={setVendedorADetalle}
                    />
                )

            case 'datos':
                return (
                    <DataManagement
                        clientes={clientes}
                        setClientes={setClientes}
                        productos={productos}
                        setProductos={setProductos}
                        facturas={facturas}
                        setFacturas={setFacturas}
                        pagos={pagos}
                        setPagos={setPagos}
                        vendedores={vendedores}
                        setVendedores={setVendedores}
                        tasaCambio={tasaCambio}
                        setTasaCambio={setTasaCambio}
                        pedidos={pedidos}
                        setPedidos={setPedidos}
                        brecha={brecha}
                        setBrecha={setBrecha}
                        deliveryDate={deliveryDate}
                        setDeliveryDate={setDeliveryDate}
                        compras={compras}
                        setCompras={setCompras}
                    />
                )
            case 'compras':
                return (
                    <Compras
                        compras={compras}
                        setCompras={setCompras}
                        productos={productos}
                        setProductos={setProductos}
                        tasaCambio={tasaCambio}
                    />
                )
            default:
                return <Dashboard />
        }
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <div className="app">
                <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                    <Toolbar>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            sx={{ mr: 2, display: { md: 'none' } }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                            SISCONVEN 2026
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={visualSettings.theme === 'dark'}
                                    onChange={(e) => {
                                        const newTheme = e.target.checked ? 'dark' : 'light'
                                        const defaultPalette = newTheme === 'light' ? 'clean' : 'indigo'
                                        setVisualSettings({ ...visualSettings, theme: newTheme, palette: defaultPalette })
                                    }}
                                    color="secondary"
                                />
                            }
                            label="Modo Oscuro"
                            sx={{ color: 'text.primary' }}
                        />
                    </Toolbar>
                </AppBar>

                {/* Drawer permanente para escritorio (visible en md y superiores) */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { 
                            boxSizing: 'border-box', 
                            width: 240,
                            mt: 8 
                        },
                    }}
                >
                    <Box sx={{ p: 2, mt: 0 }}>
                        <List>
                            <ListItem button onClick={() => setCurrentView('dashboard')}>
                                <ListItemIcon><BarChart /></ListItemIcon>
                                <ListItemText primary="Dashboard" />
                            </ListItem>
                            <ListItem button onClick={() => setCurrentView('reportes')}>
                                <ListItemIcon><BarChart /></ListItemIcon>
                                <ListItemText primary="Reportes" />
                            </ListItem>
                            
                            {/* Ventas */}
                            <ListItem button onClick={() => toggleDropdown('ventas')}>
                                <ListItemIcon><AttachMoney /></ListItemIcon>
                                <ListItemText primary="Ventas" />
                            </ListItem>
                            {activeDropdown === 'ventas' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => setCurrentView('pedidos')}>
                                        <ListItemIcon><ShoppingCart /></ListItemIcon>
                                        <ListItemText primary="Pedidos" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('facturas')}>
                                        <ListItemIcon><Receipt /></ListItemIcon>
                                        <ListItemText primary="Facturas" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('pagos')}>
                                        <ListItemIcon><Payment /></ListItemIcon>
                                        <ListItemText primary="Pagos" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('clientes')}>
                                        <ListItemIcon><People /></ListItemIcon>
                                        <ListItemText primary="Clientes" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('vendedores')}>
                                        <ListItemIcon><People /></ListItemIcon>
                                        <ListItemText primary="Vendedores" />
                                    </ListItem>
                                </Box>
                            )}

                            {/* Inventario */}
                            <ListItem button onClick={() => toggleDropdown('inventario')}>
                                <ListItemIcon><Inventory /></ListItemIcon>
                                <ListItemText primary="Inventario" />
                            </ListItem>
                            {activeDropdown === 'inventario' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => setCurrentView('productos')}>
                                        <ListItemIcon><BoxIcon /></ListItemIcon>
                                        <ListItemText primary="Productos" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('compras')}>
                                        <ListItemIcon><ShoppingCart /></ListItemIcon>
                                        <ListItemText primary="Compras" />
                                    </ListItem>
                                </Box>
                            )}

                            {/* Administración */}
                            <ListItem button onClick={() => toggleDropdown('admin')}>
                                <ListItemIcon><Settings /></ListItemIcon>
                                <ListItemText primary="Admin" />
                            </ListItem>
                            {activeDropdown === 'admin' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => setCurrentView('mensajeria')}>
                                        <ListItemIcon><Message /></ListItemIcon>
                                        <ListItemText primary="Mensajería" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('exchanger')}>
                                        <ListItemIcon><AttachMoney /></ListItemIcon>
                                        <ListItemText primary="Tasas de Cambio" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('configuracion')}>
                                        <ListItemIcon><Settings /></ListItemIcon>
                                        <ListItemText primary="Configuración" />
                                    </ListItem>
                                    <ListItem button onClick={() => setCurrentView('datos')}>
                                        <ListItemIcon><Storage /></ListItemIcon>
                                        <ListItemText primary="Gestión de Datos" />
                                    </ListItem>
                                </Box>
                            )}
                        </List>
                    </Box>
                </Drawer>

                {/* Drawer temporal para móviles (solo visible en xs) */}
                <Drawer
                    variant="temporary"
                    open={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                    }}
                >
                    <Box sx={{ p: 2, mt: 8 }}>
                        <List>
                            <ListItem button onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }}>
                                <ListItemIcon><BarChart /></ListItemIcon>
                                <ListItemText primary="Dashboard" />
                            </ListItem>
                            <ListItem button onClick={() => { setCurrentView('reportes'); setMobileMenuOpen(false); }}>
                                <ListItemIcon><BarChart /></ListItemIcon>
                                <ListItemText primary="Reportes" />
                            </ListItem>
                            
                            {/* Ventas */}
                            <ListItem button onClick={() => toggleDropdown('ventas')}>
                                <ListItemIcon><AttachMoney /></ListItemIcon>
                                <ListItemText primary="Ventas" />
                            </ListItem>
                            {activeDropdown === 'ventas' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => { setCurrentView('pedidos'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><ShoppingCart /></ListItemIcon>
                                        <ListItemText primary="Pedidos" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('facturas'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><Receipt /></ListItemIcon>
                                        <ListItemText primary="Facturas" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('pagos'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><Payment /></ListItemIcon>
                                        <ListItemText primary="Pagos" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('clientes'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><People /></ListItemIcon>
                                        <ListItemText primary="Clientes" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('vendedores'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><People /></ListItemIcon>
                                        <ListItemText primary="Vendedores" />
                                    </ListItem>
                                </Box>
                            )}

                            {/* Inventario */}
                            <ListItem button onClick={() => toggleDropdown('inventario')}>
                                <ListItemIcon><Inventory /></ListItemIcon>
                                <ListItemText primary="Inventario" />
                            </ListItem>
                            {activeDropdown === 'inventario' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => { setCurrentView('productos'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><BoxIcon /></ListItemIcon>
                                        <ListItemText primary="Productos" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('compras'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><ShoppingCart /></ListItemIcon>
                                        <ListItemText primary="Compras" />
                                    </ListItem>
                                </Box>
                            )}

                            {/* Administración */}
                            <ListItem button onClick={() => toggleDropdown('admin')}>
                                <ListItemIcon><Settings /></ListItemIcon>
                                <ListItemText primary="Admin" />
                            </ListItem>
                            {activeDropdown === 'admin' && (
                                <Box sx={{ pl: 4 }}>
                                    <ListItem button onClick={() => { setCurrentView('mensajeria'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><Message /></ListItemIcon>
                                        <ListItemText primary="Mensajería" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('exchanger'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><AttachMoney /></ListItemIcon>
                                        <ListItemText primary="Tasas de Cambio" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('configuracion'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><Settings /></ListItemIcon>
                                        <ListItemText primary="Configuración" />
                                    </ListItem>
                                    <ListItem button onClick={() => { setCurrentView('datos'); setMobileMenuOpen(false); }}>
                                        <ListItemIcon><Storage /></ListItemIcon>
                                        <ListItemText primary="Gestión de Datos" />
                                    </ListItem>
                                </Box>
                            )}
                        </List>
                    </Box>
                </Drawer>

                <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, ml: { xs: 0, md: '240px' } }}>
                    {renderView()}
                </Box>
            </div>
        </ThemeProvider>
    )
}

export default App
