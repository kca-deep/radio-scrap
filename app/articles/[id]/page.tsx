'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getArticle, updateArticle, getAttachmentDownloadUrl } from '@/lib/api-client';
import { Article } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  Globe,
  Building2,
  Edit,
  Check,
  X,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editTitleKo, setEditTitleKo] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editContentKo, setEditContentKo] = useState('');

  const fetchArticle = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getArticle(articleId);
      setArticle(data);
      setEditTitle(data.title || '');
      setEditTitleKo(data.title_ko || '');
      setEditContent(data.content || '');
      setEditContentKo(data.content_ko || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch article');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  const handleSave = async () => {
    if (!article) return;

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateArticle(articleId, {
        title: editTitle,
        title_ko: editTitleKo,
        content: editContent,
        content_ko: editContentKo,
      });
      setArticle(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update article');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (article) {
      setEditTitle(article.title || '');
      setEditTitleKo(article.title_ko || '');
      setEditContent(article.content || '');
      setEditContentKo(article.content_ko || '');
    }
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    return status === 'translated' ? (
      <Badge variant="default">Translated</Badge>
    ) : (
      <Badge variant="secondary">Scraped</Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <div className="text-center text-muted-foreground">Loading article...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>Article not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/articles')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Articles
          </Button>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Check className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {isEditing ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Article title"
                      className="text-2xl font-bold"
                    />
                  ) : (
                    article.title
                  )}
                </CardTitle>
                {(isEditing || article.title_ko) && (
                  <CardDescription className="text-base">
                    {isEditing ? (
                      <Input
                        value={editTitleKo}
                        onChange={(e) => setEditTitleKo(e.target.value)}
                        placeholder="Korean title"
                      />
                    ) : (
                      article.title_ko
                    )}
                  </CardDescription>
                )}
              </div>
              {getStatusBadge(article.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium">{article.source}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Country</p>
                  <p className="text-sm font-medium">{article.country_code || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Published</p>
                  <p className="text-sm font-medium">
                    {article.published_date
                      ? new Date(article.published_date).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Attachments</p>
                  <p className="text-sm font-medium">{article.attachments?.length || 0}</p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <p className="text-xs text-muted-foreground mb-1">URL</p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {article.url}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Original Content</Label>
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Original content (markdown)"
                  className="mt-2 min-h-[200px] font-mono text-sm"
                />
              ) : (
                <div className="mt-2 p-4 bg-muted rounded-md">
                  <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
                    {article.content || 'No content'}
                  </pre>
                </div>
              )}
            </div>

            {(isEditing || article.content_ko) && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium">Korean Translation</Label>
                  {isEditing ? (
                    <Textarea
                      value={editContentKo}
                      onChange={(e) => setEditContentKo(e.target.value)}
                      placeholder="Korean content (markdown)"
                      className="mt-2 min-h-[200px] font-mono text-sm"
                    />
                  ) : (
                    <div className="mt-2 p-4 bg-muted rounded-md">
                      <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
                        {article.content_ko}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Attachments */}
        {article.attachments && article.attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>
                {article.attachments.length} file{article.attachments.length !== 1 ? 's' : ''}{' '}
                attached
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {article.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{attachment.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          Downloaded {new Date(attachment.downloaded_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = getAttachmentDownloadUrl(attachment.id);
                        window.open(url, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
