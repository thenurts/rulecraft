# Fixture holdout lock

This protocol was written after the exploratory runs and before running seeds 41000–41255.

- Candidate `five-merchants-farmers-v1` moves five merchant positions to farming. Its 21 farmers, six foresters, five merchants and eight guards retain the original total population, guard count, initial stocks, working capital and household funds.
- Four arms share the same initial fixture and seed. They are no decree, merchants must deliver to market, merchants must deliver when opening market stock is below 40, and farmers must harvest in the morning. Every authored law is a day-zero public `confirmLaw` command.
- The primary test is whether the unconditional delivery duty improves fully fed resident-days by at least 10 on average, with a paired 95% interval above zero. The benefit should appear in days 1–6 and align with fewer market-stock shortfall units and real delivery/meal transfers.
- The morning harvest duty is the directional comparison. The hypothesis is that additional harvest pressure will not remedy a delivery bottleneck. The conditional delivery duty checks a second plausible route through the same mechanism.
- Report the size and direction of affordability shortfalls separately, including meals that remain unaffordable while the market holds food. A net feeding improvement does not establish that affordability improved. Final stock is diagnostic only.
- Record the earliest qualifying paired witness among consecutive exploratory seeds beginning at 20000. A qualifying example needs the same citizen, slot and keyed choice draw, a feasible baseline action, a known required delivery in the treated arm, a completed transaction and a feeding difference that day.
- This is a fixture and agency check. It approves neither campaign difficulty nor victory thresholds.
