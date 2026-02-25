import { useState } from 'react'
import { getMensajes, getMensajeByTipo } from '../../utils/mensajeService'

export default function MensajeTemplates({ onSeleccionar }) {
    const [plantillas, setPlantillas] = useState([
        {
            tipo: 'cobro',
            nombre: 'Recordatorio de Pago',
            descripcion: 'Mensaje para recordar pagos pendientes a clientes',
            icono: '💳',
            variables: ['{cliente.nombre}', '{factura.id}', '{factura.saldo}', '{factura.vencimiento}']
        },
        {
            tipo: 'pedido',
            nombre: 'Catálogo de Productos',
            descripcion: 'Mensaje para informar sobre productos disponibles para pedido',
            icono: '📦',
            variables: ['{cliente.nombre}', '{producto.nombre}', '{producto.precio}', '{fecha_entrega}']
        },
        {
            tipo: 'agradecimiento',
            nombre: 'Agradecimiento por Pago',
            descripcion: 'Mensaje para agradecer pagos realizados por clientes',
            icono: '🙏',
            variables: ['{cliente.nombre}', '{factura.id}', '{factura.fecha}']
        },
        {
            tipo: 'detalles_pago',
            nombre: 'Instrucciones de Pago',
            descripcion: 'Mensaje con detalles para realizar pagos',
            icono: '💰',
            variables: ['{cliente.nombre}']
        },
        {
            tipo: 'promocion',
            nombre: 'Oferta Especial',
            descripcion: 'Mensaje para promocionar productos o descuentos',
            icono: '🎉',
            variables: ['{cliente.nombre}', '{producto.nombre}', '{producto.precio}', '{producto.precio_credito}']
        },
        {
            tipo: 'recordatorio_entrega',
            nombre: 'Recordatorio de Entrega',
            descripcion: 'Mensaje para recordar fechas de entrega programadas',
            icono: '🚚',
            variables: ['{cliente.nombre}', '{fecha_entrega}', '{factura.id}']
        }
    ])

    const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null)

    const handleSeleccionarPlantilla = (plantilla) => {
        // Verificar si ya existe un mensaje con este tipo
        const mensajeExistente = getMensajeByTipo(plantilla.tipo)
        if (mensajeExistente) {
            setMensajeSeleccionado(mensajeExistente)
        } else {
            // Crear un mensaje basado en la plantilla
            const nuevoMensaje = {
                id: null,
                nombre: plantilla.nombre,
                tipo: plantilla.tipo,
                contenido: generarContenidoPorTipo(plantilla.tipo),
                variables: plantilla.variables,
                activo: true,
                fecha_creacion: new Date().toISOString(),
                fecha_actualizacion: new Date().toISOString()
            }
            setMensajeSeleccionado(nuevoMensaje)
        }
    }

    const generarContenidoPorTipo = (tipo) => {
        switch (tipo) {
            case 'cobro':
                return `Hola {cliente.nombre}, reciba un cordial saludo,\n\nLe informamos sobre su deuda pendiente detallada a continuación:\n\n*Factura:* #{factura.id} — *Fecha:* {factura.fecha} — *Vence:* {factura.vencimiento}\n*Monto pendiente:* ${factura.saldo} USD\n\n*Total adeudado:* ${factura.total} USD\n\nPor favor, realice el pago antes de la fecha de vencimiento. Muchas gracias.`
            case 'pedido':
                return `Cordial saludo estimado {cliente.nombre},\n\nYa estamos recibiendo pedidos. A continuación, les presentamos nuestra lista de productos y precios disponibles para la venta:\n\nFecha de entrega estimada: {fecha_entrega}\n\n{producto.nombre}\n• Precio Contado: ${producto.precio} USD\n• Precio Crédito: ${producto.precio_credito} USD\n\n_El crédito es por 15 días_\n\nEstamos a su disposición para cualquier consulta o pedido. ¡Que tengan un excelente día!`
            case 'agradecimiento':
                return `Hola {cliente.nombre}, reciba un cordial saludo,\n\nGracias por su preferencia y confianza en nuestros productos.\n\nReferencia: Factura #{factura.id} del {factura.fecha}. Agradecemos su pago.`
            case 'detalles_pago':
                return `Hola {cliente.nombre}, reciba un cordial saludo.\n\nAcá encontrará los detalles para realizar el pago:\n\n*Pago Movil*\n*Banco:* 0105 - Banco Mercantil C.A.\n*Teléfono:* (0422) 769-3572\n*C.I:* V-13097345\n\nPor favor confirme su pago enviando su comprobante de pago por este medio.`
            case 'promocion':
                return `¡Oferta Especial para usted, {cliente.nombre}!\n\nTenemos una promoción imperdible en {producto.nombre}:\n\n• Precio Regular: ${producto.precio} USD\n• Precio Promocional: ${producto.precio_credito} USD\n\nEsta oferta es por tiempo limitado. ¡Aproveche ahora!\n\nPara más información, contactenos al (0422) 769-3572.`
            case 'recordatorio_entrega':
                return `Estimado {cliente.nombre},\n\nLe recordamos que su entrega programada para la factura #{factura.id} será el {fecha_entrega}.\n\nPor favor, tenga listo su pago correspondiente.\n\nCualquier duda, estamos a su disposición.`
            default:
                return ''
        }
    }

    const handleUsarMensaje = () => {
        if (mensajeSeleccionado) {
            onSeleccionar(mensajeSeleccionado)
        }
    }

    return (
        <div>
            <div className="grid grid-2" style={{ gap: '1rem' }}>
                {plantillas.map(plantilla => (
                    <div
                        key={plantilla.tipo}
                        className={`card ${mensajeSeleccionado?.tipo === plantilla.tipo ? 'border-primary' : ''}`}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        onClick={() => handleSeleccionarPlantilla(plantilla)}
                    >
                        <div className="card-body">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>{plantilla.icono}</span>
                                <div>
                                    <h6 style={{ margin: 0 }}>{plantilla.nombre}</h6>
                                    <span className="badge">{plantilla.tipo}</span>
                                </div>
                            </div>
                            <p className="text-small text-muted" style={{ margin: 0 }}>
                                {plantilla.descripcion}
                            </p>
                            <div className="text-small text-muted" style={{ marginTop: '0.5rem' }}>
                                Variables: {plantilla.variables.length}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {mensajeSeleccionado && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h5 className="card-title">Vista Previa de la Plantilla</h5>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label className="form-label">Contenido</label>
                            <textarea
                                className="form-input"
                                rows={8}
                                readOnly
                                value={mensajeSeleccionado.contenido}
                                style={{ background: 'var(--bg-tertiary)', whiteSpace: 'pre-wrap' }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Variables Disponibles</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {mensajeSeleccionado.variables.map((variable, index) => (
                                    <span key={index} className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                        {variable}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleUsarMensaje}>
                                Usar Este Mensaje
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setMensajeSeleccionado(null)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}