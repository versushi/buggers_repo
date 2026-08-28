clc
clear

syms i1 i2 v1 v2 vo

eqns = [
  0 == v1 + i1 - 10;
  v2 == vo;
  v1 == 11.25*v2 - 5.24*i2;
  i1 == 4.2*v2 - 2.05*i2;
  vo == -i2 * 1000;
];

sol = solve(eqns, [i1 i2 v1 v2 vo]);

answer1 = sol.vo

