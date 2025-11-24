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
      setError('최소 하나의 기사를 선택해주세요');
      return;
    }

    if (!magazineTitle.trim()) {
      setError('매거진 제목을 입력해주세요');
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
          <h1 className="text-3xl font-bold tracking-tight">매거진 발행</h1>
          <p className="text-muted-foreground mt-2">
            번역된 기사 선택, HTML 매거진 생성 및 이메일 발송
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
            <CardTitle>매거진 설정</CardTitle>
            <CardDescription>매거진 제목과 내용 설정</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">매거진 제목</Label>
              <Input
                id="title"
                type="text"
                placeholder="월간 라디오 정책 매거진 - 2025년 1월"
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
                {isPublishing ? '생성 중...' : 'HTML 매거진 생성'}
              </Button>

              {publicationId && (
                <>
                  <Button variant="secondary" onClick={handleViewPreview}>
                    <Eye className="mr-2 h-4 w-4" />
                    미리보기
                  </Button>
                  {htmlPath && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL}${htmlPath}`, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      HTML 다운로드
                    </Button>
                  )}
                </>
              )}
            </div>

            {publicationId && (
              <Alert>
                <AlertDescription className="text-green-600">
                  매거진이 성공적으로 생성되었습니다! 발행 ID: {publicationId}
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
              <CardTitle className="mb-2">번역된 기사 없음</CardTitle>
              <CardDescription className="mb-4">
                매거진을 발행하기 전에 먼저 기사를 번역해주세요.
              </CardDescription>
              <Button onClick={() => router.push('/translate')}>
                번역으로 이동
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
