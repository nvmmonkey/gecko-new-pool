const axios = require('axios');
const fs = require('fs').promises;

const CONFIG = {
    RATE_LIMIT: 30,
    INTERVAL: 60000,
    RETRY_ATTEMPTS: 5,
    API_KEY: 'f632179e75e2494a888212d67fb9fa9d',
    BASE_URL: 'https://public-api.birdeye.so/defi/tokenlist',
    LIMIT: 50,
    TOKENS_TO_FETCH: 1000,
    MIN_LIQUIDITY: 100,
    SORT_BY: 'v24hUSD',
    SORT_TYPE: 'desc',
    OUTPUT_FILE: 'birdeye_tokens.json'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, headers) {
    let delay = 1000; // Start with 1 second delay
    
    for(let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            if (error.response?.status === 429) {
                console.log(`Rate limit hit. Retrying in ${delay/1000} seconds...`);
                await sleep(delay);
                delay *= 2; // Exponential backoff
                continue;
            }
            throw error;
        }
    }
}

async function fetchAndSave() {
    try {
        let allData = [];
        const totalPages = Math.ceil(CONFIG.TOKENS_TO_FETCH / CONFIG.LIMIT);
        
        for(let page = 0; page < totalPages; page++) {
            const offset = page * CONFIG.LIMIT;
            const url = `${CONFIG.BASE_URL}?sort_by=${CONFIG.SORT_BY}&sort_type=${CONFIG.SORT_TYPE}&offset=${offset}&limit=${CONFIG.LIMIT}&min_liquidity=${CONFIG.MIN_LIQUIDITY}`;
            
            const data = await fetchWithRetry(url, {
                accept: 'application/json',
                'x-chain': 'solana',
                'X-API-KEY': CONFIG.API_KEY
            });

            if (data?.data?.tokens) {
                allData = [...allData, ...data.data.tokens];
                console.log(`Fetched page ${page + 1}/${totalPages} (${data.data.tokens.length} tokens)`);
                await sleep(2000); // Add delay between requests
            }
        }

        const output = {
            success: true,
            data: {
                updateUnixTime: Math.floor(Date.now() / 1000),
                updateTime: new Date().toISOString(),
                tokens: allData,
                total: allData.length
            }
        };

        await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(output, null, 2));
        console.log(`Successfully saved ${allData.length} tokens to ${CONFIG.OUTPUT_FILE}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function fetchBirdeyeTokens() {
    return fetchAndSave();
}

module.exports = {
    fetchBirdeyeTokens
};
