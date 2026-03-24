import { describe, it, expect } from 'vitest';
import {
  calculateTax,
  calculatePersonalAllowance,
  calculateBandedTax,
  calculateStudentLoanForPlan,
  type CalculatorInput,
} from './calculator';
import { getTaxRules } from './tax-rules';

const rules = getTaxRules('2025-26');

function makeInput(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    country: 'england',
    niCategory: 'A',
    isBlind: false,
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
    otherSalarySacrifice: 0,
    sippContribution: 0,
    sippInputType: 'gross',
    numberOfChildren: 0,
    undergraduatePlan: 'none',
    hasPostgraduateLoan: false,
    ...overrides,
  };
}

describe('calculatePersonalAllowance', () => {
  it('returns full allowance for income under taper threshold', () => {
    expect(calculatePersonalAllowance(50000, rules)).toBe(12570);
  });

  it('returns full allowance at exactly £100,000', () => {
    expect(calculatePersonalAllowance(100000, rules)).toBe(12570);
  });

  it('tapers allowance above £100,000', () => {
    // £110,000 → reduction = floor((110000 - 100000) * 0.5) = 5000
    expect(calculatePersonalAllowance(110000, rules)).toBe(7570);
  });

  it('returns zero allowance at £125,140', () => {
    expect(calculatePersonalAllowance(125140, rules)).toBe(0);
  });

  it('returns zero allowance above £125,140', () => {
    expect(calculatePersonalAllowance(200000, rules)).toBe(0);
  });
});

describe('calculateBandedTax', () => {
  it('returns empty array for zero income', () => {
    expect(calculateBandedTax(0, rules.incomeTax.bands)).toEqual([]);
  });

  it('calculates basic rate only', () => {
    const bands = calculateBandedTax(20000, rules.incomeTax.bands);
    expect(bands).toHaveLength(1);
    expect(bands[0].name).toBe('Basic rate');
    expect(bands[0].amount).toBe(20000);
    expect(bands[0].tax).toBe(4000);
  });

  it('calculates basic + higher rate', () => {
    const bands = calculateBandedTax(50000, rules.incomeTax.bands);
    expect(bands).toHaveLength(2);
    expect(bands[0].tax).toBe(37700 * 0.2); // Basic: 7540
    expect(bands[1].tax).toBe(12300 * 0.4); // Higher: 4920
  });
});

describe('calculateStudentLoanForPlan', () => {
  it('returns 0 when income below plan 1 threshold', () => {
    expect(calculateStudentLoanForPlan(25000, 'plan1', rules)).toBe(0);
  });

  it('calculates plan 1 repayment', () => {
    const repayment = calculateStudentLoanForPlan(30000, 'plan1', rules);
    expect(repayment).toBeCloseTo((30000 - 26065) * 0.09, 2);
  });

  it('calculates plan 2 repayment', () => {
    const repayment = calculateStudentLoanForPlan(35000, 'plan2', rules);
    expect(repayment).toBeCloseTo((35000 - 28470) * 0.09, 2);
  });

  it('calculates postgraduate repayment at 6%', () => {
    const repayment = calculateStudentLoanForPlan(30000, 'postgraduate', rules);
    expect(repayment).toBeCloseTo((30000 - 21000) * 0.06, 2);
  });
});

