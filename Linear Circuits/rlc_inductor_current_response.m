clear; clc;

syms v1 i1 i2 i3 s t

% Use clean symbolic fractions

eqns = [
    i1 == i2 + i3;
    i1 == v1/2000;
    i2 == ((12/s)-v1)/(0.008*s);
    i3 == ((12/s)-v1)*s*5*10^-6
];

sol = solve(eqns, [i1 i2 i3 v1]);

i2_s = simplifyFraction(sol.i2);

disp('i2(s) = ')
pretty(i2_s)

i2_t = simplify(ilaplace(i2_s, s, t));

disp('i2(t) = ')
pretty(i2_t)

% This puts it in decimal and actually readable
disp('Decimal i2(t) = ')
pretty(vpa(i2_t, 6))