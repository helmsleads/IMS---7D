"use client";

import { useState, useEffect, useCallback } from "react";
import { handleApiError } from "@/lib/utils/error-handler";

interface UseAsyncDataOptions {
  immediate?: boolean;
}

interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching async data with loading and error states
 */
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options: UseAsyncDataOptions = { immediate: true }
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(options.immediate ?? true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (options.immediate) {
      fetch();
    }
  }, []);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for multiple async data fetches
 */
export function useMultipleAsyncData<T extends Record<string, () => Promise<unknown>>>(
  fetchFns: T,
  options: UseAsyncDataOptions = { immediate: true }
): {
  data: { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<{ [K in keyof T]: Awaited<ReturnType<T[K]>> | null }>(
    () => Object.keys(fetchFns).reduce((acc, key) => ({ ...acc, [key]: null }), {} as { [K in keyof T]: null })
  );
  const [loading, setLoading] = useState(options.immediate ?? true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = Object.entries(fetchFns);
      const results = await Promise.all(entries.map(([, fn]) => fn()));
      const newData = entries.reduce((acc, [key], index) => {
        acc[key as keyof T] = results[index] as Awaited<ReturnType<T[keyof T]>>;
        return acc;
      }, {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> });
      setData(newData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options.immediate) {
      fetch();
    }
  }, []);

  return { data, loading, error, refetch: fetch };
}
