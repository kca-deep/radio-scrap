'use client';

import { useState, useMemo, useCallback } from 'react';
import { previewAutoCollect, startAutoCollect } from '@/lib/api-client';
import ScrapeProgressModal from '@/components/scrape/scrape-progress-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { ArrowRight, Loader2, ExternalLink, CalendarIcon, Globe, AlertCircle, Download } from 'lucide-react';
import type { AutoCollectPreviewResponse, ArticlePreview } from '@/lib/types';

// Constants
const MONTH_OPTIONS_COUNT = 12;

// Generate month options for the last N months
function generateMonthOptions(count: number = MONTH_OPTIONS_COUNT) {
  const options = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(date);
    options.push({ value, label });
  }

  return options;
}

// Combine all articles from different sources into a single list
function combineArticles(data: AutoCollectPreviewResponse['data']): (ArticlePreview & { sourceId: string })[] {
  const combined: (ArticlePreview & { sourceId: string })[] = [];

  if (data.fcc) {
    combined.push(...data.fcc.map(article => ({ ...article, sourceId: 'fcc' })));
  }
  if (data.ofcom) {
    combined.push(...data.ofcom.map(article => ({ ...article, sourceId: 'ofcom' })));
  }
  if (data.soumu) {
    combined.push(...data.soumu.map(article => ({ ...article, sourceId: 'soumu' })));
  }

  // Sort by date (newest first), then by duplicate status (new articles first)
  return combined.sort((a, b) => {
    // Sort duplicates to the end
    if (a.is_duplicate !== b.is_duplicate) {
      return a.is_duplicate ? 1 : -1;
    }
    // Then sort by date
    if (!a.published_date) return 1;
    if (!b.published_date) return -1;
    return b.published_date.localeCompare(a.published_date);
  });
}

// Source info with country codes
const sourceInfo = [
  { id: 'fcc', name: 'FCC', country: 'US' },
  { id: 'ofcom', name: 'Ofcom', country: 'UK' },
  { id: 'soumu', name: 'Soumu', country: 'JP' },
];

