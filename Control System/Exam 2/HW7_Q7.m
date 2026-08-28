clc;
clear;

s = tf('s');

% Replace these with the transfer functions you picked in part (b)
G1 = 1/s;
G2 = tf(1,1);
G3 = 3/(s+4);


H1 = tf(2,1); 
H2 = 6*s;
H3 = tf(1,1);


% Name the inputs and outputs of each block
G1.InputName = 'e2';
G1.OutputName = 'x1';

G2.InputName = 'e1';
G2.OutputName = 'g2';

G3.InputName = 'e3';
G3.OutputName = 'c';   

H1.InputName = 'c';
H1.OutputName = 'h1';

H2.InputName = 'c';
H2.OutputName = 'h2';

% Deleted H3

% Define the three summing junctions from the block diagram

%Took out S1
S2 = sumblk('e2 = e1 - h2');
S3 = sumblk('e3 = g2 + x1 - h1');

% Build the full connected system from r to y
Ge = connect(G1,G2,G3,H1,H2,S2,S3,'e1','c');

% Simplify/display the result
Ge = minreal(Ge)

% ------------------------------------------------------------
% Make it display like a clean symbolic fraction
% ------------------------------------------------------------
[num, den] = tfdata(Ge, 'v');

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

Ge_pretty = simplify(num_sym / den_sym);

disp('Pretty transfer function C(s)/R(s) = ')
pretty(Ge_pretty)