// Exchange Rate Service for SisConVen
// Manages currency exchange rates from DolarAPI (Venezuela)

const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares';
const COP_API_URL = 'https://co.dolarapi.com/v1/cotizaciones/usd';
const EUR_API_URL = 'https://ve.dolarapi.com/v1/euros';
const STATUS_API_URL = 'https://ve.dolarapi.com/v1/estado';
const CACHE_KEY = 'exchangeRatesCache';
const HISTORY_KEY = 'exchangeRatesHistory';
const MAX_HISTORY_DAYS = 90; // Keep up to 90 days of history
const CURRENCIES = ['USD', 'EUR', 'COP', 'VES'];

const PREFERRED_RATE_KEY = 'sisconven_rate_source';

// State
let cachedRates = null;
let lastUpdate = null;
let parallelDollarRate = null; // Dólar paralelo (e.g., Monitor Dolar, etc.)
let officialDollarRate = null; // Dólar oficial
let parallelEurRate = null; // Euro paralelo
let officialEurRate = null; // Euro oficial
let copRate = null; // Peso Colombiano
let apiStatus = null; // Estado de la API

let rateSource = 'DolarAPI'; // Current source
let fechaActualizacion = null;
let preferredRateSource = { type: 'api', useProxy: false } // { type: 'api'|'bcv', url?: string, useProxy?: boolean }

// Cache for BCV URL fetches
let lastBcvFetch = { timestamp: 0, rate: null };

/**
 * Fetch exchange rates from DolarAPI
 * @returns {Promise<Object>} Exchange rates object
 */
export async function fetchExchangeRates() {
    try {
        rateSource = 'DolarAPI';

        // Fetch all rates in parallel
        const [vesResponse, copResponse, eurResponse] = await Promise.allSettled([
            fetch(DOLAR_API_URL),
            fetch(COP_API_URL),
            fetch(EUR_API_URL)
        ]);

        let results = {};
        let base = 'USD';

        // Process VES rates from Venezuelan API
        if (vesResponse.status === 'fulfilled' && vesResponse.value.ok) {
            const data = await vesResponse.value.json();

            if (Array.isArray(data)) {
                data.forEach((dollar) => {
                    const nombre = dollar.nombre?.toLowerCase() || '';
                    const fuente = dollar.fuente?.toLowerCase() || '';
                    const rate = dollar.promedio || dollar.venta || dollar.price;

                    if (rate) {
                        // Store specific dollar types
                        if (fuente === 'oficial' || nombre.includes('oficial') || nombre.includes('bcv')) {
                            officialDollarRate = rate;
                            if (dollar.fechaActualizacion) {
                                fechaActualizacion = new Date(dollar.fechaActualizacion).toLocaleString('es-VE');
                            }
                            if (!results['VES']) {
                                results['VES'] = rate;
                            }
                        } else if (fuente === 'paralelo' || nombre.includes('paralelo') || nombre.includes('monitor') || nombre.includes('bitcoin') || nombre.includes('sicad')) {
                            // Use the first parallel dollar found
                            if (!parallelDollarRate) {
                                parallelDollarRate = rate;
                            }
                        }
                    }
                });

                // If no official found but we have data and BCV didn't supply it, use the first one
                if (!officialDollarRate && data.length > 0) {
                    const firstDollar = data[0];
                    officialDollarRate = firstDollar.promedio || firstDollar.venta || firstDollar.price;
                    if (!results['VES']) {
                        results['VES'] = officialDollarRate;
                    }
                }

                // If no parallel found, use the last one (usually higher)
                if (!parallelDollarRate && data.length > 1) {
                    const lastDollar = data[data.length - 1];
                    parallelDollarRate = lastDollar.promedio || lastDollar.venta || lastDollar.price;
                }
            }
        }

        // Process EUR rates from Venezuelan API
        if (eurResponse.status === 'fulfilled' && eurResponse.value.ok) {
            const eurData = await eurResponse.value.json();

            if (Array.isArray(eurData)) {
                eurData.forEach((euro) => {
                    const nombre = euro.nombre?.toLowerCase() || '';
                    const fuente = euro.fuente?.toLowerCase() || '';
                    const rate = euro.promedio || euro.venta || euro.price;

                    if (rate) {
                        // Store specific euro types
                        if (fuente === 'oficial' || nombre.includes('oficial') || nombre.includes('bcv')) {
                            officialEurRate = rate;
                            // Convert EUR to USD rate: (VES/EUR) / (VES/USD) = USD/EUR
                            // But we need EUR/USD, so: 1 / ((VES/EUR) / (VES/USD)) = (VES/USD) / (VES/EUR)
                            if (results['VES']) {
                                results['EUR'] = results['VES'] / rate;
                            }
                        } else {
                            parallelEurRate = rate;
                        }
                    }
                });
            }
        }

        // Process COP rates from Colombian API
        if (copResponse.status === 'fulfilled' && copResponse.value.ok) {
            const copData = await copResponse.value.json();

            if (copData && copData.venta) {
                // COP API returns USD/COP rate directly
                copRate = copData.venta;
                results['COP'] = copRate;
            }
        }

        if (Object.keys(results).length > 0) {
            cachedRates = { ...results };
            if (!cachedRates[base]) {
                cachedRates[base] = 1;
            }
            lastUpdate = new Date();
            saveRatesToCache();

            // Save to history for charts
            saveToHistory({
                fecha: new Date().toISOString(),
                USD: 1,
                EUR: officialEurRate || 0.92, // Use EUR rate from API or default
                COP: copRate || 4000, // Use COP rate from API or default
                VES_oficial: officialDollarRate || results.VES || 50,
                VES_paralelo: parallelDollarRate || officialDollarRate || results.VES || 50
            });

            return cachedRates;
        } else {
            throw new Error('DolarAPI returned empty data');
        }
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        loadRatesFromCache();
        throw error;
    }
}

