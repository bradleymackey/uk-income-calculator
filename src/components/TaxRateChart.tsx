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
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-900">
        {formatIncomeExact(point.income)}
      </p>
      {point.label && <p className="mb-1 text-gray-500">{point.label}</p>}
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

    const boundaries: { value: number; label: string }[] = [
      {
        value: pa.amount,
        label: 'Personal allowance — income tax and NI start',
      },
      {
        value: niUel,
        label: `NI upper earnings limit — NI drops to ${(niUpperRate * 100).toFixed(0)}%`,
      },
    ];

    // Income tax band thresholds (shifted by PA)
    for (let i = 0; i < itBands.length; i++) {
      const band = itBands[i];
      const nextBand = itBands[i + 1];
      if (band.to !== null && nextBand) {
        boundaries.push({
          value: pa.amount + band.to,
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
    const lastBand = itBands[itBands.length - 1];
    boundaries.push(
      {
        value: pa.taperThreshold,
        label: `PA taper starts — ${Math.round(taperStartRate)}% marginal rate`,
      },
      {
        value: pa.taperThreshold + pa.amount / pa.taperRate,
        label: `PA fully tapered — ${lastBand.name.toLowerCase()} begins`,
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

    // Student loan thresholds
    if (input.undergraduatePlan !== 'none') {
      const plan = taxRules.studentLoans[input.undergraduatePlan];
      if (plan) {
        boundaries.push({
          value: plan.threshold,
          label: `${plan.label} threshold — ${(plan.rate * 100).toFixed(0)}% repayment starts`,
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

    const boundaryValues = new Set(boundaries.map((b) => b.value));

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
    for (const b of boundaries) {
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
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium text-gray-500">
        Tax rate by income
      </p>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="income"
              type="number"
              tickFormatter={formatIncome}
              tick={{ fontSize: 9, fill: '#6b7280' }}
              stroke="#d1d5db"
              domain={[0, Math.round(adjustedIncome)]}
              ticks={ticks}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              stroke="#d1d5db"
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
              stroke="#6b7280"
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
      <div className="mt-1 flex justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-500" />
          Marginal
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />
          Effective
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 border-t border-dashed border-gray-500" />
          You
        </span>
      </div>
    </div>
  );
}
