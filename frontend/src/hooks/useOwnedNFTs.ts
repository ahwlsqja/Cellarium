'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { CONTRACTS, CanvasNFTReadABI } from '@/config/contracts';

/** NFT metadata decoded from on-chain base64 tokenURI */
export interface NFTMetadata {
  tokenId: number;
  canvasId: number;
  name: string;
  description: string;
  imageDataUri: string;
  attributes: Attribute[];
}

export interface Attribute {
  trait_type: string;
  value: string;
}

/** CanvasNFTMinted event ABI for getLogs */
const CanvasNFTMintedEventABI = [
  {
    type: 'event',
    name: 'CanvasNFTMinted',
    inputs: [
      { name: 'canvasId', type: 'uint256', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Decode a base64-encoded tokenURI into structured metadata.
 * tokenURI format: "data:application/json;base64,{base64_json}"
 * JSON contains: name, description, image (data:image/svg+xml;base64,...), attributes
 */
function decodeTokenURI(tokenURI: string): Omit<NFTMetadata, 'tokenId' | 'canvasId'> | null {
  try {
    const prefix = 'data:application/json;base64,';
    if (!tokenURI.startsWith(prefix)) return null;
    const base64 = tokenURI.slice(prefix.length);
    const json = atob(base64);
    const parsed = JSON.parse(json) as {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Attribute[];
    };
    return {
      name: parsed.name ?? 'Untitled',
      description: parsed.description ?? '',
      imageDataUri: parsed.image ?? '',
      attributes: parsed.attributes ?? [],
    };
  } catch {
    return null;
  }
}

interface UseOwnedNFTsReturn {
  nfts: NFTMetadata[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Discover and read all NFTs owned by the connected wallet.
 * Uses event-based indexing: fetches CanvasNFTMinted events filtered by connected address.
 */
export function useOwnedNFTs(): UseOwnedNFTsReturn {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOwnedNFTs = useCallback(async () => {
    if (!address || !isConnected || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch CanvasNFTMinted events where winner = connected address
      const logs = await publicClient.getLogs({
        address: CONTRACTS.canvasNFT.address,
        event: CanvasNFTMintedEventABI[0],
        args: {
          winner: address,
        },
        fromBlock: 0n,
        toBlock: 'latest',
      });

      // For each minted token, verify current ownership and fetch metadata
      const nftPromises = logs.map(async (log) => {
        const tokenId = Number(log.args.tokenId ?? 0n);
        const canvasId = Number(log.args.canvasId ?? 0n);

        // Verify current owner (NFTs can be transferred)
        try {
          const owner = await publicClient.readContract({
            address: CONTRACTS.canvasNFT.address,
            abi: CanvasNFTReadABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          });

          // Skip if no longer owned by connected wallet
          if ((owner as string).toLowerCase() !== address.toLowerCase()) {
            return null;
          }

          // Fetch tokenURI
          const tokenURI = await publicClient.readContract({
            address: CONTRACTS.canvasNFT.address,
            abi: CanvasNFTReadABI,
            functionName: 'tokenURI',
            args: [BigInt(tokenId)],
          });

          const decoded = decodeTokenURI(tokenURI as string);
          if (!decoded) return null;

          return {
            tokenId,
            canvasId,
            ...decoded,
          } satisfies NFTMetadata;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(nftPromises);
      setNfts(results.filter((r): r is NFTMetadata => r !== null));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch NFTs'));
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, publicClient]);

  useEffect(() => {
    fetchOwnedNFTs();
  }, [fetchOwnedNFTs]);

  return { nfts, isLoading, error };
}

interface UseNFTDetailReturn {
  metadata: Omit<NFTMetadata, 'tokenId' | 'canvasId'> | null;
  canvasId: number | null;
  owner: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Read full metadata for a single NFT by tokenId.
 * Uses useReadContract for tokenURI, getCanvasByToken, and ownerOf.
 */
export function useNFTDetail(tokenId: number): UseNFTDetailReturn {
  // Read tokenURI
  const {
    data: tokenURIData,
    isLoading: isLoadingURI,
    error: uriError,
  } = useReadContract({
    address: CONTRACTS.canvasNFT.address,
    abi: CanvasNFTReadABI,
    functionName: 'tokenURI',
    args: [BigInt(tokenId)],
    query: { enabled: tokenId >= 0 },
  });

  // Read canvasId from getCanvasByToken
  const {
    data: canvasIdData,
    isLoading: isLoadingCanvas,
    error: canvasError,
  } = useReadContract({
    address: CONTRACTS.canvasNFT.address,
    abi: CanvasNFTReadABI,
    functionName: 'getCanvasByToken',
    args: [BigInt(tokenId)],
    query: { enabled: tokenId >= 0 },
  });

  // Read owner
  const {
    data: ownerData,
    isLoading: isLoadingOwner,
    error: ownerError,
  } = useReadContract({
    address: CONTRACTS.canvasNFT.address,
    abi: CanvasNFTReadABI,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
    query: { enabled: tokenId >= 0 },
  });

  const metadata = tokenURIData ? decodeTokenURI(tokenURIData as string) : null;
  const canvasId = canvasIdData !== undefined ? Number(canvasIdData) : null;
  const owner = ownerData ? (ownerData as string) : null;

  const isLoading = isLoadingURI || isLoadingCanvas || isLoadingOwner;
  const error = (uriError ?? canvasError ?? ownerError) as Error | null;

  return { metadata, canvasId, owner, isLoading, error };
}
