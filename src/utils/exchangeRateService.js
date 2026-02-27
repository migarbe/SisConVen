// Exchange Rate Service for SisConVen
// Manages currency exchange rates from DolarAPI (Venezuela)

const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares';
const COP_API_URL = 'https://co.dolarapi.com/v1/cotizaciones/usd';
const EUR_API_URL = 'https://ve.dolarapi.com/v1/euros';
const STATUS_API_URL = 'https://ve.dolarapi.com/v1/estado';
// URL provided by BCV JSON feed for official USD rate
const BCV_JSON_URL = 'https://agroflorca.ddns.net/sisconven/tasa_bcv.json';
const CACHE_KEY = 'exchangeRatesCache';
const HISTORY_KEY = 'exchangeRatesHistory';
const MAX_HISTORY_DAYS = 90; // Keep up to 90 days of history
const CURRENCIES = ['USD', 'EUR', 'COP', 'VES'];

// State
let cachedRates = null;
let lastUpdate = null;
let parallelDollarRate = null; // Dólar paralelo (e.g., Monitor Dolar, etc.)
let officialDollarRate = null; // Dólar oficial
let parallelEurRate = null; // Euro paralelo
let officialEurRate = null; // Euro oficial
let copRate = null; // Peso Colombiano
let apiStatus = null; // Estado de la API
let bcvSource = null; // Source label when BCV JSON used (e.g., 'SISCONVEN')
let bcvFechaVigencia = null; // formatted fecha_vigencia from BCV JSON

// -----------------------------------------------------------------------------
// Helper for BCV official rate
// -----------------------------------------------------------------------------
/**
 * Fetch the official USD/VES rate from the BCV JSON feed.
 * The file returns a JSON object with a "tasa" field containing a string
 * with comma as decimal separator (e.g. "417,35790000").
 * @returns {Promise<number|null>} parsed rate or null if fetch/parse fails
 */
async function fetchBcvOfficialRate() {
    try {
        const res = await fetch(BCV_JSON_URL);
        if (!res.ok) throw new Error('BCV JSON not reachable');
        const data = await res.json();
        if (data && data.tasa) {
            // convert comma to dot and parse
            const normalized = data.tasa.replace(/\./g, '').replace(',', '.');
            const rate = parseFloat(normalized);
            if (!isNaN(rate)) {
                // store source label and try to extract and format fecha_vigencia
                bcvSource = 'SISCONVEN';
                try {
                    const rawFecha = data.fecha_vigencia || data.fecha || '';
                    // take last non-empty line if contains labels
                    const parts = rawFecha.split('\n').map(s => s.trim()).filter(Boolean);
                    const candidate = parts.length ? parts[parts.length - 1] : rawFecha.trim();
                    // match patterns like "Viernes, 27 Febrero 2026" or "Viernes, 27 de Febrero de 2026"
                    const m = candidate.match(/^([^,]+),\s*(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})$/);
                    if (m) {
                        const weekday = m[1];
                        const day = m[2];
                        const month = m[3];
                        const year = m[4];
                        bcvFechaVigencia = `${weekday}, ${day} de ${month} de ${year}`;
                    } else if (candidate) {
                        // fallback: try to normalize by inserting 'de' before month and year
                        const parts2 = candidate.split(' ');
                        if (parts2.length >= 3) {
                            const weekday = parts2[0].replace(',', '');
                            const day = parts2[1].replace(',', '');
                            const month = parts2[2];
                            const year = parts2[3] || '';
                            bcvFechaVigencia = `${weekday}, ${day} de ${month}${year ? ' de ' + year : ''}`;
                        } else {
                            bcvFechaVigencia = candidate;
                        }
                    }
                } catch (err) {
                    console.warn('Could not parse BCV fecha_vigencia:', err);
                    bcvFechaVigencia = null;
                }

                return rate;
            }
        }
    } catch (err) {
        console.warn('Could not fetch BCV rate:', err);
    }
    return null;
}

/**
 * Fetch exchange rates from DolarAPI
 * @returns {Promise<Object>} Exchange rates object
 */
