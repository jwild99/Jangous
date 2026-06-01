import { useState, useEffect, useCallback } from "react";

export interface CryptoPrices {
  btc: number;
  eth: number;
  sol: number;
}

const DEFAULT_PRICES: CryptoPrices = {
  btc: 100000,
  eth: 3500,
  sol: 200,
};

export function useCryptoPrices() {
  const [prices, setPrices] = useState<CryptoPrices>(DEFAULT_PRICES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/crypto/prices");
      if (response.ok) {
        const data = await response.json();
        if (data.btc > 0 && data.eth > 0 && data.sol > 0) {
          setPrices(data);
          setLastUpdated(new Date());
          setHasLoaded(true);
        } else {
          setError("Invalid price data received");
        }
      } else {
        setError("Failed to fetch prices");
      }
    } catch (err) {
      console.error("Failed to fetch crypto prices:", err);
      setError("Network error fetching prices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const convertToUsd = useCallback((amount: number, currency: "btc" | "eth" | "sol"): number => {
    const price = prices[currency];
    if (!price || price <= 0) return 0;
    return amount * price;
  }, [prices]);

  const convertFromUsd = useCallback((usdAmount: number, currency: "btc" | "eth" | "sol"): number => {
    const price = prices[currency];
    if (!price || price <= 0) return 0;
    return usdAmount / price;
  }, [prices]);

  const formatCrypto = useCallback((amount: number, currency: "btc" | "eth" | "sol"): string => {
    if (!isFinite(amount) || isNaN(amount)) return "0";
    if (currency === "btc") {
      return amount.toFixed(8);
    } else if (currency === "eth") {
      return amount.toFixed(6);
    } else {
      return amount.toFixed(4);
    }
  }, []);

  return {
    prices,
    isLoading,
    error,
    hasLoaded,
    lastUpdated,
    convertToUsd,
    convertFromUsd,
    formatCrypto,
    refresh: fetchPrices,
  };
}
