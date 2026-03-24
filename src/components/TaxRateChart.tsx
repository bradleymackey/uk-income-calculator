import { useMemo } from 'react';
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
  calculatePersonalAllowance,
  calculateBandedTax,
} from '~/lib/calculator';

interface TaxRateChartProps {
  adjustedNetIncome: number;
  marginalRate: number;
  effectiveRate: number;
  taxRules: TaxRules;
}

interface DataPoint {
  income: number;
  marginal: number;
  effective: number;
}

function computeRatesAtIncome(income: number, rules: TaxRules): DataPoint {
  const pa = calculatePersonalAllowance(income, rules);
  const taxable = Math.max(0, income - pa);
  const incomeTax = calculateBandedTax(taxable, rules.incomeTax.bands).reduce(
    (sum, b) => sum + b.tax,
    0,
  );
  const ni = calculateBandedTax(
    income,
    rules.nationalInsurance.employeeClass1.bands,
  ).reduce((sum, b) => sum + b.tax, 0);

  const effective = income > 0 ? ((incomeTax + ni) / income) * 100 : 0;

  // Marginal rate
  const taxRate =
    taxable > 125140 ? 45 : taxable > 37700 ? 40 : taxable > 0 ? 20 : 0;
  const inTaper = income > 100000 && income < 125140;
  const niRate = income > 50270 ? 2 : income > 12570 ? 8 : 0;
  const marginal = (inTaper ? taxRate + 20 : taxRate) + niRate;

  return { income, marginal, effective };
}

function formatIncome(value: number): string {
  if (value >= 1000) return `£${(value / 1000).toFixed(0)}k`;
  return `£${value}`;
}

export function TaxRateChart({
  adjustedNetIncome,
  marginalRate,
  effectiveRate,
  taxRules,
}: TaxRateChartProps) {
  const data = useMemo(() => {
    const points: DataPoint[] = [];
    // Key thresholds to ensure we hit important inflection points
    const thresholds = [
      0, 5000, 10000, 12570, 15000, 20000, 25000, 30000, 37700, 40000, 45000,
      50000, 50270, 55000, 60000, 70000, 80000, 90000, 99999, 100000, 105000,
      110000, 115000, 120000, 125140, 130000, 140000, 150000, 175000, 200000,
    ];

    // Include user's income if not already a threshold
    const maxIncome = Math.max(200000, adjustedNetIncome * 1.3);

    for (const t of thresholds) {
      if (t <= maxIncome) {
        points.push(computeRatesAtIncome(t, taxRules));
      }
    }

    // Add user's income point
    if (!thresholds.includes(Math.round(adjustedNetIncome))) {
      points.push(
        computeRatesAtIncome(Math.round(adjustedNetIncome), taxRules),
      );
    }

    // Add extra points beyond 200k if needed
    if (maxIncome > 200000) {
      for (let i = 250000; i <= maxIncome; i += i < 500000 ? 50000 : 100000) {
        points.push(computeRatesAtIncome(i, taxRules));
      }
    }

    points.sort((a, b) => a.income - b.income);
    return points;
  }, [adjustedNetIncome, taxRules]);

  const userMarginal = marginalRate * 100;
  const userEffective = effectiveRate * 100;

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium text-gray-500">
        Tax rate by income
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="income"
            tickFormatter={formatIncome}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            stroke="#d1d5db"
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            stroke="#d1d5db"
            domain={[0, 70]}
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
          />
          <Line
            type="monotone"
            dataKey="effective"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="effective"
          />
          <ReferenceLine
            x={Math.round(adjustedNetIncome)}
            stroke="#6b7280"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <ReferenceDot
            x={Math.round(adjustedNetIncome)}
            y={userMarginal}
            r={4}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={2}
          />
          <ReferenceDot
            x={Math.round(adjustedNetIncome)}
            y={userEffective}
            r={4}
            fill="#3b82f6"
            stroke="#fff"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
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