describe('calculateTax', () => {
  it('handles £0 salary', () => {
    const result = calculateTax(makeInput(), rules);
    expect(result.totalGrossIncome).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.nationalInsurance).toBe(0);
    expect(result.netAnnualPay).toBe(0);
  });

  it('calculates correctly for £50,000 salary', () => {
    const result = calculateTax(makeInput({ grossSalary: 50000 }), rules);

    expect(result.personalAllowance).toBe(12570);
    // Taxable income: 50000 - 12570 = 37430
    // Tax: 37430 * 0.20 = 7486
    expect(result.incomeTax).toBeCloseTo(7486, 2);

    // NI: (50000 - 12570) * 0.08 = 2994.40
    expect(result.nationalInsurance).toBeCloseTo(2994.4, 2);

    // Net: 50000 - 7486 - 2994.40 = 39519.60
    expect(result.netAnnualPay).toBeCloseTo(39519.6, 2);
    expect(result.netMonthlyPay).toBeCloseTo(39519.6 / 12, 2);
  });

  it('calculates correctly for £75,000 salary (higher rate)', () => {
    const result = calculateTax(makeInput({ grossSalary: 75000 }), rules);

    expect(result.personalAllowance).toBe(12570);
    // Taxable: 75000 - 12570 = 62430
    // Basic: 37700 * 0.20 = 7540
    // Higher: (62430 - 37700) * 0.40 = 24730 * 0.40 = 9892
    // Total tax: 17432
    expect(result.incomeTax).toBeCloseTo(17432, 2);

    // NI: (50270 - 12570) * 0.08 + (75000 - 50270) * 0.02
    //   = 37700 * 0.08 + 24730 * 0.02
    //   = 3016 + 494.60 = 3510.60
    expect(result.nationalInsurance).toBeCloseTo(3510.6, 2);
  });

  it('tapers personal allowance for £125,140 salary', () => {
    const result = calculateTax(makeInput({ grossSalary: 125140 }), rules);
    expect(result.personalAllowance).toBe(0);
  });

  it('handles salary sacrifice pension', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
      }),
      rules,
    );

    expect(result.pensionContribution).toBe(2500);
    // NI-able: 50000 - 2500 = 47500
    expect(result.niableIncome).toBe(47500);
    // Adjusted net income: 50000 - 2500 = 47500
    expect(result.adjustedNetIncome).toBe(47500);
    // Taxable: 47500 - 12570 = 34930
    // Tax: 34930 * 0.20 = 6986
    expect(result.incomeTax).toBeCloseTo(6986, 2);
    // NI: (47500 - 12570) * 0.08 = 34930 * 0.08 = 2794.40
    expect(result.nationalInsurance).toBeCloseTo(2794.4, 2);
  });

  it('calculates employer NI savings passback', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        employerNiPassbackPercent: 50,
      }),
      rules,
    );

    // Salary sacrifice = £2,500
    // Employer NI on £50k: (50000 - 5000) * 0.15 = 6750
    // Employer NI on £47.5k: (47500 - 5000) * 0.15 = 6375
    // Employer NI saving = 6750 - 6375 = 375
    expect(result.employerNiSaving).toBeCloseTo(375, 2);
    // 50% passback = 187.50
    expect(result.employerNiPassback).toBeCloseTo(187.5, 2);
    // Total pension: 2500 (employee) + 0 (employer base) + 187.50 (passback) + 0 (SIPP)
    expect(result.totalPensionContributions).toBeCloseTo(2687.5, 2);
  });

  it('has zero NI passback without salary sacrifice', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: false,
        },
        employerNiPassbackPercent: 50,
      }),
      rules,
    );

    expect(result.employerNiSaving).toBe(0);
    expect(result.employerNiPassback).toBe(0);
  });

  it('handles non-salary-sacrifice pension', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'fixed',
          value: 2500,
          salarySacrifice: false,
        },
      }),
      rules,
    );

    expect(result.pensionContribution).toBe(2500);
    // Non-SS pension doesn't reduce NI-able or taxable income
    expect(result.niableIncome).toBe(50000);
    expect(result.adjustedNetIncome).toBe(50000);
    // But it's still deducted from take-home
    expect(result.netAnnualPay).toBeCloseTo(50000 - 7486 - 2994.4 - 2500, 2);
  });

  it('handles SIPP contribution', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        sippContribution: 5000,
      }),
      rules,
    );

    // SIPP reduces adjusted net income for income tax
    expect(result.adjustedNetIncome).toBe(45000);
    // But not NI-able income
    expect(result.niableIncome).toBe(50000);
    // Taxable: 45000 - 12570 = 32430
    // Tax: 32430 * 0.20 = 6486
    expect(result.incomeTax).toBeCloseTo(6486, 2);
    // NI unchanged
    expect(result.nationalInsurance).toBeCloseTo(2994.4, 2);
  });

  it('converts net SIPP input to gross', () => {
    // £4000 net = £5000 gross (4000 / 0.8)
    const netInput = calculateTax(
      makeInput({
        grossSalary: 50000,
        sippContribution: 4000,
        sippInputType: 'net',
      }),
      rules,
    );
    const grossInput = calculateTax(
      makeInput({
        grossSalary: 50000,
        sippContribution: 5000,
        sippInputType: 'gross',
      }),
      rules,
    );

    expect(netInput.sippContribution).toBeCloseTo(5000, 2);
    expect(netInput.incomeTax).toBeCloseTo(grossInput.incomeTax, 2);
    expect(netInput.adjustedNetIncome).toBeCloseTo(
      grossInput.adjustedNetIncome,
      2,
    );
  });

  it('calculates SIPP relief for basic rate taxpayer', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        sippContribution: 5000,
      }),
      rules,
    );

    // Basic rate only — all relief is at source
    expect(result.sippRelief.grossContribution).toBe(5000);
    expect(result.sippRelief.basicRateRelief).toBe(1000); // 20%
    expect(result.sippRelief.selfAssessmentRelief).toBe(0);
    expect(result.sippRelief.totalRelief).toBe(1000);
    expect(result.sippRelief.effectiveCost).toBe(4000);
  });

  it('calculates SIPP relief for higher rate taxpayer', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 80000,
        sippContribution: 10000,
      }),
      rules,
    );

    // £80k salary, £10k SIPP → adjusted net income = £70k
    // Without SIPP: taxable = 80000 - 12570 = 67430
    //   Tax = 37700*0.20 + 29730*0.40 = 7540 + 11892 = 19432
    // With SIPP: taxable = 70000 - 12570 = 57430
    //   Tax = 37700*0.20 + 19730*0.40 = 7540 + 7892 = 15432
    // Total relief = 19432 - 15432 = 4000
    expect(result.sippRelief.grossContribution).toBe(10000);
    expect(result.sippRelief.basicRateRelief).toBe(2000); // 20%
    expect(result.sippRelief.selfAssessmentRelief).toBeCloseTo(2000, 2); // extra 20%
    expect(result.sippRelief.totalRelief).toBeCloseTo(4000, 2);
    expect(result.sippRelief.effectiveCost).toBeCloseTo(6000, 2);
  });

  it('calculates SIPP relief with zero contribution', () => {
    const result = calculateTax(makeInput({ grossSalary: 50000 }), rules);

    expect(result.sippRelief.grossContribution).toBe(0);
    expect(result.sippRelief.basicRateRelief).toBe(0);
    expect(result.sippRelief.selfAssessmentRelief).toBe(0);
    expect(result.sippRelief.totalRelief).toBe(0);
    expect(result.sippRelief.effectiveCost).toBe(0);
  });

  it('handles bonus income', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        bonus: 10000,
      }),
      rules,
    );

    expect(result.totalGrossIncome).toBe(50000);
    // Same tax as £50k salary
    expect(result.incomeTax).toBeCloseTo(7486, 2);
  });

  it('calculates RSU withholding when enabled', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        rsuVests: 10000,
        rsuTaxWithheld: true,
      }),
      rules,
    );

    expect(result.rsuWithholding).not.toBeNull();
    expect(result.rsuWithholding!.taxWithheld).toBe(4500); // 45%
    expect(result.rsuWithholding!.niWithheld).toBe(200); // 2%
    expect(result.rsuWithholding!.totalWithheld).toBe(4700); // 47%
    expect(result.rsuWithholding!.netRsuValue).toBe(5300); // 53%
  });

  it('calculates monthly payslip excluding RSU income', () => {
    // With RSUs: tax is higher due to combined income
    const withRsus = calculateTax(
      makeInput({ grossSalary: 50000, rsuVests: 20000 }),
      rules,
    );
    // Without RSUs: tax on salary alone
    const withoutRsus = calculateTax(makeInput({ grossSalary: 50000 }), rules);

    // PAYE monthly should match what you'd get with salary only
    expect(withRsus.payeMonthlyPay).not.toBeNull();
    expect(withRsus.payeMonthlyPay).toBeCloseTo(
      withoutRsus.netAnnualPay / 12,
      2,
    );
    // No RSUs → no separate PAYE figure needed
    expect(withoutRsus.payeMonthlyPay).toBeNull();
  });

  it('SIPP does not affect monthly payslip', () => {
    const withSipp = calculateTax(
      makeInput({
        grossSalary: 50000,
        rsuVests: 10000,
        sippContribution: 5000,
      }),
      rules,
    );
    const withoutSipp = calculateTax(
      makeInput({
        grossSalary: 50000,
        rsuVests: 10000,
      }),
      rules,
    );

    // SIPP is personal, not via payroll — payslip should be identical
    expect(withSipp.payeMonthlyPay).toBeCloseTo(withoutSipp.payeMonthlyPay!, 2);
  });

  it('vest month total = payslip + per-vest RSU net', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        rsuVests: 20000,
        rsuTaxWithheld: true,
        rsuVestingPeriodsPerYear: 4,
      }),
      rules,
    );

    const perVestNet = (20000 * 0.53) / 4;
    expect(result.vestMonthTotal).toBeCloseTo(
      result.payeMonthlyPay! + perVestNet,
      2,
    );
  });

  it('payslip is same regardless of RSU withholding setting', () => {
    const withholding = calculateTax(
      makeInput({
        grossSalary: 50000,
        rsuVests: 20000,
        rsuTaxWithheld: true,
      }),
      rules,
    );
    const noWithholding = calculateTax(
      makeInput({
        grossSalary: 50000,
        rsuVests: 20000,
        rsuTaxWithheld: false,
      }),
      rules,
    );

    expect(withholding.payeMonthlyPay).toBeCloseTo(
      noWithholding.payeMonthlyPay!,
      2,
    );
  });

  it('handles RSU vests', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        rsuVests: 10000,
      }),
      rules,
    );

    expect(result.totalGrossIncome).toBe(50000);
    expect(result.niableIncome).toBe(50000); // RSUs are NI-able
    expect(result.incomeTax).toBeCloseTo(7486, 2);
  });

  it('handles taxable benefits (BIK)', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 45000,
        taxableBenefits: 5000,
      }),
      rules,
    );

    expect(result.totalGrossIncome).toBe(50000);
    // BIK not included in NI-able income
    expect(result.niableIncome).toBe(45000);
    // But BIK is taxable for income tax
    expect(result.adjustedNetIncome).toBe(50000);
    // Taxable: 50000 - 12570 = 37430, tax = 7486
    expect(result.incomeTax).toBeCloseTo(7486, 2);
    // NI only on 45000: (45000 - 12570) * 0.08 = 2594.40
    expect(result.nationalInsurance).toBeCloseTo(2594.4, 2);
  });

  it('handles undergraduate loan plan 1 with £30,000 salary', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 30000,
        undergraduatePlan: 'plan1',
      }),
      rules,
    );

    expect(result.undergraduateLoanRepayment).toBeCloseTo(
      (30000 - 26065) * 0.09,
      2,
    );
    expect(result.postgraduateLoanRepayment).toBe(0);
    expect(result.studentLoanRepayment).toBeCloseTo((30000 - 26065) * 0.09, 2);
  });

  it('handles postgraduate loan only', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 30000,
        hasPostgraduateLoan: true,
      }),
      rules,
    );

    expect(result.undergraduateLoanRepayment).toBe(0);
    expect(result.postgraduateLoanRepayment).toBeCloseTo(
      (30000 - 21000) * 0.06,
      2,
    );
  });

  it('combines undergraduate and postgraduate loans', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
        hasPostgraduateLoan: true,
      }),
      rules,
    );

    const expectedUg = (40000 - 28470) * 0.09;
    const expectedPg = (40000 - 21000) * 0.06;
    expect(result.undergraduateLoanRepayment).toBeCloseTo(expectedUg, 2);
    expect(result.postgraduateLoanRepayment).toBeCloseTo(expectedPg, 2);
    expect(result.studentLoanRepayment).toBeCloseTo(expectedUg + expectedPg, 2);
  });

  it('calculates correct monthly pay', () => {
    const result = calculateTax(makeInput({ grossSalary: 60000 }), rules);
    expect(result.netMonthlyPay).toBeCloseTo(result.netAnnualPay / 12, 2);
  });

  it('handles salary at exact threshold boundaries', () => {
    // Salary exactly at personal allowance
    const result = calculateTax(makeInput({ grossSalary: 12570 }), rules);
    expect(result.incomeTax).toBe(0);
    expect(result.nationalInsurance).toBe(0);
  });

  // --- Additional rate ---

  it('calculates additional rate at £150,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 150000 }), rules);

    expect(result.personalAllowance).toBe(0);
    // Basic: 37700 * 0.20 = 7540
    // Higher: (125140-37700) * 0.40 = 87440 * 0.40 = 34976
    // Additional: (150000-125140) * 0.45 = 24860 * 0.45 = 11187
    expect(result.incomeTax).toBeCloseTo(53703, 2);
    // NI: (50270-12570)*0.08 + (150000-50270)*0.02 = 3016 + 1994.60
    expect(result.nationalInsurance).toBeCloseTo(5010.6, 2);
    expect(result.netAnnualPay).toBeCloseTo(91286.4, 2);
  });

  it('calculates additional rate at £200,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 200000 }), rules);

    // Tax: 7540 + 34976 + (200000-125140)*0.45 = 7540 + 34976 + 33687
    expect(result.incomeTax).toBeCloseTo(76203, 2);
    expect(result.nationalInsurance).toBeCloseTo(6010.6, 2);
  });

  // --- PA taper zone ---

  it('tapers PA at £110,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 110000 }), rules);

    // PA reduced by floor((110000-100000)*0.5) = 5000
    expect(result.personalAllowance).toBe(7570);
    // Taxable: 110000-7570 = 102430
    // Basic: 37700*0.20=7540, Higher: 64730*0.40=25892
    expect(result.incomeTax).toBeCloseTo(33432, 2);
  });

  it('PA fully tapered at exactly £125,140', () => {
    const result = calculateTax(makeInput({ grossSalary: 125140 }), rules);

    expect(result.personalAllowance).toBe(0);
    // Tax: 7540 + (125140-37700)*0.40 = 7540 + 34976 = 42516
    expect(result.incomeTax).toBeCloseTo(42516, 2);
  });

  // --- NI thresholds ---

  it('NI drops to 2% above UEL at £50,270', () => {
    const at = calculateTax(makeInput({ grossSalary: 50270 }), rules);
    const above = calculateTax(makeInput({ grossSalary: 50271 }), rules);

    // At UEL: all NI at 8%
    expect(at.nationalInsurance).toBeCloseTo(3016, 2);
    // Just above: extra £1 at 2% not 8%
    expect(above.nationalInsurance).toBeCloseTo(3016.02, 2);
  });

  // --- Below PA ---

  it('no tax or NI below personal allowance', () => {
    const result = calculateTax(makeInput({ grossSalary: 10000 }), rules);
    expect(result.incomeTax).toBe(0);
    expect(result.nationalInsurance).toBe(0);
    expect(result.netAnnualPay).toBe(10000);
  });

  // --- Student loan plans ---

  it('Plan 4 threshold is £32,745', () => {
    const below = calculateTax(
      makeInput({ grossSalary: 32000, undergraduatePlan: 'plan4' }),
      rules,
    );
    const above = calculateTax(
      makeInput({ grossSalary: 35000, undergraduatePlan: 'plan4' }),
      rules,
    );

    expect(below.studentLoanRepayment).toBe(0);
    expect(above.studentLoanRepayment).toBeCloseTo((35000 - 32745) * 0.09, 2);
  });

  it('Plan 5 threshold is £25,000', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 30000, undergraduatePlan: 'plan5' }),
      rules,
    );
    expect(result.studentLoanRepayment).toBeCloseTo((30000 - 25000) * 0.09, 2);
  });

  // --- Net pay integrity ---

  it('deductions + net pay = gross income', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 75000, undergraduatePlan: 'plan2' }),
      rules,
    );
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(
      result.totalGrossIncome,
      2,
    );
  });

  it('deductions + net pay = gross with pension and SIPP', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 80000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        sippContribution: 5000,
      }),
      rules,
    );
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(
      result.totalGrossIncome,
      2,
    );
  });

  // --- Complex combined scenario ---

  it('complex scenario: £80k + bonus + BIK + RSUs + SS pension + SIPP + Plan 2 + postgrad', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 80000,
        bonus: 10000,
        taxableBenefits: 5000,
        rsuVests: 20000,
        rsuTaxWithheld: true,
        rsuVestingPeriodsPerYear: 4,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        sippContribution: 5000,
        undergraduatePlan: 'plan2',
        hasPostgraduateLoan: true,
      }),
      rules,
    );

    // Gross: 80k + 10k + 5k + 20k = 115k
    expect(result.totalGrossIncome).toBe(115000);
    // SS pension: 5% of 80k = 4k
    expect(result.pensionContribution).toBe(4000);
    // Adjusted: 115000 - 4000(SS) - 5000(SIPP) = 106000
    expect(result.adjustedNetIncome).toBe(106000);
    // PA: 12570 - floor((106000-100000)*0.5) = 12570-3000 = 9570
    expect(result.personalAllowance).toBe(9570);
    // NI-able: 80k + 10k + 20k - 4k = 106k
    expect(result.niableIncome).toBe(106000);
    // Student loan on NI-able: (106000-28470)*0.09 + (106000-21000)*0.06
    expect(result.studentLoanRepayment).toBeCloseTo(
      (106000 - 28470) * 0.09 + (106000 - 21000) * 0.06,
      2,
    );
    // Deductions + net = gross
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(115000, 2);
    // RSU withholding
    expect(result.rsuWithholding).not.toBeNull();
    expect(result.rsuWithholding!.totalWithheld).toBe(20000 * 0.47);
    // Per vest
    expect(result.rsuPerVest).not.toBeNull();
    expect(result.rsuPerVest!.grossPerVest).toBe(5000);
    expect(result.rsuPerVest!.netPerVest).toBe(5000 * 0.53);
  });

  // --- Pension capped at salary ---

  it('caps pension contribution at gross salary', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'percentage',
          value: 120,
          salarySacrifice: true,
        },
      }),
      rules,
    );

    expect(result.pensionContribution).toBe(50000);
    expect(result.netAnnualPay).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.nationalInsurance).toBe(0);
  });

  // --- Marginal rates at key thresholds ---

  it('marginal rate is 0% below PA', () => {
    const result = calculateTax(makeInput({ grossSalary: 10000 }), rules);
    expect(result.marginalRate).toBeCloseTo(0, 2);
  });

  it('marginal rate is 28% in basic rate band', () => {
    const result = calculateTax(makeInput({ grossSalary: 30000 }), rules);
    // 20% tax + 8% NI
    expect(result.marginalRate).toBeCloseTo(0.28, 2);
  });

  it('marginal rate is 42% in higher rate band', () => {
    const result = calculateTax(makeInput({ grossSalary: 60000 }), rules);
    // 40% tax + 2% NI
    expect(result.marginalRate).toBeCloseTo(0.42, 2);
  });

  it('marginal rate is 62% in PA taper zone', () => {
    const result = calculateTax(makeInput({ grossSalary: 110000 }), rules);
    // 40% tax + 20% taper + 2% NI
    expect(result.marginalRate).toBeCloseTo(0.62, 2);
  });

  it('marginal rate is 47% above taper zone', () => {
    const result = calculateTax(makeInput({ grossSalary: 150000 }), rules);
    // 45% additional + 2% NI
    expect(result.marginalRate).toBeCloseTo(0.47, 2);
  });

  it('marginal rate includes student loan', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 30000, undergraduatePlan: 'plan2' }),
      rules,
    );
    // 20% tax + 8% NI + 9% Plan 2
    expect(result.marginalRate).toBeCloseTo(0.37, 2);
  });

  it('marginal rate includes both undergraduate and postgraduate loan', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
        hasPostgraduateLoan: true,
      }),
      rules,
    );
    // 20% tax + 8% NI + 9% Plan 2 + 6% postgrad
    expect(result.marginalRate).toBeCloseTo(0.43, 2);
  });
});

