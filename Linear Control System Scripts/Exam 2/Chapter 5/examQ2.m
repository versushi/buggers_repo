clc;
clear;

s = tf('s');

% Replace these with the transfer functions you picked in part (b)
G1 = tf(2,1);
G2 = 1/s;
G3 = 1/(s+2);

H1 = 2*s/(s-4);  % Because H1 = 1 we need to do this
H2 = 4/(4-s);

% Name the inputs and outputs of each block
G1.InputName = 'e1';
G1.OutputName = 'x1';

G2.InputName = 'x1';
G2.OutputName = 'x2';

G3.InputName = 'x2';
G3.OutputName = 'c';   % x3 is the signal after G3 and before G4

H1.InputName = 'c';
H1.OutputName = 'h1';

H2.InputName = 'c';    % H2 comes from after G3, before G4
H2.OutputName = 'h2';

% Define the three summing junctions from the block diagram
S1 = sumblk('e1 = r - e2');
S2 = sumblk('e2 = h1 + h2');

% Build the full connected system from r to y
T_connect = connect(G1,G2,G3,H1,H2,S1,S2,'r','c');

% Simplify/display the result
T_connect = minreal(T_connect)

disp('Y(s)/R(s) from connect = ')
T_connect

% ------------------------------------------------------------
% Make it display like a clean symbolic fraction
% ------------------------------------------------------------
[num, den] = tfdata(T_connect, 'v');

% Convert floating-point coefficients to nice rational numbers
% If this doesn't work use the end of Connect Q4

% Delete tiny numerical junk
tol = 1e-8;
num(abs(num) < tol) = 0;
den(abs(den) < tol) = 0;

num_sym_coeff = sym(num, 'r');
den_sym_coeff = sym(den, 'r');

clear s
syms s

num_sym = poly2sym(num_sym_coeff, s);
den_sym = poly2sym(den_sym_coeff, s);

T_pretty = simplify(num_sym / den_sym);

disp('Pretty transfer function C(s)/R(s) = ')
pretty(T_pretty)
