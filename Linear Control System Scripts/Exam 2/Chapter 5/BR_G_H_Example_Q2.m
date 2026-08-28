clc;
clear;

syms G1 G2 G3 G4 G5 h1 h2 h3
syms r y e1 e2 e3 e4 x1 x2 x3 x4

eqns = [
    e1 == r + h2*e4;      
    e2 == e1 - h1*x2; 

    x1 == G1*e2;         

    x2 == G2*x1;         

    e3 == x2 - h3*y;     
    x3 == G4*e3;         
    x4 == G3*e3;
    
    e4 == x3 + x4;

    y == G5*e4;          
];

sol = solve(eqns, [e1 x1 e2 x2 e3 x3 e4 x4 y]);

T = simplify(sol.y/r);
T = collect(T);

% Split into numerator and denominator
[num, den] = numden(T);

% Factor each part separately
numF = factor(num);
denF = factor(den);
denF = collect(denF, [G1 G2 G3 G4 G5 h1 h2 h3]);

% Rebuild the transfer function
T_factored = numF/denF;

disp('Factored Y(s)/R(s) = ')
pretty(T_factored)