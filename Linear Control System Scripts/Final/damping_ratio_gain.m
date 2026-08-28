function [K_values, s_points] = damping_ratio_gain(G, zeta, r_range)
% DAMPING_RATIO_GAIN finds the positive gain values where a root locus
% intersects a specified constant damping-ratio line.
%
% Inputs:
%   G       = open-loop transfer function without the variable gain K
%   zeta    = desired damping ratio, where 0 < zeta < 1
%   r_range = optional search range [r_min r_max]
%
% Outputs:
%   K_values = positive gain values at the intersections
%   s_points = upper-half-plane intersection points
%
% Example:
%   G = zpk([-2 -3], [-4 -5 -6 -1+1j -1-1j], 1);
%            ^zeros,     ^poles
%   [K, s] = damping_ratio_gain(G, 0.3);
%                                   ^ this is the ratio
    % Check the damping-ratio input
    if zeta <= 0 || zeta >= 1
        error('zeta must be between 0 and 1.');
    end

    % Obtain the existing poles and zeros to estimate a search range
    z = zero(G);
    p = pole(G);

    system_scale = max([1; abs(z(:)); abs(p(:))]);

    % Use an automatic search range unless the user provides one
    if nargin < 3 || isempty(r_range)
        r_min = 1e-4 * system_scale;
        r_max = 1e3 * system_scale;
    else
        r_min = r_range(1);
        r_max = r_range(2);

        if r_min <= 0 || r_max <= r_min
            error('r_range must have the form [positive_min larger_max].');
        end
    end

    % A point on the upper zeta line:
    %
    % s = -zeta*r + j*r*sqrt(1-zeta^2)
    s_from_r = @(r) -zeta*r + ...
        1j*sqrt(1-zeta^2)*r;

    % From the characteristic equation:
    %
    % 1 + K*G(s) = 0
    %
    % K = -1/G(s)
    K_from_r = @(r) -1/evalfr(G, s_from_r(r));

    % Search along the damping-ratio line
    r_scan = logspace(log10(r_min), log10(r_max), 30000);

    K_scan = arrayfun(K_from_r, r_scan);
    imaginary_K = imag(K_scan);

    % Find intervals where imaginary(K) changes sign
    valid = isfinite(imaginary_K);

    crossing_indices = find( ...
        valid(1:end-1) & ...
        valid(2:end) & ...
        imaginary_K(1:end-1).*imaginary_K(2:end) < 0);

    r_candidates = [];

    % Refine each crossing using fzero
    for k = 1:length(crossing_indices)

        index = crossing_indices(k);

        lower_r = r_scan(index);
        upper_r = r_scan(index + 1);

        try
            r_solution = fzero( ...
                @(r) imag(K_from_r(r)), ...
                [lower_r upper_r]);

            r_candidates(end + 1) = r_solution; %#ok<AGROW>
        catch
            % Ignore intervals where fzero cannot find a valid solution
        end
    end

    % Remove repeated numerical solutions
    if ~isempty(r_candidates)
        r_candidates = uniquetol(r_candidates, 1e-6);
    end

    K_values = [];
    s_points = [];

    % Keep only positive, real gain values
    for k = 1:length(r_candidates)

        r = r_candidates(k);
        s_candidate = s_from_r(r);
        K_candidate = K_from_r(r);

        gain_tolerance = 1e-6 * max(1, abs(real(K_candidate)));

        if abs(imag(K_candidate)) < gain_tolerance && ...
                real(K_candidate) > 0

            K_values(end + 1, 1) = real(K_candidate); %#ok<AGROW>
            s_points(end + 1, 1) = s_candidate; %#ok<AGROW>
        end
    end

    % Sort answers according to gain
    if ~isempty(K_values)
        [K_values, order] = sort(K_values);
        s_points = s_points(order);
    end

    % Display results
    fprintf('\nDesired damping ratio: zeta = %.4f\n', zeta);

    theta = 180 - acosd(zeta);

    fprintf('Damping-ratio line angle: %.4f degrees\n', theta);

    if isempty(K_values)

        fprintf('No positive-K root-locus intersection was found.\n');
        fprintf('Try providing a larger r_range.\n');

    else

        fprintf('\nPositive-K intersection(s):\n');

        for k = 1:length(K_values)

            fprintf('\nIntersection %d:\n', k);
            fprintf('  r = omega_n = %.6f\n', abs(s_points(k)));

            fprintf('  s = %.6f %+.6fj\n', ...
                real(s_points(k)), imag(s_points(k)));

            fprintf('  Conjugate pole = %.6f %+.6fj\n', ...
                real(s_points(k)), -imag(s_points(k)));

            fprintf('  K = %.6f\n', K_values(k));

        end
    end

    % Plot the root locus and damping-ratio line
    figure;
    rlocus(G);
    grid on;
    hold on;

    sgrid(zeta, []);

    if ~isempty(s_points)

        plot(real(s_points), imag(s_points), ...
            'o', 'MarkerSize', 8, 'LineWidth', 1.5);

        plot(real(s_points), -imag(s_points), ...
            'o', 'MarkerSize', 8, 'LineWidth', 1.5);

    end

    title(sprintf('Root Locus with \\zeta = %.3f', zeta));

end