'use client';

import { useState } from 'react';
import { Article } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages, FileText } from 'lucide-react';

interface ArticleSelectorProps {
  articles: Article[];
  onStartTranslation: (selectedIds: string[]) => void;
  isLoading?: boolean;
}

export default function ArticleSelector({
  articles,
  onStartTranslation,
  isLoading = false,
}: ArticleSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleArticle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map((a) => a.id)));
    }
  };

  const handleStartTranslation = () => {
    if (selectedIds.size > 0) {
      onStartTranslation(Array.from(selectedIds));
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>번역할 기사 선택</CardTitle>
              <CardDescription>
                스크랩 완료된 기사를 선택하여 한글로 번역하세요
              </CardDescription>
            </div>
            <Button
              onClick={handleStartTranslation}
              disabled={selectedIds.size === 0 || isLoading}
              size="lg"
            >
              <Languages className="mr-2 h-4 w-4" />
              {isLoading
                ? '시작 중...'
                : `${selectedIds.size}개 기사 번역하기`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {articles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              번역 가능한 기사가 없습니다. 먼저 기사를 스크랩해주세요.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === articles.length && articles.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="모두 선택"
                    />
                  </TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>출처</TableHead>
                  <TableHead>국가</TableHead>
                  <TableHead>첨부파일</TableHead>
                  <TableHead>스크랩 날짜</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow
                    key={article.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleArticle(article.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                        aria-label={`Select ${article.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-md truncate">
                      {article.title || article.url}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            전체 {articles.length}개 중 {selectedIds.size}개 선택됨
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            선택 해제
          </Button>
        </div>
      )}
    </div>
  );
}
