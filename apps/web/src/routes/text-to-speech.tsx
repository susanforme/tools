import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createFileRoute } from '@tanstack/react-router';
import { Pause, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/text-to-speech')({
  component: TextToSpeechPage,
});

function TextToSpeechPage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const refresh = () => {
      const next = speechSynthesis.getVoices();
      setVoices(next);
      setVoice((current) => current || next[0]?.voiceURI || '');
    };
    refresh();
    speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', refresh);
      speechSynthesis.cancel();
    };
  }, []);
  const speak = () => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices.find(({ voiceURI }) => voiceURI === voice) ?? null;
    utterance.rate = rate;
    utterance.pitch = pitch;
    speechSynthesis.speak(utterance);
  };
  if (!('speechSynthesis' in window))
    return (
      <div className="p-6 text-destructive">
        {t('textToSpeech.unsupported')}
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('textToSpeech.title')}</h1>
      <Textarea
        aria-label={t('textToSpeech.title')}
        className="min-h-64"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <ChoiceField
          label={t('textToSpeech.voice')}
          value={voice}
          onChange={setVoice}
          options={voices.map((item) => ({
            value: item.voiceURI,
            label: `${item.name} · ${item.lang}`,
          }))}
        />
        <NumberField
          label={t('textToSpeech.rate')}
          value={rate}
          min={0.1}
          step={0.1}
          onChange={setRate}
        />
        <NumberField
          label={t('textToSpeech.pitch')}
          value={pitch}
          min={0}
          step={0.1}
          onChange={setPitch}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!text.trim()} onClick={speak}>
          <Play className="h-4 w-4" />
          {t('textToSpeech.play')}
        </Button>
        <Button variant="outline" onClick={() => speechSynthesis.pause()}>
          <Pause className="h-4 w-4" />
          {t('textToSpeech.pause')}
        </Button>
        <Button variant="outline" onClick={() => speechSynthesis.resume()}>
          {t('textToSpeech.resume')}
        </Button>
        <Button variant="outline" onClick={() => speechSynthesis.cancel()}>
          <Square className="h-4 w-4" />
          {t('textToSpeech.stop')}
        </Button>
      </div>
    </div>
  );
}
