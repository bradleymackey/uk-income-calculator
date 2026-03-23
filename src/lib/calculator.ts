import type { TaxRules, StudentLoanPlanId } from './tax-rules';

export interface CalculatorInput {
  grossSalary: number;
  bonus: number;
  taxableBenefits: number;
  rsuVests: number;
  pensionContribution: {
    type: 'percentage' | 'fixed';
    value: number;
    salarySacrifice: boolean;
  };
  employerPensionContribution: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  sippContribution: number;
  studentLoanPlan: StudentLoanPlanId;
}

export interface BandBreakdown {
  name: string;
  amount: number;
  rate: number;
  tax: number;
}

export interface CalculationResult {
  grossSalary: number;
  bonus: number;
  taxableBenefits: number;
  rsuVests: number;
  totalGrossIncome: number;

  pensionContribution: number;
  employerPensionContribution: number;
  totalPensionContributions: number;
  sippContribution: number;

  niableIncome: number;
  adjustedNetIncome: number;
  personalAllowance: number;
  taxableIncome: number;

  incomeTaxBands: BandBreakdown[];
  incomeTax: number;

  niBands: BandBreakdown[];
  nationalInsurance: number;

  studentLoanRepayment: number;

  sippRelief: {
    grossContribution: number;
    basicRateRelief: number;
    selfAssessmentRelief: number;
    totalRelief: number;
    effectiveCost: number;
  };

  totalDeductions: number;
  netAnnualPay: number;
  netMonthlyPay: number;
}

export function calculatePersonalAllowance(
  adjustedNetIncome: number,
  rules: TaxRules,
): number {
  const { amount, taperThreshold, taperRate } = rules.personalAllowance;
  if (adjustedNetIncome <= taperThreshold) {
    return amount;
  }
  const reduction = Math.floor(
    (adjustedNetIncome - taperThreshold) * taperRate,
  );
  return Math.max(0, amount - reduction);
}

export function calculateBandedTax(
  income: number,
  bands: { name: string; rate: number; from: number; to: number | null }[],
): BandBreakdown[] {
  if (income <= 0) return [];

  return bands
    .map((band) => {
      const upper = band.to ?? Infinity;
      const amountInBand = Math.max(0, Math.min(income, upper) - band.from);
      return {
        name: band.name,
        amount: amountInBand,
        rate: band.rate,
        tax: amountInBand * band.rate,
      };
    })
    .filter((b) => b.amount > 0);
}

export function calculateStudentLoan(
  income: number,
  plan: StudentLoanPlanId,
  rules: TaxRules,
): number {
  if (plan === 'none') return 0;
  const planRules = rules.studentLoans[plan];
  if (!planRules) return 0;
  return Math.max(0, (income - planRules.threshold) * planRules.rate);
}

export function calculateSippRelief(
  sippContribution: number,
  incomeBeforeSipp: number,
  rules: TaxRules,
): CalculationResult['sippRelief'] {
  if (sippContribution <= 0) {
    return {
      grossContribution: 0,
      basicRateRelief: 0,
      selfAssessmentRelief: 0,
      totalRelief: 0,
      effectiveCost: 0,
    };
  }

  // Basic rate relief is always 20% — claimed at source by the provider
  const basicRateRelief = sippContribution * 0.2;

  // Calculate tax with and without SIPP to find total relief
  const paWithSipp = calculatePersonalAllowance(
    incomeBeforeSipp - sippContribution,
    rules,
  );
  const paWithout = calculatePersonalAllowance(incomeBeforeSipp, rules);

  const taxableWithSipp = Math.max(
    0,
    incomeBeforeSipp - sippContribution - paWithSipp,
  );
  const taxableWithout = Math.max(0, incomeBeforeSipp - paWithout);

  const taxWithSipp = calculateBandedTax(
    taxableWithSipp,
    rules.incomeTax.bands,
  ).reduce((sum, b) => sum + b.tax, 0);
  const taxWithout = calculateBandedTax(
    taxableWithout,
    rules.incomeTax.bands,
  ).reduce((sum, b) => sum + b.tax, 0);

  const totalRelief = taxWithout - taxWithSipp;
  const selfAssessmentRelief = Math.max(0, totalRelief - basicRateRelief);

  return {
    grossContribution: sippContribution,
    basicRateRelief,
    selfAssessmentRelief,
    totalRelief,
    effectiveCost: sippContribution - totalRelief,
  };
}

