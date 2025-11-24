'use client';

import { TranslateProgressEvent } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Languages } from 'lucide-react';

interface TranslateProgressProps {
  events: TranslateProgressEvent[];
  isConnected: boolean;
  error?: string | null;
}

export default function TranslateProgress({ events, isConnected, error }: TranslateProgressProps) {
  const latestEvent = events[events.length - 1];

  if (!latestEvent) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>번역 초기화 중...</p>
        </CardContent>
      </Card>
    );
  }

  const progress = latestEvent.total > 0 ? (latestEvent.processed / latestEvent.total) * 100 : 0;
  const isCompleted = latestEvent.status === 'completed';
  const isFailed = latestEvent.status === 'failed';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>번역 진행 상황</CardTitle>
              <CardDescription>
                영어에서 한국어로 기사를 번역하고 있습니다
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isConnected && !isCompleted && !isFailed && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  처리 중
                </Badge>
              )}
              {isCompleted && (
                <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  완료
                </Badge>
              )}
              {isFailed && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  실패
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">진행률</span>
              <span className="font-medium">
                {latestEvent.processed} / {latestEvent.total} 기사
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(progress)}% 완료
            </p>
          </div>

          {latestEvent.current_article_id && !isCompleted && !isFailed && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Languages className="h-5 w-5 text-primary animate-pulse" />
              <div>
                <p className="text-sm font-medium">현재 번역 중</p>
                <p className="text-xs text-muted-foreground">기사 ID: {latestEvent.current_article_id}</p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {latestEvent.error && (
            <Alert variant="destructive">
              <AlertDescription>{latestEvent.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Event Log */}
      {events.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">활동 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.slice().reverse().map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50"
                >
                  {event.status === 'success' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {event.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                  {event.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span className="text-muted-foreground">
                    {event.processed} / {event.total}
                  </span>
                  {event.current_article_id && (
                    <span className="text-muted-foreground">- 기사: {event.current_article_id}</span>
                  )}
                  {event.error && (
                    <span className="text-red-600">- 오류: {event.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
