import {
  NumberParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

type UnitField = 'px' | 'vw' | 'rem';
type ConvertErrorKey =
  | 'invalidValue'
  | 'invalidViewport'
  | 'invalidRoot'
  | 'invalidBoth'
  | null;
type ConvertQuery = { vwBase: number; remBase: number };
type ConvertValues = {
  px: string;
  vw: string;
  rem: string;
  lastEdited: UnitField;
};

const VIEWPORT_PRESETS = [
  320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920,
] as const;
const DEFAULT_VIEWPORT_WIDTH = 375;
const DEFAULT_ROOT_FONT_SIZE = 16;
const DEFAULT_PX_VALUE = '16';

function parseNumberInput(rawValue: string): number | null {
  if (!rawValue.trim()) return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function parsePositiveNumber(rawValue: string): number | null {
  const value = parseNumberInput(rawValue);
  return value !== null && value > 0 ? value : null;
}

function formatUnitValue(value: number): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return Number(normalized.toFixed(6)).toString();
}

function getBaseErrorKey(
  viewportWidth: number | null,
  rootFontSize: number | null,
): Exclude<ConvertErrorKey, 'invalidValue'> {
  if (viewportWidth === null && rootFontSize === null) return 'invalidBoth';
  if (viewportWidth === null) return 'invalidViewport';
  if (rootFontSize === null) return 'invalidRoot';
  return null;
}

export function buildConvertValues(
  sourceField: UnitField,
  rawValue: string,
  viewportWidth: number | null,
  rootFontSize: number | null,
): {
  values: Omit<ConvertValues, 'lastEdited'>;
  errorKey: ConvertErrorKey;
} {
  const values = { px: '', vw: '', rem: '' };

  if (!rawValue.trim()) return { values, errorKey: null };

  const sourceValue = parseNumberInput(rawValue);
  if (sourceValue === null) {
    return {
      values: { ...values, [sourceField]: rawValue },
      errorKey: 'invalidValue',
    };
  }

  if (sourceField === 'px') {
    return {
      values: {
        px: rawValue,
        vw:
          viewportWidth === null
            ? ''
            : formatUnitValue((sourceValue / viewportWidth) * 100),
        rem:
          rootFontSize === null
            ? ''
            : formatUnitValue(sourceValue / rootFontSize),
      },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  if (sourceField === 'vw') {
    if (viewportWidth === null) {
      return {
        values: { ...values, vw: rawValue },
        errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
      };
    }

    const pxValue = (sourceValue * viewportWidth) / 100;
    return {
      values: {
        px: formatUnitValue(pxValue),
        vw: rawValue,
        rem:
          rootFontSize === null ? '' : formatUnitValue(pxValue / rootFontSize),
      },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  if (rootFontSize === null) {
    return {
      values: { ...values, rem: rawValue },
      errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
    };
  }

  const pxValue = sourceValue * rootFontSize;
  return {
    values: {
      px: formatUnitValue(pxValue),
      vw:
        viewportWidth === null
          ? ''
          : formatUnitValue((pxValue / viewportWidth) * 100),
      rem: rawValue,
    },
    errorKey: getBaseErrorKey(viewportWidth, rootFontSize),
  };
}

function UnitInput({
  label,
  value,
  suffix,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  suffix: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="font-mono"
        />
        <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
          {suffix}
        </div>
      </div>
    </div>
  );
}

export function CssUnitConverter() {
  const { t } = useTranslation();
  const [convertQuery, setConvertQuery] = useQueryParams<ConvertQuery>({
    vwBase: withDefault<number>(NumberParam, DEFAULT_VIEWPORT_WIDTH),
    remBase: withDefault<number>(NumberParam, DEFAULT_ROOT_FONT_SIZE),
  });
  const queryViewportWidth = convertQuery.vwBase ?? DEFAULT_VIEWPORT_WIDTH;
  const queryRootFontSize = convertQuery.remBase ?? DEFAULT_ROOT_FONT_SIZE;
  const [viewportWidthInput, setViewportWidthInput] = useState(
    String(queryViewportWidth),
  );
  const [rootFontSizeInput, setRootFontSizeInput] = useState(
    String(queryRootFontSize),
  );
  const [convertValues, setConvertValues] = useState<ConvertValues>(() => {
    const { values } = buildConvertValues(
      'px',
      DEFAULT_PX_VALUE,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_ROOT_FONT_SIZE,
    );
    return { ...values, lastEdited: 'px' };
  });
  const [convertErrorKey, setConvertErrorKey] = useState<ConvertErrorKey>(null);
  const viewportWidth = parsePositiveNumber(viewportWidthInput);
  const rootFontSize = parsePositiveNumber(rootFontSizeInput);

  useEffect(() => {
    setViewportWidthInput(String(queryViewportWidth));
  }, [queryViewportWidth]);

  useEffect(() => {
    setRootFontSizeInput(String(queryRootFontSize));
  }, [queryRootFontSize]);

  useEffect(() => {
    const sourceField = convertValues.lastEdited;
    const { values, errorKey } = buildConvertValues(
      sourceField,
      convertValues[sourceField],
      viewportWidth,
      rootFontSize,
    );

    setConvertValues((previous) => ({ ...previous, ...values }));
    setConvertErrorKey(errorKey);
  }, [rootFontSize, viewportWidth]);

  const syncConvertValues = (sourceField: UnitField, rawValue: string) => {
    const { values, errorKey } = buildConvertValues(
      sourceField,
      rawValue,
      viewportWidth,
      rootFontSize,
    );

    setConvertValues({ ...values, lastEdited: sourceField });
    setConvertErrorKey(errorKey);
  };

  const handleViewportWidthChange = (rawValue: string) => {
    setViewportWidthInput(rawValue);
    const value = parsePositiveNumber(rawValue);
    if (value !== null) setConvertQuery({ vwBase: value });
  };

  const handleRootFontSizeChange = (rawValue: string) => {
    setRootFontSizeInput(rawValue);
    const value = parsePositiveNumber(rawValue);
    if (value !== null) setConvertQuery({ remBase: value });
  };

  const convertError =
    convertErrorKey === 'invalidValue'
      ? t('css.convertValueError')
      : convertErrorKey === 'invalidBoth'
        ? t('css.convertBothBaseError')
        : convertErrorKey === 'invalidViewport'
          ? t('css.convertViewportError')
          : convertErrorKey === 'invalidRoot'
            ? t('css.convertRootError')
            : null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('css.convertTitle')}</h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setConvertValues({ px: '', vw: '', rem: '', lastEdited: 'px' });
            setConvertErrorKey(null);
          }}
        >
          {t('css.clear')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">{t('css.viewportWidth')}</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={viewportWidthInput}
              onChange={(event) =>
                handleViewportWidthChange(event.target.value)
              }
              placeholder="375"
              className="font-mono"
            />
            <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
              px
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {t('css.commonResolutions')}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {VIEWPORT_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={viewportWidth === preset ? 'default' : 'outline'}
                  className="font-mono"
                  onClick={() => {
                    setViewportWidthInput(String(preset));
                    setConvertQuery({ vwBase: preset });
                  }}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">{t('css.rootFontSize')}</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              value={rootFontSizeInput}
              onChange={(event) => handleRootFontSizeChange(event.target.value)}
              placeholder="16"
              className="font-mono"
            />
            <div className="h-9 min-w-12 rounded-md border bg-muted/40 px-3 text-sm font-mono text-muted-foreground flex items-center justify-center">
              px
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('css.rootFontHint')}
          </p>
        </div>
      </div>

      {convertError && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {convertError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UnitInput
          label={t('css.px')}
          value={convertValues.px}
          suffix="px"
          placeholder="16"
          onChange={(value) => syncConvertValues('px', value)}
        />
        <UnitInput
          label={t('css.vw')}
          value={convertValues.vw}
          suffix="vw"
          placeholder="4.266667"
          onChange={(value) => syncConvertValues('vw', value)}
        />
        <UnitInput
          label={t('css.rem')}
          value={convertValues.rem}
          suffix="rem"
          placeholder="1"
          onChange={(value) => syncConvertValues('rem', value)}
        />
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
        {t('css.convertFormula')}
      </div>
    </div>
  );
}
