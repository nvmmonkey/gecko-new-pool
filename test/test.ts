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
    GRPC_ENDPOINT: "http://0.0.0.0:10001", // Replace with your actual gRPC endpoint
    ACCESS_TOKEN: "",   // Replace with your actual access token
    
    // Monitoring Settings
    ADDRESSES_TO_MONITOR: [
      "Lucky73WpiBVVgnZm8458en4EwR5eg8hP18oCjkaMUZ",
      "BgcQGcYAst2nTMpchx8U3eCDHCkC52UGM62AH9LGSM16"
    ],
    
    // File Settings
    TRANSACTIONS_FILE_NAME: "transactions.json",
    
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
  
  // Interface for the subscription request structure
  interface SubscribeRequest {
    accounts: { [key: string]: SubscribeRequestFilterAccounts };
    slots: { [key: string]: SubscribeRequestFilterSlots };
    transactions: { [key: string]: SubscribeRequestFilterTransactions };
    transactionsStatus: { [key: string]: SubscribeRequestFilterTransactions };
    blocks: { [key: string]: SubscribeRequestFilterBlocks };
    blocksMeta: { [key: string]: SubscribeRequestFilterBlocksMeta };
    entry: { [key: string]: SubscribeRequestFilterEntry };
    commitment?: CommitmentLevel;
    accountsDataSlice: SubscribeRequestAccountsDataSlice[];
    ping?: SubscribeRequestPing;
  }
  
  // Interface for transaction data structure
  interface TransactionData {
    timestamp: string;
    signature: string;
    transactionData: any;
  }
  
  const TRANSACTIONS_FILE_PATH = path.join(__dirname, CONFIG.TRANSACTIONS_FILE_NAME);
  
  /**
   * Initializes the transactions JSON file if it doesn't exist
   */
  function initializeTransactionsFile(): void {
    if (!fs.existsSync(TRANSACTIONS_FILE_PATH)) {
      fs.writeFileSync(TRANSACTIONS_FILE_PATH, JSON.stringify([], null, 2));
      console.log(`Created new transactions file: ${TRANSACTIONS_FILE_PATH}`);
    }
  }
  
  /**
   * Saves transaction data to the JSON file
   * @param transactionData - The transaction data to save
   */
  function saveTransactionToFile(transactionData: TransactionData): void {
    try {
      // Read existing transactions
      const existingData = fs.readFileSync(TRANSACTIONS_FILE_PATH, "utf8");
      const transactions: TransactionData[] = JSON.parse(existingData);
      
      // Add new transaction
      transactions.push(transactionData);
      
      // Write back to file
      fs.writeFileSync(TRANSACTIONS_FILE_PATH, JSON.stringify(transactions, null, 2));
      console.log(`Transaction saved to ${TRANSACTIONS_FILE_PATH}`);
    } catch (error) {
      console.error("Error saving transaction to file:", error);
    }
  }
  
  /**
   * Subscribes to the gRPC stream and handles incoming data.
   *
   * @param client - Yellowstone gRPC client
   * @param args - The Subscription request which specifies what data to stream
   */
  async function handleStream(client: Client, args: SubscribeRequest) {
    const stream = await client.subscribe();
    
    // Promise that resolves when the stream ends or errors out
    const streamClosed = new Promise<void>((resolve, reject) => {
      stream.on("error", (error) => {
        console.error("Stream error:", error);
        reject(error);
        stream.end();
      });
      stream.on("end", resolve);
      stream.on("close", resolve);
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
        
        // Prepare transaction data for saving
        const transactionData: TransactionData = {
          timestamp,
          signature,
          transactionData: data.transaction
        };
        
        // Save to JSON file
        saveTransactionToFile(transactionData);
      }
    });
    
    // Send the subscription request
    await new Promise<void>((resolve, reject) => {
      stream.write(args, (err: any) => {
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
   *
   */
  async function subscribeCommand(client: Client, args: SubscribeRequest) {
    // Initialize the transactions file
    initializeTransactionsFile();
    
    while (true) {
      try {
        await handleStream(client, args);
      } catch (error) {
        console.error("Stream error, retrying in", CONFIG.RETRY_DELAY_MS, "ms...", error);
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
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
   */
  const req: SubscribeRequest = {
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