export function calculateTax(
  input: CalculatorInput,
  rules: TaxRules,
): CalculationResult {
  const { grossSalary, bonus, taxableBenefits, rsuVests } = input;

  // 1. Resolve pension contributions to £ amounts
  const pensionContribution =
    input.pensionContribution.type === 'percentage'
      ? (grossSalary * input.pensionContribution.value) / 100
      : input.pensionContribution.value;

  const employerPensionContribution =
    input.employerPensionContribution.type === 'percentage'
      ? (grossSalary * input.employerPensionContribution.value) / 100
      : input.employerPensionContribution.value;

  const sippContribution = input.sippContribution;

  // 2. Total gross income
  const totalGrossIncome = grossSalary + bonus + taxableBenefits + rsuVests;

  // 3. NI-able income: salary + bonus + RSUs - salary sacrifice pension
  // BIK is NOT subject to employee NI
  const salarySacrificeDeduction = input.pensionContribution.salarySacrifice
    ? pensionContribution
    : 0;
  const niableIncome =
    grossSalary + bonus + rsuVests - salarySacrificeDeduction;

  // 4. Adjusted net income for income tax
  // Salary sacrifice reduces gross, SIPP reduces taxable income
  const adjustedNetIncome =
    totalGrossIncome - salarySacrificeDeduction - sippContribution;

  // 5. Personal allowance (with tapering)
  const personalAllowance = calculatePersonalAllowance(
    adjustedNetIncome,
    rules,
  );

  // 6. Taxable income
  const taxableIncome = Math.max(0, adjustedNetIncome - personalAllowance);

  // 7. Income tax
  const incomeTaxBands = calculateBandedTax(
    taxableIncome,
    rules.incomeTax.bands,
  );
  const incomeTax = incomeTaxBands.reduce((sum, b) => sum + b.tax, 0);

  // 8. National Insurance
  const niBands = calculateBandedTax(
    niableIncome,
    rules.nationalInsurance.employeeClass1.bands,
  );
  const nationalInsurance = niBands.reduce((sum, b) => sum + b.tax, 0);

  // 9. Student loan
  const studentLoanIncome = niableIncome;
  const studentLoanRepayment = calculateStudentLoan(
    studentLoanIncome,
    input.studentLoanPlan,
    rules,
  );

  // 10. SIPP relief breakdown
  const sippRelief = calculateSippRelief(
    sippContribution,
    totalGrossIncome - salarySacrificeDeduction,
    rules,
  );

  // 11. Total deductions and net pay
  const totalDeductions =
    incomeTax +
    nationalInsurance +
    studentLoanRepayment +
    pensionContribution +
    sippContribution;

  const netAnnualPay = totalGrossIncome - totalDeductions;
  const netMonthlyPay = netAnnualPay / 12;

  return {
    grossSalary,
    bonus,
    taxableBenefits,
    rsuVests,
    totalGrossIncome,
    pensionContribution,
    employerPensionContribution,
    totalPensionContributions:
      pensionContribution + employerPensionContribution + sippContribution,
    sippContribution,
    niableIncome,
    adjustedNetIncome,
    personalAllowance,
    taxableIncome,
    incomeTaxBands,
    incomeTax,
    niBands,
    nationalInsurance,
    studentLoanRepayment,
    sippRelief,
    totalDeductions,
    netAnnualPay,
    netMonthlyPay,
  };
}
