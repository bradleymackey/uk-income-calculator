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

export interface TaxRules {
  taxYear: string;
  label: string;
  personalAllowance: PersonalAllowance;
  incomeTax: {
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
  };
  studentLoans: Record<string, StudentLoanPlan>;
}

const taxRulesMap: Record<string, TaxRules> = {
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
