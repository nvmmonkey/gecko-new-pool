const { fetchBirdeyeTokens } = require('./birdeye_fetch');
const { processTokens } = require('./birdeye_extract');
const { extractAddresses } = require('./birdeye_format');

async function main() {
    try {
        console.log('Starting Birdeye token processing sequence...');
        
        console.log('\n1. Fetching tokens from Birdeye API...');
        await fetchBirdeyeTokens();
        
        // Add delay between operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n2. Processing and extracting relevant token data...');
        await processTokens();
        
        // Add delay between operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n3. Extracting addresses to minimal format...');
        await extractAddresses();
        
        console.log('\nAll operations completed successfully!');
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// Execute the main function
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
