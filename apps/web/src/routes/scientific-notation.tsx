import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/scientific-notation')({
  component: ScientificNotationPage,
});

function ScientificNotationPage() {
  return <MathToolPage tool="scientific-notation" />;
}
