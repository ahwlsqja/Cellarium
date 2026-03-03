/**
 * Full system deployment script for PixelPlace on Worldland
 *
 * Deploys all 4 contracts as UUPS proxies with correct cross-references:
 * 1. PixelCanvas (canvas creation, pixel painting, cooldown, completion)
 * 2. CanvasAuction (English auction with anti-sniping)
 * 3. RevenueDistributor (80/15/5 pull-based revenue split)
 * 4. CanvasNFT (ERC-721 stub for Phase 5)
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network hardhat
 *   npx hardhat run scripts/deploy.ts --network worldland
 */

import { network } from "hardhat";
import { encodeFunctionData } from "viem";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
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

  console.log("=== PixelPlace Full System Deployment ===");
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");

  // ===== 1. Deploy PixelCanvas =====
  console.log("[1/4] Deploying PixelCanvas...");
  const pixelCanvasImpl = await viem.deployContract("PixelCanvas");
  const pixelCanvasInitData = encodeFunctionData({
    abi: pixelCanvasImpl.abi,
    functionName: "initialize",
    args: [deployerAddress],
  });
  const pixelCanvasProxy = await viem.deployContract("TestERC1967Proxy", [
    pixelCanvasImpl.address,
    pixelCanvasInitData,
  ]);
  const pixelCanvas = await viem.getContractAt("PixelCanvas", pixelCanvasProxy.address);
  console.log(`  Implementation: ${pixelCanvasImpl.address}`);
  console.log(`  Proxy:          ${pixelCanvas.address}`);
  console.log("");

  // ===== 2. Deploy RevenueDistributor =====
  console.log("[2/4] Deploying RevenueDistributor...");
  const revDistImpl = await viem.deployContract("RevenueDistributor");
  const revDistInitData = encodeFunctionData({
    abi: revDistImpl.abi,
    functionName: "initialize",
    args: [deployerAddress, pixelCanvas.address, deployerAddress],
  });
  const revDistProxy = await viem.deployContract("TestERC1967Proxy", [
    revDistImpl.address,
    revDistInitData,
  ]);
  const revenueDistributor = await viem.getContractAt("RevenueDistributor", revDistProxy.address);
  console.log(`  Implementation: ${revDistImpl.address}`);
  console.log(`  Proxy:          ${revenueDistributor.address}`);
  console.log("");

  // ===== 3. Deploy CanvasAuction =====
  console.log("[3/4] Deploying CanvasAuction...");
  const auctionImpl = await viem.deployContract("CanvasAuction");
  const auctionInitData = encodeFunctionData({
    abi: auctionImpl.abi,
    functionName: "initialize",
    args: [deployerAddress, pixelCanvas.address, revenueDistributor.address],
  });
  const auctionProxy = await viem.deployContract("TestERC1967Proxy", [
    auctionImpl.address,
    auctionInitData,
  ]);
  const canvasAuction = await viem.getContractAt("CanvasAuction", auctionProxy.address);
  console.log(`  Implementation: ${auctionImpl.address}`);
  console.log(`  Proxy:          ${canvasAuction.address}`);
  console.log("");

  // ===== 4. Deploy CanvasNFT =====
  console.log("[4/4] Deploying CanvasNFT...");
  const nftImpl = await viem.deployContract("CanvasNFT");
  const nftInitData = encodeFunctionData({
    abi: nftImpl.abi,
    functionName: "initialize",
    args: ["PixelPlace Canvas", "PPC", deployerAddress],
  });
  const nftProxy = await viem.deployContract("TestERC1967Proxy", [
    nftImpl.address,
    nftInitData,
  ]);
  const canvasNFT = await viem.getContractAt("CanvasNFT", nftProxy.address);
  console.log(`  Implementation: ${nftImpl.address}`);
  console.log(`  Proxy:          ${canvasNFT.address}`);
  console.log("");

  // ===== 5. Link cross-references =====
  console.log("Linking contracts...");
  await pixelCanvas.write.setAuctionContract([canvasAuction.address], {
    account: deployer.account,
  });
  console.log("  PixelCanvas.setAuctionContract -> CanvasAuction");

  await revenueDistributor.write.setCanvasAuctionContract([canvasAuction.address], {
    account: deployer.account,
  });
  console.log("  RevenueDistributor.setCanvasAuctionContract -> CanvasAuction");
  console.log("");

  // ===== Summary =====
  console.log("=== Deployment Complete ===");
  console.log("");
  console.log("Proxy Addresses (use these for frontend):");
  console.log(`  PixelCanvas:        ${pixelCanvas.address}`);
  console.log(`  CanvasAuction:      ${canvasAuction.address}`);
  console.log(`  RevenueDistributor: ${revenueDistributor.address}`);
  console.log(`  CanvasNFT:          ${canvasNFT.address}`);
  console.log("");
  console.log("Implementation Addresses:");
  console.log(`  PixelCanvas:        ${pixelCanvasImpl.address}`);
  console.log(`  CanvasAuction:      ${auctionImpl.address}`);
  console.log(`  RevenueDistributor: ${revDistImpl.address}`);
  console.log(`  CanvasNFT:          ${nftImpl.address}`);
  console.log("");
  console.log("Cross-references:");
  console.log(`  PixelCanvas.auctionContract = ${canvasAuction.address}`);
  console.log(`  RevenueDistributor.canvasAuctionContract = ${canvasAuction.address}`);
  console.log(`  RevenueDistributor.pixelCanvasContract = ${pixelCanvas.address}`);
  console.log(`  CanvasAuction.pixelCanvasContract = ${pixelCanvas.address}`);
  console.log(`  CanvasAuction.revenueDistributorContract = ${revenueDistributor.address}`);

  // Save deployment record
  const networkName = connection.networkName;
  const chainIdHex = await deployer.request({ method: "eth_chainId" });
  const chainId = parseInt(chainIdHex as string, 16);
  const deploymentRecord = {
    network: networkName,
    chainId,
    deployer: deployerAddress,
    deployedAt: new Date().toISOString(),
    contracts: {
      pixelCanvas: {
        proxy: pixelCanvas.address,
        implementation: pixelCanvasImpl.address,
      },
      canvasAuction: {
        proxy: canvasAuction.address,
        implementation: auctionImpl.address,
      },
      revenueDistributor: {
        proxy: revenueDistributor.address,
        implementation: revDistImpl.address,
      },
      canvasNFT: {
        proxy: canvasNFT.address,
        implementation: nftImpl.address,
      },
    },
    crossReferences: {
      "pixelCanvas.auctionContract": canvasAuction.address,
      "revenueDistributor.canvasAuctionContract": canvasAuction.address,
      "canvasAuction.pixelCanvasContract": pixelCanvas.address,
      "canvasAuction.revenueDistributorContract": revenueDistributor.address,
    },
  };

  const deploymentsDir = join(__dirname, "..", "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }
  const filePath = join(deploymentsDir, `${networkName}.json`);
  writeFileSync(filePath, JSON.stringify(deploymentRecord, null, 2));
  console.log("");
  console.log(`Deployment record saved to: ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
