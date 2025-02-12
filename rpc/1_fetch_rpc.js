import fs from "fs/promises";
import path from "path";

const LAMPORTS_PER_SOL = 1000000000;

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
  return data.result;
}

async function getVoteAccounts() {
  const url = "http://api.mainnet-beta.solana.com";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getVoteAccounts",
    }),
  });

  const data = await response.json();
  return data.result;
}

async function mergeNodeAndStakeInfo() {
  try {
    // Get cluster nodes
    const clusterNodes = await getClusterNodes();
    
    // Get vote accounts (contains stake information)
    const voteAccounts = await getVoteAccounts();
    
    // Combine current and delinquent validators
    const allVoteAccounts = [
      ...voteAccounts.current,
      ...voteAccounts.delinquent
    ];

    // Create a map of pubkey to stake info
    const stakeMap = new Map();
    allVoteAccounts.forEach(account => {
      stakeMap.set(account.nodePubkey, {
        stake: account.activatedStake / LAMPORTS_PER_SOL,
        commission: account.commission,
        lastVote: account.lastVote,
        votePubkey: account.votePubkey,
        delinquent: account.delinquent
      });
    });

    // Merge cluster node info with stake info
    const completeNodeInfo = clusterNodes.map(node => {
      const stakeInfo = stakeMap.get(node.pubkey) || {
        stake: 0,
        commission: null,
        lastVote: null,
        votePubkey: null,
        delinquent: null
      };

      return {
        ...node,
        stake: stakeInfo.stake,
        commission: stakeInfo.commission,
        lastVote: stakeInfo.lastVote,
        votePubkey: stakeInfo.votePubkey,
        delinquent: stakeInfo.delinquent
      };
    });

    // Add any validators that aren't in cluster nodes
    allVoteAccounts.forEach(account => {
      const exists = completeNodeInfo.some(node => node.pubkey === account.nodePubkey);
      if (!exists) {
        completeNodeInfo.push({
          pubkey: account.nodePubkey,
          gossip: null,
          tpu: null,
          rpc: null,
          version: null,
          featureSet: null,
          shredVersion: null,
          stake: account.activatedStake / LAMPORTS_PER_SOL,
          commission: account.commission,
          lastVote: account.lastVote,
          votePubkey: account.votePubkey,
          delinquent: account.delinquent
        });
      }
    });

    // Sort by stake in descending order
    return completeNodeInfo.sort((a, b) => b.stake - a.stake);
  } catch (error) {
    console.error("Error merging node and stake info:", error);
    throw error;
  }
}

async function main() {
  try {
    const nodesWithStake = await mergeNodeAndStakeInfo();

    // Save to JSON file
    await fs.writeFile(
      path.join(process.cwd(), "raw_rpc.json"),
      JSON.stringify(nodesWithStake, null, 2)
    );

    console.log("Data saved to raw_rpc.json");
    
    // Print some summary statistics
    const totalStake = nodesWithStake.reduce((sum, node) => sum + node.stake, 0);
    const activeNodes = nodesWithStake.filter(node => node.stake > 0).length;
    
    console.log("\nSummary:");
    console.log(`Total nodes: ${nodesWithStake.length}`);
    console.log(`Active validators (with stake): ${activeNodes}`);
    console.log(`Total stake: ${totalStake.toLocaleString()} SOL`);
    console.log(`Top 5 nodes by stake:`);
    nodesWithStake.slice(0, 5).forEach((node, index) => {
      console.log(`${index + 1}. ${node.pubkey}: ${node.stake.toLocaleString()} SOL`);
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the function
main();