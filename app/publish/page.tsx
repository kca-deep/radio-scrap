'use client';

import * as React from 'react';
import { useEffect, useState, useMemo, useRef } from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { getArticles, getArticle, getAttachmentDownloadUrl } from '@/lib/api-client';
import { Article } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  ExternalLink,
  Calendar,
  Building2,
  Grid3X3,
  List,
  TrendingUp,
  ArrowRight,
  FileText,
  Download,
  ChevronDown,
} from 'lucide-react';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';

// Constants
const COUNTRY_OPTIONS = [
  { value: 'all', label: '전체', count: 0 },
  { value: 'KR', label: '한국', count: 0 },
  { value: 'US', label: '미국', count: 0 },
  { value: 'UK', label: '영국', count: 0 },
  { value: 'JP', label: '일본', count: 0 },
];

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
];

// Country badge colors
const COUNTRY_COLORS: Record<string, string> = {
  KR: 'bg-blue-50 text-blue-700 border-blue-200',
  US: 'bg-amber-50 text-amber-700 border-amber-200',
  UK: 'bg-purple-50 text-purple-700 border-purple-200',
  JP: 'bg-red-50 text-red-700 border-red-200',
};

const COUNTRY_NAMES: Record<string, string> = {
  KR: '한국',
  US: '미국',
  UK: '영국',
  JP: '일본',
};

// Group articles by month
function groupByMonth(articles: Article[]): Map<string, Article[]> {
  const groups = new Map<string, Article[]>();

  articles.forEach((article) => {
    const date = article.published_date ? new Date(article.published_date) : new Date();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!groups.has(monthKey)) {
      groups.set(monthKey, []);
    }
    groups.get(monthKey)!.push(article);
  });

  return groups;
}

