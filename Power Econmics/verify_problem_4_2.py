"""Verify Problem 4.2  

Run with: python verify_problem_4_2.py   
"""

from math import isclose


GAS_PRICE = 1.20  # $/MJ
MIN_OUTPUT = 200.0  # MW
MAX_OUTPUT = 500.0  # MW
PERIOD_HOURS = 1.0
MARKET_PRICES = [12.5, 10.0, 13.0, 13.5, 15.0, 11.0]  # $/MWh


def hourly_cost(output):
    """Fuel cost in $/h, using the units given in the problem."""
    return GAS_PRICE * (120 + 9.3 * output + 0.0025 * output**2)


def profit(price, output):
    return (price * output - hourly_cost(output)) * PERIOD_HOURS


def optimal_output(price):
    # Marginal cost = 1.20 * (9.3 + 0.005 * P).
    # Set marginal cost equal to market price, then apply operating limits.
    unconstrained = (price - GAS_PRICE * 9.3) / (GAS_PRICE * 0.005)
    return max(MIN_OUTPUT, min(MAX_OUTPUT, unconstrained))


def main():
    expected_outputs = [223.333333333333, 200, 306.666666666667, 390, 500, 200]
    expected_profits = [5.633333333333, -496, 138.133333333333, 312.3, 1026, -296]
    total_revenue = 0.0
    total_cost = 0.0

    print('Problem 4.2: original quadratic cost curve')
    print('C(P) = 144 + 11.16P + 0.003P^2 dollars/hour\n')
    print(f"{'Period':>6} {'Price':>10} {'Output MW':>12} {'Revenue $':>13} {'Cost $':>13} {'Profit $':>13}")

    for i, price in enumerate(MARKET_PRICES):
        output = optimal_output(price)
        revenue = price * output * PERIOD_HOURS
        cost = hourly_cost(output) * PERIOD_HOURS
        period_profit = revenue - cost

        assert isclose(output, expected_outputs[i], abs_tol=1e-8)
        assert isclose(period_profit, expected_profits[i], abs_tol=1e-8)

        # Independently check against every 0.01 MW across the allowed range.
        # The analytical maximum must be at least as profitable as every sample.
        grid_best = max(
            profit(price, MIN_OUTPUT + step / 100)
            for step in range(round((MAX_OUTPUT - MIN_OUTPUT) * 100) + 1)
        )
        assert period_profit >= grid_best - 1e-8, 'Dispatch failed grid check'

        total_revenue += revenue
        total_cost += cost
        print(f'{i + 1:6d} {price:10.2f} {output:12.2f} {revenue:13.2f} {cost:13.2f} {period_profit:13.2f}')

    total_profit = total_revenue - total_cost
    assert isclose(total_profit, 690.066666666667, abs_tol=1e-8)
    print(f'\nTotal revenue: ${total_revenue:,.2f}')
    print(f'Total fuel cost: ${total_cost:,.2f}')
    print(f'Total operational profit: ${total_profit:,.2f}')
    print('\nAll checks passed: expected answers and independent output grid.')
    print('Calculations retain full precision; displayed values are rounded.')


if __name__ == '__main__':
    main()
