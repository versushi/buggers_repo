clc
clear

syms vi vo v1 i1 i2 i3 s

r1 = 2;
r2 = 2;
L1 = 2;
L2 = 2;


eqns = [
    i1 == i2 + i3;                           % ideal op-amp: V- = V+
    i1 == (vi-v1)/(2*s);
    i2 == v1/2;
    i3 == vo/(2*s);
    i3 == (v1-vo)/2;
];

sol = solve(eqns, [i1 i2 i3 v1 vo]);

H = simplifyFraction(sol.vo/vi);

disp('Exact Vo/Vin = ')
pretty(H)