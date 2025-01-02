const fetchData = require('./fetch');
const extractData = require('./extract');
const formatData = require('./format');
const fs = require('fs');
const { exec } = require('child_process');

let lastTokenCache = '';
const intervalTime = 300000; // 5 minutes in milliseconds
let countdown = intervalTime / 1000; // Countdown in seconds

// Function to check for changes in token_cache.json
function checkForChanges() {
    fs.readFile('token_cache.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading token_cache.json:', err);
            return;
        }

        // Check if the content has changed
        if (data !== lastTokenCache) {
            lastTokenCache = data; // Update the last known content
            console.log('token_cache.json has changed. Executing command...');

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

// Initial run
runMain();

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
}, 1000); // Update countdown every second