// --- 2026/27 tax year ---

describe('2026/27 tax year', () => {
  const rules2627 = getTaxRules('2026-27');

  it('income tax unchanged from 2025/26', () => {
    const r = calculateTax(makeInput({ grossSalary: 50000 }), rules2627);
    expect(r.personalAllowance).toBe(12570);
    expect(r.incomeTax).toBeCloseTo(7486, 2);
    expect(r.nationalInsurance).toBeCloseTo(2994.4, 2);
  });

  it('Plan 1 threshold increased to £26,900', () => {
    const r = calculateTax(
      makeInput({ grossSalary: 30000, undergraduatePlan: 'plan1' }),
      rules2627,
    );
    expect(r.studentLoanRepayment).toBeCloseTo((30000 - 26900) * 0.09, 2);
  });

  it('Plan 2 threshold increased to £29,385', () => {
    // £29,000 is below 2026/27 threshold but above 2025/26 threshold
    const r2627 = calculateTax(
      makeInput({ grossSalary: 29000, undergraduatePlan: 'plan2' }),
      rules2627,
    );
    const r2526 = calculateTax(
      makeInput({ grossSalary: 29000, undergraduatePlan: 'plan2' }),
      rules,
    );
    // No repayment in 2026/27 (below £29,385), but repayment in 2025/26 (above £28,470)
    expect(r2627.studentLoanRepayment).toBe(0);
    expect(r2526.studentLoanRepayment).toBeGreaterThan(0);
  });

  it('Plan 4 threshold increased to £33,795', () => {
    const r = calculateTax(
      makeInput({ grossSalary: 35000, undergraduatePlan: 'plan4' }),
      rules2627,
    );
    expect(r.studentLoanRepayment).toBeCloseTo((35000 - 33795) * 0.09, 2);
  });

  it('Plan 5 and Postgrad thresholds unchanged', () => {
    const r = calculateTax(
      makeInput({
        grossSalary: 30000,
        undergraduatePlan: 'plan5',
        hasPostgraduateLoan: true,
      }),
      rules2627,
    );
    expect(r.undergraduateLoanRepayment).toBeCloseTo((30000 - 25000) * 0.09, 2);
    expect(r.postgraduateLoanRepayment).toBeCloseTo((30000 - 21000) * 0.06, 2);
  });
});

