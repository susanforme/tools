import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/gcd-lcm')({ component: GcdLcmPage });

function GcdLcmPage() {
  return <MathToolPage tool="gcd-lcm" />;
}
