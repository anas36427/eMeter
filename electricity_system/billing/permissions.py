from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """Allows access only to users with the 'admin' role."""
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', 'meter_reader') == 'admin'
        )

class IsMeterReader(permissions.BasePermission):
    """Allows access to users with 'admin' or 'meter_reader' roles."""
    def has_permission(self, request, view):
        role = getattr(request.user, 'role', 'meter_reader')
        return bool(
            request.user and 
            request.user.is_authenticated and 
            role in ['admin', 'meter_reader']
        )

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object (e.g. consumer viewing their own bill)
    or admins to view/edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Admin can do anything
        if getattr(request.user, 'role', 'meter_reader') == 'admin':
            return True
        
        # Check if the object belongs to the user
        if hasattr(obj, 'consumer'):
            return obj.consumer.user == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        
        return False