export async function fetchExchangeRates() {
    try {
        // First try to obtain BCV official rate; if successful we will use it
        const bcvRate = await fetchBcvOfficialRate();
        if (bcvRate !== null) {
            officialDollarRate = bcvRate;
        }

        // Fetch other rates in parallel (we still call DolarAPI for parallels, EUR, COP, etc.)
        const [vesResponse, copResponse, eurResponse] = await Promise.allSettled([
            fetch(DOLAR_API_URL),
            fetch(COP_API_URL),
            fetch(EUR_API_URL)
        ]);

        let results = {};
        let base = 'USD';

        // if we already obtained an official rate from BCV prior to the API call,
        // make sure the results object reflects it so the rest of the logic works
        if (officialDollarRate != null) {
            results['VES'] = officialDollarRate;
        }

        // Process VES rates from Venezuelan API
        if (vesResponse.status === 'fulfilled' && vesResponse.value.ok) {
            const data = await vesResponse.value.json();
            
            if (Array.isArray(data)) {
                data.forEach((dollar) => {
                    const nombre = dollar.nombre?.toLowerCase() || '';
                    const rate = dollar.promedio || dollar.venta || dollar.price;

                    if (rate) {
                        // Store specific dollar types
                        if (nombre.includes('oficial') || nombre.includes('bcv')) {
                            // only override if we didn't get a BCV rate earlier
                            if (officialDollarRate == null) {
                                officialDollarRate = rate;
                            }
                            // Use official as main VES rate for backward compatibility
                            if (!results['VES']) {
                                results['VES'] = officialDollarRate;
                            }
                        } else if (nombre.includes('paralelo') || nombre.includes('monitor') || nombre.includes('bitcoin') || nombre.includes('sicad')) {
                            // Use the first parallel dollar found
                            if (!parallelDollarRate) {
                                parallelDollarRate = rate;
                            }
                        }
                    }
                });

                // If no official found from the API and we still have none, fill from data
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
                    const rate = euro.promedio || euro.venta || euro.price;

                    if (rate) {
                        // Store specific euro types
                        if (nombre.includes('oficial') || nombre.includes('bcv')) {
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
        // try to get BCV rate first; we'll treat it as the official rate if successful
        const bcvRate = await fetchBcvOfficialRate();

        const response = await fetch(DOLAR_API_URL);
        if (!response.ok) throw new Error('Failed to fetch dolarapi');

        const data = await response.json();

        if (Array.isArray(data)) {
            let oficial = bcvRate || null;
            let paralelo = null;

            data.forEach((dollar) => {
                const nombre = dollar.nombre?.toLowerCase() || '';
                const rate = dollar.promedio || dollar.venta || dollar.price;

                if (nombre.includes('oficial') || nombre.includes('bcv')) {
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
                    fechaActualizacion: data[0]?.fechaActualizacion || new Date().toISOString()
                };
            }

            // Fallback: if only one rate available
            if (oficial) {
                return {
                    oficial,
                    paralelo: oficial,
                    brecha: 0,
                    fechaActualizacion: data[0]?.fechaActualizacion || new Date().toISOString()
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
 * Get source label for the official rate (e.g., 'SISCONVEN' if BCV JSON used)
 * @returns {string|null}
 */
export function getRateSource() {
    if (bcvSource) return bcvSource;
    if (officialDollarRate) return 'DolarAPI';
    return null;
}

/**
 * Get formatted fecha_vigencia provided by BCV JSON (e.g. "Viernes, 27 de Febrero de 2026")
 * @returns {string|null}
 */
export function getBcvFechaVigencia() {
    return bcvFechaVigencia;
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
        const rates = await getExchangeRates();
        if (rates && rates.VES) {
            return rates.VES;
        }
        // Fallback to cached or default
        return 50; // Default fallback
    } catch (error) {
        console.error('Error getting USD to VES rate:', error);
        return 50; // Default fallback
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

/**
 * Save rates to localStorage cache
 */
function saveRatesToCache() {
    try {
        const cacheData = {
            rates: cachedRates,
            timestamp: lastUpdate.toISOString()
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
    loadRatesFromCache();
    // Fetch fresh rates in background
    fetchExchangeRates().catch(err => {
        console.warn('Could not fetch initial rates, using cache:', err);
    });
}
