'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getArticles, publishHTML, sendEmail } from '@/lib/api-client';
import { Article } from '@/lib/types';
import ArticlePicker from '@/components/publish/article-picker';
import EmailForm from '@/components/publish/email-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { FileText, Eye, Download } from 'lucide-react';

export default function PublishPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [magazineTitle, setMagazineTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [htmlPath, setHtmlPath] = useState<string | null>(null);

  useEffect(() => {
    fetchTranslatedArticles();
  }, []);

  const fetchTranslatedArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getArticles({ status: 'translated' });
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishHTML = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one article');
      return;
    }

    if (!magazineTitle.trim()) {
      setError('Please enter a magazine title');
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const publication = await publishHTML(magazineTitle, selectedIds);
      setPublicationId(publication.id);
      setHtmlPath(publication.html_path || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate magazine HTML');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSendEmail = async (recipients: string[], subject: string) => {
    if (!publicationId) {
      throw new Error('No publication available. Please generate HTML first.');
    }

    await sendEmail(publicationId, recipients, subject);
  };

  const handleViewPreview = () => {
    if (publicationId) {
      router.push(`/publish/${publicationId}`);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Publish Magazine</h1>
          <p className="text-muted-foreground mt-2">
            Select translated articles, generate HTML magazine, and send via email
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Magazine Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Magazine Settings</CardTitle>
            <CardDescription>Configure your magazine title and content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Magazine Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Monthly Radio Policy Magazine - January 2025"
                value={magazineTitle}
                onChange={(e) => setMagazineTitle(e.target.value)}
                disabled={isPublishing || !!publicationId}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handlePublishHTML}
                disabled={selectedIds.length === 0 || !magazineTitle.trim() || isPublishing || !!publicationId}
                size="lg"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isPublishing ? 'Generating...' : 'Generate HTML Magazine'}
              </Button>

              {publicationId && (
                <>
                  <Button variant="secondary" onClick={handleViewPreview}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  {htmlPath && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}${htmlPath}`, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download HTML
                    </Button>
                  )}
                </>
              )}
            </div>

            {publicationId && (
              <Alert>
                <AlertDescription className="text-green-600">
                  Magazine generated successfully! Publication ID: {publicationId}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Article Selection */}
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
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CardTitle className="mb-2">No Translated Articles</CardTitle>
              <CardDescription className="mb-4">
                Please translate articles first before publishing a magazine.
              </CardDescription>
              <Button onClick={() => router.push('/translate')}>
                Go to Translation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ArticlePicker
            articles={articles}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}

        {/* Email Form (only show after HTML is generated) */}
        {publicationId && (
          <>
            <Separator />
            <EmailForm publicationId={publicationId} onSendEmail={handleSendEmail} />
          </>
        )}
      </div>
    </div>
  );
}
