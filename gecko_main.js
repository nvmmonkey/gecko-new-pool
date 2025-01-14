const fetchData = require('./gecko_fetch');
const extractData = require('./gecko_extract');
const formatData = require('./gecko_format');
const fs = require('fs');
const { exec } = require('child_process');

let lastTokenCache = '';
const intervalTime = 300000-1000; // 5 minutes in milliseconds
let countdown = intervalTime / 1000; // Countdown in seconds

// Function to check for changes in minfile.json
function checkForChanges() {
    fs.readFile('minfileAll.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading minfileAll.json:', err);
            return;
        }

        // Check if the content has changed
        if (data !== lastTokenCache) {
            lastTokenCache = data; // Update the last known content
            console.log('minfileAll.json has changed. Executing command...');

            // Execute your shell command here
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

// Function to run the main process
async function runMain() {
    console.log('Starting main process...');
    try {
        await fetchData();
        await extractData();
        await formatData();
        console.log('Data fetching, extraction, and formatting completed successfully.');
    } catch (error) {
        console.error('An error occurred during the process:', error);
    }
}

async function main() {
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
            countdown = intervalTime / 1000; // Reset countdown
        }
    }, 1000);
}

// Export the main function instead of auto-executing
module.exports = main;
