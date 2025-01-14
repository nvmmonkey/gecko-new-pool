const readline = require('readline');
const geckoMain = require('./gecko_main');
const birdeyeMain = require('./main-birdeye');
const geckoSelect = require('./gecko_select');
const birdeyeSelect = require('./birdeye_select');
const fs = require('fs').promises;

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function checkExistingFiles() {
    try {
        const files = {
            gecko: false,
            birdeye: false
        };
        
        try {
            await fs.access('minfileAll.json');
            files.gecko = true;
        } catch {}
        
        try {
            await fs.access('tdp_birdeye.json');
            files.birdeye = true;
        } catch {}
        
        return files;
    } catch (error) {
        console.error('Error checking files:', error);
        return { gecko: false, birdeye: false };
    }
}

async function selectFromExisting() {
    const rl = createInterface();

    return new Promise((resolve) => {
        console.log('\n=== Existing Data Found ===');
        console.log('1. Select from CoinGecko data');
        console.log('2. Select from Birdeye data');
        console.log('3. Start new fetch process');

        rl.question('\nSelect option (1-3): ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function selectDataSource() {
    const rl = createInterface();

    return new Promise((resolve) => {
        console.log('\n=== Token Data Fetcher ===');
        console.log('1. CoinGecko');
        console.log('2. Birdeye');

        rl.question('\nSelect data source (1 or 2): ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    try {
        // Check for existing files
        const existingFiles = await checkExistingFiles();
        
        if (existingFiles.gecko || existingFiles.birdeye) {
            while (true) {
                const existingChoice = await selectFromExisting();
                
                switch (existingChoice) {
                    case '1':
                        if (!existingFiles.gecko) {
                            console.log('\nNo existing CoinGecko data found.');
                            continue;
                        }
                        console.log('\nSelecting from CoinGecko data...');
                        await geckoSelect();
                        break;
                    case '2':
                        if (!existingFiles.birdeye) {
                            console.log('\nNo existing Birdeye data found.');
                            continue;
                        }
                        console.log('\nSelecting from Birdeye data...');
                        await birdeyeSelect();
                        break;
                    case '3':
                        // Continue to new fetch process
                        break;
                    default:
                        console.log('\nInvalid selection. Please select 1-3.');
                        continue;
                }
                break;
            }
        }

        // Start new fetch process
        while (true) {
            const choice = await selectDataSource();

            switch (choice) {
                case '1':
                    console.log('\nStarting CoinGecko data fetcher...\n');
                    await geckoMain();
                    return;
                case '2':
                    console.log('\nStarting Birdeye data fetcher...\n');
                    await birdeyeMain();
                    return;
                default:
                    console.log('\nInvalid selection. Please select 1 or 2.');
                    continue;
            }
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Only run if this is the main module
if (require.main === module) {
    main().catch(console.error);
}

module.exports = main;
