'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPublication } from '@/lib/api-client';
import { Publication } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, ExternalLink, Mail } from 'lucide-react';

export default function PublicationPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const publicationId = params.id as string;

  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublication();
  }, [publicationId]);

  const fetchPublication = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPublication(publicationId);
      setPublication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch publication');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (publication?.html_path) {
      window.open(`${process.env.NEXT_PUBLIC_API_URL}${publication.html_path}`, '_blank');
    }
  };

  const handleViewMagazine = () => {
    router.push(`/magazine/${publicationId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="space-y-6">
          <Skeleton className="h-12 w-96" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>Publication not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/publish')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Publish
          </Button>
          <div className="flex gap-2">
            {publication.html_path && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download HTML
              </Button>
            )}
            <Button onClick={handleViewMagazine}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Magazine
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Publication Details */}
        <Card>
          <CardHeader>
            <CardTitle>{publication.title}</CardTitle>
            <CardDescription>Publication ID: {publication.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(publication.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Articles</p>
                <p className="text-sm font-medium">{publication.article_ids.length}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium">
                  {publication.sent_at ? (
                    <span className="text-green-600">Sent</span>
                  ) : (
                    <span className="text-yellow-600">Not sent</span>
                  )}
                </p>
              </div>

              {publication.sent_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Sent At</p>
                  <p className="text-sm font-medium">
                    {new Date(publication.sent_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {publication.html_path && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">HTML Path</p>
                <code className="text-xs bg-muted p-2 rounded block">
                  {publication.html_path}
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Article List */}
        <Card>
          <CardHeader>
            <CardTitle>Included Articles</CardTitle>
            <CardDescription>
              {publication.article_ids.length} article{publication.article_ids.length !== 1 ? 's' : ''} in this magazine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {publication.article_ids.map((articleId, index) => (
                <div
                  key={articleId}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/articles/${articleId}`)}
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Article ID: {articleId}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {!publication.sent_at && (
          <Card>
            <CardHeader>
              <CardTitle>Send via Email</CardTitle>
              <CardDescription>
                This magazine has not been sent yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/publish')}>
                <Mail className="mr-2 h-4 w-4" />
                Go to Email Form
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
