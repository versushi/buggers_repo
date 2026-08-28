clc
clear

syms s i1 i2 va v1 v2

L = 1;
c = .5;
r1 = 2;
r2 = 3;

eqns = [
    0 == (v1-va)/(L*s) - va/r1 - va/(1/(c*s)) + (v2 - va)/r2;
    i1 == (v1 - va)/(L*s);
    i2 == (v2 - va)/r2;
    
];

solve(eqns, [i1 i2 va])

% In Solve:
% z: everything excpetr i1 & i2
% y: everything excpetr v1 & v2
% a: everything excpetr v2 & i2
% b: everything excpetr v1 & i1
% h: everything excpetr i1 & v2
% g: everything excpetr v1 & i2