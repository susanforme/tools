import { createFileRoute } from '@tanstack/react-router';
import { PracticalPdfTools } from '@/components/practical-pdf-tools';
export const Route = createFileRoute('/pdf-booklet')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <PracticalPdfTools kind="pdf-booklet" />,
});
