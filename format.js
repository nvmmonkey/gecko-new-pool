const fs = require('fs');

// Function to format the extracted data
function formatData() {
    return new Promise((resolve, reject) => {
        // Read the tbp.json file
        fs.readFile('tbp.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return reject(err);
            }

            // Parse the JSON data
            const tokens = JSON.parse(data);

            // Format the output and remove duplicates
            const formattedOutput = [...new Set(tokens.flatMap(token => [
                token.base_token_id,
                token.quote_token_id
            ]))]; // Use Set to remove duplicates

            // Read the existing token_cache.json file
            fs.readFile('token_cache.json', 'utf8', (err, existingData) => {
                if (err && err.code !== 'ENOENT') { // ENOENT means file does not exist
                    console.error('Error reading token_cache.json:', err);
                    return reject(err);
                }

                // Parse existing data or initialize an empty array if the file doesn't exist
                const existingTokens = existingData ? JSON.parse(existingData) : [];

                // Combine existing tokens with new formatted output
                const combinedTokens = [...new Set([...existingTokens, ...formattedOutput])]; // Remove duplicates

                // Write the combined data back to token_cache.json
                fs.writeFile('minfile.json', JSON.stringify(combinedTokens, null, 2), (err) => {
                    if (err) {
                        console.error('Error writing to file:', err);
                        return reject(err);
                    } else {
                        console.log('Data successfully appended to token_cache.json');
                        resolve(); // Resolve the promise
                    }
                });
            });
        });
    });
}

// Export the formatData function
module.exports = formatData;
