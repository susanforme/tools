import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/linear-system')({
  component: LinearSystemPage,
});

function LinearSystemPage() {
  return <MathToolPage tool="linear-system" />;
}
