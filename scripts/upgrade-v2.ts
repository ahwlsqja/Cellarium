/**
 * V2 Upgrade Script for PixelPlace on Worldland
 *
 * Upgrades all 3 contracts to V2 implementations via UUPS proxy:
 * 1. CanvasNFT V2 - on-chain SVG tokenURI, access-controlled mintForAuction
 * 2. CanvasAuction V2 - NFT minting during settlement
 * 3. PixelCanvas V2 - bulk getPixelData view function
 *
 * After upgrade, links cross-references:
 * - CanvasNFT.setPixelCanvasContract(pixelCanvas)
 * - CanvasNFT.setCanvasAuctionContract(canvasAuction)
 * - CanvasAuction.setCanvasNFTContract(canvasNFT)
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-v2.ts --network hardhat
 *   npx hardhat run scripts/upgrade-v2.ts --network worldland
 */

import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const connection = await network.connect();
  const { viem } = connection;
  const walletClients = await viem.getWalletClients();
  const deployer = walletClients[0];
  const deployerAddress = deployer.account.address;

  // Load deployment record
  const networkName = connection.networkName;
  const deploymentsPath = join(__dirname, "..", "deployments", `${networkName}.json`);
  const deployments = JSON.parse(readFileSync(deploymentsPath, "utf-8"));

  console.log("=== PixelPlace V2 Upgrade ===");
  console.log(`Network: ${networkName}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");

  const pixelCanvasProxyAddr = deployments.contracts.pixelCanvas.proxy as `0x${string}`;
  const canvasAuctionProxyAddr = deployments.contracts.canvasAuction.proxy as `0x${string}`;
  const canvasNFTProxyAddr = deployments.contracts.canvasNFT.proxy as `0x${string}`;

  // ===== 1. Deploy & Upgrade CanvasNFT V2 =====
  console.log("[1/3] Upgrading CanvasNFT to V2...");
  const canvasNFTV2Impl = await viem.deployContract("CanvasNFT");
  console.log(`  New implementation: ${canvasNFTV2Impl.address}`);

  const canvasNFTProxy = await viem.getContractAt("CanvasNFT", canvasNFTProxyAddr);
  await canvasNFTProxy.write.upgradeToAndCall(
    [canvasNFTV2Impl.address, "0x"],
    { account: deployer.account },
  );
  console.log("  Proxy upgraded");
  console.log("");

  // ===== 2. Deploy & Upgrade CanvasAuction V2 =====
  console.log("[2/3] Upgrading CanvasAuction to V2...");
  const canvasAuctionV2Impl = await viem.deployContract("CanvasAuction");
  console.log(`  New implementation: ${canvasAuctionV2Impl.address}`);

  const canvasAuctionProxy = await viem.getContractAt("CanvasAuction", canvasAuctionProxyAddr);
  await canvasAuctionProxy.write.upgradeToAndCall(
    [canvasAuctionV2Impl.address, "0x"],
    { account: deployer.account },
  );
  console.log("  Proxy upgraded");
  console.log("");

  // ===== 3. Deploy & Upgrade PixelCanvas V2 =====
  console.log("[3/3] Upgrading PixelCanvas to V2...");
  const pixelCanvasV2Impl = await viem.deployContract("PixelCanvas");
  console.log(`  New implementation: ${pixelCanvasV2Impl.address}`);

  const pixelCanvasProxy = await viem.getContractAt("PixelCanvas", pixelCanvasProxyAddr);
  await pixelCanvasProxy.write.upgradeToAndCall(
    [pixelCanvasV2Impl.address, "0x"],
    { account: deployer.account },
  );
  console.log("  Proxy upgraded");
  console.log("");

  // ===== 4. Link cross-references =====
  console.log("Linking V2 cross-references...");

  await canvasNFTProxy.write.setPixelCanvasContract(
    [pixelCanvasProxyAddr],
    { account: deployer.account },
  );
  console.log(`  CanvasNFT.setPixelCanvasContract -> ${pixelCanvasProxyAddr}`);

  await canvasNFTProxy.write.setCanvasAuctionContract(
    [canvasAuctionProxyAddr],
    { account: deployer.account },
  );
  console.log(`  CanvasNFT.setCanvasAuctionContract -> ${canvasAuctionProxyAddr}`);

  await canvasAuctionProxy.write.setCanvasNFTContract(
    [canvasNFTProxyAddr],
    { account: deployer.account },
  );
  console.log(`  CanvasAuction.setCanvasNFTContract -> ${canvasNFTProxyAddr}`);
  console.log("");

  // ===== Summary =====
  console.log("=== V2 Upgrade Complete ===");
  console.log("");
  console.log("V2 Implementation Addresses:");
  console.log(`  CanvasNFT V2:      ${canvasNFTV2Impl.address}`);
  console.log(`  CanvasAuction V2:  ${canvasAuctionV2Impl.address}`);
  console.log(`  PixelCanvas V2:    ${pixelCanvasV2Impl.address}`);
  console.log("");
  console.log("New Cross-references:");
  console.log(`  CanvasNFT.pixelCanvasContract = ${pixelCanvasProxyAddr}`);
  console.log(`  CanvasNFT.canvasAuctionContract = ${canvasAuctionProxyAddr}`);
  console.log(`  CanvasAuction.canvasNFTContract = ${canvasNFTProxyAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
