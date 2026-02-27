import { useState, useEffect } from 'react'
import { getMensajes, crearMensaje, actualizarMensaje, eliminarMensaje, getEstadisticasMensajes } from '../../utils/mensajeService'
import MensajeEditor from './MensajeEditor'
import MensajePreview from './MensajePreview'
import MensajeTemplates from './MensajeTemplates'

export default function MensajeManager({ onSeleccionarMensaje }) {
    const [mensajes, setMensajes] = useState([])
    const [mensajeSeleccionado, setMensajeSeleccionado] = useState(null)
    const [modoEdicion, setModoEdicion] = useState(false)
    const [modoVista, setModoVista] = useState(false)
    const [estadisticas, setEstadisticas] = useState(null)
    const [busqueda, setBusqueda] = useState('')
    const [tipoFiltro, setTipoFiltro] = useState('todos')
    const [activoFiltro, setActivoFiltro] = useState('todos')

    useEffect(() => {
        cargarMensajes()
        cargarEstadisticas()
    }, [])

    const cargarMensajes = () => {
        const mensajes = getMensajes()
        setMensajes(mensajes)
    }

    const cargarEstadisticas = () => {
        const stats = getEstadisticasMensajes()
        setEstadisticas(stats)
    }

    const handleCrear = () => {
        setMensajeSeleccionado(null)
        setModoEdicion(true)
        setModoVista(false)
    }

    const handleEditar = (mensaje) => {
        setMensajeSeleccionado(mensaje)
        setModoEdicion(true)
        setModoVista(false)
    }

    const handleVer = (mensaje) => {
        setMensajeSeleccionado(mensaje)
        setModoVista(true)
        setModoEdicion(false)
    }

    const handleEliminar = async (mensaje) => {
        if (!window.confirm(`¿Está seguro de eliminar el mensaje "${mensaje.nombre}"?`)) {
            return
        }

        try {
            await eliminarMensaje(mensaje.id)
            cargarMensajes()
            cargarEstadisticas()
            if (mensajeSeleccionado && mensajeSeleccionado.id === mensaje.id) {
                setMensajeSeleccionado(null)
            }
        } catch (error) {
            alert('Error al eliminar el mensaje: ' + error.message)
        }
    }

    const handleGuardar = (mensajeData) => {
        try {
            if (mensajeSeleccionado) {
                actualizarMensaje(mensajeSeleccionado.id, mensajeData)
            } else {
                crearMensaje(mensajeData)
            }
            cargarMensajes()
            cargarEstadisticas()
            setModoEdicion(false)
            setMensajeSeleccionado(null)
        } catch (error) {
            alert('Error al guardar el mensaje: ' + error.message)
        }
    }

    const handleSeleccionar = (mensaje) => {
        if (onSeleccionarMensaje) {
            onSeleccionarMensaje(mensaje)
        }
    }

    const handleDuplicar = (mensaje) => {
        const nuevoMensaje = {
            ...mensaje,
            id: null,
            nombre: mensaje.nombre + ' (Copia)',
            tipo: mensaje.tipo + '_copia',
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        }
        setMensajeSeleccionado(nuevoMensaje)
        setModoEdicion(true)
        setModoVista(false)
    }

    const filtrarMensajes = () => {
        let filtrados = mensajes

        // Filtro de búsqueda
        if (busqueda.trim()) {
            const termino = busqueda.toLowerCase()
            filtrados = filtrados.filter(m =>
                m.nombre.toLowerCase().includes(termino) ||
                m.tipo.toLowerCase().includes(termino) ||
                m.contenido.toLowerCase().includes(termino)
            )
        }

        // Filtro por tipo
        if (tipoFiltro !== 'todos') {
            filtrados = filtrados.filter(m => m.tipo === tipoFiltro)
        }

        // Filtro por estado
        if (activoFiltro !== 'todos') {
            const activo = activoFiltro === 'activos'
            filtrados = filtrados.filter(m => m.activo === activo)
        }

        return filtrados.sort((a, b) => new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion))
    }

    const mensajesFiltrados = filtrarMensajes()
    const tiposUnicos = [...new Set(mensajes.map(m => m.tipo))]

    return (
        <div className="slide-up">
            <div className="page-header">
                <h1 className="page-title">Gestión de Mensajes</h1>
                <p className="page-subtitle">Cree, edite y gestione sus plantillas de mensajes</p>
            </div>

            {/* Estadísticas */}
            {estadisticas && (
                <div className="grid grid-4 mb-4">
                    <div className="stat-card">
                        <div className="stat-label">Total de Mensajes</div>
                        <div className="stat-value">{estadisticas.total}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Activos</div>
                        <div className="stat-value" style={{ color: 'var(--success)' }}>{estadisticas.activos}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Inactivos</div>
                        <div className="stat-value" style={{ color: 'var(--warning)' }}>{estadisticas.inactivos}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Con Errores</div>
                        <div className="stat-value" style={{ color: 'var(--danger)' }}>{estadisticas.conErrores}</div>
                    </div>
                </div>
            )}

            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title">Filtros y Acciones</h3>
                </div>
                <div className="card-body">
                    <div className="grid grid-4" style={{ gap: '1rem' }}>
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Buscar mensajes..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <select
                                className="form-input"
                                value={tipoFiltro}
                                onChange={(e) => setTipoFiltro(e.target.value)}
                            >
                                <option value="todos">Todos los tipos</option>
                                {tiposUnicos.map(tipo => (
                                    <option key={tipo} value={tipo}>{tipo}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <select
                                className="form-input"
                                value={activoFiltro}
                                onChange={(e) => setActivoFiltro(e.target.value)}
                            >
                                <option value="todos">Todos los estados</option>
                                <option value="activos">Activos</option>
                                <option value="inactivos">Inactivos</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleCrear}>
                                + Nuevo Mensaje
                            </button>
                            <button className="btn btn-secondary" onClick={cargarMensajes}>
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-3" style={{ gap: '1.5rem' }}>
                {/* Lista de Mensajes */}
                <div className="card" style={{ gridRow: '1 / -1' }}>
                    <div className="card-header">
                        <h4 className="card-title">Mensajes Disponibles</h4>
                        <span className="text-small text-muted">{mensajesFiltrados.length} encontrados</span>
                    </div>
                    <div className="card-body" style={{ maxHeight: '600px', overflow: 'auto' }}>
                        {mensajesFiltrados.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📝</div>
                                <h4>No hay mensajes</h4>
                                <p className="text-muted">Cree su primer mensaje para comenzar</p>
                            </div>
                        ) : (
                            mensajesFiltrados.map(mensaje => (
                                <div key={mensaje.id} className="card mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="card-body">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div>
                                                <h5 style={{ margin: 0, fontSize: '1rem' }}>{mensaje.nombre}</h5>
                                                <span className={`badge ${mensaje.activo ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: '0.25rem' }}>
                                                    {mensaje.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleVer(mensaje)}
                                                    title="Vista previa"
                                                >
                                                    👁️
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleEditar(mensaje)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleSeleccionar(mensaje)}
                                                    title="Seleccionar"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-warning"
                                                    onClick={() => handleDuplicar(mensaje)}
                                                    title="Duplicar"
                                                >
                                                    📋
                                                </button>
                                                {!['cobro', 'pedido', 'agradecimiento', 'detalles_pago'].includes(mensaje.tipo) && (
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleEliminar(mensaje)}
                                                        title="Eliminar"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-small text-muted" style={{ margin: 0, marginBottom: '0.5rem' }}>
                                            Tipo: <strong>{mensaje.tipo}</strong> • Variables: {mensaje.variables.length}
                                        </p>
                                        <p className="text-small" style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                            {mensaje.contenido.substring(0, 100)}{mensaje.contenido.length > 100 ? '...' : ''}
                                        </p>
                                        <div className="text-small text-muted" style={{ marginTop: '0.5rem' }}>
                                            Creado: {new Date(mensaje.fecha_creacion).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Editor o Vista Previa */}
                <div className="card">
                    <div className="card-header">
                        <h4 className="card-title">
                            {modoEdicion ? 'Editor de Mensaje' : modoVista ? 'Vista Previa' : 'Seleccionar Mensaje'}
                        </h4>
                    </div>
                    <div className="card-body">
                        {modoEdicion ? (
                            <MensajeEditor
                                mensaje={mensajeSeleccionado}
                                onGuardar={handleGuardar}
                                onCancel={() => {
                                    setModoEdicion(false)
                                    setMensajeSeleccionado(null)
                                }}
                            />
                        ) : modoVista && mensajeSeleccionado ? (
                            <MensajePreview mensaje={mensajeSeleccionado} />
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">👆</div>
                                <h4>Seleccione un mensaje</h4>
                                <p className="text-muted">Haga clic en "Vista previa" o "Seleccionar" para ver el contenido</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Plantillas Predefinidas */}
                <div className="card">
                    <div className="card-header">
                        <h4 className="card-title">Plantillas Predefinidas</h4>
                        <p className="card-subtitle">Mensajes básicos para empezar</p>
                    </div>
                    <div className="card-body">
                        <MensajeTemplates onSeleccionar={handleSeleccionar} />
                    </div>
                </div>
            </div>
        </div>
    )
}