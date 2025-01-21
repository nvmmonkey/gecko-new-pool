const axios = require("axios");
const fs = require("fs");

const CONFIG = {
  // Rate Limiting
  RATE_LIMIT: 30,
  INTERVAL: 60000,
  RETRY_ATTEMPTS: 3,

  // Pagination
  TOTAL_PAGES: 5,

  // Filters
  FILTERS: {
    // Price & Value Filters
    MIN_BASE_TOKEN_PRICE_USD: 0,
    MIN_RESERVE_USD: 0,
    MIN_FDV_USD: 100000,

    // Volume Filters
    MIN_24H_VOLUME: 10000,
    MIN_24H_TRANSACTIONS: 0,
    MIN_24H_BUYERS: 0,

    // Price Change Filters
    MAX_PRICE_CHANGE_24H: 100000000,

    // DEX Filters True=exclude False=include
    DEX_FILTERS: {
      raydium: false,
      fluxbeam: true,
      dexlab: true,
      meteora: false,
      orca: true,
      "raydium-clmm": false,
    },

    // Token Filters
    QUOTE_TOKENS: [],
  },

  // Output Files
  OUTPUT_FILES: {
    POOLS: "solana_pools.json",
    DEX_COUNT: "dex_count.json",
    DEX_NAMES: "dex_name.json",
  },
};

const DELAY_BETWEEN_REQUESTS = CONFIG.INTERVAL / CONFIG.RATE_LIMIT;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, headers, retries = CONFIG.RETRY_ATTEMPTS) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { headers });
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      if (error.response?.status === 429) {
        await sleep(CONFIG.INTERVAL);
      } else {
        await sleep(1000 * (i + 1));
      }
    }
  }
}

async function processPageData(pageData) {
  return pageData.filter((pool) => {
    const attributes = pool.attributes;
    const dexId = pool.relationships.dex.data.id;
    const quoteTokenId = pool.relationships.quote_token.data.id;

    return (
      parseFloat(attributes.fdv_usd) > CONFIG.FILTERS.MIN_FDV_USD &&
      !CONFIG.FILTERS.DEX_FILTERS[dexId] &&
      parseFloat(attributes.base_token_price_usd) >
        CONFIG.FILTERS.MIN_BASE_TOKEN_PRICE_USD &&
      parseFloat(attributes.reserve_in_usd) > CONFIG.FILTERS.MIN_RESERVE_USD &&
      parseFloat(attributes.volume_usd.h24) > CONFIG.FILTERS.MIN_24H_VOLUME &&
      attributes.transactions.h24.buys + attributes.transactions.h24.sells >
        CONFIG.FILTERS.MIN_24H_TRANSACTIONS &&
      attributes.transactions.h24.buyers > CONFIG.FILTERS.MIN_24H_BUYERS &&
      Math.abs(parseFloat(attributes.price_change_percentage.h24)) <
        CONFIG.FILTERS.MAX_PRICE_CHANGE_24H &&
      (CONFIG.FILTERS.QUOTE_TOKENS.length === 0 ||
        CONFIG.FILTERS.QUOTE_TOKENS.includes(quoteTokenId))
    );
  });
}

// Track if files have been cleared in this cycle
let filesCleared = false;

async function fetchData(onPageComplete, clearMode = false) {
  let requestCount = 0;
  let lastRequestTime = Date.now();
  let allPoolsData = [];

  try {
    if (clearMode && !filesCleared) {
      // Delete all related files when in clear mode and haven't been cleared yet
      console.log("Clear mode: Removing existing files...");
      const filesToDelete = [
        CONFIG.OUTPUT_FILES.POOLS, // solana_pools.json
        CONFIG.OUTPUT_FILES.DEX_COUNT, // dex_count.json
        CONFIG.OUTPUT_FILES.DEX_NAMES, // dex_name.json
        "tbp.json", // intermediate file from extract
        "minfile.json", // final output file
        "minfileAll.json", // final output file
      ];

      for (const file of filesToDelete) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`Deleted ${file}`);
        }
      }
      filesCleared = true;
    } else if (fs.existsSync(CONFIG.OUTPUT_FILES.POOLS)) {
      const existingData = JSON.parse(
        fs.readFileSync(CONFIG.OUTPUT_FILES.POOLS, "utf8")
      );
      allPoolsData = Array.isArray(existingData) ? existingData : [];
      console.log(`Loaded ${allPoolsData.length} existing pools`);
    }
  } catch (error) {
    console.warn("Error handling files:", error.message);
  }

  // Reset filesCleared flag after completing all pages
  if (clearMode) {
    filesCleared = false;
  }

  for (let page = 1; page <= CONFIG.TOTAL_PAGES; page++) {
    try {
      if (requestCount >= CONFIG.RATE_LIMIT) {
        const waitTime = CONFIG.INTERVAL - (Date.now() - lastRequestTime);
        if (waitTime > 0) await sleep(waitTime);
        requestCount = 0;
        lastRequestTime = Date.now();
      }

      console.log(`Fetching page ${page}/${CONFIG.TOTAL_PAGES}`);

      const response = await fetchWithRetry(
        `https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=${page}`,
        { accept: "application/json" }
      );

      const filteredPageData = await processPageData(response.data.data);

      const timestampedPageData = filteredPageData.map((pool) => ({
        ...pool,
        fetchTimestamp: new Date().toISOString(),
      }));

      // Sort the new data by pool_created_at in descending order
      const sortedPageData = timestampedPageData.sort((a, b) => {
        const dateA = new Date(a.attributes.pool_created_at);
        const dateB = new Date(b.attributes.pool_created_at);
        return dateB - dateA;
      });

      // Merge and sort all data
      allPoolsData = [...sortedPageData, ...allPoolsData].sort((a, b) => {
        const dateA = new Date(a.attributes.pool_created_at);
        const dateB = new Date(b.attributes.pool_created_at);
        return dateB - dateA;
      });

      fs.writeFileSync(
        CONFIG.OUTPUT_FILES.POOLS,
        JSON.stringify(allPoolsData, null, 2)
      );

      const uniqueDexIds = new Set();
      allPoolsData.forEach((pool) => {
        uniqueDexIds.add(pool.relationships.dex.data.id);
      });

      fs.writeFileSync(
        CONFIG.OUTPUT_FILES.DEX_COUNT,
        JSON.stringify({ dexCount: uniqueDexIds.size }, null, 2)
      );
      fs.writeFileSync(
        CONFIG.OUTPUT_FILES.DEX_NAMES,
        JSON.stringify(Array.from(uniqueDexIds), null, 2)
      );

      console.log(
        `Page ${page} processed and written. Total pools: ${allPoolsData.length}`
      );

      if (onPageComplete) {
        await onPageComplete({
          pageNumber: page,
          totalPages: CONFIG.TOTAL_PAGES,
          pageData: sortedPageData,
          totalPoolsCount: allPoolsData.length,
        });
      }

      requestCount++;
      await sleep(DELAY_BETWEEN_REQUESTS);
    } catch (error) {
      console.error(`Error processing page ${page}:`, error.message);
      await sleep(5000);
    }
  }

  console.log(
    "All pages processed successfully. Total pools collected:",
    allPoolsData.length
  );
}

if (require.main === module) {
  const main = async () => {
    try {
      await fetchData();
    } catch (error) {
      console.error("Fatal error:", error.message);
      process.exit(1);
    }
  };

  main();
}

module.exports = fetchData;
