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
import { FileText, GripVertical, X } from 'lucide-react';

interface ArticlePickerProps {
  articles: Article[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

export default function ArticlePicker({
  articles,
  selectedIds,
  onSelectionChange,
}: ArticlePickerProps) {
  const toggleArticle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === articles.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(articles.map((a) => a.id));
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...selectedIds];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onSelectionChange(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    const newOrder = [...selectedIds];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onSelectionChange(newOrder);
  };

  const removeArticle = (id: string) => {
    onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const getArticleById = (id: string) => articles.find((a) => a.id === id);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Available Articles */}
      <Card>
        <CardHeader>
          <CardTitle>Available Articles</CardTitle>
          <CardDescription>
            Select translated articles to include in the magazine
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {articles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No translated articles available
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === articles.length && articles.length > 0}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Country</TableHead>
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
                        checked={selectedIds.includes(article.id)}
                        onCheckedChange={() => toggleArticle(article.id)}
                        aria-label={`Select ${article.title_ko || article.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-md truncate">
                      {article.title_ko || article.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {article.source}
                    </TableCell>
                    <TableCell>{getCountryBadge(article.country_code)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Right: Selected Articles (Ordered) */}
      <Card>
        <CardHeader>
          <CardTitle>Selected Articles</CardTitle>
          <CardDescription>
            {selectedIds.length} article{selectedIds.length !== 1 ? 's' : ''} selected. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedIds.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No articles selected
            </div>
          ) : (
            <div className="space-y-2">
              {selectedIds.map((id, index) => {
                const article = getArticleById(id);
                if (!article) return null;

                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <GripVertical className="h-4 w-4 rotate-180" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveDown(index)}
                        disabled={index === selectedIds.length - 1}
                      >
                        <GripVertical className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {article.title_ko || article.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {article.source}
                          </span>
                          {getCountryBadge(article.country_code)}
                          {article.attachments_count && article.attachments_count > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{article.attachments_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArticle(id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
