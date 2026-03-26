import type { CalculatorInput, CalculationResult } from '~/lib/calculator';
import type { TaxRules } from '~/lib/tax-rules';
import { formatCurrency, formatPercentage } from '~/lib/formatters';

interface PrintViewProps {
  input: CalculatorInput;
  result: CalculationResult;
  taxRules: TaxRules;
}

const countryLabels: Record<string, string> = {
  england: 'England',
  scotland: 'Scotland',
  wales: 'Wales',
  'northern-ireland': 'Northern Ireland',
};

const niCategoryLabels: Record<string, string> = {
  A: 'A — Standard',
  C: 'C — Over state pension age',
  X: 'X — NI exempt',
};

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-0.5 ${bold ? 'font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function BandTable({
  bands,
}: {
  bands: { name: string; amount: number; rate: number; tax: number }[];
}) {
  if (bands.length === 0) return null;

  return (
    <table className="mt-1 w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-neutral-300 text-left">
          <th className="py-0.5 pr-2">Band</th>
          <th className="py-0.5 pr-2 text-right font-mono">Amount</th>
          <th className="py-0.5 pr-2 text-right font-mono">Rate</th>
          <th className="py-0.5 text-right font-mono">Tax</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((band) => (
          <tr
            key={band.name}
            className="border-b border-neutral-200 last:border-0"
          >
            <td className="py-0.5 pr-2">{band.name}</td>
            <td className="py-0.5 pr-2 text-right font-mono">
              {formatCurrency(band.amount)}
            </td>
            <td className="py-0.5 pr-2 text-right font-mono">
              {formatPercentage(band.rate)}
            </td>
            <td className="py-0.5 text-right font-mono">
              {formatCurrency(band.tax)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid border-b border-neutral-200 pb-3 pt-2">
      <h3 className="mb-1 text-sm font-bold">{title}</h3>
      <div className="text-xs">{children}</div>
    </section>
  );
}

export function PrintView({ input, result, taxRules }: PrintViewProps) {
  const planLabels: Record<string, string> = {
    plan1: 'Plan 1',
    plan2: 'Plan 2',
    plan4: 'Plan 4 (Scotland)',
    plan5: 'Plan 5',
  };

  return (
    <div className="hidden text-neutral-900 print:block">
      {/* Header */}
      <div className="mb-4 border-b-2 border-neutral-900 pb-2">
        <h1 className="text-lg font-bold">UK Income Tax Calculator</h1>
        <p className="text-xs text-neutral-500">{taxRules.label}</p>
      </div>

      {/* Your Details */}
      <Section title="Your Details">
        <Row
          label="Country"
          value={countryLabels[input.country] ?? 'England'}
        />
        <Row
          label="NI category"
          value={niCategoryLabels[input.niCategory] ?? input.niCategory}
        />
        {input.isBlind && <Row label="Blind person's allowance" value="Yes" />}
        <Row
          label={`Gross salary (${input.salaryPeriod})`}
          value={formatCurrency(input.grossSalary)}
        />
        {input.salaryPeriod === 'daily' && (
          <Row label="Days per week" value={String(input.daysPerWeek)} />
        )}
        {input.bonus > 0 && (
          <Row label="Bonus" value={formatCurrency(input.bonus)} />
        )}
        {input.taxableBenefits > 0 && (
          <Row
            label="Taxable benefits"
            value={formatCurrency(input.taxableBenefits)}
          />
        )}
        {input.rsuVests > 0 && (
          <>
            <Row
              label="RSU vests (annual)"
              value={formatCurrency(input.rsuVests)}
            />
            <Row
              label="Vesting periods/year"
              value={String(input.rsuVestingPeriodsPerYear)}
            />
            {input.rsuTaxWithheld && (
              <Row label="Tax withheld on vest" value="Yes" />
            )}
          </>
        )}
        {input.pensionContribution.value > 0 && (
          <Row
            label={`Pension contribution${input.pensionContribution.salarySacrifice ? ' (salary sacrifice)' : ''}`}
            value={
              input.pensionContribution.type === 'percentage'
                ? `${input.pensionContribution.value}%`
                : formatCurrency(input.pensionContribution.value)
            }
          />
        )}
        {input.employerPensionContribution.value > 0 && (
          <Row
            label="Employer pension"
            value={
              input.employerPensionContribution.type === 'percentage'
                ? `${input.employerPensionContribution.value}%`
                : formatCurrency(input.employerPensionContribution.value)
            }
          />
        )}
        {input.employerNiPassbackPercent > 0 && (
          <Row
            label="Employer NI passback"
            value={`${input.employerNiPassbackPercent}%`}
          />
        )}
        {input.sippContribution > 0 && (
          <Row
            label={`SIPP contribution (${input.sippInputType})`}
            value={formatCurrency(input.sippContribution)}
          />
        )}
        {input.selfEmploymentIncome > 0 && (
          <Row
            label="Self-employment income"
            value={formatCurrency(input.selfEmploymentIncome)}
          />
        )}
        {input.numberOfChildren > 0 && (
          <Row label="Children" value={String(input.numberOfChildren)} />
        )}
        {(input.undergraduatePlans.length > 0 || input.hasPostgraduateLoan) && (
          <Row
            label="Student loans"
            value={[
              ...input.undergraduatePlans.map((p) => planLabels[p] ?? p),
              ...(input.hasPostgraduateLoan ? ['Postgraduate'] : []),
            ].join(', ')}
          />
        )}
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <Row
          label="Total gross income"
          value={formatCurrency(result.totalGrossIncome)}
          bold
        />
        <Row
          label="Total deductions"
          value={`-${formatCurrency(result.totalDeductions)}`}
          bold
        />
        <Row
          label="Annual take-home"
          value={formatCurrency(result.netAnnualPay)}
          bold
        />
        <Row
          label="Monthly take-home"
          value={formatCurrency(result.netMonthlyPay)}
          bold
        />
        <Row
          label="Effective tax rate"
          value={`${(result.effectiveRate * 100).toFixed(1)}%`}
        />
        <Row
          label="Marginal rate"
          value={`${(result.marginalRate * 100).toFixed(0)}%`}
        />
        <Row
          label="Personal allowance"
          value={formatCurrency(result.personalAllowance)}
        />
        <Row
          label="Adjusted net income"
          value={formatCurrency(result.adjustedNetIncome)}
        />
      </Section>

      {/* Income */}
      <Section title="Income">
        <Row label="Salary" value={formatCurrency(result.grossSalary)} />
        {result.bonus > 0 && (
          <Row label="Bonus" value={formatCurrency(result.bonus)} />
        )}
        {result.taxableBenefits > 0 && (
          <Row
            label="Taxable benefits"
            value={formatCurrency(result.taxableBenefits)}
          />
        )}
        {result.rsuVests > 0 && (
          <Row label="RSU vests" value={formatCurrency(result.rsuVests)} />
        )}
        {input.selfEmploymentIncome > 0 && (
          <Row
            label="Self-employment profit"
            value={formatCurrency(input.selfEmploymentIncome)}
          />
        )}
      </Section>

      {/* RSU Withholding */}
      {result.rsuWithholding && (
        <Section title="RSU Tax Withholding">
          <Row
            label="Income tax withheld (45%)"
            value={`-${formatCurrency(result.rsuWithholding.taxWithheld)}`}
          />
          <Row
            label="NI withheld (2%)"
            value={`-${formatCurrency(result.rsuWithholding.niWithheld)}`}
          />
          <Row
            label="Total withheld"
            value={`-${formatCurrency(result.rsuWithholding.totalWithheld)}`}
            bold
          />
          <Row
            label="Net RSU value received"
            value={formatCurrency(result.rsuWithholding.netRsuValue)}
            bold
          />
          {result.rsuPerVest && (
            <>
              <Row
                label={`Per vest (${result.rsuPerVest.vestingPeriods}x/year)`}
                value={formatCurrency(result.rsuPerVest.grossPerVest)}
              />
              <Row
                label="Net per vest"
                value={formatCurrency(result.rsuPerVest.netPerVest)}
              />
            </>
          )}
        </Section>
      )}

      {/* Income Tax */}
      <Section title="Income Tax">
        <BandTable bands={result.incomeTaxBands} />
        <div className="mt-1">
          <Row
            label="Total income tax"
            value={`-${formatCurrency(result.incomeTax)}`}
            bold
          />
        </div>
      </Section>

      {/* National Insurance */}
      <Section title="National Insurance">
        <BandTable bands={result.niBands} />
        <div className="mt-1">
          <Row
            label="Total NI"
            value={`-${formatCurrency(result.nationalInsurance)}`}
            bold
          />
        </div>
      </Section>

      {/* Class 4 NI */}
      {result.class4Ni > 0 && (
        <Section title="Class 4 National Insurance">
          <BandTable bands={result.class4NiBands} />
          <div className="mt-1">
            <Row
              label="Total Class 4 NI"
              value={`-${formatCurrency(result.class4Ni)}`}
              bold
            />
          </div>
        </Section>
      )}

      {/* Pension */}
      {(result.pensionContribution > 0 ||
        result.employerPensionContribution > 0 ||
        result.sippContribution > 0) && (
        <Section title="Pension Contributions">
          {result.pensionContribution > 0 && (
            <Row
              label="Your workplace pension"
              value={formatCurrency(result.pensionContribution)}
            />
          )}
          {result.employerPensionContribution > 0 && (
            <Row
              label="Employer contribution"
              value={formatCurrency(result.employerPensionContribution)}
            />
          )}
          {result.employerNiPassback > 0 && (
            <Row
              label="Employer NI savings passback"
              value={formatCurrency(result.employerNiPassback)}
            />
          )}
          {result.sippContribution > 0 && (
            <>
              <Row
                label="SIPP (gross)"
                value={formatCurrency(result.sippContribution)}
              />
              <Row
                label="Basic rate relief (20%)"
                value={formatCurrency(result.sippRelief.basicRateRelief)}
              />
              {result.sippRelief.selfAssessmentRelief > 0 && (
                <Row
                  label="Self-assessment relief"
                  value={formatCurrency(result.sippRelief.selfAssessmentRelief)}
                />
              )}
              <Row
                label="Total SIPP relief"
                value={formatCurrency(result.sippRelief.totalRelief)}
                bold
              />
              <Row
                label="Effective cost to you"
                value={formatCurrency(result.sippRelief.effectiveCost)}
                bold
              />
            </>
          )}
          {result.totalPensionContributions > 0 && (
            <Row
              label="Total going into pension"
              value={formatCurrency(result.totalPensionContributions)}
              bold
            />
          )}
        </Section>
      )}

      {/* Child Benefit */}
      {result.childBenefit && (
        <Section title="Child Benefit">
          <Row
            label="Annual child benefit"
            value={formatCurrency(result.childBenefit.annualAmount)}
          />
          {result.childBenefit.hicbcCharge > 0 && (
            <>
              <Row
                label="High Income Child Benefit Charge"
                value={`-${formatCurrency(result.childBenefit.hicbcCharge)}`}
              />
              <Row
                label="Net child benefit"
                value={formatCurrency(result.childBenefit.netChildBenefit)}
                bold
              />
            </>
          )}
        </Section>
      )}

      {/* Student Loans */}
      {result.studentLoanRepayment > 0 && (
        <Section title="Student Loan">
          {result.undergraduateLoanRepayment > 0 && (
            <Row
              label="Undergraduate repayment"
              value={`-${formatCurrency(result.undergraduateLoanRepayment)}`}
            />
          )}
          {result.postgraduateLoanRepayment > 0 && (
            <Row
              label="Postgraduate repayment"
              value={`-${formatCurrency(result.postgraduateLoanRepayment)}`}
            />
          )}
          {result.undergraduateLoanRepayment > 0 &&
            result.postgraduateLoanRepayment > 0 && (
              <Row
                label="Total student loan"
                value={`-${formatCurrency(result.studentLoanRepayment)}`}
                bold
              />
            )}
        </Section>
      )}

      {/* Monthly Payslip */}
      {result.payslip && (
        <Section title="Monthly Payslip">
          <Row
            label="Normal month"
            value={formatCurrency(result.payslip.normalMonth)}
          />
          {result.payslip.bonusMonth !== null && (
            <Row
              label="Bonus month"
              value={formatCurrency(result.payslip.bonusMonth)}
            />
          )}
          {result.payslip.vestMonth !== null && result.rsuPerVest && (
            <Row
              label={`Vest month (${result.rsuPerVest.vestingPeriods}x/year)`}
              value={formatCurrency(result.payslip.vestMonth)}
            />
          )}
          {result.payslip.bonusVestMonth !== null && result.rsuPerVest && (
            <Row
              label="Bonus + vest month"
              value={formatCurrency(result.payslip.bonusVestMonth)}
            />
          )}
        </Section>
      )}
    </div>
  );
}