// --- Historical tax years ---

describe('2020/21 tax year', () => {
  const rules2021 = getTaxRules('2020-21');

  it('PA is £12,500', () => {
    const r = calculateTax(makeInput({ grossSalary: 50000 }), rules2021);
    expect(r.personalAllowance).toBe(12500);
  });

  it('additional rate at £150,000 (not £125,140)', () => {
    const r = calculateTax(makeInput({ grossSalary: 160000 }), rules2021);
    // PA = 0, taxable = 160000
    // Basic: 37500 * 0.20 = 7500
    // Higher: (150000 - 37500) * 0.40 = 45000
    // Additional: (160000 - 150000) * 0.45 = 4500
    expect(r.incomeTax).toBeCloseTo(57000, 2);
  });

  it('NI at 12% with PT £9,500', () => {
    const r = calculateTax(makeInput({ grossSalary: 30000 }), rules2021);
    // NI: (30000 - 9500) * 0.12 = 2460
    expect(r.nationalInsurance).toBeCloseTo(2460, 2);
  });

  it('Plan 5 does not exist', () => {
    const r = calculateTax(
      makeInput({ grossSalary: 30000, undergraduatePlan: 'plan5' }),
      rules2021,
    );
    expect(r.studentLoanRepayment).toBe(0);
  });

  it('HICBC threshold is £50,000', () => {
    const r = calculateTax(
      makeInput({ grossSalary: 55000, numberOfChildren: 1 }),
      rules2021,
    );
    // (55000 - 50000) / (60000 - 50000) = 50% clawback
    const annual = 21.05 * 52;
    expect(r.childBenefit!.hicbcCharge).toBeCloseTo(annual * 0.5, 2);
  });
});

describe('2022/23 tax year', () => {
  const rules2223 = getTaxRules('2022-23');

  it('NI at 13.25% (Health & Social Care Levy)', () => {
    const r = calculateTax(makeInput({ grossSalary: 40000 }), rules2223);
    // NI: (40000 - 12570) * 0.1325 = 3634.47...
    expect(r.nationalInsurance).toBeCloseTo((40000 - 12570) * 0.1325, 2);
  });

  it('additional rate still at £150,000', () => {
    const r = calculateTax(makeInput({ grossSalary: 160000 }), rules2223);
    const bands = r.incomeTaxBands;
    expect(bands[bands.length - 1].name).toBe('Additional rate');
    expect(bands[bands.length - 1].amount).toBeCloseTo(10000, 2);
  });
});

describe('2023/24 tax year', () => {
  const rules2324 = getTaxRules('2023-24');

  it('additional rate lowered to £125,140', () => {
    const r = calculateTax(makeInput({ grossSalary: 130000 }), rules2324);
    const bands = r.incomeTaxBands;
    expect(bands[bands.length - 1].name).toBe('Additional rate');
    expect(bands[bands.length - 1].amount).toBeCloseTo(130000 - 125140, 2);
  });

  it('NI at 12%', () => {
    const r = calculateTax(makeInput({ grossSalary: 40000 }), rules2324);
    expect(r.nationalInsurance).toBeCloseTo((40000 - 12570) * 0.12, 2);
  });

  it('Plan 5 exists from 2023-24', () => {
    const r = calculateTax(
      makeInput({ grossSalary: 30000, undergraduatePlan: 'plan5' }),
      rules2324,
    );
    expect(r.studentLoanRepayment).toBeCloseTo((30000 - 25000) * 0.09, 2);
  });

  it('Scottish advanced rate introduced at 45%', () => {
    const r = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 80000 }),
      rules2324,
    );
    // Should have 5 bands (starter, basic, intermediate, higher, advanced)
    expect(r.incomeTaxBands.length).toBe(5);
    expect(r.incomeTaxBands[4].name).toBe('Advanced rate');
    expect(r.incomeTaxBands[4].rate).toBe(0.45);
  });
});

