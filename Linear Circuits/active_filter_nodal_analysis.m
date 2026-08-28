clc;
clear;
%Declare your variables
syms s vi vo  v2 i1 i2 i3;

%Create a matrix with your system of equations
%make sure to use * when mulitplying

eqns = [
    i1 == i2 + i3;
    i1 == (vi - v2)/10000;
    i2 == (v2 - vo)/10000;
    i2 == vo*(1*10^-9)*s;
    i3 == (v2 - vo)*(1*10^-9)*s;

];

% Solve the unknowns, dont include voltage sources if trying to predict 
sol = solve(eqns, [ i1 i2 i3 v2 vo]);

% Transfer Function Part
tf = simplify(sol.vo/vi)

expanded = expand(tf)

% Get limits to determine filter
lim_0 = simplify(limit(tf,s,0,"right"))
lim_inf = simplify(limit(tf,s,inf,"left"))

db = 20*log10(1);