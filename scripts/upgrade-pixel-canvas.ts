import hre from "hardhat";

const PROXY_ADDRESS = "0xd3774a5906c3c0309a80aeb3df65d4d25f7192d9";

async function main() {
  const connection = await hre.network.connect();
  const [deployer] = await connection.viem.getWalletClients();
  const publicClient = await connection.viem.getPublicClient();

  console.log("Upgrading PixelCanvas with account:", deployer.account.address);

  // 1. Deploy new implementation
  console.log("Deploying new PixelCanvas implementation...");
  const newImpl = await connection.viem.deployContract("PixelCanvas");
  const newImplAddress = newImpl.address;
  console.log("New implementation deployed at:", newImplAddress);

  // 2. Call upgradeToAndCall on the proxy
  console.log("Calling upgradeToAndCall on proxy...");
  const proxy = await connection.viem.getContractAt(
    "PixelCanvas",
    PROXY_ADDRESS,
  );

  const tx = await proxy.write.upgradeToAndCall([newImplAddress, "0x"]);
  console.log("Upgrade tx:", tx);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("Upgrade confirmed in block:", receipt.blockNumber);

  // 3. Verify
  const minSize = await proxy.read.MIN_CANVAS_SIZE();
  console.log("MIN_CANVAS_SIZE after upgrade:", minSize);
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
