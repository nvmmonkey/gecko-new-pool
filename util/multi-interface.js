// multi-token-config.js
import https from "https";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import readline from "readline";

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration object

const CONFIG = {
  // Number of pages to fetch (max 10 per API docs)
  maxPages: 3,
  pageRequestDelay: 300,
  // DEX filters - set to true to include in results
  dexFilters: {
    meteora: true,
    pumpswap: true,
    "raydium-clmm": false,
    raydium: true,
    orca: true,
  },

  // Sort options: 'volume' or 'price'
  sortBy: "volume",

  // Time period for volume sorting: 'm5', 'm15', 'm30', 'h1', 'h6', 'h24'
  volumePeriod: "h24",

  // Token filters - now with option for WSOL or USDC as base token
  tokenFilters: {
    // Default to filtering specific tokens
    requireSpecificToken: true,
    // The selected token type (will be set based on user input)
    selectedTokenType: "sol", // or "usdc"
    // Token IDs
    tokenIds: {
      sol: "solana_So11111111111111111111111111111111111111112",
      usdc: "solana_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC token ID on Solana
    },
  },

  // TOML config file
  tomlConfig: {
    // Path to the TOML file
    filePath: "./config.low.toml",
    // Maximum number of pools to include in the TOML file per token
    maxPools: 2,
    // Priority order for DEXes (highest to lowest)
    dexPriority: [
      "pumpswap",
      "meteora",
      "raydium",
      "raydium-clmm",
      "orca",
      "solfi",
    ],
    maxPoolsPerDex: {
      pumpswap: 1,
      meteora: 1,
      raydium: 1,
      "raydium-clmm": 1,
      orca: 1, // Add a default value for Orca
      solfi: 1,
    },
    // Map DEX IDs to TOML config field names
    dexToFieldName: {
      pumpswap: "pump_pool_list",
      meteora: "meteora_dlmm_pool_list",
      raydium: "raydium_pool_list",
      "raydium-clmm": "raydium_clmm_pool_list",
      orca: "whirlpool_pool_list", // Add the appropriate field name for Orca
      solfi: "solfi_pool_list",
    },
  },

  // User configuration options
  userConfig: {
    jito: {
      enabled: false,
      options: {
        option1: {
          strategy: "Random",
          from: 3000,
          to: 9000,
          count: 1,
        },
        option2: {
          strategy: "Random",
          from: 5000,
          to: 13000,
          count: 1,
        },
        option3: {
          strategy: "Random",
          from: 9000,
          to: 23000,
          count: 1,
        },
        option4: {
          strategy: "Random",
          from: null,
          to: null,
          count: null,
        },
      },
    },
    spam: {
      enabled: false,
      options: {
        option1: {
          strategy: "Random",
          from: 28311,
          to: 488111,
          count: 1,
        },
        option2: {
          strategy: "Random",
          from: 218311,
          to: 588111,
          count: 1,
        },
        option3: {
          strategy: "Random",
          from: null,
          to: null,
          count: 1,
        },
      },
    },
    lookupTableAccounts: {
      default: [
        "4sKLJ1Qoudh8PJyqBeuKocYdsZvxTcRShUt9aKqwhgvC",
        "8mRar7rLwwuM4Nx8fJaAoLBgUMXNMggyLJGsYtxvbbLR",
      ],
      custom: [],
    },
  },
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify readline question
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function displayMainMenu() {
  let exit = false;

  while (!exit) {
    console.log("\n=== Main Menu ===");
    console.log("1) Search and update (add tokens)");
    console.log("2) Modify the config (view/delete tokens)");
    console.log("3) Modify Spam settings");
    console.log("4) Modify Jito settings");
    console.log("5) Modify DEX pool quantities");
    console.log("6) Modify Base Mint");
    console.log("7) Create new lookup table");
    console.log("8) Extend existing lookup table");
    console.log("9) Run the bot"); // New option
    console.log("10) Exit program"); // Updated exit option number

    const choice = await question("Enter your choice (1-10): ");

    switch (choice) {
      case "1":
        await searchAndUpdate();
        break;
      case "2":
        await modifyConfig();
        break;
      case "3":
        await modifySpamSettings();
        break;
      case "4":
        await modifyJitoSettings();
        break;
      case "5":
        await modifyPoolQuantities();
        break;
      case "6":
        await modifyBaseMint();
        break;
      case "7":
        await createLookupTable();
        break;
      case "8":
        await extendLookupTable();
        break;
      case "9":
        await runBot(); // New function
        break;
      case "10":
        exit = true;
        console.log("Exiting program...");
        break;
      default:
        console.log("Invalid choice. Please enter a number from 1 to 10.");
    }
  }
}

async function runBot() {
  console.log("\n=== Run Arbitrage Bot ===");

  // Get the config path from the existing CONFIG
  const configPath = CONFIG.tomlConfig.filePath;
  console.log(`Using config file: ${configPath}`);

  console.log("\nStarting the arbitrage bot...");
  console.log("(Press Ctrl+C to stop the bot when needed)");

  try {
    // Use child_process via dynamic import for ES modules compatibility
    const { spawn } = await import("child_process");

    // Use spawn instead of execSync to allow the process to run continuously
    // and stream output to the console
    const botProcess = spawn("./smb-onchain", ["run", configPath], {
      stdio: "inherit", // This will pipe the child process I/O to/from the parent
    });

    // Handle process events
    botProcess.on("error", (error) => {
      console.error(`Error starting bot: ${error.message}`);
    });

    botProcess.on("close", (code) => {
      if (code === 0) {
        console.log("\nBot process completed successfully.");
      } else {
        console.log(`\nBot process exited with code ${code}.`);
      }
    });

    // Note: The process will continue running until the user presses Ctrl+C
    // or until the process exits naturally
  } catch (error) {
    console.error("Error running bot:", error.message);
  }
}

// Function to create a new lookup table
async function createLookupTable() {
  console.log("\n=== Create New Lookup Table ===");

  // Get the config path from the existing CONFIG
  const configPath = CONFIG.tomlConfig.filePath;
  console.log(`Using config file: ${configPath}`);

  // Confirm creation (as it costs SOL)
  console.log(
    "\nNOTE: Creating a lookup table will cost ~0.00128064 SOL. This cost cannot be recovered."
  );
  const confirmCreate = await question("Do you want to proceed? (yes/no): ");

  if (
    confirmCreate.toLowerCase() !== "yes" &&
    confirmCreate.toLowerCase() !== "y"
  ) {
    console.log("Operation cancelled.");
    return;
  }

  console.log("\nCreating lookup table...");

  try {
    // Use child_process via dynamic import for ES modules compatibility
    const { execSync } = await import("child_process");
    const result = execSync(
      `./smb-onchain create-lookup-table ${configPath}`
    ).toString();

    // Parse the output to extract the lookup table address
    const addressMatch = result.match(
      /Lookup table created: ([A-Za-z0-9]{32,44})/
    );

    if (!addressMatch || !addressMatch[1]) {
      console.log(
        "Lookup table created, but couldn't extract the address from output."
      );
      console.log("Command output:", result);
      return;
    }

    const lookupTableAddress = addressMatch[1];
    console.log(`Lookup table created successfully: ${lookupTableAddress}`);

    // Store the address in lookuptable.json
    await saveLookupTableAddress(lookupTableAddress);

    // Automatically add to configuration
    await addLookupTableToConfig(lookupTableAddress);

    console.log(
      `Lookup table ${lookupTableAddress} has been added to the configuration.`
    );
  } catch (error) {
    console.error("Error creating lookup table:", error.message);
    if (error.stderr) {
      console.error("Command error output:", error.stderr.toString());
    }
  }
}

// Function to extend an existing lookup table
async function extendLookupTable() {
  console.log("\n=== Extend Existing Lookup Table ===");

  // Get the config path from the existing CONFIG
  const configPath = CONFIG.tomlConfig.filePath;
  console.log(`Using config file: ${configPath}`);

  // Load existing lookup tables from file
  const lookupTables = await loadLookupTables();

  // Display available lookup tables
  let lookupTableAddress;

  if (lookupTables.length > 0) {
    console.log("\nAvailable lookup tables:");
    lookupTables.forEach((address, index) => {
      console.log(`${index + 1}. ${address}`);
    });

    // Ask user to select a table or enter a new one
    console.log("\nSelect a lookup table to extend:");
    console.log(`1-${lookupTables.length}. Choose from the list above`);
    console.log(`${lookupTables.length + 1}. Enter a different address`);

    const selection = await question("Enter your choice: ");
    const selectionNum = parseInt(selection);

    if (
      !isNaN(selectionNum) &&
      selectionNum >= 1 &&
      selectionNum <= lookupTables.length
    ) {
      // User selected from the list
      lookupTableAddress = lookupTables[selectionNum - 1];
    } else if (
      !isNaN(selectionNum) &&
      selectionNum === lookupTables.length + 1
    ) {
      // User wants to enter a different address
      lookupTableAddress = await question("Enter the lookup table address: ");
    } else {
      // Input was something else (possibly a direct address)
      lookupTableAddress = selection;
    }
  } else {
    // No saved lookup tables
    console.log("\nNo saved lookup tables found.");
    lookupTableAddress = await question(
      "Enter the lookup table address to extend: "
    );
  }

  // Validate address format (simple check)
  if (!/^[A-Za-z0-9]{32,44}$/.test(lookupTableAddress)) {
    console.error("Invalid lookup table address format.");
    return;
  }

  console.log(`\nSelected lookup table: ${lookupTableAddress}`);
  console.log(
    "\nNOTE: Adding one address will cost ~0.00022 SOL, this cost can be recovered by deactivating and closing the lookup table."
  );

  const confirmExtend = await question(
    "Do you want to proceed with extending this lookup table? (yes/no): "
  );

  if (
    confirmExtend.toLowerCase() !== "yes" &&
    confirmExtend.toLowerCase() !== "y"
  ) {
    console.log("Operation cancelled.");
    return;
  }

  console.log("\nExtending lookup table...");

  try {
    // Use child_process via dynamic import for ES modules compatibility
    const { execSync } = await import("child_process");
    const result = execSync(
      `./smb-onchain extend-lookup-table ${configPath} ${lookupTableAddress}`
    ).toString();

    console.log("Lookup table extended successfully.");
    console.log(result);

    // Save this lookup table address if it's new
    await saveLookupTableAddress(lookupTableAddress);

    // Automatically add to configuration
    await addLookupTableToConfig(lookupTableAddress);

    console.log(
      `Lookup table ${lookupTableAddress} has been added to the configuration.`
    );
  } catch (error) {
    console.error("Error extending lookup table:", error.message);
    if (error.stderr) {
      console.error("Command error output:", error.stderr.toString());
    }
  }
}

async function saveLookupTableAddress(address) {
  try {
    // Load existing addresses
    const lookupTables = await loadLookupTables();

    // Add new address if not already present
    if (!lookupTables.includes(address)) {
      lookupTables.push(address);

      // Write to file
      await fs.writeFile(
        "lookuptable.json",
        JSON.stringify(lookupTables, null, 2)
      );
      console.log(`Address saved to lookuptable.json`);
    }
  } catch (error) {
    console.error("Error saving lookup table address:", error.message);
  }
}

// Helper function to load lookup tables from JSON file
async function loadLookupTables() {
  try {
    const data = await fs.readFile("lookuptable.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or has invalid JSON, return empty array
    return [];
  }
}

// Function to add lookup table to the config file
async function addLookupTableToConfig(lookupTableAddress) {
  try {
    // Read the TOML file using the path from CONFIG
    const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

    // Check if this lookup table is already in all mint_config_list sections
    const mintSections =
      tomlContent.match(
        /\[\[routing\.mint_config_list\]\][^\[]*?(?=\[\[|$)/g
      ) || [];

    let updatedContent = tomlContent;

    // For each mint section
    for (const mintSection of mintSections) {
      // Check if this lookup table is already in the section
      if (!mintSection.includes(lookupTableAddress)) {
        // Extract the lookup_table_accounts section if it exists
        const lookupTablesMatch = mintSection.match(
          /lookup_table_accounts = \[([\s\S]*?)\]/
        );

        if (lookupTablesMatch) {
          // Get the current lookup table content
          const currentLookupTables = lookupTablesMatch[1];

          // Check if the lookup table list is not empty
          const hasExistingTables = currentLookupTables.trim().length > 0;

          // Create the new lookup table line with proper indentation (2 spaces)
          const newEntry = hasExistingTables
            ? `\n  "${lookupTableAddress}",`
            : `\n  "${lookupTableAddress}",\n`;

          // Insert at the end of the list but before the closing bracket
          const updatedLookupTables = hasExistingTables
            ? currentLookupTables + newEntry
            : newEntry;

          // Replace in the mint section
          const updatedSection = mintSection.replace(
            /lookup_table_accounts = \[([\s\S]*?)\]/,
            `lookup_table_accounts = [${updatedLookupTables}]`
          );

          // Replace the section in the full content
          updatedContent = updatedContent.replace(mintSection, updatedSection);
        } else {
          // If there's no lookup_table_accounts section, add it
          const mintLine = mintSection.match(/mint = "([^"]+)"/);

          if (mintLine) {
            const newLookupTableSection = `lookup_table_accounts = [\n  "${lookupTableAddress}",\n]\n`;

            // Add after the mint line
            const updatedSection = mintSection.replace(
              mintLine[0],
              `${mintLine[0]}\n${newLookupTableSection}`
            );

            // Replace the section in the full content
            updatedContent = updatedContent.replace(
              mintSection,
              updatedSection
            );
          }
        }
      }
    }

    // Update the file if changes were made
    if (updatedContent !== tomlContent) {
      await writeTomlFile(CONFIG.tomlConfig.filePath, updatedContent);
      console.log("TOML configuration updated with lookup table address.");
    } else {
      console.log("Lookup table address was already in all configurations.");
    }

    // Also add to in-memory CONFIG
    if (
      !CONFIG.userConfig.lookupTableAccounts.custom.includes(lookupTableAddress)
    ) {
      CONFIG.userConfig.lookupTableAccounts.custom.push(lookupTableAddress);
    }
  } catch (error) {
    console.error("Error adding lookup table to config:", error.message);
  }
}

// Function for option 1: Search and update (existing functionality)
async function searchAndUpdate() {
  console.log("\n=== Search and Update Tokens ===");

  // Ask for base token preference first
  console.log("\n=== Base Token Configuration ===");
  const baseTokenChoice = await question(
    "Which token do you want to filter for? (1 for SOL, 2 for USDC): "
  );

  if (baseTokenChoice === "2") {
    CONFIG.tokenFilters.selectedTokenType = "usdc";
    console.log("Selected USDC as base token filter.");
  } else {
    CONFIG.tokenFilters.selectedTokenType = "sol";
    console.log("Selected SOL as base token filter (default).");
  }

  // Read the TOML file first
  const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

  // Extract existing tokens
  const existingTokens = extractExistingTokens(tomlContent);
  console.log(
    `\nExisting tokens in config: ${
      existingTokens.length > 0 ? existingTokens.join(", ") : "None"
    }`
  );

  // Process all tokens
  const processedTokens = [];
  let continueAdding = true;

  // First, process a new token
  let tokenAddress = process.argv[2];
  if (!tokenAddress) {
    tokenAddress = await question(
      "Enter the token address or symbol you want to search for: "
    );

    if (!tokenAddress) {
      console.log("No token address provided. Returning to main menu.");
      return;
    }
  }

  // Process the first token
  const tokenResult = await processToken(tokenAddress);
  if (tokenResult) {
    processedTokens.push(tokenResult);
  } else {
    return;
  }

  // Get user configuration choices for the first token
  const userConfig = await getUserConfig();

  // Ask if user wants to add more tokens
  while (continueAdding) {
    const addMore = await question(
      "\nDo you want to add another token? (yes/no): "
    );
    if (addMore.toLowerCase() !== "yes" && addMore.toLowerCase() !== "y") {
      continueAdding = false;
      continue;
    }

    const nextTokenAddress = await question(
      "Enter the next token address or symbol: "
    );
    if (!nextTokenAddress) {
      console.log("No token address provided. Skipping.");
      continue;
    }

    // Skip if this token is already in the list
    if (
      processedTokens.some((t) => t.tokenAddress === nextTokenAddress) ||
      existingTokens.includes(nextTokenAddress)
    ) {
      console.log(
        `Token ${nextTokenAddress} is already in the configuration. Skipping.`
      );
      continue;
    }

    // Process the next token
    const nextTokenResult = await processToken(nextTokenAddress);
    if (nextTokenResult) {
      processedTokens.push(nextTokenResult);
    }
  }

  // Update TOML file for each token
  let updatedContent = tomlContent;
  let tokenCount = existingTokens.length;

  for (const token of processedTokens) {
    const result = await updateTomlFile(
      updatedContent,
      token.tokenAddress,
      token.selectedPools,
      userConfig
    );
    updatedContent = result.updatedContent;
    tokenCount = result.tokenCount;
  }

  // Write the updated TOML file
  const writeResult = await writeTomlFile(
    CONFIG.tomlConfig.filePath,
    updatedContent
  );
  console.log(`\n${writeResult}`);

  // Output summary of updates
  console.log(
    `\nSUCCESS: TOML file updated with ${processedTokens.length} new tokens`
  );
  console.log(`Total tokens in configuration: ${tokenCount}`);
  console.log(`merge_mints set to: ${tokenCount > 1 ? "true" : "false"}`);

  processedTokens.forEach((token) => {
    console.log(
      `\n- ${token.tokenSymbol} (${token.tokenAddress}): ${token.totalSelectedPools} pools`
    );
    Object.keys(token.selectedPools).forEach((dex) => {
      console.log(
        `  ${getDexName(dex, token.filteredData.included)}: ${
          token.selectedPools[dex].length
        } pools`
      );
    });
  });

  // Display user configuration settings
  console.log("\nConfiguration Settings:");
  console.log(
    `- Base token filter: ${CONFIG.tokenFilters.selectedTokenType.toUpperCase()}`
  );
  console.log(`- Jito enabled: ${userConfig.jito.enabled ? "Yes" : "No"}`);
  if (userConfig.jito.enabled && userConfig.jito.selectedOption) {
    console.log(`  Strategy: ${userConfig.jito.selectedOption.strategy}`);
    console.log(`  From: ${userConfig.jito.selectedOption.from}`);
    console.log(`  To: ${userConfig.jito.selectedOption.to}`);
    console.log(`  Count: ${userConfig.jito.selectedOption.count}`);
  }

  console.log(`- Spam enabled: ${userConfig.spam.enabled ? "Yes" : "No"}`);
  if (userConfig.spam.enabled && userConfig.spam.selectedOption) {
    console.log(`  Strategy: ${userConfig.spam.selectedOption.strategy}`);
    console.log(`  From: ${userConfig.spam.selectedOption.from}`);
    console.log(`  To: ${userConfig.spam.selectedOption.to}`);
    console.log(`  Count: ${userConfig.spam.selectedOption.count}`);
  }

  console.log("- Lookup table accounts:");
  const allAccounts = userConfig.lookupTableAccounts.default.concat(
    userConfig.lookupTableAccounts.custom
  );
  allAccounts.forEach((account) => {
    console.log(`  ${account}`);
  });
}

// Function for option 2: Modify config (show and delete tokens)
async function modifyConfig() {
  console.log("\n=== Modify Configuration ===");

  // Read the TOML file
  const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

  // Extract existing tokens
  const existingTokens = extractExistingTokens(tomlContent);

  if (existingTokens.length === 0) {
    console.log("No tokens found in the configuration file.");
    return;
  }

  // Display tokens in a table format
  console.log("\nCurrent tokens in configuration:");
  console.log("------------------------------------------");
  console.log("| Index | Token Address                              |");
  console.log("------------------------------------------");

  existingTokens.forEach((token, index) => {
    console.log(
      `| ${(index + 1).toString().padEnd(5)} | ${token.padEnd(42)} |`
    );
  });

  console.log("------------------------------------------");

  // Ask if the user wants to delete a token
  const deleteToken = await question(
    "\nDo you want to delete a token? (yes/no): "
  );

  if (
    deleteToken.toLowerCase() === "yes" ||
    deleteToken.toLowerCase() === "y"
  ) {
    const tokenIndexToDelete = await question(
      "Enter the index of the token to delete: "
    );
    const index = parseInt(tokenIndexToDelete) - 1;

    if (isNaN(index) || index < 0 || index >= existingTokens.length) {
      console.log("Invalid index. No tokens deleted.");
      return;
    }

    const tokenToDelete = existingTokens[index];

    // Confirm deletion
    const confirmDeletion = await question(
      `Are you sure you want to delete token ${tokenToDelete}? (yes/no): `
    );

    if (
      confirmDeletion.toLowerCase() === "yes" ||
      confirmDeletion.toLowerCase() === "y"
    ) {
      // Remove the token from the TOML file
      const updatedContent = removeTokenFromToml(tomlContent, tokenToDelete);

      // Write the updated TOML file
      await writeTomlFile(CONFIG.tomlConfig.filePath, updatedContent);

      console.log(
        `\nToken ${tokenToDelete} has been removed from the configuration.`
      );

      // Re-read the file to check the updated token count
      const newTomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);
      const remainingTokens = extractExistingTokens(newTomlContent);

      // Update merge_mints based on the remaining tokens
      const mergeMintValue = remainingTokens.length > 1 ? "true" : "false";
      let finalContent = newTomlContent;

      const mergeMintRegex = /merge_mints = (true|false)/i;
      const newMergeMint = `merge_mints = ${mergeMintValue}`;

      if (mergeMintRegex.test(finalContent)) {
        finalContent = finalContent.replace(mergeMintRegex, newMergeMint);
        await writeTomlFile(CONFIG.tomlConfig.filePath, finalContent);
      }

      console.log(`Total tokens remaining: ${remainingTokens.length}`);
      console.log(`merge_mints set to: ${mergeMintValue}`);
    } else {
      console.log("Deletion cancelled.");
    }
  }
}

// Function to remove a token from the TOML content
function removeTokenFromToml(tomlContent, tokenAddress) {
  // Regular expression to find the mint_config_list section for this token
  const mintSectionRegex = new RegExp(
    `\\[\\[routing\\.mint_config_list\\]\\][\\s\\S]*?mint = "${tokenAddress}"[\\s\\S]*?(?=\\[\\[routing\\.mint_config_list\\]\\]|$)`,
    "i"
  );

  // Find the section for this token
  const mintSection = tomlContent.match(mintSectionRegex);

  if (mintSection) {
    // Remove the section from the content
    return tomlContent.replace(mintSectionRegex, "");
  }

  return tomlContent;
}

// Function for option 3: Modify Spam settings
async function modifySpamSettings() {
  console.log("\n=== Modify Spam Settings ===");

  // Read the TOML file
  const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

  // Extract current spam settings
  const spamEnabledRegex = /\[spam\]\nenabled = (true|false)/i;
  const spamEnabledMatch = tomlContent.match(spamEnabledRegex);

  const computeUnitPriceRegex =
    /compute_unit_price = \{ strategy = "([^"]+)", from = (\d+), to = (\d+), count = (\d+) \}/i;
  const computeUnitPriceMatch = tomlContent.match(computeUnitPriceRegex);

  // Display current settings
  console.log("\nCurrent Spam Settings:");
  console.log(
    `- Enabled: ${spamEnabledMatch ? spamEnabledMatch[1] : "unknown"}`
  );

  if (computeUnitPriceMatch) {
    console.log(`- Strategy: ${computeUnitPriceMatch[1]}`);
    console.log(`- From: ${computeUnitPriceMatch[2]}`);
    console.log(`- To: ${computeUnitPriceMatch[3]}`);
    console.log(`- Count: ${computeUnitPriceMatch[4]}`);
  }

  // Ask for new settings
  console.log("\nUpdate Spam Settings:");
  const spamEnabled = await question("Enable spam? (yes/no): ");
  const isSpamEnabled =
    spamEnabled.toLowerCase() === "yes" || spamEnabled.toLowerCase() === "y";

  let userConfig = {
    spam: {
      enabled: isSpamEnabled,
      selectedOption: {
        strategy: "Random",
        from: 0,
        to: 0,
        count: 1,
      },
    },
  };

  if (isSpamEnabled) {
    console.log("\nSelect a compute unit price strategy option:");
    console.log("1. Random strategy, from 28311 to 488111, count 1");
    console.log("2. Random strategy, from 218311 to 588111, count 1");
    console.log("3. Custom values");

    const spamOption = await question("Enter option number (1-3): ");

    if (spamOption === "1") {
      userConfig.spam.selectedOption = {
        strategy: "Random",
        from: 28311,
        to: 488111,
        count: 1,
      };
    } else if (spamOption === "2") {
      userConfig.spam.selectedOption = {
        strategy: "Random",
        from: 218311,
        to: 588111,
        count: 1,
      };
    } else if (spamOption === "3") {
      userConfig.spam.selectedOption.strategy = "Random";
      userConfig.spam.selectedOption.from = parseInt(
        await question('Enter "from" value: '),
        10
      );
      userConfig.spam.selectedOption.to = parseInt(
        await question('Enter "to" value: '),
        10
      );
      userConfig.spam.selectedOption.count =
        parseInt(await question('Enter "count" value: '), 10) || 1;
    } else {
      console.log("Invalid option. Using option 1 as default.");
      userConfig.spam.selectedOption = {
        strategy: "Random",
        from: 28311,
        to: 488111,
        count: 1,
      };
    }
  }

  // Update spam.enabled
  let updatedContent = tomlContent;
  const spamEnabledString = `[spam]\nenabled = ${
    userConfig.spam.enabled ? "true" : "false"
  }`;
  updatedContent = updatedContent.replace(spamEnabledRegex, spamEnabledString);

  // Update compute_unit_price if spam is enabled
  if (userConfig.spam.enabled) {
    const selectedOption = userConfig.spam.selectedOption;
    const newComputeUnitPrice = `compute_unit_price = { strategy = "${selectedOption.strategy}", from = ${selectedOption.from}, to = ${selectedOption.to}, count = ${selectedOption.count} }`;

    updatedContent = updatedContent.replace(
      computeUnitPriceRegex,
      newComputeUnitPrice
    );
  }

  // Write the updated TOML file
  await writeTomlFile(CONFIG.tomlConfig.filePath, updatedContent);

  console.log("\nSpam settings updated successfully!");
  console.log(`- Enabled: ${userConfig.spam.enabled ? "true" : "false"}`);

  if (userConfig.spam.enabled) {
    console.log(`- Strategy: ${userConfig.spam.selectedOption.strategy}`);
    console.log(`- From: ${userConfig.spam.selectedOption.from}`);
    console.log(`- To: ${userConfig.spam.selectedOption.to}`);
    console.log(`- Count: ${userConfig.spam.selectedOption.count}`);
  }
}

// Updated function for option 4: Modify Jito settings to include min_profit
async function modifyJitoSettings() {
  console.log("\n=== Modify Jito Settings ===");

  // Read the TOML file
  const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

  // Extract current Jito settings
  const jitoEnabledRegex = /\[jito\]\nenabled = (true|false)/i;
  const jitoEnabledMatch = tomlContent.match(jitoEnabledRegex);

  const jitoTipConfigRegex =
    /\[jito\.tip_config\]\nstrategy = "([^"]+)"\nfrom = (\d+)\nto = (\d+)\ncount = (\d+)/i;
  const jitoTipConfigMatch = tomlContent.match(jitoTipConfigRegex);

  // Extract min_profit setting
  const minProfitRegex = /\[jito\][^\[]*min_profit = (\d+)/s;
  const minProfitMatch = tomlContent.match(minProfitRegex);
  const currentMinProfit = minProfitMatch ? parseInt(minProfitMatch[1]) : 17000;

  // Display all current settings in a table
  console.log("\nCurrent Jito Settings:");
  console.log("---------------------------------------");
  console.log(`Enabled: ${jitoEnabledMatch ? jitoEnabledMatch[1] : "unknown"}`);
  console.log(`Min Profit: ${currentMinProfit}`);

  if (jitoTipConfigMatch) {
    console.log("\nTip Configuration:");
    console.log(`Strategy: ${jitoTipConfigMatch[1]}`);
    console.log(`From: ${jitoTipConfigMatch[2]}`);
    console.log(`To: ${jitoTipConfigMatch[3]}`);
    console.log(`Count: ${jitoTipConfigMatch[4]}`);
  }
  console.log("---------------------------------------");

  // Ask for new settings
  console.log("\nUpdate Jito Settings:");
  console.log("1. Enable/Disable Jito");
  console.log("2. Modify Min Profit");
  console.log("3. Modify Tip Configuration");
  console.log("4. Return to main menu");

  const settingChoice = await question("Enter your choice (1-4): ");

  let userConfig = {
    jito: {
      enabled: jitoEnabledMatch ? jitoEnabledMatch[1] === "true" : false,
      minProfit: currentMinProfit,
      selectedOption: jitoTipConfigMatch
        ? {
            strategy: jitoTipConfigMatch[1],
            from: parseInt(jitoTipConfigMatch[2]),
            to: parseInt(jitoTipConfigMatch[3]),
            count: parseInt(jitoTipConfigMatch[4]),
          }
        : {
            strategy: "Random",
            from: 5000,
            to: 13000,
            count: 1,
          },
    },
  };

  if (settingChoice === "1") {
    // Toggle Jito enabled state
    const jitoEnabled = await question(
      `Enable Jito? (current: ${
        userConfig.jito.enabled ? "enabled" : "disabled"
      }) (yes/no): `
    );
    userConfig.jito.enabled =
      jitoEnabled.toLowerCase() === "yes" || jitoEnabled.toLowerCase() === "y";
  } else if (settingChoice === "2") {
    // Modify min profit
    const newMinProfit = await question(
      `Enter new Min Profit value (current: ${currentMinProfit}): `
    );
    if (newMinProfit && !isNaN(parseInt(newMinProfit))) {
      userConfig.jito.minProfit = parseInt(newMinProfit);
    } else {
      console.log("Invalid value. Keeping current min profit.");
    }
  } else if (settingChoice === "3") {
    // Modify tip configuration
    if (userConfig.jito.enabled) {
      console.log("\nSelect a Jito tip strategy option:");
      console.log(
        `1. Random strategy, from ${CONFIG.userConfig.jito.options.option1.from} to ${CONFIG.userConfig.jito.options.option1.to}, count ${CONFIG.userConfig.jito.options.option1.count}`
      );
      console.log(
        `2. Random strategy, from ${CONFIG.userConfig.jito.options.option2.from} to ${CONFIG.userConfig.jito.options.option2.to}, count ${CONFIG.userConfig.jito.options.option2.count}`
      );
      console.log(
        `3. Random strategy, from ${CONFIG.userConfig.jito.options.option3.from} to ${CONFIG.userConfig.jito.options.option3.to}, count ${CONFIG.userConfig.jito.options.option3.count}`
      );
      console.log("4. Custom values");

      const jitoOption = await question("Enter option number (1-4): ");

      if (jitoOption === "1") {
        userConfig.jito.selectedOption = {
          strategy: "Random",
          from: CONFIG.userConfig.jito.options.option1.from,
          to: CONFIG.userConfig.jito.options.option1.to,
          count: CONFIG.userConfig.jito.options.option1.count,
        };
      } else if (jitoOption === "2") {
        userConfig.jito.selectedOption = {
          strategy: "Random",
          from: CONFIG.userConfig.jito.options.option2.from,
          to: CONFIG.userConfig.jito.options.option2.to,
          count: CONFIG.userConfig.jito.options.option2.count,
        };
      } else if (jitoOption === "3") {
        userConfig.jito.selectedOption = {
          strategy: "Random",
          from: CONFIG.userConfig.jito.options.option3.from,
          to: CONFIG.userConfig.jito.options.option3.to,
          count: CONFIG.userConfig.jito.options.option3.count,
        };
      } else if (jitoOption === "4") {
        userConfig.jito.selectedOption.strategy = "Random";
        userConfig.jito.selectedOption.from = parseInt(
          await question('Enter "from" value: '),
          10
        );
        userConfig.jito.selectedOption.to = parseInt(
          await question('Enter "to" value: '),
          10
        );
        userConfig.jito.selectedOption.count = parseInt(
          await question('Enter "count" value: '),
          10
        );
      } else {
        console.log("Invalid option. Using current configuration.");
      }
    } else {
      console.log("Cannot modify tip configuration when Jito is disabled.");
    }
  } else if (settingChoice === "5") {
    return;
  } else {
    console.log("Invalid choice. No changes made.");
    return;
  }

  // Update TOML file with new settings
  let updatedContent = tomlContent;

  // Update jito.enabled
  const jitoEnabledString = `[jito]\nenabled = ${
    userConfig.jito.enabled ? "true" : "false"
  }`;
  if (jitoEnabledRegex.test(updatedContent)) {
    updatedContent = updatedContent.replace(
      jitoEnabledRegex,
      jitoEnabledString
    );
  }

  // Update min_profit
  if (minProfitMatch) {
    updatedContent = updatedContent.replace(
      /min_profit = \d+/,
      `min_profit = ${userConfig.jito.minProfit}`
    );
  } else {
    // Add min_profit after the enabled line
    updatedContent = updatedContent.replace(
      /\[jito\]\nenabled = (true|false)/,
      `[jito]\nenabled = ${
        userConfig.jito.enabled ? "true" : "false"
      }\nmin_profit = ${userConfig.jito.minProfit}`
    );
  }

  // Update jito.tip_config if jito is enabled
  if (userConfig.jito.enabled) {
    const selectedOption = userConfig.jito.selectedOption;
    const newJitoTipConfig = `[jito.tip_config]\nstrategy = "${selectedOption.strategy}"\nfrom = ${selectedOption.from}\nto = ${selectedOption.to}\ncount = ${selectedOption.count}`;

    if (jitoTipConfigRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(
        jitoTipConfigRegex,
        newJitoTipConfig
      );
    }
  }

  // Write the updated TOML file
  await writeTomlFile(CONFIG.tomlConfig.filePath, updatedContent);

  // Display updated settings
  console.log("\nJito settings updated successfully!");
  console.log("---------------------------------------");
  console.log(`Enabled: ${userConfig.jito.enabled ? "true" : "false"}`);
  console.log(`Min Profit: ${userConfig.jito.minProfit}`);

  if (userConfig.jito.enabled) {
    console.log("\nTip Configuration:");
    console.log(`Strategy: ${userConfig.jito.selectedOption.strategy}`);
    console.log(`From: ${userConfig.jito.selectedOption.from}`);
    console.log(`To: ${userConfig.jito.selectedOption.to}`);
    console.log(`Count: ${userConfig.jito.selectedOption.count}`);
  }
  console.log("---------------------------------------");

  // Ask if the user wants to modify more Jito settings
  const modifyMore = await question(
    "\nDo you want to modify more Jito settings? (yes/no): "
  );

  if (modifyMore.toLowerCase() === "yes" || modifyMore.toLowerCase() === "y") {
    // Call the function recursively to modify more settings
    return await modifyJitoSettings();
  }
}

// Function for option 5: Modify DEX pool quantities
async function modifyPoolQuantities() {
  console.log("\n=== Modify DEX Pool Quantities ===");

  // Display current settings in a table
  console.log("\nCurrent Pool Configuration:");
  console.log("---------------------------------------------------");
  console.log("| Index | DEX            | Pools | Priority Order |");
  console.log("---------------------------------------------------");

  // Create an array of all settings for easier indexing
  const poolSettings = [
    { name: "Total Max Pools", value: CONFIG.tomlConfig.maxPools, type: "max" },
  ];

  // Add DEX-specific settings
  CONFIG.tomlConfig.dexPriority.forEach((dex, index) => {
    const quantity = CONFIG.tomlConfig.maxPoolsPerDex[dex] || 0;
    const dexName = dex.charAt(0).toUpperCase() + dex.slice(1); // Capitalize first letter
    poolSettings.push({
      name: dexName,
      value: quantity,
      dexId: dex,
      priority: index + 1,
      type: "dex",
    });
  });

  // Display the settings in a table
  poolSettings.forEach((setting, index) => {
    if (setting.type === "max") {
      console.log(
        `| ${(index + 1).toString().padStart(5)} | ${"Total Max Pools".padEnd(
          14
        )} | ${setting.value.toString().padEnd(5)} | ${"N/A".padEnd(14)} |`
      );
    } else {
      console.log(
        `| ${(index + 1).toString().padStart(5)} | ${setting.name.padEnd(
          14
        )} | ${setting.value.toString().padEnd(5)} | ${setting.priority
          .toString()
          .padEnd(14)} |`
      );
    }
  });

  console.log("---------------------------------------------------");

  // Ask if user wants to modify the settings
  const modifySettings = await question(
    "\nDo you want to modify these settings? (yes/no): "
  );

  if (
    modifySettings.toLowerCase() === "yes" ||
    modifySettings.toLowerCase() === "y"
  ) {
    // Ask which setting to modify
    const settingIndex = await question(
      "Enter index of setting to modify (or 'p' to modify priority order): "
    );

    if (settingIndex.toLowerCase() === "p") {
      // Modify priority order
      console.log(
        "\nCurrent priority order: " + CONFIG.tomlConfig.dexPriority.join(", ")
      );

      // Show current order in a table
      console.log("\n---------------------------");
      console.log("| Index | DEX            |");
      console.log("---------------------------");
      CONFIG.tomlConfig.dexPriority.forEach((dex, index) => {
        const dexName = dex.charAt(0).toUpperCase() + dex.slice(1); // Capitalize first letter
        console.log(
          `| ${(index + 1).toString().padStart(5)} | ${dexName.padEnd(14)} |`
        );
      });
      console.log("---------------------------");

      // Allow user to rearrange priority by swapping positions
      let modifyingPriority = true;
      while (modifyingPriority) {
        console.log(
          "\nTo swap positions, enter two indices separated by comma (e.g., '1,3')"
        );
        console.log("To finish modifying priority, enter 'done'");

        const priorityInput = await question("Enter swap indices or 'done': ");

        if (priorityInput.toLowerCase() === "done") {
          modifyingPriority = false;
        } else {
          const indices = priorityInput
            .split(",")
            .map((i) => parseInt(i.trim()) - 1);

          if (
            indices.length === 2 &&
            !isNaN(indices[0]) &&
            !isNaN(indices[1]) &&
            indices[0] >= 0 &&
            indices[0] < CONFIG.tomlConfig.dexPriority.length &&
            indices[1] >= 0 &&
            indices[1] < CONFIG.tomlConfig.dexPriority.length
          ) {
            // Swap the DEXes in priority array
            const temp = CONFIG.tomlConfig.dexPriority[indices[0]];
            CONFIG.tomlConfig.dexPriority[indices[0]] =
              CONFIG.tomlConfig.dexPriority[indices[1]];
            CONFIG.tomlConfig.dexPriority[indices[1]] = temp;

            // Display the updated order
            console.log("\nUpdated priority order:");
            console.log("---------------------------");
            console.log("| Index | DEX            |");
            console.log("---------------------------");
            CONFIG.tomlConfig.dexPriority.forEach((dex, index) => {
              const dexName = dex.charAt(0).toUpperCase() + dex.slice(1); // Capitalize first letter
              console.log(
                `| ${(index + 1).toString().padStart(5)} | ${dexName.padEnd(
                  14
                )} |`
              );
            });
            console.log("---------------------------");
          } else {
            console.log("Invalid indices. Please enter two valid indices.");
          }
        }
      }
    } else {
      // Modify pool quantity
      const index = parseInt(settingIndex) - 1;

      if (!isNaN(index) && index >= 0 && index < poolSettings.length) {
        const setting = poolSettings[index];

        const newValue = await question(
          `Enter new value for ${setting.name} (current: ${setting.value}): `
        );

        if (newValue && !isNaN(parseInt(newValue))) {
          const value = parseInt(newValue);

          if (setting.type === "max") {
            CONFIG.tomlConfig.maxPools = value;
          } else if (setting.type === "dex") {
            CONFIG.tomlConfig.maxPoolsPerDex[setting.dexId] = value;
          }

          console.log(`Updated ${setting.name} to ${value}`);
        } else {
          console.log("Invalid value. No changes made.");
        }
      } else {
        console.log("Invalid index. No changes made.");
      }

      // Ask if the user wants to modify more settings
      const modifyMore = await question(
        "\nDo you want to modify more settings? (yes/no): "
      );

      if (
        modifyMore.toLowerCase() === "yes" ||
        modifyMore.toLowerCase() === "y"
      ) {
        // Call the function recursively to modify more settings
        return await modifyPoolQuantities();
      }
    }

    // Display updated settings
    console.log("\nUpdated Pool Configuration:");
    console.log("---------------------------------------------------");
    console.log("| Index | DEX            | Pools | Priority Order |");
    console.log("---------------------------------------------------");

    // Rebuild the settings array with updated values
    const updatedSettings = [
      {
        name: "Total Max Pools",
        value: CONFIG.tomlConfig.maxPools,
        type: "max",
      },
    ];

    CONFIG.tomlConfig.dexPriority.forEach((dex, index) => {
      const quantity = CONFIG.tomlConfig.maxPoolsPerDex[dex] || 0;
      const dexName = dex.charAt(0).toUpperCase() + dex.slice(1);
      updatedSettings.push({
        name: dexName,
        value: quantity,
        dexId: dex,
        priority: index + 1,
        type: "dex",
      });
    });

    updatedSettings.forEach((setting, index) => {
      if (setting.type === "max") {
        console.log(
          `| ${(index + 1).toString().padStart(5)} | ${"Total Max Pools".padEnd(
            14
          )} | ${setting.value.toString().padEnd(5)} | ${"N/A".padEnd(14)} |`
        );
      } else {
        console.log(
          `| ${(index + 1).toString().padStart(5)} | ${setting.name.padEnd(
            14
          )} | ${setting.value.toString().padEnd(5)} | ${setting.priority
            .toString()
            .padEnd(14)} |`
        );
      }
    });

    console.log("---------------------------------------------------");
    console.log("\nPool quantity settings updated successfully!");
    console.log("These settings will be applied for future token searches.");
  }
}

// Function for option 6: Modify Base Mint
async function modifyBaseMint() {
  console.log("\n=== Modify Base Mint ===");

  // Read the TOML file
  const tomlContent = await readTomlFile(CONFIG.tomlConfig.filePath);

  // Extract current base_mint setting
  const baseMintRegex = /\[bot\][^\[]*base_mint\s*=\s*"([^"]+)"/s;
  const baseMintMatch = tomlContent.match(baseMintRegex);

  const currentBaseMint = baseMintMatch
    ? baseMintMatch[1]
    : "So11111111111111111111111111111111111111112";

  // Display current setting
  console.log("\nCurrent Base Mint Setting:");
  console.log("-----------------------------------------------");
  console.log(`Base Mint: ${currentBaseMint}`);
  console.log("Default: So11111111111111111111111111111111111111112 (SOL)");
  console.log(
    "Common alternatives: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)"
  );
  console.log("-----------------------------------------------");

  // Ask if user wants to change the base mint
  const modifyBaseMint = await question(
    "\nDo you want to modify the base mint? (yes/no): "
  );

  if (
    modifyBaseMint.toLowerCase() === "yes" ||
    modifyBaseMint.toLowerCase() === "y"
  ) {
    // Display common options
    console.log("\nCommon base mint options:");
    console.log("1. SOL (So11111111111111111111111111111111111111112)");
    console.log("2. USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)");
    console.log("3. Custom address");

    const baseMintOption = await question("Select an option (1-3): ");

    let newBaseMint = currentBaseMint;

    if (baseMintOption === "1") {
      newBaseMint = "So11111111111111111111111111111111111111112";
    } else if (baseMintOption === "2") {
      newBaseMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    } else if (baseMintOption === "3") {
      const customAddress = await question("Enter custom base mint address: ");
      if (customAddress.trim()) {
        newBaseMint = customAddress.trim();
      } else {
        console.log("No address provided. Keeping current base mint.");
      }
    } else {
      console.log("Invalid option. Keeping current base mint.");
    }

    // Update the base mint in the TOML file
    let updatedContent = tomlContent;

    // Check if [bot] section exists in the file
    const botSectionRegex = /\[bot\][^\[]*(?=\[|$)/s;
    const botSectionMatch = tomlContent.match(botSectionRegex);

    if (botSectionMatch) {
      const botSection = botSectionMatch[0];

      // Check if base_mint is already in the file
      if (baseMintMatch) {
        // Replace the existing base_mint value
        const newBotSection = botSection.replace(
          /base_mint\s*=\s*"([^"]+)"/,
          `base_mint = "${newBaseMint}"`
        );
        updatedContent = tomlContent.replace(botSectionRegex, newBotSection);
      } else {
        // Add base_mint to the [bot] section
        const newBotSection = botSection.replace(
          /\[bot\]/,
          `[bot]\nbase_mint = "${newBaseMint}"`
        );
        updatedContent = tomlContent.replace(botSectionRegex, newBotSection);
      }
    } else {
      console.log("Error: [bot] section not found in the TOML file.");
      return;
    }

    // Write the updated TOML file
    await writeTomlFile(CONFIG.tomlConfig.filePath, updatedContent);

    console.log(`\nBase mint updated successfully to: ${newBaseMint}`);
  }
}

