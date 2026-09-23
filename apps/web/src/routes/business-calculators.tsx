import { PracticalCalculatorWorkbench } from '@/components/practical-calculator-workbench';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/business-calculators')({
  component: () => <PracticalCalculatorWorkbench group="business" />,
});
