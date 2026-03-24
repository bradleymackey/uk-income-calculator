import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { CalculatorForm } from '~/components/CalculatorForm';
import { ResultsBreakdown } from '~/components/ResultsBreakdown';
import { calculateTax, type CalculatorInput } from '~/lib/calculator';
import {
  getTaxRules,
  getAvailableTaxYears,
  DEFAULT_TAX_YEAR,
} from '~/lib/tax-rules';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const defaultInput: CalculatorInput = {
  grossSalary: 0,
  bonus: 0,
  taxableBenefits: 0,
  rsuVests: 0,
  rsuTaxWithheld: false,
  rsuVestingPeriodsPerYear: 4,
  pensionContribution: {
    type: 'percentage',
    value: 0,
    salarySacrifice: false,
  },
  employerPensionContribution: {
    type: 'percentage',
    value: 0,
  },
  employerNiPassbackPercent: 0,
  sippContribution: 0,
  sippInputType: 'gross',
  undergraduatePlan: 'none',
  hasPostgraduateLoan: false,
};

function HomePage() {
  const [input, setInput] = useState<CalculatorInput>(defaultInput);
  const [taxYear, setTaxYear] = useState(DEFAULT_TAX_YEAR);
  const availableYears = getAvailableTaxYears();
  const rules = getTaxRules(taxYear);

  const result = useMemo(() => calculateTax(input, rules), [input, rules]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            UK Income Tax Calculator
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {getTaxRules(year).label}
                </option>
              ))}
            </select>
            <span>Tax Year &middot; HMRC rates</span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <CalculatorForm
              input={input}
              onChange={setInput}
              taxRules={rules}
            />
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Take-Home Pay Breakdown
            </h2>
            <ResultsBreakdown input={input} result={result} taxRules={rules} />
          </div>
        </div>
      </div>
    </div>
  );
}
