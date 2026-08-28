function cs = control_systems_formula_code()
% CONTROL_SYSTEMS_FORMULA_CODE
% EEL 3657 Linear Control Systems Exam 2 MATLAB helper file.
%
% This file turns the main formulas from the LaTeX formula sheet into
% MATLAB helper functions.
%
% HOW TO USE
%   1) Put this file somewhere on your MATLAB path/current folder.
%   2) In the Command Window, type:
%
%        cs = control_systems_formula_code;
%
%   3) Then call any helper like this:
%
%        s = tf('s');
%        G = 10/(s*(s+2));
%        H = 1;
%        T = cs.feedback_tf(G,H,'negative')
%        poles = cs.closed_loop_poles(T)
%        stab = cs.stability(T)
%        R = cs.routh_table([1 6 11 6])
%        sse = cs.steady_state_errors(G*H)
%        type = cs.system_type(G*H)
%
% NOTES
%   - Transfer-function helpers require the Control System Toolbox.
%   - Routh table works with numeric coefficients and also many symbolic
%     coefficient vectors if you have the Symbolic Math Toolbox.
%   - For steady-state error, use the LOOP GAIN G(s)H(s), not T(s).
%
% FORMULA REMINDERS
%   Series:             Geq = G1*G2*G3*...
%   Parallel:           Geq = G1 + G2 + ...
%   Negative feedback:  T = G/(1 + G*H)
%   Positive feedback:  T = G/(1 - G*H)
%   Characteristic eq:  denominator of T(s) = 0
%   System type:        number of pure integrators/poles at s = 0 in G(s)H(s)
%   Static constants:   Kp = lim G(s)H(s), Kv = lim sG(s)H(s), Ka = lim s^2G(s)H(s)
%                       s->0              s->0                s->0

    cs.series_tf            = @series_tf;
    cs.parallel_tf          = @parallel_tf;
    cs.feedback_tf          = @feedback_tf;
    cs.closed_loop_poles    = @closed_loop_poles;
    cs.stability            = @stability;
    cs.routh_table          = @routh_table;
    cs.routh_sign_changes   = @routh_sign_changes;
    cs.error_constants      = @error_constants;
    cs.steady_state_errors  = @steady_state_errors;
    cs.system_type          = @system_type;
    cs.test_input           = @test_input;
    cs.ess_final_value      = @ess_final_value;
end

% ============================================================
% 1. Basic block reductions
% ============================================================

function Geq = series_tf(varargin)
% SERIES_TF Combine transfer functions in series/cascade.
% Example:
%   Geq = cs.series_tf(G1,G2,G3);

    if nargin == 0
        error('Give at least one transfer function.');
    end

    Geq = varargin{1};
    for k = 2:nargin
        Geq = Geq * varargin{k};
    end

    Geq = local_minreal_if_possible(Geq);
end

function Geq = parallel_tf(varargin)
% PARALLEL_TF Combine transfer functions in parallel.
% Example:
%   Geq = cs.parallel_tf(G1,G2,-G3);  % negative branch included as -G3

    if nargin == 0
        error('Give at least one transfer function.');
    end

    Geq = varargin{1};
    for k = 2:nargin
        Geq = Geq + varargin{k};
    end

    Geq = local_minreal_if_possible(Geq);
end

function T = feedback_tf(G,H,feedback_type)
% FEEDBACK_TF Closed-loop transfer function.
%
% Negative feedback:
%   T = G/(1 + G*H)
%
% Positive feedback:
%   T = G/(1 - G*H)
%
% Examples:
%   T = cs.feedback_tf(G);                 % assumes H = 1, negative feedback
%   T = cs.feedback_tf(G,H,'negative');
%   T = cs.feedback_tf(G,H,'positive');

    if nargin < 2 || isempty(H)
        H = 1;
    end
    if nargin < 3 || isempty(feedback_type)
        feedback_type = 'negative';
    end

    switch lower(string(feedback_type))
        case {"negative","neg","-"}
            T = G/(1 + G*H);
        case {"positive","pos","+"}
            T = G/(1 - G*H);
        otherwise
            error('feedback_type must be ''negative'' or ''positive''.');
    end

    T = local_minreal_if_possible(T);
end

% ============================================================
% 2. Poles and stability
% ============================================================

function p = closed_loop_poles(sys_or_den)
% CLOSED_LOOP_POLES Return poles.
%
% You can give either:
%   - a transfer function object T
%   - a denominator coefficient vector, like [1 6 11 6]
%
% Example:
%   p = cs.closed_loop_poles(T);
%   p = cs.closed_loop_poles([1 6 11 6]);

    p = local_poles(sys_or_den);
end

