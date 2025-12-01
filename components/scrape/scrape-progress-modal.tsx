'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/lib/hooks/use-sse';
import { ScrapeProgressEvent, ArticlePreview, ArticleProgressState, ArticleStepStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Circle,
  Ban,
  ExternalLink,
} from 'lucide-react';

interface ScrapeProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  selectedArticles: ArticlePreview[];
}

// Step status icon component
function StepStatusIcon({ status }: { status: ArticleStepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

// Overall status badge
function OverallStatusBadge({ status }: { status: ArticleProgressState['overallStatus'] }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          완료
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          진행중
        </Badge>
      );
    case 'skipped':
      return (
        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
          중복
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
          오류
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          대기
        </Badge>
      );
  }
}

// Source badge with color
function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    fcc: 'bg-blue-100 text-blue-800',
    ofcom: 'bg-purple-100 text-purple-800',
    soumu: 'bg-red-100 text-red-800',
  };
  const sourceKey = source.toLowerCase();
  const colorClass = colors[sourceKey] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${colorClass}`}>
      {sourceKey === 'soumu' ? 'JP' : sourceKey === 'fcc' ? 'US' : sourceKey === 'ofcom' ? 'UK' : source}
    </span>
  );
}

export default function ScrapeProgressModal({
  open,
  onOpenChange,
  jobId,
  selectedArticles,
}: ScrapeProgressModalProps) {
  const router = useRouter();

  // Initialize article progress states from selected articles
  const [articleStates, setArticleStates] = useState<Map<string, ArticleProgressState>>(new Map());

  // Track last processed event index to handle all events sequentially
  const lastProcessedIndexRef = useRef<number>(-1);

  // Initialize states when modal opens with selected articles
  useEffect(() => {
    if (open && selectedArticles.length > 0) {
      const initialStates = new Map<string, ArticleProgressState>();
      selectedArticles.forEach((article) => {
        initialStates.set(article.url, {
          url: article.url,
          title: article.title,
          source: article.source,
          scrapeStatus: 'pending',
          extractStatus: 'pending',
          translateStatus: 'pending',
          overallStatus: 'pending',
        });
      });
      setArticleStates(initialStates);
      // Reset event processing index when modal opens
      lastProcessedIndexRef.current = -1;
    }
  }, [open, selectedArticles]);

  const { events, isConnected } = useSSE<ScrapeProgressEvent>(
    jobId ? `/api/scrape/stream/${jobId}` : null,
    {
      onComplete: () => {
        console.log('Scraping completed!');
      },
      onError: (err) => {
        console.error('SSE error:', err);
      },
    }
  );

  // Update article states based on SSE events - process ALL new events sequentially
  useEffect(() => {
    if (events.length === 0) return;

    // Get only new events since last processed
    const startIndex = lastProcessedIndexRef.current + 1;
    if (startIndex >= events.length) return;

    const newEvents = events.slice(startIndex);

    setArticleStates((prev) => {
      const newStates = new Map(prev);

      for (const event of newEvents) {
        // Skip events without current_url (like 'completed' status)
        if (!event.current_url) continue;

        const currentUrl = event.current_url;
        const existing = newStates.get(currentUrl);

        if (!existing) continue;

        const updated: ArticleProgressState = { ...existing };

        // Handle skipped (duplicate)
        if (event.status === 'skipped') {
          updated.overallStatus = 'skipped';
          updated.scrapeStatus = 'completed';
          updated.extractStatus = 'completed';
          updated.translateStatus = 'completed';
          newStates.set(currentUrl, updated);
          continue;
        }

        // Handle error
        if (event.status === 'error') {
          updated.overallStatus = 'error';
          updated.error = event.error;
          newStates.set(currentUrl, updated);
          continue;
        }

        // Handle step updates
        if (event.step === 'scraped') {
          updated.scrapeStatus = 'completed';
          updated.overallStatus = 'processing';
        } else if (event.step === 'extracting') {
          updated.scrapeStatus = 'completed';
          updated.extractStatus = 'processing';
          updated.overallStatus = 'processing';
        } else if (event.step === 'extracted') {
          updated.scrapeStatus = 'completed';
          updated.extractStatus = 'completed';
          updated.overallStatus = 'processing';
        } else if (event.step === 'translating') {
          updated.scrapeStatus = 'completed';
          updated.extractStatus = 'completed';
          updated.translateStatus = 'processing';
          updated.overallStatus = 'processing';
        }

        // Handle success (all steps completed)
        if (event.status === 'success') {
          updated.scrapeStatus = 'completed';
          updated.extractStatus = 'completed';
          updated.translateStatus = 'completed';
          updated.overallStatus = 'completed';
        }

        newStates.set(currentUrl, updated);
      }

      return newStates;
    });

    // Update last processed index
    lastProcessedIndexRef.current = events.length - 1;
  }, [events]);

  const latestEvent = events[events.length - 1];
  const isCompleted = latestEvent?.status === 'completed';
  const isFailed = latestEvent?.status === 'failed';
  const isProcessing = !isCompleted && !isFailed;

  // Calculate progress based on articleStates (gradual increase, not sudden jump)
  const progress = useMemo(() => {
    if (articleStates.size === 0) return 0;

    let completedSteps = 0;
    const totalSteps = articleStates.size * 3; // 3 steps: scrape, extract, translate

    articleStates.forEach((state) => {
      // Count completed steps
      if (state.scrapeStatus === 'completed') completedSteps++;
      if (state.extractStatus === 'completed') completedSteps++;
      if (state.translateStatus === 'completed') completedSteps++;
    });

    return (completedSteps / totalSteps) * 100;
  }, [articleStates]);

  // Calculate summary stats
  const stats = useMemo(() => {
    let completed = 0;
    let processing = 0;
    let pending = 0;
    let skipped = 0;
    let error = 0;

    articleStates.forEach((state) => {
      switch (state.overallStatus) {
        case 'completed': completed++; break;
        case 'processing': processing++; break;
        case 'skipped': skipped++; break;
        case 'error': error++; break;
        default: pending++; break;
      }
    });

    return { completed, processing, pending, skipped, error, total: articleStates.size };
  }, [articleStates]);

  const handleClose = () => {
    if (isProcessing) return;
    onOpenChange(false);
  };

  const handleGoToArticles = () => {
    onOpenChange(false);
    router.push('/articles');
  };

  const handleNewScrape = () => {
    onOpenChange(false);
  };

  // Convert map to array for rendering
  const articleList = useMemo(() => {
    return Array.from(articleStates.values());
  }, [articleStates]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[1008px] max-h-[85vh] overflow-hidden flex flex-col"
        showCloseButton={!isProcessing}
      >
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {isFailed && <XCircle className="h-5 w-5 text-red-600" />}
            스크래핑 진행 상황
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>
              {latestEvent
                ? `${latestEvent.total}건 중 ${latestEvent.processed}건 처리됨`
                : `${selectedArticles.length}건 처리 대기중...`}
            </span>
            <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
              {isConnected ? '연결됨' : '대기중'}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-1 pb-3 border-b">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>전체 진행률</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Summary Stats - Compact inline */}
        <div className="flex items-center gap-3 py-2 text-xs border-b">
          <span className="text-muted-foreground">현황:</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span className="font-medium">{stats.completed}</span>
          </span>
          {stats.processing > 0 && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
              <span className="font-medium">{stats.processing}</span>
            </span>
          )}
          {stats.skipped > 0 && (
            <span className="flex items-center gap-1">
              <Ban className="h-3 w-3 text-yellow-600" />
              <span className="font-medium">{stats.skipped}</span>
            </span>
          )}
          {stats.error > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-600" />
              <span className="font-medium">{stats.error}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-muted-foreground/40" />
            <span className="font-medium">{stats.pending}</span>
          </span>
        </div>

        {/* Article Progress List */}
        <div className="flex-1 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-2 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
            <span>기사</span>
            <span className="w-10 text-center whitespace-nowrap">소스</span>
            <span className="w-12 text-center whitespace-nowrap">스크랩</span>
            <span className="w-10 text-center whitespace-nowrap">정제</span>
            <span className="w-10 text-center whitespace-nowrap">번역</span>
            <span className="w-14 text-center whitespace-nowrap">상태</span>
          </div>

          <ScrollArea className="h-[320px]">
            <TooltipProvider delayDuration={300}>
              <div className="divide-y">
                {articleList.map((article, idx) => (
                  <div
                    key={article.url}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-2 py-2 items-center text-sm hover:bg-muted/50 transition-colors ${
                      article.overallStatus === 'skipped' ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Title with tooltip */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className={`truncate ${article.overallStatus === 'skipped' ? 'line-through' : ''}`}>
                            {article.title}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-md">
                        <div className="space-y-1">
                          <p className="font-medium">{article.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {article.url}
                          </p>
                          {article.error && (
                            <p className="text-xs text-red-600">오류: {article.error}</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Source */}
                    <div className="w-10 flex justify-center">
                      <SourceBadge source={article.source} />
                    </div>

                    {/* Scrape Status */}
                    <div className="w-12 flex justify-center">
                      <StepStatusIcon status={article.scrapeStatus} />
                    </div>

                    {/* Extract Status */}
                    <div className="w-10 flex justify-center">
                      <StepStatusIcon status={article.extractStatus} />
                    </div>

                    {/* Translate Status */}
                    <div className="w-10 flex justify-center">
                      <StepStatusIcon status={article.translateStatus} />
                    </div>

                    {/* Overall Status */}
                    <div className="w-14 flex justify-center">
                      <OverallStatusBadge status={article.overallStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </ScrollArea>
        </div>

        {/* Completion/Failure Message */}
        {isCompleted && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>
              스크래핑이 완료되었습니다!
              {latestEvent?.success_count && ` ${latestEvent.success_count}건 성공`}
              {latestEvent?.skipped_count ? `, ${latestEvent.skipped_count}건 중복` : ''}
              {latestEvent?.error_count ? `, ${latestEvent.error_count}건 오류` : ''}
            </span>
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>스크래핑에 실패했습니다. 일부 기사는 처리되었을 수 있습니다.</span>
          </div>
        )}

        <DialogFooter className="pt-2">
          {isCompleted && (
            <>
              <Button variant="outline" onClick={handleNewScrape}>
                새 스크래핑
              </Button>
              <Button onClick={handleGoToArticles}>
                기사 보기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}

          {isFailed && (
            <Button variant="outline" onClick={handleNewScrape}>
              다시 시도
            </Button>
          )}

          {isProcessing && (
            <p className="text-xs text-muted-foreground">
              스크래핑이 진행 중입니다. 완료될 때까지 기다려주세요.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
