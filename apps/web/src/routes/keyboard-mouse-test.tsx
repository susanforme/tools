import { InputDeviceTester } from '@/components/input-device-tester';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/keyboard-mouse-test')({
  component: InputDeviceTester,
});
