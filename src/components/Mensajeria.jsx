import { useState } from 'react'
import { normalizePhoneVE, formatBs, formatPhoneForDisplay } from '../utils/formatters'
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, Select, MenuItem, FormControl, Grid, Alert, Tooltip, Autocomplete } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, Save as SaveIcon, Cancel as CancelIcon, Print as PrintIcon, AttachMoney as AttachMoneyIcon } from '@mui/icons-material'

export default function Mensajeria({ clientes, facturas, tasaCambio, productos = [], deliveryDate, setDeliveryDate }) {
    const [tipoMensaje, setTipoMensaje] = useState('')
    const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState('')
    const [mensajeGenerado, setMensajeGenerado] = useState('')
    const [whatsappTo, setWhatsappTo] = useState('')
    const [whatsappValid, setWhatsappValid] = useState(true)
    const [whatsappNote, setWhatsappNote] = useState('')
    const [copied, setCopied] = useState(false)

    const formatNumberVE = (value, decimals = 2) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0
        return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    }

    const formatKg = (value) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0
        if (Number.isInteger(n)) {
            return n.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        }
        let s = n.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
        s = s.replace(/0+$/, '').replace(/,$/, '')
        return s
    }

    const formatDateDDMMYYYY = (date) => {
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    const generarMensaje = () => {
        const clienteId = parseInt(clienteSeleccionadoId)
        const cliente = clientes.find(c => c.id === clienteId)

        if (!cliente && tipoMensaje !== 'pedido') {
            alert('Por favor seleccione un cliente')
            return
        }

        const pendientes = cliente ? facturas.filter(f => f.cliente_id === clienteId && f.saldo_pendiente_usd > 0) : []

        let texto = ''

        if (tipoMensaje === 'cobro') {
            texto += `Hola ${cliente.nombre}, reciba un cordial saludo,` + '\n\n'
            texto += `Le informamos sobre su deuda pendiente detallada a continuación:` + '\n\n'

            let totalUSD = 0
            pendientes.forEach(f => {
                const fechaEmi = formatDateDDMMYYYY(f.fecha)
                const fechaVenc = formatDateDDMMYYYY(new Date(new Date(f.fecha).getTime() + 7 * 24 * 60 * 60 * 1000))
                texto += `*Factura:* #${f.id} — *Fecha:* ${fechaEmi} — *Vence:* ${fechaVenc}\n`
                texto += `*Monto pendiente:* $${formatNumberVE(f.saldo_pendiente_usd, 2)} USD (${formatBs(f.saldo_pendiente_usd * (tasaCambio || 0))})\n\n`
                totalUSD += f.saldo_pendiente_usd
            })

            texto += `*Total adeudado:* $${formatNumberVE(totalUSD, 2)} USD (${formatBs(totalUSD * (tasaCambio || 0))})\n\n`
            texto += 'Por favor, realice el pago antes de la fecha de vencimiento. Muchas gracias.'
        } else if (tipoMensaje === 'pedido') {
            const saludo = cliente ? `Cordial saludo estimado ${cliente.nombre},` : `Reciban un cordial y afectuoso saludo, estimados clientes.`

            texto += `${saludo}\n\n`
            texto += `Ya estamos recibiendo pedidos. A continuación, les presentamos nuestra lista de productos y precios disponibles para la venta:\n\n`

            if (deliveryDate) {
                texto += `Fecha de entrega estimada: ${formatDateDDMMYYYY(deliveryDate)}\n\n`
            }

            if (productos && productos.length > 0) {
                const disponibles = [...productos]
                    .filter(p => (p.cantidad_kg || 0) > 0)
                    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))

                if (disponibles.length === 0) {
                    texto += 'No hay productos con existencia disponible en este momento.'
                } else {
                    disponibles.forEach((p, idx) => {
                        texto += `${idx + 1}. *${p.nombre}*\n`
                        texto += `   • Precio Contado: $${formatNumberVE(p.precio_usd || 0, 2)} USD\n`
                        texto += `   • Precio Crédito: $${formatNumberVE(p.precio_credito || p.precio_usd * 1.1, 2)} USD\n\n`
                    })
                }
            } else {
                texto += 'No hay productos disponibles para listar.'
            }

            texto += '_El crédito es por 15 días_\n\n'
            texto += 'Estamos a su disposición para cualquier consulta o pedido. ¡Que tengan un excelente día!'
        } else if (tipoMensaje === 'agradecimiento') {
            texto += `Hola ${cliente.nombre}, reciba un cordial saludo,` + '\n\n'
            texto += 'Gracias por su preferencia y confianza en nuestros productos.' + '\n\n'
            const pagadas = facturas.filter(f => f.cliente_id === clienteId && f.saldo_pendiente_usd === 0)
            if (pagadas.length > 0) {
                const ultima = pagadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
                texto += `Referencia: Factura #${ultima.id} del ${formatDateDDMMYYYY(ultima.fecha)}. Agradecemos su pago.`
            }
        } else if (tipoMensaje === 'detalles_pago') {
            texto += `Hola ${cliente.nombre}, reciba un cordial saludo.` + '\n\n'
            texto += `Acá encontrará los detalles para realizar el pago:` + '\n\n'
            texto += '*Pago Movil*\n'
            texto += '*Banco:* 0105 - Banco Mercantil C.A.\n'
            texto += '*Teléfono:* (0422) 769-3572\n'
            texto += '*C.I:* V-13097345\n\n'
            texto += 'Por favor confirme su pago enviando su comprobante de pago por este medio.'
        }

        if (cliente) {
            const { normalized, valid, note } = normalizePhoneVE(cliente.telefono || '')
            setWhatsappTo(normalized)
            setWhatsappValid(valid)
            setWhatsappNote(note)
        } else {
            setWhatsappTo('')
            setWhatsappValid(true)
            setWhatsappNote('')
        }

        setMensajeGenerado(texto)
        setCopied(false)
    }

    const copiarWhatsApp = async () => {
        if (!mensajeGenerado) return
        try {
            await navigator.clipboard.writeText(mensajeGenerado)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            alert('No se pudo copiar al portapapeles. Copia manualmente el texto.')
        }
    }

    return (
        <div className="slide-up">
            <div className="page-header">
                <h1 className="page-title">Mensajería a Clientes</h1>
                <p className="page-subtitle">Genera mensajes personalizados para enviar por WhatsApp</p>
            </div>

            <div className="card mb-4 fade-in">
                <div className="card-header">
                    <h3 className="card-title">Generar Mensaje</h3>
                </div>
                <div className="card-body">
                    <div className="form-group">
                        <label className="form-label">Tipo de Mensaje *</label>
                        <select
                            className="form-select"
                            value={tipoMensaje}
                            onChange={(e) => {
                                setTipoMensaje(e.target.value)
                                setMensajeGenerado('')
                            }}
                            required
                        >
                            <option value="">Seleccionar tipo...</option>
                            <option value="cobro">Mensaje de Cobro</option>
                            <option value="pedido">Mensaje de Pedido (General)</option>
                            <option value="agradecimiento">Mensaje de Agradecimiento</option>
                            <option value="detalles_pago">Detalles de Pago</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Cliente {tipoMensaje === 'pedido' ? '(Opcional)' : '*'}</label>
                        <select
                            className="form-select"
                            value={clienteSeleccionadoId}
                            onChange={(e) => setClienteSeleccionadoId(e.target.value)}
                            required={tipoMensaje !== 'pedido'}
                        >
                            <option value="">{tipoMensaje === 'pedido' ? 'Todos los clientes (Mensaje Genérico)' : 'Seleccionar cliente...'}</option>
                            {[...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(cliente => (
                                <option key={cliente.id} value={cliente.id}>
                                    {cliente.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Fecha de entrega (opcional)</label>
                        <input
                            type="date"
                            className="form-input"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                        />
                    </div>

                    <button
                        className="btn btn-primary mt-3"
                        onClick={generarMensaje}
                        disabled={!tipoMensaje || (tipoMensaje !== 'pedido' && !clienteSeleccionadoId)}
                    >
                        Generar Mensaje
                    </button>
                </div>
            </div>

            {mensajeGenerado && (
                <div className="card mb-4 fade-in">
                    <div className="card-header">
                        <h4 className="card-title">Mensaje WhatsApp listo para copiar</h4>
                    </div>
                    <div className="card-body">
                        <textarea
                            className="form-input"
                            rows={15}
                            readOnly
                            value={mensajeGenerado}
                            style={{ whiteSpace: 'pre-wrap' }}
                        />
                        {whatsappTo ? (
                            whatsappValid ? (
                                <p className="muted">Destino: +{whatsappTo} {whatsappNote && `— ${whatsappNote}`}</p>
                            ) : (
                                <p className="text-danger">Destino inválido: +{whatsappTo} {whatsappNote && `— ${whatsappNote}`}</p>
                            )
                        ) : (
                            <p className="muted">Destino no especificado (se abrirá WhatsApp sin destinatario o listo para difundir)</p>
                        )}

                        <div className="flex flex-gap mt-2">
                            <button className="btn btn-secondary" onClick={copiarWhatsApp}>
                                {copied ? 'Copiado ✅' : 'Copiar'}
                            </button>
                            <a
                                className="btn btn-primary"
                                href={whatsappTo ? `https://wa.me/${whatsappTo}?text=${encodeURIComponent(mensajeGenerado)}` : `https://wa.me/?text=${encodeURIComponent(mensajeGenerado)}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Abrir en WhatsApp
                            </a>
                            <button type="button" className="btn" onClick={() => setMensajeGenerado('')}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
