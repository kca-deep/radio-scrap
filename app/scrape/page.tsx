'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadExcel, startScraping } from '@/lib/api-client';
import ExcelUploader from '@/components/scrape/excel-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function ScrapePage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalUrls, setTotalUrls] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadExcel(file);
      setJobId(result.job_id);
      setTotalUrls(result.total_urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload Excel file');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartScraping = async () => {
    if (!jobId) return;

    setIsStarting(true);
    setError(null);

    try {
      await startScraping(jobId);
      router.push(`/scrape/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scraping');
      setIsStarting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">URL Scraping</h1>
          <p className="text-muted-foreground mt-2">
            Upload an Excel file with URLs to start scraping articles
          </p>
        </div>

        <ExcelUploader onUpload={handleUpload} isLoading={isUploading} />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {jobId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Upload Successful
              </CardTitle>
              <CardDescription>
                Ready to scrape {totalUrls} URLs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Job ID</p>
                  <p className="font-mono text-sm">{jobId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total URLs</p>
                  <p className="text-2xl font-bold">{totalUrls}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleStartScraping}
                  disabled={isStarting}
                  size="lg"
                  className="flex-1"
                >
                  {isStarting ? 'Starting...' : 'Start Scraping'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setJobId(null);
                    setTotalUrls(0);
                  }}
                  disabled={isStarting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