/**
 * Load preferred rate source from localStorage
 */
function loadPreferredRateSource() {
    try {
        const saved = localStorage.getItem(PREFERRED_RATE_KEY)
        if (saved) {
            const parsed = JSON.parse(saved)
            preferredRateSource = { ...preferredRateSource, ...parsed }
        }
    } catch (err) {
        console.warn('Error loading preferred rate source:', err)
    }
}

/**
 * Save preferred rate source to localStorage
 */
function savePreferredRateSource() {
    try {
        localStorage.setItem(PREFERRED_RATE_KEY, JSON.stringify(preferredRateSource))
    } catch (err) {
        console.error('Error saving preferred rate source:', err)
    }
}

/**
 * Set user preferred rate source
 * @param {{type: 'api'|'bcv', url?: string}} src
 */
export function setPreferredRateSource(src) {
    if (!src || !src.type) return
    preferredRateSource = { type: src.type, url: src.url, useProxy: !!src.useProxy }
    savePreferredRateSource()
}

/**
 * Get user preferred rate source
 */
export function getPreferredRateSource() {
    return preferredRateSource
}

/**
 * Fetch and parse a rate number from a BCV-style JSON URL.
 * Accepts several schemas: number, object with venta/promedio/rate/tasa, or array of such objects.
 */
