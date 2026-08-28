% System of Equations function

clear;
clc;

syms vin vo i s;
eqns = [
    i == (vin-vo)*(10*10^-6)*s;
    i == vo/2000;
];

sol = solve(eqns, [i vo]);
disp(sol);

h_s = simplifyFraction(sol.vo/vin);

