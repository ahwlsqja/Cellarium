import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          evmVersion: "paris",
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    worldland: {
      type: "http",
      chainType: "l1",
      url: "https://seoul.worldland.foundation",
      chainId: 103,
      accounts: [configVariable("PRIVATE_KEY")],
      gas: 8_000_000,
      gasPrice: 5_000_000_000,
    },
  },
});
