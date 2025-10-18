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
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (recipients.includes(email)) {
      setError('This email is already in the recipient list');
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
      setError('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject line');
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
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send via Email</CardTitle>
        <CardDescription>
          Send the generated magazine to recipients via email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            type="text"
            placeholder="Monthly Policy Magazine"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Recipients</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
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
            <Label>Recipient List ({recipients.length})</Label>
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
              Email sent successfully to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}!
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
          {isSending ? 'Sending...' : `Send to ${recipients.length} Recipient${recipients.length !== 1 ? 's' : ''}`}
        </Button>
      </CardContent>
    </Card>
  );
}