export async function fetchRatesFromBcvUrl(url, forceProxy = false) {
    if (!url) throw new Error('No URL provided')

    // Use cached result if recent (<5 minutes)
    const now = Date.now()
    if (lastBcvFetch.timestamp && (now - lastBcvFetch.timestamp) < (5 * 60 * 1000) && lastBcvFetch.rate) {
        return lastBcvFetch.rate
    }

    let data = null
    const preferProxy = forceProxy || preferredRateSource?.useProxy
    // If preferProxy is true, try proxy first (useful to bypass CORS)
    if (preferProxy) {
        try {
            const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
            const resp = await fetch(proxy)
            if (!resp.ok) throw new Error(`Proxy request failed: ${resp.status}`)
            data = await resp.json()
        } catch (proxyErr) {
            // Try direct as fallback
            try {
                const resp = await fetch(url)
                if (!resp.ok) throw new Error(`BCV URL request failed: ${resp.status}`)
                data = await resp.json()
            } catch (directErr) {
                throw new Error(proxyErr.message || directErr.message)
            }
        }
    } else {
        // Try direct fetch first
        try {
            const resp = await fetch(url)
            if (!resp.ok) throw new Error(`BCV URL request failed: ${resp.status}`)
            data = await resp.json()
        } catch (directErr) {
            // If direct fetch fails (often due to CORS), try a public CORS proxy as fallback
            try {
                const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
                const resp = await fetch(proxy)
                if (!resp.ok) throw new Error(`Proxy request failed: ${resp.status}`)
                data = await resp.json()
            } catch (proxyErr) {
                // Throw original direct error for clearer message
                throw new Error(directErr.message || proxyErr.message)
            }
        }
    }

    // Helper to parse object for known fields
    const parseObject = (obj) => {
        if (obj == null) return null
        if (typeof obj === 'number') return obj
        if (typeof obj === 'string' && !isNaN(parseFloat(obj))) return parseFloat(obj)
        const keys = ['venta', 'promedio', 'prom', 'rate', 'tasa', 'precio', 'price']
        for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) {
                const v = obj[k]
                if (typeof v === 'number') return v
                if (typeof v === 'string' && !isNaN(parseFloat(v))) return parseFloat(v)
            }
        }
        return null
    }

    let rate = null

    if (Array.isArray(data)) {
        for (const el of data) {
            rate = parseObject(el)
            if (rate) break
            // maybe nested
            if (el && typeof el === 'object') {
                for (const k of Object.keys(el)) {
                    rate = parseObject(el[k])
                    if (rate) break
                }
            }
            if (rate) break
        }
    } else if (typeof data === 'object') {
        rate = parseObject(data)
        if (!rate) {
            // Try searching nested properties
            for (const k of Object.keys(data)) {
                rate = parseObject(data[k])
                if (rate) break
            }
        }
    } else if (typeof data === 'number') {
        rate = data
    } else if (typeof data === 'string' && !isNaN(parseFloat(data))) {
        rate = parseFloat(data)
    }

    if (!rate) throw new Error('Could not parse rate from BCV URL response')

    // Round to 2 decimals when coming from BCV JSON
    const rounded = Number(parseFloat(rate).toFixed(2))
    lastBcvFetch = { timestamp: now, rate: rounded }
    return rounded
}

/**
 * Return the USD -> VES rate according to user preference.
 * Falls back to DolarAPI if BCV URL fails.
 */
export async function getSelectedUsdToVesRate() {
    loadPreferredRateSource()
    if (preferredRateSource.type === 'bcv' && preferredRateSource.url) {
        try {
            const r = await fetchRatesFromBcvUrl(preferredRateSource.url)
            // store some metadata
            rateSource = 'BCV_JSON'
            fechaActualizacion = new Date().toLocaleString('es-VE')
            return r
        } catch (err) {
            console.warn('Failed to fetch BCV URL, falling back to API:', err)
            // fallthrough to API
        }
    }

    // Default: use existing DolarAPI logic
    const rates = await getExchangeRates()
    if (rates && rates.VES) return Number(parseFloat(rates.VES).toFixed(2))
    return 50
}

/**
 * Save current rates to history
 * @param {Object} rates - Rates to save
 */
function saveToHistory(rates) {
    try {
        const history = getHistoryFromStorage();
        const today = new Date().toISOString().split('T')[0];

        // Check if we already have an entry for today
        const existingIndex = history.findIndex(h => h.fecha.split('T')[0] === today);

        if (existingIndex >= 0) {
            // Update today's entry
            history[existingIndex] = rates;
        } else {
            // Add new entry
            history.push(rates);
        }

        // Sort by date
        history.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // Keep only last MAX_HISTORY_DAYS
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - MAX_HISTORY_DAYS);
        const filteredHistory = history.filter(h => new Date(h.fecha) >= cutoffDate);

        localStorage.setItem(HISTORY_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
        console.error('Error saving to history:', error);
    }
}

/**
 * Get history from localStorage
 * @returns {Array} History array
 */
