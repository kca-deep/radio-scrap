import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../types';

interface UseSSEOptions<T> {
  onEvent?: (event: T) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useSSE<T = any>(
  endpoint: string | null,
  options: UseSSEOptions<T> = {}
) {
  const [events, setEvents] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onEvent, onComplete, onError } = options;

  useEffect(() => {
    if (!endpoint) return;

    const eventSource = new EventSource(`${API_URL}${endpoint}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as T;

        setEvents((prev) => [...prev, data]);
        onEvent?.(data);

        // Check for completion
        if ('status' in data && (data.status === 'completed' || data.status === 'failed')) {
          onComplete?.();
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      const errorMsg = 'SSE connection error';
      setError(errorMsg);
      setIsConnected(false);
      onError?.(errorMsg);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [endpoint, onEvent, onComplete, onError]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, error, clearEvents };
}
