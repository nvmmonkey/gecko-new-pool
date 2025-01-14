const readline = require('readline');
const geckoMain = require('./gecko_main');
const birdeyeMain = require('./main-birdeye');

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function selectDataSource() {
    const rl = createInterface();

    console.log('\n=== Token Data Fetcher ===');
    console.log('1. CoinGecko');
    console.log('2. Birdeye');

    return new Promise((resolve) => {
        rl.question('\nSelect data source (1 or 2): ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    try {
        const choice = await selectDataSource();

        switch (choice) {
            case '1':
                console.log('\nStarting CoinGecko data fetcher...\n');
                geckoMain();
                break;
            case '2':
                console.log('\nStarting Birdeye data fetcher...\n');
                birdeyeMain();
                break;
            default:
                console.log('\nInvalid selection. Please run again and select 1 or 2.');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main();
}

module.exports = main;
