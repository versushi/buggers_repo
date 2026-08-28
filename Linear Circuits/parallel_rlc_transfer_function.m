clear; clc;

% Symbolic variables
syms i1 ic ir iL vin vo s

% Equations
eqns = [
    i1 == ir + ic + iL;
    i1 == (vin-vo)/200;
    ir == vo/1000;
    iL == vo/(.047*s);
    ic == vo*(22*10^-9)*s;
];


% Solve for Io in terms of Ig
sol = solve(eqns, [ i1 ir ic iL vo]);
disp(sol);

h_s = simplifyFraction(sol.vo/vin);


disp('H(s) = ')
pretty(h_s)


