clc
clear

syms vi vo v1 v2 v3 v4 i2 i3 i4 i5 i6 s


eqns = [                           
    i2 == i5 + i4;
    i6 == i3 + i4;
    i2 == (vi-v1)/2;
    i3 == (vi-v4)*(1/9)*s;
    i6 == v4/8;
    i5 == (v1-v2)/2;
    i5 == v2/(4*s);
    i4 == (v1-v3)/4;
    i4 == (v3-v4)/(6*s);
    vo == v4;

];

sol = solve(eqns, [i2 i3 i4 i5 i6 v1 v2 v3 v4 vo]);

H = simplifyFraction(sol.vo/vi);

disp('Exact Vo/Vin = ')
pretty(H)