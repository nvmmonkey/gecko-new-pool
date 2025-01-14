const fs = require('fs');

function extractData() {
    return new Promise((resolve, reject) => {
        fs.readFile('solana_pools.json', 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            try {
                const pools = JSON.parse(data);
                
                // Sort pools by creation date (latest first)
                const sortedPools = pools.sort((a, b) => {
                    const dateA = new Date(a.attributes.pool_created_at);
                    const dateB = new Date(b.attributes.pool_created_at);
                    return dateB - dateA;
                });

                const extractedTokens = sortedPools.map(pool => {
                    const baseTokenId = pool.relationships.base_token.data.id;
                    const quoteTokenId = pool.relationships.quote_token.data.id;
                    const poolName = pool.attributes.name;
                    const dexName = pool.relationships.dex.data.id;
                    const createdAt = pool.attributes.pool_created_at;

                    if (baseTokenId.endsWith('')) {
                        return {
                            base_token_id: baseTokenId.replace('solana_', ''),
                            quote_token_id: quoteTokenId.replace('solana_', ''),
                            name: poolName,
                            dex: dexName,
                            created_at: createdAt
                        };
                    }
                }).filter(Boolean);

                fs.writeFile('tbp.json', JSON.stringify(extractedTokens, null, 2), (err) => {
                    if (err) {
                        return reject(err);
                    }
                    console.log('Data successfully written to tbp.json');
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

module.exports = extractData;
