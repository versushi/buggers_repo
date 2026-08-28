clc
clear

syms vi vo v1 v2 v3 i1 i2 i3 s


eqns = [
    i1 == i2 + i3;                           
    i1 == (vi-v1)/2;
    i1 == (v1-v2)*.5*s;
    i2 == (v2-v3)/2;
    i2 == v3*.5*s;
    i3 == vo/(2*s);
    i3 == (v2-vo)/2;
];

sol = solve(eqns, [i1 i2 i3 v1 v2 v3 vo]);

H = simplifyFraction(sol.vo/vi);

disp('Exact Vo/Vin = ')
pretty(H)