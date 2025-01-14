const { fetchBirdeyeTokens } = require('./birdeye_fetch');
const { processTokens } = require('./birdeye_extract');
const { extractAddresses } = require('./birdeye_format');
const selectBirdeyeTokens = require('./birdeye_select');
const fs = require('fs').promises;

// Configuration for file paths
const FILES_TO_CLEAN = [
    'birdeye_tokens.json',
    'tdp_birdeye.json',
    'minfileAllBirdeye.json',
    'tdp_birdeye_selected.json',
    'minfileBirdeye.json'
];

async function cleanFiles() {
    for (const file of FILES_TO_CLEAN) {
        try {
            await fs.access(file);
            await fs.unlink(file);
            console.log(`Cleaned up ${file}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error cleaning ${file}:`, error);
            }
        }
    }
}

async function runSequence() {
    try {
        console.log(`\n[${new Date().toISOString()}] Starting Birdeye token processing sequence...`);
        
        // Clean up old files before starting
        await cleanFiles();
        
        console.log('\n1. Fetching tokens from Birdeye API...');
        await fetchBirdeyeTokens();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n2. Processing and extracting relevant token data...');
        await processTokens();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n3. Extracting addresses to minimal format...');
        await extractAddresses();
        
        console.log('\n4. Select tokens based on criteria...');
        await selectBirdeyeTokens();
        
        console.log('\nAll operations completed successfully!');
    } catch (error) {
        console.error('Error in process:', error);
    }
}

async function main() {
    // Initial run
    await runSequence();
    
    // Schedule runs every 6 minutes
    const SIX_MINUTES = 6 * 60 * 1000;
    setInterval(runSequence, SIX_MINUTES);
    
    console.log('\nScheduler started - will run every 6 minutes');
}

// Execute the main function
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
