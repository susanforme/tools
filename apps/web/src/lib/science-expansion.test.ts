import { expect, test } from 'vitest';
import {
  astronomy,
  astronomyDate,
  astronomyIcs,
} from './astronomy-calculations';
import { calibratedPoint, measurement } from './image-calibration';
import { statistics, numericRows } from './statistical-tests';
import {
  circuitStep,
  EXAMPLE_CIRCUIT,
  gateValue,
  initialCircuitState,
  validCircuit,
} from './digital-circuit';

test('t tests, chi square, ANOVA and regression retain known statistical values', async () => {
  const run = (mode: string, text: string, mu = 0) =>
    statistics({ mode, text, mu, confidence: 0.95 });
  const one = (await run('one', '8 9 10 11 12', 10)).metrics;
  expect(one.t).toBe(0);
  expect(one.p).toBeCloseTo(1);
  expect(one.df).toBe(4);
  expect(one.ciHigh).toBeCloseTo(11.96324316, 5);
  expect(one.difference).toBe(10);
  const shiftedNull = (await run('one', '8 9 10 11 12', 8)).metrics;
  expect(shiftedNull.difference).toBe(10);
  expect(shiftedNull.t).toBeCloseTo(2 * Math.sqrt(2));
  expect(shiftedNull.ciHigh).toBeCloseTo(11.96324316, 5);
  const paired = (await run('paired', '3 4 6 8\n1 3 4 5')).metrics;
  expect(paired.difference).toBe(2);
  expect(paired.t).toBeCloseTo(Math.sqrt(24));
  const welch = (await run('welch', '1 2 3\n3 4 5')).metrics;
  expect(welch.t).toBeCloseTo(-Math.sqrt(6));
  expect(welch.df).toBe(4);
  expect(welch.p).toBeCloseTo(0.0704839969, 6);
  const chi = await run('chi', '30 20\n10 40');
  expect(chi.metrics.chi).toBeCloseTo(16.66666667);
  expect(chi.metrics.p).toBeCloseTo(0.00004455709, 8);
  expect(chi.expected).toEqual([
    [20, 30],
    [20, 30],
  ]);
  expect((await run('chi', '1 1\n1 1')).smallExpected).toBe(true);
  const anova = (await run('anova', '1 2 3\n3 4 5\n5 6 7')).metrics;
  expect(anova.f).toBe(12);
  expect(anova.p).toBeCloseTo(0.008);
  expect(anova.eta).toBe(0.8);
  const regression = await run('regression', '1 3\n2 5\n3 7\n4 9');
  expect(regression.metrics.slope).toBe(2);
  expect(regression.metrics.intercept).toBe(1);
  expect(regression.metrics.r2).toBe(1);
  expect(regression.residuals?.every((r) => r.residual === 0)).toBe(true);
  expect(() => numericRows('1,,3')).toThrow();
  expect(() => numericRows('1 2\n')).not.toThrow();
  await expect(run('paired', '1 2\n1 2 3')).rejects.toThrow('pairedLength');
  await expect(run('one', '2 2')).rejects.toThrow('zeroVariance');
});

test('calibration handles skew and logarithms; planar measurements reject self intersections', () => {
  const axes = [
    { x: 10, y: 100 },
    { x: 110, y: 100 },
    { x: 30, y: 0 },
  ];
  expect(
    calibratedPoint({ x: 70, y: 50 }, axes, [0, 100, 0, 20], false, false),
  ).toEqual({ x: 50, y: 10 });
  expect(
    calibratedPoint({ x: 70, y: 50 }, axes, [1, 100, 10, 1000], true, true),
  ).toEqual({ x: 10, y: 100 });
  expect(() =>
    calibratedPoint(
      { x: 0, y: 0 },
      [axes[0], axes[0], axes[2]],
      [0, 1, 0, 1],
      false,
      false,
    ),
  ).toThrow();
  const reference = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  expect(
    measurement(
      'distance',
      [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ],
      reference,
      10,
    ),
  ).toBe(5);
  expect(
    measurement(
      'angle',
      [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      reference,
      10,
    ),
  ).toBe(90);
  expect(
    measurement(
      'area',
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      reference,
      10,
    ),
  ).toBeCloseTo(50);
  expect(() =>
    measurement(
      'area',
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 100, y: 0 },
      ],
      reference,
      10,
    ),
  ).toThrow();
  expect(() =>
    measurement('distance', reference, [{ x: NaN, y: 0 }, reference[1]], 10),
  ).toThrow();
});

