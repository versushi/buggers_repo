clc
clear

syms vi i vo v1 s 



eqns = [
    10*i == vi - v1;
    s*i == v1 - vo;
    vo == i/(.01*s);
];

sol = solve(eqns, [v1 i vo]);

H = simplifyFraction(sol.vo/vi);

disp('Exact Vo/Vin = ')
pretty(H)