// Function to make API request for a specific page
async function searchPoolsPage(query, page = 1) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.geckoterminal.com",
      path: `/api/v2/search/pools?query=${encodeURIComponent(
        query
      )}&include=base_token,quote_token,dex&page=${page}`,
      method: "GET",
      headers: {
        accept: "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject("Error parsing JSON: " + e.message);
        }
      });
    });

    req.on("error", (error) => {
      reject("Error making request: " + error.message);
    });

    req.end();
  });
}

// Function to search pools across multiple pages
async function searchAllPools(query, maxPages = CONFIG.maxPages) {
  console.log(
    `Searching for pools with query: ${query} (fetching up to ${maxPages} pages)...`
  );

  let allData = { data: [], included: [] };
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages && currentPage <= maxPages) {
    try {
      console.log(`Fetching page ${currentPage}...`);
      const pageData = await searchPoolsPage(query, currentPage);

      if (pageData.data && pageData.data.length > 0) {
        // Merge data and included arrays
        allData.data = [...allData.data, ...pageData.data];

        if (pageData.included) {
          // Deduplicate included items by ID
          const includedMap = new Map(
            allData.included.map((item) => [item.id, item])
          );
          pageData.included.forEach((item) => includedMap.set(item.id, item));
          allData.included = Array.from(includedMap.values());
        }

        currentPage++;

        // Add delay between requests if there are more pages to fetch
        if (currentPage <= maxPages && pageData.data.length > 0) {
          console.log(
            `Waiting ${CONFIG.pageRequestDelay}ms before next request...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.pageRequestDelay)
          );
        }
      } else {
        hasMorePages = false;
        console.log("No more results found.");
      }
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      hasMorePages = false;
    }
  }

  return allData;
}

// Function to filter pools by DEX and tokens (updated version)
function filterPools(data) {
  let filteredData = { ...data };
  let filteredPools = [...data.data];

  // Apply DEX filters if needed
  const dexFilters = Object.keys(CONFIG.dexFilters).filter(
    (dex) => CONFIG.dexFilters[dex]
  );
  if (dexFilters.length > 0) {
    filteredPools = filteredPools.filter((pool) => {
      const dexId = pool.relationships.dex.data.id;
      return dexFilters.includes(dexId);
    });
  }

  // Apply token filters if needed
  if (CONFIG.tokenFilters.requireSpecificToken) {
    const selectedTokenId =
      CONFIG.tokenFilters.tokenIds[CONFIG.tokenFilters.selectedTokenType];

    filteredPools = filteredPools.filter((pool) => {
      const baseTokenId = pool.relationships.base_token.data.id;
      const quoteTokenId = pool.relationships.quote_token.data.id;

      // Check if either the base or quote token matches the selected token
      return (
        baseTokenId === selectedTokenId || quoteTokenId === selectedTokenId
      );
    });
  }

  filteredData.data = filteredPools;
  return filteredData;
}

// Function to sort pools by volume or price
function sortPools(
  data,
  sortBy = CONFIG.sortBy,
  volumePeriod = CONFIG.volumePeriod
) {
  const pools = [...data.data];

  if (sortBy === "volume") {
    pools.sort((a, b) => {
      const volumeA = parseFloat(a.attributes.volume_usd[volumePeriod] || "0");
      const volumeB = parseFloat(b.attributes.volume_usd[volumePeriod] || "0");
      return volumeB - volumeA;
    });
  } else if (sortBy === "price") {
    pools.sort((a, b) => {
      const priceA = parseFloat(a.attributes.base_token_price_usd || "0");
      const priceB = parseFloat(b.attributes.base_token_price_usd || "0");
      return priceB - priceA;
    });
  }

  return pools;
}

// Function to group pools by DEX
// Function to group pools by DEX
function groupPoolsByDex(pools) {
  const groupedPools = {};

  // Initialize with DEXes from dexPriority
  CONFIG.tomlConfig.dexPriority.forEach((dex) => {
    groupedPools[dex] = [];
  });

  // Process each pool
  pools.forEach((pool) => {
    const dexId = pool.relationships.dex.data.id;

    // Create entry for this DEX if it doesn't exist yet (handles DEXes in filters but not in priority)
    if (!groupedPools[dexId] && CONFIG.dexFilters[dexId]) {
      groupedPools[dexId] = [];

      // If this DEX is not in the priority list but should be included, add it to the priority list
      if (!CONFIG.tomlConfig.dexPriority.includes(dexId)) {
        console.log(
          `Adding DEX ${dexId} to priority list (found in pool but not in config)`
        );
        CONFIG.tomlConfig.dexPriority.push(dexId);

        // Also add to maxPoolsPerDex with a default value of 1
        if (!CONFIG.tomlConfig.maxPoolsPerDex[dexId]) {
          CONFIG.tomlConfig.maxPoolsPerDex[dexId] = 1;
          console.log(`Added ${dexId} to maxPoolsPerDex with default value 1`);
        }

        // If it's Orca specifically, set the field name mapping
        if (dexId === "orca" && !CONFIG.tomlConfig.dexToFieldName[dexId]) {
          CONFIG.tomlConfig.dexToFieldName[dexId] = "whirlpool_pool_list";
          console.log(
            `Set field name mapping for ${dexId}: whirlpool_pool_list`
          );
        }
      }
    }

    // Add the pool to its DEX group if we're tracking that DEX
    if (groupedPools[dexId]) {
      groupedPools[dexId].push(pool);
    }
  });

  // Log the grouped pools for debugging
  console.log("\nGrouped pools by DEX:");
  for (const dex in groupedPools) {
    console.log(`${dex}: ${groupedPools[dex].length} pools`);
    if (groupedPools[dex].length > 0) {
      const pool = groupedPools[dex][0];
      console.log(`  Top pool: ${pool.attributes.name}`);
      console.log(`  Address: ${pool.attributes.address}`);
      console.log(
        `  24h Volume: ${formatCurrency(
          parseFloat(pool.attributes.volume_usd.h24 || "0")
        )}`
      );
    }
  }

  return groupedPools;
}

// Function to select top pools based on priority and limits
// function selectTopPools(groupedPools) {
//   const selectedPools = {};
//   let totalSelectedPools = 0;

//   // Select pools in priority order
//   for (const dex of CONFIG.tomlConfig.dexPriority) {
//     const poolsForDex = groupedPools[dex] || [];
//     const maxPoolsForDex = CONFIG.tomlConfig.maxPoolsPerDex[dex] || 0;

//     // Skip if no pools should be selected for this DEX
//     if (maxPoolsForDex === 0) {
//       continue;
//     }

//     // Select top pools for this DEX
//     const topPoolsForDex = poolsForDex.slice(0, maxPoolsForDex);

//     if (topPoolsForDex.length > 0) {
//       selectedPools[dex] = topPoolsForDex;
//       totalSelectedPools += topPoolsForDex.length;
//     }

//     // Stop if we've reached the maximum number of pools
//     if (totalSelectedPools >= CONFIG.tomlConfig.maxPools) {
//       break;
//     }
//   }

//   return { selectedPools, totalSelectedPools };
// }

// Function to select top pools based on priority and limits
function selectTopPools(groupedPools) {
  const selectedPools = {};
  let totalSelectedPools = 0;

  // Log the current configuration for debugging
  console.log("\nCurrent DEX Priority:", CONFIG.tomlConfig.dexPriority);
  console.log("Current Max Pools Per DEX:", CONFIG.tomlConfig.maxPoolsPerDex);

  // Ensure all DEXes with pools are properly configured
  for (const dex in groupedPools) {
    if (groupedPools[dex].length > 0) {
      // Make sure it's in maxPoolsPerDex
      if (
        !CONFIG.tomlConfig.maxPoolsPerDex[dex] &&
        CONFIG.tomlConfig.maxPoolsPerDex[dex] !== 0
      ) {
        CONFIG.tomlConfig.maxPoolsPerDex[dex] = 1;
        console.log(`Set maxPoolsPerDex for ${dex} to 1`);
      }

      // Make sure it's in dexPriority
      if (!CONFIG.tomlConfig.dexPriority.includes(dex)) {
        CONFIG.tomlConfig.dexPriority.push(dex);
        console.log(`Added ${dex} to dexPriority`);
      }

      // Make sure it has a field name mapping
      if (!CONFIG.tomlConfig.dexToFieldName[dex]) {
        if (dex === "orca") {
          CONFIG.tomlConfig.dexToFieldName[dex] = "whirlpool_pool_list";
        } else {
          CONFIG.tomlConfig.dexToFieldName[dex] = `${dex}_pool_list`;
        }
        console.log(
          `Set dexToFieldName for ${dex} to ${CONFIG.tomlConfig.dexToFieldName[dex]}`
        );
      }
    }
  }

  console.log("\nUpdated DEX Priority:", CONFIG.tomlConfig.dexPriority);
  console.log("Updated Max Pools Per DEX:", CONFIG.tomlConfig.maxPoolsPerDex);

  // Select pools in priority order
  for (const dex of CONFIG.tomlConfig.dexPriority) {
    const poolsForDex = groupedPools[dex] || [];
    const maxPoolsForDex = CONFIG.tomlConfig.maxPoolsPerDex[dex] || 0;

    // Skip if no pools should be selected for this DEX
    if (maxPoolsForDex === 0) {
      console.log(`Skipping ${dex} (max pools = 0)`);
      continue;
    }

    // Select top pools for this DEX
    const topPoolsForDex = poolsForDex.slice(0, maxPoolsForDex);

    if (topPoolsForDex.length > 0) {
      selectedPools[dex] = topPoolsForDex;
      totalSelectedPools += topPoolsForDex.length;
      console.log(`Selected ${topPoolsForDex.length} pools for ${dex}`);

      // Print the top pool for this DEX
      if (topPoolsForDex.length > 0) {
        const pool = topPoolsForDex[0];
        console.log(`  Top pool: ${pool.attributes.name}`);
        console.log(`  Address: ${pool.attributes.address}`);
        console.log(
          `  24h Volume: ${formatCurrency(
            parseFloat(pool.attributes.volume_usd.h24 || "0")
          )}`
        );
      }
    }

    // Stop if we've reached the maximum number of pools
    if (totalSelectedPools >= CONFIG.tomlConfig.maxPools) {
      console.log(
        `Reached maximum total pools (${CONFIG.tomlConfig.maxPools})`
      );
      break;
    }
  }

  return { selectedPools, totalSelectedPools };
}

// Function to read the TOML file
async function readTomlFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist, create a basic template
      const templateContent = `[routing]

[rpc]
url = "http://5.39.216.200:8899"

[spam]
enabled = true
sending_rpc_urls = [
  "http://rpc-ams.thornode.io",
]
compute_unit_price = { strategy = "Random", from = 28311, to = 488111, count = 1 }
skip_preflight = true

[jito]
enabled = false
block_engine_urls = [
  "https://ny.mainnet.block-engine.jito.wtf/api/v1",
  "https://slc.mainnet.block-engine.jito.wtf/api/v1",
  "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1",
  "https://london.mainnet.block-engine.jito.wtf/api/v1",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1",
  "https://mainnet.block-engine.jito.wtf/api/v1",
]
# ip_addresses = ["156.229.120.0/24"]
#min_profit = 17000
uuid = ""
no_failure_mode = false
use_separate_tip_account = true
block_engine_strategy = "OneByOne"

[jito.tip_config]
strategy = "Random"
from = 6000
to = 500500
count = 4

[kamino_flashloan]
enabled = false

[bot]
base_mint = "So11111111111111111111111111111111111111112" # Optional, default to SOL
compute_unit_limit = 438_000
merge_mints = false

[wallet]
`;
      return templateContent;
    }
    throw new Error("Error reading TOML file: " + err.message);
  }
}

// Function to extract existing tokens from TOML file
function extractExistingTokens(tomlContent) {
  const tokens = [];
  const mintSectionRegex =
    /\[\[routing\.mint_config_list\]\][^[]*mint = "([^"]+)"/g;

  let match;
  while ((match = mintSectionRegex.exec(tomlContent)) !== null) {
    tokens.push(match[1]);
  }

  return tokens;
}

// Function to update the TOML file with selected pools
async function updateTomlFile(
  tomlContent,
  tokenAddress,
  selectedPools,
  userConfig
) {
  let updatedContent = tomlContent;

  // Regular expression to find the mint_config_list section for this token
  const mintSectionRegex = new RegExp(
    `\\[\\[routing\\.mint_config_list\\]\\][\\s\\S]*?mint = "${tokenAddress}"[\\s\\S]*?(?=\\[\\[routing\\.mint_config_list\\]\\]|$)`,
    "i"
  );

  // Check if we have a section for this token
  const mintSection = updatedContent.match(mintSectionRegex);

  if (mintSection) {
    let newMintSection = mintSection[0];

    // Update each DEX pool list
    for (const dex of Object.keys(CONFIG.tomlConfig.dexToFieldName)) {
      const fieldName = CONFIG.tomlConfig.dexToFieldName[dex];
      const poolsForDex = selectedPools[dex] || [];

      // Regular expression to find the existing pool list for this DEX
      const poolListRegex = new RegExp(`${fieldName} = \\[[\\s\\S]*?\\]`, "i");
      const commentedPoolListRegex = new RegExp(
        `#${fieldName} = \\[[\\s\\S]*?\\]`,
        "i"
      );

      if (poolsForDex.length > 0) {
        // Format the new pool list
        const poolAddresses = poolsForDex
          .map((pool) => ` "${pool.attributes.address}",`)
          .join("\n");
        const newPoolList = `${fieldName} = [\n${poolAddresses}\n]`;

        // Check if the pool list already exists (uncommented)
        if (poolListRegex.test(newMintSection)) {
          // Replace the existing pool list
          newMintSection = newMintSection.replace(poolListRegex, newPoolList);
        }
        // Check if the pool list exists but is commented out
        else if (commentedPoolListRegex.test(newMintSection)) {
          // Uncomment and replace the existing pool list
          newMintSection = newMintSection.replace(
            commentedPoolListRegex,
            newPoolList
          );
        }
        // Otherwise, add the pool list after the mint line
        else {
          const mintLineRegex = new RegExp(`mint = "${tokenAddress}"`, "i");
          newMintSection = newMintSection.replace(
            mintLineRegex,
            `mint = "${tokenAddress}"\n${newPoolList}`
          );
        }
      } else {
        // If we don't have pools for this DEX, comment out the section if it exists
        if (poolListRegex.test(newMintSection)) {
          // Comment out the existing pool list
          newMintSection = newMintSection.replace(
            poolListRegex,
            (match) => `#${match}`
          );
        }
      }
    }

    // Update lookup table accounts
    const lookupTableRegex = /lookup_table_accounts = \[[\s\S]*?\]/i;
    const lookupTableList = userConfig.lookupTableAccounts.default
      .concat(userConfig.lookupTableAccounts.custom)
      .map((account) => `  "${account}",`)
      .join("\n");
    const newLookupTable = `lookup_table_accounts = [\n${lookupTableList}\n]`;

    if (lookupTableRegex.test(newMintSection)) {
      newMintSection = newMintSection.replace(lookupTableRegex, newLookupTable);
    } else {
      // Add lookup table after a pool list or the mint line
      const mintLineRegex = new RegExp(`mint = "${tokenAddress}"`, "i");
      newMintSection = newMintSection.replace(
        mintLineRegex,
        `mint = "${tokenAddress}"\n${newLookupTable}`
      );
    }

    // Update process_delay
    const processDelayRegex = /process_delay = \d+/i;
    const newProcessDelay = `process_delay = 400`;

    if (processDelayRegex.test(newMintSection)) {
      newMintSection = newMintSection.replace(
        processDelayRegex,
        newProcessDelay
      );
    } else {
      // Add process delay after lookup table or a pool list or the mint line
      if (lookupTableRegex.test(newMintSection)) {
        const lookupTableMatch = newMintSection.match(lookupTableRegex);
        if (lookupTableMatch) {
          newMintSection = newMintSection.replace(
            lookupTableMatch[0],
            `${lookupTableMatch[0]}\n${newProcessDelay}`
          );
        }
      } else {
        const mintLineRegex = new RegExp(`mint = "${tokenAddress}"`, "i");
        newMintSection = newMintSection.replace(
          mintLineRegex,
          `mint = "${tokenAddress}"\n${newProcessDelay}`
        );
      }
    }

    // Replace the old mint section with the updated one
    updatedContent = updatedContent.replace(mintSectionRegex, newMintSection);
  } else {
    // If we don't have a section for this token, create a new one
    let newMintSection = `[[routing.mint_config_list]]\nmint = "${tokenAddress}"\n`;

    // Add each DEX pool list
    for (const dex of Object.keys(CONFIG.tomlConfig.dexToFieldName)) {
      const fieldName = CONFIG.tomlConfig.dexToFieldName[dex];
      const poolsForDex = selectedPools[dex] || [];

      if (poolsForDex.length > 0) {
        // Format the new pool list
        const poolAddresses = poolsForDex
          .map((pool) => ` "${pool.attributes.address}",`)
          .join("\n");
        newMintSection += `${fieldName} = [\n${poolAddresses}\n]\n`;
      } else {
        newMintSection += `#${fieldName} = [\n#  "example_address",\n#]\n`;
      }
    }

    // Add lookup_table_accounts
    const lookupTableList = userConfig.lookupTableAccounts.default
      .concat(userConfig.lookupTableAccounts.custom)
      .map((account) => `  "${account}",`)
      .join("\n");
    newMintSection += `lookup_table_accounts = [\n${lookupTableList}\n]\n`;

    // Add process_delay
    newMintSection += `process_delay = 400\n\n`;

    // Add the new mint section right after the [routing] line
    const routingRegex = /\[routing\]\n/i;
    updatedContent = updatedContent.replace(
      routingRegex,
      `[routing]\n${newMintSection}`
    );
  }

  // Update jito.enabled
  const jitoEnabledRegex = /\[jito\]\nenabled = (true|false)/i;
  const newJitoEnabled = `[jito]\nenabled = ${
    userConfig.jito.enabled ? "true" : "false"
  }`;

  updatedContent = updatedContent.replace(jitoEnabledRegex, newJitoEnabled);

  // Update jito.tip_config if jito is enabled
  if (userConfig.jito.enabled) {
    const jitoTipConfigRegex =
      /\[jito\.tip_config\]\nstrategy = "[^"]+"\nfrom = \d+\nto = \d+\ncount = \d+/i;
    const selectedOption = userConfig.jito.selectedOption;
    const newJitoTipConfig = `[jito.tip_config]\nstrategy = "${selectedOption.strategy}"\nfrom = ${selectedOption.from}\nto = ${selectedOption.to}\ncount = ${selectedOption.count}`;

    updatedContent = updatedContent.replace(
      jitoTipConfigRegex,
      newJitoTipConfig
    );
  }

  // Update spam.enabled
  const spamEnabledRegex = /\[spam\]\nenabled = (true|false)/i;
  const newSpamEnabled = `[spam]\nenabled = ${
    userConfig.spam.enabled ? "true" : "false"
  }`;

  updatedContent = updatedContent.replace(spamEnabledRegex, newSpamEnabled);

  // Update compute_unit_price if spam is enabled
  if (userConfig.spam.enabled) {
    const computeUnitPriceRegex =
      /compute_unit_price = \{ strategy = "[^"]+", from = \d+, to = \d+, count = \d+ \}/i;
    const selectedOption = userConfig.spam.selectedOption;
    const newComputeUnitPrice = `compute_unit_price = { strategy = "${selectedOption.strategy}", from = ${selectedOption.from}, to = ${selectedOption.to}, count = ${selectedOption.count} }`;

    updatedContent = updatedContent.replace(
      computeUnitPriceRegex,
      newComputeUnitPrice
    );
  }

  // Get existing tokens and add the current one if not already present
  const existingTokens = extractExistingTokens(updatedContent);
  if (!existingTokens.includes(tokenAddress)) {
    existingTokens.push(tokenAddress);
  }

  // Update merge_mints based on the number of tokens
  const mergeMintValue = existingTokens.length > 1 ? "true" : "false";
  const mergeMintRegex = /merge_mints = (true|false)/i;
  const newMergeMint = `merge_mints = ${mergeMintValue}`;

  updatedContent = updatedContent.replace(mergeMintRegex, newMergeMint);

  return {
    updatedContent,
    tokenCount: existingTokens.length,
  };
}

