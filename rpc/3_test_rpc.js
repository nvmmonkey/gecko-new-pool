import fs from "fs/promises";
import path from "path";
import { Connection } from "@solana/web3.js";

// Configuration
const RPC_TIMEOUT = 3000; // Reduced to 3 seconds
const COMMITMENT = "processed"; // Changed to 'processed' for faster response
const BATCH_SIZE = 25; // Increased batch size
const BATCH_DELAY = 100; // Reduced delay between batches to 100ms

async function testRpcEndpoint(rpcUrl) {
  const startTime = Date.now();
  try {
    // Try HTTP first (usually faster than HTTPS)
    try {
      const httpUrl = rpcUrl.startsWith("http") ? rpcUrl : `http://${rpcUrl}`;
      const connection = new Connection(httpUrl, {
        commitment: COMMITMENT,
        confirmTransactionInitialTimeout: RPC_TIMEOUT,
        disableRetryOnRateLimit: true,
        fetch: (url, options) => {
          return fetch(url, { ...options, timeout: RPC_TIMEOUT });
        },
      });

      const slot = await connection.getSlot();
      const latency = Date.now() - startTime;

      return {
        rpcUrl: httpUrl,
        status: "active",
        latency,
        slot,
        lastTested: new Date().toISOString(),
      };
    } catch (httpError) {
      // If HTTP fails, try HTTPS
      const httpsUrl = rpcUrl.startsWith("http") ? rpcUrl : `https://${rpcUrl}`;
      const connection = new Connection(httpsUrl, {
        commitment: COMMITMENT,
        confirmTransactionInitialTimeout: RPC_TIMEOUT,
        disableRetryOnRateLimit: true,
        fetch: (url, options) => {
          return fetch(url, { ...options, timeout: RPC_TIMEOUT });
        },
      });

      const slot = await connection.getSlot();
      const latency = Date.now() - startTime;

      return {
        rpcUrl: httpsUrl,
        status: "active",
        latency,
        slot,
        lastTested: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      rpcUrl,
      status: "inactive",
      error: error.message,
      lastTested: new Date().toISOString(),
    };
  }
}

async function testAllRpcEndpoints() {
  try {
    const filteredData = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "filtered_rpc.json"), "utf8")
    );

    console.log(`Testing ${filteredData.nodes.length} RPC endpoints...`);
    const startTime = Date.now();
    const results = [];

    // Process in larger batches
    for (let i = 0; i < filteredData.nodes.length; i += BATCH_SIZE) {
      const batch = filteredData.nodes.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (node) => {
        const rpcEndpoint = node.rpc.includes(":")
          ? node.rpc
          : `${node.rpc}:8899`;
        process.stdout.write(
          `\rTesting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            filteredData.nodes.length / BATCH_SIZE
          )}...`
        );
        return await testRpcEndpoint(rpcEndpoint);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + BATCH_SIZE < filteredData.nodes.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    const validNodes = results
      .filter((node) => node.status === "active")
      .sort((a, b) => a.latency - b.latency);

    const outputData = {
      nodes: validNodes,
      total: validNodes.length,
      averageLatency:
        validNodes.length > 0
          ? validNodes.reduce((acc, node) => acc + node.latency, 0) /
            validNodes.length
          : 0,
      lastTested: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(process.cwd(), "valid_rpc.json"),
      JSON.stringify(outputData, null, 2)
    );

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\n
Testing completed in ${totalTime.toFixed(1)} seconds:
Total tested: ${results.length}
Valid nodes: ${validNodes.length}
Average latency: ${outputData.averageLatency.toFixed(2)}ms
        `);
  } catch (error) {
    console.error("Error testing RPC endpoints:", error);
    throw error;
  }
}

// Run the tests
testAllRpcEndpoints().catch(console.error);
