clear; clc;

% Symbolic variables
syms v1 v2 i1 i2 i3 i4 s t

% Equations
eqns = [
    i1 == i2 + i3;
    i4 == i3 + (5/s);
    i1 == ((15/s)-v2)/15;
    i2 == v2/3;
    i3 == (v2-v1)/s;
    i4 == v1*s;
    
];


% Solve for Io in terms of Ig
sol = solve(eqns, [ i1 i2 i3 i4 v1 v2]);
disp(sol);

V1_s = simplifyFraction(sol.v1);
V2_s = simplifyFraction(sol.v2);

disp('V1(s) = ')
pretty(V1_s)
disp('V2(s) = ')
pretty(V2_s)

% Below is how to inverse laplace the eqaution we get above

V1_t = simplify(ilaplace(V1_s, s, t));
V2_t = simplify(ilaplace(V2_s, s, t));

disp('v1(t) = ')
pretty(V1_t)

disp('v2(t) = ')
pretty(V2_t)