import { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { getIncomeTaxBands } from '~/lib/tax-rules';
import type { TaxRules } from '~/lib/tax-rules';
import {
  calculateTax,
  type CalculatorInput,
  type CalculationResult,
} from '~/lib/calculator';

interface TaxRateChartProps {
  input: CalculatorInput;
  result: CalculationResult;
  taxRules: TaxRules;
}

interface DataPoint {
  income: number;
  marginal: number;
  effective: number;
  label?: string;
}

function computeRatesAtIncome(
  targetGross: number,
  baseInput: CalculatorInput,
  rules: TaxRules,
  label?: string,
): DataPoint {
  const r = calculateTax(
    {
      ...baseInput,
      grossSalary: targetGross,
      bonus: 0,
      taxableBenefits: 0,
      rsuVests: 0,
      rsuTaxWithheld: false,
      pensionContribution: { type: 'fixed', value: 0, salarySacrifice: false },
      employerPensionContribution: { type: 'fixed', value: 0 },
      employerNiPassbackPercent: 0,
      otherSalarySacrifice: 0,
      selfEmploymentIncome: 0,
      sippContribution: 0,
    },
    rules,
  );

  const hicbcCharge = r.childBenefit?.hicbcCharge ?? 0;
  const totalTaxNiSl =
    r.incomeTax +
    r.nationalInsurance +
    r.class4Ni +
    r.studentLoanRepayment +
    hicbcCharge;
  const effective =
    r.totalGrossIncome > 0 ? (totalTaxNiSl / r.totalGrossIncome) * 100 : 0;

  return {
    income: targetGross,
    marginal: r.marginalRate * 100,
    effective,
    label,
  };
}

function formatIncome(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return k === Math.floor(k) ? `£${k}k` : `£${k.toFixed(1)}k`;
  }
  return `£${value.toLocaleString()}`;
}