export default function ScrapePage() {
  // Progress modal states
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Auto-collect states
  const [selectedSources, setSelectedSources] = useState<string[]>(['fcc', 'ofcom', 'soumu']);
  const [startMonth, setStartMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [endMonth, setEndMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoCollectPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isStartingAutoCollect, setIsStartingAutoCollect] = useState(false);

  // Article selection states
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Combined articles list
  const combinedArticles = useMemo(() => {
    if (!previewResult) return [];
    return combineArticles(previewResult.data);
  }, [previewResult]);

  // Count new articles (not duplicates)
  const newArticlesCount = useMemo(() => {
    return combinedArticles.filter(a => !a.is_duplicate).length;
  }, [combinedArticles]);

  // Count duplicate articles
  const duplicateArticlesCount = useMemo(() => {
    return combinedArticles.filter(a => a.is_duplicate).length;
  }, [combinedArticles]);

  // Selectable articles (non-duplicate only)
  const selectableArticles = useMemo(() => {
    return combinedArticles.filter(a => !a.is_duplicate);
  }, [combinedArticles]);

  // Count selected articles
  const selectedCount = useMemo(() => {
    return selectableArticles.filter(a => selectedUrls.has(a.url)).length;
  }, [selectableArticles, selectedUrls]);

  // Check if all selectable articles are selected
  const isAllSelected = useMemo(() => {
    return selectableArticles.length > 0 && selectedCount === selectableArticles.length;
  }, [selectableArticles, selectedCount]);

  // Toggle single article selection
  const handleArticleToggle = useCallback((url: string, checked: boolean) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(url);
      } else {
        next.delete(url);
      }
      return next;
    });
  }, []);

  // Toggle all articles selection
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedUrls(new Set(selectableArticles.map(a => a.url)));
    } else {
      setSelectedUrls(new Set());
    }
  }, [selectableArticles]);

  // Check if all sources are selected
  const isAllSourcesSelected = selectedSources.length === sourceInfo.length;

  const handleSourceToggle = (values: string[]) => {
    setSelectedSources(values);
  };

  const handleAllSourcesToggle = () => {
    if (isAllSourcesSelected) {
      setSelectedSources([]);
    } else {
      setSelectedSources(sourceInfo.map(s => s.id));
    }
  };

  const handleAutoCollectPreview = async () => {
    if (selectedSources.length === 0) return;

    // Validate date range
    if (startMonth > endMonth) {
      setPreviewError('시작년월이 종료년월보다 클 수 없습니다');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);
    setSelectedUrls(new Set());

    try {
      // Build date_range string: single month or range
      const dateRange = startMonth === endMonth
        ? startMonth
        : `${startMonth}~${endMonth}`;

      const result = await previewAutoCollect({
        sources: selectedSources,
        date_range: dateRange,
      });
      setPreviewResult(result);

      // Auto-select all new (non-duplicate) articles
      const newUrls = new Set<string>();
      Object.values(result.data).forEach(articles => {
        articles?.forEach(article => {
          if (!article.is_duplicate) {
            newUrls.add(article.url);
          }
        });
      });
      setSelectedUrls(newUrls);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '미리보기에 실패했습니다');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleStartAutoCollect = async () => {
    if (selectedCount === 0) {
      setPreviewError('수집할 기사를 선택해주세요');
      return;
    }

    setIsStartingAutoCollect(true);
    setPreviewError(null);

    try {
      // Get selected articles
      const selectedArticles = selectableArticles
        .filter(a => selectedUrls.has(a.url))
        .map(a => ({
          title: a.title,
          url: a.url,
          published_date: a.published_date,
          source: a.source,
        }));

      const result = await startAutoCollect({
        selected_articles: selectedArticles,
      });
      setCurrentJobId(result.job_id);
      setProgressModalOpen(true);
      setIsStartingAutoCollect(false);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '수집 시작에 실패했습니다');
      setIsStartingAutoCollect(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setProgressModalOpen(false);
      setCurrentJobId(null);
      setPreviewResult(null);
    }
  };

  const getCountryBadge = (sourceId: string) => {
    const colors: Record<string, string> = {
      fcc: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      ofcom: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      soumu: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    const source = sourceInfo.find(s => s.id === sourceId);
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[sourceId] || 'bg-gray-100 text-gray-800'}`}>
        {source?.name || sourceId.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">기사 수집</h1>
          <p className="text-muted-foreground mt-2">
            정부기관 웹사이트에서 자동으로 기사를 수집합니다
          </p>
        </div>

        {/* Filters - Horizontal Layout */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {/* Source Filter */}
            <div className="flex items-center gap-1">
              <Toggle
                variant="outline"
                pressed={isAllSourcesSelected}
                onPressedChange={handleAllSourcesToggle}
                aria-label="All sources"
              >
                전체
              </Toggle>
              <ToggleGroup
                type="multiple"
                value={selectedSources}
                onValueChange={handleSourceToggle}
                variant="outline"
              >
                {sourceInfo.map((source) => (
                  <ToggleGroupItem key={source.id} value={source.id} aria-label={source.name}>
                    <span className="mr-1">{source.name}</span>
                    <span className="text-xs text-muted-foreground">{source.country}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Date Range Select */}
            <div className="flex items-center gap-2">
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger className="w-36">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="시작월" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">~</span>
              <Select value={endMonth} onValueChange={setEndMonth}>
                <SelectTrigger className="w-36">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="종료월" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collect Button */}
          <Button
            onClick={handleAutoCollectPreview}
            disabled={selectedSources.length === 0 || isPreviewLoading}
          >
            {isPreviewLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isPreviewLoading ? '수집 중...' : '기사 수집'}
          </Button>
        </div>

        {/* Error Alert */}
        {previewError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {previewResult?.warnings && previewResult.warnings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {previewResult.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm">{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Results Summary Badges */}
        {previewResult && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">수집 결과:</span>
            {previewResult.data.fcc && (
              <Badge variant="outline">
                FCC: {previewResult.data.fcc.filter(a => !a.is_duplicate).length}/{previewResult.data.fcc.length}건
              </Badge>
            )}
            {previewResult.data.ofcom && (
              <Badge variant="outline">
                Ofcom: {previewResult.data.ofcom.filter(a => !a.is_duplicate).length}/{previewResult.data.ofcom.length}건
              </Badge>
            )}
            {previewResult.data.soumu && (
              <Badge variant="outline">
                Soumu: {previewResult.data.soumu.filter(a => !a.is_duplicate).length}/{previewResult.data.soumu.length}건
              </Badge>
            )}
            <span className="text-sm text-muted-foreground ml-2">
              (새 기사: {newArticlesCount}건, 중복: {duplicateArticlesCount}건)
            </span>
          </div>
        )}

        {/* Articles Table */}
        <Card>
          <CardContent className="p-0">
            {!previewResult && !previewError ? (
              <div className="p-12 text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>소스를 선택하고 기사 수집 버튼을 클릭하세요</p>
              </div>
            ) : combinedArticles.length === 0 && previewResult ? (
              <div className="p-12 text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>수집된 기사가 없습니다</p>
              </div>
            ) : combinedArticles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="전체 선택"
                        disabled={selectableArticles.length === 0}
                      />
                    </TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="w-24">소스</TableHead>
                    <TableHead className="w-28">날짜</TableHead>
                    <TableHead className="w-20">상태</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedArticles.map((article, idx) => (
                    <TableRow
                      key={idx}
                      className={article.is_duplicate ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'}
                    >
                      <TableCell>
                        {!article.is_duplicate ? (
                          <Checkbox
                            checked={selectedUrls.has(article.url)}
                            onCheckedChange={(checked) => handleArticleToggle(article.url, checked as boolean)}
                            aria-label={`${article.title} 선택`}
                          />
                        ) : (
                          <span className="block w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-md">
                        <span
                          className={`block truncate ${article.is_duplicate ? 'line-through text-muted-foreground' : ''}`}
                          title={article.title}
                        >
                          {article.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getCountryBadge(article.sourceId)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {article.published_date || '-'}
                      </TableCell>
                      <TableCell>
                        {article.is_duplicate ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                            중복
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
                            신규
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>

        {/* Footer Actions */}
        {previewResult && newArticlesCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount}개 기사 선택됨`
                : '기사를 선택해주세요'}
            </div>
            <Button
              onClick={handleStartAutoCollect}
              disabled={isStartingAutoCollect || selectedCount === 0}
              size="lg"
            >
              {isStartingAutoCollect && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isStartingAutoCollect ? '시작 중...' : `선택한 ${selectedCount}건 수집 시작`}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* All duplicates message */}
        {previewResult && newArticlesCount === 0 && previewResult.total_count > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              모든 기사가 이미 수집되어 있습니다. 새로운 기사가 없습니다.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <ScrapeProgressModal
        open={progressModalOpen}
        onOpenChange={handleModalClose}
        jobId={currentJobId}
        selectedArticles={selectableArticles.filter(a => selectedUrls.has(a.url))}
      />
    </div>
  );
}
