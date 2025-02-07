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

    // Filter and map nodes to include rpc, version, gossip, and pubkey
    const nodes = data.result
      .filter((node) => node.rpc !== null)
      .map((node) => ({
        rpc: node.rpc,
        version: node.version,
        gossip: node.gossip,
        pubkey: node.pubkey,
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
