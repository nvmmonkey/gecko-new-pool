const fetchData = require('./gecko_fetch');
const extractData = require('./gecko_extract');
const formatData = require('./gecko_format');
const fs = require('fs');
const { exec } = require('child_process');
const readline = require('readline');

let lastTokenCache = '';
const intervalTime = 300000-1000; // 5 minutes in milliseconds
let countdown = intervalTime / 1000; // Countdown in seconds
let shouldAppend = false; // Global flag to track append preference

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

function checkForChanges() {
    fs.readFile('minfileAll.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading minfileAll.json:', err);
            return;
        }

        if (data !== lastTokenCache) {
            lastTokenCache = data;
            console.log('minfileAll.json has changed. Executing command...');

            exec('your-command-here', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing command: ${error.message}`);
                    return;
                }
                if (stderr) {
                    console.error(`Command stderr: ${stderr}`);
                    return;
                }
                console.log(`Command output: ${stdout}`);
            });
        }
    });
}

async function runMain() {
    console.log('Starting main process...');
    try {
        await fetchData(null, !shouldAppend); // If shouldAppend is false, we clear the file
        await extractData();
        await formatData();
        console.log('Data fetching, extraction, and formatting completed successfully.');
    } catch (error) {
        console.error('An error occurred during the process:', error);
    }
}

async function main() {
    // Initial prompt for append/new
    const answer = await askQuestion('Do you want to append to existing data? (y/n): ');
    shouldAppend = answer.toLowerCase() === 'y';
    
    console.log(shouldAppend ? 'Will append to existing data' : 'Will create new data file');
    
    // Initial run
    await runMain();
    
    // Set an interval to run the main process every 5 minutes
    setInterval(() => {
        console.log('Running main process...');
        runMain();
        checkForChanges();
    }, intervalTime);

    // Countdown loop
    setInterval(() => {
        if (countdown > 0) {
            console.log(`Next run in ${countdown} seconds...`);
            countdown--;
        } else {
            countdown = intervalTime / 1000;
        }
    }, 1000);
}

// Start the process if this file is run directly
if (require.main === module) {
    main();
}

module.exports = main;