function getHistoryFromStorage() {
    try {
        const saved = localStorage.getItem(HISTORY_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
}

/**
 * Get exchange rate history for charts
 * @param {number} days - Number of days to retrieve (default 30)
 * @returns {Promise<Array>} History array
 */
export async function getExchangeRateHistory(days = 30) {
    // First fetch latest to ensure we have current data
    try {
        await fetchExchangeRates();
    } catch (error) {
        console.warn('Could not fetch latest rates for history:', error);
    }

    const history = getHistoryFromStorage();

    // Filter to requested days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return history.filter(h => new Date(h.fecha) >= cutoffDate);
}

/**
 * Get the current brecha (gap) between parallel and official dollar
 * @returns {Promise<Object>} Object with official, parallel, and brecha percentage
 */
export async function getDollarBrecha() {
    try {
        const response = await fetch(DOLAR_API_URL);
        if (!response.ok) throw new Error('Failed to fetch dolarapi');

        const data = await response.json();

        if (Array.isArray(data)) {
            let oficial = null;
            let paralelo = null;

            data.forEach((dollar) => {
                const nombre = dollar.nombre?.toLowerCase() || '';
                const fuente = dollar.fuente?.toLowerCase() || '';
                const rate = dollar.promedio || dollar.venta || dollar.price;

                if (fuente === 'oficial' || nombre.includes('oficial') || nombre.includes('bcv')) {
                    if (!oficial) oficial = rate;
                } else if (!paralelo) {
                    // Use first non-official rate as parallel
                    paralelo = rate;
                }
            });

            // If we found both, calculate brecha
            if (oficial && paralelo) {
                const brecha = ((paralelo - oficial) / oficial) * 100;
                return {
                    oficial,
                    paralelo,
                    brecha: parseFloat(brecha.toFixed(2)),
                    fechaActualizacion: data[0]?.fechaActualizacion || new Date().toISOString(),
                    fuente: rateSource
                };
            }

            // Fallback: if only one rate available
            if (oficial) {
                return {
                    oficial,
                    paralelo: oficial,
                    brecha: 0,
                    fechaActualizacion: data[0]?.fechaActualizacion || new Date().toISOString(),
                    fuente: rateSource
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Error calculating brecha:', error);
        return null;
    }
}

/**
 * Get parallel dollar rate
 * @returns {number|null} Parallel dollar rate in VES
 */
export function getParallelDollarRate() {
    return parallelDollarRate;
}

/**
 * Get official dollar rate
 * @returns {number|null} Official dollar rate in VES
 */
export function getOfficialDollarRate() {
    return officialDollarRate;
}

/**
 * Get parallel euro rate
 * @returns {number|null} Parallel euro rate in VES
 */
export function getParallelEurRate() {
    return parallelEurRate;
}

/**
 * Get official euro rate
 * @returns {number|null} Official euro rate in VES
 */
export function getOfficialEurRate() {
    return officialEurRate;
}

/**
 * Get COP rate
 * @returns {number|null} COP rate in VES
 */
export function getCopRate() {
    return copRate;
}

/**
 * Get current exchange rates (from cache or fetch if needed)
 * @returns {Promise<Object>} Exchange rates object
 */
export async function getExchangeRates() {
    if (cachedRates && lastUpdate) {
        // Check if cache is still fresh (less than 60 minutes old)
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);

        if (diffMinutes < 60) {
            return cachedRates;
        }
    }

    // Try to fetch fresh rates
    try {
        return await fetchExchangeRates();
    } catch (error) {
        // If fetch fails, try to load from localStorage
        if (loadRatesFromCache()) {
            return cachedRates;
        }
        // Return default rates as last resort
        return getDefaultRates();
    }
}

/**
 * Convert currency
 * @param {number} amount - Amount to convert
 * @param {string} from - Source currency code
 * @param {string} to - Target currency code
 * @returns {number} Converted amount
 */
export function convertCurrency(amount, from, to) {
    if (!cachedRates || !cachedRates[from] || !cachedRates[to]) {
        return 0;
    }

    // Convert to base currency (USD) first, then to target currency
    const amountInBase = amount / cachedRates[from];
    const convertedAmount = amountInBase * cachedRates[to];

    return convertedAmount;
}

/**
 * Get USD to VES exchange rate (specific for SisConVen)
 * @returns {Promise<number>} USD to VES rate
 */
export async function getUsdToVesRate() {
    try {
        // Prefer the user-selected source (BCV JSON or API)
        return await getSelectedUsdToVesRate()
    } catch (error) {
        console.error('Error getting USD to VES rate (selected):', error);
        // Fallback to original behavior
        try {
            const rates = await getExchangeRates();
            if (rates && rates.VES) return rates.VES;
        } catch (e) {
            console.warn('Fallback getExchangeRates failed:', e);
        }
        return 50;
    }
}

/**
 * Get EUR to VES exchange rate
 * @returns {Promise<number>} EUR to VES rate
 */
export async function getEurToVesRate() {
    try {
        const rates = await getExchangeRates();
        if (rates && rates.VES) {
            // Convert EUR to VES using USD as base
            const usdToVes = rates.VES;
            const eurToUsd = 1 / 0.92; // Default EUR to USD rate
            return usdToVes * eurToUsd;
        }
        // Fallback to cached or default
        return 50; // Default fallback
    } catch (error) {
        console.error('Error getting EUR to VES rate:', error);
        return 50; // Default fallback
    }
}

/**
 * Get COP to VES exchange rate
 * @returns {Promise<number>} COP to VES rate
 */
export async function getCopToVesRate() {
    try {
        const rates = await getExchangeRates();
        if (rates && rates.VES) {
            // Convert COP to VES using USD as base
            const usdToVes = rates.VES;
            const copToUsd = 1 / 4000; // Default COP to USD rate
            return usdToVes * copToUsd;
        }
        // Fallback to cached or default
        return 0.0125; // Default fallback (50 / 4000)
    } catch (error) {
        console.error('Error getting COP to VES rate:', error);
        return 0.0125; // Default fallback
    }
}

/**
 * Format number with proper decimals
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
    if (num === 0) return '0.00';

    // For very small numbers, use more decimals
    if (num < 0.01) {
        return num.toFixed(6);
    }

    // For large numbers, use fewer decimals
    if (num > 1000) {
        return num.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    return num.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
}

/**
 * Get last update time
 * @returns {Date|null} Last update timestamp
 */
export function getLastUpdateTime() {
    return lastUpdate;
}

/**
 * Get formatted last update time string
 * @returns {string} Formatted time string
 */
export function getLastUpdateString() {
    if (!lastUpdate) {
        return 'Nunca';
    }

    const now = new Date();
    const diff = Math.floor((now - lastUpdate) / 1000); // seconds

    let timeString = '';
    if (diff < 60) {
        timeString = 'Hace unos segundos';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        timeString = `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
        const hours = Math.floor(diff / 3600);
        timeString = `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    }

    // Add API status if available
    if (apiStatus) {
        return `${timeString} • ${apiStatus}`;
    }

    return timeString;
}

/**
 * Get API status
 * @returns {Promise<string|null>} API status message
 */
export async function getApiStatus() {
    try {
        const response = await fetch(STATUS_API_URL);
        if (!response.ok) {
            throw new Error(`Status API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.estado) {
            apiStatus = data.estado;
            return apiStatus;
        }
    } catch (error) {
        console.warn('Error fetching API status:', error);
        apiStatus = 'Estado desconocido';
        return apiStatus;
    }

    return null;
}

export function getRateSource() {
    return rateSource;
}

export function getBcvFechaVigencia() {
    return fechaActualizacion;
}

/**
 * Save rates to localStorage cache
 */
function saveRatesToCache() {
    try {
        const cacheData = {
            rates: cachedRates,
            timestamp: lastUpdate.toISOString(),
            rateSource,
            fechaActualizacion
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
}

/**
 * Load rates from localStorage cache
 * @returns {boolean} True if successfully loaded
 */
function loadRatesFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            cachedRates = cacheData.rates;
            lastUpdate = new Date(cacheData.timestamp);
            if (cacheData.rateSource) rateSource = cacheData.rateSource;
            if (cacheData.fechaActualizacion) fechaActualizacion = cacheData.fechaActualizacion;
            else if (cacheData.bcvFecha) fechaActualizacion = cacheData.bcvFecha;
            return true;
        }
    } catch (error) {
        console.error('Error loading from cache:', error);
    }
    return false;
}

/**
 * Get default rates as fallback
 * @returns {Object} Default exchange rates
 */
function getDefaultRates() {
    return {
        USD: 1,
        EUR: 0.92,
        COP: 4000,
        VES: 50
    };
}

/**
 * Initialize the service (load from cache on startup)
 */
export function initExchangeRateService() {
    // Load cached rates and preferred source
    loadRatesFromCache();
    loadPreferredRateSource();
    // Fetch fresh rates in background
    fetchExchangeRates().catch(err => {
        console.warn('Could not fetch initial rates, using cache:', err);
    });
}
