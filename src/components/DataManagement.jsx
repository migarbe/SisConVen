import { useState } from 'react'

export default function DataManagement({
    clientes, setClientes,
    productos, setProductos,
    facturas, setFacturas,
    pagos, setPagos,
    vendedores, setVendedores,
    tasaCambio, setTasaCambio,
    pedidos, setPedidos,
    brecha, setBrecha,
    deliveryDate, setDeliveryDate,
    compras, setCompras,
    porcentajeCredito, setPorcentajeCredito,
    diasCredito, setDiasCredito
}) {
    const [mostrarModal, setMostrarModal] = useState(false)
    const [camposABorrar, setCamposABorrar] = useState({
        clientes: false,
        productos: false,
        facturas: false,
        pagos: false,
        vendedores: false,
        tasaCambio: false,
        pedidos: false,
        configuracion: false
    })

    // Exportar datos a JSON
    const handleExportar = () => {
        const data = {
            clientes,
            productos,
            facturas,
            pagos,
            vendedores,
            compras,
            tasaCambio,
            pedidos,
            brecha,
            deliveryDate,
            configuracion: {
                porcentajeCredito,
                diasCredito
            },
            exportDate: new Date().toISOString()
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `SisConVen-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    // Importar datos desde JSON
    const handleImportar = (event) => {
        const file = event.target.files[0]
        if (!file) return

        // Validar que sea un archivo JSON
        if (!file.name.endsWith('.json')) {
            alert('❌ Error: Por favor selecciona un archivo JSON válido (.json)')
            event.target.value = ''
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result)

                // Validar que el JSON tenga al menos un campo válido
                const camposValidos = ['clientes', 'productos', 'facturas', 'pagos', 'vendedores', 'compras', 'tasaCambio', 'pedidos', 'brecha', 'deliveryDate', 'configuracion']
                const tieneCamposValidos = camposValidos.some(campo => data.hasOwnProperty(campo))

                if (!tieneCamposValidos) {
                    alert('❌ Error: El archivo JSON no contiene datos válidos.\n\nEl archivo debe tener al menos uno de estos campos:\n• clientes\n• productos\n• facturas\n• pagos\n• vendedores\n• tasaCambio')
                    event.target.value = ''
                    return
                }

                // Mostrar qué datos se van a importar
                const camposEncontrados = camposValidos.filter(campo => data[campo])
                const mensaje = `¿Estás seguro de importar estos datos?\n\nSe importarán:\n${camposEncontrados.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join('\n')}\n\n⚠️ Esto sobrescribirá los datos actuales.`

                if (confirm(mensaje)) {
                    let importados = 0

                    if (data.clientes && Array.isArray(data.clientes)) {
                        setClientes(data.clientes)
                        importados++
                    }
                    if (data.productos && Array.isArray(data.productos)) {
                        setProductos(data.productos)
                        importados++
                    }
                    if (data.facturas && Array.isArray(data.facturas)) {
                        setFacturas(data.facturas)
                        importados++
                    }
                    if (data.pagos && Array.isArray(data.pagos)) {
                        setPagos(data.pagos)
                        importados++
                    }
                    if (data.vendedores && Array.isArray(data.vendedores)) {
                        setVendedores(data.vendedores)
                        importados++
                    }
                    if (data.tasaCambio && typeof data.tasaCambio === 'number') {
                        setTasaCambio(data.tasaCambio)
                        importados++
                    }
                    if (data.pedidos && Array.isArray(data.pedidos)) {
                        setPedidos(data.pedidos)
                        importados++
                    }
                    if (data.compras && Array.isArray(data.compras)) {
                        setCompras(data.compras)
                        importados++
                    }
                    if (data.brecha !== undefined) {
                        setBrecha(parseFloat(data.brecha) || 0)
                        importados++
                    }
                    if (data.deliveryDate) {
                        setDeliveryDate(data.deliveryDate)
                        importados++
                    }
                    if (data.configuracion) {
                        if (data.configuracion.porcentajeCredito !== undefined) {
                            setPorcentajeCredito(parseFloat(data.configuracion.porcentajeCredito) || 0)
                            importados++
                        }
                        if (data.configuracion.diasCredito !== undefined) {
                            setDiasCredito(parseInt(data.configuracion.diasCredito) || 15)
                            importados++
                        }
                    }

                    alert(`✅ Datos importados exitosamente!\n\n${importados} campo(s) actualizado(s).`)
                }
            } catch (error) {
                alert('❌ Error al importar el archivo.\n\nAsegúrate de que sea un archivo JSON válido.\n\nDetalle: ' + error.message)
                console.error('Error al importar:', error)
            }
        }

        reader.onerror = () => {
            alert('❌ Error al leer el archivo. Por favor intenta nuevamente.')
        }

        reader.readAsText(file)
        event.target.value = '' // Reset input
    }

    // Resetear datos seleccionados
    const handleResetear = () => {
        const camposSeleccionados = Object.keys(camposABorrar).filter(key => camposABorrar[key])

        if (camposSeleccionados.length === 0) {
            alert('Debes seleccionar al menos un campo para borrar')
            return
        }

        const mensaje = `¿Estás seguro de eliminar los siguientes datos?\n\n${camposSeleccionados.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`).join('\n')}\n\nEsta acción no se puede deshacer.`

        if (confirm(mensaje)) {
            if (camposABorrar.clientes) {
                setClientes([])
                localStorage.removeItem('clientes')
            }
            if (camposABorrar.productos) {
                setProductos([])
                localStorage.removeItem('productos')
            }
            if (camposABorrar.facturas) {
                setFacturas([])
                localStorage.removeItem('facturas')
            }
            if (camposABorrar.pagos) {
                setPagos([])
                localStorage.removeItem('pagos')
            }
            if (camposABorrar.vendedores) {
                setVendedores([])
                localStorage.removeItem('vendedores')
            }
            if (camposABorrar.tasaCambio) {
                setTasaCambio(50)
                localStorage.removeItem('tasaCambio')
            }
            if (camposABorrar.pedidos) {
                setPedidos([])
                localStorage.removeItem('pedidos')
            }
            if (camposABorrar.compras) {
                setCompras([])
                localStorage.removeItem('compras')
            }
            if (camposABorrar.configuracion) {
                setBrecha(0)
                setDeliveryDate(new Date().toISOString().slice(0, 10))
                setPorcentajeCredito(0)
                setDiasCredito(15)
                localStorage.removeItem('brecha')
                localStorage.removeItem('deliveryDate')
                localStorage.removeItem('porcentajeCredito')
                localStorage.removeItem('diasCredito')
            }

            // Resetear selección
            setCamposABorrar({
                clientes: false,
                productos: false,
                facturas: false,
                pagos: false,
                vendedores: false,
                tasaCambio: false,
                pedidos: false,
                configuracion: false
            })
            setMostrarModal(false)
            alert('Datos eliminados exitosamente')
        }
    }

    // Resetear todo
    const handleResetearTodo = () => {
        if (confirm('⚠️ ¿Estás COMPLETAMENTE seguro de eliminar TODOS los datos?\n\nEsta acción no se puede deshacer.\n\nSe recomienda exportar un backup antes de continuar.')) {
            if (confirm('Última confirmación: ¿Eliminar TODOS los datos?')) {
                setClientes([])
                setProductos([])
                setFacturas([])
                setPagos([])
                setVendedores([])
                setPedidos([])
                setTasaCambio(50)
                setBrecha(0)
                setDeliveryDate(new Date().toISOString().slice(0, 10))
                localStorage.clear()
                setMostrarModal(false)
                alert('Todos los datos han sido eliminados')
                window.location.reload()
            }
        }
    }

    const toggleCampo = (campo) => {
        setCamposABorrar(prev => ({
            ...prev,
            [campo]: !prev[campo]
        }))
    }

    return (
        <div className="slide-up">
            <div className="page-header">
                <h1 className="page-title">Gestión de Datos</h1>
                <p className="page-subtitle">Exportar, importar y resetear datos del sistema</p>
            </div>

            {/* Estadísticas de datos */}
            <div className="grid grid-4 mb-4">
                <div className="stat-card">
                    <div className="stat-label">Clientes</div>
                    <div className="stat-value">{clientes.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Productos</div>
                    <div className="stat-value">{productos.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Facturas</div>
                    <div className="stat-value">{facturas.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pagos</div>
                    <div className="stat-value">{pagos.length}</div>
                </div>
            </div>

            <div className="grid grid-4 mb-4">
                <div className="stat-card">
                    <div className="stat-label">Vendedores</div>
                    <div className="stat-value">{vendedores.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pedidos</div>
                    <div className="stat-value">{pedidos.length}</div>
                </div>
            </div>

            {/* Exportar e Importar */}
            <div className="grid grid-2 mb-4">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📤 Exportar Datos</h3>
                        <p className="card-subtitle">Descarga un backup de todos tus datos</p>
                    </div>
                    <p className="text-muted mb-3">
                        Crea una copia de seguridad de todos los datos en formato JSON.
                        Podrás importarla más tarde si es necesario.
                    </p>
                    <button className="btn btn-primary" onClick={handleExportar}>
                        Descargar Backup (JSON)
                    </button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📥 Importar Datos</h3>
                        <p className="card-subtitle">Restaura datos desde un archivo de backup</p>
                    </div>
                    <p className="text-muted mb-3">
                        Selecciona un archivo JSON previamente exportado para restaurar los datos.
                        Esto sobrescribirá los datos actuales.
                    </p>
                    <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportar}
                        style={{ display: 'none' }}
                        id="import-file"
                    />
                    <label htmlFor="import-file" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        Seleccionar Archivo JSON
                    </label>
                </div>
            </div>

            {/* Resetear Datos */}
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
                <div className="card-header">
                    <h3 className="card-title" style={{ color: 'var(--danger)' }}>⚠️ Zona Peligrosa</h3>
                    <p className="card-subtitle">Elimina datos del sistema de forma permanente</p>
                </div>

                <div className="mb-3">
                    <p className="text-muted mb-2">
                        <strong>Importante:</strong> Se recomienda exportar un backup antes de eliminar datos.
                    </p>
                </div>

                <div className="flex flex-gap">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setMostrarModal(true)}
                    >
                        Resetear Datos Selectivamente
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={handleResetearTodo}
                    >
                        Resetear TODO
                    </button>
                </div>
            </div>

            {/* Modal de selección */}
            {mostrarModal && (
                <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Seleccionar Datos a Eliminar</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">
                                Selecciona los campos que deseas eliminar. Esta acción no se puede deshacer.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.clientes}
                                        onChange={() => toggleCampo('clientes')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Clientes</strong>
                                        <div className="text-small text-muted">
                                            {clientes.length} cliente(s) registrado(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.productos}
                                        onChange={() => toggleCampo('productos')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Productos</strong>
                                        <div className="text-small text-muted">
                                            {productos.length} producto(s) registrado(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.facturas}
                                        onChange={() => toggleCampo('facturas')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Facturas</strong>
                                        <div className="text-small text-muted">
                                            {facturas.length} factura(s) registrada(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.pagos}
                                        onChange={() => toggleCampo('pagos')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Pagos</strong>
                                        <div className="text-small text-muted">
                                            {pagos.length} pago(s) registrado(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.vendedores}
                                        onChange={() => toggleCampo('vendedores')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Vendedores</strong>
                                        <div className="text-small text-muted">
                                            {vendedores.length} vendedor(es) registrado(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.tasaCambio}
                                        onChange={() => toggleCampo('tasaCambio')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Tasa de Cambio</strong>
                                        <div className="text-small text-muted">
                                            Actual: 1 USD = {tasaCambio.toFixed(2)} Bs.
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.pedidos}
                                        onChange={() => toggleCampo('pedidos')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Pedidos</strong>
                                        <div className="text-small text-muted">
                                            {pedidos.length} pedido(s) registrado(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.compras}
                                        onChange={() => toggleCampo('compras')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Compras</strong>
                                        <div className="text-small text-muted">
                                            {compras.length} compra(s) registrada(s)
                                        </div>
                                    </div>
                                </label>

                                <label className="flex" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={camposABorrar.configuracion}
                                        onChange={() => toggleCampo('configuracion')}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <strong>Configuración del Sistema</strong>
                                        <div className="text-small text-muted">
                                            Crédito: {porcentajeCredito}% | Días: {diasCredito}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setMostrarModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-danger" onClick={handleResetear}>
                                Eliminar Seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
