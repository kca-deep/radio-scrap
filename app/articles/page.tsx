'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getArticles } from '@/lib/api-client';
import { Article } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, FileText, Search, CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export default function ArticlesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from URL
  const [countryCode, setCountryCode] = useState<string>(searchParams.get('country_code') || 'all');
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  // Initialize date ranges from URL
  const [scrapedDateRange, setScrapedDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('scraped_from');
    const to = searchParams.get('scraped_to');
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });

  const [publishedDateRange, setPublishedDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('published_from');
    const to = searchParams.get('published_to');
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });

  // Update URL with current filters
  const updateURL = (filters: Record<string, string>) => {
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
      const filters: any = {};
      if (countryCode && countryCode !== 'all') filters.country_code = countryCode;
      if (status && status !== 'all') filters.status = status;
      if (searchTerm) filters.search = searchTerm;

      // Add scraped date range
      if (scrapedDateRange?.from) {
        filters.scraped_from = format(scrapedDateRange.from, 'yyyy-MM-dd');
      }
      if (scrapedDateRange?.to) {
        filters.scraped_to = format(scrapedDateRange.to, 'yyyy-MM-dd');
      }

      // Add published date range
      if (publishedDateRange?.from) {
        filters.published_from = format(publishedDateRange.from, 'yyyy-MM-dd');
      }
      if (publishedDateRange?.to) {
        filters.published_to = format(publishedDateRange.to, 'yyyy-MM-dd');
      }

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
  }, [countryCode, status, scrapedDateRange, publishedDateRange]);

  const handleSearch = () => {
    fetchArticles();
  };

  const getStatusBadge = (status: string) => {
    return status === 'translated' ? (
      <Badge variant="default">Translated</Badge>
    ) : (
      <Badge variant="secondary">Scraped</Badge>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage scraped articles
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter articles by country, status, date range, or search term</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger>
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="JP">Japan</SelectItem>
                  <SelectItem value="KR">South Korea</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scraped">Scraped</SelectItem>
                  <SelectItem value="translated">Translated</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2 md:col-span-2">
                <Input
                  placeholder="Search by title or source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scraped Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scraped Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !scrapedDateRange && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scrapedDateRange?.from ? (
                        scrapedDateRange.to ? (
                          <>
                            {format(scrapedDateRange.from, 'MMM dd, yyyy')} -{' '}
                            {format(scrapedDateRange.to, 'MMM dd, yyyy')}
                          </>
                        ) : (
                          format(scrapedDateRange.from, 'MMM dd, yyyy')
                        )
                      ) : (
                        <span>Select date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={scrapedDateRange?.from}
                      selected={scrapedDateRange}
                      onSelect={setScrapedDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Published Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Published Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !publishedDateRange && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {publishedDateRange?.from ? (
                        publishedDateRange.to ? (
                          <>
                            {format(publishedDateRange.from, 'MMM dd, yyyy')} -{' '}
                            {format(publishedDateRange.to, 'MMM dd, yyyy')}
                          </>
                        ) : (
                          format(publishedDateRange.from, 'MMM dd, yyyy')
                        )
                      ) : (
                        <span>Select date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={publishedDateRange?.from}
                      selected={publishedDateRange}
                      onSelect={setPublishedDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

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
                Loading articles...
              </div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No articles found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead>Scraped</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <TableRow
                      key={article.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/articles/${article.id}`)}
                    >
                      <TableCell className="font-medium max-w-md truncate">
                        {article.title || article.url}
                      </TableCell>
                      <TableCell>{article.source}</TableCell>
                      <TableCell>{getCountryBadge(article.country_code)}</TableCell>
                      <TableCell>{getStatusBadge(article.status)}</TableCell>
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
            Showing {articles.length} article{articles.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
