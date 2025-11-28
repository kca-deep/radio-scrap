'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getArticles, deleteArticle } from '@/lib/api-client';
import { Article, ArticleFilters, CountryCode } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, FileText, Search, Trash2, CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function ArticlesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Country options
  const countryOptions = ['US', 'UK', 'JP', 'KR'];

  // Initialize filters from URL
  const [countryCodes, setCountryCodes] = useState<string[]>(() => {
    const codes = searchParams.get('country_code');
    if (codes) {
      return codes.split(',').filter(c => countryOptions.includes(c));
    }
    return countryOptions; // Default: all selected
  });

  // Check if all countries are selected
  const isAllCountriesSelected = countryCodes.length === countryOptions.length;

  const handleAllCountriesToggle = () => {
    if (isAllCountriesSelected) {
      setCountryCodes([]);
    } else {
      setCountryCodes([...countryOptions]);
    }
  };
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('date_from');
    const to = searchParams.get('date_to');
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });

  // Update URL with current filters
  const updateURL = (filters: ArticleFilters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(`/articles${queryString ? `?${queryString}` : ''}`, { scroll: false });
  };

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: ArticleFilters = {};
      // Only filter by country if not all countries are selected
      if (countryCodes.length > 0 && countryCodes.length < countryOptions.length) {
        filters.country_code = countryCodes.join(',') as CountryCode;
      }
      if (searchTerm) filters.search = searchTerm;
      if (dateRange?.from) filters.date_from = format(dateRange.from, 'yyyy-MM-dd');
      if (dateRange?.to) filters.date_to = format(dateRange.to, 'yyyy-MM-dd');

      // Update URL with current filters
      updateURL(filters);

      const data = await getArticles(filters);
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [countryCodes, dateRange]);

  const handleSearch = () => {
    fetchArticles();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteArticle(deleteTarget.id);
      setArticles(articles.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete article');
    } finally {
      setIsDeleting(false);
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
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${colors[code] || 'bg-gray-100 text-gray-800'}`}>
        {code}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">기사 관리</h1>
          <p className="text-muted-foreground mt-2">
            수집된 기사 조회 및 관리
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {/* Country Filter */}
            <div className="flex items-center gap-1">
              <Toggle
                variant="outline"
                pressed={isAllCountriesSelected}
                onPressedChange={handleAllCountriesToggle}
                aria-label="All countries"
              >
                전체
              </Toggle>
              <ToggleGroup
                type="multiple"
                value={countryCodes}
                onValueChange={(values) => setCountryCodes(values)}
                variant="outline"
              >
                <ToggleGroupItem value="US" aria-label="USA">
                  US
                </ToggleGroupItem>
                <ToggleGroupItem value="UK" aria-label="UK">
                  UK
                </ToggleGroupItem>
                <ToggleGroupItem value="JP" aria-label="Japan">
                  JP
                </ToggleGroupItem>
                <ToggleGroupItem value="KR" aria-label="Korea">
                  KR
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !dateRange && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'yy.MM.dd', { locale: ko })} -{' '}
                        {format(dateRange.to, 'yy.MM.dd', { locale: ko })}
                      </>
                    ) : (
                      format(dateRange.from, 'yy.MM.dd', { locale: ko })
                    )
                  ) : (
                    <span>날짜 선택</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ko}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Articles Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                기사 로딩 중...
              </div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                기사를 찾을 수 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>소스</TableHead>
                    <TableHead>국가</TableHead>
                    <TableHead>첨부파일</TableHead>
                    <TableHead>스크랩 날짜</TableHead>
                    <TableHead className="text-right">동작</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow
                      key={article.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/articles/${article.id}`)}
                    >
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate">
                          {article.title_ko || article.title || article.url}
                        </div>
                        {article.title_ko && article.title && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {article.title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{article.source}</TableCell>
                      <TableCell>{getCountryBadge(article.country_code)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{article.attachments_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(article.scraped_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/articles/${article.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(article);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {!loading && articles.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {articles.length}개의 기사 표시
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>기사 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 기사를 삭제하시겠습니까?
              <br />
              <span className="font-medium text-foreground mt-2 block">
                {deleteTarget?.title_ko || deleteTarget?.title || deleteTarget?.url}
              </span>
              <br />
              이 작업은 되돌릴 수 없으며, 관련된 모든 첨부파일도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 max-w-7xl text-center text-muted-foreground">Loading...</div>}>
      <ArticlesPageContent />
    </Suspense>
  );
}
