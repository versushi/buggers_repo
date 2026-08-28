clc;
clear;
%Declare your variables
syms i1 i2 i3 i4 i5 v1 v2 v3 v4 vx s;

%Create a matrix with your system of equations
%make sure to use * when mulitplying

eqns = [
    i3 == i5 + i1;
    i5 == i2 - 2*vx;
    i4 == 2*vx;
    vx == v3 - v1;
    i3 == v1;
    i5 == (v3 - v1)*s;
    i4 == v4/s;
    i2 == v2 - v3;
    i1 == 0;

];

% Solve the unknowns, dont include voltage sources if trying to predict 
sol = solve(eqns, [i1 i3 i4 i5 v1 v3 v4 vx]);
disp(sol);

% IN SOLVE:
% z : everything except i1 & i2
% y : everything except v1 & v2
% a : everything except v2 & i2
% b : everything except v1 & i1
% h : everything except i1 & v2
% g : everything except v1 & i2