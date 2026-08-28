clc;
clear;

s = tf('s');

% Replace these with the transfer functions you picked in part (b)
G1 = 1/(s^2);
G2 = 50/(s+1);
G3 = s;
G4 = tf(2,1);

H1 = 2/s;  % Because H1 = 1 we need to do this
H2 = tf(1,1);

% Name the inputs and outputs of each block
G1.InputName = 'e1';
G1.OutputName = 'x1';

G2.InputName = 'e2';
G2.OutputName = 'x2';

G3.InputName = 'x2';
G3.OutputName = 'x3';   % x3 is the signal after G3 and before G4

G4.InputName = 'x2';
G4.OutputName = 'x4';

H1.InputName = 'x2';
H1.OutputName = 'h1';

H2.InputName = 'y';    % H2 comes from after G3, before G4
H2.OutputName = 'h2';

% Define the three summing junctions from the block diagram
S1 = sumblk('e1 = r - h2');
S2 = sumblk('e2 = x1 - h1');
S3 = sumblk('y = x3 - x4');

% Build the full connected system from r to y
T_connect = connect(G1,G2,G3,G4,H1,H2,S1,S2,S3,'r','y');

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