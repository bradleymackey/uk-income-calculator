import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { CalculatorForm } from '~/components/CalculatorForm';
import { ResultsBreakdown } from '~/components/ResultsBreakdown';
import { calculateTax, type CalculatorInput } from '~/lib/calculator';
import {
  getTaxRules,
  getAvailableTaxYears,
  DEFAULT_TAX_YEAR,
} from '~/lib/tax-rules';
import type { UndergraduatePlanId } from '~/lib/tax-rules';

interface SearchParams {
  year?: string;
  salary?: number;
  bonus?: number;
  bik?: number;
  rsu?: number;
  rsuWithheld?: boolean;
  rsuVests?: number;
  pensionPct?: number;
  pensionFixed?: number;
  pensionSS?: boolean;
  empPensionPct?: number;
  empPensionFixed?: number;
  niPassback?: number;
  sipp?: number;
  sippType?: 'gross' | 'net';
  slPlan?: string;
  slPostgrad?: boolean;
}

function searchToInput(search: SearchParams): {
  input: CalculatorInput;
  taxYear: string;
} {
  const hasPensionFixed = search.pensionFixed !== undefined;
  const hasEmpPensionFixed = search.empPensionFixed !== undefined;

  return {
    taxYear: search.year ?? DEFAULT_TAX_YEAR,
    input: {
      grossSalary: search.salary ?? 0,
      bonus: search.bonus ?? 0,
      taxableBenefits: search.bik ?? 0,
      rsuVests: search.rsu ?? 0,
      rsuTaxWithheld: search.rsuWithheld ?? false,
      rsuVestingPeriodsPerYear: search.rsuVests ?? 4,
      pensionContribution: {
        type: hasPensionFixed ? 'fixed' : 'percentage',
        value: hasPensionFixed
          ? (search.pensionFixed ?? 0)
          : (search.pensionPct ?? 0),
        salarySacrifice: search.pensionSS ?? false,
      },
      employerPensionContribution: {
        type: hasEmpPensionFixed ? 'fixed' : 'percentage',
        value: hasEmpPensionFixed
          ? (search.empPensionFixed ?? 0)
          : (search.empPensionPct ?? 0),
      },
      employerNiPassbackPercent: search.niPassback ?? 0,
      sippContribution: search.sipp ?? 0,
      sippInputType: search.sippType ?? 'gross',
      undergraduatePlan: (search.slPlan as UndergraduatePlanId) ?? 'none',
      hasPostgraduateLoan: search.slPostgrad ?? false,
    },
  };
}

function inputToSearch(input: CalculatorInput, taxYear: string): SearchParams {
  const params: SearchParams = {};

  if (taxYear !== DEFAULT_TAX_YEAR) params.year = taxYear;
  if (input.grossSalary) params.salary = input.grossSalary;
  if (input.bonus) params.bonus = input.bonus;
  if (input.taxableBenefits) params.bik = input.taxableBenefits;
  if (input.rsuVests) params.rsu = input.rsuVests;
  if (input.rsuTaxWithheld) params.rsuWithheld = true;
  if (input.rsuVestingPeriodsPerYear !== 4)
    params.rsuVests = input.rsuVestingPeriodsPerYear;
  if (input.pensionContribution.value) {
    if (input.pensionContribution.type === 'fixed') {
      params.pensionFixed = input.pensionContribution.value;
    } else {
      params.pensionPct = input.pensionContribution.value;
    }
  }
  if (input.pensionContribution.salarySacrifice) params.pensionSS = true;
  if (input.employerPensionContribution.value) {
    if (input.employerPensionContribution.type === 'fixed') {
      params.empPensionFixed = input.employerPensionContribution.value;
    } else {
      params.empPensionPct = input.employerPensionContribution.value;
    }
  }
  if (input.employerNiPassbackPercent)
    params.niPassback = input.employerNiPassbackPercent;
  if (input.sippContribution) params.sipp = input.sippContribution;
  if (input.sippInputType !== 'gross') params.sippType = input.sippInputType;
  if (input.undergraduatePlan !== 'none')
    params.slPlan = input.undergraduatePlan;
  if (input.hasPostgraduateLoan) params.slPostgrad = true;

  return params;
}

export const Route = createFileRoute('/')({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      year: search.year as string | undefined,
      salary: search.salary ? Number(search.salary) : undefined,
      bonus: search.bonus ? Number(search.bonus) : undefined,
      bik: search.bik ? Number(search.bik) : undefined,
      rsu: search.rsu ? Number(search.rsu) : undefined,
      rsuWithheld:
        search.rsuWithheld === true ||
        search.rsuWithheld === 'true' ||
        undefined,
      rsuVests: search.rsuVests ? Number(search.rsuVests) : undefined,
      pensionPct: search.pensionPct ? Number(search.pensionPct) : undefined,
      pensionFixed: search.pensionFixed
        ? Number(search.pensionFixed)
        : undefined,
      pensionSS:
        search.pensionSS === true || search.pensionSS === 'true' || undefined,
      empPensionPct: search.empPensionPct
        ? Number(search.empPensionPct)
        : undefined,
      empPensionFixed: search.empPensionFixed
        ? Number(search.empPensionFixed)
        : undefined,
      niPassback: search.niPassback ? Number(search.niPassback) : undefined,
      sipp: search.sipp ? Number(search.sipp) : undefined,
      sippType: search.sippType as 'gross' | 'net' | undefined,
      slPlan: search.slPlan as string | undefined,
      slPostgrad:
        search.slPostgrad === true || search.slPostgrad === 'true' || undefined,
    };
  },
});

function HomePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { input, taxYear } = useMemo(() => searchToInput(search), [search]);
  const availableYears = getAvailableTaxYears();
  const rules = getTaxRules(taxYear);
  const result = useMemo(() => calculateTax(input, rules), [input, rules]);

  const updateUrl = useCallback(
    (newInput: CalculatorInput, newYear?: string) => {
      navigate({
        to: '/',
        search: inputToSearch(newInput, newYear ?? taxYear),
        replace: true,
      });
    },
    [navigate, taxYear],
  );

  const handleInputChange = useCallback(
    (newInput: CalculatorInput) => updateUrl(newInput),
    [updateUrl],
  );

  const handleYearChange = useCallback(
    (newYear: string) => updateUrl(input, newYear),
    [updateUrl, input],
  );

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
              onChange={(e) => handleYearChange(e.target.value)}
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
              onChange={handleInputChange}
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
