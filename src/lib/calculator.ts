import type {
  TaxRules,
  UndergraduatePlanId,
  Country,
  NiCategory,
} from './tax-rules';
import { getIncomeTaxBands } from './tax-rules';

export type SalaryPeriod = 'annual' | 'monthly' | 'daily';
export type FixedPeriod = 'annual' | 'monthly';

export interface CalculatorInput {
  country: Country;
  niCategory: NiCategory;
  isBlind: boolean;
  grossSalary: number;
  salaryPeriod: SalaryPeriod;
  daysPerWeek: number;
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
  pensionFixedPeriod: FixedPeriod;
  employerPensionContribution: {
    type: 'percentage' | 'fixed';
    value: number;
  };
  employerNiPassbackPercent: number;
  otherSalarySacrifice: number;
  sippContribution: number;
  sippInputType: 'gross' | 'net';
  selfEmploymentIncome: number;
  selfEmploymentInsideIR35: boolean;
  numberOfChildren: number;
  undergraduatePlans: Exclude<UndergraduatePlanId, 'none'>[];
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

  class4NiBands: BandBreakdown[];
  class4Ni: number;

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

  pensionAnnualAllowance: {
    allowance: number;
    tapered: boolean;
    totalContributions: number;
    excess: number;
  };

  childBenefit: {
    annualAmount: number;
    hicbcCharge: number;
    netChildBenefit: number;
  } | null;

  totalDeductions: number;
  netAnnualPay: number;
  netMonthlyPay: number;
  payslip: {
    normalMonth: number;
    bonusMonth: number | null;
    vestMonth: number | null;
    bonusVestMonth: number | null;
  } | null;
  effectiveRate: number;
  marginalRate: number;
}

