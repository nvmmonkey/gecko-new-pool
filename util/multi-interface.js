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

  // Token filters - only show pools with SOL as base or quote token
  tokenFilters: {
    // Set to true to only show pools with SOL as base or quote token
    requireSol: true,
    // SOL token ID
    solTokenId: "solana_So11111111111111111111111111111111111111112",
  },

  // TOML config file
  tomlConfig: {
    // Path to the TOML file
    filePath: "./config.low.toml",
    // Maximum number of pools to include in the TOML file per token
    maxPools: 3,
    // Priority order for DEXes (highest to lowest)
    dexPriority: ["pumpswap", "meteora", "raydium", "raydium-clmm"],
    // Maximum number of pools per DEX
    maxPoolsPerDex: {
      pumpswap: 1,
      meteora: 2,
      raydium: 1,
      "raydium-clmm": 0, // Do not include raydium-clmm pools
    },
    // Map DEX IDs to TOML config field names
    dexToFieldName: {
      pumpswap: "pump_pool_list",
      meteora: "meteora_dlmm_pool_list",
      raydium: "raydium_pool_list",
      "raydium-clmm": "raydium_cp_pool_list",
    },
  },

  // User configuration options
  userConfig: {
    jito: {
      enabled: false,
      options: {
        option1: {
          strategy: "Random",
          from: 1051225,
          to: 10051225,
          count: 5,
        },
        option2: {
          strategy: "Random",
          from: 10051225,
          to: 100051225,
          count: 5,
        },
        option3: {
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

// Function to filter pools by DEX and tokens
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
  if (CONFIG.tokenFilters.requireSol) {
    filteredPools = filteredPools.filter((pool) => {
      const baseTokenId = pool.relationships.base_token.data.id;
      const quoteTokenId = pool.relationships.quote_token.data.id;

      // Check if either the base or quote token is SOL
      return (
        baseTokenId === CONFIG.tokenFilters.solTokenId ||
        quoteTokenId === CONFIG.tokenFilters.solTokenId
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
function groupPoolsByDex(pools) {
  const groupedPools = {};

  CONFIG.tomlConfig.dexPriority.forEach((dex) => {
    groupedPools[dex] = [];
  });

  pools.forEach((pool) => {
    const dexId = pool.relationships.dex.data.id;
    if (groupedPools[dexId]) {
      groupedPools[dexId].push(pool);
    }
  });

  return groupedPools;
}

// Function to select top pools based on priority and limits
function selectTopPools(groupedPools) {
  const selectedPools = {};
  let totalSelectedPools = 0;

  // Select pools in priority order
  for (const dex of CONFIG.tomlConfig.dexPriority) {
    const poolsForDex = groupedPools[dex] || [];
    const maxPoolsForDex = CONFIG.tomlConfig.maxPoolsPerDex[dex] || 0;

    // Skip if no pools should be selected for this DEX
    if (maxPoolsForDex === 0) {
      continue;
    }

    // Select top pools for this DEX
    const topPoolsForDex = poolsForDex.slice(0, maxPoolsForDex);

    if (topPoolsForDex.length > 0) {
      selectedPools[dex] = topPoolsForDex;
      totalSelectedPools += topPoolsForDex.length;
    }

    // Stop if we've reached the maximum number of pools
    if (totalSelectedPools >= CONFIG.tomlConfig.maxPools) {
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
  "http://ny.mainnet.block-engine.jito.wtf/api/v1",
  "http://slc.mainnet.block-engine.jito.wtf/api/v1",
  "http://amsterdam.mainnet.block-engine.jito.wtf/api/v1",
]
[jito.tip_config]
strategy = "Random"
from = 6000
to = 500500
count = 4

[kamino_flashloan]
enabled = false

[bot]
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
    console.log("1. Random strategy, from 1051225 to 10051225, count 5");
    console.log("2. Random strategy, from 10051225 to 100051225, count 5");
    console.log("3. Custom values");

    const jitoOption = await question("Enter option number (1-3): ");

    if (jitoOption === "1") {
      userConfig.jito.selectedOption = {
        ...CONFIG.userConfig.jito.options.option1,
      };
    } else if (jitoOption === "2") {
      userConfig.jito.selectedOption = {
        ...CONFIG.userConfig.jito.options.option2,
      };
    } else if (jitoOption === "3") {
      userConfig.jito.selectedOption = { strategy: "Random" };
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

// Main function
async function main() {
  try {
    console.log("=== Multi-Token Search and Config Updater ===");

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
        console.log("No token address provided. Exiting.");
        rl.close();
        return;
      }
    }

    // Process the first token
    const tokenResult = await processToken(tokenAddress);
    if (tokenResult) {
      processedTokens.push(tokenResult);
    } else {
      rl.close();
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
  } catch (error) {
    console.error("\nERROR:", error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the program
main();
