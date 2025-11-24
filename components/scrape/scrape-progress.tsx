'use client';

import { ScrapeProgressEvent } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Paperclip } from 'lucide-react';

interface ScrapeProgressProps {
  events: ScrapeProgressEvent[];
  isConnected: boolean;
  error?: string | null;
}

export default function ScrapeProgress({ events, isConnected, error }: ScrapeProgressProps) {
  const latestEvent = events[events.length - 1];
  const progress = latestEvent ? (latestEvent.processed / latestEvent.total) * 100 : 0;
  const isCompleted = latestEvent?.status === 'completed';
  const isFailed = latestEvent?.status === 'failed';

  const successEvents = events.filter((e) => e.status === 'success');
  const errorEvents = events.filter((e) => e.status === 'error');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>스크래핑 진행 상황</CardTitle>
              <CardDescription>
                {latestEvent
                  ? `전체 ${latestEvent.total}개 중 ${latestEvent.processed}개 처리됨`
                  : '스크래핑 시작 대기 중...'}
              </CardDescription>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? '연결됨' : '연결 끊김'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">전체 진행률</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {latestEvent && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">처리됨</p>
                <p className="text-2xl font-bold">{latestEvent.processed}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">성공</p>
                <p className="text-2xl font-bold text-green-600">
                  {latestEvent.success_count || successEvents.length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">오류</p>
                <p className="text-2xl font-bold text-red-600">
                  {latestEvent.error_count || errorEvents.length}
                </p>
              </div>
            </div>
          )}

          {latestEvent?.current_url && !isCompleted && !isFailed && (
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 mt-0.5 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium mb-1">현재 처리 중</p>
                <p className="text-xs text-muted-foreground truncate">
                  {latestEvent.current_url}
                </p>
              </div>
            </div>
          )}

          {isCompleted && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                스크래핑이 성공적으로 완료되었습니다!
                {latestEvent.success_count && ` ${latestEvent.success_count}개의 기사가 스크랩되었습니다.`}
              </AlertDescription>
            </Alert>
          )}

          {isFailed && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                스크래핑에 실패했습니다. 자세한 내용은 로그를 확인하세요.
              </AlertDescription>
            </Alert>
          )}

          {error && !isFailed && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>활동 로그</CardTitle>
            <CardDescription>최근 스크래핑 이벤트</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.slice().reverse().map((event, idx) => (
                <div
                  key={events.length - idx}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {event.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : event.status === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{events.length - idx}
                      </span>
                      {event.article_id && (
                        <Badge variant="outline" className="text-xs">
                          {event.article_id.substring(0, 8)}
                        </Badge>
                      )}
                    </div>

                    {event.current_url && (
                      <div className="flex items-center gap-1 text-sm truncate">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.current_url}</span>
                      </div>
                    )}

                    {event.attachments_count !== undefined && event.attachments_count > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Paperclip className="h-3 w-3" />
                        <span>{event.attachments_count}개의 첨부파일 다운로드됨</span>
                      </div>
                    )}

                    {event.error && (
                      <p className="text-xs text-red-600 mt-1">{event.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
