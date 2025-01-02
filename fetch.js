const axios = require('axios');
const fs = require('fs');

// Function to fetch data from the API
async function fetchData() {
    const allPools = [];
    const totalPages = 10; // Total pages to fetch
    const pagesPerCall = 10; // Pages per call
    const dexIdsToFilter = ["raydium", "fluxbeam", "meteora", "orca", "raydium-clmm", "dexlab"];
    const filters = {
        "raydium": true,
        "fluxbeam": true,
        "dexlab": true,
        "meteora": false,
        "orca": false,
        "raydium-clmm": false,
    };



    for (let i = 0; i < totalPages; i += pagesPerCall) {
        const promises = [];

        // Create promises for each page to fetch
        for (let j = 0; j < pagesPerCall; j++) {
            const page = i + j + 1; // Page number (1-indexed)
            if (page <= totalPages) {
                promises.push(
                    axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=${page}`, {
                        headers: {
                            'accept': 'application/json'
                        }
                    })
                );
            }
        }

        // Wait for all promises to resolve
        const responses = await Promise.all(promises);

        // Collect data from responses
        responses.forEach(response => {
            const data = response.data.data; // Access the new data structure
            allPools.push(...data);
        });
    }

    // Use allPools directly without filtering for Solana network
    const filteredSolanaPools = allPools.filter(pool => {
        const dexId = pool.relationships.dex.data.id;
        const fdvUsd = parseFloat(pool.attributes.fdv_usd); // Convert fdv_usd to a number
        return fdvUsd > 500000 &&  !filters[dexId]; // Only include pools not 
       
    });

    // Sort the filtered pools by creation time from latest to oldest
    filteredSolanaPools.sort((a, b) => {
        return new Date(b.attributes.pool_created_at) - new Date(a.attributes.pool_created_at);
    });

    // Write the filtered and sorted data to a JSON file
    fs.writeFileSync('solana_pools.json', JSON.stringify(filteredSolanaPools, null, 2));
    console.log('Filtered and sorted Solana pools data has been written to solana_pools.json');

    // Collect unique "dex" IDs
    const uniqueDexIds = new Set();
    filteredSolanaPools.forEach(pool => {
        const dexId = pool.relationships.dex.data.id; // Get the unique dex ID
        uniqueDexIds.add(dexId);
    });

    const dexCount = uniqueDexIds.size;

    // Convert the Set to an array for JSON output
    const dexIdArray = Array.from(uniqueDexIds);

    // Write the count of unique "dex" types to a new JSON file
    fs.writeFileSync('dex_count.json', JSON.stringify({ dexCount }, null, 2));

    // Write unique "dex" IDs to a new JSON file
    fs.writeFileSync('dex_name.json', JSON.stringify(dexIdArray, null, 2));

    console.log('Unique dex types count has been written to dex_count.json');
    console.log('Unique dex IDs have been written to dex_name.json');
}

// Call the fetchData function
fetchData().catch(error => console.error('Error:', error));


// Export the fetchData function
module.exports = fetchData;