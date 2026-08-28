clear; clc;

syms w real

% Enter just the magnitude expression
Hmag = (10*10^9)/sqrt((10*10^9 - w^2)^2 + (300000*w)^2);

% Change the one here depending on your K
eqn = Hmag == 1/sqrt(2);

sol = solve(eqn, w);

w_c = double(sol) % Only the positive one matters