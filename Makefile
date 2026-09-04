# Calibrum monorepo — every investor-facing number reproduces from here.
# Targets marked [network] download public data; everything else runs offline on committed fixtures.

PY      := .venv/bin/python
PIP     := uv pip
ENGINE  := engine
DATA    := data

.PHONY: help setup setup-py setup-js data-cmapss backtest backtest-cohorts backtest-backblaze backtest-gpu smoke sim verify-poo test lint dev build sync-evidence clean all

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

setup: setup-py setup-js ## python venv + pnpm workspace install

setup-py: ## create .venv with pandas/scikit-learn/matplotlib/lifelines/pyarrow/pytest
	uv venv .venv --python 3.11 -q
	. .venv/bin/activate && $(PIP) install -q pandas numpy scikit-learn matplotlib lifelines pyarrow pytest ruff

setup-js: ## pnpm install (apps/web, packages/poo)
	pnpm install

data-cmapss: ## [network] NASA C-MAPSS FD001-FD004 training files (~9 MB)
	mkdir -p $(DATA)/cmapss
	for f in FD001 FD002 FD003 FD004; do \
	  [ -f $(DATA)/cmapss/train_$$f.txt ] || curl -sSL -o $(DATA)/cmapss/train_$$f.txt https://raw.githubusercontent.com/hankroark/Turbofan-Engine-Degradation/master/CMAPSSData/train_$$f.txt; \
	done

backtest: data-cmapss ## THE headline: MRS v0 on C-MAPSS FD001 -> engine/mrs_v0/out (charts, contract, report)
	mkdir -p $(ENGINE)/mrs_v0/data && cp $(DATA)/cmapss/train_FD001.txt $(ENGINE)/mrs_v0/data/
	cd $(ENGINE)/mrs_v0 && ../../$(PY) run_mrs_v0.py && ../../$(PY) ablations.py
	$(PY) $(ENGINE)/fixtures/make_golden.py $(ENGINE)/mrs_v0/out/mrs_model.json $(ENGINE)/fixtures/golden_mrs_v0.json

backtest-cohorts: data-cmapss ## C-MAPSS FD001/FD002/FD004 through the shared engine -> engine/cohorts/out/<cohort>
	for fd in FD001 FD002 FD004; do $(PY) $(ENGINE)/cohorts/cmapss.py --fd $$fd; done

backtest-backblaze: ## [network, large] Backblaze Drive Stats cohort (downloads quarterly zips from backblaze.com; see DECISIONS.md)
	$(PY) $(ENGINE)/cohorts/backblaze.py --quarters 2024Q3,2024Q4

backtest-gpu: ## [network, large] Alibaba PAI GPU cluster trace cohort (downloads from aliyun OSS; see DECISIONS.md)
	$(PY) $(ENGINE)/cohorts/gpu_alibaba2020.py

smoke: ## offline 1%-style smoke backtests on committed fixtures (what CI runs)
	$(PY) $(ENGINE)/cohorts/cmapss.py --fd FD001 --sample $(ENGINE)/fixtures/cmapss_fd001_sample.txt --out /tmp/calibrum-smoke
	$(PY) $(ENGINE)/cohorts/backblaze.py --sample $(ENGINE)/fixtures/backblaze_schema_sample.csv --out /tmp/calibrum-smoke
	$(PY) $(ENGINE)/cohorts/gpu_alibaba2020.py --sample-dir $(ENGINE)/fixtures/gpu_schema_sample --out /tmp/calibrum-smoke
	$(PY) -m pytest $(ENGINE)/tests sim -q

sim: ## underwriting Monte Carlo (10,000 simulated years) -> sim/out
	cd sim && ../$(PY) -m calibrum_sim --years 10000 --out out

verify-poo: ## sign -> tamper -> verify a Proof of Operation chain (the tampered file must FAIL legibly)
	@rm -rf /tmp/calibrum-poo && mkdir -p /tmp/calibrum-poo
	pnpm --filter @calibrum/poo --silent poo sign -d 7 --anchor -o /tmp/calibrum-poo/receipts.json
	pnpm --filter @calibrum/poo --silent poo verify /tmp/calibrum-poo/receipts.json | tail -1
	pnpm --filter @calibrum/poo --silent poo tamper /tmp/calibrum-poo/receipts.json --field context.energy_wh
	@echo "--- expecting FAIL ---"
	-pnpm --filter @calibrum/poo --silent poo verify /tmp/calibrum-poo/receipts.tampered.json

test: ## all unit tests (poo with coverage thresholds, web, engine, sim)
	pnpm -r test
	$(PY) -m pytest $(ENGINE)/tests sim -q

lint: ## eslint + tsc + ruff
	pnpm -r lint
	pnpm -r typecheck
	.venv/bin/ruff check $(ENGINE) sim

dev: ## run the investor app (apps/web) at http://localhost:3000
	pnpm --filter @calibrum/web dev

build: ## production build of apps/web
	pnpm --filter @calibrum/web build

sync-evidence: ## copy regenerated charts/model outputs into apps/web/public/evidence
	cp $(ENGINE)/mrs_v0/out/{lift_curve,calibration,score_distribution,finance_mapping}.png apps/web/public/evidence/
	for c in cmapss_fd002 cmapss_fd004; do mkdir -p apps/web/public/evidence/$$c && cp $(ENGINE)/cohorts/out/$$c/{lift_curve,calibration}.png apps/web/public/evidence/$$c/; done
	cp sim/out/underwriting_mc.png apps/web/public/evidence/

clean:
	rm -rf $(ENGINE)/mrs_v0/data /tmp/calibrum-smoke /tmp/calibrum-poo apps/web/.next

all: backtest backtest-cohorts sim verify-poo sync-evidence test ## everything that produces an investor-facing number
