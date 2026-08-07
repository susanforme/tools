import { formatMediaBytes } from '@/lib/media-tools';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function MediaResult({
  fileName,
  mimeType,
  size,
  url,
}: {
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-4">
        {mimeType.startsWith('video/') && (
          <video
            src={url}
            controls
            className="max-h-[520px] w-full rounded-xl bg-black"
          />
        )}
        {mimeType.startsWith('audio/') && (
          <audio src={url} controls className="w-full" />
        )}
        {mimeType.startsWith('image/') && (
          <img
            src={url}
            alt={fileName}
            className="max-h-[520px] max-w-full rounded-xl"
          />
        )}
        <Button asChild>
          <a href={url} download={fileName}>
            <Download />
            {t('mediaTools.download')} · {formatMediaBytes(size)}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
