'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSSE } from '@/lib/hooks/use-sse';
import { TranslateProgressEvent } from '@/lib/types';
import TranslateProgress from '@/components/translate/translate-progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TranslateProgressPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const { events, isConnected, error } = useSSE<TranslateProgressEvent>(
    `/api/translate/stream/${jobId}`
  );

  const latestEvent = events[events.length - 1];
  const isCompleted = latestEvent?.status === 'completed';
  const isFailed = latestEvent?.status === 'failed';

  useEffect(() => {
    if (isCompleted) {
      const timeout = setTimeout(() => {
        router.push('/articles?status=translated');
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [isCompleted, router]);

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Translation in Progress</h1>
            <p className="text-muted-foreground mt-2">Job ID: {jobId}</p>
          </div>
          <Button variant="ghost" onClick={() => router.push('/translate')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Translation
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <TranslateProgress events={events} isConnected={isConnected} error={error} />

        {isCompleted && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>Translation completed successfully! Redirecting to articles...</span>
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push('/articles?status=translated')}
              >
                View Translated Articles
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isFailed && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/translate')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              variant="default"
              onClick={() => router.push('/articles')}
            >
              View Articles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
