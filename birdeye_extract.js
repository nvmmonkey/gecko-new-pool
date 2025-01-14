const fs = require('fs').promises;

const INPUT_FILE = 'birdeye_tokens.json';
const OUTPUT_FILE = 'tdp_birdeye.json';

async function processTokens() {
    try {
        // Read the input file
        const data = await fs.readFile(INPUT_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        // Extract only the required fields
        const simplifiedTokens = jsonData.data.tokens.map(token => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            v24hChangePercent: token.v24hChangePercent,
            v24hUSD: token.v24hUSD
        }));

        // Create new JSON structure
        const output = {
            updateTime: jsonData.data.updateTime,
            tokens: simplifiedTokens
        };

        // Write to new file
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
        console.log(`Successfully created ${OUTPUT_FILE} with ${simplifiedTokens.length} tokens`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: ${INPUT_FILE} not found`);
        } else {
            console.error('Error:', error.message);
        }
    }
}

module.exports = {
    processTokens
};
