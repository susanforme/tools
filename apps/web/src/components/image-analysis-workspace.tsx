import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  calibratedPoint,
  measurement,
  type MeasurePoint,
} from '@/lib/image-calibration';
import { canvasBlob, type ImageSource } from '@/lib/image-document-tools';
import { downloadBlob } from '@/lib/download';
import { ScienceResultFrame } from './science-result-frame';
import { DocumentUpload, useImageDocuments } from './image-document-inputs';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { useLatestJob } from './practical-ui';
type Mark = { kind: string; points: MeasurePoint[] };
export default function ImageAnalysis({
  digitize = false,
}: {
  digitize?: boolean;
}) {
  const { t } = useTranslation(),
    documents = useImageDocuments(),
    source = documents.images[0];
  return (
    <ScienceResultFrame
      title={digitize ? 'image.digitizer' : 'image.title'}
      error={documents.error}
    >
      {source ? (
        <>
          <Button variant="outline" onClick={() => documents.remove(source.id)}>
            {t('scienceExpansion.image.replace')}
          </Button>
          <ImageCanvas key={source.id} source={source} digitize={digitize} />
        </>
      ) : (
        <DocumentUpload
          disabled={documents.loading}
          multiple={false}
          onFiles={(files) => void documents.add(files.slice(0, 1))}
        />
      )}
    </ScienceResultFrame>
  );
}
function ImageCanvas({
  source,
  digitize,
}: {
  source: ImageSource;
  digitize: boolean;
}) {
  const { t } = useTranslation(),
    l = (key: string) => t('scienceExpansion.' + key),
    a = (key: string) => l('image.' + key);
  const [q, set] = useQueryParams<{
    measure: string;
    known: number;
    unit: string;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    xScale: string;
    yScale: string;
  }>({
    measure: StringParam,
    known: NumberParam,
    unit: StringParam,
    x0: NumberParam,
    x1: NumberParam,
    y0: NumberParam,
    y1: NumberParam,
    xScale: StringParam,
    yScale: StringParam,
  });
  const kind = ['distance', 'angle', 'area'].includes(q.measure ?? '')
      ? q.measure!
      : 'distance',
    unit = ['mm', 'cm', 'm'].includes(q.unit ?? '') ? q.unit! : 'mm',
    known = q.known ?? 100;
  const range: [number, number, number, number] = [
    q.x0 ?? 0,
    q.x1 ?? 10,
    q.y0 ?? 0,
    q.y1 ?? 10,
  ];
  const [anchors, setAnchors] = useState<MeasurePoint[]>([]),
    [marks, setMarks] = useState<Mark[]>([]),
    [pending, setPending] = useState<MeasurePoint[]>([]),
    [error, setError] = useState<string | null>(null),
    [pixelX, setPixelX] = useState(0),
    [pixelY, setPixelY] = useState(0),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: source.width / 2, y: source.height / 2 });
  const svg = useRef<SVGSVGElement>(null),
    needed = digitize ? 3 : 2,
    ready = anchors.length === needed;
  const values = useMemo(() => {
    try {
      return {
        data: marks.map((mark) =>
          digitize
            ? calibratedPoint(
                mark.points[0],
                anchors,
                range,
                q.xScale === 'log',
                q.yScale === 'log',
              )
            : measurement(mark.kind, mark.points, anchors, known),
        ),
        error: null,
      };
    } catch (cause) {
      return { data: [], error: (cause as Error).message };
    }
  }, [
    marks,
    anchors,
    range[0],
    range[1],
    range[2],
    range[3],
    q.xScale,
    q.yScale,
    known,
    digitize,
  ]);
  const job = useLatestJob<Blob>(
    JSON.stringify({
      anchors,
      marks,
      known,
      unit,
      range,
      xScale: q.xScale,
      yScale: q.yScale,
    }),
  );
  const addPoint = (point: MeasurePoint) => {
    setError(null);
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > source.width ||
      point.y > source.height
    ) {
      setError('measurementInvalid');
      return;
    }
    if (anchors.length < needed) {
      setAnchors([...anchors, point]);
      return;
    }
    if (marks.length >= 200 || pending.length >= 100) {
      setError('limit');
      return;
    }
    if (digitize) {
      setMarks([...marks, { kind: 'point', points: [point] }]);
      return;
    }
    const next = [...pending, point];
    if (
      (kind === 'distance' && next.length === 2) ||
      (kind === 'angle' && next.length === 3)
    ) {
      try {
        measurement(kind, next, anchors, known);
        setMarks([...marks, { kind, points: next }]);
        setPending([]);
      } catch (cause) {
        setError((cause as Error).message);
      }
    } else setPending(next);
  };
  const finish = () => {
    try {
      measurement('area', pending, anchors, known);
      if (marks.length >= 200) throw Error('limit');
      setMarks([...marks, { kind: 'area', points: pending }]);
      setPending([]);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const resultText = (i: number) => {
    const value = values.data[i];
    return typeof value === 'number'
      ? value.toPrecision(6) +
          ' ' +
          (marks[i].kind === 'angle'
            ? '°'
            : unit + (marks[i].kind === 'area' ? '²' : ''))
      : value
        ? value.x.toPrecision(7) + ', ' + value.y.toPrecision(7)
        : '—';
  };
  const exportCsv = () => {
    if (values.error) return;
    const csv = digitize
      ? 'index,pixelX,pixelY,x,y\n' +
        marks
          .map((m, i) => {
            const v = values.data[i] as MeasurePoint;
            return [i + 1, m.points[0].x, m.points[0].y, v.x, v.y].join(',');
          })
          .join('\n')
      : 'index,type,value,unit\n' +
        marks
          .map((m, i) =>
            [
              i + 1,
              m.kind,
              values.data[i],
              m.kind === 'angle'
                ? 'degree'
                : unit + (m.kind === 'area' ? '^2' : ''),
            ].join(','),
          )
          .join('\n');
    downloadBlob(
      new Blob([csv], { type: 'text/csv' }),
      digitize ? 'chart-points.csv' : 'measurements.csv',
    );
  };
  const annotated = async () => {
    const bitmap = await createImageBitmap(source.blob),
      canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('canvas');
      ctx.drawImage(bitmap, 0, 0);
      ctx.font = Math.max(12, source.width / 70) + 'px sans-serif';
      const draw = (points: MeasurePoint[], color: string, closed = false) => {
        ctx.lineWidth = Math.max(2, source.width / 600);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        if (closed) ctx.closePath();
        ctx.stroke();
        for (const p of points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      draw(anchors, '#2563eb');
      marks.forEach((m, i) => {
        draw(m.points, '#dc2626', m.kind === 'area');
        const p = m.points[0],
          text = i + 1 + ': ' + resultText(i);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeText(text, p.x + 8, p.y + 20);
        ctx.fillStyle = '#991b1b';
        ctx.fillText(text, p.x + 8, p.y + 20);
      });
      return await canvasBlob(canvas);
    } finally {
      bitmap.close();
      canvas.width = canvas.height = 0;
    }
  };
  const viewWidth = source.width / zoom,
    viewHeight = source.height / zoom,
    viewX = Math.max(
      0,
      Math.min(source.width - viewWidth, pan.x - viewWidth / 2),
    ),
    viewY = Math.max(
      0,
      Math.min(source.height - viewHeight, pan.y - viewHeight / 2),
    );
  const pointString = (points: MeasurePoint[]) =>
    points.map((p) => p.x + ',' + p.y).join(' ');
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {a(digitize ? 'stepChart' : 'stepMeasure')}
      </p>
      {!digitize && (
        <p className="text-sm text-muted-foreground">{a('planar')}</p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {digitize ? (
          <>
            {(['x0', 'x1', 'y0', 'y1'] as const).map((key, i) => (
              <NumberField
                key={key}
                label={a(key)}
                value={range[i]}
                min={-1e12}
                max={1e12}
                onChange={(n) => set({ [key]: n })}
              />
            ))}
            {(['xScale', 'yScale'] as const).map((key) => (
              <ChoiceField
                key={key}
                label={a(key)}
                value={q[key] === 'log' ? 'log' : 'linear'}
                options={['linear', 'log'].map((value) => ({
                  value,
                  label: a(value),
                }))}
                onChange={(value) => set({ [key]: value })}
              />
            ))}
          </>
        ) : (
          <>
            <ChoiceField
              label={l('mode')}
              value={kind}
              options={['distance', 'angle', 'area'].map((value) => ({
                value,
                label: a(value),
              }))}
              onChange={(measure) => {
                set({ measure });
                setPending([]);
              }}
            />
            <NumberField
              label={a('known')}
              value={known}
              onChange={(known) => set({ known })}
            />
            <ChoiceField
              label={a('unit')}
              value={unit}
              options={['mm', 'cm', 'm'].map((value) => ({
                value,
                label: value,
              }))}
              onChange={(unit) => set({ unit })}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setAnchors([]);
            setPending([]);
            setMarks([]);
            setError(null);
          }}
        >
          {a('resetCalibration')}
        </Button>
        <Button
          variant="outline"
          disabled={!anchors.length && !marks.length && !pending.length}
          onClick={() =>
            pending.length
              ? setPending(pending.slice(0, -1))
              : marks.length
                ? setMarks(marks.slice(0, -1))
                : setAnchors(anchors.slice(0, -1))
          }
        >
          {l('undo')}
        </Button>
        {!digitize && kind === 'area' && (
          <Button onClick={finish} disabled={pending.length < 3}>
            {a('finishArea')}
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={a('pixelX')}
          value={pixelX}
          max={source.width}
          onChange={setPixelX}
        />
        <NumberField
          label={a('pixelY')}
          value={pixelY}
          max={source.height}
          onChange={setPixelY}
        />
        <Button
          className="self-end"
          onClick={() => addPoint({ x: pixelX, y: pixelY })}
        >
          {a('addPoint')}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <ChoiceField
          label={a('zoom')}
          value={String(zoom)}
          options={[1, 2, 4, 8].map((n) => ({
            value: String(n),
            label: n + '×',
          }))}
          onChange={(n) => setZoom(+n)}
        />
        {(
          [
            ['panLeft', -1, 0],
            ['panRight', 1, 0],
            ['panUp', 0, -1],
            ['panDown', 0, 1],
          ] as const
        ).map(([label, x, y]) => (
          <Button
            key={label}
            variant="outline"
            disabled={zoom === 1}
            onClick={() =>
              setPan((p) => ({
                x: Math.max(
                  viewWidth / 2,
                  Math.min(
                    source.width - viewWidth / 2,
                    p.x + (x * viewWidth) / 4,
                  ),
                ),
                y: Math.max(
                  viewHeight / 2,
                  Math.min(
                    source.height - viewHeight / 2,
                    p.y + (y * viewHeight) / 4,
                  ),
                ),
              }))
            }
          >
            {a(label)}
          </Button>
        ))}
      </div>
      <svg
        ref={svg}
        role="img"
        aria-label={a(digitize ? 'digitizer' : 'title')}
        viewBox={[viewX, viewY, viewWidth, viewHeight].join(' ')}
        className="max-h-[650px] w-full touch-none rounded border bg-muted"
        onPointerDown={(e) => {
          const matrix = svg.current?.getScreenCTM();
          if (matrix) {
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              matrix.inverse(),
            );
            addPoint({ x: p.x, y: p.y });
          }
        }}
      >
        <image href={source.url} width={source.width} height={source.height} />
        <polyline
          points={pointString(anchors)}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2 / zoom}
        />
        {anchors.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5 / zoom} fill="#2563eb" />
            <text
              x={p.x + 8 / zoom}
              y={p.y - 8 / zoom}
              fontSize={16 / zoom}
              fill="#2563eb"
              stroke="#fff"
              strokeWidth={0.2 / zoom}
            >
              {i + 1}
            </text>
          </g>
        ))}
        {[...marks, ...(pending.length ? [{ kind, points: pending }] : [])].map(
          (mark, i) => (
            <g key={i}>
              {mark.kind === 'area' && i < marks.length ? (
                <polygon
                  points={pointString(mark.points)}
                  fill="#dc2626"
                  fillOpacity="0.12"
                  stroke="#dc2626"
                  strokeWidth={2 / zoom}
                />
              ) : (
                <polyline
                  points={pointString(mark.points)}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={2 / zoom}
                />
              )}
              {mark.points.map((p, j) => (
                <circle key={j} cx={p.x} cy={p.y} r={4 / zoom} fill="#dc2626" />
              ))}
              <text
                x={mark.points[0].x + 8 / zoom}
                y={mark.points[0].y + 18 / zoom}
                fontSize={14 / zoom}
                fill="#991b1b"
                stroke="#fff"
                strokeWidth={0.2 / zoom}
              >
                {i + 1}
              </text>
            </g>
          ),
        )}
      </svg>
      {anchors.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {anchors.map((p, i) => (
            <div key={i} className="space-y-2 rounded border p-2">
              <p className="text-sm">
                {a('calibration')} {i + 1}
              </p>
              {(['x', 'y'] as const).map((axis) => (
                <NumberField
                  key={axis}
                  label={i + 1 + ' ' + axis.toUpperCase() + ' (px)'}
                  value={p[axis]}
                  max={axis === 'x' ? source.width : source.height}
                  onChange={(n) => {
                    if (
                      n >= 0 &&
                      n <= (axis === 'x' ? source.width : source.height)
                    )
                      setAnchors(
                        anchors.map((point, j) =>
                          j === i ? { ...point, [axis]: n } : point,
                        ),
                      );
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {ready && marks.length > 0 && (
        <>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">{a('value')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {marks.map((_, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{resultText(i)}</td>
                    <td className="p-2">
                      <Button
                        variant="outline"
                        aria-label={l('remove') + ' ' + (i + 1)}
                        onClick={() =>
                          setMarks(marks.filter((_, j) => i !== j))
                        }
                      >
                        {l('remove')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!values.error} onClick={exportCsv}>
              {a('csv')}
            </Button>
            <Button
              variant="outline"
              disabled={!!values.error || job.busy}
              onClick={() => void job.run(annotated)}
            >
              {a('annotated')}
            </Button>
            {job.result && (
              <Button
                onClick={() => {
                  if (job.result) downloadBlob(job.result, 'annotated.png');
                }}
              >
                {l('download')}
              </Button>
            )}
          </div>
        </>
      )}
      {(error ?? values.error ?? job.error) && (
        <p role="alert" className="text-sm text-destructive">
          {t('scienceExpansion.error', {
            message: t(
              'scienceExpansion.' + (error ?? values.error ?? job.error),
              { defaultValue: error ?? values.error ?? job.error ?? '' },
            ),
          })}
        </p>
      )}
    </div>
  );
}
