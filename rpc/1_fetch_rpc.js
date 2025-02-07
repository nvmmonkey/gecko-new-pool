import fs from "fs/promises";
import path from "path";

async function getClusterNodes() {
  const url = "http://api.mainnet-beta.solana.com";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getClusterNodes",
    }),
  });

  const data = await response.json();
  return data;
}

async function main() {
  try {
    const nodes = await getClusterNodes();

    // Save to JSON file
    await fs.writeFile(
      path.join(process.cwd(), "raw_rpc.json"),
      JSON.stringify(nodes, null, 2)
    );

    console.log("Data saved to raw_rpc.json");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the function
main();
