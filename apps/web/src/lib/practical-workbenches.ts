export const HOME_MODES = [
  'paint',
  'wallpaper',
  'flooring',
  'tile',
  'soil',
] as const;
export const BUSINESS_MODES = [
  'breakEven',
  'margin',
  'discounts',
  'dimensionalWeight',
  'reorder',
] as const;
export const STUDY_MODES = [
  'weightedGrade',
  'finalTarget',
  'gpa',
  'studyHours',
  'readingPlan',
] as const;
export type CalculatorMode =
  | (typeof HOME_MODES)[number]
  | (typeof BUSINESS_MODES)[number]
  | (typeof STUDY_MODES)[number];

type Field = { id: string; initial: number; min?: number; max?: number };
export const CALCULATOR_FIELDS: Record<CalculatorMode, readonly Field[]> = {
  paint: [
    { id: 'roomLength', initial: 4, min: 0.01 },
    { id: 'roomWidth', initial: 3, min: 0.01 },
    { id: 'wallHeight', initial: 2.6, min: 0.01 },
    { id: 'openingsArea', initial: 4, min: 0 },
    { id: 'coats', initial: 2, min: 1 },
    { id: 'coverage', initial: 10, min: 0.01 },
    { id: 'wastePercent', initial: 10, min: 0, max: 100 },
  ],
  wallpaper: [
    { id: 'wallPerimeter', initial: 14, min: 0.01 },
    { id: 'wallHeight', initial: 2.6, min: 0.01 },
    { id: 'rollWidth', initial: 0.53, min: 0.01 },
    { id: 'rollLength', initial: 10, min: 0.01 },
    { id: 'patternRepeat', initial: 0.3, min: 0 },
    { id: 'trimAllowance', initial: 0.1, min: 0 },
  ],
  flooring: [
    { id: 'roomLength', initial: 4, min: 0.01 },
    { id: 'roomWidth', initial: 3, min: 0.01 },
    { id: 'packArea', initial: 2.2, min: 0.01 },
    { id: 'wastePercent', initial: 10, min: 0, max: 100 },
  ],
  tile: [
    { id: 'surfaceLength', initial: 3, min: 0.01 },
    { id: 'surfaceWidth', initial: 2, min: 0.01 },
    { id: 'tileLength', initial: 0.3, min: 0.01 },
    { id: 'tileWidth', initial: 0.3, min: 0.01 },
    { id: 'groutWidth', initial: 0.003, min: 0 },
    { id: 'tilesPerBox', initial: 12, min: 1 },
    { id: 'wastePercent', initial: 10, min: 0, max: 100 },
  ],
  soil: [
    { id: 'bedLength', initial: 2, min: 0.01 },
    { id: 'bedWidth', initial: 1, min: 0.01 },
    { id: 'soilDepth', initial: 0.2, min: 0.01 },
    { id: 'bagLiters', initial: 40, min: 0.01 },
    { id: 'wastePercent', initial: 5, min: 0, max: 100 },
  ],
  breakEven: [
    { id: 'fixedCosts', initial: 10000, min: 0 },
    { id: 'sellingPrice', initial: 100, min: 0.01 },
    { id: 'variableCost', initial: 60, min: 0 },
  ],
  margin: [
    { id: 'unitCost', initial: 60, min: 0.01 },
    { id: 'targetMargin', initial: 40, min: 0, max: 99.99 },
  ],
  discounts: [
    { id: 'listPrice', initial: 100, min: 0 },
    { id: 'firstDiscount', initial: 20, min: 0, max: 100 },
    { id: 'secondDiscount', initial: 10, min: 0, max: 100 },
  ],
  dimensionalWeight: [
    { id: 'packageLength', initial: 40, min: 0.01 },
    { id: 'packageWidth', initial: 30, min: 0.01 },
    { id: 'packageHeight', initial: 20, min: 0.01 },
    { id: 'actualWeight', initial: 3, min: 0 },
    { id: 'dimDivisor', initial: 5000, min: 0.01 },
  ],
  reorder: [
    { id: 'dailyDemand', initial: 5, min: 0 },
    { id: 'leadDays', initial: 10, min: 0 },
    { id: 'safetyStock', initial: 20, min: 0 },
    { id: 'currentStock', initial: 40, min: 0 },
  ],
  weightedGrade: [
    { id: 'scoreOne', initial: 85, min: 0, max: 100 },
    { id: 'weightOne', initial: 40, min: 0, max: 100 },
    { id: 'scoreTwo', initial: 90, min: 0, max: 100 },
    { id: 'weightTwo', initial: 60, min: 0, max: 100 },
  ],
  finalTarget: [
    { id: 'currentGrade', initial: 82, min: 0, max: 100 },
    { id: 'completedWeight', initial: 70, min: 0, max: 99.99 },
    { id: 'targetGrade', initial: 85, min: 0, max: 100 },
  ],
  gpa: [
    { id: 'currentGpa', initial: 3.2, min: 0, max: 4 },
    { id: 'completedCredits', initial: 60, min: 0 },
    { id: 'newGradePoints', initial: 3.7, min: 0, max: 4 },
    { id: 'newCredits', initial: 15, min: 0.01 },
  ],
  studyHours: [
    { id: 'availableHours', initial: 20, min: 0 },
    { id: 'priorityOne', initial: 3, min: 0 },
    { id: 'priorityTwo', initial: 2, min: 0 },
    { id: 'priorityThree', initial: 1, min: 0 },
  ],
  readingPlan: [
    { id: 'pagesRemaining', initial: 300, min: 0 },
    { id: 'daysRemaining', initial: 30, min: 1 },
    { id: 'readingDaysPerWeek', initial: 5, min: 1, max: 7 },
  ],
};

