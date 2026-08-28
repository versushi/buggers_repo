function z = getZeros(coeffs)
% getZeros finds the zeros/roots of a polynomial.
%
% Input:
%   coeffs = coefficient vector from highest power to constant
%
% Example:
%   For x^2 + 5x + 6:
%   coeffs = [1 5 6]
%
%   For 2x^5 - 3x^2 + 7:
%   coeffs = [2 0 0 -3 0 7]

    % Remove leading zeros if accidentally entered
    coeffs = coeffs(find(coeffs, 1):end);

    % Check if input is valid
    if isempty(coeffs)
        error('You must enter at least one nonzero coefficient.');
    end

    % Find zeros
    z = roots(coeffs);

    % Display result
    disp('The zeros of the polynomial are:')
    disp(z)
end