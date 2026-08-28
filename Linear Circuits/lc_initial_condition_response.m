% System of Equations function

clear;
clc;

syms ic iL v1 vL vc s t
eqns = [
   1/s == ic + iL;
   ic == (v1 - 3)*5*s;
   iL == (v1 + 2)/(2*s);
   vL == v1 + 2;
   vc == v1 - 3;
];

sol = solve(eqns, [ic iL v1 vL vc]);
disp(sol);

VL_s = simplifyFraction(sol.vL);
iL_s = simplifyFraction(sol.iL);
vc_s = simplifyFraction(sol.vc);

disp('VL(s) = ')
pretty(VL_s)


VL_t = simplify(ilaplace(VL_s, s, t));

disp('VL(t) = ')
pretty(VL_t)


