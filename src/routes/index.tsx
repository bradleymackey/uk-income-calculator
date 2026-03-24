import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { CalculatorForm } from '~/components/CalculatorForm';
import { PrintView } from '~/components/PrintView';
import { ResultsBreakdown } from '~/components/ResultsBreakdown';
import {
  calculateTax,
  type CalculatorInput,
  type SalaryPeriod,
  type FixedPeriod,
} from '~/lib/calculator';
import {
  getTaxRules,
  getAvailableTaxYears,
  DEFAULT_TAX_YEAR,
} from '~/lib/tax-rules';
import type { UndergraduatePlanId, Country, NiCategory } from '~/lib/tax-rules';

interface SearchParams {
  year?: string;
  country?: Country;
  niCat?: NiCategory;
  blind?: boolean;
  salary?: number;
  salaryPer?: string;
  daysPerWeek?: number;
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
  pensionFixedPer?: string;
  niPassback?: number;
  otherSS?: number;
  selfEmp?: number;
  sipp?: number;
  sippType?: 'gross' | 'net';
  children?: number;
  slPlans?: string;
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
      country: search.country ?? 'england',
      niCategory: search.niCat ?? 'A',
      isBlind: search.blind ?? false,
      grossSalary: search.salary ?? 0,
      salaryPeriod: (search.salaryPer as SalaryPeriod) ?? 'annual',
      daysPerWeek: search.daysPerWeek ?? 5,
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
      pensionFixedPeriod: (search.pensionFixedPer as FixedPeriod) ?? 'annual',
      employerNiPassbackPercent: search.niPassback ?? 0,
      otherSalarySacrifice: search.otherSS ?? 0,
      selfEmploymentIncome: search.selfEmp ?? 0,
      sippContribution: search.sipp ?? 0,
      sippInputType: search.sippType ?? 'gross',
      numberOfChildren: search.children ?? 0,
      undergraduatePlans: search.slPlans
        ? (search.slPlans.split(',') as Exclude<UndergraduatePlanId, 'none'>[])
        : [],
      hasPostgraduateLoan: search.slPostgrad ?? false,
    },
  };
}

function inputToSearch(input: CalculatorInput, taxYear: string): SearchParams {
  const params: SearchParams = {};

  if (taxYear !== DEFAULT_TAX_YEAR) params.year = taxYear;
  if (input.country !== 'england') params.country = input.country;
  if (input.niCategory !== 'A') params.niCat = input.niCategory;
  if (input.isBlind) params.blind = true;
  if (input.grossSalary) params.salary = input.grossSalary;
  if (input.salaryPeriod !== 'annual') params.salaryPer = input.salaryPeriod;
  if (input.daysPerWeek !== 5) params.daysPerWeek = input.daysPerWeek;
  if (input.bonus) params.bonus = input.bonus;
  if (input.taxableBenefits) params.bik = input.taxableBenefits;
  if (input.rsuVests) params.rsu = input.rsuVests;
  if (input.rsuTaxWithheld) params.rsuWithheld = true;
  if (input.rsuVestingPeriodsPerYear !== 4)
    params.rsuVests = input.rsuVestingPeriodsPerYear;
  if (input.pensionContribution.type === 'fixed') {
    params.pensionFixed = input.pensionContribution.value;
  } else if (input.pensionContribution.value) {
    params.pensionPct = input.pensionContribution.value;
  }
  if (input.pensionContribution.salarySacrifice) params.pensionSS = true;
  if (input.pensionFixedPeriod !== 'annual')
    params.pensionFixedPer = input.pensionFixedPeriod;
  if (input.employerPensionContribution.type === 'fixed') {
    params.empPensionFixed = input.employerPensionContribution.value;
  } else if (input.employerPensionContribution.value) {
    params.empPensionPct = input.employerPensionContribution.value;
  }
  if (input.employerNiPassbackPercent)
    params.niPassback = input.employerNiPassbackPercent;
  if (input.otherSalarySacrifice) params.otherSS = input.otherSalarySacrifice;
  if (input.selfEmploymentIncome) params.selfEmp = input.selfEmploymentIncome;
  if (input.sippContribution) params.sipp = input.sippContribution;
  if (input.sippInputType !== 'gross') params.sippType = input.sippInputType;
  if (input.numberOfChildren) params.children = input.numberOfChildren;
  if (input.undergraduatePlans.length > 0)
    params.slPlans = input.undergraduatePlans.join(',');
  if (input.hasPostgraduateLoan) params.slPostgrad = true;

  return params;
}

