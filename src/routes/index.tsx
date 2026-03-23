import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { CalculatorForm } from '~/components/CalculatorForm';
import { ResultsBreakdown } from '~/components/ResultsBreakdown';
import { calculateTax, type CalculatorInput } from '~/lib/calculator';
import { getTaxRules } from '~/lib/tax-rules';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const defaultInput: CalculatorInput = {
  grossSalary: 0,
  bonus: 0,
  taxableBenefits: 0,
  rsuVests: 0,
  pensionContribution: {
    type: 'percentage',
    value: 0,
    salarySacrifice: false,
  },
  sippContribution: 0,
  studentLoanPlan: 'none',
};

function HomePage() {
  const [input, setInput] = useState<CalculatorInput>(defaultInput);
  const rules = getTaxRules('2025-26');

  const result = useMemo(() => calculateTax(input, rules), [input, rules]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            UK Income Tax Calculator
          </h1>
          <p className="mt-1 text-gray-500">
            {rules.label} Tax Year &middot; HMRC rates
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <CalculatorForm input={input} onChange={setInput} />
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Take-Home Pay Breakdown
            </h2>
            <ResultsBreakdown result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}
