clear; clc;

syms s t

%X_s = (4*s^4 + 17*s^3 + 23*s^2 + s + 2)/(s^2*(s+1)^2*(s+2));
X_s = 10/(s*(s^2+8*s+25));

% Factor denominator
[num, den] = numden(X_s);

disp('Denominator = ')
pretty(factor(den))

disp('Characteristic equation:')
pretty(factor(den) == 0)

% Find poles
poles = solve(den == 0, s);

disp('Poles = ')
disp(poles)

% Inverse Laplace
x_t = simplify(ilaplace(X_s, s, t));

disp('x(t) = ')
pretty(x_t)