test('circuit propagates unknowns, samples rising edges and rejects cyclic or ambiguous wiring', () => {
  expect(gateValue('AND', 0, null)).toBe(0);
  expect(gateValue('OR', 1, null)).toBe(1);
  expect(gateValue('XOR', 1, null)).toBe(null);
  let state = initialCircuitState();
  state.inputs.input = 1;
  let result = circuitStep(EXAMPLE_CIRCUIT, state, false);
  expect(result.values.output).toBe(0);
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, true);
  expect(result.values.output).toBe(1);
  result.state.inputs.input = 0;
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, false);
  expect(result.values.output).toBe(1);
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, true);
  expect(result.values.output).toBe(1);
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, true);
  expect(result.values.output).toBe(0);
  result.state.inputs.input = null;
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, true);
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, true);
  expect(result.values.output).toBe(null);
  result = circuitStep(EXAMPLE_CIRCUIT, result.state, false);
  expect(result.values.output).toBe(null);
  expect(
    validCircuit({
      ...EXAMPLE_CIRCUIT,
      wires: [...EXAMPLE_CIRCUIT.wires, EXAMPLE_CIRCUIT.wires[0]],
    }),
  ).toBe(false);
  expect(() =>
    circuitStep(
      {
        nodes: [{ id: 'a', kind: 'NOT', label: 'a', x: 0, y: 0 }],
        wires: [{ from: 'a', to: 'a', port: 0 }],
      },
      state,
      false,
    ),
  ).toThrow('circuitCycle');
  const tandem = {
    ...EXAMPLE_CIRCUIT,
    nodes: [
      ...EXAMPLE_CIRCUIT.nodes,
      { id: 'second', kind: 'DFF' as const, label: 'second', x: 0, y: 0 },
    ],
    wires: [
      ...EXAMPLE_CIRCUIT.wires,
      { from: 'register', to: 'second', port: 0 },
      { from: 'clock', to: 'second', port: 1 },
    ],
  };
  state = initialCircuitState();
  state.inputs.input = 1;
  result = circuitStep(tandem, state, true);
  expect(result.values.register).toBe(1);
  expect(result.values.second).toBe(0);
});

test('astronomy validates dates, lunar eclipse epoch and polar visibility; ICS contains real events', async () => {
  expect(astronomyDate('2024-02-29', '02:00', 8).toISOString()).toBe(
    '2024-02-28T18:00:00.000Z',
  );
  expect(() => astronomyDate('2023-02-29', '12:00', 0)).toThrow();
  const result = await astronomy({
    date: '2024-04-08',
    time: '18:20',
    offset: 0,
    latitude: 90,
    longitude: 0,
    height: 0,
  });
  expect(Math.min(result.phase, 360 - result.phase)).toBeLessThan(0.1);
  expect(result.illumination).toBeLessThan(0.001);
  expect(result.bodies).toHaveLength(8);
  expect(result.bodies.every((b) => b.windows.length === 0)).toBe(true);
  expect(
    result.bodies.every(
      (b) => Number.isFinite(b.azimuth) && Number.isFinite(b.altitude),
    ),
  ).toBe(true);
  const ics = astronomyIcs(
    [
      {
        title: 'Moon, phase',
        start: '2024-04-08T18:20:00Z',
        end: '2024-04-08T18:21:00Z',
      },
    ],
    'Test',
  );
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(ics).toContain('DTSTART:20240408T182000Z');
  expect(ics).toContain('SUMMARY:Moon\\, phase');
});
