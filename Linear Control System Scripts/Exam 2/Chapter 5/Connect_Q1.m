clc;
clear;

s = tf('s');

% Replace these with the transfer functions you picked in part (b)
G1 = 1/(s+1);
G2 = 2/(s+2);
G3 = 3/(s+3);
G4 = 4/(s+4);

H1 = tf(1,1);  % Because H1 = 1 we need to do this
H2 = 1/(s+5);
H3 = tf(2,1);  % Because H1 = 2 we need to do this

% Name the inputs and outputs of each block
G1.InputName = 'e1';
G1.OutputName = 'x1';

G2.InputName = 'e2';
G2.OutputName = 'x2';

G3.InputName = 'e3';
G3.OutputName = 'x3';   % x3 is the signal after G3 and before G4

G4.InputName = 'x3';
G4.OutputName = 'y';

H1.InputName = 'y';
H1.OutputName = 'h1';

H2.InputName = 'x3';    % H2 comes from after G3, before G4
H2.OutputName = 'h2';

H3.InputName = 'y';
H3.OutputName = 'h3';

% Define the three summing junctions from the block diagram
S1 = sumblk('e1 = r - h3');
S2 = sumblk('e2 = x1 - h2');
S3 = sumblk('e3 = x2 + h1');

% Build the full connected system from r to y
T_connect = connect(G1,G2,G3,G4,H1,H2,H3,S1,S2,S3,'r','y');

% Simplify/display the result
T_connect = minreal(T_connect)

disp('Y(s)/R(s) from connect = ')
T_connect

% ------------------------------------------------------------
% Make it display like a clean symbolic fraction
% ------------------------------------------------------------
[num, den] = tfdata(T_connect, 'v');

clear s
syms s

num_sym = poly2sym(num, s);
den_sym = poly2sym(den, s);

% Factor numerator and collect denominator
num_sym = factor(num_sym);
den_sym = collect(den_sym, s);

T_pretty = num_sym / den_sym;

disp('Pretty transfer function Y(s)/R(s) = ')
pretty(T_pretty)