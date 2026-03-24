import type { TaxRules, UndergraduatePlanId } from './tax-rules';

export interface CalculatorInput {
  grossSalary: number;
  bonus: number;
  taxableBenefits: number;
  rsuVests: number;
  rsuTaxWithheld: boolean;
  rsuVestingPeriodsPerYear: number;
  pensionContribution: {
    type: 'percentage' | 'fixed';
    value: number;
    salarySacrifice: boolean;
  };
  employerPensionContribution: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  employerNiPassbackPercent: number;
  sippContribution: number;
  undergraduatePlan: UndergraduatePlanId;
  hasPostgraduateLoan: boolean;
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
  rsuWithholding: {
    taxWithheld: number;
    niWithheld: number;
    totalWithheld: number;
    netRsuValue: number;
  } | null;
  rsuPerVest: {
    vestingPeriods: number;
    grossPerVest: number;
    netPerVest: number;
  } | null;
  totalGrossIncome: number;

  pensionContribution: number;
  employerPensionContribution: number;
  employerNiSaving: number;
  employerNiPassback: number;
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

  undergraduateLoanRepayment: number;
  postgraduateLoanRepayment: number;
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
  payeMonthlyPay: number | null;
  payeMonthlyAdjusted: number | null;
  vestMonthTotal: number | null;
  effectiveRate: number;
  marginalRate: number;
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

export function calculateStudentLoanForPlan(
  income: number,
  planId: string,
  rules: TaxRules,
): number {
  const planRules = rules.studentLoans[planId];
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

  // Calculate employer NI saving from salary sacrifice
  const employerNi = rules.nationalInsurance.employerClass1;
  let employerNiSaving = 0;
  if (input.pensionContribution.salarySacrifice && pensionContribution > 0) {
    // Employer NI on original salary vs reduced salary
    const originalNiable = Math.max(
      0,
      grossSalary - employerNi.secondaryThreshold,
    );
    const reducedNiable = Math.max(
      0,
      grossSalary - pensionContribution - employerNi.secondaryThreshold,
    );
    employerNiSaving = (originalNiable - reducedNiable) * employerNi.rate;
  }
  const employerNiPassback =
    employerNiSaving * (input.employerNiPassbackPercent / 100);

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

  // 9. Student loans
  const studentLoanIncome = niableIncome;
  const undergraduateLoanRepayment =
    input.undergraduatePlan !== 'none'
      ? calculateStudentLoanForPlan(
          studentLoanIncome,
          input.undergraduatePlan,
          rules,
        )
      : 0;
  const postgraduateLoanRepayment = input.hasPostgraduateLoan
    ? calculateStudentLoanForPlan(studentLoanIncome, 'postgraduate', rules)
    : 0;
  const studentLoanRepayment =
    undergraduateLoanRepayment + postgraduateLoanRepayment;

  // 10. SIPP relief breakdown
  const sippRelief = calculateSippRelief(
    sippContribution,
    totalGrossIncome - salarySacrificeDeduction,
    rules,
  );

  // 11. RSU withholding
  const rsuWithholding =
    input.rsuTaxWithheld && rsuVests > 0
      ? {
          taxWithheld: rsuVests * 0.45,
          niWithheld: rsuVests * 0.02,
          totalWithheld: rsuVests * 0.47,
          netRsuValue: rsuVests * 0.53,
        }
      : null;

  const vestingPeriods = input.rsuVestingPeriodsPerYear;
  const rsuPerVest =
    rsuVests > 0 && vestingPeriods > 0
      ? {
          vestingPeriods,
          grossPerVest: rsuVests / vestingPeriods,
          netPerVest: rsuWithholding
            ? rsuWithholding.netRsuValue / vestingPeriods
            : rsuVests / vestingPeriods,
        }
      : null;

  // 12. Total deductions and net pay
  const totalDeductions =
    incomeTax +
    nationalInsurance +
    studentLoanRepayment +
    pensionContribution +
    sippContribution;

  const netAnnualPay = totalGrossIncome - totalDeductions;
  const netMonthlyPay = netAnnualPay / 12;

  // Monthly PAYE payslip: what a normal month looks like when no RSUs vest.
  // Only includes what flows through payroll:
  //   Cash in:  salary + bonus
  //   Tax:      on salary + bonus + BIK (BIK coded into tax code, not cash)
  //   NI:       on salary + bonus (not BIK)
  //   Out:      workplace pension (deducted from payroll)
  // Excludes:   RSUs (brokerage), SIPP (personal), BIK (not cash)
  let payeMonthlyPay: number | null = null;
  if (rsuVests > 0) {
    const payeGross = grossSalary + bonus + taxableBenefits;
    const payeNiable = grossSalary + bonus - salarySacrificeDeduction;
    const payeAdjusted = payeGross - salarySacrificeDeduction;
    const payePA = calculatePersonalAllowance(payeAdjusted, rules);
    const payeTaxable = Math.max(0, payeAdjusted - payePA);
    const payeIncomeTax = calculateBandedTax(
      payeTaxable,
      rules.incomeTax.bands,
    ).reduce((sum, b) => sum + b.tax, 0);
    const payeNI = calculateBandedTax(
      payeNiable,
      rules.nationalInsurance.employeeClass1.bands,
    ).reduce((sum, b) => sum + b.tax, 0);
    const payeStudentLoan =
      (input.undergraduatePlan !== 'none'
        ? calculateStudentLoanForPlan(
            payeNiable,
            input.undergraduatePlan,
            rules,
          )
        : 0) +
      (input.hasPostgraduateLoan
        ? calculateStudentLoanForPlan(payeNiable, 'postgraduate', rules)
        : 0);
    const payeAnnual =
      grossSalary +
      bonus -
      payeIncomeTax -
      payeNI -
      payeStudentLoan -
      pensionContribution;
    payeMonthlyPay = payeAnnual / 12;
  }

  // When withholding is OFF, HMRC adjusts tax code to collect RSU tax from
  // every payslip. Recalculate tax on full income (inc RSUs) but without SIPP
  // (SIPP is paid personally after receiving payslip, not via PAYE).
  let payeMonthlyAdjusted: number | null = null;
  if (rsuVests > 0 && !input.rsuTaxWithheld) {
    const adjGross = totalGrossIncome - salarySacrificeDeduction;
    const adjPA = calculatePersonalAllowance(adjGross, rules);
    const adjTaxable = Math.max(0, adjGross - adjPA);
    const adjIncomeTax = calculateBandedTax(
      adjTaxable,
      rules.incomeTax.bands,
    ).reduce((sum, b) => sum + b.tax, 0);
    const adjNiable = grossSalary + bonus + rsuVests - salarySacrificeDeduction;
    const adjNI = calculateBandedTax(
      adjNiable,
      rules.nationalInsurance.employeeClass1.bands,
    ).reduce((sum, b) => sum + b.tax, 0);
    const adjStudentLoan =
      (input.undergraduatePlan !== 'none'
        ? calculateStudentLoanForPlan(adjNiable, input.undergraduatePlan, rules)
        : 0) +
      (input.hasPostgraduateLoan
        ? calculateStudentLoanForPlan(adjNiable, 'postgraduate', rules)
        : 0);
    const adjustedPayeAnnual =
      grossSalary +
      bonus -
      adjIncomeTax -
      adjNI -
      adjStudentLoan -
      pensionContribution;
    payeMonthlyAdjusted = adjustedPayeAnnual / 12;
  }

  // Total received in a vest month: payslip + per-vest RSU net
  const vestMonthTotal =
    rsuPerVest && payeMonthlyPay !== null
      ? (input.rsuTaxWithheld
          ? payeMonthlyPay
          : (payeMonthlyAdjusted ?? payeMonthlyPay)) + rsuPerVest.netPerVest
      : null;

  // Effective and marginal tax rates
  const effectiveRate =
    totalGrossIncome > 0
      ? (incomeTax + nationalInsurance) / totalGrossIncome
      : 0;

  // Marginal rate: the rate on the next £1 of income
  const marginalTaxRate =
    taxableIncome > 125140
      ? 0.45
      : taxableIncome > 37700
        ? 0.4
        : taxableIncome > 0
          ? 0.2
          : 0;
  // PA taper adds effective 60% rate between £100k-£125,140
  const adjustedForTaper =
    adjustedNetIncome > 100000 && adjustedNetIncome < 125140;
  const marginalNiRate =
    niableIncome > 50270 ? 0.02 : niableIncome > 12570 ? 0.08 : 0;
  const marginalRate =
    (adjustedForTaper ? marginalTaxRate + 0.2 : marginalTaxRate) +
    marginalNiRate;

  return {
    grossSalary,
    bonus,
    taxableBenefits,
    rsuVests,
    rsuWithholding,
    rsuPerVest,
    totalGrossIncome,
    pensionContribution,
    employerPensionContribution,
    employerNiSaving,
    employerNiPassback,
    totalPensionContributions:
      pensionContribution +
      employerPensionContribution +
      employerNiPassback +
      sippContribution,
    sippContribution,
    niableIncome,
    adjustedNetIncome,
    personalAllowance,
    taxableIncome,
    incomeTaxBands,
    incomeTax,
    niBands,
    nationalInsurance,
    undergraduateLoanRepayment,
    postgraduateLoanRepayment,
    studentLoanRepayment,
    sippRelief,
    totalDeductions,
    netAnnualPay,
    netMonthlyPay,
    payeMonthlyPay,
    payeMonthlyAdjusted,
    vestMonthTotal,
    effectiveRate,
    marginalRate,
  };
}