// Function to write the updated TOML file
async function writeTomlFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content, "utf8");
    return `TOML file updated successfully: ${filePath}`;
  } catch (err) {
    throw new Error("Error writing TOML file: " + err.message);
  }
}

// Format currency values
function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Function to find DEX name from included data
function getDexName(dexId, included) {
  const dex = included.find((item) => item.id === dexId && item.type === "dex");
  return dex ? dex.attributes.name : dexId;
}

// Function to get user configuration choices
async function getUserConfig() {
  const userConfig = {
    jito: {
      enabled: false,
      selectedOption: null,
    },
    spam: {
      enabled: false,
      selectedOption: null,
    },
    lookupTableAccounts: {
      default: CONFIG.userConfig.lookupTableAccounts.default,
      custom: [],
    },
  };

  console.log("\n=== Jito Configuration ===");
  const jitoEnabled = await question("Do you want to enable Jito? (yes/no): ");
  userConfig.jito.enabled =
    jitoEnabled.toLowerCase() === "yes" || jitoEnabled.toLowerCase() === "y";

  if (userConfig.jito.enabled) {
    console.log("\nSelect a Jito tip strategy option:");
    console.log(
      `1. Random strategy, from ${CONFIG.userConfig.jito.options.option1.from} to ${CONFIG.userConfig.jito.options.option1.to}, count ${CONFIG.userConfig.jito.options.option1.count}`
    );
    console.log(
      `2. Random strategy, from ${CONFIG.userConfig.jito.options.option2.from} to ${CONFIG.userConfig.jito.options.option2.to}, count ${CONFIG.userConfig.jito.options.option2.count}`
    );
    console.log(
      `3. Random strategy, from ${CONFIG.userConfig.jito.options.option3.from} to ${CONFIG.userConfig.jito.options.option3.to}, count ${CONFIG.userConfig.jito.options.option3.count}`
    );
    console.log("4. Custom values");

    const jitoOption = await question("Enter option number (1-4): ");

    if (jitoOption === "1") {
      userConfig.jito.selectedOption = {
        ...CONFIG.userConfig.jito.options.option1,
      };
    } else if (jitoOption === "2") {
      userConfig.jito.selectedOption = {
        ...CONFIG.userConfig.jito.options.option2,
      };
    } else if (jitoOption === "3") {
      userConfig.jito.selectedOption = {
        strategy: "Random",
        from: userConfig.jito.options.option3.from,
        to: userConfig.jito.options.option3.to,
        count: userConfig.jito.options.option3.count,
      };
    } else if (jitoOption === "4") {
      userConfig.jito.selectedOption = {
        strategy: "Random",
        from: parseInt(await question('Enter "from" value: '), 10),
        to: parseInt(await question('Enter "to" value: '), 10),
        count: parseInt(await question('Enter "count" value: '), 10) || 1,
      };
    } else {
      console.log("Invalid option. Using option 1 as default.");
      userConfig.jito.selectedOption = {
        ...CONFIG.userConfig.jito.options.option1,
      };
    }
  }

  console.log("\n=== Spam Configuration ===");
  const spamEnabled = await question("Do you want to enable spam? (yes/no): ");
  userConfig.spam.enabled =
    spamEnabled.toLowerCase() === "yes" || spamEnabled.toLowerCase() === "y";

  if (userConfig.spam.enabled) {
    console.log("\nSelect a compute unit price strategy option:");
    console.log("1. Random strategy, from 28311 to 488111, count 1");
    console.log("2. Random strategy, from 218311 to 588111, count 1");
    console.log("3. Custom values");

    const spamOption = await question("Enter option number (1-3): ");

    if (spamOption === "1") {
      userConfig.spam.selectedOption = {
        ...CONFIG.userConfig.spam.options.option1,
      };
    } else if (spamOption === "2") {
      userConfig.spam.selectedOption = {
        ...CONFIG.userConfig.spam.options.option2,
      };
    } else if (spamOption === "3") {
      userConfig.spam.selectedOption = { strategy: "Random" };
      userConfig.spam.selectedOption.from = parseInt(
        await question('Enter "from" value: '),
        10
      );
      userConfig.spam.selectedOption.to = parseInt(
        await question('Enter "to" value: '),
        10
      );
      userConfig.spam.selectedOption.count =
        parseInt(await question('Enter "count" value: '), 10) || 1;
    } else {
      console.log("Invalid option. Using option 1 as default.");
      userConfig.spam.selectedOption = {
        ...CONFIG.userConfig.spam.options.option1,
      };
    }
  }

  console.log("\n=== Lookup Table Accounts Configuration ===");
  console.log(
    `Default accounts: ${userConfig.lookupTableAccounts.default.join(", ")}`
  );
  const addCustomAccounts = await question(
    "Do you want to add custom lookup table accounts? (yes/no): "
  );

  if (
    addCustomAccounts.toLowerCase() === "yes" ||
    addCustomAccounts.toLowerCase() === "y"
  ) {
    const customAccountsInput = await question(
      "Enter comma-separated account addresses: "
    );
    if (customAccountsInput.trim()) {
      userConfig.lookupTableAccounts.custom = customAccountsInput
        .split(",")
        .map((addr) => addr.trim());
    }
  }

  return userConfig;
}