function out = stability(sys_or_den,tol)
% STABILITY Classify stability from poles.
%
% Stable:   all poles have negative real part.
% Unstable: at least one pole has positive real part.
% Marginal: no RHP poles, but at least one pole on the j*w axis.
%
% Example:
%   out = cs.stability(T)
%   out.status
%   out.poles

    if nargin < 2 || isempty(tol)
        tol = 1e-9;
    end

    p = local_poles(sys_or_den);
    rhp_count = sum(real(p) > tol);
    jw_count  = sum(abs(real(p)) <= tol);

    out = struct();
    out.poles = p;
    out.rhp_poles = rhp_count;
    out.jw_axis_poles = jw_count;

    if rhp_count > 0
        out.status = 'unstable';
        out.reason = 'At least one pole is in the right-half plane.';
    elseif jw_count > 0
        out.status = 'marginal';
        out.reason = 'No right-half-plane poles, but at least one pole is on the imaginary axis.';
    else
        out.status = 'stable';
        out.reason = 'All poles are in the left-half plane.';
    end
end

% ============================================================
% 3. Routh-Hurwitz table
% ============================================================

function R = routh_table(coeff)
% ROUTH_TABLE Build the Routh-Hurwitz array.
%
% Input:
%   coeff = polynomial coefficients in descending powers of s.
%
% Example:
%   R = cs.routh_table([1 6 11 6])
%   % for s^3 + 6s^2 + 11s + 6
%
% Missing powers must be included as zeros.
% Example:
%   s^4 + 3s^2 + 2  -->  [1 0 3 0 2]

    coeff = coeff(:).';

    if isempty(coeff) || coeff(1) == 0
        error('Coefficient vector must start with the nonzero highest-order coefficient.');
    end

    use_symbolic = local_has_symbolic(coeff);
    if use_symbolic
        coeff = sym(coeff);
        eps_sym = sym('epsilon','positive');
        zero_val = sym(0);
    else
        eps_sym = 1e-6;
        zero_val = 0;
    end

    n = length(coeff) - 1;
    rows = n + 1;
    cols = ceil((n + 1)/2);

    if use_symbolic
        R = sym(zeros(rows,cols));
    else
        R = zeros(rows,cols);
    end

    first_row = coeff(1:2:end);
    second_row = coeff(2:2:end);

    R(1,1:length(first_row)) = first_row;
    R(2,1:length(second_row)) = second_row;

    for i = 3:rows
        % Special case: entire row above is zero.
        if local_all_zero(R(i-1,:),use_symbolic)
            power_above = n - (i - 2);
            aux_row = R(i-2,:);
            R(i-1,:) = local_auxiliary_derivative_row(aux_row,power_above,cols,use_symbolic);
        end

        % Special case: first column zero only.
        if local_is_zero(R(i-1,1),use_symbolic)
            R(i-1,1) = eps_sym;
        end

        for j = 1:cols-1
            numerator = R(i-1,1)*R(i-2,j+1) - R(i-2,1)*R(i-1,j+1);
            denominator = R(i-1,1);
            R(i,j) = numerator/denominator;
        end

        if use_symbolic
            R(i,:) = simplify(R(i,:));
        end
    end

    if ~use_symbolic
        R(abs(R) < 1e-12) = zero_val;
    end
end

function changes = routh_sign_changes(coeff,tol)
% ROUTH_SIGN_CHANGES Count first-column sign changes.
%
% Number of sign changes in the first column = number of RHP poles.
%
% Example:
%   changes = cs.routh_sign_changes([1 6 11 6])

    if nargin < 2 || isempty(tol)
        tol = 1e-9;
    end

    R = routh_table(coeff);
    first_col = R(:,1);

    if isa(first_col,'sym')
        first_col = double(subs(first_col, sym('epsilon'), 1e-6));
    end

    first_col(abs(first_col) < tol) = 0;
    first_col = first_col(first_col ~= 0);

    if isempty(first_col)
        changes = 0;
        return;
    end

    signs = sign(first_col);
    changes = sum(signs(1:end-1).*signs(2:end) < 0);
end

% ============================================================
% 4. Steady-state error and system type
% ============================================================

function constants = error_constants(GH)
% ERROR_CONSTANTS Compute Kp, Kv, Ka from loop gain G(s)H(s).
%
% For unity feedback, GH = G.
% For non-unity feedback, GH = G*H.
%
%   Kp = lim GH
%        s->0
%   Kv = lim s*GH
%        s->0
%   Ka = lim s^2*GH
%        s->0
%
% Example:
%   s = tf('s');
%   GH = 10/(s*(s+2));
%   constants = cs.error_constants(GH)

    s = tf('s');

    constants = struct();
    constants.Kp = local_clean_dcgain(GH);
    constants.Kv = local_clean_dcgain(s*GH);
    constants.Ka = local_clean_dcgain(s^2*GH);
end

