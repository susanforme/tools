import { CssUnitConverter } from '@/components/css-unit-converter';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/css-unit')({
  component: CssUnitPage,
});

function CssUnitPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <CssUnitConverter />
    </div>
  );
}
