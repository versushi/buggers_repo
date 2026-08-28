clear;
clc;
% Change G depending on your function
G = zpk([],[0 -2 -5],10)
margin(G)

% TF of 10 / (  s^3 + 7*s^2 + 10*s )