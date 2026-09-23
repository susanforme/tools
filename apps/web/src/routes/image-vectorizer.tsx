import { createFileRoute } from '@tanstack/react-router';
import { ImageVectorizer } from '@/components/practical-images';
export const Route = createFileRoute('/image-vectorizer')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: () => <ImageVectorizer />,
});
