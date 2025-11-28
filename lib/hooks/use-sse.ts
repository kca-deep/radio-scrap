import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '../types';

interface UseSSEOptions<T> {
  onEvent?: (event: T) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useSSE<T extends object = Record<string, unknown>>(
  endpoint: string | null,
  options: UseSSEOptions<T> = {}
) {
  const [events, setEvents] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks to avoid re-creating EventSource on callback changes
  const onEventRef = useRef(options.onEvent);
  const onCompleteRef = useRef(options.onComplete);
  const onErrorRef = useRef(options.onError);

  // Update refs when callbacks change
  useEffect(() => {
    onEventRef.current = options.onEvent;
    onCompleteRef.current = options.onComplete;
    onErrorRef.current = options.onError;
  }, [options.onEvent, options.onComplete, options.onError]);

  useEffect(() => {
    if (!endpoint) return;

    // Reset events when endpoint changes
    setEvents([]);
    setError(null);

    const eventSource = new EventSource(`${API_URL}${endpoint}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as T;

        setEvents((prev) => [...prev, data]);
        onEventRef.current?.(data);

        // Check for completion
        if ('status' in data && (data.status === 'completed' || data.status === 'failed')) {
          onCompleteRef.current?.();
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
      onErrorRef.current?.(errorMsg);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [endpoint]); // Only depend on endpoint

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, error, clearEvents };
}
