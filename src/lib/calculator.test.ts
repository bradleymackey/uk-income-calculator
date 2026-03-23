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
    grossSalary: 0,
    bonus: 0,
    taxableBenefits: 0,
    rsuVests: 0,
    rsuTaxWithheld: false,
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

  it('PAYE net excludes only net RSU when withholding is on', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        rsuVests: 10000,
        rsuTaxWithheld: true,
      }),
      rules,
    );

    // PAYE should exclude net RSU (5300), not gross RSU (10000)
    expect(result.payeNetAnnualPay).toBeCloseTo(result.netAnnualPay - 5300, 2);
  });

  it('PAYE net excludes full RSU when withholding is off', () => {
    const result = calculateTax(
      makeInput({
        grossSalary: 40000,
        rsuVests: 10000,
        rsuTaxWithheld: false,
      }),
      rules,
    );

    // All tax via PAYE, full RSU goes to brokerage
    expect(result.payeNetAnnualPay).toBeCloseTo(result.netAnnualPay - 10000, 2);
    expect(result.rsuWithholding).toBeNull();
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
});
