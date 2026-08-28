clear;
clc;

syms s K real

% Original characteristic equation:
% Denominator + K(Numerator) = 0
% Only need to change D or N

% D = (s+2)*(s+4)*(s+5)*(s+6);
% N = (s^2-2*s+2);
D = (s-3)*(s-5);
N = (s+1)*(s+2)*(s^2+10*s+100);

% Expand everything
char_poly = expand(D + K*N);

% Collect terms according to powers of s
char_poly = collect(char_poly, s);

% Write as an equation equal to zero
char_eqn = char_poly == 0;

disp('Expanded characteristic equation:')
pretty(char_eqn)