describe('2024/25 tax year', () => {
  const rules2425 = getTaxRules('2024-25');

  it('NI cut to 8%', () => {
    const r = calculateTax(makeInput({ grossSalary: 40000 }), rules2425);
    expect(r.nationalInsurance).toBeCloseTo((40000 - 12570) * 0.08, 2);
  });

  it('HICBC threshold raised to £60,000', () => {
    // £55k should have no HICBC in 2024-25 (threshold £60k)
    const r = calculateTax(
      makeInput({ grossSalary: 55000, numberOfChildren: 1 }),
      rules2425,
    );
    expect(r.childBenefit!.hicbcCharge).toBe(0);
  });

  it('Scottish top rate at 48%', () => {
    const r = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 200000 }),
      rules2425,
    );
    const topBand = r.incomeTaxBands[r.incomeTaxBands.length - 1];
    expect(topBand.name).toBe('Top rate');
    expect(topBand.rate).toBe(0.48);
  });
});

// --- Scottish income tax ---

describe('Scottish income tax', () => {
  it('uses Scottish bands for £30,000 salary', () => {
    const result = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 30000 }),
      rules,
    );

    // Taxable: 30000 - 12570 = 17430
    // Starter: 2827 * 0.19 = 537.13
    // Basic: (14921-2827) * 0.20 = 12094 * 0.20 = 2418.80
    // Intermediate: (17430-14921) * 0.21 = 2509 * 0.21 = 526.89
    // Total: 3482.82
    expect(result.incomeTax).toBeCloseTo(3482.82, 2);
    // NI is same as England
    expect(result.nationalInsurance).toBeCloseTo((30000 - 12570) * 0.08, 2);
  });

  it('uses Scottish bands for £75,000 salary', () => {
    const result = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 75000 }),
      rules,
    );

    // Taxable: 75000 - 12570 = 62430
    // Starter: 2827 * 0.19 = 537.13
    // Basic: 12094 * 0.20 = 2418.80
    // Intermediate: (31092-14921) * 0.21 = 16171 * 0.21 = 3395.91
    // Higher: (62430-31092) * 0.42 = 31338 * 0.42 = 13161.96
    // Total: 19513.80
    expect(result.incomeTax).toBeCloseTo(19513.8, 2);
  });

  it('uses Scottish top rate at £200,000', () => {
    const result = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 200000 }),
      rules,
    );

    // PA = 0, taxable = 200000
    // Starter: 2827 * 0.19 = 537.13
    // Basic: 12094 * 0.20 = 2418.80
    // Intermediate: 16171 * 0.21 = 3395.91
    // Higher: 31338 * 0.42 = 13161.96
    // Advanced: (112570-62430) * 0.45 = 50140 * 0.45 = 22563.00
    // Top: (200000-112570) * 0.48 = 87430 * 0.48 = 41966.40
    // Total: 84043.20
    expect(result.incomeTax).toBeCloseTo(84043.2, 2);
  });

  it('Scottish tax is higher than England at £75,000', () => {
    const scottish = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 75000 }),
      rules,
    );
    const english = calculateTax(
      makeInput({ country: 'england', grossSalary: 75000 }),
      rules,
    );

    expect(scottish.incomeTax).toBeGreaterThan(english.incomeTax);
    // NI should be identical
    expect(scottish.nationalInsurance).toBe(english.nationalInsurance);
  });

  it('PA tapering works the same in Scotland', () => {
    const result = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 110000 }),
      rules,
    );
    // PA reduced same as England
    expect(result.personalAllowance).toBe(7570);
  });

  it('SIPP relief uses Scottish bands', () => {
    const scottish = calculateTax(
      makeInput({
        country: 'scotland',
        grossSalary: 80000,
        sippContribution: 10000,
      }),
      rules,
    );
    const english = calculateTax(
      makeInput({
        country: 'england',
        grossSalary: 80000,
        sippContribution: 10000,
      }),
      rules,
    );

    // Different income tax bands → different SIPP relief
    expect(scottish.sippRelief.totalRelief).not.toBe(
      english.sippRelief.totalRelief,
    );
  });

  it('student loans and NI unchanged in Scotland', () => {
    const scottish = calculateTax(
      makeInput({
        country: 'scotland',
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    const english = calculateTax(
      makeInput({
        country: 'england',
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );

    expect(scottish.nationalInsurance).toBe(english.nationalInsurance);
    expect(scottish.studentLoanRepayment).toBe(english.studentLoanRepayment);
  });
});

// --- 2026/27 Scottish tax ---

describe('2026/27 Scottish income tax', () => {
  const rules2627 = getTaxRules('2026-27');

  it('uses widened starter and basic bands for 2026/27', () => {
    const r2627 = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 30000 }),
      rules2627,
    );
    const r2526 = calculateTax(
      makeInput({ country: 'scotland', grossSalary: 30000 }),
      rules,
    );

    // 2026/27 has wider starter/basic bands → slightly less tax
    expect(r2627.incomeTax).not.toBe(r2526.incomeTax);
  });
});

// --- Effective rate ---

describe('effective rate', () => {
  it('is 0% below personal allowance', () => {
    const result = calculateTax(makeInput({ grossSalary: 10000 }), rules);
    expect(result.effectiveRate).toBe(0);
  });

  it('is correct for basic rate taxpayer at £30,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 30000 }), rules);
    // Tax: (30000 - 12570) * 0.20 = 3486
    // NI:  (30000 - 12570) * 0.08 = 1394.40
    // Total deductions: 4880.40
    // Effective: 4880.40 / 30000 ≈ 16.27%
    expect(result.effectiveRate).toBeCloseTo(4880.4 / 30000, 4);
  });

  it('is correct for higher rate taxpayer at £75,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 75000 }), rules);
    // Tax: 37700*0.20 + 24730*0.40 = 7540 + 9892 = 17432
    // NI:  37700*0.08 + 24730*0.02 = 3016 + 494.60 = 3510.60
    // Total: 20942.60
    expect(result.effectiveRate).toBeCloseTo(20942.6 / 75000, 4);
  });

  it('is correct for additional rate taxpayer at £200,000', () => {
    const result = calculateTax(makeInput({ grossSalary: 200000 }), rules);
    // Tax: 7540 + 34976 + 33687 = 76203
    // NI:  3016 + 2994.60 = 6010.60
    // Total: 82213.60
    expect(result.effectiveRate).toBeCloseTo(82213.6 / 200000, 4);
  });
});

// --- SIPP in PA taper zone ---

describe('SIPP restoring personal allowance', () => {
  it('SIPP contribution restores PA in taper zone', () => {
    // £110k income, PA tapered to £7,570
    const withoutSipp = calculateTax(makeInput({ grossSalary: 110000 }), rules);
    expect(withoutSipp.personalAllowance).toBe(7570);

    // £10k SIPP brings adjusted net income to £100k → full PA restored
    const withSipp = calculateTax(
      makeInput({ grossSalary: 110000, sippContribution: 10000 }),
      rules,
    );
    expect(withSipp.adjustedNetIncome).toBe(100000);
    expect(withSipp.personalAllowance).toBe(12570);

    // Tax saving should reflect restored PA + basic rate on SIPP
    expect(withSipp.incomeTax).toBeLessThan(withoutSipp.incomeTax);
  });

  it('SIPP relief captures PA restoration benefit', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 110000, sippContribution: 10000 }),
      rules,
    );

    // Without SIPP: adjusted = £110k, PA = £7,570, taxable = £102,430
    //   Tax = 37700*0.20 + 64730*0.40 = 7540 + 25892 = 33432
    // With SIPP: adjusted = £100k, PA = £12,570, taxable = £87,430
    //   Tax = 37700*0.20 + 49730*0.40 = 7540 + 19892 = 27432
    // Total relief = 33432 - 27432 = 6000
    expect(result.sippRelief.totalRelief).toBeCloseTo(6000, 2);
    // Basic rate relief = 2000, self-assessment = 4000
    expect(result.sippRelief.basicRateRelief).toBe(2000);
    expect(result.sippRelief.selfAssessmentRelief).toBeCloseTo(4000, 2);
  });
});

