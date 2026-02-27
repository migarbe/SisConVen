// Crypto Service for SisConVen
// Manages cryptocurrency prices from CoinMarketCap

const API_KEY = '4016f3a0-9778-4d40-8395-4ad1d3d0a881';
// Use proxy if in dev environment (Vite), otherwise use direct URL
const IS_DEV = import.meta.env.DEV;
const API_BASE_URL = IS_DEV ? '/cmc-api/v1' : 'https://pro-api.coinmarketcap.com/v1';
const CACHE_KEY = 'cryptoPricesCache';
const SYMBOLS = 'BTC,ETH,XRP,USDT';

// State
let cachedPrices = null;
let cachedLogos = null;
let lastUpdate = null;

/**
 * Fetch crypto prices from API
 * @returns {Promise<Object>} Crypto prices object with logos
 */
export async function fetchCryptoPrices() {
    try {
        console.log(`Fetching crypto prices from: ${API_BASE_URL}`);
        const response = await fetch(`${API_BASE_URL}/cryptocurrency/quotes/latest?symbol=${SYMBOLS}&convert=USD`, {
            headers: {
                'X-CMC_PRO_API_KEY': API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch crypto prices: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.data) {
            const prices = {};
            const logos = {};
            Object.keys(data.data).forEach(symbol => {
                const cryptoData = data.data[symbol];
                prices[symbol] = cryptoData.quote.USD.price;
                // CoinMarketCap provides logo URL in the response
                // Format: https://s2.coinmarketcap.com/static/img/coins/64x64/{id}.png
                if (cryptoData.id) {
                    logos[symbol] = `https://s2.coinmarketcap.com/static/img/coins/64x64/${cryptoData.id}.png`;
                }
            });

            cachedPrices = prices;
            cachedLogos = logos;
            lastUpdate = new Date();
            savePricesToCache();
            return { prices: cachedPrices, logos: cachedLogos };
        } else {
            throw new Error('Invalid CoinMarketCap API response');
        }
    } catch (error) {
        console.error('Error fetching crypto prices:', error);
        loadPricesFromCache();

        // If it's a CORS error, we might want to inform the user
        if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            console.warn('CORS might be blocking CoinMarketCap API calls from the browser.');
        }

        throw error;
    }
}

/**
 * Get current crypto prices (from cache or fetch if needed)
 * @returns {Promise<Object>} Crypto prices object with logos
 */
export async function getCryptoPrices() {
    if (cachedPrices && lastUpdate) {
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);

        if (diffMinutes < 30) {
            return { prices: cachedPrices, logos: cachedLogos };
        }
    }

    try {
        return await fetchCryptoPrices();
    } catch (error) {
        if (loadPricesFromCache()) {
            return { prices: cachedPrices, logos: cachedLogos };
        }
        return { prices: getDefaultPrices(), logos: {} };
    }
}

/**
 * Save prices to localStorage cache
 */
function savePricesToCache() {
    try {
        const cacheData = {
            prices: cachedPrices,
            logos: cachedLogos,
            timestamp: lastUpdate.toISOString()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error saving crypto prices to cache:', error);
    }
}

/**
 * Load prices from localStorage cache
 * @returns {boolean} True if successfully loaded
 */
function loadPricesFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cacheData = JSON.parse(cached);
            cachedPrices = cacheData.prices;
            cachedLogos = cacheData.logos || {};
            lastUpdate = new Date(cacheData.timestamp);
            return true;
        }
    } catch (error) {
        console.error('Error loading crypto prices from cache:', error);
    }
    return false;
}

/**
 * Get default prices as fallback
 * @returns {Object} Default crypto prices
 */
function getDefaultPrices() {
    return {
        BTC: 0,
        ETH: 0,
        XRP: 0,
        USDT: 1
    };
}