// Format month key to display string
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${parseInt(month)}월`;
}

// Highlight search term in text
function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-100 text-inherit px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function MagazinePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  // Modal state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Carousel autoplay - 4 second intervals
  const autoplayPlugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true })
  );

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
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

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    let result = [...articles];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (article) =>
          (article.title_ko || article.title || '').toLowerCase().includes(term) ||
          (article.content_ko || article.content || '').toLowerCase().includes(term)
      );
    }

    // Country filter
    if (countryFilter !== 'all') {
      result = result.filter((article) => article.country_code === countryFilter);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.published_date || 0).getTime();
      const dateB = new Date(b.published_date || 0).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [articles, searchTerm, countryFilter, sortOrder]);

  // Count by country
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: articles.length, KR: 0, US: 0, UK: 0, JP: 0 };
    articles.forEach((article) => {
      if (article.country_code && counts[article.country_code] !== undefined) {
        counts[article.country_code]++;
      }
    });
    return counts;
  }, [articles]);

  // Group filtered articles by month
  const groupedArticles = useMemo(() => groupByMonth(filteredArticles), [filteredArticles]);

  // Get recent articles for hero carousel
  const recentArticles = useMemo(() => {
    return [...articles]
      .sort((a, b) => {
        const dateA = new Date(a.published_date || 0).getTime();
        const dateB = new Date(b.published_date || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [articles]);

  const handleArticleClick = async (article: Article) => {
    // Open modal immediately with basic data from list
    setSelectedArticle(article);
    setDetailLoading(true);

    try {
      // Fetch full article with attachments
      const fullArticle = await getArticle(article.id);
      setSelectedArticle(fullArticle);
    } catch (err) {
      console.error('Failed to fetch article details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="container mx-auto max-w-7xl py-6 space-y-6">
      {/* Hero Section - Recent Trends Carousel */}
      {recentArticles.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/50 to-background animate-scale-in">
          {/* Animated Radio Waves Background */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="relative">
              {/* Radio wave circles */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-primary/20"
                  style={{
                    width: `${i * 150}px`,
                    height: `${i * 150}px`,
                    left: `${-i * 75}px`,
                    top: `${-i * 75}px`,
                    animation: `pulse-wave ${2.5 + i * 0.5}s ease-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Animated gradient blobs */}
          <div className="absolute inset-0">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl animate-blob" />
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/10 to-transparent rounded-full blur-3xl animate-blob animation-delay-2000" />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/30 to-background/70" />

          <div className="relative">
            {/* Carousel - Single Slide */}
            <Carousel
              plugins={[autoplayPlugin.current]}
              className="w-full"
              onMouseEnter={autoplayPlugin.current.stop}
              onMouseLeave={autoplayPlugin.current.reset}
              opts={{
                align: 'center',
                loop: true,
              }}
            >
              <CarouselContent>
                {recentArticles.map((article, index) => (
                  <CarouselItem key={article.id} className="basis-full">
                    <div
                      className="cursor-pointer py-6 px-12 md:py-8 md:px-20 lg:px-24"
                      onClick={() => handleArticleClick(article)}
                    >
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            최근 동향 {index + 1} / {recentArticles.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {article.country_code && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-medium"
                            >
                              {COUNTRY_NAMES[article.country_code] || article.country_code}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(article.published_date)}
                          </span>
                        </div>
                      </div>

                      {/* Title - Large */}
                      <h2 className="text-lg md:text-xl lg:text-2xl font-bold leading-tight mb-2 line-clamp-2">
                        {article.title_ko || article.title}
                      </h2>

                      {/* Content Excerpt */}
                      <div className="text-sm text-muted-foreground line-clamp-3 mb-3 leading-relaxed overflow-hidden">
                        <MarkdownViewer
                          content={truncateText(article.content_ko || article.content || '', 500)}
                          className="[&_*]:text-sm [&_p]:my-0 [&_p]:leading-relaxed [&_ul]:my-0 [&_ol]:my-0 [&_li]:leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-sm [&_h6]:text-sm [&_h1]:font-normal [&_h2]:font-normal [&_h3]:font-normal"
                        />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {article.source}
                        </span>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm text-primary hover:text-primary/80"
                        >
                          자세히 보기
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Navigation Buttons */}
              <CarouselPrevious className="left-2 md:left-4 bg-background/80 backdrop-blur-sm border-0 shadow-md" />
              <CarouselNext className="right-2 md:right-4 bg-background/80 backdrop-blur-sm border-0 shadow-md" />
            </Carousel>

            {/* Progress Indicator Dots */}
            <div className="flex justify-center gap-1.5 pb-4">
              {recentArticles.map((_, index) => (
                <div
                  key={index}
                  className="w-1.5 h-1.5 rounded-full bg-primary/30"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <Card className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제목, 본문 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Country Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">국가:</span>
                <ToggleGroup
                  type="single"
                  value={countryFilter}
                  onValueChange={(value) => value && setCountryFilter(value)}
                  className="flex-wrap"
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      size="sm"
                      className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {option.label}
                      <span className="ml-1 text-xs opacity-70">
                        {countryCounts[option.value] || 0}
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <Separator orientation="vertical" className="h-6 hidden sm:block" />

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">정렬:</span>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator orientation="vertical" className="h-6 hidden sm:block" />

              {/* View Mode */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">보기:</span>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => value && setViewMode(value as 'full' | 'compact')}
                >
                  <ToggleGroupItem value="full" size="sm">
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    카드
                  </ToggleGroupItem>
                  <ToggleGroupItem value="compact" size="sm">
                    <List className="h-4 w-4 mr-1" />
                    목록
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            검색 결과: <span className="font-semibold text-foreground">{filteredArticles.length}건</span>
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && filteredArticles.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium">검색 결과가 없습니다</p>
              <p className="text-sm mt-1">다른 검색어나 필터를 사용해보세요</p>
            </CardContent>
          </Card>
        )}

        {/* Articles Grid */}
        {!loading && !error && filteredArticles.length > 0 && (
          <div className="space-y-6">
            {Array.from(groupedArticles.entries()).map(([monthKey, monthArticles]) => (
              <div key={monthKey}>
                {/* Month Divider */}
                <div className="flex items-center gap-4 mb-4">
                  <Separator className="flex-1" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatMonthLabel(monthKey)}
                  </span>
                  <Separator className="flex-1" />
                </div>

                {/* Cards Grid */}
                {viewMode === 'full' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthArticles.map((article, index) => (
                      <Card
                        key={article.id}
                        className="cursor-pointer magazine-card animate-fade-in-up opacity-0"
                        style={{ animationDelay: `${index * 0.1}s` }}
                        onClick={() => handleArticleClick(article)}
                      >
                        <CardContent className="p-4 space-y-3">
                          {/* Header */}
                          <div className="space-y-2">
                            <h3 className="font-semibold line-clamp-2 leading-snug">
                              {highlightText(
                                article.title_ko || article.title || '',
                                searchTerm
                              )}
                            </h3>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(article.published_date)}
                              </span>
                              {article.country_code && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${COUNTRY_COLORS[article.country_code] || ''}`}
                                >
                                  {COUNTRY_NAMES[article.country_code] || article.country_code}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Excerpt */}
                          <div className="text-sm text-muted-foreground line-clamp-3 leading-relaxed overflow-hidden">
                            <MarkdownViewer
                              content={truncateText(article.content_ko || article.content || '', 500)}
                              className="[&_*]:text-sm [&_p]:my-0 [&_p]:leading-relaxed [&_ul]:my-0 [&_ol]:my-0 [&_li]:leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-sm [&_h6]:text-sm [&_h1]:font-normal [&_h2]:font-normal [&_h3]:font-normal"
                            />
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <Button variant="link" className="p-0 h-auto text-sm">
                              자세히 보기
                            </Button>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {article.source}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Compact List View */
                  <div className="space-y-2">
                    {monthArticles.map((article, index) => (
                      <Card
                        key={article.id}
                        className="cursor-pointer magazine-card animate-fade-in-up opacity-0"
                        style={{ animationDelay: `${index * 0.08}s` }}
                        onClick={() => handleArticleClick(article)}
                      >
                        <CardContent className="p-4">
                          {/* Header Row */}
                          <div className="flex items-center gap-3 mb-2">
                            {article.country_code && (
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${COUNTRY_COLORS[article.country_code] || ''}`}
                              >
                                {COUNTRY_NAMES[article.country_code] || article.country_code}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDate(article.published_date)}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                              {article.source}
                            </span>
                          </div>
                          {/* Title */}
                          <h3 className="font-medium line-clamp-1 mb-1">
                            {highlightText(
                              article.title_ko || article.title || '',
                              searchTerm
                            )}
                          </h3>
                          {/* Excerpt */}
                          <div className="text-sm text-muted-foreground line-clamp-2 leading-relaxed overflow-hidden">
                            <MarkdownViewer
                              content={truncateText(article.content_ko || article.content || '', 500)}
                              className="[&_*]:text-sm [&_p]:my-0 [&_p]:leading-relaxed [&_ul]:my-0 [&_ol]:my-0 [&_li]:leading-relaxed [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_h5]:text-sm [&_h6]:text-sm [&_h1]:font-normal [&_h2]:font-normal [&_h3]:font-normal"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Article Detail Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl leading-snug">
                {selectedArticle?.title_ko || selectedArticle?.title}
              </DialogTitle>
              {selectedArticle?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => window.open(selectedArticle.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  원문
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(selectedArticle?.published_date)}
              </span>
              {selectedArticle?.country_code && (
                <Badge
                  variant="outline"
                  className={COUNTRY_COLORS[selectedArticle.country_code] || ''}
                >
                  {COUNTRY_NAMES[selectedArticle.country_code] || selectedArticle.country_code}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {selectedArticle?.source}
              </span>
            </div>
          </DialogHeader>

          {/* Content Area with Scroll */}
          <div className="flex-1 min-h-0 mt-4 border rounded-lg bg-muted/30 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div className="p-6">
                {detailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-32 w-full mt-4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : (
                  <MarkdownViewer
                    content={selectedArticle?.content_ko || selectedArticle?.content || ''}
                    className="prose prose-sm max-w-none dark:prose-invert"
                  />
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Attachments Section - Loading Skeleton */}
          {detailLoading && selectedArticle?.attachments_count && selectedArticle.attachments_count > 0 && (
            <div className="shrink-0 mt-4 p-3 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  첨부파일 ({selectedArticle.attachments_count})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Array.from({ length: selectedArticle.attachments_count }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          {!detailLoading && selectedArticle?.attachments && selectedArticle.attachments.length > 0 && (
            <Collapsible className="shrink-0 mt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors group">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    첨부파일 ({selectedArticle.attachments.length})
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedArticle.attachments.map((attachment) => (
                    <Button
                      key={attachment.id}
                      variant="outline"
                      className="justify-start h-auto py-2 px-3"
                      onClick={() => {
                        const url = getAttachmentDownloadUrl(attachment.id);
                        window.open(url, '_blank');
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm flex-1 text-left">
                        {attachment.filename}
                      </span>
                      <Download className="h-3 w-3 ml-2 shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
