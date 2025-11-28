'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getArticle, getAttachmentDownloadUrl } from '@/lib/api-client';
import { Article } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  Globe,
  Building2,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getArticle(articleId);
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '기사를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'translated':
        return <Badge variant="default">번역완료</Badge>;
      case 'extracted':
        return <Badge variant="outline">정제완료</Badge>;
      default:
        return <Badge variant="secondary">스크래핑완료</Badge>;
    }
  };

  const getCountryName = (code?: string) => {
    const names: Record<string, string> = {
      US: '미국',
      UK: '영국',
      JP: '일본',
      KR: '한국',
    };
    return code ? names[code] || code : '-';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="text-center text-muted-foreground">기사를 불러오는 중...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertDescription>기사를 찾을 수 없습니다</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Layout: Content (3/4) + Sidebar (1/4) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Panel - Content (3/4) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Title Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <h1 className="text-2xl font-bold leading-tight">
                    {article.title_ko || article.title || '제목 없음'}
                  </h1>
                  {article.title_ko && article.title && (
                    <p className="text-muted-foreground">
                      {article.title}
                    </p>
                  )}
                </div>
                {getStatusBadge(article.status)}
              </div>
            </CardContent>
          </Card>

          {/* Content Card */}
          <Card className="flex-1">
            <CardContent className="pt-6">
              <Tabs defaultValue={article.content_ko ? 'translation' : 'original'} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="translation" disabled={!article.content_ko}>
                    번역본
                  </TabsTrigger>
                  <TabsTrigger value="original">
                    원문
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="translation" className="mt-0">
                  <div className="min-h-[500px]">
                    <MarkdownViewer content={article.content_ko || ''} />
                  </div>
                </TabsContent>

                <TabsContent value="original" className="mt-0">
                  <div className="min-h-[500px]">
                    <MarkdownViewer content={article.content || ''} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Sidebar (1/4) */}
        <div className="xl:col-span-1 space-y-4">
          {/* Metadata Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">기사 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Source */}
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">출처</p>
                  <p className="text-sm font-medium truncate">{article.source || '-'}</p>
                </div>
              </div>

              {/* Country */}
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">국가</p>
                  <p className="text-sm font-medium">
                    {article.country_code && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-xs bg-muted">
                          {article.country_code}
                        </span>
                        {getCountryName(article.country_code)}
                      </span>
                    )}
                    {!article.country_code && '-'}
                  </p>
                </div>
              </div>

              {/* Published Date */}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">발행일</p>
                  <p className="text-sm font-medium">
                    {article.published_date
                      ? new Date(article.published_date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Scraped Date */}
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">수집일</p>
                  <p className="text-sm font-medium">
                    {new Date(article.scraped_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              {/* URL */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">원문 링크</p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  원문 보기
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Attachments Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>첨부파일</span>
                <Badge variant="secondary" className="font-normal">
                  {article.attachments?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {article.attachments && article.attachments.length > 0 ? (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2 pr-2">
                    {article.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate" title={attachment.filename}>
                            {attachment.filename}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
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
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">첨부파일 없음</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