export function calculatePersonalAllowance(
  adjustedNetIncome: number,
  rules: TaxRules,
  isBlind: boolean = false,
): number {
  const { amount, taperThreshold, taperRate } = rules.personalAllowance;
  let pa: number;
  if (adjustedNetIncome <= taperThreshold) {
    pa = amount;
  } else {
    const reduction = Math.floor(
      (adjustedNetIncome - taperThreshold) * taperRate,
    );
    pa = Math.max(0, amount - reduction);
  }
  // BPA is not subject to the income taper — always added on top
  if (isBlind) {
    pa += rules.blindPersonsAllowance;
  }
  return pa;
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
  country: Country,
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

  const bands = getIncomeTaxBands(rules, country);
  const taxWithSipp = calculateBandedTax(taxableWithSipp, bands).reduce(
    (sum, b) => sum + b.tax,
    0,
  );
  const taxWithout = calculateBandedTax(taxableWithout, bands).reduce(
    (sum, b) => sum + b.tax,
    0,
  );

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

function totalDeductionsAtSalary(
  salary: number,
  input: CalculatorInput,
  rules: TaxRules,
): number {
  const pensionRaw =
    input.pensionContribution.type === 'percentage'
      ? (salary * input.pensionContribution.value) / 100
      : input.pensionContribution.value;
  const pension = Math.min(pensionRaw, salary);
  const pensionSS = input.pensionContribution.salarySacrifice
    ? Math.min(pension, salary)
    : 0;
  const otherSS = Math.min(input.otherSalarySacrifice, salary - pensionSS);
  const ssDeduction = pensionSS + otherSS;
  const sipp =
    input.sippInputType === 'net'
      ? input.sippContribution / 0.8
      : input.sippContribution;

  const gross =
    salary +
    input.bonus +
    input.taxableBenefits +
    input.rsuVests +
    input.selfEmploymentIncome;
  const ir35SE =
    input.selfEmploymentIncome > 0 && input.selfEmploymentInsideIR35
      ? input.selfEmploymentIncome
      : 0;
  const niable = salary + input.bonus + input.rsuVests - ssDeduction + ir35SE;
  const adjusted = gross - ssDeduction - sipp;

  const pa = calculatePersonalAllowance(adjusted, rules, input.isBlind);
  const taxable = Math.max(0, adjusted - pa);
  const incomeTaxBands = getIncomeTaxBands(rules, input.country);
  const tax = calculateBandedTax(taxable, incomeTaxBands).reduce(
    (s, b) => s + b.tax,
    0,
  );
  // Category C (over state pension age): no employee NI
  const ni =
    input.niCategory !== 'A'
      ? 0
      : calculateBandedTax(
          niable,
          rules.nationalInsurance.employeeClass1.bands,
        ).reduce((s, b) => s + b.tax, 0);

  const class4 =
    input.selfEmploymentIncome > 0 && !input.selfEmploymentInsideIR35
      ? calculateBandedTax(
          input.selfEmploymentIncome,
          rules.nationalInsurance.class4.bands,
        ).reduce((s, b) => s + b.tax, 0)
      : 0;

  const studentLoanBase =
    niable + (input.selfEmploymentInsideIR35 ? 0 : input.selfEmploymentIncome);
  let studentLoan = 0;
  if (input.undergraduatePlans.length > 0) {
    const lowestThreshold = Math.min(
      ...input.undergraduatePlans.map(
        (p) => rules.studentLoans[p]?.threshold ?? Infinity,
      ),
    );
    studentLoan += Math.max(0, (studentLoanBase - lowestThreshold) * 0.09);
  }
  if (input.hasPostgraduateLoan) {
    studentLoan += calculateStudentLoanForPlan(
      studentLoanBase,
      'postgraduate',
      rules,
    );
  }

  let hicbc = 0;
  if (input.numberOfChildren > 0) {
    const cb = rules.childBenefit;
    const annualBenefit =
      cb.weeklyRateFirstChild * cb.weeksPerYear +
      Math.max(0, input.numberOfChildren - 1) *
        cb.weeklyRateAdditionalChild *
        cb.weeksPerYear;
    const { threshold, upperThreshold } = cb.hicbc;
    if (adjusted > threshold) {
      hicbc =
        annualBenefit *
        Math.min(1, (adjusted - threshold) / (upperThreshold - threshold));
    }
  }

  return tax + ni + class4 + studentLoan + hicbc;
}

function computeMarginalRate(
  input: CalculatorInput,
  currentSalary: number,
  rules: TaxRules,
): number {
  if (currentSalary <= 0) return 0;
  // Use £1 step for an accurate "next £1" marginal rate.
  // In the PA taper zone (£100k–£125,140), use a £2 step because the
  // taper removes £1 of PA per £2 of income and Math.floor means a
  // £1 step can miss the taper on odd-pound boundaries.
  const adjusted =
    currentSalary +
    input.bonus +
    input.taxableBenefits +
    input.rsuVests +
    input.selfEmploymentIncome;
  const inTaperZone =
    adjusted >= rules.personalAllowance.taperThreshold &&
    adjusted <
      rules.personalAllowance.taperThreshold +
        rules.personalAllowance.amount / rules.personalAllowance.taperRate;
  const step = inTaperZone ? 2 : 1;
  const atCurrent = totalDeductionsAtSalary(currentSalary, input, rules);
  const atNext = totalDeductionsAtSalary(currentSalary + step, input, rules);
  return (atNext - atCurrent) / step;
}

export function calculateTax(
  input: CalculatorInput,
  rules: TaxRules,
): CalculationResult {
  const { grossSalary, bonus, taxableBenefits, rsuVests } = input;

  // 1. Resolve pension contributions to £ amounts
  // Cap at gross salary — you can't contribute more than you earn
  const pensionContributionRaw =
    input.pensionContribution.type === 'percentage'
      ? (grossSalary * input.pensionContribution.value) / 100
      : input.pensionContribution.value;
  const pensionContribution = Math.min(pensionContributionRaw, grossSalary);

  const employerPensionContribution =
    input.employerPensionContribution.type === 'percentage'
      ? (grossSalary * input.employerPensionContribution.value) / 100
      : input.employerPensionContribution.value;

  // Calculate employer NI saving from salary sacrifice
  const employerNi = rules.nationalInsurance.employerClass1;
  // Employer NI saving from all salary sacrifice (pension + other)
  let employerNiSaving = 0;
  {
    const totalSS =
      (input.pensionContribution.salarySacrifice
        ? Math.min(pensionContribution, grossSalary)
        : 0) +
      Math.min(
        input.otherSalarySacrifice,
        grossSalary -
          (input.pensionContribution.salarySacrifice
            ? Math.min(pensionContribution, grossSalary)
            : 0),
      );
    if (totalSS > 0 && input.niCategory !== 'X') {
      const originalNiable = Math.max(
        0,
        grossSalary - employerNi.secondaryThreshold,
      );
      const reducedNiable = Math.max(
        0,
        grossSalary - totalSS - employerNi.secondaryThreshold,
      );
      employerNiSaving = (originalNiable - reducedNiable) * employerNi.rate;
    }
  }
  const employerNiPassback =
    employerNiSaving * (input.employerNiPassbackPercent / 100);

  // Resolve SIPP to gross: if user entered net (what they transferred),
  // gross = net / 0.8 (provider claims 20% basic rate relief on top)
  const sippContribution =
    input.sippInputType === 'net'
      ? input.sippContribution / 0.8
      : input.sippContribution;

  // 2. Total gross income (includes self-employment profits)
  const totalGrossIncome =
    grossSalary +
    bonus +
    taxableBenefits +
    rsuVests +
    input.selfEmploymentIncome;

  // 3. NI-able income: salary + bonus + RSUs - salary sacrifice
  // BIK is NOT subject to employee NI
  // Cap salary sacrifice at gross salary — you can't sacrifice more than you earn
  const pensionSacrifice = input.pensionContribution.salarySacrifice
    ? Math.min(pensionContribution, grossSalary)
    : 0;
  const otherSacrifice = Math.min(
    input.otherSalarySacrifice,
    grossSalary - pensionSacrifice,
  );
  const salarySacrificeDeduction = pensionSacrifice + otherSacrifice;
  // When inside IR35, self-employment income is treated as employment for NI
  const ir35Income =
    input.selfEmploymentIncome > 0 && input.selfEmploymentInsideIR35
      ? input.selfEmploymentIncome
      : 0;
  const niableIncome =
    grossSalary + bonus + rsuVests - salarySacrificeDeduction + ir35Income;

  // 4. Adjusted net income for income tax
  // Salary sacrifice reduces gross, SIPP reduces taxable income
  const adjustedNetIncome =
    totalGrossIncome - salarySacrificeDeduction - sippContribution;

  // 5. Personal allowance (with tapering + BPA)
  const personalAllowance = calculatePersonalAllowance(
    adjustedNetIncome,
    rules,
    input.isBlind,
  );

  // 6. Taxable income
  const taxableIncome = Math.max(0, adjustedNetIncome - personalAllowance);

  // 7. Income tax
  const activeBands = getIncomeTaxBands(rules, input.country);
  const incomeTaxBands = calculateBandedTax(taxableIncome, activeBands);
  const incomeTax = incomeTaxBands.reduce((sum, b) => sum + b.tax, 0);

  // 8. National Insurance (Category C = over state pension age, no employee NI)
  const niBands =
    input.niCategory !== 'A'
      ? []
      : calculateBandedTax(
          niableIncome,
          rules.nationalInsurance.employeeClass1.bands,
        );
  const nationalInsurance = niBands.reduce((sum, b) => sum + b.tax, 0);

  // 8b. Class 4 NI on self-employment profits (skipped when inside IR35,
  // since Class 1 NI is already applied above)
  const class4NiBands =
    input.selfEmploymentIncome > 0 && !input.selfEmploymentInsideIR35
      ? calculateBandedTax(
          input.selfEmploymentIncome,
          rules.nationalInsurance.class4.bands,
        )
      : [];
  const class4Ni = class4NiBands.reduce((sum, b) => sum + b.tax, 0);

  // 9. Student loans (based on total income: employment + self-employment)
  // Multiple undergraduate plans use a single 9% deduction on the lowest threshold.
  // Postgraduate loan is always separate at 6%.
  // When inside IR35, self-employment income is already in niableIncome
  const studentLoanIncome =
    niableIncome +
    (input.selfEmploymentInsideIR35 ? 0 : input.selfEmploymentIncome);
  let undergraduateLoanRepayment = 0;
  if (input.undergraduatePlans.length > 0) {
    const lowestThreshold = Math.min(
      ...input.undergraduatePlans.map(
        (p) => rules.studentLoans[p]?.threshold ?? Infinity,
      ),
    );
    undergraduateLoanRepayment = Math.max(
      0,
      (studentLoanIncome - lowestThreshold) * 0.09,
    );
  }
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
    input.country,
  );

  // 11. Child benefit & HICBC
  let childBenefit: CalculationResult['childBenefit'] = null;
  if (input.numberOfChildren > 0) {
    const cb = rules.childBenefit;
    const annualAmount =
      cb.weeklyRateFirstChild * cb.weeksPerYear +
      Math.max(0, input.numberOfChildren - 1) *
        cb.weeklyRateAdditionalChild *
        cb.weeksPerYear;
    const { threshold, upperThreshold } = cb.hicbc;
    let hicbcCharge = 0;
    if (adjustedNetIncome > threshold) {
      const chargePercent = Math.min(
        1,
        (adjustedNetIncome - threshold) / (upperThreshold - threshold),
      );
      hicbcCharge = annualAmount * chargePercent;
    }
    childBenefit = {
      annualAmount,
      hicbcCharge,
      netChildBenefit: annualAmount - hicbcCharge,
    };
  }

  // 12. RSU withholding
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
    class4Ni +
    studentLoanRepayment +
    pensionContribution +
    otherSacrifice +
    sippContribution;

  const netAnnualPay = totalGrossIncome - totalDeductions;
  const netMonthlyPay = netAnnualPay / 12;

  // Monthly PAYE payslip scenarios.
  // Compute annual deductions for salary-only, then salary+bonus, to derive
  // clean per-month figures. Only shown when bonus or RSUs make months differ.
  let payslip: CalculationResult['payslip'] = null;
  const hasBonus = bonus > 0;
  const hasRsu = rsuVests > 0;
  if (hasBonus || hasRsu) {
    // Helper: compute annual PAYE net for a given gross (salary + optional bonus)
    function payeAnnualNet(payeGrossSalary: number, payeBonus: number): number {
      const payeGross = payeGrossSalary + payeBonus + taxableBenefits;
      const payeNiable = payeGrossSalary + payeBonus - salarySacrificeDeduction;
      const payeAdjusted = payeGross - salarySacrificeDeduction;
      const payePA = calculatePersonalAllowance(
        payeAdjusted,
        rules,
        input.isBlind,
      );
      const payeTaxable = Math.max(0, payeAdjusted - payePA);
      const payeIT = calculateBandedTax(payeTaxable, activeBands).reduce(
        (s, b) => s + b.tax,
        0,
      );
      const payeNI =
        input.niCategory !== 'A'
          ? 0
          : calculateBandedTax(
              payeNiable,
              rules.nationalInsurance.employeeClass1.bands,
            ).reduce((s, b) => s + b.tax, 0);
      let ugLoan = 0;
      if (input.undergraduatePlans.length > 0) {
        const lowest = Math.min(
          ...input.undergraduatePlans.map(
            (p) => rules.studentLoans[p]?.threshold ?? Infinity,
          ),
        );
        ugLoan = Math.max(0, (payeNiable - lowest) * 0.09);
      }
      const slTotal =
        ugLoan +
        (input.hasPostgraduateLoan
          ? calculateStudentLoanForPlan(payeNiable, 'postgraduate', rules)
          : 0);
      return (
        payeGrossSalary +
        payeBonus -
        payeIT -
        payeNI -
        slTotal -
        pensionContribution
      );
    }

    // Salary-only annual net (no bonus, no RSUs)
    const salaryOnlyNet = payeAnnualNet(grossSalary, 0);
    const normalMonth = salaryOnlyNet / 12;

    // Bonus is paid in a single month: salary+bonus annual net minus 11 normal months
    const withBonusNet = payeAnnualNet(grossSalary, bonus);
    const bonusMonth = hasBonus
      ? withBonusNet - salaryOnlyNet + normalMonth
      : null;

    // Vest month: normal payslip + net RSU per vest
    const rsuNetPerVest = rsuPerVest
      ? rsuWithholding
        ? rsuPerVest.netPerVest
        : rsuPerVest.grossPerVest
      : 0;
    const vestMonth = hasRsu ? normalMonth + rsuNetPerVest : null;

    // Bonus + vest in same month
    const bonusVestMonth =
      hasBonus && hasRsu && bonusMonth !== null
        ? bonusMonth + rsuNetPerVest
        : null;

    payslip = { normalMonth, bonusMonth, vestMonth, bonusVestMonth };
  }

  // Effective and marginal tax rates — computed without pension/SIPP so they
  // reflect the underlying tax system and match the chart. Pension is a personal
  // choice, not a tax rate.
  const noPensionInput: CalculatorInput = {
    ...input,
    grossSalary: adjustedNetIncome,
    bonus: 0,
    taxableBenefits: 0,
    rsuVests: 0,
    rsuTaxWithheld: false,
    pensionContribution: { type: 'fixed', value: 0, salarySacrifice: false },
    employerPensionContribution: { type: 'fixed', value: 0 },
    employerNiPassbackPercent: 0,
    otherSalarySacrifice: 0,
    selfEmploymentIncome: 0,
    sippContribution: 0,
  };
  const rateDeductions = totalDeductionsAtSalary(
    adjustedNetIncome,
    noPensionInput,
    rules,
  );
  const effectiveRate =
    adjustedNetIncome > 0 ? rateDeductions / adjustedNetIncome : 0;
  const marginalRate = computeMarginalRate(
    noPensionInput,
    adjustedNetIncome,
    rules,
  );

  // 13. Pension annual allowance tapering
  // "Adjusted income" for AA = total income + ALL pension inputs (including employer)
  const totalPensionContributions =
    pensionContribution +
    employerPensionContribution +
    employerNiPassback +
    sippContribution;
  const aaAdjustedIncome =
    totalGrossIncome + employerPensionContribution + employerNiPassback;
  const {
    amount: aaBase,
    taperThreshold: aaTaper,
    taperRate: aaRate,
    minimumAllowance: aaMin,
  } = rules.pensionAnnualAllowance;
  let annualAllowance = aaBase;
  let aaTapered = false;
  if (aaAdjustedIncome > aaTaper) {
    const reduction = Math.floor((aaAdjustedIncome - aaTaper) * aaRate);
    annualAllowance = Math.max(aaMin, aaBase - reduction);
    aaTapered = annualAllowance < aaBase;
  }
  const aaExcess = Math.max(0, totalPensionContributions - annualAllowance);

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
    totalPensionContributions,
    sippContribution,
    niableIncome,
    adjustedNetIncome,
    personalAllowance,
    taxableIncome,
    incomeTaxBands,
    incomeTax,
    niBands,
    nationalInsurance,
    class4NiBands,
    class4Ni,
    undergraduateLoanRepayment,
    postgraduateLoanRepayment,
    studentLoanRepayment,
    sippRelief,
    pensionAnnualAllowance: {
      allowance: annualAllowance,
      tapered: aaTapered,
      totalContributions: totalPensionContributions,
      excess: aaExcess,
    },
    childBenefit,
    totalDeductions,
    netAnnualPay,
    netMonthlyPay,
    payslip,
    effectiveRate,
    marginalRate,
  };
}