export type Calculation = { id: string; value: number; unit: string };

export function calculateWorkbench(
  mode: CalculatorMode,
  input: Record<string, number>,
): Calculation[] {
  for (const field of CALCULATOR_FIELDS[mode]) {
    const value = input[field.id];
    if (
      !Number.isFinite(value) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      throw new Error('invalid');
    }
  }
  const n = (id: string) => input[id];
  const result = (id: string, value: number, unit: string): Calculation => {
    if (!Number.isFinite(value)) throw new Error('invalid');
    return { id, value, unit };
  };
  const withWaste = (value: number) => value * (1 + n('wastePercent') / 100);

  switch (mode) {
    case 'paint': {
      const area =
        2 * (n('roomLength') + n('roomWidth')) * n('wallHeight') -
        n('openingsArea');
      if (area < 0) throw new Error('openingsTooLarge');
      return [
        result('netArea', area, 'm²'),
        result(
          'paintLiters',
          withWaste((area * n('coats')) / n('coverage')),
          'L',
        ),
      ];
    }
    case 'wallpaper': {
      const strip = n('wallHeight') + n('trimAllowance');
      const repeat = n('patternRepeat');
      const cutLength = repeat > 0 ? Math.ceil(strip / repeat) * repeat : strip;
      const perRoll = Math.floor(n('rollLength') / cutLength);
      if (perRoll < 1) throw new Error('rollTooShort');
      const strips = Math.ceil(n('wallPerimeter') / n('rollWidth'));
      return [
        result('strips', strips, ''),
        result('stripsPerRoll', perRoll, ''),
        result('rolls', Math.ceil(strips / perRoll), ''),
      ];
    }
    case 'flooring': {
      const area = n('roomLength') * n('roomWidth');
      return [
        result('netArea', area, 'm²'),
        result('packs', Math.ceil(withWaste(area) / n('packArea')), ''),
      ];
    }
    case 'tile': {
      const horizontal = Math.ceil(
        n('surfaceWidth') / (n('tileWidth') + n('groutWidth')),
      );
      const vertical = Math.ceil(
        n('surfaceLength') / (n('tileLength') + n('groutWidth')),
      );
      const tiles = Math.ceil(withWaste(horizontal * vertical));
      return [
        result('tiles', tiles, ''),
        result('boxes', Math.ceil(tiles / n('tilesPerBox')), ''),
      ];
    }
    case 'soil': {
      const liters = withWaste(
        n('bedLength') * n('bedWidth') * n('soilDepth') * 1000,
      );
      return [
        result('soilLiters', liters, 'L'),
        result('bags', Math.ceil(liters / n('bagLiters')), ''),
      ];
    }
    case 'breakEven': {
      const contribution = n('sellingPrice') - n('variableCost');
      if (contribution <= 0) throw new Error('noContribution');
      const units = Math.ceil(n('fixedCosts') / contribution);
      return [
        result('contribution', contribution, ''),
        result('breakEvenUnits', units, ''),
        result('breakEvenRevenue', units * n('sellingPrice'), ''),
      ];
    }
    case 'margin': {
      const price = n('unitCost') / (1 - n('targetMargin') / 100);
      return [
        result('targetPrice', price, ''),
        result('grossProfit', price - n('unitCost'), ''),
      ];
    }
    case 'discounts': {
      const final =
        n('listPrice') *
        (1 - n('firstDiscount') / 100) *
        (1 - n('secondDiscount') / 100);
      return [
        result('finalPrice', final, ''),
        result('savedAmount', n('listPrice') - final, ''),
        result(
          'effectiveDiscount',
          n('listPrice') === 0 ? 0 : 100 * (1 - final / n('listPrice')),
          '%',
        ),
      ];
    }
    case 'dimensionalWeight': {
      const volume =
        n('packageLength') * n('packageWidth') * n('packageHeight');
      const dimensional = volume / n('dimDivisor');
      return [
        result('packageVolume', volume, 'cm³'),
        result('dimensional', dimensional, 'kg'),
        result(
          'billableWeight',
          Math.max(dimensional, n('actualWeight')),
          'kg',
        ),
      ];
    }
    case 'reorder': {
      const point = Math.ceil(
        n('dailyDemand') * n('leadDays') + n('safetyStock'),
      );
      return [
        result('reorderPoint', point, ''),
        result('stockShortfall', Math.max(0, point - n('currentStock')), ''),
      ];
    }
    case 'weightedGrade': {
      const weight = n('weightOne') + n('weightTwo');
      if (weight <= 0) throw new Error('noWeight');
      return [
        result(
          'weightedAverage',
          (n('scoreOne') * n('weightOne') + n('scoreTwo') * n('weightTwo')) /
            weight,
          '%',
        ),
        result('totalWeight', weight, '%'),
      ];
    }
    case 'finalTarget': {
      const examWeight = 100 - n('completedWeight');
      const required =
        (n('targetGrade') * 100 - n('currentGrade') * n('completedWeight')) /
        examWeight;
      return [
        result('examWeight', examWeight, '%'),
        result('requiredExamScore', required, '%'),
      ];
    }
    case 'gpa':
      return [
        result(
          'newGpa',
          (n('currentGpa') * n('completedCredits') +
            n('newGradePoints') * n('newCredits')) /
            (n('completedCredits') + n('newCredits')),
          '',
        ),
      ];
    case 'studyHours': {
      const weights = [n('priorityOne'), n('priorityTwo'), n('priorityThree')];
      const total = weights.reduce((sum, value) => sum + value, 0);
      if (total <= 0) throw new Error('noWeight');
      return weights.map((value, index) =>
        result(
          `subject${index + 1}Hours`,
          (n('availableHours') * value) / total,
          'h',
        ),
      );
    }
    case 'readingPlan': {
      const sessions = Math.max(
        1,
        Math.ceil((n('daysRemaining') * n('readingDaysPerWeek')) / 7),
      );
      return [
        result('readingSessions', sessions, ''),
        result(
          'pagesPerSession',
          Math.ceil(n('pagesRemaining') / sessions),
          '',
        ),
      ];
    }
  }
}

