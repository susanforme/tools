import {
  runOptionalAuth,
  type OptionalAuthOperation,
  type OptionalAuthResult,
} from '@/lib/optional-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

type OptionalAuthSuccess<T> = Extract<OptionalAuthResult<T>, { ok: true }>;

class OptionalAuthOperationError extends Error {
  constructor(readonly report: boolean) {
    super('optional authenticated operation failed');
  }
}

async function execute<T>(
  operation: OptionalAuthOperation<T>,
): Promise<OptionalAuthSuccess<T>> {
  const result = await runOptionalAuth(operation);
  if (!result.ok) throw new OptionalAuthOperationError(result.report);
  return result;
}

export function useOptionalAuthQuery<T>({
  queryKey,
  operation,
  onReportError,
  staleTime,
}: {
  queryKey: readonly unknown[];
  operation: OptionalAuthOperation<T>;
  onReportError?: () => void;
  staleTime?: number;
}) {
  const lastReportedAt = useRef(0);
  const query = useQuery({
    queryKey,
    queryFn: () => execute(operation),
    retry: false,
    staleTime,
  });

  useEffect(() => {
    if (
      query.error instanceof OptionalAuthOperationError &&
      query.error.report &&
      query.errorUpdatedAt > lastReportedAt.current
    ) {
      lastReportedAt.current = query.errorUpdatedAt;
      onReportError?.();
    }
  }, [onReportError, query.error, query.errorUpdatedAt]);

  return query;
}

export function useOptionalAuthMutation<T, TVariables>({
  operation,
  onReportError,
}: {
  operation: (variables: TVariables) => OptionalAuthOperation<T>;
  onReportError?: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (variables: TVariables) => execute(operation(variables)),
    onError: (error) => {
      if (error instanceof OptionalAuthOperationError && error.report) {
        onReportError?.();
      }
    },
  });

  return {
    ...mutation,
    execute: async (variables: TVariables) => {
      try {
        return await mutation.mutateAsync(variables);
      } catch {
        return null;
      }
    },
  };
}
