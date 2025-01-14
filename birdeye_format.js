const fs = require('fs').promises;

const INPUT_FILE = 'tdp_birdeye.json';
const OUTPUT_FILE = 'minfileAllBirdeye.json';

async function extractAddresses() {
    try {
        // Read the input file
        const data = await fs.readFile(INPUT_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        // Extract only the addresses
        const addresses = jsonData.tokens.map(token => token.address);

        // Write addresses to new file
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(addresses, null, 2));
        console.log(`Successfully created ${OUTPUT_FILE} with ${addresses.length} addresses`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: ${INPUT_FILE} not found`);
        } else {
            console.error('Error:', error.message);
        }
    }
}

module.exports = {
    extractAddresses
};
