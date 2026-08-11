import { EmojiPanel } from '@/components/recommended-tool-panels';
import { createFileRoute } from '@tanstack/react-router';
import { Smile } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/emoji-picker')({
  component: EmojiPickerPage,
});

function EmojiPickerPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Smile className="h-6 w-6 text-amber-500" />
        {t('recommended.emojiPicker')}
      </h1>
      <EmojiPanel />
    </div>
  );
}