// --- Student loan with salary sacrifice ---

describe('student loan with salary sacrifice', () => {
  it('salary sacrifice reduces student loan repayment base', () => {
    const withoutSS = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    const withSS = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
      }),
      rules,
    );

    // Without SS: (40000 - 28470) * 0.09 = 1037.70
    expect(withoutSS.studentLoanRepayment).toBeCloseTo(1037.7, 2);
    // With SS: NI-able = 40000 - 2000 = 38000, (38000 - 28470) * 0.09 = 857.70
    expect(withSS.studentLoanRepayment).toBeCloseTo(857.7, 2);
    expect(withSS.studentLoanRepayment).toBeLessThan(
      withoutSS.studentLoanRepayment,
    );
  });

  it('SIPP does NOT reduce student loan repayment', () => {
    const withSipp = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
        sippContribution: 5000,
      }),
      rules,
    );
    const withoutSipp = calculateTax(
      makeInput({
        grossSalary: 40000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );

    expect(withSipp.studentLoanRepayment).toBeCloseTo(
      withoutSipp.studentLoanRepayment,
      2,
    );
  });
});

// --- Employer pension ---

describe('employer pension contribution', () => {
  it('calculates percentage employer pension', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 60000,
        employerPensionContribution: { type: 'percentage', value: 5 },
      }),
      rules,
    );

    expect(result.employerPensionContribution).toBe(3000);
    // Employer pension does not affect tax, NI, or take-home
    expect(result.incomeTax).toBeCloseTo(
      calculateTax(makeInput({ grossSalary: 60000 }), rules).incomeTax,
      2,
    );
    expect(result.netAnnualPay).toBeCloseTo(
      calculateTax(makeInput({ grossSalary: 60000 }), rules).netAnnualPay,
      2,
    );
  });

  it('calculates fixed employer pension', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 60000,
        employerPensionContribution: { type: 'fixed', value: 4000 },
      }),
      rules,
    );

    expect(result.employerPensionContribution).toBe(4000);
  });

  it('includes employer pension in total pension contributions', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 60000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        employerPensionContribution: { type: 'percentage', value: 3 },
        sippContribution: 2000,
      }),
      rules,
    );

    // Total = employee(3000) + employer(1800) + passback(0) + SIPP(2000)
    expect(result.totalPensionContributions).toBeCloseTo(
      3000 + 1800 + 0 + 2000,
      2,
    );
  });
});

// --- SIPP at additional rate ---

describe('SIPP relief at additional rate', () => {
  it('provides 45% relief on additional rate income', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 200000,
        sippContribution: 10000,
      }),
      rules,
    );

    // All £10k SIPP sits in the additional rate band
    // Total relief = 10000 * 0.45 = 4500
    expect(result.sippRelief.totalRelief).toBeCloseTo(4500, 2);
    expect(result.sippRelief.basicRateRelief).toBe(2000);
    expect(result.sippRelief.selfAssessmentRelief).toBeCloseTo(2500, 2);
    expect(result.sippRelief.effectiveCost).toBeCloseTo(5500, 2);
  });
});

// --- Bonus pushes into higher rate ---

describe('bonus tax interactions', () => {
  it('bonus pushes salary into higher rate band', () => {
    // £48k salary is all basic rate
    const salaryOnly = calculateTax(makeInput({ grossSalary: 48000 }), rules);
    // £48k + £10k bonus crosses into higher rate
    const withBonus = calculateTax(
      makeInput({ grossSalary: 48000, bonus: 10000 }),
      rules,
    );

    // Salary only: taxable = 48000 - 12570 = 35430, all basic rate
    expect(salaryOnly.incomeTaxBands).toHaveLength(1);
    // With bonus: taxable = 58000 - 12570 = 45430, crosses into higher rate at 37700
    expect(withBonus.incomeTaxBands).toHaveLength(2);
    expect(withBonus.incomeTaxBands[1].name).toBe('Higher rate');
    expect(withBonus.incomeTaxBands[1].amount).toBeCloseTo(45430 - 37700, 2);
  });

  it('bonus is NI-able', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 40000, bonus: 15000 }),
      rules,
    );
    // NI-able = 40000 + 15000 = 55000
    expect(result.niableIncome).toBe(55000);
    // NI: (50270-12570)*0.08 + (55000-50270)*0.02 = 3016 + 94.60 = 3110.60
    expect(result.nationalInsurance).toBeCloseTo(3110.6, 2);
  });
});

// --- BIK edge cases ---

describe('BIK tax treatment', () => {
  it('BIK does not affect student loan repayment', () => {
    const withBik = calculateTax(
      makeInput({
        grossSalary: 35000,
        taxableBenefits: 5000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    const withoutBik = calculateTax(
      makeInput({
        grossSalary: 35000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );

    // Student loan based on NI-able income which excludes BIK
    expect(withBik.studentLoanRepayment).toBeCloseTo(
      withoutBik.studentLoanRepayment,
      2,
    );
  });

  it('BIK affects PA tapering', () => {
    // £98k salary + £5k BIK → adjusted = £103k, PA tapered
    const result = calculateTax(
      makeInput({ grossSalary: 98000, taxableBenefits: 5000 }),
      rules,
    );
    // PA: 12570 - floor((103000-100000)*0.5) = 12570 - 1500 = 11070
    expect(result.personalAllowance).toBe(11070);
  });
});

// --- Net pay integrity with all components ---

describe('net pay integrity', () => {
  it('deductions + net = gross with bonus + BIK + RSUs', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 60000,
        bonus: 5000,
        taxableBenefits: 3000,
        rsuVests: 15000,
      }),
      rules,
    );
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(
      result.totalGrossIncome,
      2,
    );
  });

  it('deductions + net = gross with all deductions', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 100000,
        bonus: 10000,
        taxableBenefits: 5000,
        rsuVests: 20000,
        pensionContribution: {
          type: 'percentage',
          value: 8,
          salarySacrifice: true,
        },
        sippContribution: 10000,
        undergraduatePlan: 'plan1',
        hasPostgraduateLoan: true,
      }),
      rules,
    );
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(
      result.totalGrossIncome,
      2,
    );
  });
});

// --- Edge cases at exact thresholds ---

