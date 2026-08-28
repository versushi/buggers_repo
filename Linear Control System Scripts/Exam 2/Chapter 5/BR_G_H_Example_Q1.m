clc;
clear;

syms G1 G2 G3 G4 H1 H2 H3
syms r y e1 e2 e3 x1 x2 x3

eqns = [
    e1 == r - H3*y;      % first summer
    x1 == G1*e1;         % after G1

    e2 == x1 - H2*x3;    % second summer
    x2 == G2*e2;         % after G2

    e3 == x2 + H1*y;     % third summer
    x3 == G3*e3;         % after G3

    y == G4*x3;          % after G4
];

sol = solve(eqns, [e1 x1 e2 x2 e3 x3 y]);

T = simplify(sol.y/r);
T = collect(T);

disp('Y(s)/R(s) = ')
pretty(T)