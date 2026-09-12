"""
Analytic derivations:
  Linear: q = 200 - pi, dq/dpi = -1,
          epsilon = -pi/q = -(200-q)/q for q > 0.
  Reciprocal: q = 10000/pi, dq/dpi = -10000/pi**2,
          epsilon = (-10000/pi**2)*(pi/(10000/pi)) = -1.
          
The script computes exact rational values and independently checks the
price derivatives. Limits are handled explicitly zero demand must not
be substituted into a formula that divides by q.
Run: python verify_problem_2_5.py
"""
from fractions import Fraction
from math import isclose

DEMANDS = [0, 50, 100, 150, 200]

def demand_linear(pi):
    return 200 - pi

def demand_reciprocal(pi):
    return 10000 / pi

def numerical_derivative(function, pi):
    h = abs(pi) * 1e-5
    return (function(pi + h) - function(pi - h)) / (2 * h)

def main():
    print('PROBLEM 2.5 VERIFICATION')
    print('pi represents price, not the mathematical constant.')
    print('Signed elasticity = (dq/dpi)*(pi/q).')
    print('\nLINEAR DEMAND: q = 200 - pi')
    print('Analytically: dq/dpi = -1; elasticity = -(200-q)/q.')
    print(f'{"q":>6} {"price pi":>15} {"elasticity":>24}')
    expected = {50: Fraction(-3), 100: Fraction(-1),
                150: Fraction(-1, 3), 200: Fraction(0)}
    for q in DEMANDS:
        pi = Fraction(200 - q)
        assert demand_linear(pi) == q
        if q == 0:
            result = 'undefined'
        else:
            elasticity = -pi / q
            assert elasticity == expected[q]
            result = str(elasticity)
            if pi > 0:
                numeric = numerical_derivative(demand_linear, float(pi)) * float(pi) / q
                assert isclose(numeric, float(elasticity), rel_tol=1e-7)
            else:
                # At price zero use the right-hand derivative (price >= 0).
                h = 1e-3
                slope = (demand_linear(h) - demand_linear(0)) / h
                assert isclose(slope, -1, rel_tol=1e-7)
                assert slope * float(pi) / q == 0
        print(f'{q:>6} {str(pi):>15} {result:>24}')
    print('At q=0, elasticity is undefined. Since epsilon=1-200/q,')
    print('epsilon tends to -infinity as q approaches 0 from above.')

    print('\nRECIPROCAL DEMAND: q = 10000/pi')
    print('Analytically: dq/dpi = -10000/pi**2; elasticity = -1.')
    print(f'{"q":>6} {"price pi":>15} {"elasticity":>24}')
    for q in DEMANDS:
        if q == 0:
            print(f'{q:>6} {"no finite price":>15} {"undefined (limit: -1)":>24}')
            continue
        pi = Fraction(10000, q)
        assert demand_reciprocal(pi) == q
        derivative = -Fraction(10000) / pi**2
        elasticity = derivative * pi / q
        assert elasticity == -1
        numeric = numerical_derivative(demand_reciprocal, float(pi)) * float(pi) / q
        assert isclose(numeric, -1, rel_tol=1e-7)
        print(f'{q:>6} {str(pi):>15} {str(elasticity):>24}')
    print('Price 200/3 = 66.666666... at q=150.')
    print('At q=0 no finite price exists: pi=10000/q tends to infinity.')
    print('Elasticity is exactly -1 for every q>0, so its limit is -1.')
    print('\nPASS: all exact-value and numerical derivative checks passed.')

if __name__ == '__main__':
    main()
