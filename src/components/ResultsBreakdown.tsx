import type { CalculationResult, CalculatorInput } from '~/lib/calculator';
import type { TaxRules } from '~/lib/tax-rules';
import { formatCurrency, formatPercentage } from '~/lib/formatters';
import { TaxRateChart } from './TaxRateChart';
import { IncomeBreakdownChart } from './IncomeBreakdownChart';

interface ResultsBreakdownProps {
  input: CalculatorInput;
  result: CalculationResult;
  taxRules: TaxRules;
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: 'green' | 'red';
}) {
  const valueColor =
    highlight === 'green'
      ? 'text-green-700'
      : highlight === 'red'
        ? 'text-red-600'
        : 'text-gray-900';

  return (
    <div className={`flex justify-between py-1 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={valueColor}>{value}</span>
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
    <div className="mt-1 overflow-hidden rounded border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-gray-500">
            <th className="px-3 py-1.5">Band</th>
            <th className="px-3 py-1.5 text-right">Amount</th>
            <th className="px-3 py-1.5 text-right">Rate</th>
            <th className="px-3 py-1.5 text-right">Tax</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <tr key={band.name} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-700">{band.name}</td>
              <td className="px-3 py-1.5 text-right text-gray-700">
                {formatCurrency(band.amount)}
              </td>
              <td className="px-3 py-1.5 text-right text-gray-700">
                {formatPercentage(band.rate)}
              </td>
              <td className="px-3 py-1.5 text-right text-gray-900">
                {formatCurrency(band.tax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsBreakdown({
  input,
  result,
  taxRules,
}: ResultsBreakdownProps) {
  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-lg bg-blue-50 p-4">
        <Row
          label="Total gross income"
          value={formatCurrency(result.totalGrossIncome)}
          bold
        />
        <Row
          label="Total deductions"
          value={`-${formatCurrency(result.totalDeductions)}`}
          bold
          highlight="red"
        />
        <div className="my-2 border-t border-blue-200" />
        <Row
          label="Annual take-home"
          value={formatCurrency(result.netAnnualPay)}
          bold
          highlight="green"
        />
        <Row
          label="Monthly take-home"
          value={formatCurrency(result.netMonthlyPay)}
          bold
          highlight="green"
        />
        <div className="my-2 border-t border-blue-200" />
        <div className="text-sm">
          <Row
            label="Effective tax rate"
            value={`${(result.effectiveRate * 100).toFixed(1)}%`}
          />
          <Row
            label="Marginal rate (next £1)"
            value={`${(result.marginalRate * 100).toFixed(0)}%`}
          />
          <Row
            label="Personal allowance remaining"
            value={formatCurrency(result.personalAllowance)}
          />
          <Row
            label="Adjusted net income"
            value={formatCurrency(result.adjustedNetIncome)}
          />
          {result.adjustedNetIncome <= 100000 && (
            <p className="text-xs text-gray-500">
              {formatCurrency(100000 - result.adjustedNetIncome)} below the
              £100k taper threshold
            </p>
          )}
          {result.personalAllowance < 12570 && result.personalAllowance > 0 && (
            <p className="text-xs text-amber-600">
              In the £100k–£125,140 taper zone — 60% marginal rate.{' '}
              {formatCurrency(125140 - result.adjustedNetIncome)} until fully
              tapered.
            </p>
          )}
          {result.personalAllowance === 0 &&
            result.adjustedNetIncome > 100000 && (
              <p className="text-xs text-amber-600">
                Fully tapered — income exceeds £125,140
              </p>
            )}
        </div>
        <TaxRateChart input={input} result={result} taxRules={taxRules} />
        <IncomeBreakdownChart result={result} />
        {result.rsuVests > 0 && (
          <>
            <div className="my-2 border-t border-blue-200" />
            <p className="mb-1 text-xs font-medium text-blue-700">RSUs</p>
            <div className="text-sm">
              <Row
                label="Annual RSU gross"
                value={formatCurrency(result.rsuVests)}
              />
              {result.rsuWithholding && (
                <Row
                  label="Annual net received"
                  value={formatCurrency(result.rsuWithholding.netRsuValue)}
                  highlight="green"
                />
              )}
              {result.rsuPerVest && (
                <>
                  <div className="my-1 border-t border-blue-200" />
                  <Row
                    label={`Per vest (${result.rsuPerVest.vestingPeriods}x/year)`}
                    value={formatCurrency(result.rsuPerVest.grossPerVest)}
                  />
                  {result.rsuWithholding && (
                    <Row
                      label="Net per vest"
                      value={formatCurrency(result.rsuPerVest.netPerVest)}
                      highlight="green"
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
        {result.payeMonthlyPay !== null && (
          <>
            <div className="my-2 border-t border-blue-200" />
            <p className="mb-1 text-xs font-medium text-blue-700">
              Monthly payslip
            </p>
            <div className="text-sm">
              <Row
                label="Monthly payslip"
                value={formatCurrency(result.payeMonthlyPay)}
                bold
                highlight="green"
              />
              <p className="mt-0.5 text-xs text-blue-600">
                Non-vesting month — tax calculated on salary only
              </p>
              {result.vestMonthTotal !== null && result.rsuPerVest && (
                <>
                  <div className="my-1 border-t border-blue-200" />
                  <Row
                    label={`Vest month total (${result.rsuPerVest.vestingPeriods}x/year)`}
                    value={formatCurrency(result.vestMonthTotal)}
                    bold
                    highlight="green"
                  />
                  <p className="mt-0.5 text-xs text-blue-600">
                    Payslip + {formatCurrency(result.rsuPerVest.netPerVest)} RSU
                    net per vest
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Income */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Income</h3>
        <div className="text-sm">
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
        </div>
      </section>

      {/* RSU Withholding */}
      {result.rsuWithholding && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            RSU Tax Withholding
          </h3>
          <div className="text-sm">
            <Row
              label="Income tax withheld (45%)"
              value={`-${formatCurrency(result.rsuWithholding.taxWithheld)}`}
              highlight="red"
            />
            <Row
              label="NI withheld (2%)"
              value={`-${formatCurrency(result.rsuWithholding.niWithheld)}`}
              highlight="red"
            />
            <Row
              label="Total withheld"
              value={`-${formatCurrency(result.rsuWithholding.totalWithheld)}`}
              bold
              highlight="red"
            />
            <Row
              label="Net RSU value received"
              value={formatCurrency(result.rsuWithholding.netRsuValue)}
              bold
              highlight="green"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Withholding is a prepayment — any overpayment is refunded via
            self-assessment
          </p>
        </section>
      )}

      {/* Pension */}
      {(result.pensionContribution > 0 ||
        result.employerPensionContribution > 0 ||
        result.employerNiPassback > 0 ||
        result.sippContribution > 0) && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            Pension Contributions
          </h3>
          <div className="text-sm">
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
                  label="SIPP (gross contribution)"
                  value={`-${formatCurrency(result.sippContribution)}`}
                />
                <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-1.5 text-xs font-semibold text-emerald-800">
                    SIPP Tax Relief
                  </p>
                  <Row
                    label="Basic rate relief at source (20%)"
                    value={formatCurrency(result.sippRelief.basicRateRelief)}
                    highlight="green"
                  />
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Claimed by your provider — you only pay{' '}
                    {formatCurrency(
                      result.sippRelief.grossContribution -
                        result.sippRelief.basicRateRelief,
                    )}
                  </p>
                  {result.sippRelief.selfAssessmentRelief > 0 && (
                    <>
                      <div className="my-1.5 border-t border-emerald-200" />
                      <Row
                        label="Additional relief via self-assessment"
                        value={formatCurrency(
                          result.sippRelief.selfAssessmentRelief,
                        )}
                        highlight="green"
                      />
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Claim on your tax return as a higher/additional rate
                        taxpayer
                      </p>
                    </>
                  )}
                  <div className="my-1.5 border-t border-emerald-200" />
                  <Row
                    label="Total tax relief"
                    value={formatCurrency(result.sippRelief.totalRelief)}
                    bold
                    highlight="green"
                  />
                  <Row
                    label="Effective cost to you"
                    value={formatCurrency(result.sippRelief.effectiveCost)}
                    bold
                  />
                </div>
              </>
            )}
            {result.totalPensionContributions > 0 && (
              <>
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <Row
                    label="Total going into pension"
                    value={formatCurrency(result.totalPensionContributions)}
                    bold
                  />
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Personal Allowance */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">
          Personal Allowance
        </h3>
        <div className="text-sm">
          <Row
            label="Allowance"
            value={formatCurrency(result.personalAllowance)}
          />
          {result.personalAllowance < 12570 && (
            <p className="text-xs text-amber-600">
              Reduced from £12,570 due to income over £100,000
            </p>
          )}
        </div>
      </section>

      {/* Income Tax */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Income Tax</h3>
        <BandTable bands={result.incomeTaxBands} />
        <div className="mt-1 text-sm">
          <Row
            label="Total income tax"
            value={`-${formatCurrency(result.incomeTax)}`}
            bold
            highlight="red"
          />
        </div>
      </section>

      {/* National Insurance */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">
          National Insurance
        </h3>
        <BandTable bands={result.niBands} />
        <div className="mt-1 text-sm">
          <Row
            label="Total NI"
            value={`-${formatCurrency(result.nationalInsurance)}`}
            bold
            highlight="red"
          />
        </div>
      </section>

      {/* Child Benefit */}
      {result.childBenefit && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            Child Benefit
          </h3>
          <div className="text-sm">
            <Row
              label="Annual child benefit"
              value={formatCurrency(result.childBenefit.annualAmount)}
              highlight="green"
            />
            {result.childBenefit.hicbcCharge > 0 && (
              <Row
                label="High Income Child Benefit Charge"
                value={`-${formatCurrency(result.childBenefit.hicbcCharge)}`}
                highlight="red"
              />
            )}
            {result.childBenefit.hicbcCharge > 0 && (
              <Row
                label="Net child benefit"
                value={formatCurrency(result.childBenefit.netChildBenefit)}
                bold
                highlight={
                  result.childBenefit.netChildBenefit > 0 ? 'green' : 'red'
                }
              />
            )}
            {result.childBenefit.hicbcCharge > 0 &&
              result.childBenefit.netChildBenefit <= 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Income exceeds{' '}
                  {formatCurrency(taxRules.childBenefit.hicbc.upperThreshold)} —
                  benefit fully clawed back via HICBC
                </p>
              )}
            {result.childBenefit.hicbcCharge > 0 &&
              result.childBenefit.netChildBenefit > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  HICBC applies — 1% of benefit clawed back per{' '}
                  {formatCurrency(
                    (taxRules.childBenefit.hicbc.upperThreshold -
                      taxRules.childBenefit.hicbc.threshold) /
                      100,
                  )}{' '}
                  over {formatCurrency(taxRules.childBenefit.hicbc.threshold)}
                </p>
              )}
          </div>
        </section>
      )}

      {/* Student Loan */}
      {result.studentLoanRepayment > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            Student Loan
          </h3>
          <div className="text-sm">
            {result.undergraduateLoanRepayment > 0 && (
              <Row
                label="Undergraduate repayment"
                value={`-${formatCurrency(result.undergraduateLoanRepayment)}`}
                highlight="red"
              />
            )}
            {result.postgraduateLoanRepayment > 0 && (
              <Row
                label="Postgraduate repayment"
                value={`-${formatCurrency(result.postgraduateLoanRepayment)}`}
                highlight="red"
              />
            )}
            {result.undergraduateLoanRepayment > 0 &&
              result.postgraduateLoanRepayment > 0 && (
                <Row
                  label="Total student loan"
                  value={`-${formatCurrency(result.studentLoanRepayment)}`}
                  bold
                  highlight="red"
                />
              )}
          </div>
        </section>
      )}
    </div>
  );
}
