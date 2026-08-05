import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

// --- 类型定义 ---

export type UpdateType = 'push' | 'pushIn' | 'replace' | 'replaceIn';

// 基础配置：定义 Param 的标准结构
export interface ParamConfig<T = any> {
  type: string;
  encode: (value: T | null | undefined) => any;
  decode: (value: any) => T | null | undefined;
}

// 🌟 核心修复点：HookParamConfig
// 定义一个更宽泛的接口给 Hook 使用。
// 允许传入基础类型解析器（如 StringParam）来处理更狭窄的字面量联合类型（如 'format' | 'minify'）。
export interface HookParamConfig<T> {
  // encode 的参数使用 T，允许更宽泛的 string 去接受狭窄的 T
  encode: (value: T | null | undefined) => any;
  // decode 返回 any，避免 TypeScript 因为 string 与 'format' 的冲突而报错
  decode: (value: any) => any;
}

// --- 内置参数解析器 (Param Configs) ---

export const StringParam: ParamConfig<string> = {
  type: 'string',
  encode: (val) => (val == null || val === '' ? undefined : String(val)),
  decode: (val) => (val == null ? undefined : String(val)),
};

export const NumberParam: ParamConfig<number> = {
  type: 'number',
  encode: (val) => (val == null ? undefined : Number(val)),
  decode: (val) => {
    if (val == null || val === '') return undefined;
    const num = Number(val);
    return Number.isNaN(num) ? undefined : num;
  },
};

export const ArrayParam: ParamConfig<string[]> = {
  type: 'array',
  encode: (val) => {
    if (val == null) return undefined;
    return Array.isArray(val) ? val : [val];
  },
  decode: (val) => {
    if (val == null || val === '') return undefined;
    return Array.isArray(val) ? val.map(String) : [String(val)];
  },
};

// --- 高阶函数 ---

// withDefault 现在也接受更宽泛的 HookParamConfig，彻底消除类型断言的需要
export function withDefault<T>(
  param: HookParamConfig<T>,
  defaultValue: T,
): ParamConfig<T> {
  return {
    ...param,
    type: (param as any).type
      ? `${(param as any).type}WithDefault`
      : 'withDefault',
    encode: param.encode,
    decode: (value: any) => {
      const decodedValue = param.decode(value);
      return decodedValue === undefined || decodedValue === null
        ? defaultValue
        : decodedValue;
    },
  } as ParamConfig<T>;
}

// --- Hook 1: 单个参数 (useQueryParam) ---

// 重载 1：有 defaultValue，返回值必然是 T
export function useQueryParam<T>(
  name: string,
  paramConfig: HookParamConfig<T>,
  defaultValue: T,
): readonly [
  T,
  (
    newValue: T | null | undefined | ((prev: T) => T | null | undefined),
    updateType?: UpdateType,
  ) => void,
];

// 重载 2：无 defaultValue，返回值可能是 null 或 undefined
export function useQueryParam<T = string>(
  name: string,
  paramConfig?: HookParamConfig<T>,
): readonly [
  T | null | undefined,
  (
    newValue:
      | T
      | null
      | undefined
      | ((prev: T | null | undefined) => T | null | undefined),
    updateType?: UpdateType,
  ) => void,
];

export function useQueryParam<T>(
  name: string,
  paramConfig: HookParamConfig<T> = StringParam as any,
  defaultValue?: T,
) {
  const navigate = useNavigate();

  // 精确订阅
  const rawValue = useRouterState({
    select: (s) => (s.location.search as Record<string, any>)[name],
  });

  const decodedValue = useMemo(() => {
    const value = paramConfig.decode(rawValue);
    return value === undefined || value === null ? defaultValue : value;
  }, [rawValue, paramConfig, defaultValue]);

  const setValue = useCallback(
    (
      newValue:
        | T
        | null
        | undefined
        | ((prev: T | null | undefined) => T | null | undefined),
      updateType: UpdateType = 'replaceIn',
    ) => {
      navigate({
        // @ts-ignore
        search: (prev: Record<string, any>) => {
          // 获取回调触发时最真实的最新状态，而不是渲染时的闭包状态
          let latestValue = paramConfig.decode(prev[name]);
          if (
            defaultValue !== undefined &&
            (latestValue === undefined || latestValue === null)
          ) {
            latestValue = defaultValue;
          }

          const resolvedValue =
            typeof newValue === 'function'
              ? (newValue as Function)(latestValue)
              : newValue;

          const encodedValue = paramConfig.encode(resolvedValue);

          const isMerge = updateType.endsWith('In');
          const newSearch = isMerge ? { ...prev } : {};

          if (encodedValue === undefined || encodedValue === null) {
            delete newSearch[name];
          } else {
            newSearch[name] = encodedValue;
          }

          return newSearch;
        },
        replace: updateType.startsWith('replace'),
      });
    },
    [navigate, name, paramConfig, defaultValue],
  );

  return [decodedValue, setValue] as any;
}

// --- Hook 2: 多个参数 (useQueryParams) ---

// 自动推导 Record 内部每个 key 的类型，支持手动传入狭窄泛型
export function useQueryParams<
  ResultMap extends Record<string, any> = any,
>(paramMap: {
  [K in keyof ResultMap]: HookParamConfig<ResultMap[K]>;
}): readonly [
  Partial<ResultMap>,
  (
    changes:
      | Partial<ResultMap>
      | ((prev: Partial<ResultMap>) => Partial<ResultMap>),
    updateType?: UpdateType,
  ) => void,
] {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (s) => s.location.search as Record<string, any>,
  });

  const query = useMemo(() => {
    const decoded: Partial<ResultMap> = {};
    for (const key in paramMap) {
      decoded[key] = paramMap[key].decode(search[key]);
    }
    return decoded;
  }, [search, paramMap]);

  // 🚀 性能优化：同样解除了对外部 query 状态的依赖
  const setQuery = useCallback(
    (
      changes:
        | Partial<ResultMap>
        | ((prev: Partial<ResultMap>) => Partial<ResultMap>),
      updateType: UpdateType = 'replaceIn',
    ) => {
      navigate({
        // @ts-ignore
        search: (prev: Record<string, any>) => {
          // 在更新函数内实时解析最新状态，支持纯净的函数式更新
          const latestQuery: Partial<ResultMap> = {};
          for (const key in paramMap) {
            latestQuery[key] = paramMap[key].decode(prev[key]);
          }

          const resolvedChanges =
            typeof changes === 'function'
              ? (changes as Function)(latestQuery)
              : changes;

          const isMerge = updateType.endsWith('In');
          const newSearch = isMerge ? { ...prev } : {};

          for (const key in resolvedChanges) {
            const config = paramMap[key];
            if (config) {
              const encodedValue = config.encode(resolvedChanges[key]);
              if (encodedValue === undefined || encodedValue === null) {
                delete newSearch[key];
              } else {
                newSearch[key] = encodedValue;
              }
            }
          }
          return newSearch;
        },
        replace: updateType.startsWith('replace'),
      });
    },
    [navigate, paramMap],
  );

  return [query, setQuery] as const;
}
