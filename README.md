# UK Income Tax Calculator

Every UK tax calculator I could find was either confusing, missing options, or just plain wrong. So I built this one.

It supports salary sacrifice pensions, RSUs, benefits in kind, student loans, SIPP contributions, self-employment income, child benefit clawback, and more -- all computed locally in your browser with nothing sent to a server.

## Features

- Multiple tax years (2020-21 onwards)
- Scotland, England, Wales, and Northern Ireland tax rates
- Salary sacrifice and employer pension contributions
- RSU vesting with tax withholding
- Student loan repayments (all plan types)
- SIPP contributions (gross and net input)
- Self-employment income and Class 4 NICs
- Child benefit high income charge
- Shareable links via URL parameters

## Development

```bash
pnpm install
pnpm dev
```

## Building

```bash
pnpm build
```

## Testing

```bash
pnpm test
```