describe('exact threshold boundaries', () => {
  it('£1 above personal allowance triggers tax', () => {
    const result = calculateTax(makeInput({ grossSalary: 12571 }), rules);
    expect(result.incomeTax).toBeCloseTo(0.2, 2);
    expect(result.nationalInsurance).toBeCloseTo(0.08, 2);
  });

  it('salary at top of basic rate band', () => {
    // PA + basic band = 12570 + 37700 = 50270
    const result = calculateTax(makeInput({ grossSalary: 50270 }), rules);
    // All taxable income in basic rate: 37700 * 0.20 = 7540
    expect(result.incomeTax).toBeCloseTo(7540, 2);
    expect(result.incomeTaxBands).toHaveLength(1);
    expect(result.incomeTaxBands[0].name).toBe('Basic rate');
  });

  it('£1 above basic rate band triggers higher rate', () => {
    const result = calculateTax(makeInput({ grossSalary: 50271 }), rules);
    expect(result.incomeTaxBands).toHaveLength(2);
    expect(result.incomeTaxBands[1].name).toBe('Higher rate');
    expect(result.incomeTaxBands[1].amount).toBeCloseTo(1, 2);
    expect(result.incomeTaxBands[1].tax).toBeCloseTo(0.4, 2);
  });

  it('salary at exact PA taper start (£100,000)', () => {
    const result = calculateTax(makeInput({ grossSalary: 100000 }), rules);
    expect(result.personalAllowance).toBe(12570);
  });

  it('£1 above PA taper start reduces PA', () => {
    const result = calculateTax(makeInput({ grossSalary: 100001 }), rules);
    // floor((100001-100000)*0.5) = floor(0.5) = 0 — £1 isn't enough for floor
    // Need £2 over to lose £1 of PA
    expect(result.personalAllowance).toBe(12570);
  });

  it('£2 above PA taper start reduces PA by £1', () => {
    const result = calculateTax(makeInput({ grossSalary: 100002 }), rules);
    expect(result.personalAllowance).toBe(12569);
  });
});

// --- Child Benefit & HICBC ---

describe('child benefit', () => {
  it('returns null when no children', () => {
    const result = calculateTax(makeInput({ grossSalary: 50000 }), rules);
    expect(result.childBenefit).toBeNull();
  });

  it('calculates annual benefit for 1 child', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 40000, numberOfChildren: 1 }),
      rules,
    );
    // £26.05 * 52 = £1,354.60
    expect(result.childBenefit).not.toBeNull();
    expect(result.childBenefit!.annualAmount).toBeCloseTo(1354.6, 2);
    expect(result.childBenefit!.hicbcCharge).toBe(0);
    expect(result.childBenefit!.netChildBenefit).toBeCloseTo(1354.6, 2);
  });

  it('calculates annual benefit for 2 children', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 40000, numberOfChildren: 2 }),
      rules,
    );
    // £26.05*52 + £17.25*52 = £1,354.60 + £897.00 = £2,251.60
    expect(result.childBenefit!.annualAmount).toBeCloseTo(2251.6, 2);
  });

  it('calculates annual benefit for 3 children', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 40000, numberOfChildren: 3 }),
      rules,
    );
    // £1,354.60 + 2 * £897.00 = £3,148.60
    expect(result.childBenefit!.annualAmount).toBeCloseTo(3148.6, 2);
  });

  it('no HICBC at exactly £60,000', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 60000, numberOfChildren: 1 }),
      rules,
    );
    expect(result.childBenefit!.hicbcCharge).toBe(0);
    expect(result.childBenefit!.netChildBenefit).toBeCloseTo(1354.6, 2);
  });

  it('partial HICBC at £70,000 (50% clawback)', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 70000, numberOfChildren: 1 }),
      rules,
    );
    // (70000 - 60000) / (80000 - 60000) = 0.5 → 50% charge
    const annual = 26.05 * 52;
    expect(result.childBenefit!.hicbcCharge).toBeCloseTo(annual * 0.5, 2);
    expect(result.childBenefit!.netChildBenefit).toBeCloseTo(annual * 0.5, 2);
  });

  it('full HICBC at £80,000 (100% clawback)', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 80000, numberOfChildren: 2 }),
      rules,
    );
    const annual = 26.05 * 52 + 17.25 * 52;
    expect(result.childBenefit!.hicbcCharge).toBeCloseTo(annual, 2);
    expect(result.childBenefit!.netChildBenefit).toBeCloseTo(0, 2);
  });

  it('full HICBC above £80,000 (capped at 100%)', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 100000, numberOfChildren: 1 }),
      rules,
    );
    const annual = 26.05 * 52;
    expect(result.childBenefit!.hicbcCharge).toBeCloseTo(annual, 2);
    expect(result.childBenefit!.netChildBenefit).toBeCloseTo(0, 2);
  });

  it('HICBC based on adjusted net income (SIPP reduces it)', () => {
    // £70k salary, SIPP brings adjusted to £60k → no HICBC
    const withSipp = calculateTax(
      makeInput({
        grossSalary: 70000,
        numberOfChildren: 2,
        sippContribution: 10000,
      }),
      rules,
    );
    expect(withSipp.adjustedNetIncome).toBe(60000);
    expect(withSipp.childBenefit!.hicbcCharge).toBe(0);

    // Without SIPP → 50% HICBC
    const withoutSipp = calculateTax(
      makeInput({ grossSalary: 70000, numberOfChildren: 2 }),
      rules,
    );
    expect(withoutSipp.childBenefit!.hicbcCharge).toBeGreaterThan(0);
  });

  it('HICBC based on adjusted net income (salary sacrifice reduces it)', () => {
    // £65k salary, 10% SS pension = £6,500 → adjusted = £58,500 → no HICBC
    const result = calculateTax(
      makeInput({
        grossSalary: 65000,
        numberOfChildren: 1,
        pensionContribution: {
          type: 'percentage',
          value: 10,
          salarySacrifice: true,
        },
      }),
      rules,
    );
    expect(result.adjustedNetIncome).toBe(58500);
    expect(result.childBenefit!.hicbcCharge).toBe(0);
  });

  it('child benefit does not affect tax calculation or net pay', () => {
    const withChildren = calculateTax(
      makeInput({ grossSalary: 50000, numberOfChildren: 2 }),
      rules,
    );
    const withoutChildren = calculateTax(
      makeInput({ grossSalary: 50000 }),
      rules,
    );

    expect(withChildren.incomeTax).toBe(withoutChildren.incomeTax);
    expect(withChildren.nationalInsurance).toBe(
      withoutChildren.nationalInsurance,
    );
    expect(withChildren.netAnnualPay).toBe(withoutChildren.netAnnualPay);
    expect(withChildren.totalDeductions).toBe(withoutChildren.totalDeductions);
  });

  it('marginal rate includes HICBC in the £60k-£80k zone', () => {
    // Without children at £70k: 40% tax + 2% NI = 42%
    const noChildren = calculateTax(makeInput({ grossSalary: 70000 }), rules);
    expect(noChildren.marginalRate).toBeCloseTo(0.42, 2);

    // With 1 child at £70k: 42% + (1354.60 / 20000) ≈ 42% + 6.77% = 48.77%
    const oneChild = calculateTax(
      makeInput({ grossSalary: 70000, numberOfChildren: 1 }),
      rules,
    );
    const annualBenefit1 = 26.05 * 52;
    expect(oneChild.marginalRate).toBeCloseTo(0.42 + annualBenefit1 / 20000, 2);

    // With 2 children at £70k: 42% + (2251.60 / 20000) ≈ 42% + 11.26% = 53.26%
    const twoChildren = calculateTax(
      makeInput({ grossSalary: 70000, numberOfChildren: 2 }),
      rules,
    );
    const annualBenefit2 = 26.05 * 52 + 17.25 * 52;
    expect(twoChildren.marginalRate).toBeCloseTo(
      0.42 + annualBenefit2 / 20000,
      2,
    );
  });

  it('marginal rate excludes HICBC below £60k', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 50000, numberOfChildren: 2 }),
      rules,
    );
    // Below HICBC threshold — marginal rate same as without children
    expect(result.marginalRate).toBeCloseTo(0.28, 2);
  });

  it('marginal rate excludes HICBC above £80k', () => {
    const withChildren = calculateTax(
      makeInput({ grossSalary: 90000, numberOfChildren: 2 }),
      rules,
    );
    const withoutChildren = calculateTax(
      makeInput({ grossSalary: 90000 }),
      rules,
    );
    // Above HICBC upper threshold — HICBC fully charged, no marginal effect
    expect(withChildren.marginalRate).toBeCloseTo(
      withoutChildren.marginalRate,
      2,
    );
  });

  it('effective rate includes HICBC', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 70000, numberOfChildren: 1 }),
      rules,
    );
    const noChildren = calculateTax(makeInput({ grossSalary: 70000 }), rules);
    // Effective rate should be higher with HICBC
    expect(result.effectiveRate).toBeGreaterThan(noChildren.effectiveRate);
  });
});

