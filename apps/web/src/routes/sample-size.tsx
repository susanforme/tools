import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sample-size')({
  component: SampleSizePage,
});

function SampleSizePage() {
  return <MathToolPage tool="sample-size" />;
}
