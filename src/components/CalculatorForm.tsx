import { useState } from 'react';
import type { CalculatorInput } from '~/lib/calculator';
import type {
  TaxRules,
  UndergraduatePlanId,
  Country,
  NiCategory,
} from '~/lib/tax-rules';
import { formatCurrency, formatPercentage } from '~/lib/formatters';
import { InputField } from './InputField';
import { Tooltip } from './Tooltip';

type OptionalField =
  | 'income'
  | 'bonus'
  | 'benefits'
  | 'rsus'
  | 'salarySacrifice'
  | 'pension'
  | 'employerPension'
  | 'sipp'
  | 'childBenefit'
  | 'studentLoan';

const FIELD_LABELS: Record<OptionalField, string> = {
  income: 'PAYE Income',
  bonus: 'Bonus',
  benefits: 'Benefits (BIK)',
  rsus: 'RSUs',
  salarySacrifice: 'Salary Sacrifice',
  pension: 'Pension',
  employerPension: 'Employer pension',
  sipp: 'SIPP',
  childBenefit: 'Child Benefit',
  studentLoan: 'Student Loan',
};

// Fields that only show when their parent section is visible
const CHILD_FIELDS: Partial<Record<OptionalField, OptionalField>> = {
  bonus: 'income',
  benefits: 'income',
  rsus: 'income',
  salarySacrifice: 'income',
  employerPension: 'pension',
  sipp: 'pension',
};

function ToggleButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
    >
      + {label}
    </button>
  );
}

