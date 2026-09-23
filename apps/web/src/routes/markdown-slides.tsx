import { createFileRoute } from '@tanstack/react-router';
import { MarkdownSlides } from '@/components/practical-outlines';
export const Route = createFileRoute('/markdown-slides')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <MarkdownSlides />,
});
