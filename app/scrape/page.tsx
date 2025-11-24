'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadExcel, startScraping } from '@/lib/api-client';
import ExcelUploader from '@/components/scrape/excel-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function ScrapePage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalUrls, setTotalUrls] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-collect states
  const [selectedSources, setSelectedSources] = useState<string[]>(['fcc', 'ofcom', 'soumu']);
  const [dateRange, setDateRange] = useState<string>('this-week');
  const [soumuKeywords, setSoumuKeywords] = useState<string>('電波, 通信, 放送, 5G, ICT');

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

  const handleSourceToggle = (source: string, checked: boolean) => {
    setSelectedSources(prev =>
      checked ? [...prev, source] : prev.filter(s => s !== source)
    );
  };

  const handleAutoCollectPreview = async () => {
    // TODO: Implement auto-collect preview API call
    console.log('Auto-collect preview:', { selectedSources, dateRange, soumuKeywords });
    alert('Auto-collect preview feature coming soon!');
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">URL 스크래핑</h1>
          <p className="text-muted-foreground mt-2">
            Excel 파일을 업로드하거나 정부 기관 웹사이트에서 자동으로 기사를 수집합니다
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Excel 업로드</TabsTrigger>
            <TabsTrigger value="auto-collect">자동 수집</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
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
                    업로드 완료
                  </CardTitle>
                  <CardDescription>
                    {totalUrls}개 URL 스크래핑 준비 완료
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">작업 ID</p>
                      <p className="font-mono text-sm">{jobId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">전체 URL</p>
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
                      {isStarting ? '시작 중...' : '스크래핑 시작'}
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
                      취소
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="auto-collect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>자동 수집 설정</CardTitle>
                <CardDescription>
                  수집할 소스를 선택하고 수집 조건을 설정하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-medium">소스 선택</Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="source-fcc"
                        checked={selectedSources.includes('fcc')}
                        onCheckedChange={(checked) => handleSourceToggle('fcc', checked as boolean)}
                      />
                      <Label htmlFor="source-fcc" className="font-normal cursor-pointer">
                        FCC (미국)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="source-ofcom"
                        checked={selectedSources.includes('ofcom')}
                        onCheckedChange={(checked) => handleSourceToggle('ofcom', checked as boolean)}
                      />
                      <Label htmlFor="source-ofcom" className="font-normal cursor-pointer">
                        Ofcom (영국)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="source-soumu"
                        checked={selectedSources.includes('soumu')}
                        onCheckedChange={(checked) => handleSourceToggle('soumu', checked as boolean)}
                      />
                      <Label htmlFor="source-soumu" className="font-normal cursor-pointer">
                        총무성 (일본)
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">수집 기간</Label>
                  <RadioGroup value={dateRange} onValueChange={setDateRange}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="today" id="period-today" />
                      <Label htmlFor="period-today" className="font-normal cursor-pointer">
                        오늘
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="this-week" id="period-this-week" />
                      <Label htmlFor="period-this-week" className="font-normal cursor-pointer">
                        이번 주 (월요일 - 일요일)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="last-week" id="period-last-week" />
                      <Label htmlFor="period-last-week" className="font-normal cursor-pointer">
                        지난 주
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {selectedSources.includes('soumu') && (
                  <div className="space-y-3">
                    <Label htmlFor="soumu-keywords" className="text-base font-medium">
                      총무성 검색 키워드 (쉼표로 구분)
                    </Label>
                    <Input
                      id="soumu-keywords"
                      value={soumuKeywords}
                      onChange={(e) => setSoumuKeywords(e.target.value)}
                      placeholder="電波, 通信, 放送, 5G, ICT"
                    />
                    <p className="text-sm text-muted-foreground">
                      기본 키워드: 電波, 通信, 放送, 5G, ICT
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={handleAutoCollectPreview}
                disabled={selectedSources.length === 0}
                size="lg"
                className="flex-1"
              >
                미리보기
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
