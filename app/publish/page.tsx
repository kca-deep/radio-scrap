'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { getArticles, getArticle, getAttachmentDownloadUrl } from '@/lib/api-client';
import { Article } from '@/lib/types';
import { Button } from '@/components/ui/button';
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Zap,
  FileText,
  Download,
  ChevronDown,
} from 'lucide-react';
import { MarkdownViewer } from '@/components/ui/markdown-viewer';
import Marquee from 'react-fast-marquee';

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

  // Get recent articles for hero ticker
  const recentArticles = useMemo(() => {
    return [...articles]
      .sort((a, b) => {
        const dateA = new Date(a.published_date || 0).getTime();
        const dateB = new Date(b.published_date || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 10);
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
      {/* Hero Section - News Ticker */}
      {recentArticles.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-muted/30 via-background to-muted/30 animate-scale-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Latest Updates</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs text-muted-foreground">
              {recentArticles.length}건의 최신 기사
            </span>
          </div>

          {/* Ticker Content */}
          <div className="py-3">
            <Marquee speed={30} pauseOnHover gradient gradientWidth={60}>
              {recentArticles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-4 px-4 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors shrink-0"
                  onClick={() => handleArticleClick(article)}
                >
                  {/* Country Badge */}
                  {article.country_code && (
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${COUNTRY_COLORS[article.country_code] || ''}`}
                    >
                      {COUNTRY_NAMES[article.country_code] || article.country_code}
                    </Badge>
                  )}

                  {/* Title */}
                  <span className="font-medium text-sm line-clamp-1 max-w-[400px]">
                    {article.title_ko || article.title}
                  </span>

                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {article.source}
                    </span>
                    <span>|</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.published_date)}
                    </span>
                  </div>
                </div>
              ))}
            </Marquee>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s' }}>
        {/* Search Input */}
        <InputGroup className="w-48 h-8">
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm"
          />
        </InputGroup>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Country Filter */}
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
              className="h-8 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {option.label}
              <span className="ml-1 opacity-70">{countryCounts[option.value] || 0}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Sort */}
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-24 h-8 text-xs">
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

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* View Mode */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as 'full' | 'compact')}
        >
          <ToggleGroupItem value="full" size="sm" className="h-8 px-2">
            <Grid3X3 className="h-3.5 w-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="compact" size="sm" className="h-8 px-2">
            <List className="h-3.5 w-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Results Count */}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredArticles.length}건
        </span>
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
                        <CardContent className="py-2 px-3">
                          {/* Korean Title */}
                          <h3 className="font-semibold line-clamp-1 leading-snug text-sm">
                            {highlightText(
                              article.title_ko || article.title || '',
                              searchTerm
                            )}
                          </h3>
                          {/* Original Title */}
                          {article.title_ko && article.title && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 mb-1">
                              {highlightText(article.title, searchTerm)}
                            </p>
                          )}

                          {/* Meta Row */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              {article.country_code && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${COUNTRY_COLORS[article.country_code] || ''}`}
                                >
                                  {COUNTRY_NAMES[article.country_code] || article.country_code}
                                </Badge>
                              )}
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {article.source}
                              </span>
                            </div>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(article.published_date)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Compact List View */
                  <div className="space-y-1">
                    {monthArticles.map((article, index) => (
                      <Card
                        key={article.id}
                        className="cursor-pointer magazine-card animate-fade-in-up opacity-0"
                        style={{ animationDelay: `${index * 0.08}s` }}
                        onClick={() => handleArticleClick(article)}
                      >
                        <CardContent className="py-1.5 px-3">
                          <div className="flex items-center gap-3">
                            {/* Country Badge */}
                            {article.country_code && (
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${COUNTRY_COLORS[article.country_code] || ''}`}
                              >
                                {COUNTRY_NAMES[article.country_code] || article.country_code}
                              </Badge>
                            )}
                            {/* Titles */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm line-clamp-1">
                                {highlightText(
                                  article.title_ko || article.title || '',
                                  searchTerm
                                )}
                              </h3>
                              {article.title_ko && article.title && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {highlightText(article.title, searchTerm)}
                                </p>
                              )}
                            </div>
                            {/* Meta */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              <span className="hidden sm:block">{article.source}</span>
                              <span>{formatDate(article.published_date)}</span>
                            </div>
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
        <DialogContent className="w-[95vw] sm:max-w-[1400px] h-[90vh] flex flex-col" showCloseButton={false}>
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl leading-snug">
                  {selectedArticle?.title_ko || selectedArticle?.title}
                </DialogTitle>
                {selectedArticle?.title_ko && selectedArticle?.title && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {selectedArticle.title}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedArticle?.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedArticle.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    원문
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedArticle(null)}
                >
                  닫기
                </Button>
              </div>
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

          {/* Content Area with Tabs */}
          <div className="flex-1 min-h-0 mt-4 flex flex-col overflow-hidden">
            <Tabs defaultValue={selectedArticle?.content_ko ? 'translation' : 'original'} className="flex-1 flex flex-col min-h-0">
              <TabsList className="shrink-0 w-fit">
                <TabsTrigger value="translation" disabled={!selectedArticle?.content_ko}>
                  번역본
                </TabsTrigger>
                <TabsTrigger value="original">
                  원문
                </TabsTrigger>
              </TabsList>

              <TabsContent value="translation" className="flex-1 min-h-0 mt-3 border rounded-lg bg-muted/30 overflow-hidden data-[state=inactive]:hidden">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {detailLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <MarkdownViewer
                        content={selectedArticle?.content_ko || ''}
                        className="prose prose-sm max-w-none dark:prose-invert"
                      />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="original" className="flex-1 min-h-0 mt-3 border rounded-lg bg-muted/30 overflow-hidden data-[state=inactive]:hidden">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {detailLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : (
                      <MarkdownViewer
                        content={selectedArticle?.content || ''}
                        className="prose prose-sm max-w-none dark:prose-invert"
                      />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
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
