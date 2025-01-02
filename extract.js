const fs = require('fs');

// Function to extract data
function extractData() {
    return new Promise((resolve, reject) => {
        fs.readFile('solana_pools.json', 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            const pools = JSON.parse(data);
            const extractedTokens = pools.map(pool => {
                const baseTokenId = pool.relationships.base_token.data.id;
                const quoteTokenId = pool.relationships.quote_token.data.id;
                const poolName = pool.attributes.name;
                const dexName = pool.relationships.dex.data.id

                // Check if base_token ID ends with 'pump'
                if (baseTokenId.endsWith('')) {
                    return {
                        base_token_id: baseTokenId.replace('solana_', ''),
                        quote_token_id: quoteTokenId.replace('solana_', ''),
                        name: poolName,
                        dex: dexName
                    };
                }
            }).filter(Boolean);

            fs.writeFile('tbp.json', JSON.stringify(extractedTokens, null, 2), (err) => {
                if (err) {
                    return reject(err);
                } else {
                    console.log('Data successfully written to tbp.json');
                    resolve();
                }
            });
        });
    });
}

// Export the extractData function
module.exports = extractData;