export const OFFICE_MODES = [
  'agenda',
  'raci',
  'decisions',
  'stockCount',
  'checklist',
] as const;
export type OfficeMode = (typeof OFFICE_MODES)[number];

function rows(input: string, columns: number): string[][] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > 200) throw new Error('rowCount');
  return lines.map((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length !== columns || cells.some((cell) => !cell)) {
      throw new Error('columns');
    }
    return cells;
  });
}

function csvCell(value: string): string {
  const safe =
    /^[=+@-]/.test(value) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildOfficeDocument(
  mode: OfficeMode,
  input: string,
  startTime: string,
  headers?: readonly string[],
): { content: string; extension: 'csv' | 'md'; summary: string } {
  switch (mode) {
    case 'agenda': {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error('time');
      let minute =
        Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
      const lines = rows(input, 2).map(([title, duration]) => {
        const length = Number(duration);
        if (!Number.isInteger(length) || length <= 0 || length > 1440) {
          throw new Error('duration');
        }
        const display = (value: number) =>
          `${String(Math.floor((value % 1440) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}${value >= 1440 ? ` +${Math.floor(value / 1440)}d` : ''}`;
        const line = `- ${display(minute)}–${display(minute + length)} ${title}`;
        minute += length;
        return line;
      });
      return {
        content: lines.join('\n'),
        extension: 'md',
        summary: `${lines.length}`,
      };
    }
    case 'raci': {
      const records = rows(input, 5);
      const output = [
        (
          headers ?? [
            'Task',
            'Responsible',
            'Accountable',
            'Consulted',
            'Informed',
          ]
        )
          .map(csvCell)
          .join(','),
        ...records.map((record) => record.map(csvCell).join(',')),
      ];
      return {
        content: output.join('\r\n'),
        extension: 'csv',
        summary: `${records.length}`,
      };
    }
    case 'decisions': {
      const records = rows(input, 4);
      for (const [date] of records) {
        const parsed = new Date(`${date}T00:00:00Z`);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(parsed.valueOf()) ||
          parsed.toISOString().slice(0, 10) !== date
        ) {
          throw new Error('date');
        }
      }
      const output = records.map(
        ([date, decision, owner, reason]) =>
          `- **${date}** ${decision} — ${owner}\n  - ${reason}`,
      );
      return {
        content: output.join('\n'),
        extension: 'md',
        summary: `${records.length}`,
      };
    }
    case 'stockCount': {
      const records = rows(input, 4);
      const output = [
        (
          headers ?? [
            'SKU',
            'Expected',
            'Counted',
            'Difference',
            'Unit cost',
            'Value difference',
          ]
        )
          .map(csvCell)
          .join(','),
      ];
      let total = 0;
      for (const [sku, expectedText, countedText, costText] of records) {
        const [expected, counted, cost] = [
          expectedText,
          countedText,
          costText,
        ].map(Number);
        if (
          [expected, counted, cost].some(
            (value) => !Number.isFinite(value) || value < 0,
          )
        ) {
          throw new Error('number');
        }
        const difference = counted - expected;
        const value = difference * cost;
        total += value;
        output.push(
          [
            sku,
            expectedText,
            countedText,
            `${difference}`,
            costText,
            value.toFixed(2),
          ]
            .map(csvCell)
            .join(','),
        );
      }
      return {
        content: output.join('\r\n'),
        extension: 'csv',
        summary: total.toFixed(2),
      };
    }
    case 'checklist': {
      const records = rows(input, 2);
      const output = records.map(
        ([step, owner], index) => `- [ ] ${index + 1}. ${step} — ${owner}`,
      );
      return {
        content: output.join('\n'),
        extension: 'md',
        summary: `${records.length}`,
      };
    }
  }
}
