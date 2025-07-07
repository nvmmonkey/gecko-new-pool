import Client, {
  CommitmentLevel,
  SubscribeRequestAccountsDataSlice,
  SubscribeRequestFilterAccounts,
  SubscribeRequestFilterBlocks,
  SubscribeRequestFilterBlocksMeta,
  SubscribeRequestFilterEntry,
  SubscribeRequestFilterSlots,
  SubscribeRequestFilterTransactions,
} from "@triton-one/yellowstone-grpc";
import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

// ========== CONFIGURATION ==========
const CONFIG = {
  // gRPC Connection Settings
  GRPC_ENDPOINT: "http://localhost:10001", // Replace with your actual gRPC endpoint
  ACCESS_TOKEN: "",   // Replace with your actual access token
  
  // Monitoring Settings
  ADDRESSES_TO_MONITOR: [
    "HgQy5bqJd3GcjqakukhfMpqAfP62nTxGiqAqh4QtTuHF",
    "8pQYy5peKKqKk34BvJBuuBAfakukTLsmT2MVSzijUgt1"
  ],
  
  // File Settings
  TRANSACTIONS_FILE_NAME: "transactions_decoded.json",
  
  // Stream Settings
  COMMITMENT_LEVEL: CommitmentLevel.PROCESSED,
  RETRY_DELAY_MS: 1000,
  
  // Transaction Filter Settings
  FILTER_SETTINGS: {
    vote: false,
    failed: false,
    signature: undefined,
    accountExclude: [],
    accountRequired: [],
  }
};
// ====================================

// JSDoc types for better documentation (optional)
/**
 * @typedef {Object} SubscribeRequest
 * @property {Object} accounts
 * @property {Object} slots  
 * @property {Object} transactions
 * @property {Object} transactionsStatus
 * @property {Object} blocks
 * @property {Object} blocksMeta
 * @property {Object} entry
 * @property {CommitmentLevel} [commitment]
 * @property {Array} accountsDataSlice
 * @property {Object} [ping]
 */

/**
 * @typedef {Object} TransactionData
 * @property {string} timestamp
 * @property {string} signature
 * @property {any} transactionData
 */

const TRANSACTIONS_FILE_PATH = path.join(__dirname, CONFIG.TRANSACTIONS_FILE_NAME);

/**
 * Converts Buffer objects to readable format (base58 for addresses, hex for data)
 * @param {any} obj - Object to convert
 * @param {boolean} isAddress - Whether to treat as Solana address (base58) or data (hex)
 * @returns {any} Converted object
 */
function convertBufferToReadable(obj, isAddress = false) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'object' && obj.type === 'Buffer' && Array.isArray(obj.data)) {
    const buffer = Buffer.from(obj.data);
    if (isAddress && buffer.length === 32) {
      // Convert 32-byte buffers to base58 addresses
      return bs58.encode(buffer);
    } else {
      // Convert other buffers to hex
      return buffer.toString('hex');
    }
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBufferToReadable(item, isAddress));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      // Determine if this field should be treated as an address
      const shouldBeAddress = [
        'accountKeys', 'accountKey', 'loadedWritableAddresses', 
        'loadedReadonlyAddresses', 'recentBlockhash'
      ].includes(key);
      
      converted[key] = convertBufferToReadable(value, shouldBeAddress);
    }
    return converted;
  }
  
  return obj;
}

/**
 * Decodes transaction data to human-readable format
 * @param {any} transactionData - Raw transaction data
 * @returns {any} Decoded transaction data
 */
