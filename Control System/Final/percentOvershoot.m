function OS = percentOvershoot(zeta)
% Calculates percent overshoot for an underdamped second-order system

if zeta <= 0 || zeta >= 1
    error('Damping ratio zeta must be between 0 and 1.')
end

OS = exp((-zeta*pi)/sqrt(1 - zeta^2)) * 100;

end

% In the command window type percentOvershoot(zeta) to run the function

% zeta = fzero(@(zeta) percentOvershoot(zeta) - 20, [0.01 0.99])
% type this into command if we want to find what Zeta is for a specific OS
% value, in the case above it would be 20%