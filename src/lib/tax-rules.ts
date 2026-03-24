import taxRules202021 from '~/data/tax-rules/2020-21.json';
import taxRules202122 from '~/data/tax-rules/2021-22.json';
import taxRules202223 from '~/data/tax-rules/2022-23.json';
import taxRules202324 from '~/data/tax-rules/2023-24.json';
import taxRules202425 from '~/data/tax-rules/2024-25.json';
import taxRules202526 from '~/data/tax-rules/2025-26.json';
import taxRules202627 from '~/data/tax-rules/2026-27.json';

export interface TaxBand {
  name: string;
  rate: number;
  from: number;
  to: number | null;
}

export interface PersonalAllowance {
  amount: number;
  taperThreshold: number;
  taperRate: number;
}

export interface StudentLoanPlan {
  label: string;
  threshold: number;
  rate: number;
}

export type UndergraduatePlanId =
  | 'none'
  | 'plan1'
  | 'plan2'
  | 'plan4'
  | 'plan5';

export type Country = 'england' | 'scotland';

export type NiCategory = 'A' | 'C' | 'X';

export interface ChildBenefitRules {
  weeklyRateFirstChild: number;
  weeklyRateAdditionalChild: number;
  weeksPerYear: number;
  hicbc: {
    threshold: number;
    upperThreshold: number;
  };
}

export interface TaxRules {
  taxYear: string;
  label: string;
  personalAllowance: PersonalAllowance;
  blindPersonsAllowance: number;
  incomeTax: {
    bands: TaxBand[];
  };
  scottishIncomeTax: {
    bands: TaxBand[];
  };
  nationalInsurance: {
    employerClass1: {
      secondaryThreshold: number;
      rate: number;
    };
    employeeClass1: {
      primaryThreshold: number;
      upperEarningsLimit: number;
      bands: TaxBand[];
    };
    class4: {
      bands: TaxBand[];
    };
  };
  childBenefit: ChildBenefitRules;
  studentLoans: Record<string, StudentLoanPlan>;
}

const taxRulesMap: Record<string, TaxRules> = {
  '2020-21': taxRules202021 as TaxRules,
  '2021-22': taxRules202122 as TaxRules,
  '2022-23': taxRules202223 as TaxRules,
  '2023-24': taxRules202324 as TaxRules,
  '2024-25': taxRules202425 as TaxRules,
  '2025-26': taxRules202526 as TaxRules,
  '2026-27': taxRules202627 as TaxRules,
};

export const DEFAULT_TAX_YEAR = '2026-27';

export function getTaxRules(taxYear: string = DEFAULT_TAX_YEAR): TaxRules {
  const rules = taxRulesMap[taxYear];
  if (!rules) {
    throw new Error(`Tax rules not found for year: ${taxYear}`);
  }
  return rules;
}

export function getAvailableTaxYears(): string[] {
  return Object.keys(taxRulesMap);
}

export function getIncomeTaxBands(
  rules: TaxRules,
  country: Country,
): TaxBand[] {
  return country === 'scotland'
    ? rules.scottishIncomeTax.bands
    : rules.incomeTax.bands;
}
