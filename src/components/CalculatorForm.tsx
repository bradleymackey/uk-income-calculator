import type { CalculatorInput } from '~/lib/calculator';
import type { StudentLoanPlanId } from '~/lib/tax-rules';
import { InputField } from './InputField';

interface CalculatorFormProps {
  input: CalculatorInput;
  onChange: (input: CalculatorInput) => void;
}

export function CalculatorForm({ input, onChange }: CalculatorFormProps) {
  const update = (partial: Partial<CalculatorInput>) =>
    onChange({ ...input, ...partial });

  const updatePension = (
    partial: Partial<CalculatorInput['pensionContribution']>,
  ) =>
    onChange({
      ...input,
      pensionContribution: { ...input.pensionContribution, ...partial },
    });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Income</h2>
        <div className="space-y-3">
          <InputField
            label="Annual gross salary"
            value={input.grossSalary || ''}
            onChange={(v) => update({ grossSalary: parseFloat(v) || 0 })}
            prefix="£"
          />
          <InputField
            label="Annual bonus"
            value={input.bonus || ''}
            onChange={(v) => update({ bonus: parseFloat(v) || 0 })}
            prefix="£"
          />
          <InputField
            label="Taxable benefits (BIK)"
            value={input.taxableBenefits || ''}
            onChange={(v) => update({ taxableBenefits: parseFloat(v) || 0 })}
            prefix="£"
            helpText="Company car, health insurance, etc."
          />
          <InputField
            label="RSU vests (annual value)"
            value={input.rsuVests || ''}
            onChange={(v) => update({ rsuVests: parseFloat(v) || 0 })}
            prefix="£"
          />
        </div>
      </section>

      <section>
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
          </label>
          <InputField
            label="SIPP contribution (gross annual)"
            value={input.sippContribution || ''}
            onChange={(v) => update({ sippContribution: parseFloat(v) || 0 })}
            prefix="£"
            helpText="Enter the gross amount. You pay 80% — your provider claims 20% basic rate relief from HMRC."
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Student Loan
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Repayment plan
          </label>
          <select
            value={input.studentLoanPlan}
            onChange={(e) =>
              update({
                studentLoanPlan: e.target.value as StudentLoanPlanId,
              })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="none">None</option>
            <option value="plan1">Plan 1</option>
            <option value="plan2">Plan 2</option>
            <option value="plan4">Plan 4 (Scotland)</option>
            <option value="plan5">Plan 5</option>
            <option value="postgraduate">Postgraduate Loan</option>
          </select>
        </div>
      </section>
    </div>
  );
}
