import fs from "fs/promises";
import path from "path";

async function filterRpcEndpoints() {
  try {
    // Read the raw JSON file
    const rawData = await fs.readFile(
      path.join(process.cwd(), "raw_rpc.json"),
      "utf8"
    );

    const data = JSON.parse(rawData);

    // Use the data directly as it is an array
    if (!Array.isArray(data)) {
      throw new Error("Invalid data format: expected an array.");
    }

    // Filter and map nodes to include rpc, version, gossip, pubkey, and stake (only if stake is not 0)
    const nodes = data
      .filter((node) => node.rpc !== null && node.stake !== 0)
      .map((node) => ({
        rpc: node.rpc,
        version: node.version,
        gossip: node.gossip,
        pubkey: node.pubkey,
        stake: node.stake,
      }));

    // Create the output object
    const outputData = {
      nodes,
      total: nodes.length,
      lastUpdated: new Date().toISOString(),
    };

    // Save filtered data to filtered_rpc.json
    await fs.writeFile(
      path.join(process.cwd(), "filtered_rpc.json"),
      JSON.stringify(outputData, null, 2)
    );

    console.log(`Saved ${nodes.length} nodes to filtered_rpc.json`);
  } catch (error) {
    console.error("Error processing node data:", error);
    throw error;
  }
}

// Run the function
filterRpcEndpoints();
