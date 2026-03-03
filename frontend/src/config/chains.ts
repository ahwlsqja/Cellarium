// Source: https://chainlist.org/chain/103 + deployments/worldland.json
import { type Chain } from 'viem';

export const worldland = {
  id: 103,
  name: 'WorldLand',
  nativeCurrency: {
    name: 'WorldLand',
    symbol: 'WLC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://seoul.worldland.foundation'],
    },
    public: {
      http: [
        'https://seoul.worldland.foundation',
        'https://seoul2.worldland.foundation',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'WorldLand Explorer',
      url: 'https://scan.worldland.foundation',
    },
  },
} as const satisfies Chain;
