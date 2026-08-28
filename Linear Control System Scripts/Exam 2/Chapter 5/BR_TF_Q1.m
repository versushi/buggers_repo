clc;
clear;

cs = control_systems_formula_code;

s = tf('s');

% Define blocks from part (b)
G1 = 1/(s+1);
G2 = 2/(s+2);
G3 = 3/(s+3);
G4 = 4/(s+4);

H1 = 1;
H2 = 1/(s+5);
H3 = 2;

% Forward path
G_forward = cs.series_tf(G1,G2,G3,G4);

% Denominator terms
term_H1 = cs.series_tf(G3,G4,H1);
term_H2 = cs.series_tf(G2,G3,H2);
term_H3 = cs.series_tf(G1,G2,G3,G4,H3);

% Final transfer function from hand-reduction formula
T_manual = G_forward / (1 - term_H1 + term_H2 + term_H3);

T_manual = minreal(T_manual);

disp('Question 1 transfer function using control_systems_formula_code:')
T_manual