# Build Prompt — Machine Credit Network Investor Demo

You are a senior fintech/crypto product engineer and quantitative risk engineer. Build an investor-ready interactive web demo called **Machine Credit Network**.

## Product thesis
Every autonomous machine should have a portable financial identity and dynamic risk/credit profile. The product transforms verifiable machine activity into underwriting signals for insurance, lending, leasing, and eventually machine capital markets.

Core flow:
**Proof of Operation → Machine Reputation → Machine Risk Score → Insurance/Credit Terms → Settlement**

## Audience
Tier-1 crypto/fintech/AI venture investors, insurers/reinsurers, equipment lenders, and robotics OEM/fleet operators.

## Deliverable
Build a production-quality local web app in Next.js + TypeScript. It must run with:
`npm install && npm run dev`

Do not require paid APIs. Seed the app with synthetic/demo data, but separate the demo data layer cleanly so real telemetry can replace it later.

## Required product surfaces
1. Investor landing: "The next billion borrowers may not be human." Flow: Telemetry → Evidence → Reputation → Capital.
2. Machine Passport: machine identity, verified hours, maintenance, incidents, uptime, residual value, MRS 300–950, credit grade, insurance, debt, wallet.
3. Underwriting Playground: sliders for maintenance, anomaly/vibration, environment, intervention rate, utilization, firmware maturity, machine age/hours, incidents. Reprice live: premium, LTV, spread, residual value, expected loss, 30d failure probability. Include a "Why this changed" feature-attribution panel.
4. Virtual mUSDC economy: start with 10,000 mUSDC. Run machine and earn revenue; pay maintenance; trigger an incident; buy insurance; borrow; repay; settle an eligible claim.
5. Proof of Operation ledger: structured receipts with receipt_id, machine_id, timestamp, event, context, risk snapshot, previous hash, current SHA-256 hash, attester, signature placeholder. Include a Verify button that recomputes the hash and shows PASS/FAIL.
6. Risk Model / Backtest page: designed to ingest real public datasets. Show survival curve, calibration, ROC-AUC, PR-AUC, concordance index, lift chart / top-decile capture. Headline format: "Top 20% highest-risk machines captured X% of failures in the next 30 days."
7. Capital Markets preview: MRS, Machine Loss Index, residual-value index, machine yield index, fleet loan, insurance, machine-backed RWA, fleet securitization, risk tranches. This is a visualization, not a live trading product.

## Quant architecture
Implement a modular demo risk engine with explicit feature contributions. Organize it so it can later be replaced by:
- Cox proportional hazards
- Random Survival Forest
- XGBoost survival / binary event model
- Bayesian online updating

Outputs:
risk_score, prob_failure_30d, expected_loss_12m, recommended_premium, recommended_ltv, credit_spread, residual_value.

Never present synthetic outputs as real underwriting results. Label them "Illustrative demo model."

## Data adapters to prepare
Create adapters/interfaces for:
- NIST robot-arm degradation dataset
- KUKA KR16 accelerated-wear dataset
- NASA C-MAPSS
- InfiniteHBD GPU-cluster fault trace
- Backblaze Drive Stats

## Core TypeScript models
Machine, TelemetryEvent, ProofOfOperation, MaintenanceEvent, Incident, InsurancePolicy, Loan, RiskSnapshot, WalletTransaction.

## Design
Premium institutional dark UI: Bloomberg / Stripe / Paradigm / modern quant terminal.
Avoid Web3 clichés, neon coins, NFT art.
Use crisp typography, dense-but-readable metrics, subtle motion.
Responsive desktop-first.

## Embedded investor story
The UX must make these claims obvious:
1. Machines generate abundant data but little financial-grade evidence.
2. Verified behavior creates portable machine credit history.
3. Better evidence lowers underwriting uncertainty.
4. Lower uncertainty improves insurance premium and cost of capital.
5. Financial outcomes feed back into the model, creating a proprietary behavior-to-financial-outcome graph.

## Technical structure
- Next.js
- TypeScript
- Tailwind
- Recharts
- local state first
- tests for risk-engine calculations and proof verification
- README with setup + product thesis
- `/docs/proof-of-operation.md`
- `/data/demo/`
- `/lib/risk/`
- `/lib/proof/`
- `/lib/finance/`

## Production architecture to document
Robot secure element / TEE
→ signed telemetry
→ encrypted offchain storage
→ hash/Merkle commitment
→ neutral chain / attestation network
→ risk engine
→ insurer/lender APIs
→ stablecoin settlement

Raw telemetry remains private/offchain. Shared layers carry proofs, commitments, permissions, and financial state.

## Acceptance criteria
A VC partner understands the product in 90 seconds.
An engineer can click Verify and independently validate a receipt.
An insurance/lending professional sees exactly how behavior changes premium and LTV.
The demo looks credible enough for a seed fundraising meeting.
