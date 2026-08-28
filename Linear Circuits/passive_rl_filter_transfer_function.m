% System of Equations function

clear;
clc;

syms i1 i2 i3 v1 v2 vi vo s 
eqns = [
    i1 == i2 + i3;
    i1 == v2/(.1*s);
    i2 == (vi - v2)/10000;
    i3 == (vi-v1)/(.1*s);
    i3 == (v1-v2)/10000;
    vo == v1 - v2;
];

sol = solve(eqns, [vo v1 v2 i1 i2 i3]);
disp(sol);

H_s = simplifyFraction(sol.vo/vi);

disp('H(s) = ')
pretty(H_s)




