'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublication, getArticle } from '@/lib/api-client';
import { Publication, Article } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, Globe, Building2 } from 'lucide-react';
import { getAttachmentDownloadUrl } from '@/lib/api-client';

export default function MagazineViewerPage() {
  const params = useParams();
  const publicationId = params.id as string;

  const [publication, setPublication] = useState<Publication | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMagazineData();
  }, [publicationId]);

  const fetchMagazineData = async () => {
    setLoading(true);
    setError(null);

    try {
      const pub = await getPublication(publicationId);
      setPublication(pub);

      const articlePromises = pub.article_ids.map((id) => getArticle(id));
      const fetchedArticles = await Promise.all(articlePromises);
      setArticles(fetchedArticles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load magazine');
    } finally {
      setLoading(false);
    }
  };

  const getCountryBadge = (code?: string) => {
    if (!code) return null;
    const colors: Record<string, string> = {
      US: 'bg-blue-100 text-blue-800',
      UK: 'bg-purple-100 text-purple-800',
      JP: 'bg-red-100 text-red-800',
      KR: 'bg-green-100 text-green-800',
    };
    return (
      <Badge className={colors[code] || 'bg-gray-100 text-gray-800'}>
        {code}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-16 w-96 mx-auto" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>Magazine not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Magazine Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{publication.title}</h1>
          <p className="text-muted-foreground">
            Published on {new Date(publication.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {articles.length} Article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Separator />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Articles */}
        <div className="space-y-8">
          {articles.map((article, index) => (
            <Card key={article.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Article {index + 1}
                      </span>
                      {getCountryBadge(article.country_code)}
                    </div>
                    <CardTitle className="text-2xl">{article.title_ko || article.title}</CardTitle>
                    {article.title_ko && article.title !== article.title_ko && (
                      <CardDescription className="text-base italic">
                        {article.title}
                      </CardDescription>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{article.source}</span>
                  </div>
                  {article.published_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(article.published_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary"
                    >
                      Original Article
                    </a>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* Content */}
                <div className="prose prose-neutral max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {article.content_ko || article.content || 'No content available'}
                  </div>
                </div>

                {/* Attachments */}
                {article.attachments && article.attachments.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4" />
                        <span>Attachments ({article.attachments.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {article.attachments.map((attachment) => (
                          <Button
                            key={attachment.id}
                            variant="outline"
                            className="justify-start h-auto py-2"
                            onClick={() => {
                              const url = getAttachmentDownloadUrl(attachment.id);
                              window.open(url, '_blank');
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="truncate text-sm">{attachment.filename}</span>
                            <Download className="h-3 w-3 ml-auto flex-shrink-0" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>End of Magazine</p>
          {publication.html_path && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}${publication.html_path}`, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download as HTML
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
