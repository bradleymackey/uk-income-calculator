import { useMemo, useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, ResponsiveContainer, Sector } from 'recharts';
import type { PieSectorShapeProps } from 'recharts/types/polar/Pie';
import type { CalculationResult } from '~/lib/calculator';
import { formatCurrency } from '~/lib/formatters';

interface IncomeBreakdownChartProps {
  result: CalculationResult;
}

interface Slice {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  takeHome: '#22c55e',
  basicRate: '#f59e0b',
  higherRate: '#f97316',
  additionalRate: '#ef4444',
  ni: '#8b5cf6',
  studentLoan: '#6366f1',
  workplacePension: '#06b6d4',
  sipp: '#0891b2',
  rsu: '#10b981',
};

function SectorShape(props: PieSectorShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, isActive } =
    props;
  const payload = props as PieSectorShapeProps & Slice;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={isActive ? outerRadius + 6 : outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={payload.color}
        stroke="#fff"
        strokeWidth={2}
      />
      {isActive && (
        <>
          <text
            x={cx}
            y={cy - 10}
            textAnchor="middle"
            fill="#111827"
            fontSize={13}
            fontWeight={600}
          >
            {payload.name}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={11}
          >
            {formatCurrency(payload.value)}
          </text>
          <text
            x={cx}
            y={cy + 26}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={10}
          >
            {((payload.percent ?? 0) * 100).toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

export function IncomeBreakdownChart({ result }: IncomeBreakdownChartProps) {
  const [mounted, setMounted] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const slices = useMemo(() => {
    const parts: Slice[] = [];

    if (result.incomeTax > 0) {
      parts.push({
        name: 'Income tax',
        value: result.incomeTax,
        color: COLORS.higherRate,
      });
    }

    if (result.nationalInsurance > 0) {
      parts.push({
        name: 'National Insurance',
        value: result.nationalInsurance,
        color: COLORS.ni,
      });
    }

    if (result.undergraduateLoanRepayment > 0) {
      parts.push({
        name: 'Student loan',
        value: result.undergraduateLoanRepayment,
        color: COLORS.studentLoan,
      });
    }
    if (result.postgraduateLoanRepayment > 0) {
      parts.push({
        name: 'Postgraduate loan',
        value: result.postgraduateLoanRepayment,
        color: COLORS.studentLoan,
      });
    }

    if (result.pensionContribution > 0) {
      parts.push({
        name: 'Workplace pension',
        value: result.pensionContribution,
        color: COLORS.workplacePension,
      });
    }
    if (result.sippContribution > 0) {
      parts.push({
        name: 'SIPP',
        value: result.sippContribution,
        color: COLORS.sipp,
      });
    }

    // Take home via PAYE (net pay minus RSUs which go to brokerage)
    const takeHomePaye = result.netAnnualPay - result.rsuVests;
    if (takeHomePaye > 0) {
      parts.push({
        name: 'Take home',
        value: takeHomePaye,
        color: COLORS.takeHome,
      });
    }

    // RSUs: show net received + withheld separately so user sees
    // what they actually get vs what goes to tax. The income tax
    // slice above only covers PAYE tax (we subtract the withholding).
    if (result.rsuVests > 0 && result.rsuWithholding) {
      // Reduce the income tax slice by the amount withheld from RSUs,
      // since that tax was paid from shares not PAYE
      const taxSlice = parts.find((p) => p.name === 'Income tax');
      if (taxSlice) {
        taxSlice.value = Math.max(
          0,
          taxSlice.value - result.rsuWithholding.taxWithheld,
        );
        taxSlice.name = 'Income tax (PAYE)';
      }
      const niSlice = parts.find((p) => p.name === 'National Insurance');
      if (niSlice) {
        niSlice.value = Math.max(
          0,
          niSlice.value - result.rsuWithholding.niWithheld,
        );
        niSlice.name = 'NI (PAYE)';
      }
      parts.push({
        name: 'RSUs received',
        value: result.rsuWithholding.netRsuValue,
        color: COLORS.rsu,
      });
      parts.push({
        name: 'RSU tax withheld',
        value: result.rsuWithholding.totalWithheld,
        color: '#dc2626',
      });
    } else if (result.rsuVests > 0) {
      parts.push({
        name: 'RSUs (brokerage)',
        value: result.rsuVests,
        color: COLORS.rsu,
      });
    }

    return parts.filter((p) => p.value > 0);
  }, [result]);

  const handleEnter = useCallback(
    (_: unknown, index: number) => {
      setActiveLabel(slices[index]?.name ?? null);
    },
    [slices],
  );

  const handleLeave = useCallback(() => {
    setActiveLabel(null);
  }, []);

  if (!mounted || result.totalGrossIncome <= 0 || slices.length === 0)
    return null;

  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-medium text-gray-500">
        Where your income goes
      </p>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              shape={(props: PieSectorShapeProps) => (
                <SectorShape
                  {...props}
                  isActive={
                    activeLabel === null
                      ? props.index === 0
                      : (props as unknown as Slice).name === activeLabel
                  }
                />
              )}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              isAnimationActive={false}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {slices.map((slice, i) => (
          <span
            key={i}
            className="flex cursor-pointer items-center gap-1"
            onMouseEnter={() => setActiveLabel(slice.name)}
            onMouseLeave={() => setActiveLabel(null)}
          >
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ backgroundColor: slice.color }}
            />
            {slice.name}
          </span>
        ))}
      </div>
    </div>
  );
}
