import { GamepadTester } from '@/components/gamepad-tester';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/gamepad-test')({
  component: GamepadTester,
});
