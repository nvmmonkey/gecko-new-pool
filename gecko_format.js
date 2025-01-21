const fs = require('fs');

function formatData() {
    return new Promise((resolve, reject) => {
        // Get MAX_CONTRACTS from environment variable, default to 50 if not set
        const MAX_CONTRACTS = parseInt(process.env.MAX_CONTRACTS) || 50;
        
        fs.readFile('tbp.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return reject(err);
            }

            try {
                const tokens = JSON.parse(data);
                
                // Sort tokens by created_at date (latest first)
                tokens.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateB - dateA;
                });

                // Format the output and remove duplicates while maintaining order
                const formattedOutput = [];
                const seenTokens = new Set();

                tokens.forEach(token => {
                    [token.base_token_id, token.quote_token_id].forEach(id => {
                        if (!seenTokens.has(id)) {
                            seenTokens.add(id);
                            formattedOutput.push(id);
                        }
                    });
                });

                // Write to both files
                const writePromises = ['minfile.json', 'minfileAll.json'].map(filename => {
                    return new Promise((resolveWrite, rejectWrite) => {
                        fs.readFile(filename, 'utf8', (err, existingData) => {
                            if (err && err.code !== 'ENOENT') {
                                console.error(`Error reading ${filename}:`, err);
                                return rejectWrite(err);
                            }

                            const existingTokens = existingData ? JSON.parse(existingData) : [];
                            
                            // Combine tokens while maintaining order and removing duplicates
                            const combinedTokens = [...formattedOutput];
                            existingTokens.forEach(token => {
                                if (!seenTokens.has(token)) {
                                    combinedTokens.push(token);
                                }
                            });

                            // When writing files:
                            const finalTokens = filename === 'minfile.json' 
                                ? combinedTokens.slice(0, MAX_CONTRACTS)
                                : combinedTokens;

                            fs.writeFile(filename, JSON.stringify(finalTokens, null, 2), (err) => {
                                if (err) {
                                    console.error(`Error writing to ${filename}:`, err);
                                    return rejectWrite(err);
                                }
                                console.log(`Data successfully written to ${filename}`);
                                resolveWrite();
                            });
                        });
                    });
                });

                Promise.all(writePromises)
                    .then(() => resolve())
                    .catch(error => reject(error));

            } catch (error) {
                console.error('Error processing data:', error);
                reject(error);
            }
        });
    });
}

module.exports = formatData;