export const Route = createFileRoute('/')({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      year: search.year as string | undefined,
      country: search.country as Country | undefined,
      niCat: search.niCat as NiCategory | undefined,
      blind: search.blind === true || search.blind === 'true' || undefined,
      salary: search.salary ? Number(search.salary) : undefined,
      salaryPer: search.salaryPer as string | undefined,
      daysPerWeek: search.daysPerWeek ? Number(search.daysPerWeek) : undefined,
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
      pensionFixedPer: search.pensionFixedPer as string | undefined,
      niPassback: search.niPassback ? Number(search.niPassback) : undefined,
      otherSS: search.otherSS ? Number(search.otherSS) : undefined,
      selfEmp: search.selfEmp ? Number(search.selfEmp) : undefined,
      sipp: search.sipp ? Number(search.sipp) : undefined,
      sippType: search.sippType as 'gross' | 'net' | undefined,
      children: search.children ? Number(search.children) : undefined,
      slPlans: search.slPlans as string | undefined,
      slPostgrad:
        search.slPostgrad === true || search.slPostgrad === 'true' || undefined,
    };
  },
});

function getTaxYearStatus(taxYear: string): {
  kind: 'historical' | 'current' | 'upcoming';
  week?: number;
  daysRemaining?: number;
} {
  const [startYearStr] = taxYear.split('-');
  const startYear = parseInt(startYearStr);
  // UK tax year: 6 April to 5 April
  const taxYearStart = new Date(startYear, 3, 6); // April = month 3
  const taxYearEnd = new Date(startYear + 1, 3, 5);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today > taxYearEnd) return { kind: 'historical' };
  if (today < taxYearStart) return { kind: 'upcoming' };

  const msPerDay = 86400000;
  const daysSinceStart = Math.floor(
    (today.getTime() - taxYearStart.getTime()) / msPerDay,
  );
  const daysRemaining = Math.ceil(
    (taxYearEnd.getTime() - today.getTime()) / msPerDay,
  );
  const week = Math.floor(daysSinceStart / 7) + 1;

  return { kind: 'current', week, daysRemaining };
}

function TaxYearBadge({ taxYear }: { taxYear: string }) {
  const status = getTaxYearStatus(taxYear);

  if (status.kind === 'historical') {
    return (
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
        Historical
      </span>
    );
  }

  if (status.kind === 'upcoming') {
    return (
      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
        Upcoming
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400">
      Week {status.week} &middot; {status.daysRemaining} days left
    </span>
  );
}

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
    <div className="min-h-screen bg-neutral-50 print:bg-white dark:bg-neutral-950">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 print:hidden">
        <nav className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-700">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
            UK Income Tax Calculator
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center rounded p-1 text-neutral-400 transition-colors hover:text-neutral-600 print:hidden dark:text-neutral-500 dark:hover:text-neutral-300"
              title="Print"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"
                />
              </svg>
            </button>
          </span>
          <div className="flex items-center gap-3 text-sm print:hidden">
            <select
              value={taxYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="rounded-md border border-neutral-200 bg-transparent px-2 py-1 text-sm font-medium transition-colors hover:text-yellow-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {getTaxRules(year).label}
                </option>
              ))}
            </select>
            <TaxYearBadge taxYear={taxYear} />
          </div>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 print:py-0">
        <div className="grid grid-cols-1 gap-8 print:hidden lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:shadow-none dark:ring-neutral-800">
            <CalculatorForm
              input={input}
              onChange={handleInputChange}
              taxRules={rules}
            />
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:shadow-none dark:ring-neutral-800">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Take-Home Pay Breakdown
            </h2>
            <ResultsBreakdown input={input} result={result} taxRules={rules} />
          </div>
        </div>
        <PrintView input={input} result={result} taxRules={rules} />
      </div>
      <footer className="mx-auto max-w-5xl px-4 pb-6 pt-2 text-center text-xs text-neutral-400 print:hidden dark:text-neutral-500">
        <p>
          All calculations are performed locally in your browser. Nothing is
          stored or sent anywhere unless you share your URL.
        </p>
        <p className="mt-1">
          An experiment by{' '}
          <a
            href="https://mcky.dev"
            className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            mcky.dev
          </a>
          {' · '}
          <a
            href="https://github.com/bradleymackey/uk-income-calculator"
            className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Open Source
          </a>
        </p>
      </footer>
    </div>
  );
}
