clear; clc;

syms v1 v2 iL t s

% Sources for t > 0
Vs = 20/s;
Vs2 = (-28)/s;



% Component values
C = 12.5*10^-9;
L = 0.0005;

eqns = [
    iL ==

    % KCL: currents entering = currents leaving
  
];

sol = solve(eqns, [i1 iC iL iR v1 vx]);

Vx = simplifyFraction(sol.vx);

disp('Vx(s) = ')
pretty(Vx)

vx_t = simplify(ilaplace(V x, s));

disp('vx(t) = ')
pretty(vx_t)