const fs = require('fs');
const readline = require('readline');

function selectMints() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        fs.readFile('minfileAll.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                rl.close();
                return reject(err);
            }

            const tokens = JSON.parse(data);
            const totalTokens = tokens.length;
            console.log(`Total number of mints available: ${totalTokens}`);

            rl.question('How many mints do you want to select? (Press Enter for all) ', (count) => {
                if (count.trim() === '') {
                    filterAndSaveMints(tokens, rl, resolve, reject);
                    return;
                }

                const mintCount = parseInt(count);
                
                if (isNaN(mintCount) || mintCount <= 0 || mintCount > totalTokens) {
                    console.error('Invalid number of mints');
                    rl.close();
                    return reject(new Error('Invalid input'));
                }

                const maxStartIndex = Math.max(0, totalTokens - mintCount);
                rl.question(`Enter start index (0-${maxStartIndex}): `, (startIndex) => {
                    const start = parseInt(startIndex);
                    
                    if (isNaN(start) || start < 0 || start > maxStartIndex) {
                        console.error('Invalid start index');
                        rl.close();
                        return reject(new Error('Invalid input'));
                    }

                    const selectedMints = tokens.slice(start, start + mintCount);
                    filterAndSaveMints(selectedMints, rl, resolve, reject);
                });
            });
        });
    });
}

function filterAndSaveMints(selectedMints, rl, resolve, reject) {
    rl.question('Do you want to filter out contracts that do not end with "pump"? (y/n) ', (answer) => {
        const filteredMints = answer.toLowerCase() === 'y' 
            ? selectedMints.filter(mint => mint.endsWith('pump'))
            : selectedMints;

        fs.writeFile('minfile.json', JSON.stringify(filteredMints, null, 2), (err) => {
            if (err) {
                console.error('Error writing to minfile.json:', err);
                rl.close();
                return reject(err);
            }
            
            console.log('\nSelected mints have been written to minfile.json');
            console.log(`Total mints selected: ${filteredMints.length}`);
            if (answer.toLowerCase() === 'y') {
                console.log(`Filtered to only include contracts ending with "pump"`);
            }
            
            rl.close();
            resolve(filteredMints);
        });
    });
}

// Export the function
module.exports = selectMints;

// Run if called directly
if (require.main === module) {
    selectMints().catch(console.error);
}