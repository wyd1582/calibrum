import numpy as np

from calibrum_sim.underwriting import Book, p_fail, run_monte_carlo, scored_premium, simulate_year, FLAT_PREMIUM


def test_hazard_curve_is_monotone_and_clipped():
    assert p_fail(850) == 0.05 and p_fail(1000) == 0.05  # clipped floor
    assert abs(p_fail(300) - 0.82) < 1e-9
    assert p_fail(415) > p_fail(660) > p_fail(810)


def test_scored_premium_matches_part4_mapping():
    assert abs(scored_premium(782) - 85_000 * (0.09 - 0.782 * 0.075)) < 1e-9
    assert scored_premium(415) > FLAT_PREMIUM  # flat 2 400 undercharges the toxic tail (scored: 5 013)
    assert scored_premium(810) < scored_premium(660) < scored_premium(415)


def test_year_is_reproducible():
    a = simulate_year(np.random.default_rng(1), Book(), "flat")
    b = simulate_year(np.random.default_rng(1), Book(), "flat")
    assert a.claims == b.claims and a.premium == 8 * FLAT_PREMIUM


def test_monte_carlo_reproduces_the_demo_story():
    res = run_monte_carlo(years=2000, seed=7)
    s = res.summary
    assert s["label"].startswith("SIMULATION")
    assert 1.3 < s["flat"]["mean_lr"] < 1.9          # blind pricing loses money on average (~156% in the demo copy)
    assert s["mrs"]["mean_lr"] < s["flat"]["mean_lr"]  # pricing alone helps
    assert 0.5 < s["mrs_select"]["mean_lr"] < 0.9      # pricing + selection is profitable (~68% in the demo copy)
    assert s["mrs_select"]["p_loss"] < s["mrs"]["p_loss"] < s["flat"]["p_loss"]


def test_declined_machines_carry_no_premium_or_claims():
    r = simulate_year(np.random.default_rng(3), Book(), "mrs_select")
    assert r.claims_by_machine[-1] == 0.0 and r.claims_by_machine[-2] == 0.0
    assert r.premium == sum(scored_premium(m) for m in Book().mrs if m >= 550)
