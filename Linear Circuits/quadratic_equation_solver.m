clear; clc;

% Quadratic form: a*x^2 + b*x + c = 0

% --- Enter coefficients here ---
a = 1;
b = -5;
c = 6;

% Check that it is actually quadratic
if a == 0
    error('Coefficient a cannot be zero for a quadratic equation.');
end

% Discriminant
D = b^2 - 4*a*c;

% Quadratic formula
x1 = (-b + sqrt(D)) / (2*a);
x2 = (-b - sqrt(D)) / (2*a);

% Display results
fprintf('Quadratic: %.4fx^2 + %.4fx + %.4f = 0\n', a, b, c);
fprintf('Discriminant = %.4f\n', D);
fprintf('Zero 1 = %.6f\n', x1);
fprintf('Zero 2 = %.6f\n', x2);