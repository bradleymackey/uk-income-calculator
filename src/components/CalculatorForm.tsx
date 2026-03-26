import { useState } from 'react';
import type {
  CalculatorInput,
  SalaryPeriod,
  FixedPeriod,
} from '~/lib/calculator';
import type { TaxRules, Country, NiCategory } from '~/lib/tax-rules';
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
  | 'selfEmployment'
  | 'childBenefit'
  | 'studentLoan';

const FIELD_LABELS: Record<OptionalField, string> = {
  income: 'PAYE Income',
  bonus: 'Bonus',
  benefits: 'Benefits (BIK)',
  rsus: 'RSUs',
  salarySacrifice: 'Salary Sacrifice',
  selfEmployment: 'Self-Employment',
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
      className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
    <div className="relative rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 pt-2 dark:border-neutral-700 dark:bg-neutral-800/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
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
    if (input.selfEmploymentIncome) initial.add('selfEmployment');
    if (input.numberOfChildren) initial.add('childBenefit');
    if (input.undergraduatePlans.length > 0 || input.hasPostgraduateLoan) {
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
        salaryPeriod: 'annual' as const,
        daysPerWeek: 5,
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
        pensionFixedPeriod: 'annual' as const,
        employerPensionContribution: { type: 'percentage', value: 0 },
        employerNiPassbackPercent: 0,
        sippContribution: 0,
        sippInputType: 'gross' as const,
      },
      employerPension: {
        employerPensionContribution: { type: 'percentage', value: 0 },
      },
      sipp: { sippContribution: 0, sippInputType: 'gross' as const },
      selfEmployment: {
        selfEmploymentIncome: 0,
        selfEmploymentInsideIR35: false,
      },
      childBenefit: { numberOfChildren: 0 },
      studentLoan: {
        undergraduatePlans: [],
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

  const hiddenChildFields = (parent: OptionalField) =>
    (Object.keys(FIELD_LABELS) as OptionalField[]).filter(
      (f) => !isVisible(f) && CHILD_FIELDS[f] === parent,
    );

  const hiddenTopLevelFields = (
    Object.keys(FIELD_LABELS) as OptionalField[]
  ).filter((f) => !isVisible(f) && !CHILD_FIELDS[f]);

  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
      <section className="py-5 first:pt-0 last:pb-0">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          About me
        </h2>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            I live in
          </label>
          <select
            value={input.country}
            onChange={(e) => update({ country: e.target.value as Country })}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
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
            <option value="wales">
              {
                '\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F'
              }{' '}
              Wales
            </option>
            <option value="northern-ireland">{'🇬🇧'} Northern Ireland</option>
          </select>
          {input.country === 'scotland' && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Scottish income tax rates apply. NI and student loans are UK-wide.
            </p>
          )}
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            NI category
          </label>
          <select
            value={input.niCategory}
            onChange={(e) =>
              update({ niCategory: e.target.value as NiCategory })
            }
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="A">A — Standard</option>
            <option value="C">C — Over state pension age</option>
            <option value="X">X — NI exempt</option>
          </select>
          {input.niCategory === 'C' && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              No employee National Insurance contributions
            </p>
          )}
          {input.niCategory === 'X' && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              No employee or employer National Insurance contributions
            </p>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={input.isBlind}
            onChange={(e) => update({ isBlind: e.target.checked })}
            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
          />
          Registered blind or severely sight impaired
        </label>
      </section>

      {isVisible('income') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard label="Income" onRemove={() => hide('income')}>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <InputField
                  label={
                    input.salaryPeriod === 'daily'
                      ? 'Daily rate'
                      : input.salaryPeriod === 'monthly'
                        ? 'Monthly gross salary'
                        : 'Annual gross salary'
                  }
                  value={
                    input.grossSalary
                      ? input.salaryPeriod === 'monthly'
                        ? +(input.grossSalary / 12).toFixed(2)
                        : input.salaryPeriod === 'daily'
                          ? +(
                              input.grossSalary /
                              (input.daysPerWeek * 52)
                            ).toFixed(2)
                          : input.grossSalary
                      : ''
                  }
                  onChange={(v) => {
                    const val = parseFloat(v) || 0;
                    const annual =
                      input.salaryPeriod === 'monthly'
                        ? val * 12
                        : input.salaryPeriod === 'daily'
                          ? val * input.daysPerWeek * 52
                          : val;
                    update({ grossSalary: annual });
                  }}
                  prefix="£"
                  tooltip="Your total salary before any deductions."
                />
              </div>
              <select
                value={input.salaryPeriod}
                onChange={(e) =>
                  update({ salaryPeriod: e.target.value as SalaryPeriod })
                }
                className="mb-[1px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              >
                <option value="annual">Year</option>
                <option value="monthly">Month</option>
                <option value="daily">Day</option>
              </select>
            </div>
            {input.salaryPeriod === 'daily' && (
              <InputField
                label="Days per week"
                value={input.daysPerWeek || ''}
                onChange={(v) => {
                  const days = Math.min(7, Math.max(1, parseInt(v) || 5));
                  // Recalculate annual salary with new days
                  const dailyRate =
                    input.grossSalary / (input.daysPerWeek * 52);
                  update({
                    daysPerWeek: days,
                    grossSalary: dailyRate * days * 52,
                  });
                }}
                step="1"
                min={1}
                tooltip="Number of days you work per week, used to calculate annual salary from daily rate."
              />
            )}
            {isVisible('bonus') && (
              <OptionalCard label="Bonus" onRemove={() => hide('bonus')}>
                <InputField
                  label="Annual bonus"
                  value={input.bonus || ''}
                  onChange={(v) => update({ bonus: parseFloat(v) || 0 })}
                  prefix="£"
                  tooltip="Total expected bonus for the tax year. Taxed as regular income via PAYE. Assumed to be paid in a single month for payslip estimates."
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
                      type="text"
                      inputMode="numeric"
                      value={input.rsuVestingPeriodsPerYear || ''}
                      onChange={(v) => {
                        const digits = v.replace(/\D/g, '');
                        update({
                          rsuVestingPeriodsPerYear:
                            digits === '' ? (0 as never) : parseInt(digits),
                        });
                      }}
                      onBlur={() =>
                        update({
                          rsuVestingPeriodsPerYear: Math.min(
                            12,
                            Math.max(1, input.rsuVestingPeriodsPerYear || 4),
                          ),
                        })
                      }
                      tooltip="How many times per year your RSUs vest (e.g. 4 for quarterly, 12 for monthly). Affects how the tax burden is spread across your payslips."
                    />
                    <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={input.rsuTaxWithheld}
                        onChange={(e) =>
                          update({ rsuTaxWithheld: e.target.checked })
                        }
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
                      />
                      Tax withheld on vest (45% tax + 2% NI)
                      <Tooltip content="Your employer sells shares at vest to cover tax. The standard withholding rate is 45% income tax + 2% NI. Any overpayment is refunded via self-assessment.">
                        <svg
                          className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
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
            {hiddenChildFields('income').length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hiddenChildFields('income').map((field) => (
                  <ToggleButton
                    key={field}
                    label={FIELD_LABELS[field]}
                    onClick={() => show(field)}
                  />
                ))}
              </div>
            )}
          </OptionalCard>
        </section>
      )}

      {isVisible('selfEmployment') && (
        <section className="py-5 first:pt-0 last:pb-0">
          <OptionalCard
            label="Self-Employment"
            onRemove={() => hide('selfEmployment')}
          >
            <InputField
              label="Annual self-employment profit"
              value={input.selfEmploymentIncome || ''}
              onChange={(v) =>
                update({ selfEmploymentIncome: parseFloat(v) || 0 })
              }
              prefix="£"
              tooltip="Net profit from self-employment after allowable expenses."
            />
            {input.selfEmploymentIncome > 0 && (
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={input.selfEmploymentInsideIR35}
                  onChange={(e) =>
                    update({ selfEmploymentInsideIR35: e.target.checked })
                  }
                  className="rounded"
                />
                Inside IR35 (off-payroll)
                <Tooltip content="If your contract is inside IR35, your income is treated like employment for NI purposes — you pay Class 1 NI instead of the lower Class 4 NI rates.">
                  <svg
                    className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
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
            {input.selfEmploymentIncome > 0 &&
              input.selfEmploymentIncome <=
                taxRules.selfEmployment.tradingAllowance && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Below the{' '}
                  {formatCurrency(taxRules.selfEmployment.tradingAllowance)}{' '}
                  trading allowance — no tax due on this income
                </p>
              )}
            {input.selfEmploymentIncome >=
              taxRules.selfEmployment.vatThreshold && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Exceeds the{' '}
                {formatCurrency(taxRules.selfEmployment.vatThreshold)} VAT
                registration threshold — you must register for VAT. Estimated
                VAT to collect:{' '}
                {formatCurrency(
                  input.selfEmploymentIncome * taxRules.selfEmployment.vatRate,
                )}
              </p>
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
                    label={
                      input.pensionContribution.type === 'fixed' &&
                      input.pensionFixedPeriod === 'monthly'
                        ? 'Monthly pension contribution'
                        : 'Workplace pension contribution'
                    }
                    value={
                      input.pensionContribution.type === 'fixed' &&
                      input.pensionFixedPeriod === 'monthly'
                        ? input.pensionContribution.value
                          ? +(input.pensionContribution.value / 12).toFixed(2)
                          : ''
                        : input.pensionContribution.value || ''
                    }
                    onChange={(v) => {
                      const val = parseFloat(v) || 0;
                      const annual =
                        input.pensionContribution.type === 'fixed' &&
                        input.pensionFixedPeriod === 'monthly'
                          ? val * 12
                          : val;
                      updatePension({ value: annual });
                    }}
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
                  className="mb-[1px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  <option value="percentage">%</option>
                  <option value="fixed">£</option>
                </select>
                {input.pensionContribution.type === 'fixed' && (
                  <select
                    value={input.pensionFixedPeriod}
                    onChange={(e) =>
                      update({
                        pensionFixedPeriod: e.target.value as FixedPeriod,
                      })
                    }
                    className="mb-[1px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    <option value="annual">Year</option>
                    <option value="monthly">Month</option>
                  </select>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={input.pensionContribution.salarySacrifice}
                  onChange={(e) =>
                    updatePension({ salarySacrifice: e.target.checked })
                  }
                  className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
                />
                Salary sacrifice
                <Tooltip content="Your gross salary is reduced by the pension amount before tax and NI are calculated, saving both income tax and National Insurance.">
                  <svg
                    className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500"
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
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Employer NI savings passback
                    </label>
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
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
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
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
                      className="mb-[1px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
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
                      className="mb-[1px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    >
                      <option value="gross">Gross</option>
                      <option value="net">Net (paid)</option>
                    </select>
                  </div>
                </OptionalCard>
              )}
              {hiddenChildFields('pension').length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hiddenChildFields('pension').map((field) => (
                    <ToggleButton
                      key={field}
                      label={FIELD_LABELS[field]}
                      onClick={() => show(field)}
                    />
                  ))}
                </div>
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
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
            <div className="space-y-2">
              {(
                [
                  ['plan1', 'Plan 1'],
                  ['plan2', 'Plan 2'],
                  ['plan4', 'Plan 4 (Scotland)'],
                  ['plan5', 'Plan 5'],
                ] as const
              ).map(([planId, label]) => {
                const plan = taxRules.studentLoans[planId];
                if (!plan) return null;
                const isChecked = input.undergraduatePlans.includes(planId);
                return (
                  <div key={planId}>
                    <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const plans = e.target.checked
                            ? [...input.undergraduatePlans, planId]
                            : input.undergraduatePlans.filter(
                                (p) => p !== planId,
                              );
                          update({ undergraduatePlans: plans });
                        }}
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
                      />
                      {label}
                    </label>
                    {isChecked && (
                      <p className="ml-6 text-xs text-neutral-500 dark:text-neutral-400">
                        Threshold: {formatCurrency(plan.threshold)}
                      </p>
                    )}
                  </div>
                );
              })}
              <div>
                <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={input.hasPostgraduateLoan}
                    onChange={(e) =>
                      update({ hasPostgraduateLoan: e.target.checked })
                    }
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800"
                  />
                  Postgraduate Loan
                </label>
                {input.hasPostgraduateLoan &&
                  taxRules.studentLoans['postgraduate'] && (
                    <p className="ml-6 text-xs text-neutral-500 dark:text-neutral-400">
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
            </div>
            {input.undergraduatePlans.length > 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                9% repayment on income above the lowest threshold
                {input.undergraduatePlans.length > 1 &&
                  ' (single deduction across all plans)'}
              </p>
            )}
          </OptionalCard>
        </section>
      )}

      {hiddenTopLevelFields.length > 0 && (
        <div className="flex flex-wrap gap-2 py-4">
          {hiddenTopLevelFields.map((field) => (
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
