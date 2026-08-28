clc
clear

syms s

% ---------------------------------------------------------
% ENTER YOUR TRANSFER FUNCTION HERE
% ---------------------------------------------------------
G = ((s + 1)*(s + 2))/((s + 3)^2*(s + 4));

% Find the partial fraction decomposition
G_partial = partfrac(G, s);

% Display the original transfer function
disp('Original transfer function G(s):')
pretty(G)

% Display the partial fraction form
disp('Partial fraction form:')
pretty(G_partial)

% Verify that both expressions are equal
check = simplify(G - G_partial);

disp('Verification, G(s) - G_partial(s):')
pretty(check)