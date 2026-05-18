export const imprimirNotaEntrega = (factura, cliente, config, formato = 'ticket') => {
    const { tasaCambio, diasCredito, interesMoratorio } = config;

    const formatNumberVE = (value, decimals = 2) => {
        const n = typeof value === 'number' ? value : parseFloat(value) || 0;
        return n.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const formatBs = (monto) => {
        return `Bs. ${formatNumberVE(monto, 2)}`;
    };

    const formatDateDDMMYYYY = (date) => {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const fechaCreacion = new Date(factura.fecha);
    const fechaVencimiento = new Date(fechaCreacion.getTime() + (diasCredito * 24 * 60 * 60 * 1000));
    
    const esCredito = factura.tipo_precio === 'credito' || !factura.tipo_precio;
    const tipoStr = esCredito ? 'CRÉDITO' : 'CONTADO';

    let mMora = 0;
    if (new Date() > fechaVencimiento && interesMoratorio > 0 && esCredito && factura.estado !== 'Pagada') {
        const dAtraso = Math.floor((new Date().getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000));
        mMora = (factura.saldo_pendiente_usd || 0) * (interesMoratorio / 100) * (Math.floor(dAtraso / 30) + 1);
    }
    const deudaReal = (factura.saldo_pendiente_usd || 0) + mMora;

    const ticketHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Nota de Entrega #${factura.id}</title>
        <style>
            @page { margin: 0; }
            body {
                margin: 0;
                padding: 10px 5px;
                width: 58mm;
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                color: #000;
                background: #fff;
                box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .bold { font-weight: bold; }
            .mb-5 { margin-bottom: 5px; }
            .mb-10 { margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 0; vertical-align: top; }
            th { border-bottom: 1px dashed #000; }
            .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        </style>
    </head>
    <body>
        <div class="text-center mb-10">
            <div class="bold" style="font-size: 14px;">Agropecuaria La Florida</div>
            <div class="bold" style="font-size: 12px;">J-30842548-6</div>
            <br/>
            <div>Nota de entrega</div>
            <div>--------------------------</div>
        </div>
        <div class="mb-10">
            <div class="row"><span>Nota #:</span><span class="bold">${factura.id}</span></div>
            <div class="row"><span>Fecha Emisión:</span><span>${formatDateDDMMYYYY(fechaCreacion)}</span></div>
            <div class="row"><span>Condición:</span><span class="bold">${tipoStr}</span></div>
            ${esCredito ? `
            <div class="row"><span>Vencimiento:</span><span>${formatDateDDMMYYYY(fechaVencimiento)}</span></div>
            ` : ''}
        </div>
        <div class="divider"></div>
        <div class="mb-10">
            <div><strong>Cliente:</strong> ${cliente?.nombre || 'General'}</div>
            ${cliente?.rif || cliente?.cedula ? `<div><strong>R.I.F:</strong> ${cliente?.rif || cliente.cedula}</div>` : ''}
            ${cliente?.direccion ? `<div><strong>Dirección:</strong> ${cliente.direccion}</div>` : ''}
            ${cliente?.telefono ? `<div><strong>Teléfono:</strong> ${cliente.telefono}</div>` : ''}
        </div>
        <div class="divider"></div>
        <table class="mb-10">
            <thead>
                <tr>
                    <th class="text-left" style="width: 50%;">Cant/Desc</th>
                    <th class="text-right" style="width: 25%;">P.Unit</th>
                    <th class="text-right" style="width: 25%;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${factura.items.map(item => `
                    <tr><td colspan="3" class="text-left">${item.nombre}</td></tr>
                    <tr>
                        <td class="text-left">${formatNumberVE(item.cantidad, 3)} Kg</td>
                        <td class="text-right">$${formatNumberVE(item.precio_usd, 2)}</td>
                        <td class="text-right">$${formatNumberVE(item.subtotal, 2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="divider"></div>
        <div class="mb-5">
            <div class="row bold"><span>Subtotal USD:</span><span>$${formatNumberVE(factura.total_usd, 2)}</span></div>
            <div class="row"><span>Subtotal Bs:</span><span>${formatBs(factura.total_usd * tasaCambio)}</span></div>
        </div>
        <div class="divider"></div>
        <div class="mb-10">
            <div class="row"><span>Abonado USD:</span><span>$${formatNumberVE(factura.total_usd - (factura.saldo_pendiente_usd || 0), 2)}</span></div>
            <div class="row bold"><span>Saldo USD:</span><span>$${formatNumberVE(factura.saldo_pendiente_usd || 0, 2)}</span></div>
            ${mMora > 0 ? `
            <div class="row" style="margin-top: 5px;"><span>Mora por atraso:</span><span>+$${formatNumberVE(mMora, 2)}</span></div>
            <div class="row bold" style="font-size: 13px; margin-top: 5px;"><span>DEUDA TOTAL:</span><span>$${formatNumberVE(deudaReal, 2)}</span></div>
            <div class="row text-right"><span>${formatBs(deudaReal * tasaCambio)}</span></div>
            ` : ''}
        </div>
        <div class="divider"></div>
        <div class="text-center" style="margin-top: 15px;">
            <div>Tasa de cambio: Bs. ${formatNumberVE(tasaCambio, 2)}</div>
            ${config && config.rateSource ? `<div>Fuente: https://www.bcv.org.ve</div>` : ''}
            <div style="margin-top: 10px;">¡Gracias por su compra!</div>
            <div>--------------------------</div>
        </div>
        <script>
            window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
            };
        </script>
    </body>
    </html>
    `;

    const a4Html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Nota de Entrega #${factura.id}</title>
        <style>
            @page { size: A4 portrait; margin: 20mm; }
            body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                color: #000;
                background: #fff;
                box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .bold { font-weight: bold; }
            .mb-5 { margin-bottom: 8px; }
            .mb-10 { margin-bottom: 14px; }
            .divider { border-top: 1px solid #000; margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px 6px; vertical-align: top; }
            th { border-bottom: 1px solid #000; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .section { margin-bottom: 18px; }
            .header-title { font-size: 20px; }
            .header-subtitle { font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="text-center section">
            <div class="bold header-title">Agropecuaria La Florida</div>
            <div class="header-subtitle">J-30842548-6</div>
            <div class="bold" style="margin-top: 12px; font-size: 18px;">Nota de Entrega</div>
        </div>
        <div class="section">
            <div class="row"><span>Nota #:</span><span class="bold">${factura.id}</span></div>
            <div class="row"><span>Fecha Emisión:</span><span>${formatDateDDMMYYYY(fechaCreacion)}</span></div>
            <div class="row"><span>Condición:</span><span class="bold">${tipoStr}</span></div>
            ${esCredito ? `<div class="row"><span>Vencimiento:</span><span>${formatDateDDMMYYYY(fechaVencimiento)}</span></div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="section">
            <div class="bold">Datos del Cliente</div>
            <div class="row"><span>Cliente:</span><span>${cliente?.nombre || 'General'}</span></div>
            ${cliente?.rif || cliente?.cedula ? `<div class="row"><span>R.I.F:</span><span>${cliente?.rif || cliente.cedula}</span></div>` : ''}
            ${cliente?.direccion ? `<div class="row"><span>Dirección:</span><span>${cliente.direccion}</span></div>` : ''}
            ${cliente?.telefono ? `<div class="row"><span>Teléfono:</span><span>${cliente.telefono}</span></div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th class="text-left">Cantidad</th>
                        <th class="text-left">Descripción</th>
                        <th class="text-right">Precio U.</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${factura.items.map(item => `
                        <tr>
                            <td>${formatNumberVE(item.cantidad, 3)}</td>
                            <td>${item.nombre}</td>
                            <td class="text-right">$${formatNumberVE(item.precio_usd, 2)}</td>
                            <td class="text-right">$${formatNumberVE(item.subtotal, 2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="divider"></div>
        <div class="section">
            <div class="row bold"><span>Subtotal USD:</span><span>$${formatNumberVE(factura.total_usd, 2)}</span></div>
            <div class="row"><span>Subtotal Bs:</span><span>${formatBs(factura.total_usd * tasaCambio)}</span></div>
        </div>
        <div class="divider"></div>
        <div class="section">
            <div class="row"><span>Abonado USD:</span><span>$${formatNumberVE(factura.total_usd - (factura.saldo_pendiente_usd || 0), 2)}</span></div>
            <div class="row bold"><span>Saldo USD:</span><span>$${formatNumberVE(factura.saldo_pendiente_usd || 0, 2)}</span></div>
            ${mMora > 0 ? `
                <div class="row"><span>Mora por atraso:</span><span>+$${formatNumberVE(mMora, 2)}</span></div>
                <div class="row bold"><span>DEUDA TOTAL:</span><span>$${formatNumberVE(deudaReal, 2)}</span></div>
                <div class="row"><span></span><span>${formatBs(deudaReal * tasaCambio)}</span></div>
            ` : ''}
        </div>
        <div class="divider"></div>
        <div class="text-center section">
            <div>Tasa de cambio: Bs. ${formatNumberVE(tasaCambio, 2)}</div>
            ${config && config.rateSource ? `<div>Fuente: https://www.bcv.org.ve</div>` : ''}
            <div style="margin-top: 10px;">¡Gracias por su compra!</div>
        </div>
        <script>
            window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
            };
        </script>
    </body>
    </html>
    `;

    const html = formato === 'a4' ? a4Html : ticketHtml;
    const printWindow = window.open('', '_blank', formato === 'a4' ? 'width=1000,height=800' : 'width=400,height=600');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    } else {
        alert("Por favor, permite las ventanas emergentes (pop-ups) del navegador para imprimir el ticket.");
    }
};

export const imprimirTicketFactura = (factura, cliente, config) => imprimirNotaEntrega(factura, cliente, config, 'ticket');
