% Clear  command window of previous responses
clear;
clc;
% Delcare symbolic cariables, we will declare s and t for s domain and
% timedomain but  do  not put into solve command
syms i1 vo s t;
%Write down the  equations
eqns = [
    i1 == (5*s+312500)/((4*s^2)+5000*s+3125000)
    vo == (12500/s)*i1 + 150/s
];

%For success, # of eqns = # of variables to solve, don't add s and t here
solution = solve(eqns, [i1, vo]);

% Since the solve function returned many variables, this line extracts the
% field vo for the answer we want to find

%Change this line for whatever the question ask for
s_domain_answer = solution.vo;

disp("vo(s)");
pretty(s_domain_answer);

% Inverser laplace of s domain answer obtained  before
t_domain_answer = ilaplace(s_domain_answer,s,t);
disp("vo(t)");
pretty(t_domain_answer);

initial_value_answer = limit(t_domain_answer,t,0)
final_value_answer = limit(t_domain_answer, t, inf)

%  In the Time Domain answer, exp(-2t) means e^-2t