// Function to process a single token
async function processToken(tokenAddress) {
  // Search for pools across multiple pages
  const allData = await searchAllPools(tokenAddress);

  // Filter pools by DEX and tokens
  const filteredData = filterPools(allData);

  // Get token info
  let tokenSymbol = "Unknown";
  if (filteredData.data.length > 0) {
    const baseTokenId = filteredData.data[0].relationships.base_token.data.id;
    const baseToken = filteredData.included.find(
      (item) => item.id === baseTokenId && item.type === "token"
    );
    if (baseToken) {
      tokenSymbol = baseToken.attributes.symbol;
    }
  }

  // Display filter information
  let filterInfo = [];
  if (Object.keys(CONFIG.dexFilters).some((dex) => CONFIG.dexFilters[dex])) {
    const activeDexes = Object.keys(CONFIG.dexFilters).filter(
      (dex) => CONFIG.dexFilters[dex]
    );
    filterInfo.push(`DEX filters: ${activeDexes.join(", ")}`);
  }

  if (CONFIG.tokenFilters.requireSol) {
    filterInfo.push("Only showing pools with SOL as base or quote token");
  }

  const filterInfoText =
    filterInfo.length > 0 ? ` (${filterInfo.join("; ")})` : "";

  const poolCount = filteredData.data ? filteredData.data.length : 0;
  console.log(
    `\nFound ${poolCount} pools for token ${tokenSymbol} (${tokenAddress}) across ${
      filteredData.data.length > 0
        ? Math.min(
            CONFIG.maxPages,
            Math.ceil(
              filteredData.data.length / (allData.data.length / CONFIG.maxPages)
            )
          )
        : 0
    } pages${filterInfoText}`
  );

  if (poolCount === 0) {
    console.error(
      "\nERROR: No pools found for this token. Please check the token address and try again."
    );
    return null;
  }

  // Sort pools by volume
  const sortedPools = sortPools(filteredData);

  // Group pools by DEX
  const groupedPools = groupPoolsByDex(sortedPools);

  // Select top pools based on priority and limits
  const { selectedPools, totalSelectedPools } = selectTopPools(groupedPools);

  if (totalSelectedPools < 2) {
    console.error(
      "\nERROR: Not enough valid pools found. At least 2 pools are required for the TOML configuration."
    );

    // Display available pools for debugging
    console.log("\nAvailable pools:");
    sortedPools.forEach((pool, index) => {
      const attr = pool.attributes;
      const dexId = pool.relationships.dex.data.id;
      const dexName = getDexName(dexId, filteredData.included);

      console.log(`${index + 1}. ${attr.name} on ${dexName}`);
      console.log(`   Pool address: ${attr.address}`);
      console.log(
        `   24h Volume: ${formatCurrency(
          parseFloat(attr.volume_usd.h24 || "0")
        )}`
      );
    });

    return null;
  }

  // Display selected pools
  console.log("\nSelected pools for TOML config:");

  Object.keys(selectedPools).forEach((dex) => {
    console.log(`\n${getDexName(dex, filteredData.included)} pools:`);

    selectedPools[dex].forEach((pool, index) => {
      const attr = pool.attributes;
      console.log(`${index + 1}. ${attr.name}`);
      console.log(`   Pool address: ${attr.address}`);
      console.log(
        `   24h Volume: ${formatCurrency(
          parseFloat(attr.volume_usd.h24 || "0")
        )}`
      );
    });
  });

  return {
    tokenAddress,
    tokenSymbol,
    selectedPools,
    totalSelectedPools,
    filteredData,
  };
}

// Modify the main function to use the menu
async function main() {
  try {
    console.log("=== Multi-Token Search and Config Updater ===");

    // Display the main menu
    await displayMainMenu();
  } catch (error) {
    console.error("\nERROR:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the program
main();
