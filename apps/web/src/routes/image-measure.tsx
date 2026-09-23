import ImageAnalysis from '@/components/image-analysis-workspace';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/image-measure')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ImageAnalysis />,
});
