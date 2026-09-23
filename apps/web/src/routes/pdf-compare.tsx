import { createFileRoute } from '@tanstack/react-router';
import { PracticalPdfTools } from '@/components/practical-pdf-tools';
export const Route = createFileRoute('/pdf-compare')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PracticalPdfTools kind="pdf-compare" />,
});
