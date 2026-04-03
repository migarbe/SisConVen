export const imprimirTicketFactura = (factura, cliente, config) => {
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
    
    // Identificar tipo de factura soportando las antiguas implícitas
    const esCredito = factura.tipo_precio === 'credito' || !factura.tipo_precio;
    const tipoStr = esCredito ? 'CRÉDITO' : 'CONTADO';

    let mMora = 0;
    if (new Date() > fechaVencimiento && interesMoratorio > 0 && esCredito && factura.estado !== 'Pagada') {
        const dAtraso = Math.floor((new Date().getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000));
        mMora = (factura.saldo_pendiente_usd || 0) * (interesMoratorio / 100) * (Math.floor(dAtraso / 30) + 1);
    }
    const deudaReal = (factura.saldo_pendiente_usd || 0) + mMora;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Ticket Factura #${factura.id}</title>
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
            <div class="bold" style="font-size: 14px;">SISCONVEN</div>
            <div>Factura de Venta</div>
            <div>--------------------------</div>
        </div>
        
        <div class="mb-10">
            <div class="row">
                <span>Factura #:</span>
                <span class="bold">${factura.id}</span>
            </div>
            <div class="row">
                <span>Fecha Emisión:</span>
                <span>${formatDateDDMMYYYY(fechaCreacion)}</span>
            </div>
            <div class="row">
                <span>Condición:</span>
                <span class="bold">${tipoStr}</span>
            </div>
            ${esCredito ? `
            <div class="row">
                <span>Vencimiento:</span>
                <span>${formatDateDDMMYYYY(fechaVencimiento)}</span>
            </div>
            ` : ''}
        </div>

        <div class="divider"></div>

        <div class="mb-10">
            <div><strong>Cliente:</strong> ${cliente?.nombre || 'General'}</div>
            ${cliente?.cedula ? `<div><strong>CI/RIF:</strong> ${cliente.cedula}</div>` : ''}
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
                    <tr>
                        <td colspan="3" class="text-left">${item.nombre}</td>
                    </tr>
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
            <div class="row bold">
                <span>Subtotal USD:</span>
                <span>$${formatNumberVE(factura.total_usd, 2)}</span>
            </div>
            <div class="row">
                <span>Subtotal Bs:</span>
                <span>${formatBs(factura.total_usd * tasaCambio)}</span>
            </div>
        </div>

        <div class="divider"></div>

        <div class="mb-10">
            <div class="row">
                <span>Abonado USD:</span>
                <span>$${formatNumberVE(factura.total_usd - (factura.saldo_pendiente_usd || 0), 2)}</span>
            </div>
            <div class="row bold">
                <span>Saldo USD:</span>
                <span>$${formatNumberVE(factura.saldo_pendiente_usd || 0, 2)}</span>
            </div>
            
            ${mMora > 0 ? `
            <div class="row" style="margin-top: 5px;">
                <span>Mora por atraso:</span>
                <span>+$${formatNumberVE(mMora, 2)}</span>
            </div>
            <div class="row bold" style="font-size: 13px; margin-top: 5px;">
                <span>DEUDA TOTAL:</span>
                <span>$${formatNumberVE(deudaReal, 2)}</span>
            </div>
            <div class="row text-right">
                <span>${formatBs(deudaReal * tasaCambio)}</span>
            </div>
            ` : ''}
        </div>

        <div class="divider"></div>

        <div class="text-center" style="margin-top: 15px;">
                <div>Tasa de cambio: Bs. ${formatNumberVE(tasaCambio, 2)}</div>
                ${config && config.rateSource ? `<div>Fuente: ${config.rateSource}</div>` : ''}
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

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    } else {
        alert("Por favor, permite las ventanas emergentes (pop-ups) del navegador para imprimir el ticket.");
    }
};
