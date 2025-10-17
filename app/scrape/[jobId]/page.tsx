'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/lib/hooks/use-sse';
import { ScrapeProgressEvent } from '@/lib/types';
import ScrapeProgress from '@/components/scrape/scrape-progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function ScrapeProgressPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();
  const { events, isConnected, error } = useSSE<ScrapeProgressEvent>(
    `/api/scrape/stream/${params.jobId}`,
    {
      onComplete: () => {
        console.log('Scraping completed!');
      },
      onError: (err) => {
        console.error('SSE error:', err);
      },
    }
  );

  const latestEvent = events[events.length - 1];
  const isCompleted = latestEvent?.status === 'completed';
  const isFailed = latestEvent?.status === 'failed';

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scraping Progress</h1>
            <p className="text-muted-foreground mt-2">
              Job ID: <span className="font-mono text-sm">{params.jobId}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/scrape')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <ScrapeProgress events={events} isConnected={isConnected} error={error} />

        {isCompleted && (
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/scrape')}
            >
              Start New Scraping
            </Button>
            <Button onClick={() => router.push('/articles')}>
              View Articles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => router.push('/scrape')}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
