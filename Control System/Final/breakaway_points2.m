function [s_points, s_decimal] = breakaway_points2(z, p)
% BREAKAWAY_POINTS finds candidate real breakaway and break-in points.
%
% Inputs:
%   z = vector containing open-loop zeros
%   p = vector containing open-loop poles
%
% Outputs:
%   s_points  = symbolic decimal candidate points
%   s_decimal = standard numeric candidate points
%
% Method:
%   sum(1/(s - zero)) = sum(1/(s - pole))

    syms s real

    % Convert poles and zeros to symbolic values
    z = sym(z);
    p = sym(p);

    zero_side = sym(0);
    pole_side = sym(0);

    % Build the zero side
    for k = 1:length(z)
        zero_side = zero_side + 1/(s - z(k));
    end

    % Build the pole side
    for k = 1:length(p)
        pole_side = pole_side + 1/(s - p(k));
    end

    % Put everything on one side
    break_expression = simplify(zero_side - pole_side);

    % Separate numerator and denominator
    [numerator, denominator] = numden(break_expression);

    numerator = expand(numerator);
    denominator = expand(denominator);

    % Convert the numerator polynomial into coefficient form
    polynomial_coefficients = sym2poly(numerator);

    % Numerically solve the polynomial
    all_solutions = roots(polynomial_coefficients);

    % Keep only real-valued solutions
    tolerance = 1e-8;

    real_locations = abs(imag(all_solutions)) < tolerance;

    s_decimal = real(all_solutions(real_locations));

    % Sort from left to right on the real axis
    s_decimal = sort(s_decimal);

    % Create a symbolic decimal version for display
    s_points = vpa(sym(s_decimal), 8);

    % Display the reciprocal equation
    disp('Breakaway/break-in equation:')
    pretty(zero_side == pole_side)

    disp('Polynomial being solved:')
    pretty(numerator == 0)

    disp('All numerical roots:')
    disp(all_solutions)

    disp('Real candidate points:')
    disp(s_decimal)

end