function formatIncomeExact(value: number): string {
  return `£${value.toLocaleString()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload as DataPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-800">
      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
        {formatIncomeExact(point.income)}
      </p>
      {point.label && (
        <p className="mb-1 text-neutral-500 dark:text-neutral-400">
          {point.label}
        </p>
      )}
      <p className="text-red-500">Marginal: {point.marginal.toFixed(1)}%</p>
      <p className="text-blue-500">Effective: {point.effective.toFixed(1)}%</p>
    </div>
  );
}

export function TaxRateChart({ input, result, taxRules }: TaxRateChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const adjustedIncome = result.adjustedNetIncome;

  const data = useMemo(() => {
    const maxIncome = adjustedIncome;
    if (maxIncome <= 0) return [];

    // Tax boundaries with descriptions
    const { personalAllowance: pa, nationalInsurance: ni } = taxRules;
    const itBands = getIncomeTaxBands(taxRules, input.country);
    const niBands = ni.employeeClass1.bands;
    const niUel = ni.employeeClass1.upperEarningsLimit;
    const niUpperRate = niBands.length > 1 ? niBands[1].rate : 0;
    // Effective PA includes blind person's allowance (not subject to taper)
    const bpa = input.isBlind ? taxRules.blindPersonsAllowance : 0;
    const effectivePA = pa.amount + bpa;
    const fullTaperPoint = pa.taperThreshold + pa.amount / pa.taperRate;

    // Convert a taxable-income band threshold to the gross income where it's reached,
    // accounting for the PA taper reducing the allowance above £100k
    function grossForTaxable(taxable: number): number {
      // Below taper: full PA applies
      const g1 = taxable + effectivePA;
      if (g1 <= pa.taperThreshold) return g1;
      // Above full taper: only BPA remains (if blind)
      const g3 = taxable + bpa;
      if (g3 >= fullTaperPoint) return g3;
      // In taper zone: solve taxable = G - (pa.amount - (G - threshold) * rate + bpa)
      return (
        (taxable + pa.amount + pa.taperThreshold * pa.taperRate + bpa) /
        (1 + pa.taperRate)
      );
    }

    const boundaries: { value: number; label: string }[] = [
      {
        value: effectivePA,
        label: 'Personal allowance — income tax and NI start',
      },
      {
        value: niUel,
        label: `NI upper earnings limit — NI drops to ${(niUpperRate * 100).toFixed(0)}%`,
      },
    ];

    // Income tax band thresholds (converted to gross income)
    for (let i = 0; i < itBands.length; i++) {
      const band = itBands[i];
      const nextBand = itBands[i + 1];
      if (band.to !== null && nextBand) {
        boundaries.push({
          value: grossForTaxable(band.to),
          label: `${nextBand.name} threshold — income tax rises to ${(nextBand.rate * 100).toFixed(0)}%`,
        });
      }
    }

    // PA taper zone — compute actual marginal rate at taper start
    const taperStartRate = computeRatesAtIncome(
      pa.taperThreshold + 1,
      input,
      taxRules,
    ).marginal;
    boundaries.push(
      {
        value: pa.taperThreshold,
        label: `PA taper starts — ${Math.round(taperStartRate)}% marginal rate`,
      },
      {
        value: fullTaperPoint,
        label: 'PA fully tapered',
      },
    );

    // Child Benefit HICBC thresholds
    if (input.numberOfChildren > 0) {
      const { threshold, upperThreshold } = taxRules.childBenefit.hicbc;
      const cb = taxRules.childBenefit;
      const annualBenefit =
        cb.weeklyRateFirstChild * cb.weeksPerYear +
        Math.max(0, input.numberOfChildren - 1) *
          cb.weeklyRateAdditionalChild *
          cb.weeksPerYear;
      const hicbcMarginal =
        (annualBenefit / (upperThreshold - threshold)) * 100;
      boundaries.push(
        {
          value: threshold,
          label: `HICBC starts — +${hicbcMarginal.toFixed(1)}% marginal rate`,
        },
        {
          value: upperThreshold,
          label: 'HICBC ends — child benefit fully clawed back',
        },
      );
    }

    // Student loan thresholds — multiple UG plans use lowest threshold
    if (input.undergraduatePlans.length > 0) {
      const lowestPlan = input.undergraduatePlans.reduce((lowest, p) => {
        const plan = taxRules.studentLoans[p];
        const lowestPlanData = taxRules.studentLoans[lowest];
        return plan &&
          lowestPlanData &&
          plan.threshold < lowestPlanData.threshold
          ? p
          : lowest;
      }, input.undergraduatePlans[0]);
      const plan = taxRules.studentLoans[lowestPlan];
      if (plan) {
        const planNames = input.undergraduatePlans
          .map((p) => taxRules.studentLoans[p]?.label)
          .filter(Boolean)
          .join(' + ');
        boundaries.push({
          value: plan.threshold,
          label: `${planNames} — 9% repayment starts`,
        });
      }
    }
    if (input.hasPostgraduateLoan) {
      const pg = taxRules.studentLoans['postgraduate'];
      if (pg) {
        boundaries.push({
          value: pg.threshold,
          label: `${pg.label} threshold — ${(pg.rate * 100).toFixed(0)}% repayment starts`,
        });
      }
    }

    // Merge labels for boundaries at the same value
    const mergedMap = new Map<number, string>();
    for (const b of boundaries) {
      const existing = mergedMap.get(b.value);
      mergedMap.set(b.value, existing ? `${existing}. ${b.label}` : b.label);
    }
    const mergedBoundaries = [...mergedMap.entries()].map(([value, label]) => ({
      value,
      label,
    }));

    const boundaryValues = new Set(mergedBoundaries.map((b) => b.value));

    // Round-number increments
    const increments: number[] = [];
    for (let i = 5000; i <= 200000; i += 5000) increments.push(i);
    for (let i = 250000; i <= 500000; i += 50000) increments.push(i);

    // Drop round numbers within £2k of a boundary
    const MIN_GAP = 2000;
    const boundaryArr = [...boundaryValues];
    const filtered = increments.filter(
      (inc) =>
        !boundaryArr.some((b) => Math.abs(inc - b) < MIN_GAP && inc !== b),
    );

    // Build data points
    const points: DataPoint[] = [];
    const added = new Set<number>();

    // Always add 0
    points.push(computeRatesAtIncome(0, input, taxRules));
    added.add(0);

    // Add boundaries
    for (const b of mergedBoundaries) {
      if (b.value <= maxIncome && b.value > 0 && !added.has(b.value)) {
        points.push(computeRatesAtIncome(b.value, input, taxRules, b.label));
        added.add(b.value);
      }
    }

    // Add filtered increments
    for (const inc of filtered) {
      if (inc <= maxIncome && !added.has(inc)) {
        points.push(computeRatesAtIncome(inc, input, taxRules));
        added.add(inc);
      }
    }

    // Add user's gross
    const roundedMax = Math.round(maxIncome);
    if (!added.has(roundedMax)) {
      points.push(
        computeRatesAtIncome(roundedMax, input, taxRules, 'Your income'),
      );
      added.add(roundedMax);
    } else {
      // Tag existing point
      const existing = points.find((p) => p.income === roundedMax);
      if (existing) {
        existing.label = existing.label
          ? `${existing.label} (your income)`
          : 'Your income';
      }
    }

    points.sort((a, b) => a.income - b.income);

    // Build XAxis ticks: boundaries + a selection of round numbers
    return points;
  }, [adjustedIncome, input, taxRules]);

  const ticks = useMemo(() => {
    if (data.length === 0) return [];
    // Show boundary points and some round numbers on the axis
    const boundaryTicks = data.filter((d) => d.label).map((d) => d.income);
    // Add a few round ticks for scale
    const roundTicks = data
      .filter((d) => !d.label && d.income > 0 && d.income % 25000 === 0)
      .map((d) => d.income);
    return [...new Set([...boundaryTicks, ...roundTicks])].sort(
      (a, b) => a - b,
    );
  }, [data]);

  if (!mounted || adjustedIncome <= 0 || data.length === 0) return null;

  const userPoint = data.find((d) => d.income === Math.round(adjustedIncome));
  const userMarginal = userPoint?.marginal ?? 0;
  const userEffective = userPoint?.effective ?? 0;

  const yMax = Math.max(
    10,
    Math.ceil(
      Math.max(
        ...data.map((d) => d.marginal),
        ...data.map((d) => d.effective),
        userMarginal,
        userEffective,
      ) / 10,
    ) * 10,
  );

  return (
    <div className="mx-auto mt-3 max-w-md">
      <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Tax rate by income
      </p>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#a3a3a3"
              strokeOpacity={0.3}
            />
            <XAxis
              dataKey="income"
              type="number"
              tickFormatter={formatIncome}
              tick={{ fontSize: 9, fill: '#737373' }}
              stroke="#a3a3a3"
              domain={[0, Math.round(adjustedIncome)]}
              ticks={ticks}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#737373' }}
              stroke="#a3a3a3"
              domain={[0, yMax]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="stepAfter"
              dataKey="marginal"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="marginal"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="effective"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="effective"
              isAnimationActive={false}
            />
            <ReferenceLine
              x={Math.round(adjustedIncome)}
              stroke="#737373"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <ReferenceDot
              x={Math.round(adjustedIncome)}
              y={userMarginal}
              r={4}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={2}
            />
            <ReferenceDot
              x={Math.round(adjustedIncome)}
              y={userEffective}
              r={4}
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-500" />
          Marginal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />
          Effective
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 border-t border-dashed border-neutral-500 dark:border-neutral-400" />
          You
        </span>
      </div>
    </div>
  );
}