function OptionalCard({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-gray-50/50 p-3 pt-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
          title={`Remove ${label}`}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
          Remove
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

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
  const [visible, setVisible] = useState<Set<OptionalField>>(() => {
    const initial = new Set<OptionalField>();
    // Show sections that have non-default values from URL state
    if (
      input.grossSalary ||
      input.bonus ||
      input.taxableBenefits ||
      input.rsuVests
    ) {
      initial.add('income');
    }
    if (input.bonus) initial.add('bonus');
    if (input.taxableBenefits) initial.add('benefits');
    if (input.rsuVests) initial.add('rsus');
    if (input.otherSalarySacrifice) initial.add('salarySacrifice');
    if (
      input.pensionContribution.value ||
      input.pensionContribution.salarySacrifice ||
      input.employerPensionContribution.value ||
      input.employerNiPassbackPercent ||
      input.sippContribution
    ) {
      initial.add('pension');
    }
    if (input.employerPensionContribution.value) initial.add('employerPension');
    if (input.sippContribution) initial.add('sipp');
    if (input.numberOfChildren) initial.add('childBenefit');
    if (input.undergraduatePlan !== 'none' || input.hasPostgraduateLoan) {
      initial.add('studentLoan');
    }
    return initial;
  });

  const show = (field: OptionalField) =>
    setVisible((prev) => new Set(prev).add(field));

  const hide = (field: OptionalField) => {
    setVisible((prev) => {
      const next = new Set(prev);
      next.delete(field);
      // Also hide child fields when parent is hidden
      for (const [child, parent] of Object.entries(CHILD_FIELDS)) {
        if (parent === field) next.delete(child as OptionalField);
      }
      return next;
    });
    // Clear values when hiding
    const clears: Partial<Record<OptionalField, Partial<CalculatorInput>>> = {
      income: {
        grossSalary: 0,
        bonus: 0,
        taxableBenefits: 0,
        rsuVests: 0,
        rsuTaxWithheld: false,
        rsuVestingPeriodsPerYear: 4,
        otherSalarySacrifice: 0,
      },
      bonus: { bonus: 0 },
      benefits: { taxableBenefits: 0 },
      rsus: { rsuVests: 0, rsuTaxWithheld: false, rsuVestingPeriodsPerYear: 4 },
      salarySacrifice: { otherSalarySacrifice: 0 },
      pension: {
        pensionContribution: {
          type: 'percentage',
          value: 0,
          salarySacrifice: false,
        },
        employerPensionContribution: { type: 'percentage', value: 0 },
        employerNiPassbackPercent: 0,
        sippContribution: 0,
        sippInputType: 'gross' as const,
      },
      employerPension: {
        employerPensionContribution: { type: 'percentage', value: 0 },
      },
      sipp: { sippContribution: 0, sippInputType: 'gross' as const },
      childBenefit: { numberOfChildren: 0 },
      studentLoan: {
        undergraduatePlan: 'none',
        hasPostgraduateLoan: false,
      },
    };
    if (clears[field]) {
      onChange({ ...input, ...clears[field] });
    }
  };

  const isVisible = (field: OptionalField) => visible.has(field);

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

  const hiddenFields = (Object.keys(FIELD_LABELS) as OptionalField[]).filter(
    (f) => {
      if (isVisible(f)) return false;
      // Only show child toggle buttons when parent is visible
      const parent = CHILD_FIELDS[f];
      if (parent && !isVisible(parent)) return false;
      return true;
    },
  );

  return (
    <div className="divide-y divide-gray-200">
      <section className="py-5 first:pt-0 last:pb-0">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">About me</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            I live in
          </label>
          <select
            value={input.country}
            onChange={(e) => update({ country: e.target.value as Country })}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="england">
              {
                '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F'
              }{' '}
              England
            </option>
            <option value="scotland">
              {
                '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F'
              }{' '}
              Scotland
            </option>
          </select>
          {input.country === 'scotland' && (
            <p className="mt-1 text-xs text-gray-500">
              Scottish income tax rates apply. NI and student loans are UK-wide.
            </p>
          )}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700">
            NI category
          </label>
          <select
            value={input.niCategory}
            onChange={(e) =>
              update({ niCategory: e.target.value as NiCategory })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="A">A — Standard</option>
            <option value="C">C — Over state pension age</option>
          </select>
          {input.niCategory === 'C' && (
            <p className="mt-1 text-xs text-gray-500">
              No employee National Insurance contributions
            </p>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={input.isBlind}
            onChange={(e) => update({ isBlind: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Registered blind or severely sight impaired
        </label>
      </section>

      {isVisible('income') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard label="Income" onRemove={() => hide('income')}>
            <InputField
              label="Annual gross salary"
              value={input.grossSalary || ''}
              onChange={(v) => update({ grossSalary: parseFloat(v) || 0 })}
              prefix="£"
              tooltip="Your total annual salary before any deductions, as stated in your employment contract."
            />
            {isVisible('bonus') && (
              <OptionalCard label="Bonus" onRemove={() => hide('bonus')}>
                <InputField
                  label="Annual bonus"
                  value={input.bonus || ''}
                  onChange={(v) => update({ bonus: parseFloat(v) || 0 })}
                  prefix="£"
                  tooltip="Total expected bonus for the tax year. Taxed as regular income via PAYE."
                />
              </OptionalCard>
            )}
            {isVisible('benefits') && (
              <OptionalCard
                label="Taxable benefits"
                onRemove={() => hide('benefits')}
              >
                <InputField
                  label="Taxable benefits (BIK)"
                  value={input.taxableBenefits || ''}
                  onChange={(v) =>
                    update({ taxableBenefits: parseFloat(v) || 0 })
                  }
                  prefix="£"
                  tooltip="Benefits in kind such as company car, private medical insurance, or gym membership. These increase your tax but are not cash income. Check your P11D for the value."
                />
              </OptionalCard>
            )}
            {isVisible('rsus') && (
              <OptionalCard label="RSUs" onRemove={() => hide('rsus')}>
                <InputField
                  label="RSU vests (annual value)"
                  value={input.rsuVests || ''}
                  onChange={(v) => update({ rsuVests: parseFloat(v) || 0 })}
                  prefix="£"
                  tooltip="Total value of Restricted Stock Units vesting this tax year. Taxed as employment income on the vesting date."
                />
                {input.rsuVests > 0 && (
                  <>
                    <InputField
                      label="Vesting periods per year"
                      value={input.rsuVestingPeriodsPerYear || ''}
                      onChange={(v) =>
                        update({
                          rsuVestingPeriodsPerYear: Math.min(
                            12,
                            Math.max(1, parseInt(v) || 4),
                          ),
                        })
                      }
                      step="1"
                      min={1}
                      tooltip="How many times per year your RSUs vest (e.g. 4 for quarterly, 12 for monthly). Affects how the tax burden is spread across your payslips."
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={input.rsuTaxWithheld}
                        onChange={(e) =>
                          update({ rsuTaxWithheld: e.target.checked })
                        }
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
                  </>
                )}
              </OptionalCard>
            )}
            {isVisible('salarySacrifice') && (
              <OptionalCard
                label="Salary Sacrifice"
                onRemove={() => hide('salarySacrifice')}
              >
                <InputField
                  label="Annual salary sacrifice amount"
                  value={input.otherSalarySacrifice || ''}
                  onChange={(v) =>
                    update({ otherSalarySacrifice: parseFloat(v) || 0 })
                  }
                  prefix="£"
                  tooltip="General salary sacrifice deductions such as cycle-to-work, technology schemes, or childcare vouchers. Reduces your salary before tax and NI are calculated."
                />
              </OptionalCard>
            )}
          </OptionalCard>
        </section>
      )}

      {isVisible('pension') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard label="Pension" onRemove={() => hide('pension')}>
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <InputField
                    label="Workplace pension contribution"
                    value={input.pensionContribution.value || ''}
                    onChange={(v) =>
                      updatePension({ value: parseFloat(v) || 0 })
                    }
                    prefix={
                      input.pensionContribution.type === 'fixed'
                        ? '£'
                        : undefined
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
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Employer NI savings passback
                    </label>
                    <span className="text-sm font-medium text-gray-900">
                      {input.employerNiPassbackPercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={input.employerNiPassbackPercent}
                    onChange={(e) =>
                      update({
                        employerNiPassbackPercent: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-blue-600"
                  />
                  <p className="mt-0.5 text-xs text-gray-500">
                    When you salary sacrifice, your employer also saves on NI.
                    Some employers pass a percentage of this saving into your
                    pension.
                  </p>
                </div>
              )}
              {isVisible('employerPension') && (
                <OptionalCard
                  label="Employer pension"
                  onRemove={() => hide('employerPension')}
                >
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
                          input.employerPensionContribution.type ===
                          'percentage'
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
                </OptionalCard>
              )}
              {isVisible('sipp') && (
                <OptionalCard label="SIPP" onRemove={() => hide('sipp')}>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <InputField
                        label={
                          input.sippInputType === 'net'
                            ? 'SIPP contribution (amount you pay)'
                            : 'SIPP contribution (gross annual)'
                        }
                        value={input.sippContribution || ''}
                        onChange={(v) =>
                          update({ sippContribution: parseFloat(v) || 0 })
                        }
                        prefix="£"
                        tooltip={
                          input.sippInputType === 'net'
                            ? 'The amount you actually transfer to your SIPP provider. They will claim 20% basic rate relief on top, making the gross contribution 25% higher.'
                            : 'The total contribution including basic rate relief. You pay 80% of this and your provider claims the remaining 20% from HMRC.'
                        }
                      />
                    </div>
                    <select
                      value={input.sippInputType}
                      onChange={(e) =>
                        update({
                          sippInputType: e.target.value as 'gross' | 'net',
                        })
                      }
                      className="mb-[1px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="gross">Gross</option>
                      <option value="net">Net (paid)</option>
                    </select>
                  </div>
                </OptionalCard>
              )}
            </div>
          </OptionalCard>
        </section>
      )}

      {isVisible('childBenefit') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard
            label="Child Benefit"
            onRemove={() => hide('childBenefit')}
          >
            <InputField
              label="Number of children"
              value={input.numberOfChildren || ''}
              onChange={(v) =>
                update({
                  numberOfChildren: Math.max(0, parseInt(v) || 0),
                })
              }
              step="1"
              min={0}
              tooltip="Number of children you receive Child Benefit for. The High Income Child Benefit Charge (HICBC) applies if your adjusted net income exceeds £60,000."
            />
            {input.numberOfChildren > 0 && (
              <p className="text-xs text-gray-500">
                {formatCurrency(
                  taxRules.childBenefit.weeklyRateFirstChild *
                    taxRules.childBenefit.weeksPerYear +
                    Math.max(0, input.numberOfChildren - 1) *
                      taxRules.childBenefit.weeklyRateAdditionalChild *
                      taxRules.childBenefit.weeksPerYear,
                )}
                /year &middot; HICBC applies above{' '}
                {formatCurrency(taxRules.childBenefit.hicbc.threshold)}
              </p>
            )}
          </OptionalCard>
        </section>
      )}

      {isVisible('studentLoan') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard
            label="Student Loan"
            onRemove={() => hide('studentLoan')}
          >
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
                    {formatPercentage(
                      taxRules.studentLoans['postgraduate'].rate,
                    )}{' '}
                    on income above{' '}
                    {formatCurrency(
                      taxRules.studentLoans['postgraduate'].threshold,
                    )}
                  </p>
                )}
            </div>
          </OptionalCard>
        </section>
      )}

      {hiddenFields.length > 0 && (
        <div className="flex flex-wrap gap-2 py-4">
          {hiddenFields.map((field) => (
            <ToggleButton
              key={field}
              label={FIELD_LABELS[field]}
              onClick={() => show(field)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
