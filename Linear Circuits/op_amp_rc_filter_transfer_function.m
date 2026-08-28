clc
clear

syms vi vo v1 i1 i2 i3 s

R1 = 360000;     % 100 kOhm
R2 = 220000;
C1 = sym(56)/sym(10000000);
C2 = sym(1)/sym(10000000);

eqns = [
    i1 == i2 + i3;                           % ideal op-amp: V- = V+
    i2 == vi*C1*s;
    i3 == vi/R1;
    i1 == -v1/R2;
    i1 == (v1 - vo)*C2*s;
];

sol = solve(eqns, [i1 i2 i3 v1 vo]);

H = simplifyFraction(sol.vo/vi);

disp('Exact Vo/Vin = ')
pretty(H)

