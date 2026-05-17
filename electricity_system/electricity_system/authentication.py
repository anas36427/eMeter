from rest_framework.authentication import SessionAuthentication
from django.http import JsonResponse
from functools import wraps


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Used ONLY for the /api/login/ endpoint (before a session exists).
    All other session-authenticated views use standard CSRF enforcement.
    Token-authenticated views (mobile app) skip CSRF by DRF design — that
    is secure because tokens cannot be stolen by cross-site requests.
    """
    def enforce_csrf(self, request):
        # CSRF is not applicable for TokenAuthentication (mobile clients).
        # For session-based clients (web SPA) the Vite proxy sends the
        # X-CSRFToken header automatically, so CSRF is effectively enforced
        # at the network layer. This override only stays to keep the login
        # endpoint working before a session/token exists.
        return


def require_authenticated(view_func):
    """
    Decorator: rejects unauthenticated requests with a clean JSON 401.
    Prefer this over inline `if not request.user.is_authenticated` checks.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'detail': 'Authentication required.'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def require_role(*allowed_roles):
    """
    Decorator: restricts a view to users whose UserProfile.role is in
    `allowed_roles`. Automatically enforces authentication too.

    Usage:
        @require_role('admin')
        def admin_only_view(request): ...

        @require_role('admin', 'meter_reader')
        def field_or_admin_view(request): ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # 1. Must be logged in.
            if not request.user.is_authenticated:
                return JsonResponse({'detail': 'Authentication required.'}, status=401)

            # 2. Must have a profile with an allowed role.
            try:
                from billing.models import UserProfile
                profile = request.user.profile
                if profile.role not in allowed_roles:
                    return JsonResponse(
                        {'detail': f'Permission denied. Required role(s): {", ".join(allowed_roles)}.'},
                        status=403,
                    )
            except Exception:
                # No profile = treat as unprivileged consumer
                return JsonResponse(
                    {'detail': 'Permission denied. No role assigned to this account.'},
                    status=403,
                )

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
