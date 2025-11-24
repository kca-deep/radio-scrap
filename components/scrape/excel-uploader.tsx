'use client';

import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExcelUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export default function ExcelUploader({ onUpload, isLoading = false }: ExcelUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setError('Excel 파일을 업로드해주세요 (.xlsx 또는 .xls)');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 미만이어야 합니다');
      return false;
    }

    setError(null);
    return true;
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (validateFile(file)) {
          setSelectedFile(file);
        }
      }
    },
    []
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setError(null);
      await onUpload(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>URL 목록 업로드</CardTitle>
        <CardDescription>
          스크랩할 기사 URL이 포함된 Excel 파일을 업로드하세요.
          필수 컬럼: title, date, link, source
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : '여기에 Excel 파일을 드롭하세요'}
            </p>
            <p className="text-xs text-muted-foreground">
              또는 클릭하여 파일 선택
            </p>
          </div>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {selectedFile && !error && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button
              onClick={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? '업로드 중...' : '업로드 및 파싱'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
