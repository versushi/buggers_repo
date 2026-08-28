clc;
clear;

syms s X1 X2 X3 F

%Doens't need to be factored
eqns = [
    %s^2*X1 + 6*s*X1 + 9*X1 - 3*s*X2 - 5*X2 == 0;
    %2*s^2*X2 + 5*s*X2 + 5*X2 - 3*s*X1 - 5*X1 == F
    %X1*(4*s^2 + 2*s + 6) - 2*s*X2 == 0;
    %X2*(4*s^2 + 4*s + 6) - 2*s*X1 - 6*X3 == F;
    %X3*(4*s^2 + 2*s + 6) - 6*X2;
    X1*(500*s^2 + 0.5*s + 3) - 1.5*X2 == 0;
    X2*(1000*s^2 + 3) - 1.5*X1 - 1.5*X3 == 0;
    X3*(250*s^2 + s + 1.5) - 1.5*X2 == F;
];

sol = solve(eqns, [X1 X2 X3]);

% Change this, (sol.X1/F) if you want a different transfer function if the
% problem wants something else

H = simplifyFraction(sol.X2/F);
H = collect(H, s);

disp('X3(s)/F(s) = ')
pretty(H)