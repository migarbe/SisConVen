import { useState } from 'react'
import { renderTemplate, getExampleContext } from '../../utils/templateEngine'

export default function MensajePreview({ mensaje }) {
    const [contextoPersonalizado, setContextoPersonalizado] = useState(null)
    const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false)

    const contextoEjemplo = getExampleContext()
    const mensajeGenerado = renderTemplate(mensaje.contenido, contextoPersonalizado || contextoEjemplo)

    const handleContextChange = (tipo, campo, valor) => {
        setContextoPersonalizado(prev => ({
            ...prev,
            [tipo]: {
                ...prev[tipo],
                [campo]: valor
            }
        }))
    }

    const resetContexto = () => {
        setContextoPersonalizado(null)
        setMostrarPersonalizado(false)
    }

    const usarContextoPersonalizado = () => {
        setContextoPersonalizado({
            cliente: { nombre: '', telefono: '', direccion: '', email: '' },
            factura: { id: '', fecha: '', saldo_pendiente_usd: 0, total_usd: 0, detalles: [] },
            producto: { nombre: '', precio_usd: 0, cantidad_kg: 0, precio_credito: 0 },
            fecha_entrega: '',
            empresa: { dias_credito: 7 }
        })
        setMostrarPersonalizado(true)
    }

    return (
        <div>
            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title">Información del Mensaje</h5>
                </div>
                <div className="card-body">
                    <div className="grid grid-2" style={{ gap: '1rem' }}>
                        <div>
                            <strong>Nombre:</strong> <span>{mensaje.nombre}</span>
                        </div>
                        <div>
                            <strong>Tipo:</strong> <span className="badge">{mensaje.tipo}</span>
                        </div>
                        <div>
                            <strong>Estado:</strong>{' '}
                            <span className={`badge ${mensaje.activo ? 'badge-success' : 'badge-warning'}`}>
                                {mensaje.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        <div>
                            <strong>Variables:</strong>{' '}
                            <span className="badge">{mensaje.variables.length}</span>
                        </div>
                    </div>
                    <div className="text-small text-muted" style={{ marginTop: '1rem' }}>
                        Creado: {new Date(mensaje.fecha_creacion).toLocaleString()} •
                        Actualizado: {new Date(mensaje.fecha_actualizacion).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title">Contenido Original</h5>
                </div>
                <div className="card-body">
                    <textarea
                        className="form-input"
                        rows={8}
                        readOnly
                        value={mensaje.contenido}
                        style={{ background: 'var(--bg-tertiary)', whiteSpace: 'pre-wrap' }}
                    />
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-header">
                    <h5 className="card-title">Vista Previa del Mensaje</h5>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={usarContextoPersonalizado}
                        >
                            Contexto Personalizado
                        </button>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={resetContexto}
                        >
                            Contexto de Ejemplo
                        </button>
                    </div>
                </div>
                <div className="card-body">
                    {mostrarPersonalizado && contextoPersonalizado && (
                        <div className="card mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="card-body">
                                <h6>Contexto Personalizado</h6>
                                <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <h7>Cliente</h7>
                                        <div className="form-group">
                                            <label className="form-label">Nombre</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={contextoPersonalizado.cliente?.nombre || ''}
                                                onChange={(e) => handleContextChange('cliente', 'nombre', e.target.value)}
                                                placeholder="Nombre del cliente"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Teléfono</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={contextoPersonalizado.cliente?.telefono || ''}
                                                onChange={(e) => handleContextChange('cliente', 'telefono', e.target.value)}
                                                placeholder="Teléfono del cliente"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <h7>Factura</h7>
                                        <div className="form-group">
                                            <label className="form-label">ID</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={contextoPersonalizado.factura?.id || ''}
                                                onChange={(e) => handleContextChange('factura', 'id', e.target.value)}
                                                placeholder="Número de factura"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Saldo (USD)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={contextoPersonalizado.factura?.saldo_pendiente_usd || ''}
                                                onChange={(e) => handleContextChange('factura', 'saldo_pendiente_usd', parseFloat(e.target.value) || 0)}
                                                placeholder="Saldo pendiente"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Días de Crédito (empresa)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={contextoPersonalizado.empresa?.dias_credito || ''}
                                        onChange={(e) => handleContextChange('empresa', 'dias_credito', parseInt(e.target.value) || 0)}
                                        min="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de Entrega</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={contextoPersonalizado.fecha_entrega || ''}
                                        onChange={(e) => setContextoPersonalizado(prev => ({ ...prev, fecha_entrega: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-body">
                            <textarea
                                className="form-input"
                                rows={10}
                                readOnly
                                value={mensajeGenerado}
                                style={{ background: 'var(--bg-card)', whiteSpace: 'pre-wrap', border: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="text-small text-muted" style={{ marginTop: '0.5rem' }}>
                        {mostrarPersonalizado ? 'Vista previa con contexto personalizado' : 'Vista previa con datos de ejemplo'}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5 className="card-title">Variables Disponibles</h5>
                </div>
                <div className="card-body">
                    {mensaje.variables.length > 0 ? (
                        <div className="grid grid-3" style={{ gap: '0.5rem' }}>
                            {mensaje.variables.map((variable, index) => (
                                <span key={index} className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                    {variable}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted">No hay variables en este mensaje</p>
                    )}
                </div>
            </div>
        </div>
    )
}