function decodeTransactionData(transactionData) {
  const decoded = JSON.parse(JSON.stringify(transactionData));
  
  // Convert the main transaction data
  if (decoded.transaction) {
    decoded.transaction = convertBufferToReadable(decoded.transaction);
    
    // Special handling for signatures (always base58)
    if (decoded.transaction.signature) {
      const sigBuffer = Buffer.from(decoded.transaction.signature.data || decoded.transaction.signature);
      decoded.transaction.signature = bs58.encode(sigBuffer);
    }
    
    if (decoded.transaction.transaction?.signatures) {
      decoded.transaction.transaction.signatures = decoded.transaction.transaction.signatures.map(sig => {
        if (sig.type === 'Buffer') {
          return bs58.encode(Buffer.from(sig.data));
        }
        return sig;
      });
    }
    
    // Handle account keys (convert to addresses)
    if (decoded.transaction.transaction?.message?.accountKeys) {
      decoded.transaction.transaction.message.accountKeys = 
        decoded.transaction.transaction.message.accountKeys.map(key => {
          if (key.type === 'Buffer') {
            return bs58.encode(Buffer.from(key.data));
          }
          return key;
        });
    }
    
    // Handle recent blockhash
    if (decoded.transaction.transaction?.message?.recentBlockhash) {
      const bhash = decoded.transaction.transaction.message.recentBlockhash;
      if (bhash.type === 'Buffer') {
        decoded.transaction.transaction.message.recentBlockhash = bs58.encode(Buffer.from(bhash.data));
      }
    }
    
    // Handle address table lookups
    if (decoded.transaction.transaction?.message?.addressTableLookups) {
      decoded.transaction.transaction.message.addressTableLookups = 
        decoded.transaction.transaction.message.addressTableLookups.map(lookup => {
          const converted = { ...lookup };
          if (lookup.accountKey?.type === 'Buffer') {
            converted.accountKey = bs58.encode(Buffer.from(lookup.accountKey.data));
          }
          if (lookup.writableIndexes?.type === 'Buffer') {
            converted.writableIndexes = Array.from(Buffer.from(lookup.writableIndexes.data));
          }
          if (lookup.readonlyIndexes?.type === 'Buffer') {
            converted.readonlyIndexes = Array.from(Buffer.from(lookup.readonlyIndexes.data));
          }
          return converted;
        });
    }
    
    // Handle instructions
    if (decoded.transaction.transaction?.message?.instructions) {
      decoded.transaction.transaction.message.instructions = 
        decoded.transaction.transaction.message.instructions.map(instruction => {
          const converted = { ...instruction };
          if (instruction.data?.type === 'Buffer') {
            converted.data = Buffer.from(instruction.data.data).toString('hex');
          }
          if (instruction.accounts?.type === 'Buffer') {
            converted.accounts = Array.from(Buffer.from(instruction.accounts.data));
          }
          return converted;
        });
    }
    
    // Handle loaded addresses
    if (decoded.transaction.meta?.loadedWritableAddresses) {
      decoded.transaction.meta.loadedWritableAddresses = 
        decoded.transaction.meta.loadedWritableAddresses.map(addr => {
          if (addr.type === 'Buffer') {
            return bs58.encode(Buffer.from(addr.data));
          }
          return addr;
        });
    }
    
    if (decoded.transaction.meta?.loadedReadonlyAddresses) {
      decoded.transaction.meta.loadedReadonlyAddresses = 
        decoded.transaction.meta.loadedReadonlyAddresses.map(addr => {
          if (addr.type === 'Buffer') {
            return bs58.encode(Buffer.from(addr.data));
          }
          return addr;
        });
    }
  }
  
  return decoded;
}

/**
 * Initializes the transactions JSON file if it doesn't exist
 */
function initializeTransactionsFile() {
  if (!fs.existsSync(TRANSACTIONS_FILE_PATH)) {
    fs.writeFileSync(TRANSACTIONS_FILE_PATH, JSON.stringify([], null, 2));
    console.log(`Created new transactions file: ${TRANSACTIONS_FILE_PATH}`);
  }
}

/**
 * Saves transaction data to the JSON file
 * @param {any} transactionData - The transaction data to save
 */
