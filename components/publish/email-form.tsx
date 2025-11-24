'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Mail, X, Plus, Send } from 'lucide-react';

interface EmailFormProps {
  publicationId: string;
  onSendEmail: (recipients: string[], subject: string) => Promise<void>;
}

export default function EmailForm({ publicationId, onSendEmail }: EmailFormProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const addRecipient = () => {
    const email = currentEmail.trim();

    if (!email) {
      setError('이메일 주소를 입력하세요');
      return;
    }

    if (!validateEmail(email)) {
      setError('올바른 이메일 주소를 입력하세요');
      return;
    }

    if (recipients.includes(email)) {
      setError('이미 수신자 목록에 있는 이메일입니다');
      return;
    }

    setRecipients([...recipients, email]);
    setCurrentEmail('');
    setError(null);
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setError('최소 한 명의 수신자를 추가하세요');
      return;
    }

    if (!subject.trim()) {
      setError('제목을 입력하세요');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(false);

    try {
      await onSendEmail(recipients, subject);
      setSuccess(true);
      setRecipients([]);
      setSubject('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '이메일 전송에 실패했습니다');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>이메일 발송</CardTitle>
        <CardDescription>
          생성된 매거진을 수신자에게 이메일로 발송합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">제목</Label>
          <Input
            id="subject"
            type="text"
            placeholder="월간 정책 매거진"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">받는 사람</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="이메일 주소 입력"
              value={currentEmail}
              onChange={(e) => setCurrentEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addRecipient}
              disabled={isSending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {recipients.length > 0 && (
          <div className="space-y-2">
            <Label>수신자 목록 ({recipients.length}명)</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/50">
              {recipients.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1 pr-1">
                  <Mail className="h-3 w-3" />
                  <span>{email}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-transparent"
                    onClick={() => removeRecipient(email)}
                    disabled={isSending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">
              {recipients.length}명의 수신자에게 이메일을 성공적으로 발송했습니다!
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSend}
          disabled={recipients.length === 0 || !subject.trim() || isSending}
          className="w-full"
          size="lg"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSending ? '발송 중...' : `${recipients.length}명에게 발송`}
        </Button>
      </CardContent>
    </Card>
  );
}
