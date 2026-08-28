clc
clear

syms i ir iL ic c r v s;


eqns = [
    i == ir + iL + ic;
    ir == v/r;
    iL == v/(.005*s);
    ic == v*c*s;
];

sol = solve(eqns, [ir iL ic v]);

H = simplifyFraction(sol.iL/i);

disp('Exact Vo/Vin = ')
pretty(H)