import type { CalculationResult } from '~/lib/calculator';
import { formatCurrency, formatPercentage } from '~/lib/formatters';

interface ResultsBreakdownProps {
  result: CalculationResult;
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

export function ResultsBreakdown({ result }: ResultsBreakdownProps) {
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

      {/* Pension */}
      {(result.pensionContribution > 0 ||
        result.employerPensionContribution > 0 ||
        result.sippContribution > 0) && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            Pension Contributions
          </h3>
          <div className="text-sm">
            {result.pensionContribution > 0 && (
              <Row
                label="Your workplace pension"
                value={`-${formatCurrency(result.pensionContribution)}`}
              />
            )}
            {result.employerPensionContribution > 0 && (
              <Row
                label="Employer contribution"
                value={formatCurrency(result.employerPensionContribution)}
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
