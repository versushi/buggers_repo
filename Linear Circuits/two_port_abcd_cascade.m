clc
clear

syms i1 i2 v1 v2


eqns = [
    i1 == v1 - .5*v2;
    i2 == -0.5*v1 + 1.5*v2;
    
];

solve(eqns, [v1 i1])

a_para = [3 2; 2.5 2]
answer = a_para * a_para

% In Solve:
% z: everything excpetr i1 & i2
% y: everything excpetr v1 & v2
% a: everything excpetr v2 & i2
% b: everything excpetr v1 & i1
% h: everything excpetr i1 & v2
% g: everything excpetr v1 & i2