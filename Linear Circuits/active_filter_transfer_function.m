clc;
clear;
%Declare your variables
syms s vi vo ia va;

c1 = 100*10^-9;
c2 = 1*10^-9;
r1 = 100;
r2 = 1000;

%Create a matrix with your system of equations
%make sure to use * when mulitplying

eqns = [
    ia == (va - vo)/r2,
    (vi - va)/(1/(c1*s)) == va/r1,
    vo/(1/(c2*s)) == (va - vo)/r2,

];

% Solve the unknowns, dont include voltage sources if trying to predict 
sol = solve(eqns, [ia vi vo]);

% Transfer Function Part
tf = simplifyFraction((sol.vo)/(sol.vi))

% Get limits to determine filter
lim_0 = limit(tf,s,0,"right")
lim_inf = limit(tf,s,inf,"left")