function errors = steady_state_errors(GH)
% STEADY_STATE_ERRORS Compute standard unity-feedback SSE values.
%
% Use loop gain G(s)H(s), not closed-loop T(s).
%
% Outputs:
%   e_step      = 1/(1+Kp)
%   e_ramp      = 1/Kv
%   e_parabolic = 1/Ka
%
% Example:
%   errors = cs.steady_state_errors(G*H)

    K = error_constants(GH);

    errors = struct();
    errors.Kp = K.Kp;
    errors.Kv = K.Kv;
    errors.Ka = K.Ka;
    errors.e_step = local_reciprocal_1plus(K.Kp);
    errors.e_ramp = local_reciprocal(K.Kv);
    errors.e_parabolic = local_reciprocal(K.Ka);
end

function type_number = system_type(GH,tol)
% SYSTEM_TYPE Count poles at the origin of loop gain G(s)H(s).
%
% Type 0: no pure integrator
% Type 1: one pole at s = 0
% Type 2: two poles at s = 0
%
% Example:
%   type_number = cs.system_type(G*H)

    if nargin < 2 || isempty(tol)
        tol = 1e-8;
    end

    p = local_poles(GH);
    type_number = sum(abs(p) < tol);
end

function R = test_input(input_type)
% TEST_INPUT Return standard Laplace-domain test inputs.
%
%   step:      R(s) = 1/s
%   ramp:      R(s) = 1/s^2
%   parabolic: R(s) = 1/s^3   for r(t) = t^2/2
%
% Example:
%   R = cs.test_input('ramp');

    s = tf('s');

    switch lower(string(input_type))
        case {"step","unit step"}
            R = 1/s;
        case {"ramp","unit ramp"}
            R = 1/s^2;
        case {"parabolic","parabola","unit parabolic"}
            R = 1/s^3;
        otherwise
            error('input_type must be ''step'', ''ramp'', or ''parabolic''.');
    end
end

function ess = ess_final_value(G,H,R)
% ESS_FINAL_VALUE Use final value theorem for standard negative feedback.
%
% For negative feedback:
%   E(s) = R(s)/(1 + G(s)H(s))
%   ess  = lim sE(s)
%          s->0
%
% Example:
%   s = tf('s');
%   ess = cs.ess_final_value(G,1,1/s);       % step input
%   ess = cs.ess_final_value(G,H,1/s^2);     % ramp input with feedback H

    if nargin < 2 || isempty(H)
        H = 1;
    end
    if nargin < 3 || isempty(R)
        s = tf('s');
        R = 1/s;
    else
        s = tf('s');
    end

    E = R/(1 + G*H);
    ess = local_clean_dcgain(s*E);
end

% ============================================================
% 5. Local helper functions
% ============================================================

function sys = local_minreal_if_possible(sys)
    try
        sys = minreal(sys);
    catch
        % Leave unchanged if minreal is unavailable or not applicable.
    end
end

function p = local_poles(sys_or_den)
    if isnumeric(sys_or_den) && isvector(sys_or_den)
        p = roots(sys_or_den(:).');
        return;
    end

    try
        p = pole(sys_or_den);
    catch
        try
            p = poles(sys_or_den);
        catch
            error('Input must be a transfer function object or a denominator coefficient vector.');
        end
    end
end

function value = local_clean_dcgain(sys)
    value = dcgain(local_minreal_if_possible(sys));

    if abs(value) < 1e-12
        value = 0;
    end
end

function y = local_reciprocal(x)
    if isinf(x)
        y = 0;
    elseif x == 0
        y = Inf;
    else
        y = 1/x;
    end
end

function y = local_reciprocal_1plus(x)
    if isinf(x)
        y = 0;
    elseif x == -1
        y = Inf;
    else
        y = 1/(1 + x);
    end
end

function tf_exists = local_has_symbolic(coeff)
    tf_exists = isa(coeff,'sym');

    if tf_exists
        return;
    end

    % Use symbolic math for exact Routh tables if it is available.
    try
        sym(1);
        tf_exists = true;
    catch
        tf_exists = false;
    end
end

function tf_zero = local_is_zero(x,use_symbolic)
    if use_symbolic
        tf_zero = isAlways(simplify(x) == 0);
    else
        tf_zero = abs(x) < 1e-12;
    end
end

function tf_all_zero = local_all_zero(row,use_symbolic)
    if use_symbolic
        tf_all_zero = all(arrayfun(@(x) isAlways(simplify(x) == 0), row));
    else
        tf_all_zero = all(abs(row) < 1e-12);
    end
end

function new_row = local_auxiliary_derivative_row(aux_row,power_above,cols,use_symbolic)
% If an entire Routh row is zero, build auxiliary polynomial from row above,
% differentiate it, and replace the zero row with derivative coefficients.

    if use_symbolic
        new_row = sym(zeros(1,cols));
    else
        new_row = zeros(1,cols);
    end

    powers = power_above:-2:0;

    for k = 1:min(length(aux_row),length(powers))
        coeff = aux_row(k);
        power = powers(k);

        if power > 0
            new_row(k) = coeff*power;
        else
            new_row(k) = 0;
        end
    end
end
