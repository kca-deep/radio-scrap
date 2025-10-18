'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getArticles, startTranslation } from '@/lib/api-client';
import { Article } from '@/lib/types';
import ArticleSelector from '@/components/translate/article-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TranslatePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    fetchScrapedArticles();
  }, []);

  const fetchScrapedArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getArticles({ status: 'scraped' });
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTranslation = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return;

    setIsStarting(true);
    setError(null);

    try {
      const { job_id } = await startTranslation(selectedIds);
      router.push(`/translate/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start translation');
      setIsStarting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Translation</h1>
          <p className="text-muted-foreground mt-2">
            Select scraped articles to translate from English to Korean
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <ArticleSelector
            articles={articles}
            onStartTranslation={handleStartTranslation}
            isLoading={isStarting}
          />
        )}

        {!loading && articles.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CardTitle className="mb-2">No Articles to Translate</CardTitle>
              <CardDescription className="mb-4">
                All scraped articles have already been translated, or no articles have been scraped yet.
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
