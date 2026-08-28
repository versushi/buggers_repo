clear;
clc;
close all;

% Open-loop zeros and poles
% z = [1+1j 1-1j];
% p = [-2 -4 -5 -6];
z = 1;
p = [0 -2 -5];

% Open-loop transfer function without variable gain K
G = zpk(z, p, 1);

% Desired percent overshoot if 25% just type 25
PO = 10;

% Convert percent overshoot into damping ratio
zeta = -log(PO/100) / sqrt(pi^2 + log(PO/100)^2);

% Find gain and desired closed-loop pole location
[K_values, s_points] = damping_ratio_gain(G, zeta);

% The correct intersection is usually the one that is within the gain range
% for a stable circuit