clc;
clear;

s = tf('s');

% Replace these with the transfer functions you picked in part (b)
G1 = s;
G2 = 2*s;
G3 = s;
G4 = 1/(s+1);

H1 = tf(4,1); 
H2 = tf(1,1);
H3 = tf(1,1);
H4 = tf(1,1);

% Name the inputs and outputs of each block
G1.InputName = 'e1';
G1.OutputName = 'x1';

G2.InputName = 'e1';
G2.OutputName = 'x2';

G3.InputName = 'e2';
G3.OutputName = 'x3';   

G4.InputName = 'e3';
G4.OutputName = 'c';

H1.InputName = 'c';
H1.OutputName = 'h1';

H2.InputName = 'x3';
H2.OutputName = 'h2';

H3.InputName = 'c';
H3.OutputName = 'h3';

H4.InputName = 'c';
H4.OutputName = 'h4';

% Define the three summing junctions from the block diagram
S1 = sumblk('e1 = r - h4');
S2 = sumblk('e2 = x1 + x2 - h2');
S3 = sumblk('e3 = x3 + e4 - h3');
S4 = sumblk('e4 = x2 - h1');

% Build the full connected system from r to y
T_connect = connect(G1,G2,G3,G4,H1,H2,H3,H4,S1,S2,S3,S4,'r','c');

% Simplify/display the result
T_connect = minreal(T_connect)

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