// --- Blind Person's Allowance ---

describe('blind persons allowance', () => {
  it('adds BPA on top of personal allowance', () => {
    const blind = calculateTax(
      makeInput({ grossSalary: 50000, isBlind: true }),
      rules,
    );
    const notBlind = calculateTax(makeInput({ grossSalary: 50000 }), rules);

    // BPA for 2025-26 is £3,130
    expect(blind.personalAllowance).toBe(12570 + 3130);
    expect(notBlind.personalAllowance).toBe(12570);
    expect(blind.incomeTax).toBeLessThan(notBlind.incomeTax);
  });

  it('BPA is not subject to income taper', () => {
    // At £125,140: standard PA fully tapered to £0
    const blind = calculateTax(
      makeInput({ grossSalary: 125140, isBlind: true }),
      rules,
    );
    // PA tapered to 0, but BPA still applies
    expect(blind.personalAllowance).toBe(3130);
  });

  it('BPA still applies at £200,000', () => {
    const blind = calculateTax(
      makeInput({ grossSalary: 200000, isBlind: true }),
      rules,
    );
    expect(blind.personalAllowance).toBe(3130);
  });

  it('BPA reduces taxable income correctly', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 30000, isBlind: true }),
      rules,
    );
    // PA = 12570 + 3130 = 15700
    // Taxable: 30000 - 15700 = 14300
    // Tax: 14300 * 0.20 = 2860
    expect(result.personalAllowance).toBe(15700);
    expect(result.incomeTax).toBeCloseTo(2860, 2);
  });
});

// --- NI Category ---

describe('NI category', () => {
  it('category A has normal NI', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'A' }),
      rules,
    );
    expect(result.nationalInsurance).toBeGreaterThan(0);
    expect(result.niBands.length).toBeGreaterThan(0);
  });

  it('category C has zero employee NI', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'C' }),
      rules,
    );
    expect(result.nationalInsurance).toBe(0);
    expect(result.niBands).toHaveLength(0);
  });

  it('category C does not affect income tax', () => {
    const catA = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'A' }),
      rules,
    );
    const catC = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'C' }),
      rules,
    );
    expect(catC.incomeTax).toBe(catA.incomeTax);
  });

  it('category C increases take-home pay', () => {
    const catA = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'A' }),
      rules,
    );
    const catC = calculateTax(
      makeInput({ grossSalary: 50000, niCategory: 'C' }),
      rules,
    );
    expect(catC.netAnnualPay).toBeGreaterThan(catA.netAnnualPay);
    // Difference should be exactly the NI amount
    expect(catC.netAnnualPay - catA.netAnnualPay).toBeCloseTo(
      catA.nationalInsurance,
      2,
    );
  });

  it('category C marginal rate excludes NI', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 30000, niCategory: 'C' }),
      rules,
    );
    // Only income tax 20%, no NI
    expect(result.marginalRate).toBeCloseTo(0.2, 2);
  });

  it('category C does not affect student loans', () => {
    const catA = calculateTax(
      makeInput({
        grossSalary: 40000,
        niCategory: 'A',
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    const catC = calculateTax(
      makeInput({
        grossSalary: 40000,
        niCategory: 'C',
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    expect(catC.studentLoanRepayment).toBe(catA.studentLoanRepayment);
  });

  it('employer NI still applies for category C salary sacrifice', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        niCategory: 'C',
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        employerNiPassbackPercent: 100,
      }),
      rules,
    );
    // Employer NI saving still exists even though employee pays no NI
    expect(result.employerNiSaving).toBeGreaterThan(0);
    expect(result.employerNiPassback).toBeGreaterThan(0);
  });

  it('category X has zero employee and employer NI', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        niCategory: 'X',
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        employerNiPassbackPercent: 100,
      }),
      rules,
    );
    expect(result.nationalInsurance).toBe(0);
    expect(result.niBands).toHaveLength(0);
    expect(result.employerNiSaving).toBe(0);
    expect(result.employerNiPassback).toBe(0);
  });
});

// --- Other salary sacrifice ---

describe('other salary sacrifice', () => {
  it('reduces taxable and NI-able income', () => {
    const withSS = calculateTax(
      makeInput({ grossSalary: 50000, otherSalarySacrifice: 5000 }),
      rules,
    );
    const withoutSS = calculateTax(makeInput({ grossSalary: 50000 }), rules);

    expect(withSS.adjustedNetIncome).toBe(45000);
    expect(withSS.niableIncome).toBe(45000);
    expect(withSS.incomeTax).toBeLessThan(withoutSS.incomeTax);
    expect(withSS.nationalInsurance).toBeLessThan(withoutSS.nationalInsurance);
  });

  it('reduces student loan repayment', () => {
    const withSS = calculateTax(
      makeInput({
        grossSalary: 40000,
        otherSalarySacrifice: 5000,
        undergraduatePlan: 'plan2',
      }),
      rules,
    );
    const withoutSS = calculateTax(
      makeInput({ grossSalary: 40000, undergraduatePlan: 'plan2' }),
      rules,
    );

    expect(withSS.studentLoanRepayment).toBeLessThan(
      withoutSS.studentLoanRepayment,
    );
  });

  it('stacks with pension salary sacrifice', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 50000,
        pensionContribution: {
          type: 'percentage',
          value: 5,
          salarySacrifice: true,
        },
        otherSalarySacrifice: 3000,
      }),
      rules,
    );

    // Pension SS = 2500, other SS = 3000, total = 5500
    expect(result.niableIncome).toBe(44500);
    expect(result.adjustedNetIncome).toBe(44500);
  });

  it('capped at remaining salary after pension sacrifice', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 10000,
        pensionContribution: {
          type: 'fixed',
          value: 8000,
          salarySacrifice: true,
        },
        otherSalarySacrifice: 5000,
      }),
      rules,
    );

    // Pension SS = 8000, only 2000 left for other SS
    expect(result.niableIncome).toBe(0);
  });

  it('deductions + net = gross', () => {
    const result = calculateTax(
      makeInput({ grossSalary: 60000, otherSalarySacrifice: 5000 }),
      rules,
    );
    expect(result.totalDeductions + result.netAnnualPay).toBeCloseTo(
      result.totalGrossIncome,
      2,
    );
  });

  it('contributes to employer NI saving', () => {
    const withSS = calculateTax(
      makeInput({
        grossSalary: 50000,
        otherSalarySacrifice: 5000,
        employerNiPassbackPercent: 100,
      }),
      rules,
    );
    const withoutSS = calculateTax(
      makeInput({ grossSalary: 50000, employerNiPassbackPercent: 100 }),
      rules,
    );

    expect(withSS.employerNiSaving).toBeGreaterThan(withoutSS.employerNiSaving);
  });
});
