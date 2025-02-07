import fs from "fs/promises";
import path from "path";

async function formatRpcToYaml() {
  try {
    // Read the valid_rpc.json file
    const jsonData = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "valid_rpc.json"), "utf8")
    );

    // Extract and format RPC URLs
    const rpcUrls = jsonData.nodes.map((node) => `   - ${node.rpcUrl}`);

    // Create YAML content
    const yamlContent = "```yaml\n" + rpcUrls.join("\n") + "\n```";

    // Write to both YAML and TXT files
    await Promise.all([
      fs.writeFile("rpc_endpoints.yaml", yamlContent),
      fs.writeFile("rpc_endpoints.txt", yamlContent),
    ]);

    console.log(`Successfully exported ${jsonData.nodes.length} RPC endpoints to:
- rpc_endpoints.yaml
- rpc_endpoints.txt`);
  } catch (error) {
    console.error("Error processing RPC endpoints:", error);
    throw error;
  }
}

// Run the formatter
formatRpcToYaml().catch(console.error);
