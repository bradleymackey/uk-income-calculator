import type { CalculatorInput } from '~/lib/calculator';
import type { TaxRules, UndergraduatePlanId } from '~/lib/tax-rules';
import { formatCurrency, formatPercentage } from '~/lib/formatters';
import { InputField } from './InputField';
import { Tooltip } from './Tooltip';

interface CalculatorFormProps {
  input: CalculatorInput;
  onChange: (input: CalculatorInput) => void;
  taxRules: TaxRules;
}

export function CalculatorForm({
  input,
  onChange,
  taxRules,
}: CalculatorFormProps) {
  const update = (partial: Partial<CalculatorInput>) =>
    onChange({ ...input, ...partial });

  const updatePension = (
    partial: Partial<CalculatorInput['pensionContribution']>,
  ) =>
    onChange({
      ...input,
      pensionContribution: { ...input.pensionContribution, ...partial },
    });

  const updateEmployerPension = (
    partial: Partial<CalculatorInput['employerPensionContribution']>,
  ) =>
    onChange({
      ...input,
      employerPensionContribution: {
        ...input.employerPensionContribution,
        ...partial,
      },
    });

  return (
    <div className="divide-y divide-gray-200">
      <section className="py-5 first:pt-0 last:pb-0">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Income</h2>
        <div className="space-y-3">
          <InputField
            label="Annual gross salary"
            value={input.grossSalary || ''}
            onChange={(v) => update({ grossSalary: parseFloat(v) || 0 })}
            prefix="£"
            tooltip="Your total annual salary before any deductions, as stated in your employment contract."
          />
          <InputField
            label="Annual bonus"
            value={input.bonus || ''}
            onChange={(v) => update({ bonus: parseFloat(v) || 0 })}
            prefix="£"
            tooltip="Total expected bonus for the tax year. Taxed as regular income via PAYE."
          />
          <InputField
            label="Taxable benefits (BIK)"
            value={input.taxableBenefits || ''}
            onChange={(v) => update({ taxableBenefits: parseFloat(v) || 0 })}
            prefix="£"
            tooltip="Benefits in kind such as company car, private medical insurance, or gym membership. These increase your tax but are not cash income. Check your P11D for the value."
          />
          <InputField
            label="RSU vests (annual value)"
            value={input.rsuVests || ''}
            onChange={(v) => update({ rsuVests: parseFloat(v) || 0 })}
            prefix="£"
            tooltip="Total value of Restricted Stock Units vesting this tax year. Taxed as employment income on the vesting date."
          />
          {input.rsuVests > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={input.rsuTaxWithheld}
                onChange={(e) => update({ rsuTaxWithheld: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Tax withheld on vest (45% tax + 2% NI)
              <Tooltip content="Your employer sells shares at vest to cover tax. The standard withholding rate is 45% income tax + 2% NI. Any overpayment is refunded via self-assessment.">
                <svg
                  className="h-3.5 w-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
              </Tooltip>
            </label>
          )}
        </div>
      </section>

      <section className="py-5 first:pt-0 last:pb-0">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Pension</h2>
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <InputField
                label="Workplace pension contribution"
                value={input.pensionContribution.value || ''}
                onChange={(v) => updatePension({ value: parseFloat(v) || 0 })}
                prefix={
                  input.pensionContribution.type === 'fixed' ? '£' : undefined
                }
                suffix={
                  input.pensionContribution.type === 'percentage'
                    ? '%'
                    : undefined
                }
                tooltip="Your employee pension contribution. If percentage, calculated on gross salary only."
              />
            </div>
            <select
              value={input.pensionContribution.type}
              onChange={(e) =>
                updatePension({
                  type: e.target.value as 'percentage' | 'fixed',
                })
              }
              className="mb-[1px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="percentage">%</option>
              <option value="fixed">£</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={input.pensionContribution.salarySacrifice}
              onChange={(e) =>
                updatePension({ salarySacrifice: e.target.checked })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Salary sacrifice
            <Tooltip content="Your gross salary is reduced by the pension amount before tax and NI are calculated, saving both income tax and National Insurance.">
              <svg
                className="h-3.5 w-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </Tooltip>
          </label>
          {input.pensionContribution.salarySacrifice && (
            <InputField
              label="Employer NI savings passback"
              value={input.employerNiPassbackPercent || ''}
              onChange={(v) =>
                update({ employerNiPassbackPercent: parseFloat(v) || 0 })
              }
              suffix="%"
              min={0}
              tooltip="When you salary sacrifice, your employer also saves on NI. Some employers pass a percentage of this saving into your pension."
            />
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <InputField
                label="Employer pension contribution"
                value={input.employerPensionContribution.value || ''}
                onChange={(v) =>
                  updateEmployerPension({ value: parseFloat(v) || 0 })
                }
                prefix={
                  input.employerPensionContribution.type === 'fixed'
                    ? '£'
                    : undefined
                }
                suffix={
                  input.employerPensionContribution.type === 'percentage'
                    ? '%'
                    : undefined
                }
                tooltip="Your employer's pension contribution. Does not affect your take-home pay but is shown in the pension total."
              />
            </div>
            <select
              value={input.employerPensionContribution.type}
              onChange={(e) =>
                updateEmployerPension({
                  type: e.target.value as 'percentage' | 'fixed',
                })
              }
              className="mb-[1px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="percentage">%</option>
              <option value="fixed">£</option>
            </select>
          </div>
          <InputField
            label="SIPP contribution (gross annual)"
            value={input.sippContribution || ''}
            onChange={(v) => update({ sippContribution: parseFloat(v) || 0 })}
            prefix="£"
            tooltip="Enter the gross amount you want to contribute. You pay 80% and your provider claims 20% basic rate relief from HMRC. Higher/additional rate relief is claimed via self-assessment."
          />
        </div>
      </section>

      <section className="py-5 first:pt-0 last:pb-0">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Student Loan
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Undergraduate plan
            </label>
            <select
              value={input.undergraduatePlan}
              onChange={(e) =>
                update({
                  undergraduatePlan: e.target.value as UndergraduatePlanId,
                })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="none">None</option>
              <option value="plan1">Plan 1</option>
              <option value="plan2">Plan 2</option>
              <option value="plan4">Plan 4 (Scotland)</option>
              <option value="plan5">Plan 5</option>
            </select>
            {input.undergraduatePlan !== 'none' &&
              taxRules.studentLoans[input.undergraduatePlan] && (
                <p className="mt-1 text-xs text-gray-500">
                  {formatPercentage(
                    taxRules.studentLoans[input.undergraduatePlan].rate,
                  )}{' '}
                  on income above{' '}
                  {formatCurrency(
                    taxRules.studentLoans[input.undergraduatePlan].threshold,
                  )}
                </p>
              )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={input.hasPostgraduateLoan}
                onChange={(e) =>
                  update({ hasPostgraduateLoan: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Postgraduate Loan
            </label>
            {input.hasPostgraduateLoan &&
              taxRules.studentLoans['postgraduate'] && (
                <p className="mt-1 text-xs text-gray-500">
                  {formatPercentage(taxRules.studentLoans['postgraduate'].rate)}{' '}
                  on income above{' '}
                  {formatCurrency(
                    taxRules.studentLoans['postgraduate'].threshold,
                  )}
                </p>
              )}
          </div>
        </div>
      </section>
    </div>
  );
}
