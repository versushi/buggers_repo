function T = symbolicFeedback(G, H, feedbackType)
% symbolicFeedback finds the closed-loop transfer function symbolically.
%
% Inputs:
%   G = forward path transfer function
%   H = feedback transfer function
%   feedbackType = 'negative' or 'positive'
%
% Example to put into Command Window:
%   syms s K a
%   G = K/(s*(s+a));
%   H = 1;
%   T = symbolicFeedback(G,H,'negative');

    syms s

    if nargin < 2
        H = 1;
    end

    if nargin < 3
        feedbackType = 'negative';
    end

    if strcmpi(feedbackType, 'negative')
        T = simplify(G/(1 + G*H));
    elseif strcmpi(feedbackType, 'positive')
        T = simplify(G/(1 - G*H));
    else
        error('feedbackType must be either negative or positive.')
    end

    T = collect(T, s);

    disp('Closed-loop transfer function T(s) = ')
    pretty(T)
end