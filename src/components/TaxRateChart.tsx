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
}

function computeRatesAtIncome(
  targetGross: number,
  baseInput: CalculatorInput,
  rules: TaxRules,
): DataPoint {
  // Show the underlying tax system rates (tax + NI + student loan) without
  // pension/SIPP distortion. Pension is a personal choice, not a tax — it
  // shouldn't shift the rate curves. Student loan IS included since it's a
  // mandatory deduction based on income.
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
      sippContribution: 0,
    },
    rules,
  );

  const totalTaxNiSl =
    r.incomeTax + r.nationalInsurance + r.studentLoanRepayment;
  const effective =
    r.totalGrossIncome > 0 ? (totalTaxNiSl / r.totalGrossIncome) * 100 : 0;

  return {
    income: targetGross,
    marginal: r.marginalRate * 100,
    effective,
  };
}

function formatIncome(value: number): string {
  if (value >= 1000) return `£${(value / 1000).toFixed(0)}k`;
  return `£${value}`;
}

export function TaxRateChart({ input, result, taxRules }: TaxRateChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const totalGross = result.totalGrossIncome;

  const data = useMemo(() => {
    const maxIncome = totalGross;
    if (maxIncome <= 0) return [];

    // Tax system boundaries — these always take priority
    const boundaries = new Set<number>([
      0,
      taxRules.personalAllowance.amount, // 12570
      taxRules.personalAllowance.amount + taxRules.incomeTax.bands[0].to!, // 50270 (PA + basic rate band)
      taxRules.personalAllowance.taperThreshold, // 100000
      taxRules.personalAllowance.taperThreshold +
        taxRules.personalAllowance.amount * 2, // 125140
      taxRules.nationalInsurance.employeeClass1.primaryThreshold,
      taxRules.nationalInsurance.employeeClass1.upperEarningsLimit,
    ]);
    for (const band of taxRules.incomeTax.bands) {
      if (band.to !== null) {
        boundaries.add(taxRules.personalAllowance.amount + band.to);
      }
    }

    // Student loan thresholds (only for selected plans)
    if (input.undergraduatePlan !== 'none') {
      const plan = taxRules.studentLoans[input.undergraduatePlan];
      if (plan) boundaries.add(plan.threshold);
    }
    if (input.hasPostgraduateLoan) {
      const pg = taxRules.studentLoans['postgraduate'];
      if (pg) boundaries.add(pg.threshold);
    }

    // Round-number increments for smooth chart display
    const increments: number[] = [];
    for (let i = 5000; i <= 200000; i += 5000) increments.push(i);
    for (let i = 250000; i <= 500000; i += 50000) increments.push(i);

    // Deduplicate: drop round numbers that are within £2000 of a boundary
    const MIN_GAP = 2000;
    const boundaryArr = [...boundaries];
    const filtered = increments.filter(
      (inc) =>
        !boundaryArr.some((b) => Math.abs(inc - b) < MIN_GAP && inc !== b),
    );

    // Combine boundaries + filtered increments + user's gross
    const allPoints = new Set([...boundaries, ...filtered]);
    allPoints.add(Math.round(maxIncome));

    const points: DataPoint[] = [];
    for (const t of allPoints) {
      if (t <= maxIncome && t >= 0) {
        points.push(computeRatesAtIncome(t, input, taxRules));
      }
    }

    points.sort((a, b) => a.income - b.income);
    return points;
  }, [totalGross, input, taxRules]);

  if (!mounted || totalGross <= 0 || data.length === 0) return null;

  // Dots use the same pension-free calculation as the curves
  const userPoint = data.find((d) => d.income === Math.round(totalGross));
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
      <div style={{ width: '100%', height: 180 }}>
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
              tick={{ fontSize: 10, fill: '#6b7280' }}
              stroke="#d1d5db"
              domain={[0, Math.round(totalGross)]}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              stroke="#d1d5db"
              domain={[0, yMax]}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                name === 'marginal' ? 'Marginal rate' : 'Effective rate',
              ]}
              labelFormatter={(label) => formatIncome(label as number)}
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #e5e7eb',
              }}
            />
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
              x={Math.round(totalGross)}
              stroke="#6b7280"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <ReferenceDot
              x={Math.round(totalGross)}
              y={userMarginal}
              r={4}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={2}
            />
            <ReferenceDot
              x={Math.round(totalGross)}
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