function saveTransactionToFile(transactionData: any): void {
  try {
    let transactions: any[] = [];
    
    // Check if file exists and has content
    if (fs.existsSync(TRANSACTIONS_FILE_PATH)) {
      const existingData = fs.readFileSync(TRANSACTIONS_FILE_PATH, "utf8");
      
      // Only parse if file has content
      if (existingData.trim().length > 0) {
        try {
          transactions = JSON.parse(existingData);
        } catch (parseError) {
          console.log("JSON file corrupted, creating new array");
          transactions = [];
        }
      }
    }
    
    // Ensure transactions is an array
    if (!Array.isArray(transactions)) {
      transactions = [];
    }
    
    // Add new transaction
    transactions.push(transactionData);
    
    // Write back to file
    fs.writeFileSync(TRANSACTIONS_FILE_PATH, JSON.stringify(transactions, null, 2));
    console.log(`Transaction saved to ${TRANSACTIONS_FILE_PATH} (Total: ${transactions.length})`);
  } catch (error) {
    console.error("Error saving transaction to file:", error);
    
    // Fallback: create a new file with just this transaction
    try {
      fs.writeFileSync(TRANSACTIONS_FILE_PATH, JSON.stringify([transactionData], null, 2));
      console.log("Created new transactions file with current transaction");
    } catch (fallbackError) {
      console.error("Failed to create new transactions file:", fallbackError);
    }
  }
}

/**
 * Subscribes to the gRPC stream and handles incoming data.
 *
 * @param {Client} client - Yellowstone gRPC client
 * @param {any} args - The Subscription request which specifies what data to stream
 */
async function handleStream(client: Client, args: any): Promise<void> {
  const stream = await client.subscribe();
  
  // Promise that resolves when the stream ends or errors out
  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      console.error("Stream error:", error);
      reject(error);
      stream.end();
    });
    stream.on("end", () => resolve());
    stream.on("close", () => resolve());
  });
  
  // Handle incoming transaction data
  stream.on("data", (data) => {
    if (data?.transaction) {
      const signature = bs58.encode(data?.transaction?.transaction?.signature);
      const timestamp = new Date().toISOString();
      
      console.log("Received Transaction:");
      console.log(`Signature: ${signature}`);
      console.log(`Timestamp: ${timestamp}`);
      console.log("\n");
      
      // Decode the transaction data to human-readable format
      const decodedTransaction = decodeTransactionData(data.transaction);
      
      // Prepare transaction data for saving
      const transactionData = {
        timestamp,
        signature,
        slot: data.slot,
        transactionData: decodedTransaction
      };
      
      // Save to JSON file
      saveTransactionToFile(transactionData);
    }
  });
  
  // Send the subscription request
  await new Promise<void>((resolve, reject) => {
    stream.write(args, (err) => {
      err ? reject(err) : resolve();
    });
  }).catch((err) => {
    console.error("Failed to send subscription request:", err);
    throw err;
  });
  
  // Wait for the stream to close
  await streamClosed;
}

/**
 * Entry point to start the subscription stream.
 * @param {Client} client - Yellowstone gRPC client
 * @param {any} args - The subscription request
 */
async function subscribeCommand(client: Client, args: any): Promise<void> {
  // Initialize the transactions file
  initializeTransactionsFile();
  
  console.log("Starting decoded transaction monitor...");
  console.log(`Monitoring addresses: ${CONFIG.ADDRESSES_TO_MONITOR.join(", ")}`);
  console.log(`Saving to: ${TRANSACTIONS_FILE_PATH}`);
  console.log(`Connecting to: ${CONFIG.GRPC_ENDPOINT}`);
  
  while (true) {
    try {
      await handleStream(client, args);
    } catch (error) {
      console.error("Stream error, retrying in", CONFIG.RETRY_DELAY_MS, "ms...", error);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), CONFIG.RETRY_DELAY_MS));
    }
  }
}

// Instantiate Yellowstone gRPC client with config credentials
const client = new Client(
  CONFIG.GRPC_ENDPOINT,
  CONFIG.ACCESS_TOKEN,
  undefined,
);

/**
 * Subscribe Request: The `transactions` field filters transaction streams to only include those
 * that involve the addresses in `accountInclude`.
 * @type {SubscribeRequest}
 */
const req = {
  accounts: {},
  slots: {},
  transactions: {
    pumpFun: {
      ...CONFIG.FILTER_SETTINGS,
      accountInclude: CONFIG.ADDRESSES_TO_MONITOR,
    },
  },
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CONFIG.COMMITMENT_LEVEL,
};

// Start the subscription
subscribeCommand(client, req);