const fs = require('fs');
const file = 'src/utils/exchangeRateService.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\/\/ New BCV JSON feed used by SisConVen team\r?\nconst BCV_JSON_URL = 'https:\/\/agroflorca\.ddns\.net\/sisconven\/tasa_bcv\.json';\r?\n/g, '');

content = content.replace(/\/\/ BCV feed information[\s\S]*?let rateSource = 'DolarAPI';\s*\/\/[^\n]*\r?\n/, `let rateSource = 'DolarAPI';
let fechaActualizacion = null;
`);

content = content.replace(/        rateSource = 'DolarAPI';\s+bcvRate = null;\s+bcvFecha = null;\s+\/\/ try to pull BCV official rate first; if successful, will set rateSource = 'SISCONVEN'\s+const bcvr = await fetchBcvOfficialRate\(\);\s+\/\/ Fetch all rates in parallel \(API endpoints may provide parallels, eur, cop, etc\.\)\s+const \[vesResponse, copResponse, eurResponse\] = await Promise\.allSettled\(\[\s+fetch\(DOLAR_API_URL\),\s+fetch\(COP_API_URL\),\s+fetch\(EUR_API_URL\),\s+fetch\(BCV_JSON_URL\)\s+\]\);\s+let results = \{\};\s+let base = 'USD';\s+\/\/ If BCV gave us a rate, use it as the main VES rate right away\s+if \(bcvr\) {\s+officialDollarRate = bcvr;\s+results\['VES'\] = bcvr;\s+}/, `        rateSource = 'DolarAPI';

        // Fetch all rates in parallel (API endpoints may provide parallels, eur, cop, etc.)
        const [vesResponse, copResponse, eurResponse] = await Promise.allSettled([
            fetch(DOLAR_API_URL),
            fetch(COP_API_URL),
            fetch(EUR_API_URL)
        ]);

        let results = {};
        let base = 'USD';`);

content = content.replace(/                            \/\/ only override officialDollarRate if BCV didn't provide one\s+if \(!bcvr\) {\s+officialDollarRate = rate;\s+\/\/ Use official as main VES rate for backward compatibility\s+if \(!results\['VES'\]\) {\s+results\['VES'\] = rate;\s+}\s+}/, `                            officialDollarRate = rate;
                            if (dollar.fechaActualizacion) {
                                fechaActualizacion = new Date(dollar.fechaActualizacion).toLocaleString('es-VE');
                            }
                            // Use official as main VES rate for backward compatibility
                            if (!results['VES']) {
                                results['VES'] = rate;
                            }`);


content = content.replace(/    try \{\s+\/\/ attempt BCV rate first \(may update state\)\s+const bcvr = await fetchBcvOfficialRate\(\);\s+const response = await fetch\(DOLAR_API_URL\);\s+if \(!response\.ok\) throw new Error\('Failed to fetch dolarapi'\);\s+const data = await response\.json\(\);\s+if \(Array\.isArray\(data\)\) {\s+let oficial = bcvr \|\| null;\s+let paralelo = null;/, `    try {
        const response = await fetch(DOLAR_API_URL);
        if (!response.ok) throw new Error('Failed to fetch dolarapi');

        const data = await response.json();

        if (Array.isArray(data)) {
            let oficial = null;
            let paralelo = null;`);

content = content.replace(/export function getOfficialDollarRate\(\) \{[\s\S]*?return officialDollarRate != null \? officialDollarRate : bcvRate;\s*\}/, `export function getOfficialDollarRate() {
    return officialDollarRate;
}`);

content = content.replace(/\/\/ ---------- BCV JSON helpers ----------[\s\S]*?export function getBcvFechaVigencia\(\) \{\s*return bcvFecha;\s*\}/, `export function getRateSource() {
    return rateSource;
}

export function getFechaVigencia() {
    return fechaActualizacion;
}`);

content = content.replace(/            rateSource,\s+bcvFecha/g, `            rateSource,
            fechaActualizacion`);

content = content.replace(/            if \(cacheData\.rateSource\) rateSource = cacheData\.rateSource;\s+if \(cacheData\.bcvFecha\) bcvFecha = cacheData\.bcvFecha;/g, `            if (cacheData.rateSource) rateSource = cacheData.rateSource;
            if (cacheData.fechaActualizacion) fechaActualizacion = cacheData.fechaActualizacion;
            else if (cacheData.bcvFecha) fechaActualizacion = cacheData.bcvFecha; // backward init`);


fs.writeFileSync(file, content);
console.log('done replacing logic in ' + file);
