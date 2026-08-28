function z = quadraticZeros(coeffs)
% Finds the zeros of a quadratic equation:
% a*x^2 + b*x + c = 0
%
% Input:
% coeffs = [a b c]
%
% Output:
% z = the two zeros

if length(coeffs) ~= 3
    error('Enter the coefficients in the form [a b c].')
end

if coeffs(1) == 0
    error('The coefficient a cannot be zero for a quadratic.')
end

z = roots(coeffs);

end