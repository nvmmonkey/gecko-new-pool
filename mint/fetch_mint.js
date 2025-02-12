import { Connection, PublicKey } from '@solana/web3.js';
import fs from "fs/promises";
import readline from 'readline';

// List of addresses to track
const ADDRESSES_TO_TRACK = [
    "HJLqkCFiNMUsXvqA9btLXFwKpWgCAXXXmNBFnSELvXSC",
    "7dGrdJRYtsNR8UYxZ3TnifXGjGc9eRYLq9sELwYpuuUu"
    // "GC5vQ14nKCmtGRY6AmPPmrZwNqpCxvfLHXScNpLGTBVN",
    // "8pY1AukbuPgUE3EetyLa59rFLMimJGT94ZzbMEZcQF4w",
    // "G8NtWGr8yEyhUkYcjAqsK8seYtE5FgYVV2BHjiHGdLBB",
    // "55NQkFDwwW8noThkL9Rd5ngbgUU36fYZeos1k5ZwjGdn",
    // "CEEXTqHaqbVriXoW4uvdaPShkMaHg9AWnFXLS1nS887C",
    // "K1tChn2NETQd9cCHe1UmUyWP3rDA92gP1dH4nNyEJrx",
    // "Fw7oGoK5gbWZ1Aj4QLa39TnePJzK5N6hwBbknKpicLt1",
    // "E8bTgCfQLMSrJ6wPaq3GsRaGopzNzGL7RPCUYqRUHSFM"
];

// RPC endpoint configuration
const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=c81911a9-9f9f-415e-a347-cc819b81016d"; // Replace with your preferred RPC endpoint

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRecentTokenTransactions(addresses, rpcEndpoint, limit = 500) {
    // Initialize connection with custom RPC endpoint
    const connection = new Connection(rpcEndpoint);
    const allTokenAddresses = new Set();

    for (const address of addresses) {
        try {
            const pubKey = new PublicKey(address);
            
            // Fetch recent transactions
            const signatures = await connection.getSignaturesForAddress(
                pubKey,
                { limit }
            );

            console.log(`Fetched ${signatures.length} transactions for address: ${address}`);

            // Process each transaction
            for (const sig of signatures) {
                await delay(100); // Add 100ms delay between calls
                try {
                    const tx = await connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0,
                    });

                    if (!tx || !tx.meta || !tx.meta.postTokenBalances) continue;

                    // Extract token addresses from post token balances
                    tx.meta.postTokenBalances.forEach(balance => {
                        if (balance.mint) {
                            allTokenAddresses.add(balance.mint);
                        }
                    });

                } catch (err) {
                    console.error(`Error processing transaction ${sig.signature}:`, err);
                    continue;
                }
            }

        } catch (err) {
            console.error(`Error processing address ${address}:`, err);
        }
    }

    // Convert Set to Array for final output
    return Array.from(allTokenAddresses);
}

async function main() {
    try {
        console.log('Starting transaction analysis...');
        console.log(`Analyzing ${ADDRESSES_TO_TRACK.length} addresses...`);
        
        const tokenAddresses = await getRecentTokenTransactions(ADDRESSES_TO_TRACK, RPC_ENDPOINT);
        
        // Prompt user for filtering
        const filterPump = await askUserToFilter();

        // Filter token addresses if user chooses to
        const filteredAddresses = filterPump 
            ? tokenAddresses.filter(address => !address.endsWith("pump")) 
            : tokenAddresses;

        // Write results to JSON file as a simple array
        await fs.writeFile(
            'track_mints.json',
            JSON.stringify(filteredAddresses, null, 2)
        );

        console.log('Results have been written to track_mints.json');

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

// Function to prompt user for filtering
async function askUserToFilter() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Do you want to filter out contracts ending with "pump"? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

main();