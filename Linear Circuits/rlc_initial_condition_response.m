clear; clc;

syms Vo V1 iL s t

% Use clean symbolic fractions
C = sym(125)/10 * 10^(-9);   % 12.5 nF
L = sym(5)/10 * 10^(-3);     % 0.5 mH
R = sym(320);

vC0 = sym(-16);
iL0 = sym(75)/1000;          % 75 mA
Vs = sym(20)/s;

eqns = [
    iL == C*(s*Vo - vC0);
    iL == (V1 - Vo)/R;
    iL == (Vs - V1)/(s*L) + iL0/s;
];

sol = solve(eqns, [Vo V1 iL]);

Vo_s = simplifyFraction(sol.Vo);

disp('Vo(s) = ')
pretty(Vo_s)

vo_t = ilaplace(Vo_s, s, t);
vo_t = simplify(rewrite(vo_t, 'sincos'));

disp('vo(t) = ')
pretty(vo_t)