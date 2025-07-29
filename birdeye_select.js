const fs = require('fs');
const readline = require('readline');

function selectBirdeyeTokens() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        fs.readFile('tdp_birdeye.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                rl.close();
                return reject(err);
            }

            const jsonData = JSON.parse(data);
            const tokens = jsonData.tokens;
            const totalTokens = tokens.length;

            console.log(`Total number of tokens available: ${totalTokens}`);
            console.log('\nVolume ranges in the dataset:');
            console.log(`Min 24h Volume: $${Math.min(...tokens.map(t => t.v24hUSD)).toLocaleString()}`);
            console.log(`Max 24h Volume: $${Math.max(...tokens.map(t => t.v24hUSD)).toLocaleString()}`);

            rl.question('\nDo you want to filter by volume? (y/n): ', (filterByVolume) => {
                if (filterByVolume.toLowerCase() === 'y') {
                    rl.question('Enter minimum 24h volume in USD (e.g., 1000000 for $1M): ', (minVolume) => {
                        rl.question('Enter maximum 24h volume in USD (press Enter for no max): ', (maxVolume) => {
                            const min = parseFloat(minVolume);
                            const max = maxVolume.trim() === '' ? Infinity : parseFloat(maxVolume);

                            if (isNaN(min) || (maxVolume.trim() !== '' && isNaN(max))) {
                                console.error('Invalid volume range');
                                rl.close();
                                return reject(new Error('Invalid input'));
                            }

                            const filteredTokens = tokens.filter(token => 
                                token.v24hUSD >= min && token.v24hUSD <= max
                            );

                            console.log(`\nFound ${filteredTokens.length} tokens in the volume range`);
                            selectTokensByIndex(rl, filteredTokens, resolve, reject);
                        });
                    });
                } else {
                    selectTokensByIndex(rl, tokens, resolve, reject);
                }
            });
        });
    });
}

function selectTokensByIndex(rl, tokens, resolve, reject) {
    const totalTokens = tokens.length;
    
    rl.question('\nHow many tokens do you want to select? (Press Enter for all) ', (count) => {
        if (count.trim() === '') {
            writeSelectedTokens(tokens, 0, totalTokens, rl, resolve, reject);
            return;
        }

        const tokenCount = parseInt(count);
        
        if (isNaN(tokenCount) || tokenCount <= 0 || tokenCount > totalTokens) {
            console.error('Invalid number of tokens');
            rl.close();
            return reject(new Error('Invalid input'));
        }

        const maxStartIndex = Math.max(0, totalTokens - tokenCount);
        rl.question(`Enter start index (0-${maxStartIndex}): `, (startIndex) => {
            const start = parseInt(startIndex);
            
            if (isNaN(start) || start < 0 || start > maxStartIndex) {
                console.error('Invalid start index');
                rl.close();
                return reject(new Error('Invalid input'));
            }

            writeSelectedTokens(tokens, start, tokenCount, rl, resolve, reject);
        });
    });
}

function writeSelectedTokens(tokens, start, count, rl, resolve, reject) {
    const selectedTokens = tokens.slice(start, start + count);
    
    rl.question('\nDo you want to filter out contracts that do not end with "pump"? (y/n) ', (answer) => {
        const finalTokens = answer.toLowerCase() === 'y' 
            ? selectedTokens.filter(token => token.address.endsWith('pump'))
            : selectedTokens;

        // Create detailed output
        const output = {
            updateTime: new Date().toISOString(),
            totalSelected: finalTokens.length,
            volumeRange: {
                min: Math.min(...finalTokens.map(t => t.v24hUSD)),
                max: Math.max(...finalTokens.map(t => t.v24hUSD))
            },
            tokens: finalTokens
        };

        // Write full data to tdp_birdeye_selected.json
        fs.writeFile('tdp_birdeye_selected.json', JSON.stringify(output, null, 2), (err) => {
            if (err) {
                console.error('Error writing to tdp_birdeye_selected.json:', err);
                rl.close();
                return reject(err);
            }

            // Write addresses to both minfileBirdeye.json and minfile.json
            const addresses = finalTokens.map(token => token.address);
            const writeFiles = [
                { name: 'minfileBirdeye.json', data: addresses },
                { name: 'minfile.json', data: addresses }
            ];

            Promise.all(writeFiles.map(file => 
                new Promise((resolveWrite, rejectWrite) => {
                    fs.writeFile(file.name, JSON.stringify(file.data, null, 2), (err) => {
                        if (err) rejectWrite(err);
                        else resolveWrite();
                    });
                })
            )).then(() => {
                console.log('\nSelected tokens have been written to:');
                console.log('- tdp_birdeye_selected.json (full data)');
                console.log('- minfileBirdeye.json (addresses only)');
                console.log('- minfile.json (addresses only)');
                console.log(`Selected indices: ${start} to ${start + count - 1}`);
                console.log(`Final number of tokens: ${finalTokens.length}`);
                if (answer.toLowerCase() === 'y') {
                    console.log('Filtered to only include contracts ending with "pump"');
                }
                console.log(`Volume range: $${output.volumeRange.min.toLocaleString()} - $${output.volumeRange.max.toLocaleString()}`);
                rl.close();
                resolve(finalTokens);
            }).catch(err => {
                console.error('Error writing files:', err);
                rl.close();
                reject(err);
            });
        });
    });
}

// Export the function
module.exports = selectBirdeyeTokens;

// Run if called directly
if (require.main === module) {
    selectBirdeyeTokens().catch(console.error);
}