import { useState, useEffect } from 'react'
import { formatPhoneForDisplay, formatBs } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'
import { imprimirTicketFactura } from '../utils/printer'

export default function Facturas({ facturas, setFacturas, pedidos, setPedidos, clientes, productos, setProductos, openClienteEditor, tasaCambio, vendedores, pedidoAConvertir, setPedidoAConvertir, facturaADetalle, setFacturaADetalle, onPagarFactura, porcentajeCredito, diasCredito = 15, interesMoratorio = 0 }) {
    const [idPedidoOrigen, setIdPedidoOrigen] = useState(null)
    const [formData, setFormData] = useState({
        cliente_id: '',
        vendedor_id: 'default-venta-directa',
        tipo_precio: 'contado',
        items: []
    })
    const [itemActual, setItemActual] = useState({
        producto_id: '',
        cantidad: '1.000',
        precio_override: '',
        comision_tipo: 'porcentaje',
        comision_valor: ''
    })

    // Sincronizar valores por defecto cuando cambia el producto o el tipo de precio global
    useEffect(() => {
        if (itemActual.producto_id) {
            const producto = productos.find(p => p.id === parseInt(itemActual.producto_id))
            if (producto) {
                const precioBase = formData.tipo_precio === 'credito'
                    ? (producto.precio_usd * (1 + (porcentajeCredito / 100)))
                    : producto.precio_usd

                setItemActual(prev => ({
                    ...prev,
                    precio_override: precioBase.toFixed(2),
                    comision_tipo: producto.comision_tipo || 'porcentaje',
                    comision_valor: (producto.comision_valor || 0).toString()
                }))
            }
        }
    }, [itemActual.producto_id, formData.tipo_precio, productos, porcentajeCredito])

    // Actualizar todos los productos ya agregados si cambia el tipo de precio global
    useEffect(() => {
        if (formData.items.length > 0) {
            const nuevosItems = formData.items.map(item => {
                const producto = productos.find(p => p.id === item.producto_id)
                if (!producto) return item

                const nuevoPrecio = formData.tipo_precio === 'credito'
                    ? (producto.precio_usd * (1 + (porcentajeCredito / 100)))
                    : producto.precio_usd

                return {
                    ...item,
                    tipo_precio: formData.tipo_precio,
                    precio_usd: nuevoPrecio,
                    subtotal: parseFloat((nuevoPrecio * item.cantidad).toFixed(2))
                }
            })

            // Verificar si hubo cambios reales para evitar bucles
            const hasChanged = JSON.stringify(nuevosItems) !== JSON.stringify(formData.items)
            if (hasChanged) {
                setFormData(prev => ({ ...prev, items: nuevosItems }))
            }
        }
    }, [formData.tipo_precio, productos, porcentajeCredito])

    // Texto de WhatsApp generado tras crear una factura
    const [whatsappMessage, setWhatsappMessage] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('') // número destino en formato sólo dígitos (sin +)
    const [whatsappValid, setWhatsappValid] = useState(true)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)
    const [whatsappOpened, setWhatsappOpened] = useState(false) // indica si se abrió WhatsApp automáticamente
    const [facturaTemporal, setFacturaTemporal] = useState(null) // Para imprimir desde el modal de whatsapp

    // Estados para gestión de navegación de vistas
    const [vistaActiva, setVistaActiva] = useState('lista') // 'lista', 'formulario', 'detalle'
    const [detalleFactura, setDetalleFactura] = useState(null)
    const [editandoFactura, setEditandoFactura] = useState(null) // id de factura en edición

    // Efecto para cargar datos desde un pedido
    useEffect(() => {
        if (pedidoAConvertir) {
            setFormData({
                cliente_id: pedidoAConvertir.cliente_id.toString(),
                vendedor_id: 'default-venta-directa',
                items: pedidoAConvertir.items.map(it => ({
                    ...it,
                    precio_usd: it.precio_base_usd,
                    tipo_precio: 'contado',
                    subtotal: it.cantidad * it.precio_base_usd,
                    comision_tipo: 'porcentaje',
                    comision_valor: 0,
                    comision_monto: 0
                }))
            })
            setIdPedidoOrigen(pedidoAConvertir.id)
            setVistaActiva('formulario')
            setPedidoAConvertir(null) // Limpiar para evitar recargas infinitas
        }
    }, [pedidoAConvertir, setPedidoAConvertir])

    // Efecto para abrir directamente el detalle de una factura (usado desde Dashboard)
    useEffect(() => {
        if (facturaADetalle) {
            handleVerFactura(facturaADetalle)
            setFacturaADetalle(null)
        }
    }, [facturaADetalle, setFacturaADetalle])

    // Estados para gestión de búsqueda y ordenación
    const [searchTerm, setSearchTerm] = useState('')
    const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' })

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const facturasFiltradasYOrdenadas = [...facturas]
        .filter(f => {
            const cliente = clientes.find(c => c.id === f.cliente_id)
            const search = searchTerm.toLowerCase()
            return (
                f.id.toString().includes(search) ||
                (cliente?.nombre || '').toLowerCase().includes(search) ||
                f.estado.toLowerCase().includes(search) ||
                (cliente?.telefono || '').includes(search)
            )
        })
        .sort((a, b) => {
            let valA, valB

            switch (sortConfig.key) {
                case 'id':
                    valA = a.id
                    valB = b.id
                    break
                case 'cliente':
                    valA = (clientes.find(c => c.id === a.cliente_id)?.nombre || '').toLowerCase()
                    valB = (clientes.find(c => c.id === b.cliente_id)?.nombre || '').toLowerCase()
                    break
                case 'fecha':
                    valA = new Date(a.fecha).getTime()
                    valB = new Date(b.fecha).getTime()
                    break
                case 'total':
                    valA = a.total_usd
                    valB = b.total_usd
                    break
                case 'saldo':
                    valA = a.saldo_pendiente_usd
                    valB = b.saldo_pendiente_usd
                    break
                case 'estado':
                    valA = a.estado.toLowerCase()
                    valB = b.estado.toLowerCase()
                    break
                default:
                    return 0
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })

    const SortIndicator = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '5px' }}>↕️</span>
        return <span style={{ marginLeft: '5px' }}>{sortConfig.direction === 'asc' ? '🔼' : '🔽'}</span>
    }

    // Formateo para Venezuela: coma decimal, punto de miles y fecha DD/MM/YYYY
    const formatNumberVE = (value, decimals = 2) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0
        return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    const formatDateDDMMYYYY = (date) => {
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    // Normaliza y valida teléfonos para uso en https://wa.me/<telefono>
    // Devuelve { normalized, valid, note }
    const normalizePhoneVE = (raw) => {
        const digits = (raw || '').replace(/\D/g, '')
        if (!digits) return { normalized: '', valid: false, note: '' }

        // Remover ceros a la izquierda
        let d = digits.replace(/^0+/, '')
        let addedPrefix = false

        // Si no tiene prefijo de país (58), intentar agregarlo si parece un número local
        if (!d.startsWith('58')) {
            // Números locales típicos pueden ser 7,9,10 dígitos; añadir 58 para intentar formatear a internacional
            if (d.length >= 7 && d.length <= 11) {
                d = '58' + d
                addedPrefix = true
            }
        }

        // Validación básica: debe iniciar con 58 y tener longitud razonable para WhatsApp
        const valid = d.startsWith('58') && d.length >= 11 && d.length <= 15
        let note = ''
        if (addedPrefix) note = 'Se añadió prefijo de país +58'
        if (!valid) note = note ? `${note}; Número posiblemente inválido` : 'Número posiblemente inválido'

        return { normalized: d, valid, note }
    }

    const agregarItem = () => {
        if (!itemActual.producto_id || itemActual.cantidad <= 0) return

        const producto = productos.find(p => p.id === parseInt(itemActual.producto_id))
        if (!producto) return

        const cantidad = parseFloat(itemActual.cantidad)

        // Validar stock disponible (considerando lo ya agregado en la factura actual)
        const stock = parseFloat(producto.cantidad_kg || 0)
        if (stock <= 0) {
            alert(`No hay existencia de ${producto.nombre}. Stock: 0 Kg.`)
            return
        }
        const yaAgregado = formData.items.reduce((s, it) => s + (it.producto_id === producto.id ? it.cantidad : 0), 0)
        if (cantidad + yaAgregado > stock) {
            alert(`Cantidad solicitada (${cantidad.toFixed(3)} Kg.) + ya agregada (${yaAgregado.toFixed(3)} Kg.) excede stock disponible (${stock.toFixed(3)} Kg.).`)
            return
        }

        // Usar precio manual si existe, sino el calculado
        const precio = parseFloat(itemActual.precio_override) || (itemActual.tipo_precio === 'credito' ? (producto.precio_usd * (1 + (porcentajeCredito / 100))) : producto.precio_usd)

        const nuevoItem = {
            producto_id: producto.id,
            nombre: producto.nombre,
            cantidad: cantidad,
            precio_usd: precio,
            tipo_precio: formData.tipo_precio,

            subtotal: parseFloat((precio * cantidad).toFixed(2)),
            // Guardar configuración de comisión específica para este item (permite overrides)
            comision_tipo: itemActual.comision_tipo,
            comision_valor: parseFloat(itemActual.comision_valor) || 0
        }

        setFormData({
            ...formData,
            items: [...formData.items, nuevoItem]
        })

        setItemActual({
            producto_id: '',
            cantidad: '1.000',
            precio_override: '',
            comision_tipo: 'porcentaje',
            comision_valor: ''
        })
    }

    const eliminarItem = (index) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index)
        })
    }

    const calcularTotal = () => {
        return parseFloat(formData.items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
    }

    const calcularComisiones = () => {
        if (!formData.vendedor_id || formData.items.length === 0) {
            return { detalle: [], total: 0 }
        }

        const vendedor = vendedores?.find(v => v.id.toString() === formData.vendedor_id.toString())
        if (!vendedor) {
            return { detalle: [], total: 0 }
        }

        const detalle = []
        let total = 0

        formData.items.forEach(item => {
            // Usar la comisión configurada en el item (que puede ser un override)
            const tipoComision = item.comision_tipo || 'porcentaje'
            const valorComision = item.comision_valor || 0

            if (valorComision > 0) {
                let comision = 0
                if (tipoComision === 'porcentaje') {
                    comision = parseFloat((item.subtotal * (valorComision / 100)).toFixed(2))
                } else if (tipoComision === 'fijo') {
                    comision = valorComision * item.cantidad
                }

                detalle.push({
                    producto_id: item.producto_id,
                    nombre: item.nombre,
                    tipo: tipoComision,
                    valor: valorComision,
                    comision: comision
                })
                total += comision
            }
        })

        return { detalle, total }
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        if (!formData.cliente_id || formData.items.length === 0) {
            alert('Debes seleccionar un cliente y agregar al menos un producto')
            return
        }

        const total = calcularTotal()

        if (editandoFactura) {
            // Actualizar factura existente
            const facturaActual = facturas.find(f => f.id === editandoFactura)
            if (!facturaActual) {
                alert('Factura a editar no encontrada')
                return
            }

            // Mantener fecha de creación; recalcular saldo respetando pagos previos
            const pagado = facturaActual.total_usd - facturaActual.saldo_pendiente_usd
            const nuevoSaldo = Math.max(0, total - pagado)

            // Calcular comisiones
            const comisiones = calcularComisiones()

            const facturaActualizada = {
                ...facturaActual,
                cliente_id: parseInt(formData.cliente_id),
                vendedor_id: formData.vendedor_id || null,
                items: formData.items,
                total_usd: total,
                saldo_pendiente_usd: nuevoSaldo,
                comisiones_detalle: comisiones.detalle,
                comisiones_total: comisiones.total
            }

            // Ajustar stock según diferencia entre items antiguos y nuevos
            const productosMap = {}
            productos.forEach(p => { productosMap[p.id] = p })

            // Calcular cantidades por producto en items antiguos y nuevos
            const oldCounts = {}
            facturaActual.items.forEach(it => { oldCounts[it.producto_id] = (oldCounts[it.producto_id] || 0) + it.cantidad })
            const newCounts = {}
            facturaActualizada.items.forEach(it => { newCounts[it.producto_id] = (newCounts[it.producto_id] || 0) + it.cantidad })

            // Verificar si hay suficiente stock para incrementos
            for (const prodIdStr of Object.keys(newCounts)) {
                const prodId = parseInt(prodIdStr)
                const oldQty = oldCounts[prodId] || 0
                const newQty = newCounts[prodId] || 0
                const delta = newQty - oldQty
                if (delta > 0) {
                    const stock = parseFloat(productosMap[prodId]?.cantidad_kg || 0)
                    if (stock < delta) {
                        alert(`No hay stock suficiente para el producto ${productosMap[prodId]?.nombre || prodId}. Stock: ${stock.toFixed(3)} Kg.`)
                        return
                    }
                }
            }

            // Aplicar cambios al inventario
            const productosActualizados = productos.map(p => {
                const oldQty = oldCounts[p.id] || 0
                const newQty = newCounts[p.id] || 0
                const delta = newQty - oldQty
                if (delta !== 0) {
                    return { ...p, cantidad_kg: Math.max(0, (p.cantidad_kg || 0) - delta) }
                }
                return p
            })
            setProductos(productosActualizados)

            setFacturas(facturas.map(f => f.id === facturaActualizada.id ? facturaActualizada : f))
            setFacturaTemporal(facturaActualizada)

            // Generar fecha de vencimiento basado en la configuración de días de crédito
            const fechaCreacion = new Date(facturaActual.fecha)
            const fechaVencimiento = diasCredito === 0 ? fechaCreacion : new Date(fechaCreacion.getTime() + (diasCredito * 24 * 60 * 60 * 1000))

            const cliente = clientes.find(c => c.id === facturaActualizada.cliente_id)
            const clienteNombre = cliente?.nombre || 'Cliente'

            const itemsText = facturaActualizada.items.map(i => {
                const qty = formatNumberVE(i.cantidad, 3)
                const subtotal = formatNumberVE(i.subtotal, 2)
                return `- ${i.nombre} x${qty} Kg. — $${subtotal} USD`
            }).join('\n')

            const whatsappText = `*Factura Actualizada*\n*Factura:* #${facturaActualizada.id}\n*Cliente:* ${clienteNombre}\n*Fecha de emisión:* ${formatDateDDMMYYYY(fechaCreacion)}\n*Fecha de vencimiento:* ${formatDateDDMMYYYY(fechaVencimiento)}\n\n*Items:*\n${itemsText}\n\n*Total:* $${formatNumberVE(facturaActualizada.total_usd, 2)} USD\n\nCambios realizados en la factura.`

            const telefonoRaw = cliente?.telefono || ''
            const { normalized, valid, note } = normalizePhoneVE(telefonoRaw)

            setWhatsappMessage(whatsappText)
            setWhatsappTo(normalized)
            setWhatsappValid(valid)
            setWhatsappNote(note)

            setEditandoFactura(null)
            setFormData({ cliente_id: '', vendedor_id: 'default-venta-directa', tipo_precio: 'contado', items: [] })
            setVistaActiva('lista')

            return
        }

        // Crear nueva factura
        const fechaCreacion = new Date()

        // Calcular comisiones
        const comisiones = calcularComisiones()

        const nuevaFactura = {
            id: Date.now(),
            cliente_id: parseInt(formData.cliente_id),
            vendedor_id: formData.vendedor_id || null,
            tipo_precio: formData.tipo_precio,
            fecha: fechaCreacion.toISOString(),
            items: formData.items,
            total_usd: total,
            saldo_pendiente_usd: total,
            estado: 'Pendiente',
            comisiones_detalle: comisiones.detalle,
            comisiones_total: comisiones.total
        }

        // Verificar stock final antes de guardar (solo necesario por seguridad)
        const productoMap = {}
        productos.forEach(p => { productoMap[p.id] = p })
        for (const it of nuevaFactura.items) {
            const p = productoMap[it.producto_id]
            const stock = parseFloat(p?.cantidad_kg || 0)
            if (stock < it.cantidad) {
                alert(`No hay stock suficiente para ${it.nombre}. Stock: ${stock.toFixed(3)} Kg.`)
                return
            }
        }

        // Reducir stock de productos vendidos
        const nuevosProductos = productos.map(p => {
            const soldQty = nuevaFactura.items.reduce((s, it) => s + (it.producto_id === p.id ? it.cantidad : 0), 0)
            if (soldQty > 0) {
                return { ...p, cantidad_kg: Math.max(0, (p.cantidad_kg || 0) - soldQty) }
            }
            return p
        })
        setProductos(nuevosProductos)

        // Guardar factura
        setFacturas([...facturas, nuevaFactura])
        setFacturaTemporal(nuevaFactura)

        // Generar fecha de vencimiento basado en la configuración de días de crédito
        const fechaVencimiento = diasCredito === 0 ? fechaCreacion : new Date(fechaCreacion.getTime() + (diasCredito * 24 * 60 * 60 * 1000))

        // Buscar cliente para incluir nombre
        const cliente = clientes.find(c => c.id === nuevaFactura.cliente_id)
        const clienteNombre = cliente?.nombre || 'Cliente'

        // Crear listado de items para el mensaje (cantidad en Kg. con 3 decimales, subtotales formateados)
        const itemsText = nuevaFactura.items.map(i => {
            const qty = formatNumberVE(i.cantidad, 3)
            const subtotal = formatNumberVE(i.subtotal, 2)
            return `- ${i.nombre} x${qty} Kg. — $${subtotal} USD`
        }).join('\n')

        // Texto con formato enriquecido para WhatsApp (fechas en DD/MM/YYYY, números en formato VE)
        const whatsappText = `*Nueva Factura*\n*Factura:* #${nuevaFactura.id}\n*Cliente:* ${clienteNombre}\n*Fecha de emisión:* ${formatDateDDMMYYYY(fechaCreacion)}\n*Fecha de vencimiento:* ${formatDateDDMMYYYY(fechaVencimiento)}\n\n*Items:*\n${itemsText}\n\n*Total:* $${formatNumberVE(nuevaFactura.total_usd, 2)} USD\n\nPor favor, realice el pago antes de la fecha de vencimiento. Gracias.`

        // Normalizar y validar teléfono del cliente para usar como destinatario en wa.me
        const telefonoRaw = cliente?.telefono || ''
        const { normalized, valid, note } = normalizePhoneVE(telefonoRaw)

        // Guardar mensaje, destinatario, validación y resetear formulario (manteniendo el mensaje visible para copiar)
        setWhatsappMessage(whatsappText)
        setWhatsappTo(normalized)
        setWhatsappValid(valid)
        setWhatsappNote(note)

        // Si la factura proviene de un pedido, eliminarlo de la lista
        if (idPedidoOrigen) {
            setPedidos(pedidos.filter(p => p.id !== idPedidoOrigen))
            setIdPedidoOrigen(null)
        }

        setFormData({ cliente_id: '', vendedor_id: 'default-venta-directa', tipo_precio: 'contado', items: [] })
        setVistaActiva('lista')
    }

    const handleCancelar = () => {
        setFormData({ cliente_id: '', vendedor_id: 'default-venta-directa', tipo_precio: 'contado', items: [] })
        setItemActual({ producto_id: '', cantidad: '1.000', precio_override: '', comision_tipo: 'porcentaje', comision_valor: '' })
        setIdPedidoOrigen(null)
        setVistaActiva('lista')
        setEditandoFactura(null)
    }

    const handleEditarFactura = (factura) => {
        setFormData({
            cliente_id: String(factura.cliente_id),
            vendedor_id: String(factura.vendedor_id || ''),
            tipo_precio: factura.tipo_precio || 'credito', // Facturas antiguas eran implícitamente crédito
            items: factura.items.map(it => ({ ...it }))
        })
        setEditandoFactura(factura.id)
        setVistaActiva('formulario')
    }

    const handleEliminarFactura = (id) => {
        if (confirm('¿Estás seguro de eliminar esta factura?')) {
            setFacturas(facturas.filter(f => f.id !== id))
            if (editandoFactura === id) {
                setEditandoFactura(null)
                setFormData({ cliente_id: '', vendedor_id: '', items: [] })
                setVistaActiva('lista')
            }
        }
    }

    const handleVerFactura = (factura) => {
        setDetalleFactura(factura)
        setVistaActiva('detalle')
    }

    // Genera un mensaje de cobro para WhatsApp con saludo, detalle de adeudo y totales en USD y Bs
    const generarMensajeCobro = (factura) => {
        const cliente = clientes.find(c => c.id === factura.cliente_id)
        const clienteNombre = cliente?.nombre || 'Cliente'
        const fechaCreacion = new Date(factura.fecha)
        const fechaVencimiento = diasCredito === 0 ? fechaCreacion : new Date(fechaCreacion.getTime() + (diasCredito * 24 * 60 * 60 * 1000))

        const itemsText = factura.items.map(i => {
            const qty = formatNumberVE(i.cantidad, 3)
            const subtotal = formatNumberVE(i.subtotal, 2)
            return `- ${i.nombre} x${qty} Kg. — $${subtotal} USD`
        }).join('\n')

        let montoMora = 0;
        const esFacturaCredito = (factura.tipo_precio === 'credito' || !factura.tipo_precio);
        
        if (new Date() > fechaVencimiento && interesMoratorio > 0 && esFacturaCredito) {
            const diasAtraso = Math.floor((new Date().getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000))
            const periods = Math.floor(diasAtraso / 30) + 1
            montoMora = (factura.saldo_pendiente_usd || 0) * (interesMoratorio / 100) * periods
        }

        const saldoBase = factura.saldo_pendiente_usd || 0;
        const totalUSDNum = saldoBase + montoMora;
        const totalUSD = formatNumberVE(totalUSDNum, 2)
        const totalBs = formatBs(totalUSDNum * (tasaCambio || 0))

        let whatsappText = `Hola ${clienteNombre}, reciba un cordial saludo.\n\nLe recordamos que tiene una factura pendiente a su nombre:\n*Factura:* #${factura.id}\n*Fecha de emisión:* ${formatDateDDMMYYYY(fechaCreacion)}\n*Fecha de vencimiento:* ${formatDateDDMMYYYY(fechaVencimiento)}\n\n*Detalle:*\n${itemsText}\n\n*Saldo pendiente:* $${totalUSD} USD (${totalBs})\n\n`
        
        if (montoMora > 0) {
            whatsappText += `*Nota:* Este monto incluye $${formatNumberVE(montoMora, 2)} USD por concepto de intereses moratorios al tener ${Math.floor((new Date().getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000))} días de atraso.\n\n`
        }

        whatsappText += `Por favor, realice el pago antes de la fecha de vencimiento. Muchas gracias.`

        // Normalizar y validar teléfono del cliente
        const telefonoRaw = cliente?.telefono || ''
        const { normalized, valid, note } = normalizePhoneVE(telefonoRaw)

        setWhatsappMessage(whatsappText)
        setWhatsappTo(normalized)
        setWhatsappValid(valid)
        setWhatsappNote(note)
    }

    const copiarWhatsApp = async () => {
        if (!whatsappMessage) return
        try {
            await navigator.clipboard.writeText(whatsappMessage)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            alert('No se pudo copiar al portapapeles. Copia manualmente el texto.')
        }
    }

    let vistaContenido;

    if (vistaActiva === 'formulario') {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={handleCancelar}>
                            ← Volver a la Lista
                        </button>
                        <h1 className="page-title">{editandoFactura ? 'Editar Factura' : 'Nueva Factura'}</h1>
                    </div>
                </div>

                <div className="card mb-4 fade-in">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Cliente *</label>
                            <select
                                className="form-select"
                                value={formData.cliente_id}
                                onChange={(e) => {
                                    const clientId = e.target.value;
                                    const client = clientes.find(c => c.id.toString() === clientId);
                                    let newTipoPrecio = formData.tipo_precio;
                                    if (client && client.permite_credito === false) {
                                        newTipoPrecio = 'contado';
                                    }
                                    setFormData({ ...formData, cliente_id: clientId, tipo_precio: newTipoPrecio });
                                }}
                                required
                            >
                                <option value="">Seleccionar cliente...</option>
                                {[...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((cliente) => (
                                    <option key={cliente.id} value={cliente.id}>
                                        {cliente.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Vendedor (opcional)</label>
                            <select
                                className="form-select"
                                value={formData.vendedor_id}
                                onChange={(e) => setFormData({ ...formData, vendedor_id: e.target.value })}
                            >
                                <option value="">Sin vendedor asignado</option>
                                {[...(vendedores || [])].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((vendedor) => (
                                    <option key={vendedor.id} value={vendedor.id}>
                                        {vendedor.nombre}
                                    </option>
                                ))}
                            </select>
                            {formData.vendedor_id && (
                                <p className="text-small text-muted mt-1">
                                    Las comisiones se calcularán automáticamente según la configuración del vendedor
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tipo de Facturación (Afecta a todos los productos) *</label>
                            {formData.cliente_id && clientes.find(c => c.id.toString() === formData.cliente_id)?.permite_credito === false && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    Este cliente solo tiene permitidas transacciones de contado.
                                </Alert>
                            )}
                            <div className="flex flex-gap items-center" style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px' }}>
                                <label className="flex items-center" style={{ cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="global_tipo_precio"
                                        value="contado"
                                        checked={formData.tipo_precio === 'contado'}
                                        onChange={(e) => setFormData({ ...formData, tipo_precio: e.target.value })}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>Contado</strong> (Precios estándar)
                                </label>
                                <label className="flex items-center" style={{ cursor: (formData.cliente_id && clientes.find(c => c.id.toString() === formData.cliente_id)?.permite_credito === false) ? 'not-allowed' : 'pointer', marginLeft: '20px', opacity: (formData.cliente_id && clientes.find(c => c.id.toString() === formData.cliente_id)?.permite_credito === false) ? 0.5 : 1 }}>
                                    <input
                                        type="radio"
                                        name="global_tipo_precio"
                                        value="credito"
                                        checked={formData.tipo_precio === 'credito'}
                                        onChange={(e) => setFormData({ ...formData, tipo_precio: e.target.value })}
                                        disabled={formData.cliente_id && clientes.find(c => c.id.toString() === formData.cliente_id)?.permite_credito === false}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>Crédito</strong> (+{porcentajeCredito}% sobre base)
                                </label>
                            </div>
                        </div>

                        {editandoFactura && (
                            <div className="form-group">
                                <label className="form-label">Fecha de emisión</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formatDateDDMMYYYY(facturas.find(f => f.id === editandoFactura)?.fecha)}
                                    disabled
                                />
                                <p className="text-small text-muted">La fecha de emisión es inmutable y no puede ser modificada.</p>
                            </div>
                        )}

                        <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                            <h4 className="mb-3">Agregar Productos</h4>
                            <div className="grid grid-3 flex-gap mb-3">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Producto</label>
                                    <select
                                        className="form-select"
                                        value={itemActual.producto_id}
                                        onChange={(e) => setItemActual({ ...itemActual, producto_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {[...productos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((producto) => (
                                            <option key={producto.id} value={producto.id}>
                                                {producto.nombre} - ${producto.precio_usd.toFixed(2)} ({formatNumberVE(producto.cantidad_kg || 0, 3)} Kg disponible)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Cantidad (Kg.)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        className="form-input"
                                        value={itemActual.cantidad}
                                        onChange={(e) => setItemActual({ ...itemActual, cantidad: e.target.value })}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Modo Activo</label>
                                    <div className="form-input" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                        {formData.tipo_precio === 'credito' ? '🟠 Crédito' : '🔵 Contado'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-4 flex-gap mb-3 p-3" style={{ background: 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label text-small">Precio Venta (USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={itemActual.precio_override}
                                        onChange={(e) => setItemActual({ ...itemActual, precio_override: e.target.value })}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label text-small">Tipo Comisión</label>
                                    <select
                                        className="form-select"
                                        value={itemActual.comision_tipo}
                                        onChange={(e) => setItemActual({ ...itemActual, comision_tipo: e.target.value })}
                                    >
                                        <option value="fijo">Monto Fijo (USD)</option>
                                        <option value="porcentaje">Porcentaje (%)</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label text-small">Valor Comisión</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={itemActual.comision_valor}
                                        onChange={(e) => setItemActual({ ...itemActual, comision_valor: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={agregarItem}
                                        style={{ width: '100%' }}
                                    >
                                        + Agregar
                                    </button>
                                </div>
                            </div>

                            {formData.items.length > 0 && (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Cantidad</th>
                                                <th>Tipo</th>
                                                <th>Precio Unit.</th>
                                                <th>Subtotal</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td>{item.nombre}</td>
                                                    <td>{parseFloat(item.cantidad).toFixed(3)}</td>
                                                    <td><span className={`badge ${item.tipo_precio === 'credito' ? 'badge-success' : 'badge-secondary'}`}>{item.tipo_precio === 'credito' ? 'Crédito' : 'Contado'}</span></td>
                                                    <td>${item.precio_usd.toFixed(2)}</td>
                                                    <td>${item.subtotal.toFixed(2)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => eliminarItem(index)}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td colSpan="4" className="text-right"><strong>TOTAL:</strong></td>
                                                <td colSpan="2"><strong>${calcularTotal().toFixed(2)} USD</strong></td>
                                            </tr>
                                            {formData.vendedor_id && (() => {
                                                const comisiones = calcularComisiones()
                                                if (comisiones.total > 0) {
                                                    return (
                                                        <>
                                                            <tr style={{ borderTop: '2px solid var(--border)' }}>
                                                                <td colSpan="5" className="text-center" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
                                                                    <strong>Comisiones del Vendedor</strong>
                                                                </td>
                                                            </tr>
                                                            {comisiones.detalle.map((com, idx) => (
                                                                <tr key={idx} style={{ background: 'rgba(76, 175, 80, 0.05)' }}>
                                                                    <td>{com.nombre}</td>
                                                                    <td colSpan="2" className="text-small text-muted">
                                                                        {com.tipo === 'porcentaje' ? `${com.valor}%` : `$${com.valor.toFixed(2)} USD por Kg`}
                                                                    </td>
                                                                    <td colSpan="2" className="text-success">
                                                                        <strong>+${com.comision.toFixed(2)} USD</strong>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            <tr style={{ background: 'rgba(76, 175, 80, 0.1)' }}>
                                                                <td colSpan="3" className="text-right"><strong>TOTAL COMISIONES:</strong></td>
                                                                <td colSpan="2"><strong className="text-success">${comisiones.total.toFixed(2)} USD</strong></td>
                                                            </tr>
                                                        </>
                                                    )
                                                }
                                                return null
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-gap mt-4">
                            <button type="submit" className="btn btn-primary">
                                {editandoFactura ? 'Actualizar Factura' : 'Crear Factura'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={handleCancelar}>
                                Cancelar y Volver
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    } else if (vistaActiva === 'detalle' && detalleFactura) {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <button className="btn btn-secondary mb-2" onClick={() => setVistaActiva('lista')}>
                            ← Volver a la Lista
                        </button>
                        <h1 className="page-title">Detalle de Factura #{detalleFactura.id}</h1>
                    </div>
                    <div className="flex flex-gap">
                        <button className="btn btn-secondary" onClick={() => {
                            const cliente = clientes.find(c => c.id === detalleFactura.cliente_id)
                            imprimirTicketFactura(detalleFactura, cliente, { tasaCambio, diasCredito, interesMoratorio })
                        }}>
                            🖨️ Imprimir
                        </button>
                        {detalleFactura.estado !== 'Pagada' && (
                            <>
                                <button className="btn btn-primary" onClick={() => generarMensajeCobro(detalleFactura)}>
                                    Mensaje Cobro
                                </button>
                                <button className="btn btn-secondary" onClick={() => handleEditarFactura(detalleFactura)}>
                                    Editar Factura
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-2 flex-gap mb-4">
                    <div className="card p-4">
                        <h3 className="mb-3">Información del Cliente</h3>
                        <div className="mb-2"><strong>Cliente:</strong> {clientes.find(c => c.id === detalleFactura.cliente_id)?.nombre || 'N/A'}</div>
                        <div className="mb-2"><strong>Teléfono:</strong> {formatPhoneForDisplay(clientes.find(c => c.id === detalleFactura.cliente_id)?.telefono) || 'N/A'}</div>
                        <div className="mb-2"><strong>Cédula/RIF:</strong> {clientes.find(c => c.id === detalleFactura.cliente_id)?.cedula || 'N/A'}</div>
                    </div>
                    <div className="card p-4">
                        <h3 className="mb-3">Resumen de Factura</h3>
                        <div className="mb-2"><strong>Fecha Emisión:</strong> {formatDateDDMMYYYY(detalleFactura.fecha)}</div>
                        <div className="mb-2"><strong>Vencimiento:</strong> {formatDateDDMMYYYY(diasCredito === 0 ? new Date(detalleFactura.fecha) : new Date(new Date(detalleFactura.fecha).getTime() + diasCredito * 24 * 60 * 60 * 1000))}</div>
                        <div className="mb-2">
                            <strong>Estado:</strong>
                            <span className={`badge ml-2 ${detalleFactura.estado === 'Pagada' ? 'badge-success' :
                                detalleFactura.estado === 'Parcial' ? 'badge-warning' :
                                    'badge-danger'
                                }`}>
                                {detalleFactura.estado}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">Ítems de Factura</h3>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unit.</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleFactura.items.map((it, idx) => (
                                    <tr key={idx}>
                                        <td>{it.nombre}</td>
                                        <td>{formatNumberVE(it.cantidad, 3)} Kg.</td>
                                        <td>${formatNumberVE(it.precio_usd, 2)} USD</td>
                                        <td>${formatNumberVE(it.subtotal, 2)} USD</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan="3" className="text-right"><strong>TOTAL FACTURA INICIAL:</strong></td>
                                    <td><strong>${formatNumberVE(detalleFactura.total_usd, 2)} USD</strong></td>
                                </tr>
                                {(() => {
                                    let mMora = 0;
                                    const vDate = diasCredito === 0 ? new Date(detalleFactura.fecha) : new Date(new Date(detalleFactura.fecha).getTime() + (diasCredito * 24 * 60 * 60 * 1000));
                                    const esCreditoD = (detalleFactura.tipo_precio === 'credito' || !detalleFactura.tipo_precio);

                                    if (new Date() > vDate && interesMoratorio > 0 && esCreditoD && detalleFactura.estado !== 'Pagada') {
                                        const dAtraso = Math.floor((new Date().getTime() - vDate.getTime()) / (24 * 60 * 60 * 1000));
                                        mMora = (detalleFactura.saldo_pendiente_usd || 0) * (interesMoratorio / 100) * (Math.floor(dAtraso / 30) + 1);
                                    }
                                    const deudaReal = (detalleFactura.saldo_pendiente_usd || 0) + mMora;

                                    return (
                                        <>
                                            {mMora > 0 && (
                                                <tr style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                                                    <td colSpan="3" className="text-right">
                                                        <strong className="text-danger">Recargo Interés Moratorio ({interesMoratorio}% mensual):</strong>
                                                        <div className="text-small text-muted">Atraso calculado por mes vencido</div>
                                                    </td>
                                                    <td className="text-danger"><strong>+${formatNumberVE(mMora, 2)} USD</strong></td>
                                                </tr>
                                            )}
                                            <tr style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                                                <td colSpan="3" className="text-right"><strong>SALDO PENDIENTE {mMora > 0 ? 'ACTUALIZADO' : ''}:</strong></td>
                                                <td className="text-danger">
                                                    <strong style={{ fontSize: '1.1em' }}>${formatNumberVE(deudaReal, 2)} USD</strong>
                                                    <div className="text-small">({formatBs(deudaReal * tasaCambio)})</div>
                                                </td>
                                            </tr>
                                        </>
                                    );
                                })()}
                            </tfoot>
                        </table>
                    </div>
                </div>

                {detalleFactura.vendedor_id && (
                    <div className="card mb-4">
                        <div className="card-header">
                            <h3 className="card-title">Comisiones de Vendedor</h3>
                            <p className="card-subtitle">Vendedor: {vendedores.find(v => v.id.toString() === detalleFactura.vendedor_id?.toString())?.nombre || 'N/A'}</p>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Configuración</th>
                                        <th>Monto Comisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(detalleFactura.comisiones_detalle || []).map((com, idx) => (
                                        <tr key={idx}>
                                            <td>{com.nombre}</td>
                                            <td className="text-small text-muted">
                                                {com.tipo === 'porcentaje' ? `${com.valor}%` : `$${com.valor.toFixed(2)} USD por Kg`}
                                            </td>
                                            <td className="text-success"><strong>${formatNumberVE(com.comision, 2)} USD</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(76, 175, 80, 0.1)' }}>
                                        <td colSpan="2" className="text-right"><strong>TOTAL COMISIONES:</strong></td>
                                        <td><strong className="text-success">${formatNumberVE(detalleFactura.comisiones_total || 0, 2)} USD</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex flex-gap mt-4">
                    <button className="btn btn-secondary" onClick={() => setVistaActiva('lista')}>
                        Volver a la Lista
                    </button>
                    <button className="btn btn-danger" onClick={() => handleEliminarFactura(detalleFactura.id)}>
                        Eliminar Factura
                    </button>
                </div>
            </div>
        )
    } else {
        vistaContenido = (
            <div>
                <div className="page-header flex-between">
                    <div>
                        <h1 className="page-title">Facturas</h1>
                        <p className="page-subtitle">Gestiona las facturas de venta</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => { setEditandoFactura(null); setFormData({ cliente_id: '', items: [] }); setVistaActiva('formulario') }}
                        disabled={clientes.length === 0 || productos.length === 0}
                    >
                        + Nueva Factura
                    </button>
                </div>

                {(clientes.length === 0 || productos.length === 0) && (
                    <div className="card mb-4" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--danger)' }}>
                        <p className="text-center" style={{ color: 'var(--danger)' }}>
                            ⚠️ Necesitas tener al menos un cliente y un producto registrado para crear facturas
                        </p>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Historial de Facturas</h3>
                        <div className="flex flex-gap items-center">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar por #, cliente, estado..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                            <p className="card-subtitle">{facturas.length} factura(s) emitida(s)</p>
                        </div>
                    </div>

                    {facturas.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <p>No hay facturas registradas</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Factura # <SortIndicator column="id" />
                                        </th>
                                        <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Cliente <SortIndicator column="cliente" />
                                        </th>
                                        <th onClick={() => handleSort('fecha')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Fecha <SortIndicator column="fecha" />
                                        </th>
                                        <th onClick={() => handleSort('total')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Total <SortIndicator column="total" />
                                        </th>
                                        <th onClick={() => handleSort('saldo')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Saldo Pendiente <SortIndicator column="saldo" />
                                        </th>
                                        <th onClick={() => handleSort('estado')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            Estado <SortIndicator column="estado" />
                                        </th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturasFiltradasYOrdenadas.map((factura) => {
                                        const cliente = clientes.find(c => c.id === factura.cliente_id)
                                        return (
                                            <tr key={factura.id}>
                                                <td>#{factura.id}</td>
                                                <td>{cliente?.nombre || 'N/A'}</td>
                                                <td>{formatDateDDMMYYYY(factura.fecha)}</td>
                                                <td>${formatNumberVE(factura.total_usd, 2)} USD</td>
                                                <td>
                                                    {(() => {
                                                        let mMora = 0;
                                                        const vDate = diasCredito === 0 ? new Date(factura.fecha) : new Date(new Date(factura.fecha).getTime() + (diasCredito * 24 * 60 * 60 * 1000));
                                                        const esCreditoL = (factura.tipo_precio === 'credito' || !factura.tipo_precio);

                                                        if (new Date() > vDate && interesMoratorio > 0 && esCreditoL && factura.estado !== 'Pagada') {
                                                            const dAtraso = Math.floor((new Date().getTime() - vDate.getTime()) / (24 * 60 * 60 * 1000));
                                                            mMora = (factura.saldo_pendiente_usd || 0) * (interesMoratorio / 100) * (Math.floor(dAtraso / 30) + 1);
                                                        }
                                                        const deudaReal = (factura.saldo_pendiente_usd || 0) + mMora;

                                                        return (
                                                            <>
                                                                <strong>${formatNumberVE(deudaReal, 2)} USD</strong>
                                                                {mMora > 0 && (
                                                                    <div className="text-danger text-small">
                                                                        (+${formatNumberVE(mMora, 2)} mora)
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    <span className={`badge ${factura.estado === 'Pagada' ? 'badge-success' :
                                                        factura.estado === 'Parcial' ? 'badge-warning' :
                                                            'badge-danger'
                                                        }`}>
                                                        {factura.estado}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex flex-gap">
                                                        {factura.estado !== 'Pagada' && (
                                                            <>
                                                                <button className="btn btn-sm btn-success" onClick={() => onPagarFactura && onPagarFactura(factura)}>
                                                                    Pagar
                                                                </button>
                                                                <button className="btn btn-sm btn-primary" onClick={() => generarMensajeCobro(factura)}>Mensaje Cobro</button>
                                                            </>
                                                        )}
                                                        <button className="btn btn-sm btn-secondary" onClick={() => {
                                                            const cliente = clientes.find(c => c.id === factura.cliente_id)
                                                            imprimirTicketFactura(factura, cliente, { tasaCambio, diasCredito, interesMoratorio })
                                                        }} title="Imprimir Ticket">🖨️</button>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => handleVerFactura(factura)}>Ver</button>
                                                        {factura.estado !== 'Pagada' && (
                                                            <button className="btn btn-sm btn-secondary" onClick={() => handleEditarFactura(factura)}>Editar</button>
                                                        )}
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleEliminarFactura(factura.id)}>Eliminar</button>
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
                            <h3 className="card-title">Mensaje WhatsApp listo para enviar</h3>
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
                                {facturaTemporal && (
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1 }} 
                                        onClick={() => {
                                            const cliente = clientes.find(c => c.id === facturaTemporal.cliente_id)
                                            imprimirTicketFactura(facturaTemporal, cliente, { tasaCambio, diasCredito, interesMoratorio })
                                        }}
                                    >
                                        🖨️ Imprimir Ticket
                                    </button>
                                )}
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
