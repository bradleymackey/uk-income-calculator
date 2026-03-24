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
  // Treat targetGross as the entire salary, zero out other income.
  // Keeps the user's pension %, salary sacrifice, student loan, etc.
  const r = calculateTax(
    {
      ...baseInput,
      grossSalary: targetGross,
      bonus: 0,
      taxableBenefits: 0,
      rsuVests: 0,
      rsuTaxWithheld: false,
    },
    rules,
  );

  const totalTaxAndNi =
    r.incomeTax + r.nationalInsurance + r.studentLoanRepayment;
  const effective =
    r.totalGrossIncome > 0 ? (totalTaxAndNi / r.totalGrossIncome) * 100 : 0;

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
  const totalGross = result.totalGrossIncome;

  const data = useMemo(() => {
    const maxIncome = totalGross;
    if (maxIncome <= 0) return [];

    const points: DataPoint[] = [];
    // Key thresholds for inflection points
    const thresholds = [
      0, 5000, 10000, 12570, 15000, 20000, 25000, 30000, 37700, 40000, 45000,
      50000, 50270, 55000, 60000, 70000, 80000, 90000, 99999, 100000, 105000,
      110000, 115000, 120000, 125140, 130000, 140000, 150000, 175000, 200000,
      250000, 300000, 400000, 500000,
    ];

    for (const t of thresholds) {
      if (t <= maxIncome) {
        points.push(computeRatesAtIncome(t, input, taxRules));
      }
    }

    // Ensure the max point is included
    const roundedMax = Math.round(maxIncome);
    if (!thresholds.includes(roundedMax)) {
      points.push(computeRatesAtIncome(roundedMax, input, taxRules));
    }

    points.sort((a, b) => a.income - b.income);
    return points;
  }, [totalGross, input, taxRules]);

  if (totalGross <= 0) return null;

  const userMarginal = result.marginalRate * 100;
  const totalTaxAndNi =
    result.incomeTax + result.nationalInsurance + result.studentLoanRepayment;
  const userEffective = totalGross > 0 ? (totalTaxAndNi / totalGross) * 100 : 0;

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
            domain={[
              0,
              (dataMax: number) =>
                Math.min(70, Math.ceil(dataMax / 10) * 10 + 10),
            ]}
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
