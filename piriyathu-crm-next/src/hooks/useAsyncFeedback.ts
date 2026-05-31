import { useCallback, useState } from "react";

type RunOptions<T> = {
  successMessage?: string;
  onSuccess?: (result: T) => void | Promise<void>;
};

export function useAsyncFeedback() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const clearFeedback = useCallback(() => {
    setError("");
    setNotice("");
  }, []);

  const runAction = useCallback(async <T>(action: () => Promise<T>, options?: RunOptions<T>) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (options?.successMessage) {
        setNotice(options.successMessage);
      }
      if (options?.onSuccess) {
        await options.onSuccess(result);
      }
      return result;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    notice,
    setError,
    setNotice,
    clearFeedback,
    runAction
  };
}
