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
                    const selectedMints = tokens;
                    fs.writeFile('minfile.json', JSON.stringify(selectedMints, null, 2), (err) => {
                        if (err) {
                            console.error('Error writing to minfile.json:', err);
                            rl.close();
                            return reject(err);
                        }
                        console.log('\nAll mints have been written to minfile.json');
                        console.log(`Selected indices: 0 to ${totalTokens - 1}`);
                        rl.close();
                        resolve(selectedMints);
                    });
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
                    
                    fs.writeFile('minfile.json', JSON.stringify(selectedMints, null, 2), (err) => {
                        if (err) {
                            console.error('Error writing to minfile.json:', err);
                            rl.close();
                            return reject(err);
                        }
                        console.log('\nSelected mints have been written to minfile.json');
                        console.log(`Selected indices: ${start} to ${start + mintCount - 1}`);
                        rl.close();
                        resolve(selectedMints);
                    });
                });
            });
        });
    });
}

// Export the function
module.exports = selectMints;

// Run if called directly
if (require.main === module) {
    selectMints().catch(console.error);
}