import { useState, useEffect } from 'react'
import { validateTemplate, getVariablesForContext, getContextoEjemplo } from '../../utils/templateEngine'

export default function MensajeEditor({ mensaje, onGuardar, onCancel }) {
    const [formData, setFormData] = useState({
        nombre: '',
        tipo: '',
        contenido: ''
    })
    const [errors, setErrors] = useState({})
    const [validation, setValidation] = useState(null)
    const [mostrarVariables, setMostrarVariables] = useState(false)
    const [contextoEjemplo, setContextoEjemplo] = useState(null)

    useEffect(() => {
        if (mensaje) {
            setFormData({
                nombre: mensaje.nombre || '',
                tipo: mensaje.tipo || '',
                contenido: mensaje.contenido || ''
            })
        } else {
            setFormData({
                nombre: '',
                tipo: '',
                contenido: ''
            })
        }
        setContextoEjemplo(getContextoEjemplo())
    }, [mensaje])

    useEffect(() => {
        if (formData.contenido) {
            const validation = validateTemplate(formData.contenido)
            setValidation(validation)
        } else {
            setValidation(null)
        }
    }, [formData.contenido])

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const handleInsertVariable = (variable) => {
        const textarea = document.getElementById('contenido')
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = formData.contenido.substring(0, start) + variable + formData.contenido.substring(end)
        handleChange('contenido', newValue)

        // Restaurar el cursor después de la variable insertada
        setTimeout(() => {
            textarea.focus()
            const newCursorPos = start + variable.length
            textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido'
        }

        if (!formData.tipo.trim()) {
            newErrors.tipo = 'El tipo es requerido'
        } else if (!/^[a-z0-9_]+$/.test(formData.tipo)) {
            newErrors.tipo = 'El tipo solo puede contener letras minúsculas, números y guiones bajos'
        }

        if (!formData.contenido.trim()) {
            newErrors.contenido = 'El contenido es requerido'
        } else if (validation && !validation.isValid) {
            newErrors.contenido = 'La plantilla contiene errores: ' + validation.errors.join(', ')
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validateForm()) {
            onGuardar(formData)
        }
    }

    const variablesCliente = getVariablesForContext('cliente')
    const variablesFactura = getVariablesForContext('factura')
    const variablesProducto = getVariablesForContext('producto')
    const variablesEmpresa = getVariablesForContext('empresa')
    const variablesFecha = getVariablesForContext('fecha')

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label className="form-label">Nombre del Mensaje *</label>
                <input
                    type="text"
                    className={`form-input ${errors.nombre ? 'error' : ''}`}
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    placeholder="Ej: Recordatorio de Pago Personalizado"
                />
                {errors.nombre && <span className="text-danger text-small">{errors.nombre}</span>}
            </div>

            <div className="form-group">
                <label className="form-label">Tipo de Mensaje *</label>
                <input
                    type="text"
                    className={`form-input ${errors.tipo ? 'error' : ''}`}
                    value={formData.tipo}
                    onChange={(e) => handleChange('tipo', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="Ej: cobro_personalizado"
                />
                <p className="text-small text-muted">Solo letras minúsculas, números y guiones bajos</p>
                {errors.tipo && <span className="text-danger text-small">{errors.tipo}</span>}
            </div>

            <div className="form-group">
                <label className="form-label">Contenido del Mensaje *</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMostrarVariables(!mostrarVariables)}
                    >
                        {mostrarVariables ? 'Ocultar' : 'Mostrar'} Variables
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleChange('contenido', '')}
                    >
                        Limpiar
                    </button>
                </div>

                <textarea
                    id="contenido"
                    className={`form-input ${errors.contenido ? 'error' : ''}`}
                    rows={10}
                    value={formData.contenido}
                    onChange={(e) => handleChange('contenido', e.target.value)}
                    placeholder="Escriba su mensaje aquí. Use variables como {cliente.nombre}, {factura.saldo}, etc."
                />

                {errors.contenido && <span className="text-danger text-small">{errors.contenido}</span>}

                {validation && (
                    <div className="card mt-2" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="card-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <strong>Validación:</strong>
                                <span className={`badge ${validation.isValid ? 'badge-success' : 'badge-danger'}`}>
                                    {validation.isValid ? 'Válido' : 'Con errores'}
                                </span>
                            </div>
                            {validation.warnings.length > 0 && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <strong>Recomendaciones:</strong>
                                    <ul className="text-small" style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                                        {validation.warnings.map((warning, index) => (
                                            <li key={index} style={{ color: 'var(--warning)' }}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div>
                                <strong>Variables detectadas:</strong>
                                <div className="text-small" style={{ marginTop: '0.5rem' }}>
                                    {validation.variables.length > 0 ? (
                                        validation.variables.map((variable, index) => (
                                            <span key={index} className="badge" style={{ marginRight: '0.25rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                                {variable}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-muted">Ninguna</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {mostrarVariables && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h5 className="card-title">Variables Disponibles</h5>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-2" style={{ gap: '1rem' }}>
                            <div>
                                <h6>Cliente</h6>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {variablesCliente.map(variable => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleInsertVariable(`{${variable.key}}`)}
                                            title={variable.description}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {variable.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h6>Factura</h6>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {variablesFactura.map(variable => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleInsertVariable(`{${variable.key}}`)}
                                            title={variable.description}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {variable.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h6>Producto</h6>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {variablesProducto.map(variable => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleInsertVariable(`{${variable.key}}`)}
                                            title={variable.description}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {variable.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h6>Empresa</h6>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {variablesEmpresa.map(variable => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleInsertVariable(`{${variable.key}}`)}
                                            title={variable.description}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {variable.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h6>Fechas</h6>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {variablesFecha.map(variable => (
                                        <button
                                            key={variable.key}
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleInsertVariable(`{${variable.key}}`)}
                                            title={variable.description}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {variable.key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {contextoEjemplo && formData.contenido && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h5 className="card-title">Vista Previa con Datos de Ejemplo</h5>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label className="form-label">Mensaje Generado</label>
                            <textarea
                                className="form-input"
                                rows={8}
                                readOnly
                                value={window.renderTemplate ? window.renderTemplate(formData.contenido, contextoEjemplo) : ''}
                                style={{ background: 'var(--bg-tertiary)', whiteSpace: 'pre-wrap' }}
                            />
                        </div>
                        <div className="text-small text-muted">
                            * Esta es una vista previa con datos de ejemplo. Los valores reales se reemplazarán cuando se use el mensaje.
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-gap">
                <button type="submit" className="btn btn-primary">
                    {mensaje ? 'Actualizar Mensaje' : 'Crear Mensaje'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancelar
                </button>
            </div>
        </form>
    )
}