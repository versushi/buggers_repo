clear; clc;

% Symbolic variables
syms vi vo v1 v2 i1 i2 i3 s


% Component values
R1 = 1000;     % 10 kOhm
R2 = 1000;     % 10 kOhm
L1 = .1;       % 100 mH
L2 = .1;       % 100 mH

% Equations
eqns = [
    % Branch currents using your labels
    i1 == v2/(s*L1);            % current through L1 from v2 to ground
    i2 == (vi - v2)/R1;         % current through R1 from vi node to v2
    i3 == (vi - v1)/(s*L2);     % current through L2 from vi node to v1

    % Output voltage across R2
    vo == v1 - v2;

    % Same current through L2 and R2
    i3 == (v1 - v2)/R2;

    % KCL at node v2
    % Current entering v2 through R1 splits through L1 and R2
    i1 == i2 + i3;
];

% Solve
sol = solve(eqns, [i1 i2 i3 v1 v2 vo]);

% Transfer function
H = simplifyFraction(sol.vo / vi);

disp('General H(s) = Vo/Vi')
pretty(H)


